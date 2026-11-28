# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

A release is made by adding a section for the new version below and bumping `version` in `package.json` to match, then pushing to `main`.

## [Unreleased]

### Added

- `zalo-tui --version` (or `-v`) prints the installed version.
- `w` on a message shows who reacted with what, newest first.
- Multi-line messages: `Alt+Enter` adds a line, the message box grows up to five lines (the message pane shrinks to make room), and `↑`/`↓` move between lines. `Ctrl+w` deletes a word.

### Changed

- Group messages now notify like direct messages, as in the Zalo app; muted groups stay silent. Press `m` in the chat list to notify only when you're @mentioned (mentions then notify even in muted groups).
- On macOS, notifications use terminal-notifier when it's installed: clicking one brings the terminal to the front and opens that chat, and each chat keeps only its latest notification.

### Fixed

- Unread counts are no longer lost by moving through the chat list: a highlighted chat is only previewed, and it counts as read once you open it (Enter, `l`, a click, or typing). Messages that arrived while the app was closed now count as unread, and a "new messages" line marks where they start.
- A message now shows every reaction a person adds, not only their latest one.
- Long drafts wrap instead of being cut off, so the cursor stays visible after `Home` or `Ctrl+a`.
- A link whose title is its URL no longer shows the URL twice.
- Help scrolls with `j`/`k` in small terminals instead of overlapping, lists keys that were missing, and no longer mentions an `m` key in the react popup that didn't exist.
- Shorter status bar hints that fit the terminal.

## [0.1.0] - 2026-11-24

### Added

- QR code login with a remembered session.
- Chat list of friends and groups, recent chats first, with unread counts, a name filter and the order kept between runs.
- Message pane that follows the highlighted chat, with word wrapping, per-chat drafts and scrollback.
- Sending text, photos and files, by path, drag and drop, `/photo` or `/file`.
- Reactions with a searchable popup of all Zalo reactions, shown under each message with your own highlighted.
- Recall your own messages and delete any message for yourself.
- Clickable links, and `o` to open photos, files and links.
- Desktop notifications for direct messages and @mentions, respecting muted chats and terminal focus.
- Vim-style keys, mouse clicks and wheel scrolling, and a `/help` panel.
- Reconnect after another Zalo session takes over.
