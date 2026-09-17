\set ON_ERROR_STOP on
do $$
begin
  if current_database() !~ '^snake_phase2a_test(_[a-z0-9]+)?$'
    or current_setting('snake.phase2a_isolated', true) is distinct from 'on'
  then raise exception 'Isolated database opt-in required'; end if;
end;
$$;
set statement_timeout = '20s';
-- Also prove compatibility with an explicitly READ ONLY database transaction.
begin read only;
select phase2a_test.read_foundation();
commit;

do $$
declare i integer; result jsonb; observed_state text;
begin
  for i in 1..60 loop
    result := phase2a_test.read_foundation();
    perform phase2a_test.check(result #>> '{totals,productCount}' = '1' and result #>> '{totals,variantCount}' = '1', 'stable populations');
    perform phase2a_test.check(result #>> '{contentCoverage,observedProductCount}' = '1'
      and result #>> '{collections,completeProductCount}' = '1', 'complete observed population');
    if result #>> '{fields,description,presentCount}' = '1'
      and result #>> '{collections,completeWithCollectionsCount}' = '1'
      and result #>> '{collections,completeWithZeroCollectionsCount}' = '0' then
      observed_state := 'old';
    elsif result #>> '{fields,description,missingCount}' = '1'
      and result #>> '{collections,completeWithCollectionsCount}' = '0'
      and result #>> '{collections,completeWithZeroCollectionsCount}' = '1' then
      observed_state := 'new';
    else
      raise exception 'Reader observed mixed canonical page state';
    end if;
    insert into phase2a_test.foundation_reads values (i, observed_state);
    perform pg_sleep(0.1);
  end loop;
end;
$$;
