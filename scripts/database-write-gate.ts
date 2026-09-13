import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

if (process.env.D1_REMOTE !== "1") throw new Error("Remote migrations require D1_REMOTE=1 and the production write gate.");
assertDatabaseWriteAllowed(true);
console.log(JSON.stringify({ databaseWriteApprovedFor: databaseIdentity() }));
