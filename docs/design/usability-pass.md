# Vesper navigation and usability pass

By true-utopian, 10 October 2026.

The primary job is to manage a browser profile, connect a proxy when needed, and run a repeatable workflow. Use the existing iris #4a4e87, ink #283144, slate #eef1f5, white #ffffff, muted #647186 and green #2b7665. Keep Segoe UI for Windows controls and system fallback on Linux. Labels use sentence case and the same verbs throughout.

Browser: a 190px navigation rail, one collection toolbar, a compact profile table and a tabbed editor. Open/Stop and Edit stay visible; occasional actions move into More. General, Proxy, Environment and Start pages tabs keep profile creation readable. Running profiles, templates, trash, engines and help remain named destinations.

Workbench: a 180px navigation rail, run history and run detail. Flow editor and Schedules occupy the workspace as pages instead of blocking overlays. Profiles opens the shared Browser manager. Proxies opens the actual inventory controls. A local guide explains draft → publish → run → save and the difference between the two applications. Navigation stays available while editing.

QA inventory: initial launch and attribution; Browser create/edit tabs and invalid fields; Open/Stop and lease restrictions; More actions with Escape/outside dismissal; search/folder/running filters and selection; template/trash/engine navigation; proxy assignment; guided empty state. Workbench Runs/Flows/Schedules/back navigation, draft persistence while switching, dirty-close warning, schedule controls, help and proxy inventory. Check native launch size, 680px minimum, mobile web, focus/reduced-motion and screenshot clipping. Exploratory cases: invalid proxy on another editor tab, empty search/running collection, switching with an unsaved flow, and menus near screen edges.

Resume QA, 11 October: step selection must leave saved status unchanged; a drag produces exactly one undo entry; rapid Save/Publish cannot overlap revisions; schedule name, automation inputs and date survive destination switching; closing connections restores the underlying navigation highlight. Schedule polling keeps unchanged rows intact. Inspect these with ordinary controls in source and packaged apps.
