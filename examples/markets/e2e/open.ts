/** Opening the app in the tests: on the stand-in Kraken, on a desk, once its watchlist shows. */
import { expect, type Page } from "@playwright/test";
import { fakeKraken, type FakeKraken } from "./kraken";

export const desk = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Desks" }).getByRole("button", { name });

/** The app on `name`'s desk ("Equities", the default, …), with Kraken answering from the stand-in. */
export async function openDesk(page: Page, name = "Equities"): Promise<FakeKraken> {
  const kraken = await fakeKraken(page);
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Equities" })).toBeVisible();
  if (name !== "Equities") {
    await desk(page, name).click();
    await expect(desk(page, name)).toHaveAttribute("aria-pressed", "true");
  }
  return kraken;
}
