/**
 * The example apps, as parts the Examples pages arrange (src/docs/examples): the overview's grid of the six
 * (`<ExampleIndex />`), and on each app's own page its screenshot and the buttons that open it (`<ExampleShot>`),
 * the three things it shows, each a link into the app in that state (`<ExampleShows>`), what its data is
 * (`<ExampleData>`) and how to run it (`<ExampleRun>`), each under the page's own heading. The home page has the
 * showcase (`<ExampleShowcase />`). Rendered at build time; the Markdown copies get the same from markdown.ts.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ArrowRightIcon, ArrowUpRightIcon, GithubLogoIcon } from "@phosphor-icons/react";
import { Fragment, type ReactNode } from "react";
import { TabSet } from "../shell/mdx";
import { EXAMPLES, appPage, appPath, appOf, sourceUrl } from "./data";

const PUBLIC = [join(process.cwd(), "public"), join(process.cwd(), "apps/docs/public")].find(
  existsSync,
);
const shot = (id: string, theme: "light" | "dark") => `/media/examples/${id}-${theme}.webp`;
const hasShot = (src: string) => !!PUBLIC && existsSync(join(PUBLIC, src));

/** Text with `code` spans, as the data writes them. */
function Inline({ text }: { text: string }): ReactNode {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      part.startsWith("`") ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/** The app's screenshot, in the site's theme where it has both, as an image. */
function Shot({ id, alt }: { id: string; alt: string }) {
  const app = appOf(id);
  const both = app.opens !== "dark" && hasShot(shot(id, "dark"));
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
            <Inline text={s.text} />
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
 * The six apps on the home page: a tab per app over one large screenshot, and under it what the app is, Open and its
 * part of the Examples page. The site's tabs (enhance.ts) switch them, so it needs no React in the browser.
 */
export function ExampleShowcase() {
  return (
    <TabSet
      label="Example apps"
      tabs={EXAMPLES.map((app) => {
        const both = app.opens !== "dark" && hasShot(shot(app.id, "dark"));
        const open = appPath(app.id, app.shows[0].link);
        return {
          label: app.name,
          panel: (
            <>
              <a className="showcase-shot" href={open} aria-label={`Open ${app.name}`}>
                <img
                  src={shot(app.id, "light")}
                  alt={`${app.name}, running`}
                  width={1440}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  data-shot={both ? "light" : undefined}
                />
                {both ? (
                  <img
                    src={shot(app.id, "dark")}
                    alt={`${app.name}, running`}
                    width={1440}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    data-shot="dark"
                  />
                ) : null}
              </a>
              <div className="showcase-caption">
                <p className="showcase-summary">{app.summary}</p>
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
            </>
          ),
        };
      })}
      panelClass="showcase-panel"
      render={(strip, panels) => (
        <div className="showcase" data-tabs="">
          {strip}
          {panels}
        </div>
      )}
    />
  );
}
