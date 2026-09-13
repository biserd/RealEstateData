import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configureDatabase } from "../server/db";

const [script, ...args] = process.argv.slice(2);
if (!script) throw new Error("Usage: tsx scripts/run-d1.ts <script.ts> [arguments]");
process.argv = [process.argv[0], resolve(script), ...args];
const remote = process.env.D1_REMOTE === "1";
const cliEnvironment: Record<string, string | undefined> = process.env;
if (remote && process.env.DATABASE_ENV !== "production") {
  throw new Error("The configured remote D1 database is production. Set DATABASE_ENV=production explicitly.");
}
let dispose: () => Promise<void> | void;
if (process.env.D1_SQLITE_PATH) {
  if (remote) throw new Error("Choose either a local snapshot or remote D1.");
  const { localD1 } = await import("./lib/local-d1");
  const local = localD1(process.env.D1_SQLITE_PATH, true);
  configureDatabase(local.binding);
  dispose = local.close;
  process.env.D1_DATABASE_ID = "local-read-only-snapshot";
  cliEnvironment.DATABASE_ENV ||= "development";
} else {
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: remote ? "wrangler.data.jsonc" : "wrangler.jsonc",
    remoteBindings: remote,
  });
  configureDatabase(proxy.env.DB);
  dispose = proxy.dispose;
  process.env.D1_DATABASE_ID = remote ? "9329644b-3c17-4ddd-82d7-e51f1a544768" : "local-development";
  if (!remote) cliEnvironment.DATABASE_ENV ||= "development";
}
try { await import(pathToFileURL(resolve(script)).href); }
finally { await dispose(); }
