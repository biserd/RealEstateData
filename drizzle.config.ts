import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations/d1/generated",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
});
