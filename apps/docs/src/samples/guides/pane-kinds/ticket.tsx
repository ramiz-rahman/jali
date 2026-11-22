import { definePane } from "jali/react";
import { oneOf, optional } from "jali";

export const ticket = definePane("ticket", {
  params: { id: Number, tab: optional(oneOf("thread", "details")), internal: optional(Boolean) },
  title: ({ id }) => `Ticket ${id}`,
  identity: ({ id }) => id,
  Component: ({ params }) => <h3>Ticket {params.id}</h3>,
});

ticket({ id: 7 }); // the tab and the flag can be left out
ticket({ id: 7, tab: "details", internal: true });
