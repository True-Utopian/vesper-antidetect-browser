# Proxy providers and leases

The installed Browser proxy manager is described in [saved connections](proxy-inventory.md). Browser 0.4.7 and Workbench 0.5.10 passed **nine installed outage/recovery checks** on 13 October 2026 using the qualified Vesper native kernel. For both authenticated HTTP and SOCKS5, an upstream outage blocked existing and fresh-page HTTP navigation to an owned loopback origin that remained directly reachable. No direct browser request reached that origin. Restarting the same upstream restored routing in the same leased profile; Finish saved a checksum-verified archive and released the profile. Original profiles and proxy entries were unchanged.

This qualifies bounded owned HTTP navigation, including SOCKS5 transport. It does not qualify whole-browser DNS/UDP/WebRTC/IPv6 capture, HTTPS/TLS outage behavior, unavailable-proxy startup, automatic rotation or provider-wide guarantees. Private receipt: `test-results/proxy-outage/installed.json`. The repeatable public helper is `scripts/qualify-installed-proxy-outage.mjs` in Vesper Workbench; it uses only owned fixtures and requires idle installed services.

`ProxyManager` allocates a proxy for a run, verifies an HTTPS request through it, and reserves both its connection and observed exit IP. Share one manager instance across all runs in a workbench. Pass `lease.proxy` to the selected browser backend and expose only `lease.report` to the UI. **The lease's `proxy.extra` contains credentials.**

```ts
import { ProxyManager } from '@true-utopian/vesper-workbench/proxies';

const proxies = new ProxyManager({ inventoryFile: './proxy-inventory.json' });
const lease = await proxies.allocate({
  provider: 'inventory', type: 'isp', country: 'GB',
  maxLatencyMs: 1500, maxAttempts: 5, timeoutMs: 30_000,
  minRemainingMs: 20 * 60_000,
}, runId, signal);
// Create/start Kameleo using lease.proxy. Keep the lease until the browser has stopped.
try { /* browser work and profile export */ }
finally { proxies.release(lease.id); }
```

No proxy hook means the runtime uses its optional `DEFAULT_PROXY_INVENTORY_IDS` selection, or no proxy when that setting is empty. The `direct` provider means **a manually supplied proxy connection**, not direct internet traffic:

```ts
const request = {
  provider: 'direct',
  proxy: { protocol: 'http', host: 'proxy.example.com', port: 8080,
    usernameEnv: 'PROXY_USERNAME', passwordEnv: 'PROXY_PASSWORD' },
};
```

Supported protocols are `http`, `https`, and `socks5`. In this API `https` is an alias for an HTTP CONNECT proxy that carries HTTPS destinations; it is normalized to Kameleo's `http` choice. A proxy that requires TLS **to the proxy server itself** is not supported by this Kameleo mapping. SOCKS5 checks resolve the destination through the proxy (`socks5h`).

## Inventory and NSocks imports

Copy `examples/proxy-inventory.example.json` to the gitignored `proxy-inventory.json`, replace its example endpoints and declarations with your purchased proxy details, then enable those entries. The JSON can be an array or `{ "proxies": [...] }`. Each entry has:

- A unique `id`, `protocol`, `host`, and integer `port`.
- Optional `usernameEnv` and `passwordEnv`. Literal `username`/`password` are supported for private administrator inventories, but never commit them. A field cannot have both a literal value and an environment reference.
- Optional `source`, `enabled`, `createdAt`, and `expiresAt` (ISO timestamps).
- Optional `attributes`: `type` (`residential`, `isp`, `datacenter`, `mobile`), two-letter `country`, `region`, `state`, `city`, `isp`, and `asn`.

`source: "nsocks"` labels an imported proxy. This implementation does not call NSocks purchasing/renewal APIs. Import only endpoints you already control; allocation never purchases or renews service. Store the inventory outside public/static directories and restrict filesystem access to the service account (for example mode 600 on Linux or a service-account-only Windows ACL). The default filename is gitignored; another filename requires its own ignore rule.

`publicInventory()` returns labels, protocol, declared attributes, dates, enabled state and whether an entry is leased. It omits endpoints, usernames, passwords and environment-variable names. `probeInventory(id)` performs a temporary exclusive allocation and releases it; it cannot inspect an entry already used by a live run. `probe(request)` is available for other providers. The methods throw sanitized errors and never emit network exception text containing credentials.

## IPRoyal residential

Set **proxy credentials**, not a dashboard API token, in the server environment:

```dotenv
IPROYAL_PROXY_USERNAME=your-proxy-username
IPROYAL_PROXY_PASSWORD=your-proxy-base-password
```

```ts
const request = {
  provider: 'iproyal', type: 'residential', country: 'GB', city: 'london',
  iproyal: { lifetime: '1h' }, maxLatencyMs: 2000, maxAttempts: 5,
};
```

The adapter uses IPRoyal's documented local credential-string construction. It generates an eight-character session ID, applies the requested location, sets a sticky lifetime, and enables `_killswitch-1` by default. The entry node defaults to `geo.iproyal.com`, HTTP port 12321 / SOCKS5 port 32325. It does not call management, ordering or subscription APIs and cannot buy traffic. Existing usable proxy credentials and available traffic are required.

