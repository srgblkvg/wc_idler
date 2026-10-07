#!/bin/sh
set -eu
# Run only on first initialization. psql quotes the value as an SQL literal.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$PGAPP_PASSWORD" <<'SQL'
CREATE ROLE azeroth_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE azeroth TO azeroth_app;
GRANT USAGE ON SCHEMA public TO azeroth_app;
ALTER DEFAULT PRIVILEGES FOR ROLE azeroth IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO azeroth_app;
SQL
