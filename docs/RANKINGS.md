# Shared rankings

The daily challenge and Levels rankings are stored in a free Supabase project (`tilt-sketch`, connected in `js/config.js`). If the project is unreachable, each phone shows only its own results.

The connection uses the new publishable key (`sb_publishable_…`), sent only in the `apikey` header as Supabase requires. Every push runs a CI check against the live database: the leaderboard is readable, device IDs are not, direct writes are refused and invalid submissions are rejected.

## Connect (about 5 minutes)

1. Create a free account at https://supabase.com and a new project (any name, choose a region near your players).
2. In the project, open **SQL Editor → New query**, paste the contents of [supabase.sql](supabase.sql) and press **Run**.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Put both values in [`js/config.js`](../js/config.js) and publish.

The anon key is designed to be public. Players cannot write to the table directly: they can only read leaderboard columns (never device IDs) through the `leaderboard` view and call `submit_score`, which checks the board name and value ranges. `submit_score` is intentionally callable without signing in; Supabase's advisor lists it as a warning for that reason.

## Rules enforced by the database

| Board | One row per | Kept value |
|---|---|---|
| `daily-YYYY-MM-DD` (UTC) | phone | the best score of the day; every try can raise it |
| `levels` | phone | highest level and most stars reached |
| `guided` | phone | most figures traced and most stars |

Only today's and yesterday's daily boards accept scores.

## Limits

Scores are computed on the phone, so a determined person could send a fake score. For a class or club competition this is usually acceptable; for prizes, validate drawings on a server first.
