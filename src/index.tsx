import { render } from "ink";
import pkg from "../package.json" with { type: "json" };
import { GROUP_NOTIFY_MODES, NOTIFY_MODES, setNotificationClick } from "./notify.ts";
import { listenForOpenRequests, openChatCommand, openRequestFile } from "./openRequest.ts";
import { Store } from "./store.ts";
import { trackTerminalFocus } from "./terminalFocus.ts";
import { trackMouseWheel } from "./terminalMouse.ts";
import { App } from "./ui/App.tsx";
import type { ZaloClient } from "./zalo/client.ts";
import { loadSettings, stateDir } from "./zalo/session.ts";

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(pkg.version);
  process.exit(0);
}

const store = new Store();
const { notify, notifyGroups } = loadSettings();
if (notify && NOTIFY_MODES.includes(notify)) store.update((s) => ({ ...s, notify }));
if (notifyGroups && GROUP_NOTIFY_MODES.includes(notifyGroups)) store.update((s) => ({ ...s, notifyGroups }));
const session: { client?: ZaloClient } = {};

const app = render(<App store={store} onClient={(c) => (session.client = c)} />, { alternateScreen: true });

const stopFocus = trackTerminalFocus((terminalFocused) => store.update((s) => ({ ...s, terminalFocused })));
const stopMouse = trackMouseWheel();
const requestFile = openRequestFile(stateDir);
setNotificationClick((key) => openChatCommand(key, requestFile));
const stopOpenRequests = listenForOpenRequests(requestFile, (key) =>
  store.update((s) => ({ ...s, openRequest: { key, seq: (s.openRequest?.seq ?? 0) + 1 } })),
);
process.on("exit", () => {
  stopFocus();
  stopMouse();
  stopOpenRequests();
});
process.on("SIGINT", () => app.unmount());
process.on("SIGTERM", () => app.unmount());

await app.waitUntilExit();
stopFocus();
stopMouse();
session.client?.stop();
process.exit(0);
