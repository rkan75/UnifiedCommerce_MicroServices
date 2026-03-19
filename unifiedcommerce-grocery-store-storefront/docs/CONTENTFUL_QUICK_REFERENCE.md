# Contentful Quick Reference

Quick reference for setting up Contentful content types and entries.

## Contentful Dashboard URLs

- **Main Dashboard**: https://app.contentful.com
- **Content Model**: https://app.contentful.com/spaces/{SPACE_ID}/content_types
- **Content**: https://app.contentful.com/spaces/{SPACE_ID}/entries
- **API Keys**: https://app.contentful.com/spaces/{SPACE_ID}/api/keys

## Content Types Setup

### 1. WeeklyAdDeal Content Type

**Content Type ID**: `weeklyAdDeal`

**Fields**:
```
title (Short text, Required)
description (Long text, Optional)
price (Short text, Required)
wasPrice (Short text, Optional)
category (Short text, Required)
image (Media, Optional, Images only)
productHandle (Short text, Optional)
validThrough (Date & time, Optional)
```

**Display Field**: `title`

### 2. WeeklyAd Content Type

**Content Type ID**: `weeklyAd`

**Fields**:
```
title (Short text, Required)
description (Long text, Optional)
startDate (Date & time, Required)
endDate (Date & time, Required)
coverImage (Media, Optional, Images only)
featuredDeals (References, Many, Required, Content type: weeklyAdDeal)
```

**Display Field**: `title`

## Sample Entry Data

### Sample Deal Entry

```json
{
  "title": "Organic Bananas",
  "price": "$0.69",
  "wasPrice": "$0.99",
  "category": "Produce",
  "description": "Fresh organic bananas"
}
```

### Sample Weekly Ad Entry

```json
{
  "title": "This Week's Deals",
  "description": "Save on groceries this week. Valid in-store and online.",
  "startDate": "2026-02-09T00:00:00Z",
  "endDate": "2026-02-15T23:59:59Z",
  "featuredDeals": [
    // Array of references to weeklyAdDeal entries
  ]
}
```

## API Query Examples

### Fetch Weekly Ad with Deals

```bash
curl "https://cdn.contentful.com/spaces/{SPACE_ID}/environments/master/entries?access_token={ACCESS_TOKEN}&content_type=weeklyAd&include=2&order=-sys.createdAt&limit=1"
```

### Fetch All Deals

```bash
curl "https://cdn.contentful.com/spaces/{SPACE_ID}/environments/master/entries?access_token={ACCESS_TOKEN}&content_type=weeklyAdDeal&limit=100"
```

## Environment Variables

```env
NEXT_PUBLIC_CONTENTFUL_SPACE_ID=your_space_id
NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN=your_access_token
NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT=master
```

## Common Issues

### 1. References Not Resolving

**Problem**: `featuredDeals` array is empty even though entries are linked.

**Solution**: 
- Ensure `include=2` is in the query parameters
- Verify deals are published
- Check that content type IDs match exactly (`weeklyAdDeal`)

### 2. Dates Not Parsing

**Problem**: Date fields return null or invalid dates.

**Solution**:
- Use ISO format: `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DD`
- Ensure timezone is set correctly in Contentful
- Check locale settings

### 3. Images Not Loading

**Problem**: Image URLs are incorrect or missing.

**Solution**:
- Ensure images are uploaded and published
- Check that image field type is "Media" → "Images only"
- Verify `https:` prefix is added to URLs (Contentful returns URLs without protocol)

## Testing Checklist

- [ ] Content types created and published
- [ ] At least 3 deal entries created and published
- [ ] Weekly ad entry created with date range
- [ ] Weekly ad entry references deal entries
- [ ] Weekly ad entry is published
- [ ] Environment variables set correctly
- [ ] Page loads without errors
- [ ] Deals display correctly
- [ ] Date range shows correctly
- [ ] Categories group correctly

## Next Steps After Setup

1. **Add Images**: Upload product images to deals
2. **Link Products**: Add `productHandle` to link deals to actual products
3. **Add Localization**: Create entries in multiple locales
4. **Schedule Updates**: Set up weekly workflow to create new ads
5. **Add Analytics**: Track which deals perform best
