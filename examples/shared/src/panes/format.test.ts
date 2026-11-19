import { createPaneKinds } from "@jali/core/adapter";
import { nextSort, orderByString, parseFilter } from "./grid/grid-state";
import { recordKind } from "./kinds/record";
import { pickChartColumns } from "../../../data-studio/src/panes/kinds/chart";
import { describe, expect, it } from "vite-plus/test";
import type { ColumnInfo } from "../data/types";
import {
  cellKind,
  columnLabel,
  formatCell,
  formatJson,
  formatMoney,
  formatTimestamp,
  rawText,
  formatCompact,
  formatCount,
  formatMs,
  isNumericType,
} from "./format";
import { foreignKeyRef, relationRef, rowId } from "./shared/refs";

const col = (name: string, type = "text", extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
  name,
  type,
  nullable: false,
  primaryKey: false,
  ...extra,
});

describe("formatting", () => {
  it("formats numbers and money", () => {
    expect(formatCell(12500, col("total_cents", "integer", { format: "money" }))).toBe("125.00");
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
    const a = nextSort(null, "name");
    const b = nextSort(a, "name");
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
    const cols = [
      col("order_id", "integer", { primaryKey: true }),
      col("line_number", "integer", { primaryKey: true }),
      col("quantity", "integer"),
    ];
    expect(rowId(cols, { order_id: 789, line_number: 2, quantity: 1 })).toBe("789:2");
  });
  it("links foreign keys to records, never nulls", () => {
    const fk = col("customer_id", "integer", { references: { table: "customers", column: "id" } });
    expect(foreignKeyRef(fk, 69)).toEqual({
      kind: "record",
      params: { table: "customers", id: "69" },
    });
    expect(foreignKeyRef(fk, null)).toBeNull();
    expect(foreignKeyRef(col("status"), "paid")).toBeNull();
  });
  it("turns a relation into a related ref", () => {
    expect(
      relationRef({
        label: "Orders by Amina Okafor",
        table: "orders",
        count: 1,
        where: { customer_id: 69 },
      }),
    ).toEqual({
      kind: "related",
      params: {
        table: "orders",
        column: "customer_id",
        value: 69,
        label: "Orders by Amina Okafor",
      },
    });
  });
  it("titles refs and picks chart columns", () => {
    expect(createPaneKinds([recordKind]).title(recordKind({ table: "customers", id: "69" }))).toBe(
      "customer 69",
    );
    expect(
      pickChartColumns([{ region: "Dhaka", id: 1, amount: 5 }], ["region", "id", "amount"]),
    ).toEqual({ x: "region", y: "amount" });
  });
});

describe("cell formatters", () => {
  it("formats ISO timestamps as en-GB, 24-hour", () => {
    expect(formatTimestamp("2026-01-01T10:30:00Z")).toBe("1 Jan 2026, 10:30");
    expect(formatTimestamp("2026-11-01T00:00:00Z")).toBe("1 Nov 2026, 00:00");
    expect(formatTimestamp("2026-09-05T23:05:59.123Z")).toBe("5 Sep 2026, 23:05");
    expect(formatTimestamp("2026-01-01T10:30:00+02:00")).toBe("1 Jan 2026, 08:30");
    expect(formatTimestamp("2026-03-04 07:08")).toBe("4 Mar 2026, 07:08");
  });
  it("formats plain dates without a time", () => {
    expect(formatTimestamp("2026-01-01")).toBe("1 Jan 2026");
  });
  it("leaves non-dates alone", () => {
    expect(formatTimestamp("hello")).toBeNull();
    expect(formatTimestamp("2026-13-45")).toBeNull();
    expect(formatTimestamp(12)).toBeNull();
    expect(formatCell("2026-01-01T10:30:00Z", { name: "ordered_at" })).toBe("1 Jan 2026, 10:30");
    expect(formatCell("paid", { name: "status" })).toBe("paid");
  });
  it("formats money from cents", () => {
    expect(formatMoney(12500)).toBe("125.00");
    expect(formatMoney(5)).toBe("0.05");
    expect(formatMoney(123456789)).toBe("1,234,567.89");
  });
  it("titles money columns without _cents", () => {
    expect(columnLabel("total_cents", "money")).toBe("Total");
    expect(columnLabel("price_cents", "money")).toBe("Price");
    expect(columnLabel("unit_price_cents", "money")).toBe("Unit price");
    expect(columnLabel("amount_cents", "money")).toBe("Amount");
    expect(columnLabel("quantity")).toBe("quantity");
  });
  it("compacts JSON columns", () => {
    expect(formatJson('{ "a": 1,\n "b": [1, 2] }')).toBe('{"a":1,"b":[1,2]}');
    expect(formatJson('{"a":1}', true)).toBe('{\n  "a": 1\n}');
    expect(formatJson("not json")).toBe("not json");
    expect(formatCell('{ "source": "trigger" }', { name: "payload_json", format: "json" })).toBe(
      '{"source":"trigger"}',
    );
  });
  it("classifies cells and keeps raw values", () => {
    expect(cellKind(null)).toBe("null");
    expect(cellKind(5, { name: "price_cents", format: "money" })).toBe("money");
    expect(cellKind(5, { name: "quantity" })).toBe("number");
    expect(cellKind("2026-01-01", { name: "x" })).toBe("time");
    expect(cellKind("{}", { name: "metadata_json", format: "json" })).toBe("json");
    expect(rawText(12500)).toBe("12500");
    expect(rawText("2026-01-01T10:30:00Z")).toBe("2026-01-01T10:30:00Z");
    expect(rawText(null)).toBe("NULL");
  });
});
