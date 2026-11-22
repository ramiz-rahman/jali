// app/notes/page.tsx: a server component. It passes the request's search to the client component, so the server
// renders the layout the link names.
import { Panes } from "./panes";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  return (
    <main style={{ height: "100dvh" }}>
      <Panes search={params.size ? `?${params}` : ""} />
    </main>
  );
}
