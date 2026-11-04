import { boolean, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const myrtleEditorAssignmentsTable = pgTable("myrtle_editor_assignments", {
  accountId: varchar("account_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull(),
  changedBy: varchar("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const myrtleEditorRoleChangesTable = pgTable("myrtle_editor_role_changes", {
  id: serial("id").primaryKey(),
  targetAccountId: varchar("target_account_id").notNull(),
  enabled: boolean("enabled").notNull(),
  changedBy: varchar("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
