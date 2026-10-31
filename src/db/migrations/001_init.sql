-- First slice of docs/DATA_MODEL.md: one workspace, one Instagram account, weekly plans.
-- Platform ids are attributes, never primary keys. Raw payloads and Claude outputs live in jsonb.

create extension if not exists pgcrypto;

create table plan (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  account text not null default 'multiicon.official',
  state jsonb not null default '{}'::jsonb,        -- the planner's UI state (counts, event facts, notes)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account, week_start)
);

create table media_asset (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plan(id) on delete set null,
  kind text not null check (kind in ('upload', 'generated', 'edited', 'render')),
  provider text,                                     -- flux, gemini, openai, ideogram, kling, browser
  prompt text,
  source_asset_id uuid references media_asset(id) on delete set null,
  storage_key text not null unique,
  mime text not null,
  bytes integer not null,
  width integer,
  height integer,
  sha256 text not null,
  meta jsonb not null default '{}'::jsonb,           -- provider payload, Claude's photo score, etc.
  created_at timestamptz not null default now()
);
create index media_asset_plan_idx on media_asset (plan_id);

create table post (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plan(id) on delete cascade,
  kind text not null check (kind in ('event', 'idea')),
  topic text not null,
  scheduled_for timestamptz,
  options jsonb not null default '[]'::jsonb,        -- Claude's options (caption, hashtags, slides...)
  selected_option integer not null default 0,
  render_asset_ids uuid[] not null default '{}',     -- slide images in order, uploaded from the browser
  caption text,
  state text not null default 'draft'
    check (state in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  approved_at timestamptz,
  approved_hash text,                                -- sha256 of caption + render ids at approval time
  platform_post_id text,
  permalink text,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_plan_idx on post (plan_id);
create index post_state_idx on post (state, scheduled_for);

create table llm_call (
  id bigserial primary key,
  task text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  latency_ms integer,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);

create table audit_event (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor text not null,
  action text not null,
  subject_type text,
  subject_id text,
  detail jsonb not null default '{}'::jsonb
);
