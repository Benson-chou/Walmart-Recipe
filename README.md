# Loblaws Recipe

Next.js app that recommends recipes from discounted Loblaws flyer items. Auth and data run on **Supabase**; recipe generation uses a local mock until you add a Gemini key.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Home works in guest mode with seeded flyer data even before Supabase is connected.

## Supabase setup

1. Create a project at [https://supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon public** key into `.env.local`.
3. In the Supabase SQL editor (or CLI), run the migration:

```bash
# With CLI linked to your project:
npx supabase db push

# Or paste supabase/migrations/20260831000000_initial_schema.sql into the SQL Editor and run it.
```

4. Auth → Providers: keep Email enabled. For local testing you can disable “Confirm email” under Auth → Providers → Email.
5. Restart `npm run dev`, then sign up / log in.

### CLI notes

```bash
npx supabase login
npx supabase link --project-ref hzxsdrucdorazcvgerpm
npx supabase db push
```

Local `supabase start` needs Docker. This machine may not have Docker available; using a hosted Supabase project is the path of least resistance.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production |
| `npm run lint` | ESLint |

## App routes

- `/home` — flyer selection + recipe generation
- `/login`, `/signup` — Supabase Auth
- `/profile` — postal code, allergies, saved recipes

## Optional Gemini

Set `GEMINI_API_KEY` in `.env.local` to use Google Gemini instead of the mock generator in `lib/recipes.ts`.

## Legacy code

The previous Express + EJS app lives under `legacy/` for reference (`scrape_items.py`, `optimization.py`, old routes).
