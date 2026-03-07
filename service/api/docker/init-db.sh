#!/bin/sh
set -eu

: "${ADUEN_API_PASSWORD:?ADUEN_API_PASSWORD is required}"
: "${ADUEN_RETENTION_PASSWORD:?ADUEN_RETENTION_PASSWORD is required}"
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=aduen_api_password="$ADUEN_API_PASSWORD" --set=aduen_retention_password="$ADUEN_RETENTION_PASSWORD" <<'SQL'
CREATE ROLE aduen_api
  LOGIN
  PASSWORD :'aduen_api_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;
CREATE ROLE aduen_retention
  LOGIN
  PASSWORD :'aduen_retention_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;
SQL
