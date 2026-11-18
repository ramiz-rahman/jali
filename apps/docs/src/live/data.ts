/** A small, believable shop: the objects the demo panes show. Static, so every live part on a page agrees. */

export type OrderStatus = "Paid" | "Packed" | "Shipped" | "Refunded";

export interface Customer {
  id: number;
  name: string;
  email: string;
  city: string;
  since: string;
  plan: "Retail" | "Wholesale";
}

export interface OrderLine { item: string; qty: number; price: number }

export interface Order {
  id: number;
  customer: number;
  placed: string;
  status: OrderStatus;
  lines: OrderLine[];
}

export const customers: Customer[] = [
  { id: 7, name: "Amara Okafor", email: "amara@northwind.co", city: "Leeds", since: "Mar 2021", plan: "Wholesale" },
  { id: 12, name: "Tomás Ruiz", email: "tomas.ruiz@mail.es", city: "Valencia", since: "Aug 2023", plan: "Retail" },
  { id: 19, name: "Mei Lin", email: "mei@lin-studio.com", city: "Singapore", since: "Jan 2022", plan: "Retail" },
  { id: 23, name: "Jonas Berg", email: "jonas@berg.no", city: "Bergen", since: "Nov 2020", plan: "Wholesale" },
  { id: 31, name: "Priya Nair", email: "priya.nair@post.in", city: "Kochi", since: "May 2024", plan: "Retail" },
];

export const orders: Order[] = [
  { id: 1048, customer: 7, placed: "Today, 09:12", status: "Paid", lines: [{ item: "Linen apron", qty: 12, price: 18 }, { item: "Oak board", qty: 6, price: 34 }] },
  { id: 1047, customer: 12, placed: "Today, 08:40", status: "Packed", lines: [{ item: "Stoneware mug", qty: 2, price: 16 }] },
  { id: 1046, customer: 19, placed: "Yesterday", status: "Shipped", lines: [{ item: "Tea towel set", qty: 1, price: 24 }, { item: "Butter dish", qty: 1, price: 29 }] },
  { id: 1045, customer: 23, placed: "Yesterday", status: "Shipped", lines: [{ item: "Cast iron pan", qty: 4, price: 62 }] },
  { id: 1044, customer: 7, placed: "Mon 11 Nov", status: "Refunded", lines: [{ item: "Glass carafe", qty: 3, price: 22 }] },
  { id: 1043, customer: 31, placed: "Mon 11 Nov", status: "Shipped", lines: [{ item: "Bread knife", qty: 1, price: 45 }, { item: "Oak board", qty: 1, price: 34 }] },
  { id: 1042, customer: 12, placed: "Sun 10 Nov", status: "Shipped", lines: [{ item: "Linen napkins", qty: 8, price: 7 }] },
  { id: 1041, customer: 19, placed: "Sat 9 Nov", status: "Shipped", lines: [{ item: "Stoneware bowl", qty: 4, price: 19 }] },
];

export const notes: Record<number, { who: string; when: string; text: string }[]> = {
  7: [
    { who: "Sam", when: "2 h", text: "Wants the aprons before the café opens on Friday. Offered courier." },
    { who: "Ines", when: "Mon", text: "Refund on 1044 done: one carafe arrived cracked." },
  ],
  12: [{ who: "Sam", when: "Tue", text: "Asked about gift wrap for the mugs." }],
  19: [{ who: "Ines", when: "Sat", text: "Prefers email over phone." }],
  23: [{ who: "Ola", when: "Oct", text: "Annual wholesale terms renew in December." }],
  31: [{ who: "Sam", when: "Mon", text: "First order. Sent the welcome card." }],
};

export const activity = [
  { when: "09:12", text: "Order 1048 placed", tone: "accent" as const },
  { when: "08:55", text: "Payment captured for 1047", tone: "done" as const },
  { when: "08:40", text: "Order 1047 placed", tone: "accent" as const },
  { when: "Yesterday", text: "1046 handed to courier", tone: "muted" as const },
  { when: "Yesterday", text: "1045 handed to courier", tone: "muted" as const },
  { when: "Mon", text: "Refund issued for 1044", tone: "warn" as const },
];

export const orderById = (id: number | string) => orders.find((o) => o.id === Number(id));
export const customerById = (id: number | string) => customers.find((c) => c.id === Number(id));
export const totalOf = (o: Order) => o.lines.reduce((t, l) => t + l.qty * l.price, 0);
export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const ordersOf = (customer: number) => orders.filter((o) => o.customer === customer);
