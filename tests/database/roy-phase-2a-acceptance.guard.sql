\set ON_ERROR_STOP on
do $$ begin
  if current_database() not in ('snake_phase2a_test_catalogfresh','snake_phase2a_test_catalogupgrade')
    or (select system_identifier::text from pg_control_system()) <> '7705827962930311860'
    or replace(current_setting('data_directory'), chr(92), '/') <> 'C:/Users/jense/AppData/Local/SnakeCatalogValidation/data'
    or host(inet_server_addr()) is distinct from '127.0.0.1'
    or inet_server_port() is distinct from 55433
    or session_user <> 'snake_catalog_test'
    or current_setting('snake.phase2a_isolated',true) is distinct from 'on' then
    raise exception 'Explicit isolated acceptance database required';
  end if;
end; $$;
