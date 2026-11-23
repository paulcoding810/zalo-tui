import { Box, Text, useInput, useWindowSize } from "ink";
import { useEffect, useMemo, useState } from "react";
import { LoginQRCallbackEventType } from "zca-js";
import { renderQR, type RenderedQR } from "../qr.ts";
import { nextNotifyMode } from "../notify.ts";
import { openThread, sortedThreads, type Store } from "../store.ts";
import { ZaloClient } from "../zalo/client.ts";
import { loadCredentials, loginWithQR, qrPath, restore, saveCredentials, saveSettings } from "../zalo/session.ts";
import { ChatList } from "./ChatList.tsx";
import { Composer } from "./Composer.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import { MessagePane } from "./MessagePane.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { StoreContext, useStoreState } from "./useStore.ts";

type Focus = "list" | "input";

type Phase = "restoring" | "login" | "loading" | "chat" | "error";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App({ store, onClient }: { store: Store; onClient: (client: ZaloClient) => void }) {
  const [phase, setPhase] = useState<Phase>("restoring");
  const [attempt, setAttempt] = useState(0);
  const [qr, setQr] = useState<RenderedQR | null>(null);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState("");
  const [client, setClient] = useState<ZaloClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    const enter = async (api: Awaited<ReturnType<typeof restore>>) => {
      setPhase("loading");
      const c = new ZaloClient(api, store);
      onClient(c);
      await c.init();
      if (cancelled) return;
      setClient(c);
      setPhase("chat");
    };

    (async () => {
      const saved = attempt === 0 ? loadCredentials() : null;
      if (saved) {
        try {
          return await enter(await restore(saved));
        } catch {
          setNotice("Saved session is no longer valid. Log in again.");
        }
      }
      setPhase("login");
      setQr(null);
      setStatus("");
      const api = await loginWithQR(async (event) => {
        switch (event.type) {
          case LoginQRCallbackEventType.QRCodeGenerated:
            setStatus("Waiting for scan…");
            setQr(await renderQR(event.data.image, qrPath));
            break;
          case LoginQRCallbackEventType.QRCodeExpired:
            setStatus("QR code expired, getting a new one…");
            setQr(null);
            event.actions.retry();
            break;
          case LoginQRCallbackEventType.QRCodeScanned:
            setStatus(`Scanned by ${event.data.display_name}. Confirm the login on your phone.`);
            break;
          case LoginQRCallbackEventType.QRCodeDeclined:
            setStatus("Login declined on the phone.");
            break;
          case LoginQRCallbackEventType.GotLoginInfo:
            saveCredentials({ cookie: event.data.cookie, imei: event.data.imei, userAgent: event.data.userAgent });
            setStatus("Logged in, loading chats…");
            break;
        }
      });
      await enter(api);
    })().catch((e) => {
      if (cancelled) return;
      setError(errorMessage(e));
      setPhase("error");
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useInput((input) => {
    if (phase === "error" && input === "r") {
      setError("");
      setAttempt((a) => a + 1);
    }
  });

  if (phase === "restoring") return <Text dimColor>Restoring saved session…</Text>;
  if (phase === "login") return <LoginScreen qr={qr} status={status} notice={notice} />;
  if (phase === "error") return <ErrorScreen message={error} />;
  if (phase === "loading" || !client) return <Text dimColor>Loading friends and groups…</Text>;
  return (
    <StoreContext.Provider value={store}>
      <ChatScreen store={store} client={client} />
    </StoreContext.Provider>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="red">Login failed: {message}</Text>
      <Text dimColor>r to try again · Ctrl+C to quit</Text>
    </Box>
  );
}

export function ChatScreen({ store, client }: { store: Store; client: ZaloClient }) {
  const state = useStoreState();
  const { columns, rows } = useWindowSize();
  const [focus, setFocus] = useState<Focus>("list");
  const [toast, setToast] = useState<string>();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [scroll, setScroll] = useState(0);
  const [sendError, setSendError] = useState<string>();

  const threads = useMemo(() => sortedThreads(state, filter), [state.threads, filter]);
  const found = threads.findIndex((t) => t.key === selectedKey);
  const selected = found === -1 ? 0 : found;
  const active = state.activeKey ? state.threads[state.activeKey] ?? null : null;
  const messages = state.activeKey ? state.messages[state.activeKey] ?? [] : [];

  const paneHeight = Math.max(3, rows - 4);
  const sidebarWidth = Math.max(18, Math.min(32, Math.floor(columns / 3)));
  const pageSize = Math.max(1, paneHeight - 2);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? undefined : t)), 2500);
  };

  const open = (key: string) => {
    store.update((s) => openThread(s, key));
    setScroll(0);
    setSendError(undefined);
    setFocus("input");
    void client.loadHistory(key);
  };

  useInput((input, key) => {
    if (key.pageUp) return setScroll((s) => s + pageSize);
    if (key.pageDown) return setScroll((s) => Math.max(0, s - pageSize));
    if (key.tab) {
      if (focus === "list" && state.activeKey) setFocus("input");
      else setFocus("list");
      return;
    }
    if (focus === "input") {
      if (key.escape) setFocus("list");
      return;
    }
    if (filtering) {
      if (key.escape) {
        setFilter("");
        setFiltering(false);
      } else if (key.return) {
        setFiltering(false);
      } else if (key.backspace || key.delete) {
        setFilter((f) => Array.from(f).slice(0, -1).join(""));
      } else if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
        setFilter((f) => f + input);
      }
      if (!key.upArrow && !key.downArrow) return;
    }
    if (key.upArrow) return setSelectedKey(threads[Math.max(0, selected - 1)]?.key ?? null);
    if (key.downArrow) return setSelectedKey(threads[Math.min(threads.length - 1, selected + 1)]?.key ?? null);
    if (key.return) {
      const t = threads[selected];
      if (t) open(t.key);
      return;
    }
    if (input === "/") return setFiltering(true);
    if (key.escape) return setFilter("");
    if (input === "n") {
      const notify = nextNotifyMode(state.notify);
      store.update((s) => ({ ...s, notify }));
      saveSettings({ notify });
      return flash(`notifications: ${notify === "sender" ? "sender only" : notify}`);
    }
    if (input === "r" && state.connection.state === "closed") client.connect();
  });

  const submit = async (text: string): Promise<boolean> => {
    if (!state.activeKey) return false;
    try {
      await client.send(state.activeKey, text);
      setSendError(undefined);
      setScroll(0);
      return true;
    } catch (e) {
      setSendError(`send failed: ${errorMessage(e)}`);
      return false;
    }
  };

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box>
        <ChatList
          threads={threads}
          selected={selected}
          activeKey={state.activeKey}
          unread={state.unread}
          filter={filter}
          filtering={filtering}
          focused={focus === "list"}
          width={sidebarWidth}
          height={paneHeight}
        />
        <MessagePane
          thread={active}
          messages={messages}
          scroll={scroll}
          width={columns - sidebarWidth}
          height={paneHeight}
        />
      </Box>
      <Composer active={focus === "input"} enabled={!!active} error={sendError} onSubmit={submit} />
      <StatusBar connection={state.connection} selfName={state.selfName} focus={focus} notify={state.notify} toast={toast} />
    </Box>
  );
}
