# Setup — step by step

Everything here is a thing **I could not do for you**, because it needs your own
accounts. Budget about 20 minutes. You only ever do this once.

At the end you will have a normal web link. Open it on a phone and you're in —
nothing to download, no app store, no install.

**Using it alone?** Everything in Part 1 and Part 2 is the same. In Part 3 just
pick **"Just for me"** and stop there — skip 3.1 and 3.2 entirely.

---

## What you need before you start

- An email address for you, and one for her (any email, they don't have to match anything)
- A computer (this one is fine)
- That's it. Everything below is free.

---

# Part 1 — Create the database (about 8 minutes)

This is where the data lives, and it is where all the privacy rules are
enforced. Not in the app — in the database itself.

### 1.1 Make a Supabase account

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in with GitHub or email.

### 1.2 Create a project

1. Click **New project**.
2. **Name:** anything, e.g. `daily`
3. **Database Password:** click *Generate a password* and **save it somewhere**.
   You will almost certainly never need it, but don't lose it.
4. **Region:** pick the one closest to where you both live.
5. Click **Create new project** and wait ~2 minutes while it provisions.

### 1.3 Run the database script

1. In the left sidebar click **SQL Editor**.
2. Click **New query**.
3. Open the file **`supabase/schema.sql`** from this project folder, select
   **all of it** (Ctrl+A), copy, and paste it into the box.
4. Click **Run** (or press Ctrl+Enter).

You should see a results table at the bottom listing 11 tables, every one with
`rls_enabled = true`. If any row says `false`, stop and tell me.

> **schema.sql wipes and rebuilds.** That's intentional for a new project,
> but never run it again once someone has started logging.
>
> **Updating an existing database?** Use **`supabase/update.sql`** instead.
> That one only ever adds things - it never drops a table or deletes a row,
> and it is safe to run as many times as you like.

### 1.4 Turn off email confirmation

This matters. If it's left on, she signs up and then has to go find a
confirmation email before she can get in — which is exactly the kind of
friction that kills this on day one.

1. Left sidebar → **Authentication**.
2. Find **Sign In / Providers** (in some versions it's just **Providers**).
3. Click **Email**.
4. Turn **Confirm email** *off*.
5. **Save**.

> Can't find the toggle? It's not fatal. Leave it — she'll just have to click a
> link in her email once when she signs up. Tell her to expect it.

### 1.5 Copy your two values

1. Left sidebar → **Settings** (gear icon) → **API Keys**.
   (There is also a **Connect** button at the top of the dashboard that shows
   both values together — either place works.)
2. You need exactly two things:

   | What | Looks like |
   |---|---|
   | **Project URL** | `https://abcdefghijk.supabase.co` |
   | **Publishable key** | `sb_publishable_...` (on older projects it's called **anon public** and is a long `eyJ...` string — either is fine) |

3. Keep these two on your clipboard / in a note for the next part.

> ⚠️ **Never** copy the one called **secret key** or **service_role**. That one
> bypasses every privacy rule in this app. The two above are *designed* to be
> public — they can only ever do what the database rules allow.

---

# Part 2 — Put the website online (about 8 minutes)

Pick **one** of these. Path A is fewer steps. Path B is better if you want to
change the app later and have it update itself.

## Path A — fastest, no accounts to wire up

**Step 1. Put your two values into the project.**

In the project folder there is a file called `.env`. Open it in Notepad and
make it look like this, with your own values pasted in:

```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

No quotes, no spaces around the `=`. Save the file.

**Step 2. Build it.**

Open PowerShell in the project folder and run:

```bash
npm run build
```

This creates a `dist` folder. Your two values from step 1 get baked into it —
which is why you had to do step 1 first.

**Step 3. Put it online.**

1. Go to **https://app.netlify.com/drop**
2. Drag the **`dist`** folder from the project onto that page.
3. Wait a few seconds. You get a link like `https://random-name-123.netlify.app`.
4. Click **Claim this site** and make a free account, or the site expires.
5. In **Site configuration → Change site name**, rename it to something you'd
   be happy texting her, e.g. `sam-daily.netlify.app`.

**That link is the app.** Done.

> To change something later: edit, run `npm run build` again, and drag the new
> `dist` folder onto **Deploys** in your Netlify site.

## Path B — auto-updates when you change the code

1. Put this folder on GitHub as a **private** repository.
2. Go to **https://vercel.com**, sign in with GitHub, click **Add New → Project**
   and pick the repo.
3. Vercel detects Vite automatically. Confirm the settings are:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Before you click Deploy**, expand **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your project URL |
   | `VITE_SUPABASE_ANON_KEY` | your publishable key |

   The names must match **exactly**, including `VITE_`.
5. Click **Deploy**.

> If you forget the environment variables, the site loads and says *"Almost
> there"*. Add them, then **Deployments → ... → Redeploy**. They only take
> effect on a fresh build.

---

# Part 3 — Create the account(s)

## If it's just for you (about 1 minute)

1. Open the link.
2. **Create account**, enter your email and a password.
3. Pick **"Just for me"**.
4. Enter your name, then fill in the basics or tap **Skip for now**.
5. Done. There is no code, no sharing screen and nobody to invite.

If you change your mind later, Settings has *Share progress with a partner* —
it creates a code and starts everything switched off.

## If you're sharing with a partner (about 4 minutes)

Do this bit together, sitting next to each other. It's easier than explaining
it over text.

### 3.1 She goes first

1. Send her the link. She taps it — it opens in her phone browser.
2. She taps **Create account**, puts in her email and a password, taps
   **Create my account**.
3. She picks **"Me, and share some with my partner"**.
4. She types her first name.
5. She fills in birthday / height / weight — or taps **Skip for now**.
6. **She chooses what to share with you.** Let her do this part herself and
   don't lean over her shoulder. Everything starts off, the switches are just
   suggestions, and *Body basics* starts off deliberately.
7. She lands on a screen with an **8-character code**. She sends it to you.

### 3.2 Then you

1. Open the **same link** on your phone.
2. Tap **Create account**, use **your own** email and password.
3. Pick **"I'm here to support someone"**.
4. Type your name.
5. Enter her code. Tap **Connect**.

You'll land on her progress dashboard. It will be mostly empty until she starts
logging — that's expected.

### 3.3 Optional: put it on the home screen

Neither of you has to do this, and it isn't an install or a download — it just
makes the link into an icon.

- **iPhone (Safari):** Share button → *Add to Home Screen*
- **Android (Chrome):** ⋮ menu → *Add to Home screen*

Worth doing for her specifically, because it removes the "where was that link
again" problem.

---

# If something goes wrong

**"Could not find the 'solo' column of 'profiles' in the schema cache"**
(or any other "could not find ... column" message)

Your database is older than the app. Open the Supabase **SQL Editor**, paste in
**`supabase/update.sql`**, and run it. It adds what's missing without touching
your data, and the last line of it tells Supabase to refresh the cache that
produced the error. Then reload the page.

This is also what the in-app message now tells you, instead of showing the raw
database error.

**"Almost there" screen**
The two environment variables aren't reaching the site. Path A: check `.env`,
rebuild, re-drag. Path B: check the names are exactly `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, then redeploy.

**"That code did not work."**
- Codes are single use. If she gave it to you and it got claimed, she can
  disconnect you in Settings, which generates a fresh one.
- The code never contains the letters O, I or L, or the digits 0 or 1 — if you
  see one of those, it's a misread of `Q`, `J`, `9` or similar.
- You can't redeem your own code.

**She signed up but picked the wrong role**
On her Settings screen, under the invite code, there's a link:
*"Wait — I was given a code instead."* That switches an account over. Same fix
works if you accidentally signed up as the tracker.

**Picked "Just for me" but actually want to share (or the reverse)**
Settings → *Share progress with a partner*, or *Stop sharing — make this just
for me*. Neither one deletes anything you've logged. Going private disconnects
a connected partner immediately and issues a fresh code.

**You can see nothing / everything says "not shared"**
That's not a bug — that's her switches. Only she can change them. Ask her,
don't try to fix it from your side.

**"That email or password is not right"**
If she's forgotten her password: Supabase dashboard → **Authentication** →
**Users** → find her → **Send password recovery**. Or delete the user row and
have her sign up again (she'd lose her logged data).

**Nothing loads at all**
Check the Supabase project isn't paused. Free projects pause after a week of no
activity — open the dashboard and click **Restore**. Once you're both using it
daily this stops happening.

---

# A few things worth knowing

- **Free tier is genuinely enough.** Two people logging a handful of rows a day
  will not come close to any limit.
- **Vite bakes the environment variables in at build time**, not at page load.
  That's why changing them always means rebuilding or redeploying.
- **The key in the website is public and that's fine.** Anyone can read it out
  of the page source. It grants nothing on its own — every single request is
  checked against the rules in `supabase/schema.sql`, which is why those rules
  are where all the actual security lives.
- **You cannot turn her sharing back on from your side.** There is no code path
  for it and no database permission for it. That's deliberate.
