-- SHDP community registrations (Volunteer / Express interest)
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- Security model
--   * Row Level Security is ON and the anon / authenticated roles have NO direct table
--     privileges except what is granted below.
--   * The public website never touches the table. It calls submit_registration(),
--     a SECURITY DEFINER function that validates, rate-limits and inserts one row and
--     returns nothing but "ok". Anonymous visitors therefore cannot SELECT, UPDATE or
--     DELETE anything, and cannot even read back what they submitted.
--   * Operators are Supabase Auth users whose user id is listed in public.operators.
--     Only they can SELECT rows and UPDATE the status / notes columns. Nobody can
--     DELETE through the API (archive with status = 'archived' instead).
--   * The service-role key is never used by the website.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.community_registrations (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  type               text not null check (type in ('volunteer', 'interest')),
  name               text not null check (char_length(name) between 2 and 120),
  phone              text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email              text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  location           text check (location is null or char_length(location) <= 160),
  age_group          text check (age_group is null or char_length(age_group) <= 40),
  interest_area      text[] not null default '{}',
  seva_areas         text[] not null default '{}',
  skills             text[] not null default '{}',
  skills_other       text check (skills_other is null or char_length(skills_other) <= 200),
  contribution       text check (contribution is null or char_length(contribution) <= 2000),
  availability       text[] not null default '{}',
  experience         text check (experience is null or char_length(experience) <= 2000),
  contact_preference text[] not null default '{}',
  message            text check (message is null or char_length(message) <= 2000),
  language           text not null default 'en' check (language in ('en', 'te')),
  consent            boolean not null check (consent),
  status             text not null default 'new'
                     check (status in ('new', 'contacted', 'follow_up', 'completed', 'archived')),
  notes              text check (notes is null or char_length(notes) <= 4000),
  ip_hash            text  -- salted SHA-256 of the client IP, only for rate limiting; never the raw IP
);

create index if not exists community_registrations_created_idx on public.community_registrations (created_at desc);
create index if not exists community_registrations_phone_idx   on public.community_registrations (phone, created_at desc);
create index if not exists community_registrations_ip_idx      on public.community_registrations (ip_hash, created_at desc);

create table if not exists public.operators (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- privileges
-- (RLS is enabled, not forced: the table owner, which owns the SECURITY DEFINER functions below,
--  is the only role that bypasses it, and it is never exposed to the website.)
alter table public.community_registrations enable row level security;
alter table public.operators enable row level security;

revoke all on public.community_registrations from anon, authenticated, public;
revoke all on public.operators from anon, authenticated, public;

-- operators (signed-in users who pass is_operator()) may read rows and change status / notes only
grant select on public.community_registrations to authenticated;
grant update (status, notes) on public.community_registrations to authenticated;
grant select on public.operators to authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.operators o where o.user_id = (select auth.uid()));
$$;
-- Supabase grants EXECUTE on new functions to anon/authenticated by default: revoke explicitly
revoke all on function public.is_operator() from public, anon, authenticated;
grant execute on function public.is_operator() to authenticated;

-- jsonb array -> clean text[] (strings only, trimmed, de-duplicated, at most 20 x 80 chars)
create or replace function public.clean_text_array(j jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct v) filter (where v <> ''), '{}')
  from (
    select left(trim(e), 80) as v
    from jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) with ordinality as t(e, n)
    where n <= 20
  ) s;
