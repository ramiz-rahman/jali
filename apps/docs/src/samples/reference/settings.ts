import { store } from "./store";

// The person's settings: saved on this device. The theme goes to <html>, and a new pane cap refits the layout.
store.actions.changeSettings({ theme: "dark", paneCap: 6 });
store.get().settings.paneCap; // 6
