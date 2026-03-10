\set ON_ERROR_STOP on
\getenv database_name ADUEN_DATABASE_NAME
\getenv migrator_password ADUEN_MIGRATOR_PASSWORD
\getenv api_password ADUEN_API_PASSWORD
\getenv retention_password ADUEN_RETENTION_PASSWORD

SELECT format(
  'CREATE ROLE aduen_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'migrator_password'
) \gexec
SELECT format(
  'CREATE ROLE aduen_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'api_password'
) \gexec
SELECT format(
  'CREATE ROLE aduen_retention LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'retention_password'
) \gexec

GRANT CONNECT ON DATABASE :"database_name" TO aduen_migrator, aduen_api, aduen_retention;
GRANT USAGE, CREATE ON SCHEMA public TO aduen_migrator;
GRANT USAGE ON SCHEMA public TO aduen_api, aduen_retention;
