/**
 * The example apps, in one place: what each is, how to run it, and three things it shows about Jali, each a link
 * into the hosted app (jali.ramizrahman.com/apps/<id>/) in the state that shows it. The Examples pages draw from
 * this (src/docs/examples, one per app), so do their Markdown copies, and the public site's check opens every link
 * (e2e/site/showcase.spec.ts). The apps themselves are built by tooling/build-site.mjs, whose HOSTED list must match.
 */
import { REPO_BRANCH, REPO_URL } from "../site/config.ts";

export interface Shows {
  /** What it shows, as a short phrase ("A list and the detail that follows it"). */
  title: string;
  /** One or two sentences: what to do, and what Jali does. */
  text: string;
  /** The app's address for it, after /apps/<id>/: a preset, or a curated page's item and view. */
  link: string;
  /** A guide or Learn page about it. */
  learn?: string;
}

export interface ExampleApp {
  /** Its folder in examples/, and its path on the site (/apps/<id>/). */
  id: string;
  name: string;
  /** One sentence: what the app is. */
  summary: string;
  /** Its dev server's port. */
  port: number;
  /** Where its data comes from, in a sentence: the reader should know what is real and what is made up. */
  data: string;
  /** Three things it shows about Jali. */
  shows: [Shows, Shows, Shows];
  /** "dark" when the app opens dark whatever the system says: it has one screenshot, not one per theme. */
  opens?: "dark";
}