Constructor options `iproyal: { usernameEnv, passwordEnv, hostname, lifetime, killswitch }` change these defaults. No literal IPRoyal credentials are accepted by that configuration. `region`, `country`, `state`, `city`, and `isp` target codes become provider suffixes. Supply exact provider codes, not display labels or arbitrary suffix strings. City requires a country; the documented state option requires US. ASN targeting is not documented by IPRoyal, so this adapter rejects it rather than claiming to honor it. Import separately purchased ISP/mobile/datacenter products into inventory.

One-unit lifetime limits follow IPRoyal's FAQ: 1–59 seconds, 1–59 minutes, 1–24 hours, or 1–7 days. A newly generated session is not evidence of a new, exclusive, never-before-used exit IP. Residential peers can disappear. The killswitch asks the provider to fail rather than silently replace a lost sticky peer; it does not promise that the same IP lasts beyond session expiry. Persist `report.expiresAt` with the run and stop/re-evaluate before expiry. Reopening a `.kameleo` archive does not renew a proxy lease or its credentials.

Primary references: [local rotation/session configuration and killswitch](https://docs.iproyal.com/proxies/residential/proxy/rotation), [location suffixes](https://docs.iproyal.com/proxies/residential/proxy/location), [entry nodes and optional management generate-proxy-list API](https://docs.iproyal.com/proxies/residential/api/access), [sticky lifetime limitations](https://help.iproyal.com/en/articles/7215287-how-long-does-a-sticky-ip-session-remain-the-same). The management generate-proxy-list API is an alternative to local construction; this implementation does not need it.

## Verification, matching and freshness

Default verification performs an authenticated proxy connection to `https://api.ipify.org?format=json` with TLS validation enabled. It requires HTTP 200 and a valid IP, does not follow redirects, caps the response at 32 KiB, and measures the full probe duration. A reachability failure, timeout, invalid response or excessive latency rejects that candidate; allocation never falls back to an unproxied connection.

`report.declared` contains inventory labels or requested IPRoyal targeting. Those values are **not independently verified**. The default verifier establishes only `report.verified.exitIp`, `latencyMs`, and `checkedAt`; it cannot infer that an IP is residential/ISP/mobile, its ASN, or its city. Filters first match the declared attributes. `requireVerified: ['country', 'asn']` additionally requires a configured independent verifier to return those fields. Contrary independently verified evidence rejects a candidate even without `requireVerified`.

Configure `probeOptions: { url, ca?, parse? }` for an HTTPS verification service. A `parse` callback can return `{ ip, attributes }` only from evidence supplied by that service. The optional CA adds a private trust anchor without disabling TLS checks. Alternatively inject a `ProxyProbe` for your verification system/tests; its contract is `(connection, {signal, timeoutMs}) => {exitIp,latencyMs,checkedAt,attributes?}`. Never fabricate attributes from the request.

Request limits:

| Option | Meaning/default |
| --- | --- |
| `maxAttempts` | At most 8 network-tested candidates (1–100) |
| `timeoutMs` | Whole allocation deadline, 30 seconds (max 5 minutes) |
| `probeTimeoutMs` | Per-probe timeout, 8 seconds |
| `maxLatencyMs` | Maximum measured probe duration, 30 seconds |
| `minRemainingMs` | Required time before known credential/session expiry, 0 |
| `freshness.maxVerificationAgeMs` | Max age of verifier evidence, 30 seconds |
| `freshness.maxInventoryAgeMs` | Reject old/unknown inventory `createdAt` values |
| `freshness.unusedForMs` | Avoid recently used connections and observed exit IPs in this manager |
| `inventoryIds` | Restrict candidates to selected inventory IDs |

Every allocation probes again. Inventory age means entry creation time, not the age/reputation of its IP. Missing expiry means **unknown**, not permanent validity; `minRemainingMs > 0` rejects candidates with unknown expiry. Attempts use alternate candidates (IPRoyal creates a new session each attempt); no automatic rotation occurs inside an active browser run.

Connection reservations happen before probing; exit-IP check-and-reserve is atomic after probing in the Node process. IPv6 representations are normalized, including IPv4-mapped addresses. Leases remain reserved until explicit `release`, even after their expected expiry, to avoid assigning resources while the old browser may still be active. Release is idempotent and does not reset any provider sessions.

`ProxyManager` provides local exclusivity at allocation. Managed mode additionally claims the verified exit IP in PostgreSQL before creating a profile and releases that claim after a confirmed stop. Workers using that coordinator cannot hold the same claimed exit concurrently. This does not establish provider-wide exclusivity or permanent IP stability: another customer may share an exit and a provider may change routing. Script-mode processes do not share claims. Local usage history resets at process restart, while managed claims survive for lifecycle reconciliation.

## Custom providers

Implement `ProxyProvider` with a unique `name` and `async *candidates(request, {signal,maxAttempts})`. Yield `ProxyCandidate` values with connection credentials, declared attributes, optional dates and a safe candidate ID. Register via constructor `providers: [...]` or `manager.register(provider)`. Keep all credentials out of candidate IDs, labels and declared attributes. The manager handles deadlines, matching, probes, collisions, bounded attempts and release. Provider code is trusted server code and must honor abort signals for its own cleanup.
