# Vesper Browser workspace

The requested references are dense desktop profile managers. Vesper's main job
is to let an operator scan, group and open many persistent profiles. A spacious
introductory page hides that job; the primary surface is now the profile table.

## Plan

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#171a23` | Main working surface |
| Rail | `#12151d` | Navigation and folder collection |
| Surface | `#202530` | Controls, dialogs and menus |
| Divider | `#323949` | Table hierarchy |
| Text | `#e4e8f0` | Names and readable controls |
| Iris | `#9298ef` | Selection, focus and active navigation |

Use Segoe UI Variable and local fallbacks, 13px controls, compact 48px profile
rows, a 240px navigation rail and a horizontally scrollable table where needed.
Names stay left aligned and are the strongest row element. Browser, proxy,
folder, notes, tags, state and actions occupy explicit columns. The original
Vesper mark and **by true-utopian** credit remain quiet and visible.

```text
[ Vesper Browser  by true-utopian ][ collection / search / connection ]
[ All / Running / Favorites      ][ create / import / bulk / sorting ]
[ Folder search / folder list    ][ select / name / browser / proxy  ]
[ Proxies / Templates / Trash    ][ folder / notes / tags / actions  ]
[ Add-ons / API / Settings       ][ pagination / selected counts    ]
```

## Review against the request

The dark density is an explicit user direction. It serves profile scanning,
not a fashionable landing-page theme. Avoid promotional cards, decorative
gradients, enormous headlines and nonfunctional columns. Empty folders are
not invented: the rail derives folders and counts from stored profile settings.
Favorites are persisted by the real profile PATCH endpoint. Browser choices
only expose implemented Chromium and Brave engines; mobile and vendor engines
are not fabricated.

Preserve lease protection and running-state restrictions in every row, inline
editor and bulk selection. More exposes actual cookies, archive export,
duplication, editing, environment observation and reversible trash operations.
Templates, browser-engine management and proxy assignment remain functional.

Workbench is a native add-on. Installation and enablement go through the
desktop host. Its bounded `#workbench-mount` contains no iframe; the native
host places its view using reported bounds. Navigation away hides the view.
Web users see installation instructions rather than a pretend embedded app.

## Verification

Use an owned temporary Browser store to check selection, search, folder
navigation, sorting, pagination, favorites, inline edits and More actions.
Inspect desktop and narrow screenshots, keyboard focus and native add-on
status transitions. Source checks must ensure that the previous editor,
cookies, templates, lease errors and bulk API behavior remain reachable.

The final owned-store fixture used 29 synthetic profiles. Nineteen checks
passed with no browser JavaScript errors: actual favorite persistence, inline
rename/move, folder filtering, sorting/pagination, paged selection, tabbed
settings saves, API/Settings destinations, keyboard search, real Chromium
start/stop, cookie reads, templates, and automation lease restrictions. Native
add-on lifecycle, bounds, readable native guard errors and web installation
instructions were checked through a controlled preload fixture;
the desktop host must separately verify the actual embedded view.

Screenshots were inspected at 1380 and 390 pixels, with additional overflow
checks at 1080 and 860 pixels. Desktop content is constrained to the viewport;
the collection scrolls inside its table and the navigation rail scrolls on
shorter windows. At 1380 × 860 the table fits without horizontal scrolling,
and the native Workbench mount measured x264, y164, width1092, height630.
Headers and metadata use 12px type, with 13px profile names. Narrow screens
preserve the table through contained horizontal scrolling rather than hiding
real profile columns. Evidence is in `test-results/vesper-browser-workspace/`.
