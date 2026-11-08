\set ON_ERROR_STOP on
do $$ begin
 if current_database() <> 'postgres' or session_user <> 'postgres'
   or current_setting('snake.viper_isolated',true) is distinct from 'on'
   or (select system_identifier::text from pg_control_system()) <> '7702071863184491885'
   or (select ssl from pg_stat_ssl where pid=pg_backend_pid()) is distinct from true
 then raise exception 'Only approved snake-test mvwpbscexvnfavxhbexb is allowed'; end if;
end $$;
