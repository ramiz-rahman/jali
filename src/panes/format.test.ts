import { describe, expect, it } from "vitest";
import type { ColumnInfo } from "../data/types";
import { formatCell, formatCompact, formatCount, formatMs, foreignKeyRef, isNumericType, nextSort, orderByString, parseFilter, pickChartColumns, relationRef, rowId, titleFor } from "./format";

const col = (name: string, type = "text", extra: Partial<ColumnInfo> = {}): ColumnInfo => ({ name, type, nullable: false, primaryKey: false, ...extra });

describe("formatting", () => {
  it("formats numbers and money", () => {
    expect(formatCell(12500, col("total_cents", "integer"))).toBe("125.00");
    expect(formatCell(1234, col("quantity", "integer"))).toBe("1,234");
    expect(formatCell(null)).toBe("");
    expect(formatCount(12345)).toBe("12,345");
    expect(formatMs(12.4)).toBe("12 ms");
    expect(formatMs(1500)).toBe("1.50 s");
    expect(formatCompact(1500)).toBe("1.5k");
    expect(isNumericType("INTEGER")).toBe(true);
    expect(isNumericType("text")).toBe(false);
  });
  it("cycles sort", () => {
    const a = nextSort(null, "name"); const b = nextSort(a, "name");
    expect(a).toEqual({ column: "name", dir: "asc" });
    expect(b).toEqual({ column: "name", dir: "desc" });
    expect(nextSort(b, "name")).toBeNull();
    expect(orderByString(b)).toBe("name DESC");
  });
  it("parses filters by column type", () => {
    expect(parseFilter(col("id", "integer"), " 7 ")).toBe(7);
    expect(parseFilter(col("id", "integer"), "x")).toBeNull();
    expect(parseFilter(col("name"), "Amina")).toBe("Amina");
    expect(parseFilter(col("name"), "  ")).toBeNull();
  });
});

describe("relation links", () => {
  it("joins composite keys in column order", () => {
    const cols = [col("order_id", "integer", { primaryKey: true }), col("line_number", "integer", { primaryKey: true }), col("quantity", "integer")];
    expect(rowId(cols, { order_id: 789, line_number: 2, quantity: 1 })).toBe("789:2");
  });
  it("links foreign keys to records, never nulls", () => {
    const fk = col("customer_id", "integer", { references: { table: "customers", column: "id" } });
    expect(foreignKeyRef(fk, 69)).toEqual({ kind: "record", params: { table: "customers", id: "69" } });
    expect(foreignKeyRef(fk, null)).toBeNull();
    expect(foreignKeyRef(col("status"), "paid")).toBeNull();
  });
  it("turns a relation into a related ref", () => {
    expect(relationRef({ label: "Orders by Amina Okafor", table: "orders", where: { customer_id: 69 } })).toEqual({
      kind: "related", params: { table: "orders", column: "customer_id", value: 69, label: "Orders by Amina Okafor" },
    });
  });
  it("titles refs and picks chart columns", () => {
    expect(titleFor({ kind: "record", params: { table: "customers", id: "69" } })).toBe("customer 69");
    expect(pickChartColumns([{ region: "Dhaka", id: 1, amount: 5 }], ["region", "id", "amount"])).toEqual({ x: "region", y: "amount" });
  });
});
