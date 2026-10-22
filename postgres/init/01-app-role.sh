#!/bin/sh
# Runs once, on first initialisation of an empty data directory (docker-entrypoint-initdb.d).
# Creates the non-superuser identity the backend and Flyway use (AD-11/AD-16) and gives it
# the `bag_please` database and its `public` schema. Dev/E2E credentials only: not secrets (NFR-D1).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE ROLE bag_please_app LOGIN PASSWORD 'bag_please_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE bag_please OWNER bag_please_app;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname bag_please <<'SQL'
ALTER SCHEMA public OWNER TO bag_please_app;
SQL
