# Shared rankings

The daily challenge and Levels rankings are stored in a free Supabase project. Until it is connected, each phone shows only its own results.

## Connect (about 5 minutes)

1. Create a free account at https://supabase.com and a new project (any name, choose a region near your players).
2. In the project, open **SQL Editor → New query**, paste the contents of [supabase.sql](supabase.sql) and press **Run**.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Put both values in [`js/config.js`](../js/config.js) and publish.

The anon key is designed to be public. Players cannot read or edit the table directly: they can only read the `leaderboard` view (no device IDs) and call `submit_score`, which checks the board name and value ranges.

## Rules enforced by the database

| Board | One row per | Kept value |
|---|---|---|
| `daily-YYYY-MM-DD` (UTC) | phone | the first score of the day; later tries do not change it |
| `levels` | phone | highest level and most stars reached |

Only today's and yesterday's daily boards accept scores.

## Limits

Scores are computed on the phone, so a determined person could send a fake score. For a class or club competition this is usually acceptable; for prizes, validate drawings on a server first.
