import { databaseIdentity, getDatabaseEnvironment } from "./lib/database-safety";

const identity = databaseIdentity();
const environment = getDatabaseEnvironment();

console.log(JSON.stringify({
  databaseEnvironment: environment,
  databaseHost: identity.host,
  databaseName: identity.database,
  databaseConfigured: identity.host !== "not-configured" && identity.host !== "invalid-url",
  productionWriteRequirements: {
    explicitEnvironment: environment === "production",
    confirmationPresent: process.env.CONFIRM_PRODUCTION_WRITE === "YES",
    backupVerifiedAtPresent: Boolean(process.env.BACKUP_VERIFIED_AT),
  },
}, null, 2));

if (!environment) process.exitCode = 2;
