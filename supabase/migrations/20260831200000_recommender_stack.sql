-- Enable pgvector
create extension if not exists vector;

-- Flyer items: cache by postal + validity
alter table public.items
  add column if not exists postal_code text not null default 'm5b1r7',
  add column if not exists external_id text,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists fetched_at timestamptz not null default now();

create unique index if not exists items_postal_external_uidx
  on public.items (postal_code, external_id)
  where external_id is not null;

create index if not exists items_postal_fetched_idx
  on public.items (postal_code, fetched_at desc);

-- Recipes: recommender metadata + embedding
alter table public.recipes
  add column if not exists source text not null default 'generated',
  add column if not exists tags text[] not null default '{}',
  add column if not exists allergens text[] not null default '{}',
  add column if not exists embedding vector(768);

create index if not exists recipes_embedding_hnsw
  on public.recipes
  using hnsw (embedding vector_cosine_ops);

-- User preference vector
alter table public.profiles
  add column if not exists embedding vector(768);

-- Similarity search RPC
create or replace function public.match_recipes(
  query_embedding vector(768),
  match_count int default 8,
  filter_allergens text[] default '{}'
)
returns table (
  id uuid,
  recipe_name text,
  ingredients text,
  description text,
  source text,
  tags text[],
  allergens text[],
  similarity float
)
language sql
stable
as $$
  select
    r.id,
    r.recipe_name,
    r.ingredients,
    r.description,
    r.source,
    r.tags,
    r.allergens,
    (1 - (r.embedding <=> query_embedding))::float as similarity
  from public.recipes r
  where r.embedding is not null
    and (
      cardinality(filter_allergens) = 0
      or not (r.allergens && filter_allergens)
    )
  order by r.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_recipes(vector, int, text[]) to anon, authenticated, service_role;

-- Allow service role / authenticated to update embeddings
create policy "Authenticated users can update recipes"
  on public.recipes for update
  to authenticated
  using (true)
  with check (true);
