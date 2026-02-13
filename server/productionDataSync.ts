import { db } from "./db";
import { sql } from "drizzle-orm";
import { spawn } from "child_process";
import path from "path";

export async function checkAndSyncProductionData() {
  try {
    const [result] = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*)::int FROM properties) as total_properties,
        (SELECT COUNT(*)::int FROM properties WHERE state = 'NJ') as nj_count,
        (SELECT COUNT(*)::int FROM properties WHERE state = 'CT') as ct_count,
        (SELECT COUNT(*)::int FROM market_aggregates) as aggregates,
        (SELECT COUNT(*)::int FROM property_signal_summary) as signals
    `);

    const row = result as any;
    const totalProperties = parseInt(row.total_properties) || 0;
    const njCount = parseInt(row.nj_count) || 0;
    const ctCount = parseInt(row.ct_count) || 0;
    const aggregates = parseInt(row.aggregates) || 0;
    const signals = parseInt(row.signals) || 0;

    console.log(`[DataSync] Current database state:`);
    console.log(`[DataSync]   Properties: ${totalProperties.toLocaleString()} (NJ: ${njCount}, CT: ${ctCount})`);
    console.log(`[DataSync]   Market Aggregates: ${aggregates}`);
    console.log(`[DataSync]   Signals: ${signals}`);

    const needsSync = njCount === 0 || ctCount === 0 || aggregates === 0 || signals === 0;

    if (!needsSync) {
      console.log(`[DataSync] Database is up to date. No sync needed.`);
      return;
    }

    console.log(`[DataSync] Database needs updating. Starting background refresh...`);
    
    const scriptPath = path.resolve("scripts/refresh-all-data.ts");
    const child = spawn("npx", ["tsx", scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      detached: false,
    });

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        console.log(`[DataSync] ${line}`);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        if (!line.includes("ExperimentalWarning")) {
          console.error(`[DataSync] ${line}`);
        }
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[DataSync] Data refresh completed successfully.`);
      } else {
        console.error(`[DataSync] Data refresh exited with code ${code}`);
      }
    });

    child.on("error", (err) => {
      console.error(`[DataSync] Failed to start refresh script:`, err);
    });

  } catch (error) {
    console.error("[DataSync] Error checking database state:", error);
  }
}
