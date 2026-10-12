# Vesper identity

Vesper Browser is the independent browser and profile project. Vesper Workbench is its automation pipeline and operator interface. Both are by **true-utopian**. The shared name expresses the relationship without hiding which tool does which job. This is the working product identity; name and trademark availability have not been established.

## Design plan

The audience is someone operating persistent browser profiles and repeatable workflows on their own PC. This is a working instrument: session state, recovery and the next useful action take priority over a promotional landing page.

| Token | Value | Role |
| --- | --- | --- |
| Charcoal | `#191d23` | Native workspace canvas |
| Graphite | `#242a31` | Forms and profile surfaces |
| Pearl | `#eaf0ed` | Primary reading text |
| Celadon | `#b8e1d5` | Mark, focus and selected state |
| Pine | `#376e64` | Primary actions |
| Amber | `#e2be87` | Evening star and pending work |

Use Segoe UI Variable with Segoe UI and system fallbacks: a deliberate connection to the Windows desktop where browsers actually open, with no remote font dependency. Product names have a compact two-line lockup. Body and control text remain sentence case; timestamps use aligned numerals.

Keep the operator layout left aligned. Browser uses a compact collection table and labelled sidebar. Workbench opens as an optional native child view, with run history beside the active workflow. The mark is the expressive element; navigation uses consistent outline icons and readable labels.

```text
[ Vesper / Workbench   by true-utopian ] [Profiles] [Browser status]
[ run collection ] [ selected browser + workflow activity          ]
[ filters / runs ] [ recovery, input and saved artifacts           ]
```

The 12 October identity replaces the folded letter with an original night moth: four wings, a clear body and antennae, a quiet crescent and one evening star. It remains legible as a small application icon. Browser and Workbench use the same mark, with a charcoal workspace, celadon controls and restrained amber highlights. No remote fonts or artwork are required.

## Review before implementation

The review rejected another monogram and a generic privacy shield. The moth draws on Vesper's evening identity without using a letter. Native Browser and Workbench share the same palette and mark; standalone web Workbench retains a daylight surface. Existing table and workflow hierarchy stay in place, with symbolic text glyphs replaced by original outline navigation icons. The footer credits the maker. The README status mosaic is based on named checks and preserves distinct states for desktop verification, source testing, active work and planned work.

Kameleo remains the label for its optional compatibility backend. A selected local engine must say Vesper Browser, while a selected vendor engine must say Kameleo. Names must never imply that missing fingerprinting capabilities have been implemented.

## Verification and critique

Inspect desktop and narrow mobile screenshots after editing. Check that the maker credit survives the small header, profile actions stay usable, and the selected-engine title matches the actual adapter. Keep focus indicators and reduced-motion behavior. Avoid introducing fonts or artwork that require a network connection.

The first pass was checked in real Chromium against an owned, synthetic HTTP fixture at 1440, 800, 600, 390 and 320 pixels. Workbench and profile views fit without horizontal overflow; sign-in was also inspected at 1440, 390 and 320 pixels. The maker credit stays visible at every size. The engine heading changes to Kameleo when that fixture selects the compatibility adapter, and the local profile button disappears. No browser JavaScript errors were observed. Images and the fixture result are under the ignored `test-results/vesper-ui/` directory; these visual checks do not establish vendor feature parity.

The critique retained the existing quiet empty-state illustration rather than adding a second brand treatment. The sign-in control is centered and its decorative arrow is gone. Narrow headers use two rows so the product name, attribution and operational controls all remain readable.
