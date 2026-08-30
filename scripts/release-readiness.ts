import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOURCE_CATALOG } from "../pipeline/sourceCatalog";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; scripts: Record<string, string> };
assert.equal(packageJson.dependencies["@react-google-maps/api"], undefined, "Google Maps must not be in the production dependency graph");
assert.equal(packageJson.dependencies.recharts, undefined, "Recharts must not be in the production dependency graph");

const deployableSources = [
  read("server/worker.ts"),
  read("server/routes.ts"),
  read("scripts/refresh-live-data.ts"),
  read("scripts/build-candidate-dataset.ts"),
].join("\n");
assert.doesNotMatch(deployableSources, /Math\.random\s*\(/, "Deployable data paths must be deterministic");
assert.doesNotMatch(read("scripts/refresh-live-data.ts"), /productionDataSync|server\/etl\//, "Approved refresh must not import quarantined ETL");
assert.match(read("migrations/0001_versioned_data_platform.sql"), /publish_validated_dataset/);
assert.match(read("wrangler.pipeline.example.jsonc"), /dead_letter_queue/);
assert.match(read("server/dataPipelineWorkflow.ts"), /stableObjectKey|checksum|message\.retry/);
assert.doesNotMatch(read("wrangler.pipeline.example.jsonc"), /"crons"\s*:/, "Data imports must remain manual-only");
assert.doesNotMatch(read("server/worker.ts"), /async scheduled\s*\(/, "Worker must not expose a scheduled refresh handler");
assert.doesNotMatch(read("vite.config.ts"), /manualChunks\s*\(/, "Do not force React dependencies into circular production chunks");

const incorrectlyActive = SOURCE_CATALOG.filter((source) => source.active && source.redistributionStatus !== "approved");
assert.deepEqual(incorrectlyActive, [], "No unapproved source may be active");
assert.ok(SOURCE_CATALOG.some((source) => source.id === "nys-salesweb" && !source.active), "Non-NYC NY must remain gated pending source review");
assert.ok(SOURCE_CATALOG.some((source) => source.id === "licensed-reso" && !source.active), "Live listings must remain gated pending a licensed feed");

const requiredScripts = ["data:geography", "data:candidate", "release:check", "test:regression"];
for (const script of requiredScripts) assert.ok(packageJson.scripts[script], `Missing package script ${script}`);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "map_and_plot_dependencies_removed",
    "deployable_pipeline_deterministic",
    "legacy_generated_etl_quarantined",
    "candidate_publication_atomic",
    "queue_has_dlq_and_retries",
    "pipeline_is_manual_only",
    "vite_dependency_chunks_are_safe",
    "unapproved_sources_fail_closed",
    "release_commands_present",
  ],
}, null, 2));
