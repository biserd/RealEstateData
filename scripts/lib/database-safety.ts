const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

export type DatabaseEnvironment = "development" | "staging" | "production";

export function getDatabaseEnvironment(): DatabaseEnvironment | null {
  const value = String(process.env.DATABASE_ENV || "").trim().toLowerCase();
  return value === "development" || value === "staging" || value === "production"
    ? value
    : null;
}

export function databaseIdentity(): { environment: DatabaseEnvironment | null; host: string; database: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { environment: getDatabaseEnvironment(), host: "not-configured", database: "not-configured" };
  try {
    const url = new URL(raw);
    return {
      environment: getDatabaseEnvironment(),
      host: url.hostname,
      database: url.pathname.replace(/^\//, "") || "unknown",
    };
  } catch {
    return { environment: getDatabaseEnvironment(), host: "invalid-url", database: "invalid-url" };
  }
}

export function assertDatabaseWriteAllowed(writeRequested: boolean): void {
  if (!writeRequested) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for a database write.");

  const environment = getDatabaseEnvironment();
  if (!environment) {
    throw new Error("DATABASE_ENV must be explicitly set to development, staging, or production before applying database changes.");
  }

  if (environment !== "production") return;

  if (process.env.CONFIRM_PRODUCTION_WRITE !== "YES") {
    throw new Error("Production write blocked. Set CONFIRM_PRODUCTION_WRITE=YES only for the reviewed command.");
  }

  const backupVerifiedAt = Date.parse(String(process.env.BACKUP_VERIFIED_AT || ""));
  if (!Number.isFinite(backupVerifiedAt)) {
    throw new Error("Production write blocked. BACKUP_VERIFIED_AT must be an ISO timestamp for a verified recoverable backup or Neon branch.");
  }
  const age = Date.now() - backupVerifiedAt;
  if (age < 0 || age > MAX_BACKUP_AGE_MS) {
    throw new Error("Production write blocked. The verified backup timestamp must be no more than 24 hours old.");
  }
}
