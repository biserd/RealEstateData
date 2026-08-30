import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

assertDatabaseWriteAllowed(true);
console.log(JSON.stringify({ databaseWriteApprovedFor: databaseIdentity() }));
