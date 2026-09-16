# Walmart Recipe

An intelligent grocery-deal meal planner built with **Next.js (App Router)**, **Supabase (pgvector)**, and **Google Gemini Agentic RAG**. It fetches real-time weekly ad promotions from **Walmart US** (via Flipp), filters by local ZIP code and dietary allergies, and serves a blended menu of verified catalog recipes and newly invented AI recipes.

---

## Architecture & Features

### 1. Real-Time Walmart Flyer Integration
- **ZIP-Based Ad Scraping**: Scrapes active deals directly from Walmart US flyer feeds via Flipp (`lib/flyer-scrape.ts`).
- **Aisle Categorization**: Automatic classification into `Produce`, `Meat & Seafood`, `Dairy & Eggs`, `Pantry & Bakery`, and `Drinks & Beverages`, backed by a persistent Supabase `category` column.
- **Deals & Pricing**: Handles unit pricing and promotional specials (e.g. *Buy 2 Get 2 Free*) with dedicated deal badges and a live shopping list tally.

### 2. Vertical Grocery Shelf UI
- **Uniform Shelf Cards**: 1:1 image framing, two-line clamped headers with hover tooltips, and floating checkboxes.
- **Category Filter Tabs**: Quick aisle navigation and batch select/clear actions.
- **Live Counter & Estimated Total**: Instant feedback on item count, total estimated price, and special deal count.

### 3. Allergen Safeguards & Quantity Enforcement
- **Multi-Select Allergens**: Preconfigured common allergens (Peanuts, Tree nuts, Dairy, Eggs, Wheat/Gluten, Soy, Fish, Shellfish, Sesame, Mustard) plus custom additions.
- **Granular Text Matching**: Conflicting flyer items are automatically omitted from generation.
- **Ingredient Portion Enforcement**: Enforces standardized quantities/portions on all recipe lines across retrieved, generated, and mock data.

### 4. Agentic RAG Pipeline
1. **Orchestrator Agent (Tool Calling)**: Uses Gemini function calling to formulate targeted search queries and invoke `search_food_com_recipes`.
2. **Vector Similarity (pgvector)**: Queries Supabase using cosine similarity embeddings (`gemini-embedding-001` @ 768 dimensions) with strict allergy filtering.
3. **Context-Infused Generator**: Takes the Top 2 retrieved catalog recipes as structural ground truth (temperatures, timing, ratios) to invent a 3rd original recipe using leftover flyer items.
4. **Multi-Turn Validator Loop**: Audits the generated recipe for cooking safety, ingredient quantities, and allergen conflicts, regenerating with feedback if necessary (up to 3 retries).
5. **Cooking Vibe Tiers**:
   - 🍳 *Just make it edible* — simple, foolproof, low effort.
   - 🥘 *Keep it simple* — classic family favorites.
   - 🌶️ *Surprise me with something new* — creative twists and bold flavors.
6. **Custom Style Requests**: Optional free-text instructions (e.g., *one-pan*, *high-protein*, *oven bake*, *under 30 mins*).

### 5. Resilient Failover & Circuit Breakers
- **Automatic Model Failover**: Seamlessly fails over from `gemini-3.7-flash` to `gemini-3.5-flash-lite` during transient Google API errors (503 high demand, 429 quota exhaustion, or request timeouts).
- **Fast Circuit Breaker**: If all Gemini models are congested, the app instantly falls back to 3 top verified catalog recipes, preventing long loading freezes.
- **Clear Status Banners**: Distinct UI notifications inform users if a high-demand fallback occurred or if items were omitted due to allergy safeguards.

### 6. Personalized “You may also like”
- User preference vectors weight **saved recipes** much more heavily than ZIP/allergy text.
- Recent bookmarks get a recency boost so new saves move recommendations faster.
- Catalog growth: AI-generated recipes are persisted, and Food.com seeding targets ~2.5k recipes.

---

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router, React Server Components)
- **Database & Auth**: Supabase (PostgreSQL, pgvector, Supabase Auth, Row Level Security)
- **AI & Embeddings**: Google Gemini API (`gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-embedding-001`)
- **Styling**: Tailwind CSS & Vanilla CSS Design Tokens
- **Runtime**: Node.js & TypeScript (`tsx`)

---

## Getting Started

### 1. Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- A Supabase project with `pgvector` enabled
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 2. Environment Variables
Copy `.env.example` to `.env.local` and populate the credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GEMINI_API_KEY=your-gemini-api-key
GEMINI_CHAT_MODEL=gemini-3.7-flash  # optional override
SCRAPE_SECRET=your-secure-scrape-secret
```

### 3. Database Setup & Migrations

Apply the database migrations in your Supabase SQL Editor or via CLI:
- `supabase/migrations/20260831200000_recommender_stack.sql` (pgvector extension, `recipes` table, `items` cache, `match_recipes` RPC function).
- `supabase/migrations/20260901000000_add_category_to_items.sql` (persistent aisle categorization for flyer items).

### 4. Seed Recipe Catalog

Embed sample recipes into your Supabase database:

```bash
# Seed default catalog recipes with Gemini embeddings
npm run db:seed

