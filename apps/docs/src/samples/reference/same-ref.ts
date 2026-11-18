import { sameRef } from "@jali/core";

sameRef({ kind: "order", params: { id: 1041 } }, { kind: "order", params: { id: 1041 } }); // true
sameRef({ kind: "order", params: { id: 1041 } }, { kind: "order", params: { id: "1041" } }); // false: 1041 !== "1041"
sameRef(undefined, { kind: "order", params: {} }); // false
