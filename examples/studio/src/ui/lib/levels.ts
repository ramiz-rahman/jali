/**
 * Levels in dB, as the mix keeps them, the engine plays them and the faders and meters print them: one range for all.
 */

/** Silence: the fader's foot, and the floor of every meter. */
export const SILENCE_DB = -60;
/** The fader's top. */
export const MAX_DB = 6;

/** A level in dB as a gain to multiply by; silence is 0. */
export const dbToGain = (db: number) => (db <= SILENCE_DB ? 0 : 10 ** (db / 20));

/** A sample's magnitude as a level in dB, never below silence. */
export const gainToDb = (v: number) =>
  v <= 0.001 ? SILENCE_DB : Math.max(SILENCE_DB, 20 * Math.log10(v));

/** A level as a console prints it: "−∞" for silence, a sign, one decimal. */
export const dbLabel = (db: number) =>
  db <= SILENCE_DB ? "−∞" : `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(db).toFixed(1)}`;
