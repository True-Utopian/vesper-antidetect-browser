# Build and contribute

Browser 0.4.10 / Workbench 0.5.15. By **true-utopian**.

Work on original source with an isolated development store.

## Choose the source project

vesper-antidetect-browser is the independent Browser source repository. vesper-workbench contains the automation product and its Browser workspace dependency. Both are original projects by true-utopian under MIT. Preserve third-party notices. Keep vendor binaries, analysis traces, profiles, proxy lists, private keys and personal test results out of contributions.

## Source checks

Workbench requires Node.js 26 or newer. Browser supports Node.js 24 or newer. From a clean checkout, install the locked dependencies, then run the source suite. These checks do not qualify an installed native runtime or a public binary release.

```text
npm ci
npm run check
```

## Desktop development

Use a dedicated VESPER_DESKTOP_DATA_DIR outside your normal private store. The Workbench repository provides desktop:workbench for shell iteration. Full Windows packaging needs its tested Chromium cache; Linux native runtime packaging must be performed on Linux. Build output remains local by default. Read the repository’s desktop and native qualification records before changing packaging or engine activation.

## Correct the documentation

The wiki combines docs/handbook.json with the existing bundled API guides. scripts/build-public-docs.mjs generates the static site and Markdown wiki from those sources. Edit the source text, regenerate the output and run the documentation checks. Report the affected release and precise steps in an issue; omit access tokens, proxy credentials and private website content.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
