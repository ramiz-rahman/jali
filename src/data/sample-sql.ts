/** Original fictional Sixface data; generated locally and deterministically. */
export const SAMPLE_SQL =
  "CREATE TABLE IF NOT EXISTS sample_orders (id INTEGER PRIMARY KEY, region TEXT NOT NULL, amount_cents INTEGER NOT NULL); INSERT INTO sample_orders VALUES (1,'Dhaka',12500),(2,'London',9900),(3,'Singapore',18300),(4,'Dhaka',7200) ON CONFLICT DO NOTHING;";
export const SAMPLE_QUERY = "SELECT * FROM sample_orders";

/** Call only when initializing an empty sample. Never migrate an existing source. */
export function sampleDatabaseSql(engine: "sqlite" | "postgres" | "duckdb" = "sqlite"): string {
  const statements = [
    SAMPLE_SQL,
    `CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER REFERENCES categories(id));`,
    `CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL);`,
    `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, joined_at TEXT NOT NULL, preferences_json TEXT NOT NULL, notes TEXT);`,
    `CREATE UNIQUE INDEX customers_email_unique ON customers(email);`,
    `CREATE TABLE addresses (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), city TEXT NOT NULL, country TEXT NOT NULL, postal_code TEXT);`,
    `CREATE TABLE products (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id), supplier_id INTEGER REFERENCES suppliers(id), name TEXT NOT NULL, price_cents INTEGER NOT NULL, metadata_json TEXT NOT NULL, CONSTRAINT positive_price CHECK (price_cents >= 0));`,
    `CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), address_id INTEGER REFERENCES addresses(id), ordered_at TEXT NOT NULL, status TEXT NOT NULL, total_cents INTEGER NOT NULL, CONSTRAINT order_customer UNIQUE (id, customer_id), CONSTRAINT positive_total CHECK (total_cents >= 0));`,
    `CREATE TABLE order_items (order_id INTEGER NOT NULL, customer_id INTEGER NOT NULL, line_number INTEGER NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, PRIMARY KEY (order_id, line_number), FOREIGN KEY (order_id, customer_id) REFERENCES orders(id, customer_id), CONSTRAINT positive_quantity CHECK (quantity > 0));`,
    `CREATE TABLE reviews (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER NOT NULL REFERENCES products(id), rating INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL, CONSTRAINT rating_range CHECK (rating BETWEEN 1 AND 5));`,
    `CREATE TABLE audit_log (id INTEGER PRIMARY KEY, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, action TEXT NOT NULL, changed_at TEXT NOT NULL, payload_json TEXT);`,
  ];
  const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  const insert = (table: string, rows: (string | number | null)[][]) => {
    // Parent categories must be visible before child inserts on DuckDB.
    const batchSize = table === "categories" ? 1 : 100;
    for (let i = 0; i < rows.length; i += batchSize)
      statements.push(
        `INSERT INTO ${table} VALUES ${rows
          .slice(i, i + batchSize)
          .map(
            (r) =>
              "(" +
              r
                .map((v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : quote(v)))
                .join(",") +
              ")",
          )
          .join(",")};`,
      );
  };
  insert("categories", [
    [1, "Home", null],
    [2, "Kitchen", 1],
    [3, "Textiles", 1],
    [4, "Office", null],
    [5, "Stationery", 4],
    [6, "Books", null],
    [7, "Gardening", null],
    [8, "Lighting", 1],
  ]);
  insert("suppliers", [
    [1, "Padma Crafts", "BD"],
    [2, "Nordlicht", "DE"],
    [3, "Sakura Paper", "JP"],
    [4, "Méditerranée", "FR"],
    [5, "Garden Studio", "GB"],
    [6, "Meridian Press", "SG"],
  ]);
  const names = [
    "নাদিয়া রহমান",
    "Zoë Martin",
    "山田 花子",
    "José Silva",
    "Amina Okafor",
    "Müller",
    "李明",
    "O'Connor",
  ];
  const cities = ["Dhaka", "London", "Singapore", "Kyoto", "Lisbon", "Berlin"];
  const countries = ["BD", "GB", "SG", "JP", "PT", "DE"];
  const date = (n: number) =>
    `2026-${String(1 + (n % 10)).padStart(2, "0")}-${String(1 + (n % 28)).padStart(2, "0")}T10:30:00Z`;
  insert(
    "customers",
    Array.from({ length: 240 }, (_, i) => [
      i + 1,
      `${names[i % names.length]} ${i + 1}`,
      `customer${i + 1}@example.invalid`,
      date(i),
      JSON.stringify({ newsletter: i % 3 === 0, language: ["bn", "en", "ja"][i % 3] }),
      i % 20 === 0 ? "Delivery after 17:00" : null,
    ]),
  );
  insert(
    "addresses",
    Array.from({ length: 240 }, (_, i) => [
      i + 1,
      i + 1,
      cities[i % 6]!,
      countries[i % 6]!,
      i % 4 === 0 ? null : String(1000 + i),
    ]),
  );
  const productNames = [
    "Ceramic cup",
    "Linen towel",
    "Notebook",
    "Reading lamp",
    "Seed collection",
    "Pocket atlas",
  ];
  insert(
    "products",
    Array.from({ length: 120 }, (_, i) => [
      i + 1,
      (i % 8) + 1,
      i % 9 === 0 ? null : (i % 6) + 1,
      `${productNames[i % 6]} ${i + 1}`,
      500 + i * 125,
      JSON.stringify({ material: ["paper", "cotton", "ceramic"][i % 3], recyclable: i % 2 === 0 }),
    ]),
  );
  const items: (string | number | null)[][] = [];
  const orders: (string | number | null)[][] = [];
  for (let i = 0; i < 800; i++) {
    let total = 0;
    for (let line = 1; line <= 3; line++) {
      const product = (i * 7 + line) % 120,
        quantity = 1 + ((i + line) % 3),
        price = 500 + product * 125;
      total += quantity * price;
      items.push([i + 1, (i % 240) + 1, line, product + 1, quantity, price]);
    }
    orders.push([
      i + 1,
      (i % 240) + 1,
      i % 13 === 0 ? null : (i % 240) + 1,
      date(i),
      ["delivered", "shipped", "processing", "cancelled"][i % 4]!,
      total,
    ]);
  }
  insert("orders", orders);
  insert("order_items", items);
  insert(
    "reviews",
    Array.from({ length: 320 }, (_, i) => [
      i + 1,
      (i % 240) + 1,
      (i % 120) + 1,
      (i % 5) + 1,
      i % 4 === 0
        ? null
        : ["Beautiful finish", "Arrived promptly", "ভালো মানের", "丁寧な作り"][i % 4]!,
      date(i),
    ]),
  );
  insert(
    "audit_log",
    Array.from({ length: 120 }, (_, i) => [
      i + 1,
      "order",
      i + 1,
      "created",
      date(i),
      JSON.stringify({ origin: "sample", version: 2 }),
    ]),
  );
  statements.push(
    "CREATE VIEW order_summary AS SELECT o.id, c.name AS customer_name, o.ordered_at, o.status, o.total_cents FROM orders o JOIN customers c ON c.id = o.customer_id;",
  );
  if (engine === "sqlite")
    statements.push(
      `CREATE TRIGGER products_price_audit AFTER UPDATE OF price_cents ON products BEGIN INSERT INTO audit_log (id,entity_type,entity_id,action,changed_at,payload_json) VALUES ((SELECT COALESCE(MAX(id),0)+1 FROM audit_log),'product',NEW.id,'price_changed','2026-11-01T00:00:00Z','{"source":"trigger"}'); END;`,
    );
  return "BEGIN;\n" + statements.join("\n") + "\nCOMMIT;";
}

/** The sample's statements without their transaction, for a caller that owns one (Reset sample). */
export function sampleDatabaseStatements(engine: "sqlite" | "postgres" | "duckdb" = "sqlite") {
  const sql = sampleDatabaseSql(engine);
  return [sql.slice("BEGIN;\n".length, sql.length - "\nCOMMIT;".length)];
}
