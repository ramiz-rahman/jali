/**
 * The loan itself: the conforming limit, what a refinance saves or takes out, what a second lien keeps, occupancy
 * and an adjustable rate.
 */
import type { Case } from "../case";
import { guidelines, isLine, isSecondLien } from "../programs";
import type { Application } from "../rows";
import { CONFORMING_LIMIT_CENTS, type Qualifying } from "../underwriting";
import { rate, rateKind, usd } from "../words";
import type { AreaCheck, Finding } from ".";

export const loan: AreaCheck = ({ app }: Case, qualifying) =>
  [
    limit(app),
    qualifying && refinance(app, qualifying),
    qualifying && secondLien(app, qualifying),
    app.occupancy !== "Primary residence"
      ? {
          id: "occupancy",
          tone: "info",
          text: app.occupancy,
          detail:
            app.occupancy === "Investment"
              ? "Rental income: lease and Form 1007 rent schedule"
              : "Borrower keeps a primary home: both payments count",
        }
      : undefined,
    app.rate_type.kind === "arm" && app.purpose !== "Rate-and-term refinance"
      ? {
          id: "arm",
          tone: "info",
          text: rateKind(app),
          detail: `Qualified at the note rate; adjusts after ${app.rate_type.fixedYears} years`,
        }
      : undefined,
  ].filter((f): f is Finding => !!f);

/** A loan the conforming limit puts in the wrong program: over it but meant to stay within, or under it but jumbo. */
function limit(app: Application): Finding | undefined {
  const over = app.amount_cents - CONFORMING_LIMIT_CENTS;
  const policy = guidelines(app.program).conforming;
  if (policy === "within" && over > 0)
    return {
      id: "limit",
      tone: "risk",
      text: "Above the conforming limit",
      detail: `${usd(over)} over ${usd(CONFORMING_LIMIT_CENTS)}: price as jumbo`,
    };
  if (policy !== "above") return undefined;
  return over <= 0
    ? {
        id: "limit",
        tone: "warn",
        text: "Within the conforming limit",
        detail: "Could be a conventional loan",
      }
    : {
        id: "limit",
        tone: "info",
        text: `Jumbo by ${usd(over)}`,
        detail: `Over the ${usd(CONFORMING_LIMIT_CENTS)} conforming limit`,
      };
}

/** What a rate-and-term refinance saves a month, or what a cash-out takes out and gives up. */
function refinance(app: Application, qualifying: Qualifying): Finding | undefined {
  const { paysOff, payoff } = qualifying;
  if (app.purpose === "Rate-and-term refinance" && paysOff.length) {
    const was = paysOff.reduce((sum, m) => sum + m.monthly_payment_cents, 0);
    const now = qualifying.housing.principalInterest;
    const old = paysOff[0]!;
    return {
      id: "benefit",
      tone: now < was ? "ok" : "warn",
      text: now < was ? `Saves ${usd(was - now)} a month` : `Costs ${usd(now - was)} more a month`,
      detail: `${rate(old.note_rate)} → ${rate(app.note_rate)}${app.rate_type.kind !== "fixed" ? `, now a ${rateKind(app)}` : ""}${old.program !== app.program ? `, ${old.program} to ${app.program}` : ""}`,
    };
  }
  if (app.purpose === "Cash-out refinance") {
    const first = paysOff.find((m) => m.lien_position === 1);
    return {
      id: "cashout",
      tone: first && first.note_rate < app.note_rate - 1.5 ? "warn" : "info",
      text: `${usd(qualifying.cashOut)} cash out`,
      detail: first
        ? `Pays off ${usd(payoff)}, giving up a ${rate(first.note_rate)} rate for ${rate(app.note_rate)}`
        : `Pays off ${usd(payoff)}`,
    };
  }
  return undefined;
}

/** The first mortgage a second lien stays behind. */
function secondLien(app: Application, qualifying: Qualifying): Finding | undefined {
  const { staysBehind } = qualifying;
  if (!isSecondLien(app) || !staysBehind.length) return undefined;
  const first = staysBehind.find((m) => m.lien_position === 1) ?? staysBehind[0]!;
  const line = isLine(app);
  return {
    id: "second",
    tone: "info",
    text: `Keeps the ${rate(first.note_rate)} first mortgage`,
    detail: `${line ? "Line" : "Loan"} of ${usd(app.amount_cents)} behind it${line ? ", qualified on interest on the full line" : ""}`,
  };
}
