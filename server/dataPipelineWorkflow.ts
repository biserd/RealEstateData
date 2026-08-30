import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { assertSourceMayPublish, stableObjectKey, type PipelineEnvironment } from "../pipeline/contracts";
import { sourceById } from "../pipeline/sourceCatalog";

export interface DataRefreshWorkflowParams {
  sourceId: string;
  environment: PipelineEnvironment;
  dryRun: boolean;
  requestedBy: string;
}

export interface PipelineQueueMessage {
  kind: "acquire-page";
  runId: string;
  sourceId: string;
  watermark: string;
  endpoint: string;
  offset: number;
  pageSize: number;
}

export interface DataPipelineBindings {
  DATA_PIPELINE_RAW: R2Bucket;
  DATA_PIPELINE_QUEUE: Queue<PipelineQueueMessage>;
}

function asPipelineBindings(value: unknown): Partial<DataPipelineBindings> {
  return value as Partial<DataPipelineBindings>;
}

async function discoverWatermark(sourceId: string): Promise<{ watermark: string; sourceDate: string | null }> {
  const source = sourceById(sourceId);
  assertSourceMayPublish(source);
  if (sourceId === "nyc-rolling-sales") {
    const query = new URLSearchParams({ "$select": "max(sale_date) AS source_date" });
    const response = await fetch(`${source.endpoint}?${query}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Source discovery returned HTTP ${response.status}`);
    const rows = await response.json() as Array<{ source_date?: string }>;
    const sourceDate = rows[0]?.source_date || null;
    if (!sourceDate) throw new Error("Source discovery did not return a sale-date watermark");
    return { watermark: `${source.adapterVersion}:${sourceDate}`, sourceDate };
  }
  if (sourceId === "nyc-condo-units") {
    const query = new URLSearchParams({ "$select": "count(*) AS row_count" });
    const response = await fetch(`${source.endpoint}?${query}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Source discovery returned HTTP ${response.status}`);
    const rows = await response.json() as Array<{ row_count?: string }>;
    const rowCount = rows[0]?.row_count || "unknown";
    const date = new Date().toISOString().slice(0, 10);
    return { watermark: `${source.adapterVersion}:${date}:${rowCount}`, sourceDate: date };
  }
  throw new Error(`${sourceId} has no production adapter`);
}

async function ensureRefreshRun(params: DataRefreshWorkflowParams, watermark: string): Promise<string> {
  const [{ db }, schema] = await Promise.all([import("./db"), import("../shared/schema")]);
  const source = sourceById(params.sourceId);
  await db.insert(schema.sourceCatalog).values({
    id: source.id,
    owner: source.owner,
    name: source.name,
    endpoint: source.endpoint,
    license: "Official source; attribution and terms review recorded in source catalog.",
    redistributionStatus: source.redistributionStatus,
    cadence: source.cadence,
    expectedLagDays: source.expectedLagDays,
    coverage: source.coverage,
    adapterVersion: source.adapterVersion,
    active: source.active,
  }).onConflictDoUpdate({ target: schema.sourceCatalog.id, set: { adapterVersion: source.adapterVersion, updatedAt: new Date() } });
  const result = await db.execute(sql`
    INSERT INTO refresh_runs (environment, source_id, source_watermark, status, counts)
    VALUES (${params.environment}, ${params.sourceId}, ${watermark}, 'discovered', ${JSON.stringify({ requestedBy: params.requestedBy, dryRun: params.dryRun })}::jsonb)
    ON CONFLICT (environment, source_id, source_watermark)
    DO UPDATE SET counts = refresh_runs.counts || EXCLUDED.counts
    RETURNING id
  `);
  return String((result.rows[0] as { id: string }).id);
}

