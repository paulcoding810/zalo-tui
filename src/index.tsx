import { render } from "ink";
import { Store } from "./store.ts";
import { App } from "./ui/App.tsx";
import type { ZaloClient } from "./zalo/client.ts";

const store = new Store();
const session: { client?: ZaloClient } = {};

const app = render(<App store={store} onClient={(c) => (session.client = c)} />, { alternateScreen: true });

process.on("SIGINT", () => app.unmount());
process.on("SIGTERM", () => app.unmount());

await app.waitUntilExit();
session.client?.stop();
process.exit(0);