# Optional: Seed from Food.com Parquet dataset (~2500 recipes; skips names already in DB)
npm run db:seed:foodcom
# or:
npx tsx --env-file=.env.local scripts/seed-recipes.ts --parquet data/recipes.parquet --limit 2500 --skip-existing
```

### 5. Run the Application

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. Guest mode defaults to ZIP `90210`. Sign up or sign in to customize your preferred location and profile allergies.

---

## Deploy on Vercel

### 1. Push the repo and import the project

1. Push this repository to GitHub (or GitLab / Bitbucket).
2. In [Vercel](https://vercel.com) → **Add New…** → **Project** → import the repo.
3. Framework preset: **Next.js**. Leave build command `next build` and output default.
4. Click **Deploy** once (it may fail until env vars are set — that’s fine).

### 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production** (and Preview if you want PR demos):

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same page (anon / public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only. Never expose to the client. |
| `GEMINI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com/) |
| `SCRAPE_SECRET` | Yes | Long random string. Protects `POST /api/admin/scrape`. Do **not** leave as `change-me` in production. |
| `CRON_SECRET` | Recommended | Bearer token for Vercel Cron. If unset, cron falls back to `SCRAPE_SECRET`. |
| `CRON_ZIPS` | Optional | Comma-separated ZIPs to refresh (max 5), e.g. `90210,10001`. Defaults to `90210`. |
| `GEMINI_CHAT_MODEL` | Optional | Override primary chat model |

Generate secrets locally:

```bash
openssl rand -hex 32
```

Redeploy after saving env vars.

### 3. Supabase Auth redirect URLs

In Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: `https://YOUR_PROJECT.vercel.app`
- **Redirect URLs**: add `https://YOUR_PROJECT.vercel.app/**` and `http://localhost:3000/**` for local dev

### 4. Database migrations & seed (production)

Apply migrations against your Supabase project (SQL Editor or CLI), then seed the recipe catalog once from your machine (embeddings need `GEMINI_API_KEY`):

```bash
# From this repo, pointed at production env
npx supabase db push
npm run db:seed
# Optional larger Food.com subset:
npm run db:seed:foodcom
```

### 5. Flyer cache & cron

- Home / `GET /api/items` serve from Supabase when the ZIP cache is fresh (~18h / within `valid_to`) and dense enough; otherwise they scrape Flipp once and write back.
- `vercel.json` schedules **daily** refresh at `14:00 UTC` → `GET /api/cron/refresh-flyers`.
- Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is set.
- Manual refresh:

```bash
curl -X POST https://YOUR_PROJECT.vercel.app/api/admin/scrape \
  -H "content-type: application/json" \
  -H "x-scrape-secret: $SCRAPE_SECRET" \
  -d '{"zip":"90210"}'
```

### 6. Analytics & rate limits

- **Vercel Analytics** is wired in `app/layout.tsx` via `@vercel/analytics`. Enable **Web Analytics** in the Vercel project dashboard (free on Hobby).
- `/api/recipes/generate` is rate-limited (~8 requests / minute / IP or user) to protect Gemini quota.

### 7. Post-deploy smoke test

1. Open `/home` — flyer shelf loads (or sample staples banner if scrape is cold).
2. Generate recipes with a few selected items.
3. Sign up / sign in → save a recipe → check profile “You may also like”.
4. Confirm cron appears under Vercel → **Settings** → **Cron Jobs** (Hobby: limited frequency; Pro if you need more).

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── admin/scrape/route.ts       # Manual flyer scraping webhook
│   │   ├── cron/refresh-flyers/        # Vercel Cron flyer refresh
│   │   ├── items/route.ts              # Cached flyer items by ZIP
│   │   ├── recipes/generate/route.ts   # Agentic RAG recommendation endpoint
│   │   ├── recipes/recommend/route.ts  # Profile recommendation endpoint
│   │   └── profile/route.ts            # User profile preferences
│   ├── home/page.tsx                   # Main flyer & recipe studio
│   ├── layout.tsx                      # Root layout, theme & Analytics
│   └── globals.css                     # Global styles, cards & tokens
├── components/
│   ├── ItemGrid.tsx                    # Shelf-card grid with aisle tabs & live tally
│   ├── GenerateForm.tsx                # Cooking vibe tiers, budget & style input
│   ├── RecipeCard.tsx                  # Recipe display with Fresh AI vs Catalog badges
│   └── HomeClient.tsx                  # Client state coordinator & notice banners
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts             # Gemini tool calling & query formulation
│   │   ├── generator.ts                # Context-infused recipe generation & audit
│   │   ├── validator-loop.ts           # Multi-turn validator retry loop
│   │   ├── recommend.ts                # Main recommendation orchestration & circuit breaker
│   │   └── tools/search-food-com.ts    # Gemini tool definition for pgvector search
│   ├── allergens.ts                    # Granular allergy checking & ingredient parsing
│   ├── cooking-tier.ts                 # Vibe tiers (temperatures & prompt strategies)
│   ├── env.ts                          # Env helpers & production secret checks
│   ├── flyer-scrape.ts                 # Flipp scraping, cache, & Walmart enrichment
│   ├── gemini.ts                       # Gemini model configuration, timeouts & failover
│   ├── grocery-categories.ts           # Grocery aisle classification rules
│   ├── ingredients.ts                  # Quantity validation & formatting rules
│   └── rate-limit.ts                   # In-memory generate rate limiter
├── vercel.json                         # Daily flyer cron schedule
└── scripts/
    ├── seed-recipes.ts                 # Recipe ingestion & embedding script
    └── backfill-categories.ts          # Backfill aisle categories in Supabase
```

---

## License

MIT
