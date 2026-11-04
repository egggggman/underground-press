import { pgTable, integer, jsonb, serial, text, timestamp } from "drizzle-orm/pg-core";

// This database is a working copy. Portable exports are committed to GitHub manually.
export const pressIssuesTable = pgTable("press_issues", {
  id: integer("id").primaryKey(),
  document: jsonb("document").notNull().$type<Record<string, unknown>>(),
});
export const pressVersionsTable = pgTable("press_versions", {
  id: serial("id").primaryKey(),
  revision: integer("revision").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  document: jsonb("document").notNull().$type<Record<string, unknown>>(),
});
