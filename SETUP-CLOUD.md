# Turn on "log in from any device" (≈5–10 minutes, one time)

The app works fully on one device with no setup. To see your finances from
any device — phone, laptop, a friend's computer — do this once. No coding.

## 1. Create a free Supabase project

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub or email.
2. Click **New project**. Give it a name (e.g. `pocket-advisor`), pick a strong
   database password (save it somewhere), choose the nearest region, click **Create**.
3. Wait ~1 minute for it to finish provisioning.

## 2. Create the data table

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file `supabase/schema.sql` from this project, copy all of it, paste
   it into the editor, and click **Run**. You should see "Success".

## 3. Grab your two keys

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy **Project URL** and the **anon public** key (the long one labeled `anon` /
   `public` — it's safe to expose; your data is protected by the rules from step 2).

## 4. Give the app the keys

**For local use (your computer):**
1. In the project folder, copy `.env.example` to a new file named `.env`.
2. Paste your values:
   ```
   VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
   ```
3. Restart the dev server (`npm run dev`). You'll now see a sign-in screen.

**For the live site (so other devices can reach it):** add those same two
variables in your host's environment settings (e.g. GitHub Pages via repo
Secrets/Variables, or Render → your service → Environment), then redeploy.

## 5. Create your login and you're done

1. On the sign-in screen, click **Create one**, enter an email + password.
   (Tip: in Supabase → Authentication → Providers → Email, you can turn OFF
   "Confirm email" to skip the confirmation step for a private household app.)
2. Sign in. Your data uploads to your account automatically and syncs from then
   on. Open the site on any other device, sign in with the same email, and
   everything's there.

### How it works / good to know
- Your whole dataset syncs as a private snapshot tied to your login. Each change
  pushes automatically; opening the app pulls the latest.
- It's **one shared household login** — you and your spouse use the same email/password.
- The on-device **App Lock PIN** (Settings → Security) is separate: it's the quick
  lock for your own phone after you're signed in.
- Never commit your `.env` — it's already git-ignored.
