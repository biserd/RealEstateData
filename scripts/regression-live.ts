const baseUrl = (process.env.REGRESSION_BASE_URL || "https://realtorsdashboard.com").replace(/\/$/, "");
const allEntityPages = process.argv.includes("--all-entity-pages");
const sampleArg = process.argv.find((arg) => arg.startsWith("--sample="));
const sampleSize = Math.max(1, Number(sampleArg?.split("=")[1] || 4));

type Result = { url: string; expected: string; actual: number; ok: boolean; detail?: string };
const results: Result[] = [];

async function check(url: string, expected: number | number[], bodyMustNotContain?: RegExp) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: "text/html,application/xml,application/json" }, redirect: "manual" });
      const body = bodyMustNotContain ? await response.text() : "";
      const bodyOk = !bodyMustNotContain || !bodyMustNotContain.test(body);
      if (accepted.includes(response.status) && bodyOk) {
        results.push({ url, expected: accepted.join("/"), actual: response.status, ok: true });
        return;
      }
      if (attempt === 1) {
        results.push({ url, expected: accepted.join("/"), actual: response.status, ok: false, detail: bodyOk ? undefined : "forbidden error text present" });
      }
    } catch (error) {
      if (attempt === 1) results.push({ url, expected: accepted.join("/"), actual: 0, ok: false, detail: error instanceof Error ? error.message : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

async function checkEnvelope(url: string) {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const body = await response.json() as Record<string, unknown>;
    const records = body.records;
    const freshness = body.freshness as Record<string, unknown> | undefined;
    const valid = response.ok
      && Array.isArray(records)
      && typeof body.recordCount === "number"
      && body.recordCount === records.length
      && typeof body.matchMode === "string"
      && Boolean(freshness)
      && typeof freshness?.datasetVersion === "string";
    results.push({ url, expected: "200 data envelope", actual: response.status, ok: valid, detail: valid ? undefined : "invalid or incomplete data envelope" });
  } catch (error) {
    results.push({ url, expected: "200 data envelope", actual: 0, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1].replace(/&amp;/g, "&"));
}

function evenlySample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const picked = new Set<number>();
  for (let i = 0; i < count; i++) picked.add(Math.round((i * (items.length - 1)) / (count - 1 || 1)));
  return Array.from(picked, (index) => items[index]);
}

async function main() {
  const staticPaths = ["/", "/market-intelligence", "/investment-opportunities", "/up-and-coming", "/compare", "/calculator", "/guides", "/pricing", "/login", "/register"];
  await Promise.all(staticPaths.map((path) => check(`${baseUrl}${path}`, 200, /Unit not found|Property no longer available/i)));
  await Promise.all([
    check(`${baseUrl}/api/health`, 200),
    check(`${baseUrl}/api/market/trending-zips?limit=5`, 200),
    check(`${baseUrl}/api/data/status`, 200),
    check(`${baseUrl}/unit/120-east-87-street-unit-e4a-manhattan-015151552`, [200, 301], /Unit not found|Unable to load unit/i),
    check(`${baseUrl}/api/units/resolve/120-east-87-street-unit-e4a-manhattan-015151552`, 200),
    check(`${baseUrl}/unit/definitely-not-a-real-unit`, 404),
    check(`${baseUrl}/properties/definitely-not-a-real-property`, 404),
  ]);
  await Promise.all([
    checkEnvelope(`${baseUrl}/api/market/overview?envelope=1`),
    checkEnvelope(`${baseUrl}/api/market/trending-zips?limit=5&envelope=1`),
    checkEnvelope(`${baseUrl}/api/market/aggregates?geoType=zip&geoId=10977&envelope=1`),
    checkEnvelope(`${baseUrl}/api/market/recent-sales?geoType=zip&geoId=10977&limit=5&envelope=1`),
  ]);

  const indexResponse = await fetch(`${baseUrl}/sitemap.xml`);
  const indexXml = await indexResponse.text();
  results.push({ url: `${baseUrl}/sitemap.xml`, expected: "200", actual: indexResponse.status, ok: indexResponse.ok && /<sitemapindex/.test(indexXml) });

  const sitemapUrls = extractLocs(indexXml);
  const seen = new Set<string>();
  let duplicateUrls = 0;
  let entityUrls: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    const response = await fetch(sitemapUrl);
    const xml = await response.text();
    results.push({ url: sitemapUrl, expected: "200", actual: response.status, ok: response.ok && /<urlset/.test(xml) });
    for (const url of extractLocs(xml)) {
      if (seen.has(url)) duplicateUrls++;
      seen.add(url);
      if (/\/(?:unit|properties)\//.test(url)) entityUrls.push(url);
    }
  }

  entityUrls = Array.from(new Set(entityUrls));
  const targets = allEntityPages ? entityUrls : evenlySample(entityUrls, sampleSize * Math.max(1, sitemapUrls.length));
  for (const url of targets) await check(url, [200, 301], /Unit not found|Property no longer available/i);

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ baseUrl, checked: results.length, sitemapUrls: sitemapUrls.length, discoveredEntityUrls: entityUrls.length, duplicateUrls, sampledEntityUrls: targets.length, failed }, null, 2));
  if (failed.length > 0 || duplicateUrls > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
