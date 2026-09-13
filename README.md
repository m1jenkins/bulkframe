# Bulkframe

Bulkframe is a Chrome extension for scanning a page (or many pages), filtering the images it finds, and downloading exactly what you need. It runs locally in your browser. There is no account and no paywall.

## Load unpacked

1. Install dependencies and build:

```bash
npm install
npm run build
```

2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select `.output/chrome-mv3`.

Pin Bulkframe from the extensions menu.

## Use it

1. Open a regular `http` or `https` page.
2. Click the Bulkframe icon and press **Search images**.
3. The first scan asks for permission to read images on websites. Allow it.
4. Filter by quality, type, size, or orientation, select images, then **Download Selected**. Quality defaults to **Hide low** (icons, thumbs, and tiny clips).
5. **Open in Full Mode** for scan history, Mass Scan, Scheduled scans, Favorites, Library, Rules, Analytics, and Settings.

The **wand** icon turns on Magic Wand: hover images on the page to download them or add them to a tray.

**Scheduled scans:** in Full Mode, open **Scheduled**, paste a page URL, pick a daily time, set filters (same quality/type/size options as a manual scan), and optionally a folder (`Bulkframe/{domain}/{date}` tokens work). Relative folders are written under Downloads. Absolute folders such as `/Users/you/PeekIngest/drop` are written there after you click **Allow this folder** and pick that directory. Chrome needs to be running at that time. The job opens the page in a background tab, scrolls it so lazy feeds such as Reddit card view load more posts, then scans and optionally downloads matching files.

Side Panel: enable **Open in Side Panel** in Settings if you want the same compact UI to stay open while you browse.

## Permissions

| Permission | Why |
|---|---|
| `storage` / `unlimitedStorage` | Settings, scan history, favorites, library, analytics |
| `downloads` | Save images, ZIP archives, and apply folder rules |
| `scripting` / `tabs` / `activeTab` | Scan the current page and Mass Scan other tabs |
| `sidePanel` | Optional persistent workspace |
| `clipboardWrite` | Copy links and filenames |
| `offscreen` | HTML helpers for extension pages |
| `alarms` | Daily scheduled scans |
| Optional `<all_urls>` | Requested on first scan so images on the sites you visit can be detected and fetched |

## Development

```bash
npm run dev
```

WXT opens a Chrome profile with the extension loaded. Source lives under `src/`.

## Privacy

See [public/privacy.html](public/privacy.html). Workflow data stays in your browser profile.