export const EXAMPLES: ExampleApp[] = [
  {
    id: "data-studio",
    name: "Data Studio",
    summary:
      "A database browser where the person builds the layout: tables, records, related records, SQL queries and charts, each in a pane.",
    port: 5300,
    data: "A sample database of shop orders and a home-lending book, running in the browser (PGlite), with no backend.",
    shows: [
      {
        title: "A list and the detail that follows it",
        text: "Move through the orders with J and K. The order beside the list follows, and its customer follows the order.",
        link: "?preset=order-chain",
        learn: "/learn/following",
      },
      {
        title: "Unsaved work in a pane",
        text: "Edit the SQL. The draft is pane state, an edit that hasn't run is unsaved work, and ⌘K gains Run query and Chart this result.",
        link: "?preset=query-chart",
        learn: "/guides/unsaved-work-and-pane-state",
      },
      {
        title: "Ten panes on one screen",
        text: "Narrow the window. Panes fold into tabs one at a time rather than squeeze, and come back as it widens.",
        link: "?preset=stress-10",
        learn: "/learn/fitting",
      },
    ],
  },
  {
    id: "loan-review",
    name: "Loan review",
    summary:
      "An underwriter works through a queue of mortgage applications, one curated page per application.",
    port: 5350,
    data: "The same in-browser database: a fictional US home lender's borrowers, properties, mortgages and applications.",
    shows: [
      {
        title: "A curated page",
        text: "The queue, the application's header and its views as tabs. Switch to Split view to see the views side by side, then rearrange them.",
        link: "?page=loan-review&item=4&tab=overview",
        learn: "/learn/curated-pages",
      },
      {
        title: "A link carries the content only",
        text: "This link names the application and the view. Single or Split view, and how the panes are arranged, stay the reader's own.",
        link: "?page=loan-review&item=7&tab=borrower",
        learn: "/learn/opening-and-linking",
      },
      {
        title: "What a persona may do",
        text: "The processor's links open as a peek, never beside: `allow: { open: false }`. Switch persona in the header.",
        link: "?page=loan-review&item=4&tab=borrower&role=processor",
        learn: "/guides/pane-kinds#choose-what-people-can-do-with-panes",
      },
    ],
  },
  {
    id: "markets",
    name: "Markets",
    summary:
      "A market terminal for shares, bonds, currencies, indices and crypto, laid out as desks.",
    port: 5320,
    opens: "dark",
    data: "Crypto prices stream live from Kraken's public API. Everything else runs on a simulated market: every company, ticker and price outside crypto is made up.",
    shows: [
      {
        title: "Followers of many kinds",
        text: "Move through the watchlist with J and K. The chart, quote, order book, trades and news all follow it, each in its own way.",
        link: "?preset=equities",
        learn: "/learn/following",
      },
      {
        title: "Keep one, compare with another",
        text: "One chart is kept, the other follows the watchlist. Press Following on any pane to keep what it shows.",
        link: "?preset=compare",
        learn: "/learn/following",
      },
      {
        title: "Live data that pauses out of sight",
        text: "The Crypto desk's panes are live. Fold one into a tab and it stops its subscription; show it again and it picks up.",
        link: "?preset=crypto",
        learn: "/guides/pane-kinds",
      },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    summary:
      "An audio session editor: a transcript that lights up word by word, a timeline, a mixer and markers, all following one playhead.",
    port: 5330,
    data: "Three real recordings: radio traffic from the Apollo 11 landing, a song from its multitrack masters, and a dinner-party conversation from a research corpus.",
    shows: [
      {
        title: "Every pane follows one playhead",
        text: "Press Space to play. The transcript lights each word as it is spoken; the timeline, library and markers follow the same playhead.",
        link: "?preset=edit",
        learn: "/learn/following",
      },
      {
        title: "Unsaved work that travels",
        text: "Press E on a segment to correct it. Mix has no transcript, so choosing it asks first; Review takes the transcript and its draft along.",
        link: "?preset=review",
        learn: "/guides/unsaved-work-and-pane-state",
      },
      {
        title: "Kept and following, side by side",
        text: "One segment is kept, the other follows the transcript's selection: two moments of the landing, read against each other.",
        link: "?preset=compare",
        learn: "/learn/following",
      },
    ],
  },
  {
    id: "trips",
    name: "Trips",
    summary:
      "A map-first planner for a week in Thailand: the days, each day's stops and travel, hotels to compare, and the budget, around a big map.",
    port: 5340,
    data: "Real sights, beaches and airports at their real places. Every hotel, restaurant and price is made up, and says so.",
    shows: [
      {
        title: "The map is the hub",
        text: "Pick a pin: the place pane and the day both show it. Move through the days with J and K, and the map frames each one.",
        link: "?preset=plan",
        learn: "/learn/following",
      },
      {
        title: "A row that scrolls sideways",
        text: "The whole week, every day at a comfortable width, in a row that scrolls instead of folding. Drag a stop from one day to another.",
        link: "?preset=days",
        learn: "/guides/layouts#rows-that-scroll-sideways",
      },
      {
        title: "Compare against a kept pane",
        text: "Two hotels side by side. The left one is kept; pick another and the right one shows it, read against the kept one.",
        link: "?preset=stay",
        learn: "/learn/following",
      },
    ],
  },
  {
    id: "handshake",
    name: "Handshake",
    summary:
      "A network lab with the course beside the tools: read packets layer by layer, measure your connection, and learn how it all works.",
    port: 5360,
    opens: "dark",
    data: "Bundled captures are generated, and say so. Your own .pcap files are read in the tab and never uploaded. Live measurements come from public endpoints, each named.",
    shows: [
      {
        title: "A lesson drives the tools",
        text: "Step through a lesson: each step selects a packet, a probe or a scan, and the tools beside it follow. Following, two deep.",
        link: "?preset=course",
        learn: "/learn/following",
      },
      {
        title: "Four followers of one packet",
        text: "Pick a packet: the dissection, the bytes, the layers and the sequence diagram each show it their own way.",
        link: "?preset=lab",
        learn: "/learn/following",
      },
      {
        title: "Another component system",
        text: "Built with CyberSpec's components, with Jali's frames, tabs and ⌘K set from CyberSpec's tokens.",
        link: "?preset=connection",
        learn: "/guides/theming",
      },
    ],
  },
];

/** An app's path on the site, with an address after it when given. */
export const appPath = (id: string, link = "") => `/apps/${id}/${link}`;

/** The app with this id; an unknown id is an error in the page that names it. */
export function appOf(id: string): ExampleApp {
  const app = EXAMPLES.find((a) => a.id === id);
  if (!app) throw new Error(`<ExampleApp id="${id}">: no such example in src/examples/data.ts`);
  return app;
}

/** The app's folder in the repository. */
/** The app's own page on this site: /examples/<id>. */
export const appPage = (id: string) => `/examples/${id}`;

export const sourceUrl = (id: string) => `${REPO_URL}/tree/${REPO_BRANCH}/examples/${id}`;
