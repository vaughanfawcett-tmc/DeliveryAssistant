-- Migration: 0001_init_foundation
-- Phase 1 schema: portal_lookups (API-07 instrumentation), calls, drivers
-- All tables use service-role-only access; RLS enabled as defence-in-depth.

-- portal_lookups: API-07 — every tracking lookup outcome
create table portal_lookups (
  id             uuid primary key default gen_random_uuid(),
  tracking_ref   text not null,
  postcode       text not null,                 -- normalised (upper, no spaces)
  success        boolean not null,              -- false = mismatch, not found, or api error
  failure_reason text,                          -- 'postcode_mismatch' | 'not_found' | 'api_error' | null
  looked_up_at   timestamptz not null default now()
);
create index portal_lookups_looked_up_at_idx on portal_lookups (looked_up_at desc);
create index portal_lookups_failure_reason_idx on portal_lookups (failure_reason);

-- calls: populated by the voice call pipeline (Phase 4); defined now
create table calls (
  id                   uuid primary key default gen_random_uuid(),
  platform_call_id     text unique not null,
  from_number          text,
  direction            text not null,            -- 'inbound' | 'outbound'
  call_type            text not null,            -- 'customer' | 'driver'
  start_at             timestamptz not null,
  end_at               timestamptz,
  duration_ms          integer,
  outcome              text,                     -- 'resolved' | 'escalated' | 'no_data' | 'failed'
  tracking_ref         text,
  transcript           text,
  disconnection_reason text,
  parent_call_id       uuid references calls(id),
  created_at           timestamptz not null default now()
);
create index calls_start_at_idx on calls (start_at desc);
create index calls_tracking_ref_idx on calls (tracking_ref);

-- drivers: managed list for outbound calls (Phase 3/4); phone numbers are personal data, server-side only
create table drivers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone_e164  text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: enable on all tables; no anon policies (service-role-only access from the backend).
alter table portal_lookups enable row level security;
alter table calls enable row level security;
alter table drivers enable row level security;
