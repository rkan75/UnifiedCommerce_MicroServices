# Product Images Database Structure

## Database Tables and Columns

In Medusa, product images are stored across multiple tables:

### 1. `product` Table
- **Column**: `thumbnail` (TEXT)
- **Purpose**: Stores the main/thumbnail image URL for the product
- **Updated by**: `productModuleService.updateProducts()` with `thumbnail` field

### 2. `image` Table
- **Column**: `id` (TEXT, Primary Key)
- **Column**: `url` (TEXT)
- **Purpose**: Stores individual image records with their URLs
- **Note**: Each image has a unique ID

### 3. `product_image` Table (Junction Table)
- **Column**: `product_id` (TEXT, Foreign Key → `product.id`)
- **Column**: `image_id` (TEXT, Foreign Key → `image.id`)
- **Purpose**: Links products to their images (many-to-many relationship)
- **Note**: This table creates the association between products and images

## How Images Are Updated

When updating product images via `productModuleService.updateProducts()`:

1. **To update an existing image**: Provide `{ id: existingImageId, url: newUrl }`
   - Updates the `image.url` column for that image ID
   - The `product_image` relationship remains unchanged

2. **To add a new image**: Provide `{ url: newUrl }` (without `id`)
   - Creates a new record in `image` table
   - Creates a new record in `product_image` table linking product to image

3. **To remove an image**: Omit it from the `images` array
   - The `product_image` relationship is removed
   - The `image` record may remain (depending on Medusa's cleanup logic)

## Current Script Behavior

The `update-product-images-from-excel.ts` script:

1. **Reads from Excel**: Product, Thumbnail URL, Image URL 1-3
2. **Updates thumbnail**: Sets `product.thumbnail` column
3. **Updates images**: 
   - Updates existing images by ID with new URLs
   - Adds new images for any additional URLs
   - Limits to 5 images maximum per product

## SQL Query to Check Product Images

```sql
-- View all product images
SELECT 
  p.id as product_id,
  p.title,
  p.thumbnail,
  i.id as image_id,
  i.url as image_url
FROM product p
LEFT JOIN product_image pi ON p.id = pi.product_id
LEFT JOIN image i ON pi.image_id = i.id
WHERE p.deleted_at IS NULL
ORDER BY p.title, i.created_at;
```

## Troubleshooting

If images are not updating:

1. **Check if images exist**: Query the `product_image` table
2. **Verify image URLs**: Check the `image.url` column
3. **Check product matching**: Ensure product titles in Excel match database exactly
4. **Review script logs**: Look for "Updated images" count in script output

## Related Tables

- **`product_variant_image`**: Links variants to images (for variant-specific images)
- **`product`**: Main product table with `thumbnail` column
