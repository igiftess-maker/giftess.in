-- ═══════════════════════════════════════════════════════
--  GIFTESS – Supabase Database Migration
--  Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add new columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS tracking_link TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create unique index on order_id
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_idx ON orders(order_id);

-- 2. Create categories table
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

-- Insert default categories if table is empty
INSERT INTO categories (name, slug, emoji, display_order, status)
SELECT * FROM (VALUES
  ('Birthday Hampers', 'Birthday',    '🎂', 1, 'active'),
  ('Anniversary Gifts', 'Anniversary', '💑', 2, 'active'),
  ('Valentine Specials', 'Valentine',  '💝', 3, 'active'),
  ('Gifts for Her', 'Her',             '👛', 4, 'active'),
  ('Gifts for Him', 'Him',             '🎩', 5, 'active'),
  ('Custom Hamper', 'custom',          '✨', 6, 'active')
) AS v(name, slug, emoji, display_order, status)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- 3. Add featured column to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- 4. Enable Row Level Security policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY IF NOT EXISTS "Public read categories"
  ON categories FOR SELECT USING (true);

-- Admin write access (adjust as needed)
CREATE POLICY IF NOT EXISTS "Admin insert categories"
  ON categories FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Admin update categories"
  ON categories FOR UPDATE USING (true);

CREATE POLICY IF NOT EXISTS "Admin delete categories"
  ON categories FOR DELETE USING (true);

-- 5. Allow public read on orders (customers see their own via user_id filter in JS)
-- Note: adjust RLS on orders table to allow user_id-based reads
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users read own orders"
  ON orders FOR SELECT USING (
    auth.uid() = user_id OR user_id IS NULL
  );

CREATE POLICY IF NOT EXISTS "Anyone insert orders"
  ON orders FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
--  DONE - Run this SQL in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════
