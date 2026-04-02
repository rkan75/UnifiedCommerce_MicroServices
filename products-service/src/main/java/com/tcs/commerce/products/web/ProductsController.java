package com.tcs.commerce.products.web;

import com.tcs.commerce.products.service.ProductsService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Exposes GET /store/products and GET /store/product-variants compatible with Medusa Store API.
 * Query params for products: limit, offset, region_id, handle, id, q, category_id, collection_id, order.
 * Response: { products: [...], count: N } or { variant: {...} } / { variants: [...] }.
 */
@RestController
@RequestMapping(value = "/store", produces = MediaType.APPLICATION_JSON_VALUE)
public class ProductsController {

    private final ProductsService productsService;

    public ProductsController(ProductsService productsService) {
        this.productsService = productsService;
    }

    @GetMapping("/products")
    public ResponseEntity<ProductsResponse> getProducts(
        @RequestParam(required = false) Integer limit,
        @RequestParam(required = false) Integer offset,
        @RequestParam(required = false, name = "region_id") String regionId,
        @RequestParam(required = false) String handle,
        @RequestParam(required = false) List<String> id,
        @RequestParam(required = false) String q,
        /** Medusa / storefront often sends repeated category_id=… ; bind as list so the filter is never dropped */
        @RequestParam(required = false, name = "category_id") List<String> categoryIds,
        @RequestParam(required = false, name = "category_handle") String categoryHandle,
        @RequestParam(required = false, name = "collection_id") List<String> collectionIds,
        @RequestParam(required = false, name = "type_id") String typeId,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String tag,
        @RequestParam(required = false, name = "sales_channel_id") String salesChannelId,
        @RequestParam(required = false, name = "created_after") String createdAfter,
        @RequestParam(required = false, name = "created_before") String createdBefore,
        @RequestParam(required = false, name = "updated_after") String updatedAfter,
        @RequestParam(required = false, name = "updated_before") String updatedBefore,
        @RequestParam(required = false) String order,
        @RequestParam(required = false) String fields
    ) {
        String categoryId = firstNonBlank(categoryIds);
        String collectionId = firstNonBlank(collectionIds);
        // "fields" (Medusa sparse fieldset) is ignored; response is full StoreProduct-like shape.
        ProductsResponse response = productsService.getProducts(
            handle,
            id,
            q,
            categoryId,
            categoryHandle,
            collectionId,
            regionId,
            typeId,
            limit,
            offset,
            status,
            tag,
            salesChannelId,
            createdAfter,
            createdBefore,
            updatedAfter,
            updatedBefore,
            order
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/product-types")
    public ResponseEntity<Map<String, Object>> listProductTypes() {
        return ResponseEntity.ok(Map.of("product_types", productsService.listProductTypes()));
    }

    @GetMapping("/product-tags")
    public ResponseEntity<Map<String, Object>> listProductTags() {
        return ResponseEntity.ok(Map.of("tags", productsService.listDistinctTags()));
    }

    @GetMapping("/sales-channels")
    public ResponseEntity<Map<String, Object>> listSalesChannels() {
        return ResponseEntity.ok(Map.of("sales_channels", productsService.listSalesChannels()));
    }

    /**
     * Distinct category ids with at least one product of {@code type_id} — avoids storefront paginating the full catalog.
     */
    @GetMapping("/catalog-scope/category-ids")
    public ResponseEntity<Map<String, List<String>>> catalogScopeCategoryIds(
        @RequestParam(name = "type_id") String typeId
    ) {
        List<String> ids = productsService.listDistinctCategoryIdsForProductType(typeId);
        return ResponseEntity.ok(Map.of("ids", ids));
    }

    /**
     * Distinct {@code product.collection_id} values for products of {@code type_id}.
     */
    @GetMapping("/catalog-scope/collection-ids")
    public ResponseEntity<Map<String, List<String>>> catalogScopeCollectionIds(
        @RequestParam(name = "type_id") String typeId
    ) {
        List<String> ids = productsService.listDistinctCollectionIdsForProductType(typeId);
        return ResponseEntity.ok(Map.of("ids", ids));
    }

    private static String firstNonBlank(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        return values.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .findFirst()
            .orElse(null);
    }

    @GetMapping("/product-variants/{variantId}")
    public ResponseEntity<Map<String, VariantResponseDto>> getVariant(
        @PathVariable String variantId,
        @RequestParam(required = false, name = "region_id") String regionId
    ) {
        VariantResponseDto variant = productsService.getVariantById(variantId, regionId);
        if (variant == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("variant", variant));
    }

    @GetMapping("/product-variants")
    public ResponseEntity<Map<String, List<VariantResponseDto>>> getVariants(
        @RequestParam(required = false) List<String> id,
        @RequestParam(required = false, name = "region_id") String regionId
    ) {
        if (id == null || id.isEmpty()) {
            return ResponseEntity.ok(Map.of("variants", List.<VariantResponseDto>of()));
        }
        List<VariantResponseDto> variants = productsService.getVariantsByIds(id, regionId);
        return ResponseEntity.ok(Map.of("variants", variants));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "products-service"));
    }
}
