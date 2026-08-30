import { createApp, log } from "./app";
import { checkAndSyncProductionData } from "./productionDataSync";
import { serveStatic } from "./static";

async function main() {
  const { app, httpServer } = await createApp({ runtime: "node" });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
    void checkAndSyncProductionData().catch((error: unknown) => {
      console.error("[DataSync] Background sync error:", error);
    });
  });
}

void main().catch((error) => {
  console.error("[Startup] Fatal error:", error);
  process.exitCode = 1;
});
