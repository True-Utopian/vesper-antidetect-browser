# Schedules and timezones

Browser 0.4.12 / Workbench 0.5.17. By **true-utopian**.

Preview calendar rules and handle missed or uncertain occurrences.

## Create the right recurrence

POST /api/v1/schedules accepts name, automationId and inputs with nextAt for a one-time schedule, intervalMs for an interval, or cron and optional timezone for a calendar. Do not combine interval and cron. Cron uses five minute-resolution fields; hashed fields are rejected. An optional nextAt is a not-before boundary. Intervals range from one minute to one year.

## Preview local wall time

POST /schedules/preview accepts cron, timezone and optional after (UTC milliseconds), returning the next five UTC occurrence timestamps. Use an IANA name such as Europe/London so calendar wall time follows daylight-saving changes. Preview before creating the schedule.

```text
{
  "cron": "0 9 * * 1-5",
  "timezone": "Europe/London",
  "after": 1774688340000
}
```

## Pause, resume and remove

POST /schedules/{id}/pause disables future occurrences. Resume enables an eligible waiting schedule; completed or quarantined schedules require inspection and replacement. Remove deletes the schedule and its vaulted inputs. Inputs are encrypted locally and omitted from public schedule records.

## Service and recovery limits

Workbench must be running; scheduling does not wake a sleeping or powered-off PC. Missed repeating occurrences coalesce into one run rather than bursting. Admission waits for idle capacity and resolved cleanup. A crash during unknown admission quarantines the schedule instead of blindly replaying website actions.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
