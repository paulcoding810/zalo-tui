import { render } from "ink";
import { NOTIFY_MODES } from "./notify.ts";
import { Store } from "./store.ts";
import { trackTerminalFocus } from "./terminalFocus.ts";
import { App } from "./ui/App.tsx";
import type { ZaloClient } from "./zalo/client.ts";
import { loadSettings } from "./zalo/session.ts";

const store = new Store();
const { notify } = loadSettings();
if (notify && NOTIFY_MODES.includes(notify)) store.update((s) => ({ ...s, notify }));
const session: { client?: ZaloClient } = {};

const app = render(<App store={store} onClient={(c) => (session.client = c)} />, { alternateScreen: true });

const stopFocus = trackTerminalFocus((terminalFocused) => store.update((s) => ({ ...s, terminalFocused })));
process.on("exit", stopFocus);
process.on("SIGINT", () => app.unmount());
process.on("SIGTERM", () => app.unmount());

await app.waitUntilExit();
stopFocus();
session.client?.stop();
process.exit(0);
