-- Mirrors the migration applied to the live Supabase project (bimclqqnlqeqiiafvoxs).
-- Source of truth is the live project; this file is for local reference / fresh setup.

create table calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  transcript text not null,
  call_type text not null default 'new_enquiry' check (call_type in ('new_enquiry', 'existing_client_escalation')),
  location text,
  carpet_area_sqft integer,
  project_scope text,
  timeline text,
  is_decision_maker boolean,
  referral_source text,
  verdict text check (verdict in ('approved', 'hard_declined', 'flagged', 'routed_existing_client')),
  verdict_reason text not null,
  handoff_sent boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,6),
  response_seconds numeric(10,2)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_id uuid not null references calls(id) on delete cascade,
  final_decision text not null check (final_decision in ('approved', 'declined')),
  overrode_ai boolean not null,
  reviewer_note text,
  resolved_at timestamptz not null default now()
);

create index calls_verdict_idx on calls(verdict);
create index reviews_call_id_idx on reviews(call_id);
