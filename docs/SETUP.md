# Setup

Three things connect the app: the database tables, the sign-in settings, and
two values Vercel needs. Each step is done once.

## 1. Create the database tables (Supabase)

1. Open your project at supabase.com and choose **SQL Editor** in the left menu.
2. Open `supabase/migrations/0001_init.sql` from this repository on GitHub,
   press **Copy raw file**, and paste it into the editor.
3. Press **Run**. It should finish with "Success. No rows returned".

Check: **Table Editor** now lists tables such as `languages`, `units` and
`profiles`. `languages` has three rows; `units` has eight.

Run it once only. Running it a second time fails with "already exists", which
is harmless but changes nothing.

## 1b. Lesson functions and Unit 1 content (Supabase)

Two more files, in this order, each pasted into a **new query** in the SQL
Editor and run:

1. `supabase/migrations/0002_lessons.sql`: the functions the app uses to read
   lessons and save progress. Safe to run again.
2. `supabase/content.sql`: the lesson content (Unit 1 so far). Safe to run
   again; your progress is kept.

Check: **Table Editor → sentences** has 19 rows.

Whenever lesson content changes, the changelog will say so: run
`supabase/content.sql` again.

## 2. Sign-in settings (Supabase)

Open **Authentication → Sign In / Providers → Email**.

- **Email** must be enabled (it is by default).
- **Confirm email**: for a private pilot, switch this **off**. You can then
  create an account and be signed in straight away. Left on, Supabase emails a
  confirmation link first, and its built-in email service allows only a few
  emails an hour.

If you keep confirmation on, also set **Authentication → URL Configuration →
Site URL** to your Vercel address, and in **Emails → Confirm signup** change
the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Switch confirmation back on before opening the app to other people.

## 2b. Password reset emails (Supabase)

"Forgot password?" on the sign-in page emails a link. Three settings make
that link work.

**Where the link may send people.** Open **Authentication → URL
Configuration**:

- **Site URL**: your app's address, e.g. `https://your-app.vercel.app`
  (the one you open on your phone). The default is `http://localhost:3000`,
  which would make email links go nowhere.
- **Redirect URLs → Add URL**: `https://your-app.vercel.app/**`

**The email itself (recommended).** Open **Authentication → Emails →
Reset Password** (older dashboards: **Email Templates**) and replace the link
in the message with:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

For example, the whole message can be:

```html
<h2>Reset your Polyglot password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Set a new password</a></p>
```

Without this change the link still works, but only when opened in the same
browser that asked for it. With it, you can open the email on any device.

**Who can receive it.** Supabase's built-in email service only delivers to
email addresses that are members of your Supabase organisation, and only a few
emails an hour. Use the same email for your Polyglot account as for your
Supabase login, or set up your own email service under **Authentication →
Emails → SMTP Settings** before inviting anyone else.

Only the newest reset link works: asking twice cancels the first link.

## 3. The two Supabase settings (Vercel)

Open your project on vercel.com → **Settings → Environment Variables**.

The app needs:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key |

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted in place of the second one.

If you linked Supabase to Vercel through Vercel's Supabase integration, these
are probably there already. Check that the names match exactly.

**Never** put the `service_role` or `secret` key in a variable whose name
starts with `NEXT_PUBLIC_`. Those names are sent to every visitor's browser.

After adding or changing a variable, redeploy: **Deployments → ⋯ → Redeploy**.

### Lesson audio (optional, recommended)

| Name | Value |
| --- | --- |
| `SARVAM_API_KEY` | Sarvam dashboard (dashboard.sarvam.ai) → API keys |
| `SARVAM_TTS_SPEAKER` | Optional. A Sarvam voice name, e.g. `kavya` or `rahul`. Default `shubh`. |

Each sentence is generated the first time anyone plays it, then cached by the
phone and by Vercel, so it is paid for roughly once (about ₹2–3 per 1,000
characters). Without the key, Play uses the phone's own Kannada voice when it
has one. Changing the voice gives every sentence new audio.

These two are secret: no `NEXT_PUBLIC_` in front of them.

## 4. Try it

1. Open the Vercel address on your phone.
2. **Get started → Create account** with an email and a password of 8+ characters.
3. You should land on **Today**. Open **Learn**: it lists eight Level 1 units,
   read live from your database. Unit 1 opens into two lessons.
4. In Chrome's menu choose **Add to Home screen** to install it.

## If something looks wrong

| What you see | Cause | Fix |
| --- | --- | --- |
| "Setup needed" on the sign-in page | Vercel does not have the two settings, or was not redeployed after adding them | Step 3 |
| "The database is not set up yet" or "needs an update" on Learn | A SQL file has not been run | Steps 1 and 1b |
| Unit 1 says "Coming soon" | `supabase/content.sql` has not been run | Step 1b |
| Play and Slow are greyed out | No `SARVAM_API_KEY`, and the phone has no Kannada voice | Add the key (step 3), or install Kannada voice data on the phone |
| Play says "The audio could not load" | Sarvam refused the request (wrong key, no credit) or the connection dropped | Vercel → Logs, search for `[audio]` |
| Learn shows no units | The SQL ran only partly | Tell Claude; the tables need checking |
| "Check your email for a confirmation link" | Confirm email is on | Step 2 |
| "Email or password is incorrect" on a new account | The account was created but not confirmed | Step 2 |
| Reset email link opens localhost or an error page | Site URL or Redirect URLs not set | Step 2b |
| "That reset link has expired" straight away | Link opened in a different browser without the recommended template, or an older link after asking twice | Step 2b, then ask for a new link |
| "Email address not authorized" when asking for a reset | Built-in email only sends to your Supabase organisation's members | Step 2b |
