import { describe, expect, it } from "vite-plus/test";
import { entityTable, singular } from "./tables";

describe("entity table names", () => {
  it("maps audit entity types without guessing unknown tables", () => {
    expect(entityTable("order")).toBe("orders");
    expect(entityTable("product")).toBe("products");
    expect(entityTable("address")).toBe("addresses");
    expect(entityTable("category")).toBe("categories");
    expect(entityTable("unknown")).toBeUndefined();
    expect(singular("addresses")).toBe("address");
  });
});
