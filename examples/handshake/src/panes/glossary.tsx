/**
 * The glossary: every term the lessons link to, filterable, with the chosen term’s definition and the terms
 * related to it. A [[link]] in a lesson selects a `glossary` ref and this pane follows it; picking a term here
 * changes what the pane shows the same way, so the address always names the term.
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import { BookA } from "lucide-react";
import { definePane, type PaneProps } from "jali/react";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { ItemList } from "#src/vendor/cyberspec/components/ui/item-list.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { TextField } from "#src/vendor/cyberspec/components/ui/text-field.tsx";
import { filterTerms, GLOSSARY, termById } from "#src/course/glossary.ts";
import { listMove } from "./parts/list-keys";
import { InlineText } from "./parts/prose";
import { Empty } from "./parts/states";

const glossaryParams = { term: String };

function GlossaryView({ params, openHere }: PaneProps<typeof glossaryParams>) {
  const [query, setQuery] = useState("");
  const terms = useMemo(() => filterTerms(query), [query]);
  const term = termById(params.term);

  const open = (id: string) => {
    if (id !== params.term) openHere(glossary({ term: id }));
  };

  // J and K move through the list, as everywhere in the lab; the arrow keys are the list's own.
  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(
      e,
      terms.findIndex((t) => t.id === params.term),
      terms.length,
    );
    const next = to === null ? undefined : terms[to];
    if (!next) return;
    e.preventDefault();
    open(next.id);
  };

  return (
    <div className="glossary" onKeyDown={onKeyDown}>
      <div className="glossary-grid">
        <div className="glossary-list">
          <TextField
            label="Filter terms"
            value={query}
            onValueChange={setQuery}
            clearable
            autoComplete="off"
            spellCheck={false}
          />
          {terms.length ? (
            <ItemList
              label="Terms"
              compact
              activation="automatic"
              value={term && terms.some((t) => t.id === term.id) ? term.id : null}
              onValueChange={(v) => v && open(String(v))}
              items={terms.map((t) => ({ value: t.id, label: t.term }))}
            />
          ) : (
            <Empty title={`No term matches “${query}”`}>Try fewer letters, or an acronym.</Empty>
          )}
        </div>
        <div className="glossary-entry">
          {term ? (
            <Panel title={term.term} level={2} code="GLOSSARY" tone="signal">
              <p className="glossary-def">
                <InlineText text={term.def} onTerm={open} />
              </p>
              {term.ref ? (
                <p className="glossary-ref">
                  <Badge tone="mute">Standard</Badge> {term.ref}
                </p>
              ) : null}
              {term.related?.length ? (
                <div className="glossary-related">
                  <h3>Related</h3>
                  <ul>
                    {term.related.flatMap((id) => {
                      const r = termById(id);
                      return r
                        ? [
                            <li key={id}>
                              <Button size="sm" tone="ghost" onClick={() => open(id)}>
                                {r.term}
                              </Button>
                            </li>,
                          ]
                        : [];
                    })}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : (
            <Empty title={params.term ? `There is no term “${params.term}”` : "Choose a term"}>
              {GLOSSARY.length} terms, from ARP to the X25519 hybrid key exchange. Lessons link
              here: select any underlined word.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

export const glossary = definePane("glossary", {
  params: glossaryParams,
  title: ({ term }) => termById(term)?.term ?? "Glossary",
  icon: BookA,
  width: { min: 320, comfortable: 560 },
  height: { min: 240 },
  Component: GlossaryView,
});
