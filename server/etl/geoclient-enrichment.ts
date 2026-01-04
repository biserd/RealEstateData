import { db } from "../db";
import { properties, entityResolutionMap } from "@shared/schema";
import { eq, isNull, or, and, sql, lt } from "drizzle-orm";
import { 
  normalizeAddress, 
  batchNormalizeAddresses, 
  isGeoclientAvailable,
  GeoclientAddressResult 
} from "../services/geoclient";

const BOROUGH_CODE_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx", 
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

function extractBoroughFromBBL(bbl: string): string | null {
  if (!bbl || bbl.length < 1) return null;
  const code = bbl.charAt(0);
  return BOROUGH_CODE_MAP[code] || null;
}

interface PropertyToEnrich {
  id: string;
  address: string;
  bbl: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function findPropertiesToEnrich(limit: number = 1000): Promise<PropertyToEnrich[]> {
  console.log("\n🔍 Finding properties that need Geoclient enrichment...");
  
  const propsNeedingCoords = await db
    .select({
      id: properties.id,
      address: properties.address,
      bbl: properties.bbl,
      zipCode: properties.zipCode,
      latitude: properties.latitude,
      longitude: properties.longitude,
    })
    .from(properties)
    .where(
      and(
        or(
          isNull(properties.latitude),
          isNull(properties.longitude)
        ),
        sql`${properties.address} IS NOT NULL AND ${properties.address} != ''`,
        or(
          sql`${properties.bbl} IS NOT NULL`,
          sql`${properties.zipCode} IS NOT NULL`
        )
      )
    )
    .limit(limit);

  console.log(`  Found ${propsNeedingCoords.length} properties needing coordinate enrichment`);
  return propsNeedingCoords;
}

export async function enrichWithGeolient(
  props: PropertyToEnrich[],
  options: { maxPerSecond?: number; dryRun?: boolean } = {}
): Promise<{ enriched: number; failed: number; skipped: number }> {
  const { maxPerSecond = 40, dryRun = false } = options;
  
  if (!isGeoclientAvailable()) {
    console.log("❌ Geoclient API not available - set NYC_GEOCLIENT_API_KEY");
    return { enriched: 0, failed: 0, skipped: props.length };
  }

  console.log(`\n🗺️  Enriching ${props.length} properties via Geoclient API...`);
  if (dryRun) console.log("  (DRY RUN - no database updates)");

  const addressRequests: Array<{ address: string; boroughOrZip: string; propId: string }> = [];

  for (const prop of props) {
    if (!prop.address) continue;
    
    let boroughOrZip: string | null = null;
    
    if (prop.bbl) {
      boroughOrZip = extractBoroughFromBBL(prop.bbl);
    }
    if (!boroughOrZip && prop.zipCode) {
      boroughOrZip = prop.zipCode;
    }
    
    if (!boroughOrZip) continue;
    
    addressRequests.push({
      address: prop.address,
      boroughOrZip,
      propId: prop.id,
    });
  }

  console.log(`  Prepared ${addressRequests.length} valid address requests`);

  let enriched = 0;
  let failed = 0;
  let skipped = props.length - addressRequests.length;

  const batchSize = 100;
  let lastLogTime = Date.now();

  for (let i = 0; i < addressRequests.length; i += batchSize) {
    const batch = addressRequests.slice(i, i + batchSize);
    
    const results = await batchNormalizeAddresses(
      batch.map(b => ({ address: b.address, boroughOrZip: b.boroughOrZip })),
      { 
        maxPerSecond,
        maxConcurrent: 10,
      }
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const request = batch[j];

      if (result.success && (result.latitude || result.bbl)) {
        if (!dryRun) {
          const updates: Record<string, any> = {};
          
          if (result.latitude && result.longitude) {
            updates.latitude = result.latitude;
            updates.longitude = result.longitude;
          }
          if (result.bbl) {
            updates.bbl = result.bbl;
          }
          if (result.zipCode) {
            updates.zipCode = result.zipCode;
          }

          try {
            await db
              .update(properties)
              .set(updates)
              .where(eq(properties.id, request.propId));

            await db.insert(entityResolutionMap).values({
              sourceSystem: "geoclient",
              sourceRecordId: `${request.address}|${request.boroughOrZip}`,
              sourceBbl: result.bbl || null,
              matchedPropertyId: request.propId,
              matchType: "geoclient_api",
              matchConfidence: result.confidence,
              matchMetadata: {
                normalizedAddress: result.normalizedAddress,
                bin: result.bin,
                borough: result.borough,
              },
            }).onConflictDoNothing();

            enriched++;
          } catch (e: any) {
            failed++;
          }
        } else {
          enriched++;
        }
      } else {
        failed++;
      }
    }

    const now = Date.now();
    if (now - lastLogTime > 5000) {
      const pct = ((i + batch.length) / addressRequests.length * 100).toFixed(1);
      console.log(`  Progress: ${i + batch.length}/${addressRequests.length} (${pct}%) - ${enriched} enriched, ${failed} failed`);
      lastLogTime = now;
    }
  }

  console.log(`\n✅ Geoclient enrichment complete:`);
  console.log(`   Enriched: ${enriched}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);

  return { enriched, failed, skipped };
}

export async function runGeoclientEnrichment(
  limit: number = 1000,
  dryRun: boolean = false
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🗺️  NYC GEOCLIENT ENRICHMENT PIPELINE");
  console.log("=".repeat(60));

  if (!isGeoclientAvailable()) {
    console.log("\n❌ NYC_GEOCLIENT_API_KEY not configured");
    console.log("   Set this environment variable to enable Geoclient enrichment");
    return;
  }

  const props = await findPropertiesToEnrich(limit);
  
  if (props.length === 0) {
    console.log("\n✅ No properties need Geoclient enrichment");
    return;
  }

  await enrichWithGeolient(props, { dryRun });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "500");
  const dryRun = args.includes("--dry-run");

  runGeoclientEnrichment(limit, dryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Enrichment failed:", err);
      process.exit(1);
    });
}
