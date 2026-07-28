-- Viper P1 hardening: deterministic event ordering.
-- occurred_at remains the business timestamp; event_sequence is the stable
-- database-assigned ordering key. Sequence gaps are valid after rollbacks.

alter table public.viper_events
  add column event_sequence bigint generated always as identity,
  add constraint viper_events_event_sequence_key unique (event_sequence);

create index idx_viper_events_order_sequence
  on public.viper_events (order_id, event_sequence);

create index idx_viper_events_pick_job_sequence
  on public.viper_events (pick_job_id, event_sequence);

revoke all on sequence public.viper_events_event_sequence_seq
  from public, anon, authenticated;

grant usage, select
  on sequence public.viper_events_event_sequence_seq
  to service_role;
