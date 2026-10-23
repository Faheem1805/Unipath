\set ON_ERROR_STOP on
\getenv owner_password OWNER_DB_PASSWORD
\getenv runtime_password RUNTIME_DB_PASSWORD
\getenv database_name POSTGRES_DB
-- Bootstrap superuser only. Passwords are psql variables, never shell arguments.
SELECT 'CREATE ROLE unipath_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'unipath_migrator') \gexec
SELECT 'CREATE ROLE unipath_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'unipath_runtime') \gexec
SELECT format('ALTER ROLE unipath_migrator PASSWORD %L', :'owner_password') \gexec
SELECT format('ALTER ROLE unipath_runtime PASSWORD %L', :'runtime_password') \gexec
SELECT format('ALTER DATABASE %I OWNER TO unipath_migrator', :'database_name') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database_name') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO unipath_runtime', :'database_name') \gexec
ALTER SCHEMA public OWNER TO unipath_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO unipath_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE unipath_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO unipath_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE unipath_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO unipath_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE unipath_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER ROLE unipath_runtime SET statement_timeout = '5s';
ALTER ROLE unipath_runtime SET lock_timeout = '3s';
ALTER ROLE unipath_runtime SET idle_in_transaction_session_timeout = '8s';
