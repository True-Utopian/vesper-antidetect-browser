# Selenium with Browser-owned profiles

The local Windows and Linux installed pairs passed a bounded Selenium attachment and archive-recovery workflow on 4 November 2026. This qualifies Selenium **4.41.0**, ChromeDriver **157.0.8103.38**, Vesper's native Chromium **157.0.8100.0**, Browser **0.4.13** and Workbench **0.5.18** together. It does not qualify every Selenium command, other drivers, Firefox/mobile, physical Linux GPUs or arbitrary browser versions.

The bridge and qualification tools are original source tools. They do not replace the desktop app, install another browser, or change the native kernel. The previously qualified desktop packages and their frozen offline guides remain unchanged. Install Selenium and a compatible ChromeDriver separately in your developer environment; the desktop app does not currently bundle these tools.

## Why an adapter is needed

Browser returns a policy-guarded WebSocket endpoint after checking profile access and any automation lease. ChromeDriver's `debuggerAddress` first reads HTTP discovery metadata, so assigning that WebSocket's host directly is insufficient. `scripts/lib/selenium-discovery.mjs` supplies the small HTTP discovery surface using commands sent through the **same guarded endpoint**. ChromeDriver then attaches to that guarded socket.

The adapter never reads the private native endpoint, launches a substitute browser, or disables target policy. It binds an ephemeral IPv4 loopback address, rejects browser-origin and unexpected Host requests, exposes only discovery GET routes, limits outstanding commands, fails when the guarded connection closes, and drains its resources on close. Keep it alive for the duration of the Selenium attachment.

This follows ChromeDriver's [existing-session attachment contract](https://developer.chrome.com/docs/chromedriver/capabilities). Existing-session mode has [command limitations](https://developer.chrome.com/docs/chromedriver/help/operation-not-supported-when-using-remote-debugging), including commands that depend on ChromeDriver's startup extension. Vesper qualifies the subset below rather than claiming universal WebDriver support.

## Use the bridge

From a source checkout with its normal dependencies installed, obtain the profile's endpoint with `VesperBrowserClient.connectionUrl(profileId)`. For a Workbench-owned profile, first call `claimProfile(profileId, runId)` with that run's existing owner ID. An unrelated client without the lease cannot obtain the endpoint.

```javascript
import {createSeleniumDiscovery} from './scripts/lib/selenium-discovery.mjs';

// client is an authenticated VesperBrowserClient for the existing local service.
// profileId belongs to the run you are controlling; its browser is already open.
const discovery = await createSeleniumDiscovery(await client.connectionUrl(profileId));
try {
  // Pass discovery.address to your own Selenium process as debuggerAddress.
  // Wait for that process to finish before leaving this block.
} finally {
  await discovery.close();
}
```

The corresponding Python attachment uses an explicit driver executable:

```python
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

options = webdriver.ChromeOptions()
options.debugger_address = discovery_address  # supplied by your Node bridge
driver = webdriver.Chrome(service=Service(chromedriver_path), options=options)
try:
    driver.get(owned_fixture_url)
    print(driver.title)
finally:
    driver.quit()
```

In the qualified combination, `driver.quit()` detaches without stopping the Browser-owned profile. Close the discovery adapter afterward. Use Workbench Finish to stop a run's browser and save its archive, or Browser's authenticated lifecycle API for a directly owned profile. The bridge does not assume ownership of those operations.

Use Google's [version-selection procedure](https://developer.chrome.com/docs/chromedriver/downloads/version-selection) for other versions. The exact `157.0.8100` build was absent from the official build index during this qualification; the documented milestone fallback supplied `157.0.8103.38`. Both actual platforms passed with that combination. The private toolchain receipts retain official download origins, archive/executable hashes and reported versions. No driver binaries are published in these repositories.

## What passed

Each actual installed pair passed six lifecycle assertions plus four real Selenium assertions before saving and four after independent archive import: **14 assertions per platform**. These exercised:

- Matching installed services and idle preflight, then a newly owned Workbench run and its Browser lease.
- Rejection of connection access from a client without that run's lease.
- Real ChromeDriver attachment, navigation and the first-script native 4 CPU/4 GB preset.
- Selenium input, click and asynchronous evaluation, frame switching and a worker response.
- Exactly one owned local POST effect, plus a synthetic persistent cookie and local storage.
- Driver detachment while the owned browser remains running, then Workbench Finish and a SHA-256-verified saved archive.
- A different imported profile ID, restarted with the existing native kernel; Selenium recovered the cookie and storage without repeating the POST.
- Preservation of every pre-existing profile and historical run, followed by normal desktop Quit and no remaining owned lease/browser.

All four owned-fixture screenshots were directly reviewed. The Linux tests used the existing isolated portable installation under Xvfb with software graphics. The Windows tests used the existing per-user installation and enabled signed add-on. Credentials, profiles, archives, runtime binaries and raw receipts remain private.

Three source regressions cover endpoint validation, discovery routing/origin/Host/method restrictions, and loss of the guarded connection. Current source suites passed **275 checks with two skips on Windows**, **270 with seven skips on Linux**, and **102 in the independent Browser checkout**. The application/kernel payload did not change.

## Reproduce the lifecycle fixture

Use the Workbench source checkout with the matching installed pair running, its native engine selected and no active profiles, runs or schedules. Use a developer-owned store when reproducing. Install the recorded Selenium version in your Python environment and download the matching driver from the official Chrome for Testing catalog. Record and verify its digest before executing it.

```text
node scripts/qualify-selenium.mjs --data-root <running-desktop-data-root> --driver <chromedriver-executable> --driver-sha <driver-sha256> --kernel-sha <qualified-kernel-sha256> --python <selenium-python> --output .workbench/new-selenium-proof --actual-installed
```

The fixture requires a fresh output directory and verifies the driver bytes. It creates only owned test work, retains a private archive and receipts, restores into a separate profile, and stops/releases/trashes its owned profiles afterward. Do not reuse a completed or failed output directory; inspect the retained failure before another attempt. `--actual-installed` records the caller's scope and does not itself prove an installer ran; qualification also requires binding to the actual installed executable and prior installed-package evidence.

## Remaining scope

Selenium Grid, BiDi through Selenium, window-management/extension-dependent commands, downloads, other language bindings and alternate driver/browser combinations are not covered here. Puppeteer/CDP and Puppeteer BiDi evidence remain separate. This milestone adds framework qualification; it makes no claim about broader fingerprint coverage or detection avoidance.
