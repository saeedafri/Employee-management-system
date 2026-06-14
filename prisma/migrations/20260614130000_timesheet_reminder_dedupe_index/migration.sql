-- M7 — bulletproof idempotency for timesheet reminder notifications.
-- A partial UNIQUE index keyed by (tenant, user, type, week) means createMany({skipDuplicates})
-- can never create two reminders for the same person and week, even under a double cron fire,
-- a retry, or two job instances racing. Additive + idempotent (index only — no data touched).

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_tsreminder_week_key"
  ON "Notification" ("tenantId", "userId", "type", (("metadataJson" ->> 'weekStart')))
  WHERE "type" IN ('timesheet_submit_reminder', 'timesheet_approval_reminder');
