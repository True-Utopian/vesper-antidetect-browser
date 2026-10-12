# Capacity model

All resource, duration, quota and reliability values below are **sizing assumptions**, not host or subscription measurements. This model supplements the [architecture](architecture.md); it does not set deployment limits. Replace the assumptions with measured workload data before increasing admission budgets.

## What has actually been validated

The [validation record](../validation.md) separates the 1 October 2026 script-mode baseline from the 2 October managed checks. The baseline passed 40 automated tests on each OS, Engine 5.3.1 headed create/start/input/stop/export/restore, live viewing, and an authenticated private HTTP CONNECT smoke whose browser and probe observed the same exit IP. One cached-kernel run had profile creation around 0.6 s, browser readiness 3.2 s and form-plus-export completion 4.9 s. The proxy smoke took about 4.0 s.

The current suite passed 85 tests on Windows and 85 on Linux; its optional real-PostgreSQL race test passed separately on the server. Managed live checks covered cold sign-in, warm reuse, identity handoff and same-node crash recovery with verified archives. None of these checks measured sustained capacity.

Those are functional observations, not sustained throughput, resource-per-browser measurements or P95/P99 latency. No CPU/RAM capacity benchmark has been performed. External logins, graphics-heavy workloads, paid proxy capacity, parallel displays and distributed workers need their own qualification.

The supplied Linux live-view deployment has one shared desktop and `MAX_CONCURRENCY=1`. It supports **one active live run** on that display, regardless of spare host RAM. The per-node examples below require independent Engine/display slots, exclusive profile ownership and coordinated proxy allocation. Raising the concurrency setting does not create those boundaries.

