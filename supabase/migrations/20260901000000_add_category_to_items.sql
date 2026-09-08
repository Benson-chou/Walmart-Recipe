-- Add category column to items table for persistent aisle categorization
alter table public.items
  add column if not exists category text;

-- Index by postal_code and category for fast aisle filtering queries
create index if not exists items_postal_category_idx
  on public.items (postal_code, category);
