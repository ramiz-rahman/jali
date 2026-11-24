"use client";
// app/notes/panes.tsx: a client component. The instance is made here, once per render tree, never in a server
// component (it holds functions and can't be passed from server to client).
import { useState } from "react";
import { createJali, memoryLocation, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import { defaultFeatures } from "jali-layout/features";
import { urlSync } from "jali-layout/url";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <article>Note {params.id}</article>,
});

export function Panes({ search }: { search: string }) {
  const [jali] = useState(() =>
    createJali({
      panes: [note],
      layout: row(note({ id: 1 }), note({ id: 2 })),
      features: [
        ...defaultFeatures(),
        // On the server, the request's address; in the browser, the browser's.
        urlSync(typeof window === "undefined" ? { location: memoryLocation(search) } : {}),
      ],
      // The first render fits this size on both sides, so the HTML matches; <JaliRoot> then measures the real one.
      size: { width: 1280, height: 800 },
    }),
  );
  return <JaliRoot jali={jali} aria-label="Notes" />;
}
