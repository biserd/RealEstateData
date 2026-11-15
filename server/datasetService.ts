import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { datasetInputSchema, datasetOperationEntries, type DatasetOperationName } from "../shared/datasetOperations";
import { DatasetError } from "./datasetError";
import { floridaCountyInventory, floridaRecordedSales, floridaSaleProfile } from "./floridaDataset";
import { exactHousingDataset, housingDataset, searchHousingDataset } from "./housingDataset";
import { nycDataset, nycMarket, nycProperty, nycPublishedComps, nycRecordedSales, searchNycProperties } from "./nycDataset";

export const datasetValidator = new CfWorkerJsonSchemaValidator();
type Input = Record<string, string | number | undefined>;
const validators = new Map(datasetOperationEntries.map(([name, operation]) =>
  [name, datasetValidator.getValidator<Input>(datasetInputSchema(operation))]));

export async function runDatasetOperation(name: DatasetOperationName, input: Input, floridaDb?: D1Database): Promise<Record<string, unknown>> {
  input = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
  const result = validators.get(name)!(input);
  if (!result.valid) throw new DatasetError(400, "Use the required parameters and valid types for this operation.");
  const text = (key: string) => typeof input[key] === "string" ? input[key].trim() || undefined : undefined;
  const limit = Number(input.limit ?? 25), offset = Number(input.offset ?? 0);
  switch (name) {
    case "list_published_datasets": {
      const [florida, nyc] = await Promise.allSettled([floridaCountyInventory(floridaDb), nycDataset()]);
      return {
        datasets: [
          { ...housingDataset, status: "published", recordTypes: ["state", "county", "place", "zip"], operations: ["search_housing_markets", "get_housing_market"] },
          { id: "florida-recorded-sales", status: florida.status === "fulfilled" ? "published" : "temporarily_unavailable",
            ...(florida.status === "fulfilled" && { ...florida.value.dataset, coverage: { counties: florida.value.counties.length, records: florida.value.totalRecords } }),
            recordTypes: ["county-profile", "recorded-sale"],
            operations: ["list_florida_counties", "get_florida_sales_profile", "search_florida_recorded_sales"] },
          { id: "nyc-recorded-sales", status: nyc.status === "fulfilled" ? "published" : "temporarily_unavailable",
            ...(nyc.status === "fulfilled" && nyc.value),
            recordTypes: ["property", "condo-unit", "recorded-sale", "comparable", "market-aggregate", "zip-momentum"],
            operations: ["search_nyc_properties", "get_nyc_property", "list_nyc_recorded_sales", "get_nyc_property_comps", "get_nyc_market_aggregates",
              "get_nyc_zip_market_snapshot", "compare_nyc_price_per_square_foot", "list_nyc_market_momentum"] },
        ],
        endpoints: datasetOperationEntries.map(([tool, operation]) => ({ tool, path: operation.path.replace(/:([a-z]+)/g, "{$1}") })),
      };
    }
    case "search_housing_markets":
      return searchHousingDataset(input);
    case "get_housing_market":
      return exactHousingDataset(text("level")!, text("id")!);
    case "list_florida_counties":
      return floridaCountyInventory(floridaDb);
    case "get_florida_sales_profile":
      return floridaSaleProfile(floridaDb, text("county"));
    case "search_florida_recorded_sales":
      return floridaRecordedSales(floridaDb, {
        county: text("county")!, zip: text("zip"), city: text("city"), q: text("q"), type: text("type"),
        from: text("from"), to: text("to"), cursor: text("cursor"), limit,
      });
    case "search_nyc_properties":
      return searchNycProperties({ kind: text("kind"), zip: text("zip"), q: text("q"), limit, offset });
    case "get_nyc_property":
      return nycProperty(text("id")!);
    case "list_nyc_recorded_sales":
      return nycRecordedSales({ zip: text("zip"), propertyId: text("propertyId"), unitBbl: text("unitBbl"), baseBbl: text("baseBbl"), limit, offset });
    case "get_nyc_property_comps":
      return nycPublishedComps(text("id")!, limit, offset);
    case "get_nyc_market_aggregates":
      return nycMarket(text("geoType")!, text("geoId")!);
  }
}
