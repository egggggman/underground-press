import { jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export type GitHubMediaReplacementFile = {
  assetId: string;
  path: string;
  priorRemoteFingerprint: {
    remoteSha256: string | null;
    remoteBlobSha: string | null;
  };
};

export const pressGitHubMediaReplacementsTable = pgTable("press_github_media_replacements", {
  id: serial("id").primaryKey(),
  accountId: varchar("account_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  owner: varchar("owner", { length: 100 }).notNull(),
  repo: varchar("repo", { length: 100 }).notNull(),
  branch: varchar("branch", { length: 255 }).notNull(),
  issuePath: varchar("issue_path", { length: 400 }).notNull(),
  files: jsonb("files").notNull().$type<GitHubMediaReplacementFile[]>(),
  commitSha: varchar("commit_sha", { length: 64 }).notNull(),
});

export type GitHubMediaReplacementAudit = typeof pressGitHubMediaReplacementsTable.$inferSelect;
export type NewGitHubMediaReplacementAudit = typeof pressGitHubMediaReplacementsTable.$inferInsert;
