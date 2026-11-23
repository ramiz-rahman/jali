/** The columns of a table of payments: what was due and when, and how it was paid. */
import type { Payment } from "../../model/rows";
import { day, usd } from "../../model/words";
import type { Col } from "../parts/layout";
import { Dash, StatusMark } from "../parts/marks";

export const paymentCols = {
  due: { key: "due", head: "Due", pri: 1, cell: (p) => day(p.due_on) },
  amount: { key: "amount", head: "Amount", pri: 1, num: true, cell: (p) => usd(p.amount_cents) },
  status: { key: "status", head: "Status", pri: 1, cell: (p) => <StatusMark status={p.status} /> },
  paid: {
    key: "paid",
    head: "Paid",
    pri: 2,
    cell: (p) => (p.paid_on ? day(p.paid_on) : <Dash />),
    brief: (p) => (p.paid_on ? `Paid ${day(p.paid_on)}` : null),
  },
} satisfies Record<string, Col<Payment>>;
