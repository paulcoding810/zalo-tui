# zalo-tui

A terminal client for Zalo personal accounts, built on [zca-js](https://github.com/RFS-ADRENO/zca-js) and [Ink](https://github.com/vadimdemedes/ink).

> [!WARNING]
> This uses an **unofficial** Zalo API. Zalo does not support it, and using it may get your account locked or banned. Use it at your own risk, and don't use it for bulk or automated messaging.

## Features

- Log in by scanning a QR code; the session is remembered.
- Chat list with friends and groups, recent chats first, unread counts and a name filter.
- Read and send messages; links are clickable and open with `o`.
- Send photos and files (drag a file into the terminal, or `/photo` and `/file`).
- Reactions (all of Zalo's built-in ones), recall, and delete for yourself.
- Desktop notifications, respecting muted chats; groups can be limited to @mentions.
- Keyboard first (vim-style keys), with mouse clicks and wheel scrolling.

## Requirements

- Node.js 22 or newer.
- macOS is the main target. Notifications and opening links use `osascript` and `open`; on Linux they fall back to `notify-send` and `xdg-open`, which are untested. Windows is not supported.
- Optional on macOS: with [terminal-notifier](https://github.com/julienXX/terminal-notifier) installed (`brew install terminal-notifier`), clicking a notification brings your terminal to the front and opens that chat, and each chat keeps only its latest notification.
- A terminal with true mouse and focus reporting works best (Ghostty, iTerm2, WezTerm, Kitty).

## Install

```sh
npm install -g zalo-tui
```

## Install from source

```sh
git clone https://github.com/paulcoding810/zalo-tui.git
cd zalo-tui
pnpm install
pnpm build
ln -s "$PWD/bin/zalo-tui.js" ~/.local/bin/zalo-tui
```

Run `pnpm build` again after pulling changes.

## Usage

Run `zalo-tui`, then open Zalo on your phone, use its QR scanner on the code shown, and confirm the login on the phone.

Type `/help` or press `?` inside the app to see all keys. `zalo-tui --version` prints the installed version.

| Where | Keys |
|---|---|
| Chat list | `j`/`k` or `↑`/`↓` move · `g`/`G` top/bottom · `Ctrl+d`/`Ctrl+u` half page · `/` filter by name or message text (`↑`/`↓` move while typing, `Enter` opens at the match, `Esc` clears) · `Enter` or `i` open and type · `l` or `Tab` messages · `n` notifications · `m` group alerts: all or @mentions · `r` reconnect |
| Messages | `j`/`k` select · `g`/`G` top/bottom · `Ctrl+d`/`Ctrl+u` half page · `/` search this chat, then `n`/`N` older/newer match · `r` reply · `e` react · `w` who reacted · `d` recall or delete · `o` open photo, file or link · `Enter` or `i` type · `h`, `Esc` or `Tab` chats |
| React popup | `1`–`6` quick reactions (or click them) · type to search all · `↑`/`↓` `Enter` pick · `0` remove yours · `Esc` close |
| Message box | `Enter` send · `Alt+Enter` new line · `Esc` back · arrows move · `Ctrl+a`/`Ctrl+e` or `Home`/`End` start/end · `Ctrl+w` delete word · `Ctrl+u` delete to start |
| Anywhere | `PgUp`/`PgDn` or wheel scroll messages (the wheel over the chat list moves the selection) · click to open a chat, select a message or type · `Shift`-drag selects text · `Ctrl+C` quit |

Commands in the message box:

| Command | |
|---|---|
| `/photo <path> [caption]` | send a photo (jpg, png, webp) |
| `/file <path> [caption]` | send any other file |
| `//text` | send text that starts with `/` |
| `/help` | show help |

Paths can start with `~/`, be quoted, or use `\ ` for spaces. A path on its own, for example from dragging a file into the terminal, asks before sending it.

Moving through the chat list previews the highlighted chat; it only counts as read once you open it (`Enter`, `l`, a click, or typing). Each chat keeps its own unsent draft.

## Your data

Everything is stored in `~/.config/zalo-tui/`, readable only by you:

| File | Contents |
|---|---|
| `credentials.json` | your logged-in session. Anyone with this file can use your account. Delete it to log out. |
| `settings.json` | notification preferences |
| `read.json` | how far you've read in each chat, so unread counts survive restarts |
| `activity.json` | each chat's last activity time and name, used to keep the list order |
| `open-<pid>` | briefly, while a notification click asks the running app to open a chat |
| `debug.log` | only with `ZALO_TUI_DEBUG=1`: why each message did or didn't notify (no names or text) |

Set `ZALO_TUI_HOME` to use a different folder.

## Limitations

- Zalo allows one web session at a time. Opening Zalo Web or PC elsewhere disconnects the app; press `r` in the chat list to reconnect.
- On connect, Zalo returns only recent messages (usually the last few days). Older history isn't available.
- Stickers show as `[sticker]` and can't be sent. Voice, video and polls show as placeholders.
- Clipboard images can't be pasted; save them as a file first.
- Search only covers messages the app has loaded; Zalo has no message search API.

## Development

```sh
pnpm start       # run from source
pnpm test        # unit tests
pnpm typecheck
pnpm build       # bundle to dist/
```

### Releasing

Add a section for the new version to `CHANGELOG.md`, set the same `version` in `package.json`, and push to `main`. The Release workflow checks that the two match, runs the checks, publishes to npm with provenance, and creates a GitHub release from that changelog section. It does nothing if that version is already on npm.

## License

MIT
