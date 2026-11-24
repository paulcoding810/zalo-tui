import { Box, Text, useInput, useWindowSize } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoginQRCallbackEventType } from "zca-js";
import { statSync } from "node:fs";
import { basename } from "node:path";
import { parseAttachment, type AttachmentRequest } from "../attachment.ts";
import { renderQR, type RenderedQR } from "../qr.ts";
import { reactionIcon } from "../format.ts";
import { nextNotifyMode } from "../notify.ts";
import { openUrl } from "../open.ts";
import { openThread, sortedThreads, type Store } from "../store.ts";
import { ZaloClient } from "../zalo/client.ts";
import { loadCredentials, loginWithQR, qrPath, restore, saveCredentials, saveSettings } from "../zalo/session.ts";
import { ChatList } from "./ChatList.tsx";
import { Composer } from "./Composer.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import { MessagePane } from "./MessagePane.tsx";
import { navStep } from "./nav.ts";
import { StatusBar } from "./StatusBar.tsx";
import { StoreContext, useStoreState } from "./useStore.ts";

type Focus = "list" | "input" | "messages";

const PREVIEW_DELAY_MS = 300;

const PICKER = ["/-heart", "/-strong", ":>", ":o", ":-((", ":-h"];

type Phase = "restoring" | "login" | "loading" | "chat" | "error";

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type PendingAttachment = { key: string; text: string; request: AttachmentRequest; size: number };

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
  const [focus, setFocusState] = useState<Focus>("list");
  const [returnFocus, setReturnFocus] = useState<"list" | "messages">("list");
  const setFocus = (next: Focus) => {
    if (next === "input" && focus !== "input") setReturnFocus(focus === "messages" ? "messages" : "list");
    setFocusState(next);
  };
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const resolvePending = useRef<((ok: boolean) => void) | null>(null);
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

  const msgIndex = messages.findIndex((m) => m.id === selectedMsgId);
  const selectedMsg = focus === "messages" ? messages[msgIndex === -1 ? messages.length - 1 : msgIndex] : undefined;

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? undefined : t)), 2500);
  };

  const open = (key: string, focusInput: boolean) => {
    setSelectedKey(key);
    if (focusInput) setFocus("input");
    if (key === store.getState().activeKey) return;
    store.update((s) => openThread(s, key));
    setScroll(0);
    setSelectedMsgId(null);
    setSendError(undefined);
    void client.loadHistory(key);
  };

  const highlighted = threads[selected]?.key ?? null;
  useEffect(() => {
    if (!highlighted || highlighted === store.getState().activeKey) return;
    const timer = setTimeout(() => open(highlighted, false), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const react = (icon: string) => {
    const target = selectedMsg;
    setPicking(false);
    if (!target) return;
    client
      .react(target, icon)
      .then(() => flash(icon ? `reacted ${reactionIcon(icon)}` : "reaction removed"))
      .catch((e) => flash(`reaction failed: ${errorMessage(e)}`));
  };

  const sendAttachmentTo = async (key: string, request: AttachmentRequest): Promise<boolean> => {
    try {
      await client.sendAttachment(key, request);
      setSendError(undefined);
      setScroll(0);
      return true;
    } catch (e) {
      setSendError(`${request.kind} not sent: ${errorMessage(e)}`);
      return false;
    }
  };

  const sendTextTo = async (key: string, text: string): Promise<boolean> => {
    try {
      await client.send(key, text);
      setSendError(undefined);
      setScroll(0);
      return true;
    } catch (e) {
      setSendError(`send failed: ${errorMessage(e)}`);
      return false;
    }
  };

  const finishPending = (action: "send" | "text" | "cancel") => {
    const p = pending;
    const resolve = resolvePending.current;
    setPending(null);
    resolvePending.current = null;
    if (!p || !resolve) return;
    if (action === "cancel") return resolve(false);
    void (action === "send" ? sendAttachmentTo(p.key, p.request) : sendTextTo(p.key, p.text)).then(resolve);
  };

  const removeSelected = (mode: "recall" | "delete") => {
    const target = selectedMsg;
    setDeleting(false);
    if (!target) return;
    (mode === "recall" ? client.recall(target) : client.deleteForMe(target))
      .then(() => flash(mode === "recall" ? "recalled for everyone" : "deleted for you"))
      .catch((e) => flash(`${mode === "recall" ? "recall" : "delete"} failed: ${errorMessage(e)}`));
  };

  useInput((input, key) => {
    if (deleting) {
      if (key.escape) return setDeleting(false);
      if (input === "r" && selectedMsg?.isSelf) return removeSelected("recall");
      if (input === "d") return removeSelected("delete");
      return;
    }
    if (pending) {
      if (key.return) finishPending("send");
      else if (key.escape) finishPending("cancel");
      else if (input === "t") finishPending("text");
      return;
    }
    if (picking) {
      if (key.escape) return setPicking(false);
      if (input === "0") return react("");
      const icon = PICKER[Number(input) - 1];
      if (/^[1-9]$/.test(input) && icon) react(icon);
      return;
    }
    if (key.pageUp) return setScroll((s) => s + pageSize);
    if (key.pageDown) return setScroll((s) => Math.max(0, s - pageSize));
    if (key.tab) {
      setFocus(focus === "list" && state.activeKey ? "messages" : "list");
      return;
    }
    if (focus === "input") {
      if (key.escape) setFocus(returnFocus);
      return;
    }
    const half = Math.max(1, Math.floor(paneHeight / 2));
    if (focus === "messages") {
      const i = msgIndex === -1 ? messages.length - 1 : msgIndex;
      const next = navStep(input, key, i, messages.length, half);
      if (next !== null) return setSelectedMsgId(messages[next]?.id ?? null);
      if (key.return || input === "i") return setFocus("input");
      if (key.escape || input === "h") return setFocus("list");
      if (input === "e" && selectedMsg) return setPicking(true);
      if (input === "d" && selectedMsg && !selectedMsg.recalled) return setDeleting(true);
      if (input === "o") {
        if (selectedMsg?.url && openUrl(selectedMsg.url)) flash("opened in browser");
        else flash("nothing to open in this message");
      }
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
    const next = navStep(input, key, selected, threads.length, half);
    if (next !== null) return setSelectedKey(threads[next]?.key ?? null);
    if (input === "i" || input === "l") {
      if (!state.activeKey) flash("open a chat first");
      else setFocus(input === "i" ? "input" : "messages");
      return;
    }
    if (key.return) {
      const t = threads[selected];
      if (t) open(t.key, true);
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
    const key = state.activeKey;
    if (!key) return false;
    const parsed = parseAttachment(text, isFile);
    if (!parsed) return sendTextTo(key, text);
    if ("error" in parsed) {
      setSendError(parsed.error);
      return false;
    }
    if (!parsed.confirm) return sendAttachmentTo(key, parsed);
    return new Promise<boolean>((resolve) => {
      resolvePending.current = resolve;
      setPending({ key, text, request: parsed, size: statSync(parsed.path).size });
    });
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
          reactions={state.reactions}
          scroll={scroll}
          selectedId={selectedMsg?.id ?? null}
          focused={focus === "messages"}
          width={columns - sidebarWidth}
          height={paneHeight}
        />
      </Box>
      {pending ? (
        <Text wrap="truncate-end">
          <Text color="cyan">Send {pending.request.kind} </Text>
          {basename(pending.request.path)} ({formatSize(pending.size)}) to {state.threads[pending.key]?.name ?? "this chat"}?{" "}
          <Text dimColor>Enter send · t send as text · Esc cancel</Text>
        </Text>
      ) : null}
      {deleting && selectedMsg ? (
        <Text wrap="truncate-end">
          <Text color="red">Remove this message? </Text>
          {selectedMsg.isSelf ? "r recall for everyone · " : ""}d delete for me <Text dimColor>· Esc cancel</Text>
        </Text>
      ) : null}
      {picking ? (
        <Text>
          <Text color="cyan">React: </Text>
          {PICKER.map((icon, i) => `${i + 1} ${reactionIcon(icon)}  `).join("")}
          <Text dimColor>0 remove · Esc cancel</Text>
        </Text>
      ) : null}
      <Box display={picking || pending || deleting ? "none" : "flex"}>
        <Composer draftKey={state.activeKey} active={focus === "input"} enabled={!!active} error={sendError} onSubmit={submit} />
      </Box>
      <StatusBar connection={state.connection} selfName={state.selfName} focus={focus} notify={state.notify} toast={toast} />
    </Box>
  );
}
