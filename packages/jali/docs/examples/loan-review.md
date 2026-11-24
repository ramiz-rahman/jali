# Loan review

An underwriter works through a queue of mortgage applications, one curated page per application.

[Open Loan review](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=overview) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/loan-review)

## What it shows

Each link opens Loan review in the state that shows it, so you can try it at once.

- **[A curated page](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=overview)**: The queue, the application's header and its views as tabs. Switch to Split view to see the views side by side, then rearrange them. ([how it works](https://jali.ramizrahman.com/learn/curated-pages))
- **[A link carries the content only](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=7&tab=borrower)**: This link names the application and the view. Single or Split view, and how the panes are arranged, stay the reader's own. ([how it works](https://jali.ramizrahman.com/learn/opening-and-linking))
- **[What a persona may do](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=borrower&role=processor)**: The processor's links open as a peek, never beside: `allow: { open: false }`. Switch persona in the header. ([how it works](https://jali.ramizrahman.com/guides/pane-kinds#choose-what-people-can-do-with-panes))

## Its data

The same in-browser database: a fictional US home lender's borrowers, properties, mortgages and applications.

## Run it yourself

Run `pnpm loan-review` at the repository's root, then open http://localhost:5350.
