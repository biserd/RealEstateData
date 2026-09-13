import { customType } from "drizzle-orm/sqlite-core";

// Preserve the application's Date API while storing sortable UTC text in D1.
// Six fractional digits also retain PostgreSQL's original microsecond precision.
export const timestamp = customType<{ data: Date; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => value.toISOString().replace(/Z$/, "000Z"),
  fromDriver: (value) => new Date(value),
});
