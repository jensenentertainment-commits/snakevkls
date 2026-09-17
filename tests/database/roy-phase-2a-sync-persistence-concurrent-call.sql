\set ON_ERROR_STOP on
-- Run twice from separate psql processes with different -v worker values.
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
set statement_timeout = '15s';
select phase2a_test.concurrent_apply(:'worker');