export class DataRefreshWorkflow extends WorkflowEntrypoint<Env, DataRefreshWorkflowParams> {
  async run(event: Readonly<WorkflowEvent<DataRefreshWorkflowParams>>, step: WorkflowStep): Promise<unknown> {
    const params = event.payload;
    const source = sourceById(params.sourceId);
    assertSourceMayPublish(source);
    const discovery = await step.do("discover-source-watermark", { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } }, async () => {
      return discoverWatermark(params.sourceId);
    });
    const runId = await step.do("create-idempotent-run-manifest", async () => ensureRefreshRun(params, discovery.watermark));
    if (params.dryRun) {
      return { runId, dryRun: true, sourceId: params.sourceId, discovery, next: "review and start a non-dry-run acquisition" };
    }
    const bindings = asPipelineBindings(this.env);
    if (!bindings.DATA_PIPELINE_QUEUE) throw new Error("DATA_PIPELINE_QUEUE binding is not configured");
    await step.do("enqueue-first-source-page", async () => {
      await bindings.DATA_PIPELINE_QUEUE!.send({
        kind: "acquire-page",
        runId,
        sourceId: params.sourceId,
        watermark: discovery.watermark,
        endpoint: source.endpoint,
        offset: 0,
        pageSize: 10_000,
      });
      return { enqueued: 1 };
    });
    return { runId, dryRun: false, sourceId: params.sourceId, discovery, status: "acquisition_enqueued" };
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleDataPipelineQueue(batch: MessageBatch<PipelineQueueMessage>, bindingsValue: unknown): Promise<void> {
  const bindings = asPipelineBindings(bindingsValue);
  if (!bindings.DATA_PIPELINE_RAW || !bindings.DATA_PIPELINE_QUEUE) throw new Error("Pipeline R2 and Queue bindings are required");
  const { db } = await import("./db");

  for (const message of batch.messages) {
    const job = message.body;
    try {
      const query = new URLSearchParams({ "$limit": String(job.pageSize), "$offset": String(job.offset) });
      if (job.sourceId === "nyc-rolling-sales") query.set("$order", "sale_date,borough,block,lot");
      else if (job.sourceId === "nyc-condo-units") query.set("$order", "unit_bbl");
      else throw new Error(`${job.sourceId} has no queue acquisition implementation`);

      const response = await fetch(`${job.endpoint}?${query}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Source page returned HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const rows = JSON.parse(new TextDecoder().decode(bytes)) as unknown[];
      if (!Array.isArray(rows)) throw new Error("Source page is not a JSON array");
      const part = Math.floor(job.offset / job.pageSize);
      const objectKey = stableObjectKey(job.sourceId, job.watermark, part, "json");
      const checksum = await sha256Hex(bytes);
      await bindings.DATA_PIPELINE_RAW.put(objectKey, bytes, {
        httpMetadata: { contentType: "application/json" },
        customMetadata: { runId: job.runId, sourceId: job.sourceId, watermark: job.watermark, checksum },
      });
      await db.execute(sql`
        INSERT INTO raw_record_manifests (run_id, source_id, object_key, checksum_sha256, source_version, row_count, byte_size)
        VALUES (${job.runId}, ${job.sourceId}, ${objectKey}, ${checksum}, ${job.watermark}, ${rows.length}, ${bytes.byteLength})
        ON CONFLICT (source_id, object_key) DO UPDATE
          SET checksum_sha256 = EXCLUDED.checksum_sha256, row_count = EXCLUDED.row_count, byte_size = EXCLUDED.byte_size
      `);
      if (rows.length === job.pageSize) {
        await bindings.DATA_PIPELINE_QUEUE.send({ ...job, offset: job.offset + job.pageSize });
      } else {
        await db.execute(sql`UPDATE refresh_runs SET status = 'parsing', counts = counts || ${JSON.stringify({ acquiredThroughOffset: job.offset, finalPageRows: rows.length })}::jsonb WHERE id = ${job.runId}`);
      }
      message.ack();
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "pipeline_queue_failure",
        runId: job.runId,
        sourceId: job.sourceId,
        offset: job.offset,
        message: error instanceof Error ? error.message : String(error),
      }));
      message.retry({ delaySeconds: 60 });
    }
  }
}
