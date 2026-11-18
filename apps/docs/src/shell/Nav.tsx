/** The site nav (src/site/nav.ts) with section headings and the current page marked. Pages not yet written are listed, dimmed. */
import { resolvedNav } from "../site/sources";

export function Nav({ path, id }: { path: string; id?: string }) {
  const sections = resolvedNav();
  return (
    <nav className="nav" aria-label="Docs" id={id}>
      {sections.map((s) => (
        <section key={s.title} className="nav-section">
          <h2 className="nav-heading">{s.title}</h2>
          <ul className="nav-list">
            {s.items.map((i) => (
              <li key={i.path}>
                {i.exists ? (
                  <a className="nav-link" href={i.path} aria-current={i.path === path ? "page" : undefined}>{i.title}</a>
                ) : (
                  <span className="nav-link" data-pending="" title="Not written yet">{i.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
