/** A customer's portrait in a circle. Decorative: their name is always written beside it. */
import { photoOf, type Customer } from "../data";

export function Avatar({ customer, size }: { customer: Customer; size: number }) {
  return <img className="live-avatar" src={photoOf(customer)} alt="" width={size} height={size} />;
}
