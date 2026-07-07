# Supabase Setup for TGG Ops

The app needs a Supabase project with the full schema (migrations 001 → 003) and a
storage bucket. As of July 2026 there is **no hosted database provisioned** — the
free-tier org allows only 2 active projects, and both slots are occupied
(`DinnerTable`, `Spend Tracker`). The old VoltTrack database lives in the paused
project **`MVP`** (ref `tksrzfjxwpyitghrdfov`).

## Option A — Restore the paused `MVP` project (hosted)

1. Free a slot: pause `DinnerTable` or `Spend Tracker` in the
   [Supabase dashboard](https://supabase.com/dashboard) (data is retained;
   the paused app just loses DB access until restored), **or** upgrade the org
   to Pro.
2. Restore the `MVP` project (Dashboard → project → Restore).
3. In the SQL editor, check which migrations are already applied
   (`select * from supabase_migrations.schema_migrations;` or just look at the
   tables). The VoltTrack-era project should already have 001–002. Then run,
   in order, whatever is missing from `supabase/migrations/`:
   - `001_initial_schema.sql`
   - `002_erp_schema.sql`
   - `003_tg_gallagher_mechanical.sql` ← required for TGG Ops (trades,
     mechanical report types, `projects`, `prefab_assemblies`)
4. Storage → create a bucket named **`report-photos`** (private).
5. Copy the project URL and keys into `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   ANTHROPIC_API_KEY=<for AI report summaries>
   ```

## Option B — Fresh hosted project

Same as Option A, but create a new project instead of restoring `MVP`
(still requires a free slot) and run **all three** migrations in order.

## Option C — Local development stack (no hosted slot needed)

```bash
npx supabase init      # once, if supabase/config.toml doesn't exist
npx supabase start     # local Postgres + Auth + Storage via Docker
npx supabase db reset  # applies everything in supabase/migrations/ in order
```

Then create the `report-photos` bucket via Studio (http://127.0.0.1:54323)
and point `.env.local` at the local URL/keys that `supabase start` prints.

## Post-setup checks

- New-user signup → onboarding creates an `organizations` row and links the
  profile (`admin` role).
- `/projects` and `/prefab` load (verifies the 003 tables and RLS policies).
- Photo upload on a saved finding succeeds (verifies the `report-photos`
  bucket and the `photos.org_id`/`equipment_id` columns).
