# Serve & Connect registrations: backend setup

The website stays static. Supabase is used **only** for the Volunteer / Express interest form
and the operator dashboard at `/admin/`. No other content lives there.

## 1. Create the project (free tier is enough)
1. Sign in at https://supabase.com and create a project (region: Mumbai, `ap-south-1`).
2. **Authentication → Providers → Email**: keep Email enabled.
   **Authentication → Sign In / Up**: turn **off** "Allow new users to sign up".
   Operators are invited by you; nobody can create an account from the website.
3. **SQL Editor → New query**: paste all of
   `supabase/migrations/20261008000000_community_registrations.sql` and run it.

## 2. Add operators
1. **Authentication → Users → Invite user** (or "Add user" with a strong password) for each coordinator.
2. Copy the user's UID and run in the SQL editor:
   ```sql
   insert into public.operators (user_id, label) values ('<UID>', 'Coordinator name');
   ```
   Remove access with `delete from public.operators where user_id = '<UID>';`

A signed-in account that is not in `public.operators` sees nothing: the dashboard signs it out.

## 3. Connect the website (Netlify)
**Project configuration → Environment variables**, add:

| Variable | Value | Where to find it |
|---|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Project Settings → API |
| `SUPABASE_ANON_KEY` | the **anon / publishable** key | Project Settings → API Keys |

Then **Deploys → Trigger deploy**. `netlify.toml` runs `scripts/netlify-config.sh`, which writes
`js/supabase-config.js` at build time. The script **refuses to deploy** if it is given a
`service_role` / `sb_secret_` key. Never put either of those anywhere in this repository.

Until both variables are set, the form shows "Online registration opens shortly" with an email link,
and `/admin/` says the backend is not configured.

## 4. Verify security (do this once after setup)
Run in a terminal, replacing the two values (anon key only):
```
URL=https://<project-ref>.supabase.co
KEY=<anon key>

# 1. anonymous submit works  -> "ok"
curl -s "$URL/rest/v1/rpc/submit_registration" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"type":"interest","name":"RLS Test","phone":"9876543210","consent":true}}'

# 2. anonymous read is refused     -> 401/permission denied (or [] at most, never rows)
curl -s "$URL/rest/v1/community_registrations?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# 3. anonymous direct insert is refused
curl -s "$URL/rest/v1/community_registrations" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"type":"interest","name":"x","phone":"+919876543210","consent":true}'

# 4. anonymous update / delete are refused
curl -s -X PATCH "$URL/rest/v1/community_registrations?name=eq.RLS%20Test" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"status":"archived"}'
curl -s -X DELETE "$URL/rest/v1/community_registrations?name=eq.RLS%20Test" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Then sign in at `/admin/` as an operator: the "RLS Test" row must appear, its status must be
changeable, and **Export CSV** must download it. Archive the test row afterwards.

## What is stored
`community_registrations`: type, name, phone (normalised to +country format), email, location,
age group, interest areas, seva areas, skills (+ "other"), contribution, availability, experience,
contact preference, message, form language, consent, status, operator notes, timestamps, and a
salted hash of the sender's IP used only for rate limiting (never the IP itself).

Limits enforced in the database: 3 submissions per phone per 24 h, 5 per IP per hour,
60 site-wide per 10 minutes; field lengths and formats are checked again server-side.
Rows cannot be deleted through the API; use status `archived`.
