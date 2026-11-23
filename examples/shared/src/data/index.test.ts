import { beforeAll, describe, expect, it } from "vite-plus/test";
import { createDataLayer } from "./index";
import { QueryObserver } from "@tanstack/react-query";

describe("data layer", () => {
  const layer = createDataLayer();
  const { api, keys, queryClient } = layer;
  beforeAll(() => api.ready(), 30000);
  it("loads catalog metadata and counts", async () => {
    const catalog = await api.catalog();
    const orders = catalog.find((t) => t.name === "orders")!;
    expect(orders.rowCount).toBe(800);
    expect(orders.columns.find((c) => c.name === "customer_id")).toMatchObject({
      nullable: false,
      references: { table: "customers", column: "id" },
    });
    expect(catalog.find((t) => t.name === "customers")!.referencedBy).toContainEqual({
      table: "orders",
      column: "customer_id",
    });
  });
  it("loads the loan book; application facts match the rows", async () => {
    const { applicationFacts, LOAN_BOOK } = await import("./sample-sql");
    const catalog = await api.catalog();
    expect(catalog.find((t) => t.name === "loan_applications")!.rowCount).toBe(
      LOAN_BOOK.applications,
    );
    for (const id of [1, 7, 36]) {
      const app = await api.record("loan_applications", String(id));
      const f = applicationFacts(id);
      expect(app).toMatchObject({
        borrower_id: f.borrower,
        property_id: f.property,
        loan_officer_id: f.officer,
      });
      expect(await api.record("borrowers", String(f.borrower))).toMatchObject({
        loan_officer_id: f.officer,
      });
    }
    const borrower = await api.record("borrowers", "9");
    expect(await api.relations("borrowers", borrower!)).toContainEqual(
      expect.objectContaining({ table: "mortgages", where: { borrower_id: 9 } }),
    );
  });
  it("describes outgoing and incoming relations", async () => {
    const order = await api.record("orders", "61");
    const relations = await api.relations("orders", order!);
    expect(relations).toContainEqual({
      label: "Customer",
      table: "customers",
      where: { id: 61 },
      count: 1,
    });
    expect(relations).toContainEqual({
      label: "Address",
      table: "addresses",
      where: { id: 61 },
      count: 1,
    });
    const customer = await api.record("customers", "61");
    expect(await api.relations("customers", customer!)).toContainEqual(
      expect.objectContaining({
        label: "Orders by this customer",
        table: "orders",
        where: { customer_id: 61 },
        count: expect.any(Number),
      }),
    );
  });
  it("invalidates affected entities and lists without touching products", async () => {
    const opts = { where: { customer_id: 61 } };
    const customer = await queryClient.fetchQuery({
      queryKey: keys.record("customers", "61"),
      queryFn: () => api.record("customers", "61"),
    });
    await queryClient.fetchQuery({
      queryKey: keys.relations("customers", "61"),
      queryFn: () => api.relations("customers", customer!),
    });
    await queryClient.fetchQuery({
      queryKey: keys.rows("customers", {}),
      queryFn: () => api.rows("customers", {}),
    });
    await queryClient.fetchQuery({
      queryKey: keys.rows("orders", opts),
      queryFn: () => api.rows("orders", opts),
    });
    await queryClient.fetchQuery({
      queryKey: keys.rows("products", {}),
      queryFn: () => api.rows("products", {}),
    });
    await layer.invalidateEntities(await api.updateRow("customers", "61", { name: "Changed" }));
    for (const k of [
      keys.record("customers", "61"),
      keys.relations("customers", "61"),
      keys.rows("customers", {}),
      keys.rows("orders", opts),
    ])
      expect(queryClient.getQueryState(k)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.rows("products", {}))?.isInvalidated).toBe(false);
  });
  it("shares result slices and updates identifiable rows without rerunning SQL", async () => {
    const handle = await api.run("SELECT * FROM customers WHERE id = 61");
    const before = layer.stats();
    expect(api.resultRows(handle.runId, 0, 1)[0]?.name).toBe("Changed");
    expect(api.resultRows(handle.runId, 0, 1)[0]).toBe(api.resultRows(handle.runId, 0, 1)[0]);
    expect(layer.stats().fetches).toBe(before.fetches);
    expect(layer.stats().cacheHits).toBeGreaterThan(before.cacheHits);
    await api.updateRow("customers", "61", { name: "Again" });
    expect(api.resultRows(handle.runId, 0, 1)[0]?.name).toBe("Again");
  });
  it("invalidates exactly the dependent queries and refetches mounted lists once each", async () => {
    const customer = await api.record("customers", "1");
    const cases = [
      {
        key: keys.record("customers", "1"),
        fn: () => api.record("customers", "1"),
        affected: true,
      },
      {
        key: keys.relations("customers", "1"),
        fn: () => api.relations("customers", customer!),
        affected: true,
      },
      {
        key: keys.record("customers", "2"),
        fn: () => api.record("customers", "2"),
        affected: false,
      },
      ...(["customers", "orders", "products", "suppliers"] as const).flatMap((table) =>
        [{ limit: 2 }, { limit: 2, offset: 2 }].map((opts) => ({
          key: keys.rows(table, opts),
          fn: () => api.rows(table, opts),
          affected: table === "customers" || table === "orders",
          mounted: true,
        })),
      ),
    ];
    const unsubscribers: (() => void)[] = [];
    for (const item of cases) {
      await queryClient.fetchQuery<unknown>({ queryKey: item.key, queryFn: item.fn });
      if ("mounted" in item && item.mounted) {
        const observer = new QueryObserver<unknown>(queryClient, {
          queryKey: item.key,
          queryFn: item.fn,
        });
        unsubscribers.push(observer.subscribe(() => {}));
      }
    }
    const beforeRows = queryClient.getQueryData<{ rows: Record<string, unknown>[] }>(
      keys.rows("customers", { limit: 2 }),
    )!.rows;
    const handle = await api.run("SELECT * FROM customers ORDER BY id LIMIT 2");
    const beforeResult = api.resultRows(handle.runId, 0, 2);
    const changed = await api.updateRow("customers", "1", { name: "Customer one edited" });
    const afterResult = api.resultRows(handle.runId, 0, 2);
    expect(afterResult[0]).not.toBe(beforeResult[0]);
    expect(beforeResult[0]!.name).not.toBe(afterResult[0]!.name);
    expect(afterResult[1]).toBe(beforeResult[1]);
    const invalidated = new Set<string>();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "invalidate")
        invalidated.add(event.query.queryHash);
    });
    const beforeFetches = layer.stats().fetches;
    await layer.invalidateEntities(changed);
    expect(layer.stats().fetches - beforeFetches).toBe(
      cases.filter((c) => c.affected && "mounted" in c && c.mounted).length,
    );
    for (const item of cases)
      expect(
        invalidated.has(
          queryClient.getQueryCache().find({ queryKey: item.key, exact: true })!.queryHash,
        ),
      ).toBe(item.affected);
    const afterRows = queryClient.getQueryData<{ rows: Record<string, unknown>[] }>(
      keys.rows("customers", { limit: 2 }),
    )!.rows;
    expect(afterRows[0]).not.toBe(beforeRows[0]);
    expect(afterRows[1]).toBe(beforeRows[1]);
    unsubscribe();
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });
  it("orders by primary key by default and validates explicit ordering", async () => {
    expect((await api.rows("customers", { limit: 3 })).rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(
      (await api.rows("customers", { orderBy: "id DESC", limit: 3 })).rows.map((r) => r.id),
    ).toEqual([240, 239, 238]);
    const composite = (await api.rows("order_items", { limit: 10 })).rows;
    expect(composite.map((r) => [r.order_id, r.line_number])).toEqual(
      [...composite]
        .sort(
          (a, b) =>
            Number(a.order_id) - Number(b.order_id) ||
            Number(a.line_number) - Number(b.line_number),
        )
        .map((r) => [r.order_id, r.line_number]),
    );
    await expect(
      api.rows("customers", { orderBy: "id DESC; DROP TABLE customers" }),
    ).rejects.toThrow("Invalid orderBy");
    await expect(api.rows("customers", { orderBy: "nonexistent" })).rejects.toThrow(
      "Invalid orderBy",
    );
  });
  it("reports trigger-written audit entities", async () => {
    const changed = await api.updateRow("products", "1", { price_cents: 1234 });
    expect(changed).toContainEqual({ table: "products", id: "1" });
    expect(changed).toContainEqual({ table: "audit_log", id: "121" });
  });
});
