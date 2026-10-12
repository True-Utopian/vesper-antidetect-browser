# Calendar schedules

By **true-utopian**. Workbench supports one-time runs, fixed intervals and five-field calendar rules. Scheduling is local: the Workbench service must remain running. It does not wake a sleeping PC or install an operating-system task.

Choose **Schedules → Calendar rule**, select an automation and enter its inputs. A rule such as `0 9 * * 1-5` runs at 09:00 on weekdays in the selected IANA timezone. Use **Preview dates** to see the next five occurrences in that timezone before creating the schedule. The create button stays in the footer while the inputs scroll.

Calendar rules use minute, hour, day of month, month and weekday. Six-field second-resolution rules, aliases and randomized `H` fields are rejected. UTC is the API default; the desktop form initially selects the PC's timezone. Fixed intervals measure elapsed time: **Every 24 hours** can change its local wall-clock time across daylight saving. Use a calendar rule to retain local wall-clock time.

```http
POST /api/v1/schedules/preview
Authorization: Bearer <private-token>
Content-Type: application/json

{"cron":"0 9 * * 1-5","timezone":"Europe/London"}
```

Preview returns `occurrences`, an array of UTC timestamps in milliseconds. An optional `after` timestamp makes previews reproducible. Create a schedule with `name`, `automationId`, `inputs`, `cron` and `timezone`. Do not combine a calendar rule with `intervalMs`. An optional `nextAt` provides a not-before bound; Workbench finds the first occurrence at or after that bound.

```ts
const dates = await workbench.calendarPreview('0 9 * * 1-5', 'Europe/London');
await workbench.createSchedule({
  name: 'Weekday inspection', automationId: 'inspect',
  inputs: { url: 'http://127.0.0.1:3000/owned-fixture' },
  cron: '0 9 * * 1-5', timezone: 'Europe/London',
});
```

Inputs are stored in the existing local encrypted vault. Pause retains the schedule and its history; resume retains its calendar. Missed occurrences coalesce into one admission, rather than submitting a backlog. An active run or unfinished cleanup prevents another occurrence. After that run finishes, the next calendar time is strictly later than both the current clock and the admitted occurrence. A backward clock change cannot replay that occurrence. Uncertain admission after a crash remains quarantined for review.

Qualification covers London spring/autumn timezone changes, weekday rules, invalid dates and zones, encrypted-input restart recovery, clock changes, authenticated preview/create routes, and desktop preview/create/pause controls. Ambiguous or nonexistent wall times follow the pinned `cron-parser` library's behavior; explicit policy controls for those times and desktop wakeup remain open requirements.
