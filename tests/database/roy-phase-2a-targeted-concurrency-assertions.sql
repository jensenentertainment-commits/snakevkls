\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
select phase2a_test.check((select count(*) = 60 from phase2a_test.targeted_reads), 'all reads completed');
select phase2a_test.check(exists(select 1 from phase2a_test.targeted_reads where observed_state = 'old'), 'overlapped before commit');
select phase2a_test.check(exists(select 1 from phase2a_test.targeted_reads where observed_state = 'new'), 'overlapped after commit');
select phase2a_test.check((select pages_processed = 1 from private.sync_runs), 'one real Commit 5 page committed');
\echo 'No mixed targeted snapshots observed. Discard the disposable database.'
