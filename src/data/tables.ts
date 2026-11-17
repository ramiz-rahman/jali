export const TABLES = ["customers", "orders", "order_items", "products", "suppliers", "reviews", "addresses", "categories", "audit_log", "sample_orders"] as const;
export type TableName = typeof TABLES[number];

export function entityTable(type: string): TableName | undefined {
  return TABLES.find(table => singular(table) === type || table === type);
}
export function singular(name: string): string {
  return name === "addresses" ? "address" : name === "categories" ? "category" : name.replace(/s$/, "");
}
