\set ON_ERROR_STOP on
do $$ begin
 if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$' or current_setting('snake.phase2a_isolated',true) is distinct from 'on' then raise exception 'Isolated database required';end if;
end; $$;
select phase2a_test.admission_race(:'worker');
