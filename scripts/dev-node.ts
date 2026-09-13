import { getPlatformProxy } from "wrangler";
import { configureDatabase } from "../server/db";

const proxy = await getPlatformProxy<{ DB: D1Database }>({ remoteBindings: false });
configureDatabase(proxy.env.DB);
const stop = async () => { await proxy.dispose(); process.exit(0); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
await import("../server/index");
