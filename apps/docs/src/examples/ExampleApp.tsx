/**
 * One example app on the Examples page (`<ExampleApp id="studio" />`, under the page's own `## Studio`): its
 * screenshot, what it is, a button that opens it, three things it shows (each a link into the app in that state), what
 * its data is, and how to run it. Rendered at build time; the Markdown copies get the same from markdown.ts.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ArrowRightIcon, ArrowUpRightIcon, GithubLogoIcon } from "@phosphor-icons/react";
import { Fragment, type ReactNode } from "react";
import { TabSet } from "../shell/mdx";
import { EXAMPLES, appPath, appOf, sourceUrl } from "./data";

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

export function ExampleApp({ id }: { id: string }) {
  const app = appOf(id);
  const light = shot(id, "light");
  const dark = shot(id, "dark");
  const both = app.opens !== "dark" && hasShot(dark);
  const open = appPath(id, app.shows[0].link);
  return (
    <div className="example" data-example={id}>
      <a className="example-shot" href={open} aria-label={`Open ${app.name}`}>
        <img
          src={light}
          alt=""
          width={1440}
          height={900}
          loading="lazy"
          decoding="async"
          data-shot={both ? "light" : undefined}
        />
        {both ? (
          <img
            src={dark}
            alt=""
            width={1440}
            height={900}
            loading="lazy"
            decoding="async"
            data-shot="dark"
          />
        ) : null}
      </a>
      <p className="example-summary">{app.summary}</p>
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
      <p className="example-data">{app.data}</p>
      <p className="example-run">
        Run it yourself: <code>pnpm {id}</code> at the repository's root, then{" "}
        <a href={`http://localhost:${app.port}`}>localhost:{app.port}</a>.
      </p>
    </div>
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
                  <a className="button button-quiet" href={`/examples#${app.id}`}>
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
