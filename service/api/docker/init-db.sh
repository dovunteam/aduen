#!/bin/sh
set -eu

: "${ADUEN_API_PASSWORD:?ADUEN_API_PASSWORD is required}"
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=aduen_api_password="$ADUEN_API_PASSWORD" <<'SQL'
CREATE ROLE aduen_api
  LOGIN
  PASSWORD :'aduen_api_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;
SQL
