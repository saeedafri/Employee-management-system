-- Runs once on first container start (Postgres docker-entrypoint-initdb.d).
-- Creates the dedicated test database alongside ems_dev.
-- Name MUST contain `ems_test` so .claude/hooks/ems-safety-guard.cjs permits the
-- test suite to run against it.
CREATE DATABASE ems_test;
