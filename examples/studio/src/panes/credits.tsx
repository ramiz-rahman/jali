/**
 * Credits: where each session's audio and words came from, under which licence, and what was changed. Reached from
 * the library's credits key, the status line and ⌘K. The same credits are in CREDITS.md and licenses/.
 *
 * The conditions it keeps: NASA is credited as the source, with no insignia and no implied endorsement; the song's
 * CC BY 4.0 attribution names its creator, the licence and the changes; the dinner party keeps the CDLA's name and
 * link, the credit to its provider, and the notice that the files were modified.
 */
import { ScrollIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import { catalogueOf } from "../sessions/catalog";
import { clock, SESSIONS } from "../sessions/sessions";

function Credits() {
  return (
    <div className="pane-body credits">
      <div className="pane-label">
        <span>Credits and licences</span>
        <span className="pane-label-count">{SESSIONS.length}</span>
      </div>
      <div className="cr-sheets">
        {SESSIONS.map((s) => {
          const c = catalogueOf(s);
          return (
            <article key={s.id} className="cr-sheet paper" aria-labelledby={`credits-${s.id}`}>
              <header className="cr-head">
                <h3 id={`credits-${s.id}`}>{s.title}</h3>
                <span className="cr-source">
                  {c.source} · {clock(s.duration)} · {s.tracks.length} tracks
                </span>
              </header>
              <p className="cr-credit">{c.credit}</p>
              {c.notice ? (
                <p className="cr-notice" role="note">
                  <b>Modified.</b> {s.credits.modified ?? c.notice}
                </p>
              ) : null}
              <dl className="cr-fields">
                <div>
                  <dt>Licence</dt>
                  <dd>
                    <a href={c.licence.url} target="_blank" rel="noreferrer">
                      {c.licence.name}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{s.credits.sources.length > 1 ? "Sources" : "Source"}</dt>
                  <dd>
                    {s.credits.sources.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        {u.replace(/^https?:\/\//, "")}
                      </a>
                    ))}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
        <p className="cr-foot">
          The full credits, the licence texts and the scripts that built these sessions are in the example's
          CREDITS.md, licenses/ and scripts/audio/.
        </p>
      </div>
    </div>
  );
}

export const credits = definePane("credits", {
  title: () => "Credits",
  icon: ScrollIcon,
  width: { min: 320, comfortable: 480, max: 720 },
  height: { min: 240 },
  Component: Credits,
});
