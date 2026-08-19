# Relic Firefox Extension

A Firefox extension (Manifest V3) built for the [Relic](/) app. Click the
Relic icon on any page to save it — and its title — straight into your archive.

Ported from the Chromium extension; the logic is identical, with two
Firefox-specific adjustments:

- Uses the `browser.*` API namespace and its promise-returning methods.
- Adds a `browser_specific_settings.gecko` block to `manifest.json` so it can
  be installed and signed for Firefox (AMO or temporary load).

Settings are stored in `browser.storage.local` (no Firefox Account required).

## Features

- **One-click saving.** Opening the popup on an unsaved page immediately
  archives it: the URL and page title are captured and a relic is created on
  your server. No form to fill out.
- **Minimal confirmation.** While saving you see a small "Saving…" indicator
  that becomes a green checkmark ("Saved to your library.") and the popup
  closes itself. Failures show an X with a short reason instead.
- **Edit-after-the-fact.** Click the icon again on a page you've already saved
  and the popup opens the full editor: change the title, add a note, move it to
  a collection, toggle tags, or delete the relic.
- **Collection + tag management.** Pick or create a collection, and assign tags
  on the fly.
- **Default collection.** Configure one in Settings to have it pre-selected
  when you edit saved pages.

## Install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` in this folder.
4. Click the Relic icon, then **Settings** in the popup header.

To package for distribution, use `web-ext build` (or submit `manifest.json`
and assets to AMO); the `gecko.id` is already set.

## Configure

| Setting                | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| **Server URL**         | Base URL of your Relic server, e.g. `https://relic.example.com`. |
| **API token**          | A bearer token from your Relic server's Settings page.           |
| **Default collection** | Collection pre-selected in the editor (optional).                |

## Usage

- **Save a page:** click the Relic icon on the page. If it isn't saved yet you
  get the tick confirmation and the popup closes — the URL and title are now a
  relic.
- **Edit a saved page:** click the icon again. The popup shows the editor with
  the existing relic's details:
  - **Title** — auto-detected from the page on first save; edit freely here.
  - **Note** — a private note on the relic (optional).
  - **Collection** — choose one, or click **+** to create a new collection
    inline.
  - **Tags** — type to filter the list, tick/untick tags (selected ones sort to
    the top), or press **Enter** on a new name to create and select it.
  - Save changes with **Save Changes** or remove the relic with **Delete**.

## How it works

- Settings are stored with `browser.storage.local`.
- The popup reads the active tab via the `tabs` API and talks to the Relic REST
  API (`/api/relics`, `/api/collections`, `/api/tags`) with your token in an
  `Authorization: Bearer` header.
- The API is CORS-enabled server-side, so no special host permissions are
  needed beyond fetching the configured server.

## Design

The extension mirrors the `relic-frontend` design language — monospace type,
squared corners, near-black primary buttons, muted labels, and hairline
borders — so it feels like a native part of the app.

## Development

No build step. Edit the files and click **Reload** on the add-on in
`about:debugging#/runtime/this-firefox`.

- `manifest.json` — manifest v3 config (name, permissions, popup, options, gecko).
- `popup.html/css/js` — the save popup.
- `options.html/css/js` — the Settings page.
- `icons/` — toolbar and store icons.
