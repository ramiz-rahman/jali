/** The live feed seen from the app: a price not known yet, a feed that drops, a bad frame, and price history that fails. */
import { expect, test } from "../../shared/e2e/quality";
import { desk } from "./open";
import { fakeKraken, ticker } from "./kraken";

test("before Kraken's first quote, a price says it is not known yet, and a market order is refused", async ({
  page,
}) => {
  await fakeKraken(page, { quotes: false });
  await page.goto("/");
  await desk(page, "Crypto").click();
  const list = page.getByRole("listbox", { name: "Crypto" });
  await expect(list.getByRole("option", { name: /BTCUSD/ })).toContainText("Not known yet");
  await expect(page.locator('.jali-pane[data-pane="quote"]')).toContainText(
    "BTCUSD's price is not known yet",
  );

  const ticket = page.getByRole("form", { name: "Order ticket" });
  await ticket.getByLabel("Instrument").fill("BTCUSD");
  await ticket.getByLabel(/Quantity/).fill("1");
  await ticket.getByRole("button", { name: /^Buy/ }).last().click();
  await expect(ticket.getByRole("alert")).toContainText("not known yet");
  await expect(page.getByRole("region", { name: "Fills" })).toHaveCount(0);
});

test("the status line says when the feed is down, and when it is back", async ({ page }) => {
  const kraken = await fakeKraken(page);
  await page.goto("/");
  const note = page.getByRole("contentinfo", { name: "Status" }).getByRole("status");
  await expect(note).toContainText("Crypto live from Kraken");
  await kraken.drop({ refuse: true });
  await expect(note).toContainText("Kraken can't be reached");
  kraken.accept();
  await expect(note).toContainText("Crypto live from Kraken", { timeout: 10_000 });
});

test("a frame that isn't a price never reaches the page, and a good one beside it does", async ({
  page,
}) => {
  const kraken = await fakeKraken(page);
  await page.goto("/");
  await desk(page, "Crypto").click();
  const btc = page.getByRole("listbox", { name: "Crypto" }).getByRole("option", { name: /BTCUSD/ });
  await expect(btc).toContainText("63,760");
  kraken.send("{not json");
  kraken.send({
    channel: "ticker",
    type: "update",
    data: [{ ...ticker("BTC/USD", 1), last: "NaN" }, ticker("ETH/USD", 3200.25)],
  });
  await expect(
    page.getByRole("listbox", { name: "Crypto" }).getByRole("option", { name: /ETHUSD/ }),
  ).toContainText("3,200.25");
  await expect(btc).toContainText("63,760");
  await expect(btc).not.toContainText("NaN");
});

test("a failed price history isn't asked for again on every tick", async ({ page }) => {
  const kraken = await fakeKraken(page);
  kraken.failHistory(true);
  await page.goto("/");
  await desk(page, "Crypto").click();
  await expect(page.locator('.jali-pane[data-pane="chart"]')).toBeVisible();
  await expect.poll(() => kraken.historyCalls().length).toBeGreaterThan(0);
  // Quotes tick many times a second; each history the page asks for is tried once, then waits five seconds.
  for (let i = 0; i < 20; i++)
    kraken.send({ channel: "ticker", type: "update", data: [ticker("BTC/USD", 63_760 + i)] });
  await expect(page.locator('.jali-pane[data-pane="chart"]')).toBeVisible();
  const calls = kraken.historyCalls();
  expect(calls.length).toBe(new Set(calls).size);
});

test("Reset with a typed order: Keep editing keeps every desk as it was left", async ({ page }) => {
  await fakeKraken(page);
  await page.goto("/");
  const news = page.locator('.jali-pane[data-pane="news"]');
  await desk(page, "Rates").click();
  await news.getByRole("button", { name: /close/i }).first().click();
  await expect(news).toHaveCount(0);

  // Equities has no blotter of its own: Buy opens one, so Reset would close a typed order, and Jali asks.
  await desk(page, "Equities").click();
  await page.locator('.jali-pane[data-pane="quote"]').getByRole("button", { name: "Buy" }).click();
  const ticket = page.getByRole("form", { name: "Order ticket" });
  await ticket.getByLabel(/Quantity/).fill("200");
  await page.getByRole("button", { name: "Reset every desk to the demo layout" }).click();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(ticket.getByLabel(/Quantity/)).toHaveValue("200");
  // The order is cleared, so the next switch has nothing to ask about.
  await ticket.getByRole("button", { name: "Clear" }).click();

  await desk(page, "Rates").click();
  await expect(page.locator('.jali-pane[data-pane="curve"]')).toBeVisible();
  await expect(news).toHaveCount(0);
});
