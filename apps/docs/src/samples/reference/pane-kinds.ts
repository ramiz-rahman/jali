import { createPaneKinds, type PaneKindBase } from "@jali/core";

// Framework-free kinds: what the workspace needs to know without the view.
const customer: PaneKindBase = {
  kind: "customer",
  title: (ref) => `Customer ${ref.params.id}`,
  ref: (params) => ({ kind: "customer", params }),
  identity: (ref) => String(ref.params.id),   // the same id is the same customer, whatever else the ref says
  minWidth: 300,
  minHeight: 200,
};

const kinds = createPaneKinds([customer]);

kinds.title({ kind: "customer", params: { id: 7 } });          // "Customer 7"
kinds.sameObject(
  { kind: "customer", params: { id: 7, tab: "notes" } },
  { kind: "customer", params: { id: "7" } },
);                                                               // true
kinds.registry().customer?.minWidth;                             // 300

// Late registration (an import that loads later, or hot reload) bumps the version.
kinds.register({ ...customer, kind: "invoice", title: (ref) => `Invoice ${ref.params.id}`, ref: (params) => ({ kind: "invoice", params }) });
kinds.version();                                                 // 1
