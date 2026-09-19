\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
set statement_timeout = '20s';
begin read only;
select phase2a_test.read_target('CF-98001');
commit;
do $$
declare i integer; r jsonb; observed_state text;
begin
  for i in 1..60 loop
    r := phase2a_test.read_target('CF-98001');
    perform phase2a_test.check(r ->> 'status' = 'found' and r ->> 'variantCount' = '1', 'consistent active selected identity');
    perform phase2a_test.check(r #>> '{canonicalCollections,state}' = 'complete', 'complete snapshot');
    if r #>> '{productContent,fields,description,state}' = 'present'
      and r #>> '{canonicalCollections,membershipCount}' = '2'
      and jsonb_array_length(r #> '{canonicalCollections,names}') = 2 then observed_state := 'old';
    elsif r #>> '{productContent,fields,description,state}' = 'missing'
      and r #>> '{canonicalCollections,membershipCount}' = '0'
      and r #> '{canonicalCollections,names}' = '[]' then observed_state := 'new';
    else raise exception 'Mixed targeted canonical snapshot'; end if;
    insert into phase2a_test.targeted_reads values (i, observed_state);
    perform pg_sleep(0.1);
  end loop;
end;
$$;
