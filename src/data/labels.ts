import type { ColumnFormat } from "./types";

export function singular(name: string): string {
  return name === "addresses" ? "address" : name === "categories" ? "category" : name.replace(/s$/, "");
}

const money = new Set(["amount_cents", "price_cents", "total_cents", "unit_price_cents", "principal_cents", "savings_cents", "outstanding_cents"]);
const json = new Set(["metadata_json", "payload_json", "preferences_json"]);
export function columnFormat(name: string): ColumnFormat | undefined {
  return money.has(name) ? "money" : json.has(name) ? "json" : undefined;
}
/** Query aliases retain the sample database's display conventions. */
export function resultFormat(name: string): ColumnFormat | undefined {
  return name.endsWith("_cents") ? "money" : name.endsWith("_json") ? "json" : undefined;
}
