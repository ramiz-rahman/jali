/**
 * The sessions in the library, in its order: the landing first (the session a first visit opens on, and every layout
 * is designed with), then the song, then the dinner party. The catalogue (catalog.ts) and the loaders (load.ts) are
 * typed by this list, so a session missing from either is a type error, not a blank card.
 */
export const SESSION_IDS = [
  "apollo11-landing",
  "light-caught-by-the-stone",
  "dinner-party",
] as const;

export type SessionId = (typeof SESSION_IDS)[number];

/** The session a first visit opens on, and every layout is designed with. */
export const FIRST_SESSION: SessionId = "apollo11-landing";

/** Whether `id` names a session in the library: a link or a stored value can name anything. */
export const isSession = (id: unknown): id is SessionId =>
  typeof id === "string" && (SESSION_IDS as readonly string[]).includes(id);