The official Kameleo Docker guide requires 2 GiB shared-memory configuration and persistent kernel storage. A shared-memory limit is not automatically 2 GiB of resident use; measure total cgroup memory including actual shared-memory consumption rather than double-counting it on top of process totals. Stagger cold starts and cache kernels in persistent per-slot volumes. [Kameleo Docker guide](https://developer.kameleo.io/integrations/docker/)

## One 8-vCPU / 32-GiB node

Reserve **2 vCPU and 6 GiB once** for the OS and shared control services. The remaining slot budget is **6 vCPU and 26 GiB**. Hypothetical conservative per-slot costs include its browser, Engine/display overhead and normal viewer activity. They are intended to be replaced by measured workload-class resource budgets, including startup/export bursts. CPU generation, contention/steal time and GPU/encoder requirements can materially change the answer.

```text
Cnode = floor(min(6 / CPU_per_slot, 26 / GiB_per_slot))
Cnode = min(Cnode, independently_isolated_display_slots)
capacityRunsPerMinute = 60 * Cnode / meanOccupiedSeconds
capacityAttemptsPerDay = 86400 * Cnode / meanOccupiedSeconds
```

For mixed workloads, reserve the sum of each active class's CPU and memory budgets, rather than admitting according to an average browser. Quarantined/unconfirmed cleanup still occupies its reserved resources. Mean occupied time includes normal start, browser activity, manual waits, stop and export if the slot remains held through export. Failed attempts contribute their actual occupied time to the measured mean.

| Hypothetical workload | CPU/slot | GiB/slot | Mean occupied time | Slots/node | Attempts/minute ceiling | Attempts/day ceiling |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Light form, mostly waiting | 1.1 | 2.5 | 50 s: 45 s activity + 5 s lifecycle/export | 5 | 6.00 | 8,640 |
| Rich application | 1.8 | 3.5 | 125 s: 120 s activity + 5 s lifecycle/export | 3 | 1.44 | 2,074 |
| Heavy graphics/continuous work | 2.5 | 5.0 | 305 s: 300 s activity + 5 s lifecycle/export | 2 | 0.39 | 567 |

These day figures assume continuous work for 24 hours with no failures or downtime; they count attempted sessions, not successful saved profiles. The 5 s lifecycle value is a hypothetical average, not a percentile inferred from the four-second smoke. A graphics workload also requires a separate GPU/encoder qualification. Adding an average 60 s human verification wait to the light example changes its service time from 50 to 110 s and its five-slot ceiling from 6.00 to 2.73 attempts/minute.

## Fleet constraints

For `N` homogeneous nodes, determine effective concurrency and the bottleneck rate:

```text
C = min(N*Cnode, availableTeamBrowserQuota, usableProxyLeases, displaySlots)

lambdaCapacity = min(
  60*C / meanOccupiedSeconds,
  availableKameleoRPM / countedCallsPerAttempt,
  providerAllocationsPerMinute / allocationsPerAttempt,
  60*proxyBandwidthMiBPerSecond / proxyMiBPerAttempt,
  60*exportBandwidthMiBPerSecond / exportPathMiBPerAttempt,
  exportWorkers*60 / meanExportSeconds,
  ownedSiteAllowedAttemptsPerMinute
)
```

Where a flow does not require a scarce proxy/allocation stage, omit that term rather than divide by zero. A mobile run also consumes the separate mobile-browser quota. Subtract other users' active browsers and reserved cleanup from available team capacity. Proxy capacity means usable leases satisfying the requested country, latency, freshness and observed exit-IP uniqueness policy, not the number of credential strings a provider can generate.

Include provider request/concurrent-session limits, health probes, retries, proxy startup checks, site request limits and bandwidth cost. Profile export may require compression, read-back hashing, copying and replication; `exportPathMiBPerAttempt` includes the bytes that traverse the limiting path. Viewer streams and downloads share network and CPU budgets. Archive retention consumes disk even when no browsers run. Use measured archive-size tails and export queue depth, not only average transfer speed.

Kameleo's browser and RPM quotas aggregate across the team; the [main architecture](architecture.md#4-global-profile-lease-coordinator) describes their enforcement. Use the account's actual entitlements and count the documented rate-limited operations, rather than assuming a plan or charging every Puppeteer input event. The example below budgets three counted calls per fresh attempt before retries. [Kameleo usage limits](https://developer.kameleo.io/reference/usage-limits/)

## N-node example and sessions per day

Assume the light workload, five isolated slots/node, 50 s mean occupied time, **team CB=10** and **eight usable exclusive proxy leases**. Also assume 120 Kameleo RPM with 12 RPM reserved for other work, three counted calls/attempt, effective export bandwidth 40 MiB/s and 100 MiB of export-path traffic/attempt. API capacity is `(120-12)/3=36` attempts/minute and export capacity is `60*40/100=24`; neither binds the proxy-constrained rows below. All other limits are assumed higher for this example.

| Nodes | Unconstrained slots | Unconstrained linear attempts/day | Slots with CB=10 / proxy=8 | Constrained attempts/minute ceiling | Constrained attempts/day ceiling |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 5 | 8,640 | 5 | 6.0 | 8,640 |
| 2 | 10 | 17,280 | 8 | 9.6 | 13,824 |
| 4 | 20 | 34,560 | 8 | 9.6 | 13,824 |
| 8 | 40 | 69,120 | 8 | 9.6 | 13,824 |

“Unconstrained linear” removes global quota, proxy and shared bandwidth limits; it is a scaling reference, not a prediction. At eight nodes its 48 attempts/minute would exceed the example's 36-RPM-derived API rate and 24/minute export rate even if more proxies became available. Under the actual example, additional nodes after two provide placement/resilience options, not more throughput. More proxy session IDs cannot overcome an exit-IP lease bottleneck.

## Admission, availability and success are different factors

Use one explicit admission factor `eta`, for example **0.70**, to leave queue/burst headroom below the calculated bottleneck. Do not apply another generic 70% CPU or RPM multiplier to the same workload budget. Fixed OS reservations, actual competing API traffic and conservative per-slot resource costs have distinct meanings and were already included above.

Let `A` be the fraction of the day's equivalent service capacity that is available, and `pSaved` the fraction of attempted sessions producing the required verified saved result. Then:

```text
admissionRateWhileAvailable = eta * lambdaCapacity
expectedAttemptsPerDay = 1440 * A * admissionRateWhileAvailable
expectedSavedPerDay = expectedAttemptsPerDay * pSaved
```

For the example, `eta=0.70`, `A=0.95`, `pSaved=0.98` gives:

| Nodes | Admission target while available, attempts/minute | Expected attempts/day | Expected verified saved sessions/day |
| --- | ---: | ---: | ---: |
| 1 | 4.20 | 5,746 | 5,631 |
| 2 | 6.72 | 9,193 | 9,009 |
| 4 | 6.72 | 9,193 | 9,009 |
| 8 | 6.72 | 9,193 | 9,009 |

Applying the same hypothetical `eta`, `A` and `pSaved` to one rich-application node gives about **1,351 verified saved sessions/day**; the heavy class gives about **369/day**, assuming no tighter global bottleneck. These compare different workload durations and costs, not different hardware performance measurements.

These reliability values are assumptions, not guarantees. `eta` is planned spare service capacity; `A` accounts for unavailable capacity; `pSaved` measures outcome quality. Do not deduct an outage twice by both reducing `C` for that whole period and multiplying by its availability loss again. With partial node outages or varying quotas, integrate the time-varying bottleneck rate instead of applying a single fleet-wide availability scalar. If admission continues during downtime, queued work carries into later periods; the daily completion estimate is still bounded by available service.

Likewise, if retry attempts are already included in occupied-time and call-count measurements, do not apply an additional blanket retry penalty. If retrying a logical job, track attempts and distinct successful jobs separately: one eventual saved job may consume several attempts. Uncertain external effects require reconciliation, not automatic replay to improve the success percentage.

## Benchmark and admission policy before scaling

Measure actual owned workloads at one, two, three, then more isolated slots; test cold/warm kernels, viewers on/off, fixed viewport/FPS and proxy/no-proxy separately. Record host/cgroup CPU, steal/throttle, working-set/peak memory, shared-memory consumption, OOMs, GPU/encoder load where relevant, startup/stop/export timings, archive bytes, proxy latency/bytes, queue age, P50/P95/P99 completion and confirmed cleanup. Use sustained and burst tests with representative MFA waits and archive sizes.

Increase slots only while declared latency/error budgets hold. Admit by measured resource class, global leases and rate budgets; stop admission on pressure or cleanup uncertainty. Bound export backlog and disk occupancy independently. Preserve diagnostic samples and report confidence intervals across repeated runs. These load tests remain to be run; one successful form submission cannot establish their results.
