-- ═══════════════════════════════════════════════════════
--  GIFTESS – Complete Supabase Setup & Migration
--  Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════

-- ── 1. STORAGE BUCKET SETUP ──────────────────────────────
-- Run these in Supabase Dashboard → Storage → New Bucket
-- Bucket name: product-photos
-- Public: YES (enable public access)
-- Then add these storage policies:

-- STORAGE POLICIES (run in SQL Editor):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-photos',
  'product-photos',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

-- Storage RLS: Allow anyone to view public files
CREATE POLICY IF NOT EXISTS "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-photos');

-- Storage RLS: Allow uploads (anon key — for admin panel)
CREATE POLICY IF NOT EXISTS "Allow Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-photos');

-- Storage RLS: Allow update
CREATE POLICY IF NOT EXISTS "Allow Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-photos');

-- Storage RLS: Allow delete
CREATE POLICY IF NOT EXISTS "Allow Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-photos');

-- ── 2. PROFILES TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name  TEXT,
  phone      TEXT,
  role       TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Anyone insert profile" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admin read all profiles" ON profiles FOR SELECT USING (true);

-- ── 3. CATEGORIES TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  emoji         TEXT,
  photo         TEXT,
  display_order INTEGER DEFAULT 1,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read categories"   ON categories FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admin insert categories"  ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admin update categories"  ON categories FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Admin delete categories"  ON categories FOR DELETE USING (true);

INSERT INTO categories (name, slug, emoji, display_order, status)
SELECT * FROM (VALUES
  ('Birthday Hampers',  'Birthday',    '🎂', 1, 'active'),
  ('Anniversary Gifts', 'Anniversary', '💑', 2, 'active'),
  ('Valentine Specials','Valentine',   '💝', 3, 'active'),
  ('Gifts for Her',     'Her',         '👛', 4, 'active'),
  ('Gifts for Him',     'Him',         '🎩', 5, 'active'),
  ('Custom Hamper',     'custom',      '✨', 6, 'active')
) AS v(name, slug, emoji, display_order, status)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- ── 4. PRODUCTS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  price_old   NUMERIC DEFAULT 0,
  price_sale  NUMERIC DEFAULT 0,
  description TEXT,
  photos      TEXT[] DEFAULT '{}',
  status      TEXT DEFAULT 'active',
  wa_message  TEXT,
  featured    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read products"   ON products FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admin insert products"  ON products FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admin update products"  ON products FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Admin delete products"  ON products FOR DELETE USING (true);

-- ── 5. ORDERS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         TEXT UNIQUE,
  user_id          UUID REFERENCES auth.users(id),
  customer_name    TEXT,
  customer_email   TEXT,
  customer_phone   TEXT,
  delivery_address TEXT,
  pincode          TEXT,
  items            JSONB,
  subtotal         NUMERIC DEFAULT 0,
  shipping_fee     NUMERIC DEFAULT 0,
  discount         NUMERIC DEFAULT 0,
  tax_amount       NUMERIC DEFAULT 0,
  total            NUMERIC DEFAULT 0,
  promo_code       TEXT,
  status           TEXT DEFAULT 'pending',
  tracking_link    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users read own orders" ON orders FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY IF NOT EXISTS "Anyone insert orders"  ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admin read all orders" ON orders FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admin update orders"   ON orders FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Admin delete orders"   ON orders FOR DELETE USING (true);

-- Add missing columns if upgrading
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pincode          TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal         NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee     NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount         NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount       NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code       TEXT;

-- ── 6. HERO SETTINGS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hero_settings (
  id       INTEGER PRIMARY KEY DEFAULT 1,
  title    TEXT DEFAULT 'Premium Customised Gift Hampers',
  subtitle TEXT DEFAULT 'Crafted with love. Delivered with care.',
  btn1     TEXT DEFAULT 'Shop Now',
  btn2     TEXT DEFAULT 'Create Your Own Hamper'
);
INSERT INTO hero_settings (id, title, subtitle, btn1, btn2)
VALUES (1, 'Premium Customised Gift Hampers', 'Crafted with love. Delivered with care.', 'Shop Now', 'Create Your Own Hamper')
ON CONFLICT (id) DO NOTHING;

-- ── 7. STORE SETTINGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_settings (
  id                INTEGER PRIMARY KEY DEFAULT 1,
  store_name        TEXT DEFAULT 'Giftess',
  wa_number         TEXT DEFAULT '916002698296',
  contact_email     TEXT DEFAULT 'hello@giftess.com',
  shipping_fee      NUMERIC DEFAULT 99,
  free_shipping_min NUMERIC DEFAULT 999,
  tax_enabled       BOOLEAN DEFAULT false,
  tax_percent       NUMERIC DEFAULT 0,
  promo_codes       JSONB DEFAULT '[]'
);
INSERT INTO store_settings (id, store_name, wa_number, contact_email, shipping_fee, free_shipping_min, tax_enabled, tax_percent, promo_codes)
VALUES (1, 'Giftess', '916002698296', 'hello@giftess.com', 99, 999, false, 0, '[]')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_fee      NUMERIC DEFAULT 99;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS free_shipping_min NUMERIC DEFAULT 999;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_enabled       BOOLEAN DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_percent       NUMERIC DEFAULT 0;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS promo_codes       JSONB DEFAULT '[]';

-- ── 8. TESTIMONIALS TABLE (optional) ─────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  initials   TEXT,
  rating     INTEGER DEFAULT 5,
  review     TEXT,
  status     TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read testimonials" ON testimonials FOR SELECT USING (status = 'active');
CREATE POLICY IF NOT EXISTS "Admin manage testimonials" ON testimonials FOR ALL USING (true);

INSERT INTO testimonials (name, initials, rating, review, status) VALUES
  ('Anjali C.', 'AC', 5, 'Amazing hampers and fast delivery! Loved it! Perfect for my sister''s birthday.', 'active'),
  ('Rajesh S.', 'RS', 5, 'Great quality and beautiful packaging. Will order again!', 'active'),
  ('Priya M.', 'PM', 5, 'My friend was so happy with the custom hamper. Totally recommend Giftess!', 'active')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
--  DONE! Now go to Supabase Dashboard:
--  1. Storage → Create bucket "product-photos" → set Public: ON
--  2. Storage → product-photos → Policies → Add these 4 policies:
--     - SELECT: true (anyone can view)
--     - INSERT: true (anyone can upload)
--     - UPDATE: true
--     - DELETE: true
-- ═══════════════════════════════════════════════════════
