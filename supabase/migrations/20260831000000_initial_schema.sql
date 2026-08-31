-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  preferred_location text not null default 'm5b1r7',
  allergies text not null default 'None',
  created_at timestamptz not null default now()
);

-- Weekly flyer items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  price numeric(10, 2) not null,
  image text not null default '',
  sale_story text not null default '',
  created_at timestamptz not null default now()
);

-- Generated / saved recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_name text not null,
  ingredients text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.recipes enable row level security;
alter table public.saved enable row level security;

-- Profiles: users manage their own row
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Flyer items are public read
create policy "Items are publicly readable"
  on public.items for select
  using (true);

-- Recipes readable by everyone (needed for shared names); writes via authenticated
create policy "Recipes are publicly readable"
  on public.recipes for select
  using (true);

create policy "Authenticated users can insert recipes"
  on public.recipes for insert
  to authenticated
  with check (true);

-- Saved bookmarks are private
create policy "Saved readable by owner"
  on public.saved for select
  using (auth.uid() = user_id);

create policy "Saved insertable by owner"
  on public.saved for insert
  with check (auth.uid() = user_id);

create policy "Saved deletable by owner"
  on public.saved for delete
  using (auth.uid() = user_id);

-- Auto-create profile stub is handled in app signup; optional trigger:
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, preferred_location, allergies)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'preferred_location', 'm5b1r7'),
    coalesce(new.raw_user_meta_data->>'allergies', 'None')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed flyer items
insert into public.items (item_name, price, image, sale_story) values
  ('Organic Bananas', 1.99, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&h=200&fit=crop', 'Save $1 when you buy 2 bunches'),
  ('Chicken Breast', 8.99, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=200&h=200&fit=crop', '$2 off / lb this week'),
  ('Roma Tomatoes', 2.49, 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=200&h=200&fit=crop', 'In-store special'),
  ('Whole Wheat Bread', 3.49, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop', 'Buy 1 get 1 50% off'),
  ('Cheddar Cheese Block', 5.99, 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=200&h=200&fit=crop', 'PC product — member price'),
  ('Baby Spinach', 3.99, 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=200&h=200&fit=crop', 'Fresh this week'),
  ('Atlantic Salmon Fillet', 12.99, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=200&h=200&fit=crop', '$3 off when you spend $20+ on seafood'),
  ('Greek Yogurt 500g', 4.49, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=200&fit=crop', 'Multi-buy savings'),
  ('Avocados', 1.50, 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&h=200&fit=crop', 'Each — while supplies last'),
  ('Basmati Rice 2kg', 6.99, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&h=200&fit=crop', 'Pantry staple deal'),
  ('Broccoli Crowns', 2.99, 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=200&h=200&fit=crop', 'Local produce'),
  ('Ground Beef Lean', 7.49, 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=200&h=200&fit=crop', 'Family pack pricing');
