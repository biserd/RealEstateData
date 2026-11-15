import type { Express, Request, Response } from "express";
import { datasetOperationEntries } from "../shared/datasetOperations";
import { externalApiMiddleware } from "./apiMiddleware";
import { runDatasetOperation } from "./datasetService";
import { DatasetError } from "./datasetError";

export function registerDatasetRoutes(app: Express, floridaDb?: D1Database) {
  for (const [name, operation] of datasetOperationEntries) {
    app.get(operation.path, externalApiMiddleware, async (req: Request, res: Response) => {
      res.set("Cache-Control", "private, no-store");
      try {
        if (Object.keys(req.params).some(key => Object.hasOwn(req.query, key))) {
          throw new DatasetError(400, "Do not repeat a path parameter in the query.");
        }
        const input: Record<string, string | number> = {};
        for (const [key, value] of Object.entries({ ...req.query, ...req.params })) {
          if (!Object.hasOwn(operation.fields, key) || typeof value !== "string") {
            throw new DatasetError(400, "Pass each supported parameter only once.");
          }
          input[key] = operation.fields[key].type === "integer" && /^\d+$/.test(value) ? Number(value) : value;
        }
        res.json({ success: true, data: await runDatasetOperation(name, input, floridaDb) });
      } catch (error) {
        if (!(error instanceof DatasetError)) console.error("Partner dataset read failed", name);
        const status = error instanceof DatasetError ? error.status : 503;
        res.status(status).json({ success: false, message: error instanceof DatasetError ? error.message : "Published data is temporarily unavailable." });
      }
    });
  }
}
