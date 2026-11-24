/** The site nav (src/site/nav.ts) with section headings and the current page marked. */
import { nav } from "../site/nav";

export function Nav({ path }: { path: string }) {
  return (
    <nav className="nav" aria-label="Docs">
      {nav.map((s) => (
        <section key={s.title} className="nav-section">
          <h2 className="nav-heading">{s.title}</h2>
          <ul className="nav-list">
            {s.items.map((i) => (
              <li key={i.path}>
                <a
                  className="nav-link"
                  href={i.path}
                  aria-current={i.path === path ? "page" : undefined}
                >
                  {i.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
