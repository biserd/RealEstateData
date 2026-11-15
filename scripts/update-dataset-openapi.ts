import { readFileSync, writeFileSync } from "node:fs";
import { datasetOperationEntries } from "../shared/datasetOperations";
import manifest from "../server.json";

const file = new URL("../client/public/openapi.json", import.meta.url);
const spec = JSON.parse(readFileSync(file, "utf8"));
spec.info.version = manifest.version;
spec.info.description = "Read-only access to U.S. housing markets, Florida recorded-sale releases, and verified NYC property and market records. Use an active Pro API key in the x-api-key header.";
spec.components.schemas = {
  ...spec.components.schemas,
  PublishedDatasetResponse: {
    type: "object", required: ["success", "data"],
    properties: { success: { const: true }, data: { type: "object", additionalProperties: true } },
  },
  PublishedDatasetError: {
    type: "object", required: ["success", "message"],
    properties: { success: { const: false }, message: { type: "string" } },
  },
};
for (const [name, operation] of datasetOperationEntries) {
  const path = operation.path.replace(/:([a-z]+)/g, "{$1}");
  spec.paths[path] = {
    get: {
      operationId: name,
      summary: operation.title,
      description: operation.description,
      parameters: Object.entries(operation.fields).map(([key, field]) => {
        const location = path.includes("{" + key + "}") ? "path" : "query";
        const { description, ...schema } = field;
        return { name: key, in: location, required: location === "path" || Boolean(operation.required?.includes(key)), description, schema };
      }),
      responses: {
        200: { description: "Published dataset response with source and coverage metadata.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/PublishedDatasetResponse" } } } },
        400: { description: "Invalid or incompatible parameters.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/PublishedDatasetError" } } } },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { description: "No eligible data matches this exact market or property." },
        ...(name === "search_florida_recorded_sales" && { 409: { description: "The Florida dataset was refreshed. Start a new search." } }),
        429: { $ref: "#/components/responses/RateLimited" },
        503: { description: "The selected publication is temporarily unavailable." },
      },
    },
  };
}
writeFileSync(file, JSON.stringify(spec, null, 2) + "\n");
