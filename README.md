# Daily

A small, private daily log for one person — meals, workouts, tasks, and how the
day actually went — with a **read-only** dashboard for a partner that shows
**only what the person logging chooses to share**.

It is a website, not an app. She opens a link on her phone and she's in. There
is nothing to download and no install step, ever.

👉 **To get this running, follow [SETUP.md](SETUP.md).**

---

## The design decision that matters

The person logging is the owner of her data. The partner is a guest.

That is enforced in **Postgres Row Level Security**, not in the app. The app is
a static website and ships a public key, so the browser cannot be trusted with
any of this. Every partner-facing read passes through one function,
`can_view(owner, category)` in [supabase/schema.sql](supabase/schema.sql), and
three separate gates must all pass:

1. an accepted link between the two accounts exists
2. sharing is not paused
3. that specific category is switched on

…and then the individual row must not be flagged private.

Practical consequences:

- **A new account shares nothing.** Every switch defaults to off in the schema,
  so there is no window where data leaks before she's chosen.
- **The private journal has no sharing path at all.** One policy, no partner
  branch, no toggle in the UI. Not "off by default" — absent.
- **Pause is instant and total**, and doesn't lose her per-category choices.
- **The partner has no write access to any of her switches.** There is no
  permission for it, so there is no version of "he changed the settings".
- **Turning a category off hides it, but tells the partner it's off** — via a
  function that returns switch positions only, never a row. This exists to stop
  him concluding "she logged no meals today" when the truth is "meals are off".

The policies were audited against the real Postgres grammar; see
[Verification](#verification).

## Design stance

This kind of app can slide from supportive into surveillance. A few choices push
against that on purpose, and are worth leaving alone:

- She holds every control; none of them are reachable from his side.
- The most sensitive category (age/height/weight) starts **off**, so it's opted
  into rather than out of.
- Any single entry can be marked *Just for me* as she writes it.
- The partner's screen is framed as read-only and encouraging, with prompts that
  push toward specific praise and asking-before-advising.
- There is no score, no grade, no red/green "compliance" judgement anywhere.

## Features

**For her**
- Fast logging: a meal is ~4 taps, using her own most-frequent items as one-tap chips
- Meals (type, calories, protein), workouts (what, minutes, intensity), tasks
- A daily check-in: mood, energy, sleep, water, and a free-text note
- Weight as a time series with a smoothed 7-day trend line and a goal marker
- Self-set goals with weekly/daily progress
- Streaks, week strip, 7/30-day rollups
- A private journal that is hers alone
- Backfill: tap any recent date to fill in a missed day

**For him**
- Read-only dashboard: today, rolling 7/30 days, trends, charts
- Explicit "not shared" markers instead of misleading zeros
- Send encouragement notes (she can delete any of them; he can unsend his own)

## Stack

- React 18 + TypeScript, built with Vite — a fully static site, no server to run
- Supabase (Postgres + Auth); all authorization in RLS
- No UI framework, no chart library, no router, no icon package. Three runtime
  dependencies total, so there is very little to rot.
- Hash-based routing, so it works on any static host with no rewrite rules

## Local development

```bash
npm install
npm run dev
```

Needs a `.env` with your own Supabase values (see [SETUP.md](SETUP.md)); copy
`.env.example` to `.env` to start. Without them the app shows a setup screen
rather than a blank page.

```bash
npm run typecheck   # tsc, no emit
npm run build       # -> dist/
```

### Previewing the UI without a backend

`mock/` plus `vite.config.mock.ts` swap the data layer for fixtures so every
screen can be worked on without a live Supabase project:

```bash
npx vite --config vite.config.mock.ts        # owner view
# then open http://localhost:5199/?role=partner for the partner view
```

This is dev-only. `npm run build` never reads it.

### Icons

`public/icons/*` are generated, not hand-drawn:

```bash
node scripts/generate-icons.mjs
```

## Data model

Ten tables. Food, workouts and tasks share one `entries` table on purpose —
one table means one set of security rules to get right instead of three.

| Table | Holds | Partner can read when |
|---|---|---|
| `profiles` | name, role, units | linked (name only; nothing sensitive lives here) |
| `partner_links` | the connection + invite code | it's their own row |
| `share_settings` | the six switches + pause | **never** |
| `body_profile` | birthdate, height, goal weight | `share_body` |
| `weight_logs` | weight over time | `share_body` |
| `entries` | meals, workouts, tasks | matching category, and not private |
| `day_logs` | mood, energy, sleep, water, note | `share_day`, and not private |
| `journal_entries` | private journal | **never** |
| `goals` | her targets | `share_goals` |
| `feedback` | his notes to her | it's addressed to them or from them |

Weights and heights are stored in metric and converted for display, so changing
units never rewrites history. Dates are handled in local time throughout —
`toISOString()` would file a 9pm entry under tomorrow.

## Verification

What was actually checked, and how:

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vite build` | succeeds, 128 KB gzipped |
| SQL parsed against real Postgres grammar (libpg_query via pglast) | 91 statements, parses clean |
| RLS enabled on every table | 10/10 |
| Policies scoped to the `authenticated` role | 36/36 |
| Read paths that are neither own-row nor `can_view`-gated | 0 |
| Write policies pinning the row to the caller | 18/18 |
| Journal reachable by a partner | no policy exists |
| Screens rendered and inspected on a 375×812 viewport | sign-in, onboarding, today, log sheet, progress, settings, partner dashboard |

Not yet exercised against a live Supabase project — that needs the credentials
from [SETUP.md](SETUP.md). The first real sign-up is the remaining test.
