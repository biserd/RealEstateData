import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sql } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { localD1 } from "../lib/local-d1";
import { configureDatabase, db } from "../../server/db";
import { users, insertPropertySchema } from "../../shared/schema";
import { percentile, roundedInteger } from "../../shared/sqliteAnalytics";
import { DrizzleSessionStore } from "../../server/auth";
import { d1InArray } from "../../server/d1Writes";
import type { SessionData } from "express-session";
import { propertyRecordJson } from "../lib/property-record-json";

test("SQLite percentiles retain PostgreSQL interpolation, filters and null handling", async () => {
  const local=localD1(":memory:",false); configureDatabase(local.binding);
  local.sqlite.exec("CREATE TABLE samples(g INTEGER, x REAL); INSERT INTO samples VALUES (1,NULL),(1,10),(1,20),(1,40),(1,80),(2,NULL)");
  const result=await db.execute(sql`SELECT g, ${percentile(sql`x`,.5)} AS median, ${percentile(sql`x`,.25)} AS p25, ${percentile(sql`x`,.75)} AS p75, ${percentile(sql`x`,.5,sql`x >= 20`)} AS filtered FROM samples GROUP BY g ORDER BY g`);
  assert.deepEqual(result.rows,[{g:1,median:30,p25:17.5,p75:50,filtered:40},{g:2,median:null,p25:null,p75:null,filtered:null}]);
  assert.ok(new SQLiteAsyncDialect().sqlToQuery(sql`SELECT ${percentile(sql`x`, .5)} FROM samples`).sql.length<100_000);
  local.close();
});

test("D1 sessions preserve JSON, expiry, refresh and logout", async () => {
  const local = localD1(":memory:", false); configureDatabase(local.binding);
  local.sqlite.exec('CREATE TABLE sessions(sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire TEXT NOT NULL)');
  const store = new DrizzleSessionStore(60_000);
  const value = { cookie: { expires: new Date(Date.now() + 60_000) }, passport: { user: 'existing-user' } } as unknown as SessionData;
  const get = (id: string) => new Promise<SessionData | null | undefined>((resolve, reject) => store.get(id, (error, data) => error ? reject(error) : resolve(data)));
  await new Promise<void>((resolve, reject) => store.set('fixture', value, error => error ? reject(error) : resolve()));
  assert.equal((await get('fixture') as any).passport.user, 'existing-user');
  const expired = { ...value, cookie: { expires: new Date('2000-01-01') } } as SessionData;
  await new Promise<void>((resolve, reject) => store.touch('fixture', expired, error => error ? reject(error) : resolve()));
  assert.equal(await get('fixture'), null);
  await new Promise<void>((resolve, reject) => store.set('fixture', value, error => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => store.destroy('fixture', error => error ? reject(error) : resolve()));
  assert.equal(await get('fixture'), null);
  local.close();
});

test("D1 large ID filters stay below parameter limits and integer medians retain ties", async () => {
  const local = localD1(":memory:", false); configureDatabase(local.binding);
  local.sqlite.exec('CREATE TABLE samples(id INTEGER); INSERT INTO samples VALUES(1),(500),(999)');
  const result = await db.execute(sql`SELECT id FROM samples WHERE ${d1InArray(sql`id`, Array.from({length: 600}, (_, i) => i))} ORDER BY id`);
  assert.deepEqual(result.rows, [{id: 1}, {id: 500}]);
  const rounded = await db.execute(sql`SELECT ${roundedInteger(sql`2.5`)} AS a, ${roundedInteger(sql`3.5`)} AS b, ${roundedInteger(sql`-2.5`)} AS c`);
  assert.deepEqual(rounded.rows, [{a: 2, b: 4, c: -2}]);
  local.close();
});

test("D1 schema preserves Date values, JSON validation and atomic publication", async () => {
  const local=localD1(":memory:",false); configureDatabase(local.binding);
  for (const name of ['0000_neon_schema.sql','0001_dataset_publication.sql']) local.sqlite.exec(readFileSync(new URL('../../migrations/d1/'+name,import.meta.url),'utf8'));
  const createdAt=new Date('2026-09-13T12:34:56.789Z');
  const [user]=await db.insert(users).values({email:'fixture@example.invalid',createdAt}).returning();
  assert.equal(user.createdAt?.toISOString(),createdAt.toISOString());
  assert.match(user.id,/^[0-9a-f-]{36}$/);
  assert.equal(insertPropertySchema.safeParse({address:'A',city:'B',state:'NY',zipCode:'10001',propertyType:'condo',dataSources:['source']}).success,true);
  local.sqlite.exec(`INSERT INTO properties(id,address,city,state,zip_code,property_type,data_sources) VALUES('property','A','B','NY','10001','condo','["verified"]')`);
  const record = JSON.parse((await db.execute(sql`SELECT ${propertyRecordJson('p')} AS record FROM properties AS p`)).rows[0].record);
  assert.deepEqual(record.data_sources, ['verified']);
  assert.equal(record.geography_id, null);
  local.sqlite.exec("INSERT INTO published_dataset_versions(id,environment,status) VALUES ('old','production','published'),('new','production','validated');");
  await assert.rejects(db.execute(sql`INSERT INTO dataset_publication_requests(candidate_id,environment) VALUES ('new','production')`), /no market snapshots/);
  assert.equal(local.sqlite.prepare("SELECT status FROM published_dataset_versions WHERE id='old'").get()!.status,'published');
  local.sqlite.exec("INSERT INTO canonical_geographies(id,type,state,canonical_name) VALUES ('geo','zip','NY','test'); INSERT INTO market_snapshots_v2(id,dataset_version_id,geography_id,period_start,period_end,transaction_count,source_coverage,confidence) VALUES ('market','new','geo','2025-01-01','2026-01-01',10,'{}','high'); INSERT INTO ranking_snapshots(id,dataset_version_id,geography_id,score_version,rank,eligible,price_trend_score,transaction_velocity_score,liquidity_score,comp_depth_score,confidence_score,total_score) VALUES ('ranking','new','geo','test',1,1,50,50,50,50,50,50);");
  await assert.rejects(db.execute(sql`INSERT INTO dataset_publication_requests(candidate_id,environment) VALUES ('new','staging')`),/environment/);
  await db.execute(sql`INSERT INTO dataset_publication_requests(candidate_id,environment) VALUES ('new','production')`);
  assert.equal(local.sqlite.prepare('SELECT id FROM current_published_dataset').get()!.id,'new');
  assert.equal(local.sqlite.prepare("SELECT status FROM published_dataset_versions WHERE id='old'").get()!.status,'retired');
  local.close();
});

test("legacy unit suffix lookups execute on D1 and preserve borough filtering", async () => {
  const { storage } = await import('../../server/storage');
  const local = localD1(':memory:', false); configureDatabase(local.binding);
  for (const name of ['0000_neon_schema.sql','0001_dataset_publication.sql']) local.sqlite.exec(readFileSync(new URL('../../migrations/d1/'+name,import.meta.url),'utf8'));
  try {
    assert.equal(await storage.getCondoUnitBySuffix('123456'), undefined);
    assert.equal(await storage.getCondoUnitBySuffixAndBorough('123456','Staten Island'), undefined);
    assert.equal(await storage.getCondoUnitBySuffix9('012345678','Manhattan'), undefined);
  } finally { local.close(); }
});
