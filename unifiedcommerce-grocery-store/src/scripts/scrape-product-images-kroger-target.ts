/**
 * Scrape product image URLs and prices from Whole Foods Market (wholefoodsmarket.com) by product name.
 *
 * DISCLAIMER: Automated scraping may violate Whole Foods' Terms of Service
 * and robots.txt. Use at your own risk. Prefer official APIs or licensed data for
 * production. This script is for personal/educational use with respectful rate limiting.
 *
 * Usage (from demo-grocery-store directory):
 *   cd demo-grocery-store
 *   npx ts-node src/scripts/scrape-product-images-kroger-target.ts [--limit=10] [--input=data/products-images-export_1.xlsx] [--output=data/products-images-scraped.xlsx]
 *
 * Or from medusacommerce root:
 *   npx ts-node demo-grocery-store/src/scripts/scrape-product-images-kroger-target.ts [--limit=10]
 *
 * Requires: npm install playwright && npx playwright install chromium
 */
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import * as XLSX from "xlsx";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_INPUT = path.join(DATA_DIR, "products-images-export_1.xlsx");
const DEFAULT_OUTPUT = path.join(DATA_DIR, "products-images-scraped.xlsx");
const DELAY_BETWEEN_SEARCHES_MS = 5000; // Increased to 5 seconds to avoid rate limiting
const SEARCH_PAGE_TIMEOUT_MS = 30000; // Increased timeout
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getSearchUrl(productName: string): string {
  const query = encodeURIComponent(productName.trim());
  return `https://www.wholefoodsmarket.com/search?text=${query}`;
}

type ScrapeResult = {
  images: string[];
  price: string;
};

async function extractPriceWholeFoods(page: Page): Promise<string> {
  try {
    // Wait for search results to load first
    await page.waitForSelector('[class*="ProductCard"], [class*="product-card"], [class*="ProductTile"], main', { timeout: 10000 }).catch(() => null);
    
    // Try to find prices within product containers (search results)
    const price = await page.evaluate(() => {
      // Look for product containers first
      const productSelectors = [
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[data-testid*="product"]',
      ];
      
      let productContainer: Element | null = null;
      for (const selector of productSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          productContainer = container;
          break;
        }
      }
      
      // If no product container, look in main content
      if (!productContainer) {
        productContainer = document.querySelector('main, [role="main"]');
      }
      
      if (!productContainer) {
        productContainer = document.body;
      }
      
      // Try multiple price selectors within the container
      const priceSelectors = [
        '[class*="Price"]',
        '[class*="price"]',
        '[data-testid*="price"]',
        '[data-automation-id*="price"]',
        '[aria-label*="price"]',
        'span:has-text("$")',
      ];
      
      for (const selector of priceSelectors) {
        const priceElements = productContainer.querySelectorAll(selector);
        for (const el of Array.from(priceElements)) {
          const text = el.textContent?.trim() || '';
          const match = text.match(/\$?\s*(\d+\.?\d{0,2})/);
          if (match) {
            const priceValue = match[1];
            const numPrice = parseFloat(priceValue);
            // Valid price should be between $0.01 and $1000 (reasonable grocery range)
            if (!isNaN(numPrice) && numPrice > 0 && numPrice < 1000) {
              return priceValue;
            }
          }
        }
      }
      
      // Fallback: search in container text
      const containerText = productContainer.textContent || '';
      const matches = containerText.match(/\$\s*(\d+\.?\d{0,2})/g);
      if (matches && matches.length > 0) {
        for (const match of matches) {
          const priceValue = match.replace('$', '').trim();
          const numPrice = parseFloat(priceValue);
          if (!isNaN(numPrice) && numPrice > 0 && numPrice < 1000) {
            return priceValue;
          }
        }
      }
      
      return '';
    });
    
    return price || '';
  } catch (e) {
    // Price extraction failed, return empty string
    return '';
  }
}

