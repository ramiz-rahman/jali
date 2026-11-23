/** Dollars to the cent: every fare, price and total in the trip is rounded with this one rule. */
export const cents = (n: number) => Math.round(n * 100) / 100;
