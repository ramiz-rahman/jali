/** Collateral: LTV (or CLTV) against the program's limit, the appraisal, flood zone, condo and mortgage insurance. */
import type { Case } from "../case";
import { guidelines, isPurchase, isSecondLien, maxLtv } from "../programs";
import { inFloodZone, LIMIT_TOLERANCE } from "../underwriting";
import { pct, usd } from "../words";
import type { AreaCheck, Finding } from ".";

export const collateral: AreaCheck = ({ app, property }: Case, qualifying) => {
  if (!qualifying || !property) return [];
  const cap = maxLtv(app);
  const secondLien = isSecondLien(app);
  const ratio = qualifying.limitedLtv;
  const name = secondLien ? "CLTV" : "LTV";
  const over = ratio > cap + LIMIT_TOLERANCE;
  const out: Finding[] = [
    {
      id: "ltv",
      // At a no-down-payment program's 100% is how it is meant to be used, not a squeeze.
      tone: over ? "risk" : cap >= 1 ? "info" : ratio > cap - 0.02 ? "warn" : "ok",
      text: over ? `${name} ${pct(ratio)} is over the ${pct(cap)} limit` : `${name} ${pct(ratio)}`,
      detail: secondLien
        ? `${usd(qualifying.behind)} first mortgage stays · limit ${pct(cap)}`
        : `On ${usd(qualifying.basis)} · limit ${pct(cap)}`,
    },
  ];
  const price = app.purchase_price_cents;
  if (isPurchase(app) && price != null && property.value_cents < price)
    out.push({
      id: "appraisal",
      tone: "warn",
      text: `Appraised ${usd(price - property.value_cents)} under price`,
      detail: `${usd(property.value_cents)} against a ${usd(price)} contract`,
    });
  if (inFloodZone(property))
    out.push({
      id: "flood",
      tone: "warn",
      text: `Flood zone ${property.flood_zone}`,
      detail: "Flood insurance required: not yet in the payment",
    });
  if (property.property_type === "Condominium")
    out.push({
      id: "condo",
      tone: "info",
      text: "Condominium",
      detail: `Project review and HOA questionnaire · ${usd(property.monthly_hoa_cents)} a month dues`,
    });
  const insurance = guidelines(app.program).insurance;
  if (insurance && qualifying.housing.mortgageInsurance) {
    const forLife =
      insurance.kind === "premium" &&
      insurance.lifeAboveLtv !== undefined &&
      qualifying.ltv > insurance.lifeAboveLtv;
    out.push({
      id: "mi",
      tone: "info",
      text: insurance.label,
      detail: `${usd(qualifying.housing.mortgageInsurance)} a month${forLife ? ", for the life of the loan" : ""}`,
    });
  }
  return out;
};
