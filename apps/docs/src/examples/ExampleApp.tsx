/**
 * The example apps, as parts the Examples pages arrange (src/docs/examples): the overview's grid of the six
 * (`<ExampleIndex />`), and on each app's own page its screenshot and the buttons that open it (`<ExampleShot>`),
 * the three things it shows, each a link into the app in that state (`<ExampleShows>`), what its data is
 * (`<ExampleData>`) and how to run it (`<ExampleRun>`), each under the page's own heading. The home page has the
 * showcase (`<ExampleShowcase />`). Rendered at build time; the Markdown copies get the same from ./markdown.ts.
 */
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  GithubLogoIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { publicFile } from "../ui/lib/public-files";
import { withCode } from "../ui/lib/with-code";
import { EXAMPLES, appPage, appPath, appOf, sourceUrl } from "./data";

const shot = (id: string, theme: "light" | "dark") => `/media/examples/${id}-${theme}.webp`;

/** The app's screenshot, in the site's theme where it has both, as an image. */
function Shot({ id, alt }: { id: string; alt: string }) {
  const app = appOf(id);
  const both = app.opens !== "dark" && !!publicFile(shot(id, "dark"));
  return (
    <>
      <img
        src={shot(id, "light")}
        alt={alt}
        width={1440}
        height={900}
        loading="lazy"
        decoding="async"
        data-shot={both ? "light" : undefined}
      />
      {both ? (
        <img
          src={shot(id, "dark")}
          alt={alt}
          width={1440}
          height={900}
          loading="lazy"
          decoding="async"
          data-shot="dark"
        />
      ) : null}
    </>
  );
}

/** The six apps, for the overview: a picture, the name and one line each, linking to the app's page. */
export function ExampleIndex() {
  return (
    <ul className="example-index" aria-label="The example apps">
      {EXAMPLES.map((app) => (
        // The old one-page Examples addressed each app by its id (/examples#trips): those links land here.
        <li key={app.id} id={app.id}>
          <a className="example-card" href={appPage(app.id)}>
            <span className="example-card-shot">
              <Shot id={app.id} alt="" />
            </span>
            <span className="example-card-name">
              {app.name}
              <ArrowRightIcon aria-hidden size={15} />
            </span>
            <span className="example-card-text">{app.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The app's screenshot, which opens it, with Open and Source under it. */
export function ExampleShot({ id }: { id: string }) {
  const app = appOf(id);
  const open = appPath(id, app.shows[0].link);
  return (
    <div className="example">
      <a className="example-shot" href={open} aria-label={`Open ${app.name}`}>
        <Shot id={id} alt="" />
      </a>
      <div className="example-actions">
        <a className="button button-primary" href={open}>
          Open {app.name}
          <ArrowRightIcon aria-hidden size={16} weight="bold" />
        </a>
        <a className="button button-quiet" href={sourceUrl(id)}>
          <GithubLogoIcon aria-hidden size={16} />
          Source
        </a>
      </div>
    </div>
  );
}

/** Three things the app shows about Jali, each a link that opens the app in the state that shows it. */
export function ExampleShows({ id }: { id: string }) {
  const app = appOf(id);
  return (
    <ol className="example-shows" aria-label={`What ${app.name} shows`}>
      {app.shows.map((s) => (
        <li key={s.title}>
          <a className="example-show-title" href={appPath(id, s.link)}>
            {s.title}
            <ArrowUpRightIcon aria-hidden size={14} />
          </a>
          <span className="example-show-text">
            {withCode(s.text)}
            {s.learn ? (
              <>
                {" "}
                <a href={s.learn}>How it works</a>
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Where the app's data comes from: what is real and what is made up. */
export function ExampleData({ id }: { id: string }) {
  return <p>{appOf(id).data}</p>;
}

/** The command that runs the app locally, and its address. */
export function ExampleRun({ id }: { id: string }) {
  const app = appOf(id);
  return (
    <p>
      Run <code className="inline-code">pnpm {id}</code> at the repository&apos;s root, then open{" "}
      <a href={`http://localhost:${app.port}`}>localhost:{app.port}</a>.
    </p>
  );
}

/**
 * The home page's showcase: the six apps side by side as leaves, one open and five folded to a spine, the way a pane
 * folds when its row runs out of room. A spine opens its app and folds the one that was open. The page tool beside it
 * (./showcase.client.ts) does the opening, the arrows and 1 to 6, and a tour that opens each in turn until the reader
 * takes over.
 */
export function ExampleShowcase() {
  return (
    <div className="shelf" data-shelf data-auto="off">
      <div className="shelf-row">
        {EXAMPLES.map((app, i) => {
          const open = appPath(app.id, app.shows[0].link);
          return (
            <div
              key={app.id}
              className="leaf"
              data-leaf={app.id}
              data-open={i === 0 ? "" : undefined}
            >
              <a
                className="leaf-shot"
                href={open}
                tabIndex={i === 0 ? 0 : -1}
                aria-label={`Open ${app.name}`}
              >
                <Shot id={app.id} alt={`${app.name}, running`} />
              </a>
              <button
                type="button"
                className="leaf-spine"
                aria-expanded={i === 0}
                aria-controls={`shelf-${app.id}`}
                aria-label={app.name}
                tabIndex={i === 0 ? 0 : -1}
                data-key={i + 1}
              >
                <span className="leaf-number" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="leaf-name" aria-hidden>
                  {app.name}
                </span>
              </button>
              <span className="leaf-progress" aria-hidden />
            </div>
          );
        })}
      </div>
      {EXAMPLES.map((app, i) => {
        const open = appPath(app.id, app.shows[0].link);
        return (
          <div
            key={app.id}
            id={`shelf-${app.id}`}
            className="shelf-caption"
            hidden={i !== 0}
            data-caption={app.id}
          >
            <div className="shelf-text">
              <p className="shelf-name">
                <span className="shelf-count">
                  {String(i + 1).padStart(2, "0")} / {String(EXAMPLES.length).padStart(2, "0")}
                </span>
                {app.name}
              </p>
              <p className="shelf-summary">{app.summary}</p>
            </div>
            <div className="showcase-actions">
              <a className="button button-primary" href={open}>
                Open {app.name}
                <ArrowRightIcon aria-hidden size={16} weight="bold" />
              </a>
              <a className="button button-quiet" href={appPage(app.id)}>
                What it shows
              </a>
            </div>
          </div>
        );
      })}
      <p className="shelf-keys">
        <span>
          <kbd>←</kbd> <kbd>→</kbd> or <kbd>1</kbd>–<kbd>6</kbd> to switch
        </span>
        <button type="button" className="shelf-tour" data-shelf-tour hidden>
          <PauseIcon aria-hidden size={13} weight="fill" data-when="on" />
          <PlayIcon aria-hidden size={13} weight="fill" data-when="off" />
          <span data-when="on">Pause the tour</span>
          <span data-when="off">Play the tour</span>
        </button>
      </p>
    </div>
  );
}
