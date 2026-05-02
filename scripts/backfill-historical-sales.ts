import { db } from "../server/db";
import { sales, condoUnits } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const ACRIS_MASTER = "https://data.cityofnewyork.us/resource/bnx9-e6tj.json";
const ACRIS_LEGALS = "https://data.cityofnewyork.us/resource/8h5j-fqxa.json";
const PAGE_SIZE = 10000;

const BOROUGH_TO_NUM: Record<string, string> = {
  "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
  MN: "1", BX: "2", BK: "3", QN: "4", SI: "5",
};

function createBBL(borough: string, block: string, lot: string): string | null {
  const b = BOROUGH_TO_NUM[borough];
  if (!b || !block || !lot) return null;
  return b + block.toString().padStart(5, "0") + lot.toString().padStart(4, "0");
}

async function fetchPaginated(baseUrl: string, where: string, label: string): Promise<any[]> {
  const out: any[] = [];
  let offset = 0;
  while (true) {
    const url = `${baseUrl}?$limit=${PAGE_SIZE}&$offset=${offset}&$where=${encodeURIComponent(where)}`;
    let data: any[] | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        data = await res.json();
        break;
      }
      const body = (await res.text()).slice(0, 120);
      console.warn(`  [${label}] HTTP ${res.status} at offset ${offset} (attempt ${attempt}/4): ${body}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
    if (!data) {
      console.error(`  [${label}] giving up at offset ${offset}`);
      break;
    }
    out.push(...data);
    console.log(`  [${label}] page ${offset / PAGE_SIZE + 1}: +${data.length} (total ${out.length})`);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

interface IdentityGraph {
  unitBblToBaseBbl: Map<string, string>;
  blockPrefixToBaseBbls: Map<string, Set<string>>;
  baseBblToUnitCount: Map<string, number>;
}

async function loadIdentityGraph(): Promise<IdentityGraph> {
  console.log("Loading condo unit identity graph...");
  const units = await db.select({
    unitBbl: condoUnits.unitBbl,
    baseBbl: condoUnits.baseBbl,
  }).from(condoUnits);

  const unitBblToBaseBbl = new Map<string, string>();
  const blockPrefixToBaseBbls = new Map<string, Set<string>>();
  const baseBblToUnitCount = new Map<string, number>();

  for (const u of units) {
    if (!u.baseBbl) continue;
    unitBblToBaseBbl.set(u.unitBbl, u.baseBbl);
    baseBblToUnitCount.set(u.baseBbl, (baseBblToUnitCount.get(u.baseBbl) || 0) + 1);
    const prefix = u.unitBbl.substring(0, 6);
    if (!blockPrefixToBaseBbls.has(prefix)) blockPrefixToBaseBbls.set(prefix, new Set());
    blockPrefixToBaseBbls.get(prefix)!.add(u.baseBbl);
  }
  console.log(`  Unit BBLs: ${unitBblToBaseBbl.size}, Buildings: ${baseBblToUnitCount.size}, Block prefixes: ${blockPrefixToBaseBbls.size}`);
  return { unitBblToBaseBbl, blockPrefixToBaseBbls, baseBblToUnitCount };
}

function resolveBbls(rawBbl: string | null, graph: IdentityGraph): { unitBbl: string | null; baseBbl: string | null; method: string } {
  if (!rawBbl) return { unitBbl: null, baseBbl: null, method: "unresolved" };

  if (graph.unitBblToBaseBbl.has(rawBbl)) {
    return { unitBbl: rawBbl, baseBbl: graph.unitBblToBaseBbl.get(rawBbl)!, method: "unit_bbl" };
  }
  const prefix = rawBbl.substring(0, 6);
  const candidates = graph.blockPrefixToBaseBbls.get(prefix);
  if (!candidates || candidates.size === 0) {
    return { unitBbl: null, baseBbl: rawBbl, method: "block_lot_fallback" };
  }
  if (candidates.size === 1) {
    return { unitBbl: null, baseBbl: Array.from(candidates)[0], method: "block_lot" };
  }
  // Pick base BBL with most units (largest building most likely)
  let best = "";
  let bestCount = -1;
  for (const b of candidates) {
    const c = graph.baseBblToUnitCount.get(b) || 0;
    if (c > bestCount) { bestCount = c; best = b; }
  }
  return { unitBbl: null, baseBbl: best, method: "block_lot" };
}

async function importYear(year: number, graph: IdentityGraph): Promise<number> {
  console.log(`\n=== Year ${year} ===`);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // Document-id prefixes are not consistent across boroughs on the master
  // dataset, so we fetch master for the whole year and rely on retry-with-
  // backoff for SODA's occasional 500s past offset ~20k. Master is only
  // ~30k rows per year so a few pages suffice.
  const masters = await fetchPaginated(
    ACRIS_MASTER,
    `doc_type='DEED' AND document_date >= '${yearStart}' AND document_date < '${yearEnd}' AND document_amt > 50000 AND document_amt < 50000000`,
    "master"
  );

  // Fetch legals one borough at a time so deep pagination on a single result set
  // never exceeds the SODA page-size cap (which 500s past 10k for this dataset).
  // Use a manual loop instead of push(...part) — the latter blows the call
  // stack when a single borough returns 100k+ records.
  const allBoros = ["1", "2", "3", "4", "5"];
  const boros = (process.env.BOROUGHS || "1,2,3,4,5").split(",").map((s) => s.trim()).filter((b) => allBoros.includes(b));
  const legals: any[] = [];
  for (const boro of boros) {
    const part = await fetchPaginated(
      ACRIS_LEGALS,
      `starts_with(document_id, '${year}') AND borough='${boro}'`,
      `legals/boro${boro}`
    );
    for (let i = 0; i < part.length; i++) legals.push(part[i]);
  }

  const legalsByDoc = new Map<string, any[]>();
  for (const l of legals) {
    if (!l.document_id) continue;
    if (!legalsByDoc.has(l.document_id)) legalsByDoc.set(l.document_id, []);
    legalsByDoc.get(l.document_id)!.push(l);
  }

  const records: any[] = [];
  let unmatched = 0;
  for (const m of masters) {
    const ls = legalsByDoc.get(m.document_id);
    if (!ls || ls.length === 0) { unmatched++; continue; }
    const totalAmount = parseFloat(m.document_amt);
    if (!totalAmount || totalAmount < 50000) continue;
    const date = m.document_date ? new Date(m.document_date) : null;
    if (!date || isNaN(date.getTime())) continue;

    // Distribute amount across linked legals (multi-BBL deeds are rare for residential)
    const perAmount = Math.round(totalAmount / ls.length);
    if (perAmount < 50000 || perAmount > 10_000_000) continue;

    for (const l of ls) {
      const rawBbl = createBBL(l.borough, l.block, l.lot);
      const { unitBbl, baseBbl, method } = resolveBbls(rawBbl, graph);
      records.push({
        salePrice: perAmount,
        saleDate: date,
        armsLength: true,
        deedType: "DEED",
        unitBbl,
        baseBbl,
        matchMethod: `acris_historical_${method}`,
        rawBorough: l.borough || null,
        rawBlock: l.block || null,
        rawLot: l.lot || null,
        rawAddress: [l.street_number, l.street_name].filter(Boolean).join(" ") || null,
        rawAptNumber: l.unit || null,
      });
    }
  }
  console.log(`  Master: ${masters.length}, Legals: ${legals.length}, Unmatched master: ${unmatched}, Sales rows to insert: ${records.length}`);

  let inserted = 0;
  const batch = 1000;
  for (let i = 0; i < records.length; i += batch) {
    const slice = records.slice(i, i + batch);
    try {
      await db.insert(sales).values(slice);
      inserted += slice.length;
      process.stdout.write(`\r  inserted ${inserted}/${records.length}...`);
    } catch (e: any) {
      console.error(`\n  Insert error at ${i}: ${e.message?.slice(0, 200)}`);
    }
  }
  process.stdout.write("\n");
  console.log(`  Year ${year}: ${inserted} sales inserted`);
  return inserted;
}

async function main() {
  const startYear = parseInt(process.env.START_YEAR || "2020");
  const endYear = parseInt(process.env.END_YEAR || "2024");

  console.log(`Backfilling NYC historical sales from ACRIS deeds, ${startYear}–${endYear}`);

  // Idempotency: clear prior historical-acris rows ONLY for the year range
  // being re-imported, so running year-by-year doesn't wipe earlier years.
  // Set SKIP_CLEAR=1 when running a single year's BOROUGHS in multiple
  // invocations so the second invocation doesn't wipe the first one's rows.
  if (process.env.SKIP_CLEAR === "1") {
    console.log(`SKIP_CLEAR=1 set — leaving existing acris_historical rows in place`);
  } else {
    console.log(`Clearing prior acris_historical sales for ${startYear}-${endYear}...`);
    const cleared = await db.delete(sales).where(sql`
      ${sales.matchMethod} LIKE 'acris_historical_%'
      AND EXTRACT(YEAR FROM ${sales.saleDate}) BETWEEN ${startYear} AND ${endYear}
    `).returning({ id: sales.id });
    console.log(`  Cleared ${cleared.length} rows`);
  }

  const graph = await loadIdentityGraph();

  let total = 0;
  for (let y = startYear; y <= endYear; y++) {
    total += await importYear(y, graph);
  }
  console.log(`\n=========================================`);
  console.log(`Done. Inserted ${total} historical sales total.`);

  const yearStats = await db.execute(sql`
    SELECT EXTRACT(YEAR FROM sale_date)::int AS yr, COUNT(*)::int AS n
    FROM sales
    GROUP BY yr ORDER BY yr DESC LIMIT 12
  `);
  console.log("\nSales year distribution after backfill:");
  for (const row of (yearStats as any).rows || yearStats) {
    console.log(`  ${row.yr}: ${row.n}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
