/** Stand-in for your app's data layer, so the samples run on their own. In an app, read through your shared cache. */
export interface Ticket { id: number; subject: string; status: "open" | "waiting" | "closed"; customer: number }
export interface Customer { id: number; name: string; plan: string }
export interface Order { id: number; customer: number; total: number }

export const tickets: Ticket[] = [
  { id: 101, subject: "Refund not received", status: "open", customer: 7 },
  { id: 102, subject: "Change delivery address", status: "waiting", customer: 3 },
  { id: 103, subject: "Invoice shows the wrong plan", status: "open", customer: 7 },
  { id: 104, subject: "Cannot sign in", status: "closed", customer: 5 },
];
export const customers: Customer[] = [
  { id: 3, name: "Rahima Begum", plan: "Team" },
  { id: 5, name: "Tomas Lind", plan: "Starter" },
  { id: 7, name: "Ada Okafor", plan: "Business" },
];
export const orders: Order[] = [
  { id: 9001, customer: 7, total: 120 },
  { id: 9002, customer: 7, total: 48 },
  { id: 9003, customer: 3, total: 300 },
];

export const ticketById = (id: number) => tickets.find((t) => t.id === id);
export const customerById = (id: number) => customers.find((c) => c.id === id);

const notes = new Map<number, string>([[1, "Call the courier about order 9001."]]);
export const noteBody = (id: number) => notes.get(id) ?? "";
export const saveNote = (id: number, body: string) => void notes.set(id, body);
