/**
 * Scrape product retail prices from Target.com by product name.
 * Creates product_price_list.xlsx for uploading to Cloud SQL.
 *
 * DISCLAIMER: Automated scraping may violate Target's Terms of Service
 * and robots.txt. Use at your own risk. Prefer official APIs or licensed data for
 * production. This script is for personal/educational use with respectful rate limiting.
 *
 * Usage (from demo-grocery-store directory):
 *   cd demo-grocery-store
 *   export PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright
 *   npx ts-node src/scripts/scrape-product-prices-wholefoods.ts [--input=data/products-images-export_1.xlsx] [--output=data/product_price_list.xlsx]
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
const DEFAULT_OUTPUT = path.join(DATA_DIR, "product_price_list.xlsx");
const DELAY_BETWEEN_SEARCHES_MS = 4000; // 4 seconds delay for price-only scraping
const SEARCH_PAGE_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getSearchUrl(productName: string): string {
  const query = encodeURIComponent(productName.trim());
  return `https://www.target.com/s?searchTerm=${query}`;
}

async function extractPriceTarget(page: Page): Promise<string> {
  try {
    // Wait for search results to load first - Target uses specific selectors
    await page.waitForSelector('[data-test="productCard"], [data-testid*="product"], [class*="ProductCard"], main', { timeout: 10000 }).catch(() => null);
    
    // Try to find prices within product containers (search results)
    const price = await page.evaluate(() => {
      // Look for product containers first - Target specific selectors
      const productSelectors = [
        '[data-test="productCard"]',
        '[data-testid*="product"]',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
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
        productContainer = document.querySelector('main, [role="main"], [data-test="searchResults"]');
      }
      
      if (!productContainer) {
        productContainer = document.body;
      }
      
      // Try multiple price selectors within the container - Target specific
      const priceSelectors = [
        '[data-test="product-price"]',
        '[data-testid*="price"]',
        '[class*="Price"]',
        '[class*="price"]',
        '[class*="ProductPrice"]',
        '[class*="product-price"]',
        '[aria-label*="price"]',
        'span[data-test*="price"]',
        'span:has-text("$")',
      ];
      
      for (const selector of priceSelectors) {
        const priceElements = productContainer.querySelectorAll(selector);
        for (const el of Array.from(priceElements)) {
          const text = el.textContent?.trim() || '';
          // Target prices often have format like "$4.99" or "4.99"
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
      
      // Fallback: search in container text for price patterns
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
    return '';
  }
}

async function scrapePriceForProduct(
  page: Page,
  productName: string,
  retryCount = 0
): Promise<string> {
  const url = getSearchUrl(productName);
  
  try {
    // Navigate to search page
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: SEARCH_PAGE_TIMEOUT_MS 
    });
    
    // Wait for search to execute and results to appear
    await sleep(3000); // Give time for search results to load
    
    // Wait for product results specifically - Target selectors
    try {
      await page.waitForSelector('[data-test="productCard"], [data-testid*="product"], [class*="ProductCard"], [data-test="searchResults"], main', { timeout: 10000 });
    } catch {
      // If specific selectors don't appear, wait a bit more
      await sleep(2000);
    }
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await sleep(1500);
    
    // Extract price
    const price = await extractPriceTarget(page);
    
    return price;
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
      await sleep(4000 * (retryCount + 1)); // Exponential backoff
      return scrapePriceForProduct(page, productName, retryCount + 1);
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
  console.log(`Scraping prices from Target.com: ${toProcess.length} products (${limit > 0 ? `limit ${limit}` : "all"}).`);
  console.log("Delay between searches:", DELAY_BETWEEN_SEARCHES_MS, "ms. Run with --headed to see the browser.");

  const results = new Map<string, string>();
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
        const price = await scrapePriceForProduct(page, name);
        results.set(name, price);
        const priceStr = price ? `$${price}` : 'no price found';
        console.log(priceStr);
      } catch (e) {
        console.log("error:", (e as Error).message);
        results.set(name, '');
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

  // Create output Excel with Product and Price columns
  const outRows = rows.map((row) => {
    const name = (row[productCol] ?? "").trim();
    const price = results.get(name) ?? '';
    return {
      Product: name,
      Price: price ? `$${price}` : '',
      Price_Numeric: price || '', // Numeric value for database import
    };
  });

  const outDir = path.dirname(output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const newWb = XLSX.utils.book_new();
  const newWs = XLSX.utils.json_to_sheet(outRows);
  XLSX.utils.book_append_sheet(newWb, newWs, "Product Prices");
  XLSX.writeFile(newWb, output, { bookType: "xlsx" });
  
  const productsWithPrices = Array.from(results.values()).filter(p => p.length > 0).length;
  console.log(`\nWritten ${output}`);
  console.log(`Summary: ${productsWithPrices}/${toProcess.length} products with prices found.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
