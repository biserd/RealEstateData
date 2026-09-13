import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const report: Record<string, unknown> = {};
async function check(name: string, run: () => Promise<unknown>) {
  const start=performance.now();
  const result=await run();
  report[name]={durationMs:Math.round(performance.now()-start),result};
  console.log(`${name}: ok (${Math.round(performance.now()-start)} ms)`);
  return result as any;
}
await check('publishedDataset',()=>db.execute(sql`SELECT id,environment,status FROM current_published_dataset`));
await check('platformStats',()=>storage.getPlatformStats());
await check('marketNY',()=>storage.getMarketAggregates('state','NY'));
await check('marketZIP',()=>storage.getMarketAggregates('zip','10001'));
await check('rankings',()=>storage.getUpAndComingZips('NY',10));
const properties=await check('properties',()=>storage.getProperties({state:'NY'},5));
assert.ok(properties.length>0,'Expected published properties in NY');
await check('property',()=>storage.getProperty((process.env.D1_VALIDATION_PROPERTY_ID || properties[0].id)));
await check('propertySales',()=>storage.getSalesForProperty((process.env.D1_VALIDATION_PROPERTY_ID || properties[0].id)));
await check('propertyComps',()=>storage.getComps((process.env.D1_VALIDATION_PROPERTY_ID || properties[0].id)));
await check('propertySignals',()=>storage.getPropertySignals((process.env.D1_VALIDATION_PROPERTY_ID || properties[0].id)));
await check('topOpportunities',()=>storage.getTopOpportunities(5));
await check('stateStats',()=>storage.getStateStats('NY'));
await check('cityStats',()=>storage.getCityStats('NY','Brooklyn'));
await check('stateCityList',()=>storage.getStateCityList());
await check('condoProperties',()=>storage.getCondoUnitsAsProperties(['10001'],5));
await check('recentSales',()=>storage.getRecentSalesForArea('zip','10001',5));
await check('sitemapCount',()=>storage.getPropertyCountForSitemapEligible());
await check('sitemapPage',()=>storage.getPropertiesForSitemapEligible(10,0));
await check('coverage',()=>storage.getCoverageMatrix());
if (process.env.D1_VALIDATION_REPORT) writeFileSync(process.env.D1_VALIDATION_REPORT,JSON.stringify(report,null,2));
console.log('Database read-path validation complete.');
