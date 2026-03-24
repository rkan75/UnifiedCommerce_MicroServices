-- Cart service tables in public schema (same DB as Medusa). Run once: cd cart-service && ./run-schema.sh
-- Java service uses public.commerce_cart, public.commerce_line_item, etc.

CREATE TABLE IF NOT EXISTS public.commerce_cart (
    id VARCHAR(64) PRIMARY KEY,
    region_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64),
    email VARCHAR(255),
    locale VARCHAR(16),
    currency_code VARCHAR(8) DEFAULT 'usd',
    shipping_address JSONB,
    billing_address JSONB,
    metadata JSONB,
    shipping_methods JSONB,
    promo_codes JSONB,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commerce_line_item (
    id VARCHAR(64) PRIMARY KEY,
    cart_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64),
    title VARCHAR(512),
    quantity DECIMAL(20,4) NOT NULL DEFAULT 1,
    unit_price INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commerce_order (
    id VARCHAR(64) PRIMARY KEY,
    cart_id VARCHAR(64),
    region_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64),
    email VARCHAR(255),
    status VARCHAR(32) DEFAULT 'pending',
    shipping_address JSONB,
    billing_address JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commerce_order_line_item (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    variant_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64),
    title VARCHAR(512),
    quantity DECIMAL(20,4) NOT NULL,
    unit_price INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_line_item_order_id ON public.commerce_order_line_item(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_line_item_cart_id ON public.commerce_line_item(cart_id);
CREATE INDEX IF NOT EXISTS idx_commerce_cart_region_id ON public.commerce_cart(region_id);
CREATE INDEX IF NOT EXISTS idx_commerce_cart_customer_id ON public.commerce_cart(customer_id);
