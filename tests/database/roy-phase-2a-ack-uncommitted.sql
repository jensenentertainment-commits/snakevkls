\ir roy-phase-2a-acceptance.guard.sql
begin;
\ir roy-phase-2a-ack-page.sql
select pg_advisory_xact_lock(991,2);
-- Runner waits for the barrier, then terminates ONLY this named fixture backend.
-- No commit: database recovery must report the unchanged checkpoint/receipts.
select pg_sleep(20);
rollback;
