/** What an application is assessed on: the application, and what has loaded of who and what it is for. */
import type { Application, Borrower, Mortgage, Payment, Property } from "./rows";

/** An application's case. What isn't loaded yet is undefined, and what needs it waits for it. */
export interface Case {
  app: Application;
  borrower?: Borrower;
  property?: Property;
  mortgages?: Mortgage[];
  payments?: Payment[];
}
