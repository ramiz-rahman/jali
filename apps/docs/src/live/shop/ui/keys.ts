/** How a key is written for this reader: Mac keyboards say ⌥ for Alt. Read on use (a menu opened by the reader). */
export const altKeyLabel = () => (/Mac|iP(hone|ad)/.test(navigator.platform) ? "⌥" : "Alt+");