$$;
revoke all on function public.clean_text_array(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- policies
drop policy if exists "operators read registrations" on public.community_registrations;
create policy "operators read registrations"
  on public.community_registrations for select
  to authenticated
  using ((select public.is_operator()));

drop policy if exists "operators update registrations" on public.community_registrations;
create policy "operators update registrations"
  on public.community_registrations for update
  to authenticated
  using ((select public.is_operator()))
  with check ((select public.is_operator()));

-- no INSERT / DELETE policies: with RLS forced, direct inserts and deletes are refused for every API role

drop policy if exists "operators see own operator row" on public.operators;
create policy "operators see own operator row"
  on public.operators for select
  to authenticated
  using (user_id = (select auth.uid()));

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists community_registrations_touch on public.community_registrations;
create trigger community_registrations_touch
  before update on public.community_registrations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- public submit endpoint
-- Called by the website as POST /rest/v1/rpc/submit_registration with the anon key.
-- Returns 'ok' or raises an error whose message is a short code the form can translate.
create or replace function public.submit_registration(payload jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_type    text := lower(trim(coalesce(payload->>'type', '')));
  v_name    text := nullif(regexp_replace(trim(coalesce(payload->>'name', '')), '\s+', ' ', 'g'), '');
  v_phone   text := regexp_replace(coalesce(payload->>'phone', ''), '[\s().-]', '', 'g');
  v_email   text := nullif(lower(trim(coalesce(payload->>'email', ''))), '');
  v_loc     text := nullif(trim(coalesce(payload->>'location', '')), '');
  v_lang    text := case when payload->>'language' = 'te' then 'te' else 'en' end;
  v_headers json;
  v_ip      text;
  v_ip_hash text;
  v_recent  int;
begin
  -- honeypot: real visitors never fill the hidden "website" field
  if coalesce(payload->>'website', '') <> '' then
    return 'ok';
  end if;

  if v_type not in ('volunteer', 'interest') then raise exception 'invalid_type'; end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid_name'; end if;

  -- phone: 10-digit Indian mobile -> +91, leading 0 + 10 digits -> +91, otherwise needs +country code
  if v_phone ~ '^[6-9][0-9]{9}$' then v_phone := '+91' || v_phone;
  elsif v_phone ~ '^0[6-9][0-9]{9}$' then v_phone := '+91' || substr(v_phone, 2);
  elsif v_phone ~ '^00[1-9][0-9]{7,14}$' then v_phone := '+' || substr(v_phone, 3);
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' or v_phone ~ '^\+?([0-9])\1+$' or substr(v_phone, 2) ~ '^([0-9])\1{7,}$' then
    raise exception 'invalid_phone';
  end if;

  if v_email is not null and (char_length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_email';
  end if;
  if v_type = 'volunteer' and v_loc is null then raise exception 'invalid_location'; end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then raise exception 'consent_required'; end if;

  -- rate limits: per phone, per (hashed) IP, and a global ceiling against floods
  select count(*) into v_recent from public.community_registrations
   where phone = v_phone and created_at > now() - interval '24 hours';
  if v_recent >= 3 then raise exception 'rate_limited'; end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-real-ip', v_headers->>'x-forwarded-for', ''), ',', 1);
  if v_ip <> '' then
    v_ip_hash := encode(extensions.digest('shdp-registrations:' || trim(v_ip), 'sha256'), 'hex');
    select count(*) into v_recent from public.community_registrations
     where ip_hash = v_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 5 then raise exception 'rate_limited'; end if;
  end if;

  select count(*) into v_recent from public.community_registrations
   where created_at > now() - interval '10 minutes';
  if v_recent >= 60 then raise exception 'rate_limited'; end if;

  insert into public.community_registrations (
    type, name, phone, email, location, age_group,
    interest_area, seva_areas, skills, skills_other, contribution,
    availability, experience, contact_preference, message, language, consent, ip_hash
  ) values (
    v_type, v_name, v_phone, v_email, left(v_loc, 160),
    left(nullif(trim(coalesce(payload->>'age_group', '')), ''), 40),
    public.clean_text_array(payload->'interest_area'),
    public.clean_text_array(payload->'seva_areas'),
    public.clean_text_array(payload->'skills'),
    left(nullif(trim(coalesce(payload->>'skills_other', '')), ''), 200),
    left(nullif(trim(coalesce(payload->>'contribution', '')), ''), 2000),
    public.clean_text_array(payload->'availability'),
    left(nullif(trim(coalesce(payload->>'experience', '')), ''), 2000),
    public.clean_text_array(payload->'contact_preference'),
    left(nullif(trim(coalesce(payload->>'message', '')), ''), 2000),
    v_lang, true, v_ip_hash
  );
  return 'ok';
end;
$$;

revoke all on function public.submit_registration(jsonb) from public, anon, authenticated;
grant execute on function public.submit_registration(jsonb) to anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
