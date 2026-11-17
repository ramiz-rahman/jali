export const TABLES = ["customers", "orders", "order_items", "products", "suppliers", "reviews", "addresses", "categories", "audit_log", "sample_orders"] as const;
export type TableName = typeof TABLES[number];

import { singular } from "./labels";
export { singular } from "./labels";

export function entityTable(type: string): TableName | undefined {
  return TABLES.find(table => singular(table) === type || table === type);
}
