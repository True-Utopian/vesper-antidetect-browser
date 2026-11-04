# Proxy connections

Browser 0.4.12 / Workbench 0.5.17. By **true-utopian**.

Store credentials locally and inspect routing failures.

## Saved Browser connections

Browser /api/v1/proxies stores HTTP or SOCKS5 connections in a local encrypted vault. Public inventory exposes metadata and hasCredentials, never passwords. A profile can copy a saved connection at an explicit revision through savedProxy, or use an inline proxy. Saved references and credentials are omitted from public manifests and exported archives. Re-enter the intended proxy after importing a profile.

## Workbench inventory

Workbench /api/v1/proxies describes its automation inventory. POST /proxies/{id}/check performs a bounded health probe on an unleased item. The Browser proxy manager and Workbench admission inventory have different contracts; do not assume IDs or tokens are interchangeable.

## Operational limits

A successful health check proves the observed probe only. Owned HTTP navigation and outage cases have been tested; whole-browser DNS, UDP, WebRTC, IPv6 and HTTPS outage matrices remain broader acceptance work. Inspect stopped and retained runs before retrying after an uncertain connection failure. Never publish proxy lists, credentials or private test destinations.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
