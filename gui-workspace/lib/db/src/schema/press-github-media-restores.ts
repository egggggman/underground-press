import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type GitHubMediaRestoreOutcome = "completed" | "failed";

export const pressGitHubMediaRestoresTable = pgTable("press_github_media_restores", {
  id: serial("id").primaryKey(),
  accountId: varchar("account_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  owner: varchar("owner", { length: 100 }).notNull(),
  repo: varchar("repo", { length: 100 }).notNull(),
  branch: varchar("branch", { length: 255 }).notNull(),
  issuePath: text("issue_path").notNull(),
  assetId: text("asset_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  outcome: varchar("outcome", { length: 16 }).$type<GitHubMediaRestoreOutcome>().notNull(),
  failureReason: text("failure_reason"),
}, table => [
  index("press_github_media_restores_at_idx").on(table.at, table.id),
]);

export const insertGitHubMediaRestoreSchema = createInsertSchema(pressGitHubMediaRestoresTable)
  .omit({ id: true, at: true });
export type InsertGitHubMediaRestore = z.infer<typeof insertGitHubMediaRestoreSchema>;
export type GitHubMediaRestoreAudit = typeof pressGitHubMediaRestoresTable.$inferSelect;
export type NewGitHubMediaRestoreAudit = typeof pressGitHubMediaRestoresTable.$inferInsert;