async function extractImagesWholeFoods(page: Page, productName: string): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    // Wait for search results to load - look for product grid/list containers
    await page.waitForSelector('[class*="ProductCard"], [class*="product-card"], [class*="ProductTile"], [data-testid*="product"], [class*="search-results"]', { timeout: 15000 }).catch(() => null);
    
    // Scroll down to ensure all product images are loaded
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await sleep(2000);
    
    // Try to find product cards/containers first, then extract images from them
    const productImages = await page.evaluate((productName) => {
      const images: string[] = [];
      
      // Common patterns for Whole Foods product containers
      const productSelectors = [
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[data-testid*="product"]',
        '[class*="ProductItem"]',
        '[class*="product-item"]',
        '[class*="SearchResult"]',
        '[class*="search-result"]',
      ];
      
      let productContainers: Element[] = [];
      
      for (const selector of productSelectors) {
        const containers = Array.from(document.querySelectorAll(selector));
        if (containers.length > 0) {
          productContainers = containers;
          break;
        }
      }
      
      // If no product containers found, look for images in main content area
      if (productContainers.length === 0) {
        const mainContent = document.querySelector('main, [role="main"], [class*="main"], [class*="content"]');
        if (mainContent) {
          productContainers = [mainContent];
        }
      }
      
      // Extract images from product containers
      for (const container of productContainers.slice(0, 10)) {
        const imgs = container.querySelectorAll('img');
        for (const img of Array.from(imgs)) {
          const src = (img as HTMLImageElement).src || 
                      img.getAttribute('src') || 
                      img.getAttribute('data-src') ||
                      img.getAttribute('data-lazy-src');
          
          if (src && typeof src === 'string' && src.startsWith('http')) {
            // Filter out common non-product images
            const lowerSrc = src.toLowerCase();
            const lowerName = productName.toLowerCase();
            
            if (
              !lowerSrc.includes('logo') &&
              !lowerSrc.includes('icon') &&
              !lowerSrc.includes('banner') &&
              !lowerSrc.includes('header') &&
              !lowerSrc.includes('footer') &&
              !lowerSrc.includes('nav') &&
              !lowerSrc.includes('ad') &&
              !lowerSrc.includes('advertisement') &&
              !lowerSrc.includes('placeholder') &&
              !lowerSrc.includes('loading') &&
              (lowerSrc.includes('product') || 
               lowerSrc.includes('image') || 
               lowerSrc.includes('amazon') ||
               lowerSrc.includes('wholefoods') ||
               lowerSrc.includes('cdn') ||
               lowerSrc.includes('media'))
            ) {
              images.push(src);
              if (images.length >= 5) break;
            }
          }
        }
        if (images.length >= 5) break;
      }
      
      return images;
    }, productName);
    
    urls.push(...productImages);
    
    // If we didn't find enough images, try a more direct approach
    if (urls.length === 0) {
      const directImgs = await page.$$eval(
        'main img, [class*="product"] img, [class*="Product"] img, [data-testid*="product"] img',
        (elements: HTMLImageElement[]) =>
          elements
            .map((el) => {
              const src = el.src || el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src");
              return src;
            })
            .filter((s): s is string => {
              if (!s || !s.startsWith("http")) return false;
              const lower = s.toLowerCase();
              return !lower.includes("logo") && 
                     !lower.includes("icon") && 
                     !lower.includes("banner") &&
                     !lower.includes("header") &&
                     (lower.includes("product") || lower.includes("amazon") || lower.includes("wholefoods"));
            })
            .slice(0, 5)
      );
      urls.push(...directImgs);
    }
    
  } catch (error) {
    console.log(`  Warning: Image extraction error: ${(error as Error).message}`);
  }
  
  return [...new Set(urls)];
}

async function scrapeProductData(
  page: Page,
  productName: string,
  retryCount = 0
): Promise<ScrapeResult> {
  const url = getSearchUrl(productName);
  
  try {
    // Navigate to search page
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: SEARCH_PAGE_TIMEOUT_MS 
    });
    
    // Wait for search to execute and results to appear
    await sleep(4000); // Give time for search results to load
    
    // Wait for product results specifically
    try {
      await page.waitForSelector('[class*="ProductCard"], [class*="product-card"], [class*="ProductTile"], [class*="search-results"], main', { timeout: 10000 });
    } catch {
      // If specific selectors don't appear, wait a bit more
      await sleep(3000);
    }
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await sleep(2000);
    
    // Extract images with product name context for better filtering
    const images = await extractImagesWholeFoods(page, productName);
    const price = await extractPriceWholeFoods(page);
    
    return { images, price };
  } catch (error) {
    const errorMsg = (error as Error).message;
    
    // Retry on HTTP/2 protocol errors or network errors
    if (
      (errorMsg.includes("ERR_HTTP2_PROTOCOL_ERROR") || 
       errorMsg.includes("net::ERR") ||
       errorMsg.includes("timeout")) &&
      retryCount < MAX_RETRIES
    ) {
      console.log(`  Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(5000 * (retryCount + 1)); // Exponential backoff
      return scrapeProductData(page, productName, retryCount + 1);
    }
    
    throw error;
  }
}

function parseArgs(): { limit: number; input: string; output: string; headless: boolean } {
  const args = process.argv.slice(2);
  let limit = 0;
  let input = DEFAULT_INPUT;
  let output = DEFAULT_OUTPUT;
  let headless = true;
  for (const a of args) {
    if (a.startsWith("--limit=")) limit = parseInt(a.split("=")[1], 10) || 0;
    if (a.startsWith("--input=")) input = a.split("=").slice(1).join("=").trim();
    if (a.startsWith("--output=")) output = a.split("=").slice(1).join("=").trim();
    if (a === "--headed") headless = false;
  }
  return { limit, input, output, headless };
}

async function main(): Promise<void> {
  const { limit, input, output, headless } = parseArgs();

  if (!fs.existsSync(input)) {
    console.error(`Input file not found: ${input}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(input);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  const productCol = "Product";
  if (rows.length === 0 || !(productCol in rows[0])) {
    console.error("Excel must have a 'Product' column (column A).");
    process.exit(1);
  }

  const uniqueProducts = [...new Set(rows.map((r) => (r[productCol] ?? "").trim()).filter(Boolean))];
  const toProcess = limit > 0 ? uniqueProducts.slice(0, limit) : uniqueProducts;
  console.log(`Scraping from Whole Foods Market: ${toProcess.length} products (${limit > 0 ? `limit ${limit}` : "all"}).`);
  console.log("Delay between searches:", DELAY_BETWEEN_SEARCHES_MS, "ms. Run with --headed to see the browser.");

  const results = new Map<string, ScrapeResult>();
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    // Launch browser with realistic settings to avoid detection
    browser = await chromium.launch({ 
      headless,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      ]
    });
    
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0"
      }
    });
    
    const page = await context.newPage();
    
    // Remove webdriver property to avoid detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    for (let i = 0; i < toProcess.length; i++) {
      const name = toProcess[i];
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${name} ... `);
      try {
        const data = await scrapeProductData(page, name);
        results.set(name, data);
        const imgCount = data.images.length;
        const priceStr = data.price ? `$${data.price}` : 'no price';
        const firstImage = data.images[0] ? data.images[0].substring(0, 60) + '...' : 'none';
        console.log(`${imgCount} image(s), ${priceStr}`);
        if (imgCount > 0) {
          console.log(`  First image: ${firstImage}`);
        }
      } catch (e) {
        console.log("error:", (e as Error).message);
        results.set(name, { images: [], price: '' });
      }
      if (i < toProcess.length - 1) await sleep(DELAY_BETWEEN_SEARCHES_MS);
    }

    if (context) await context.close();
    if (browser) await browser.close();
    browser = null;
    context = null;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }

  const outRows = rows.map((row) => {
    const name = (row[productCol] ?? "").trim();
    const data = results.get(name) ?? { images: [], price: '' };
    const out: Record<string, string> = { ...row };
    out["Thumbnail URL"] = data.images[0] ?? "";
    out["Image URL 1"] = data.images[1] ?? "";
    out["Image URL 2"] = data.images[2] ?? "";
    out["Image URL 3"] = data.images[3] ?? "";
    out["Price"] = data.price ? `$${data.price}` : "";
    return out;
  });

  const allHeaders = Array.from(
    new Set(outRows.flatMap((r) => Object.keys(r)))
  );
  const outDir = path.dirname(output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const newWb = XLSX.utils.book_new();
  const newWs = XLSX.utils.json_to_sheet(outRows, { header: allHeaders });
  XLSX.utils.book_append_sheet(newWb, newWs, "Products");
  XLSX.writeFile(newWb, output, { bookType: "xlsx" });
  console.log(`\nWritten ${output}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
