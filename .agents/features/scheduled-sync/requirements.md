# Scheduled Sync — Requirements

**GitHub Issue**: [#41 - Scheduled split sync & sync management UI](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature C)
**Date**: 2026-02-22
**Status**: In Progress

## Summary

Add a **generic scheduling system** that allows users to schedule recurring background jobs on a cron-based cadence. The system is job-type-agnostic — schedules can trigger any job type (drift detection, bulk sync, future types). Each schedule stores a cron expression, a job type, and type-specific parameters.

For example:

- A quarterly drift detection with a 1-year lookback period
- A weekly drift detection with a 1-week lookback period
- (Future) A daily data export

The scheduling system integrates with the existing Jobs infrastructure — scheduled jobs appear in the Jobs page alongside manually triggered jobs, with a badge indicating they were triggered by a schedule.

## User Stories

1. As a user, I can create a schedule by choosing a job type, setting a cron frequency (via presets or custom), and configuring type-specific parameters.
2. As a user, I can see a list of my schedules with their job type, frequency, next run time, and active/inactive status.
3. As a user, I can toggle a schedule between active and inactive.
4. As a user, I can delete a schedule permanently.
5. As a user, when a scheduled job runs, it appears in the Jobs page like any other job.
6. As a user, I can see which jobs were triggered by a schedule vs manually triggered.
7. As a user, I can use simple presets (Hourly, Daily, Weekly, Monthly) or create a custom cron schedule with an advanced editor.
8. As a user, I can preview the next execution times for my schedule before saving.
9. As a user, I can click into a schedule to see its details, previous job runs, and upcoming execution times.

## Acceptance Criteria

- [ ] User can create a schedule by selecting a job type, configuring type-specific parameters (e.g., lookback period), and choosing a cron frequency
- [ ] Frequency can be set via simple presets (Hourly, Daily, Weekly, Monthly) or a custom cron expression with an advanced editor
- [ ] Before saving, user can preview the next N execution times for the schedule
- [ ] Schedules list page shows all schedules with job type, frequency description, next run time, and active/inactive status
- [ ] Clicking a schedule opens a detail page showing full configuration, previous job runs triggered by this schedule, and upcoming execution times
- [ ] User can toggle a schedule between active and inactive
- [ ] User can delete a schedule
- [ ] Active schedules automatically trigger jobs at the specified cron times
- [ ] Inactive schedules do not trigger any jobs
- [ ] Jobs triggered by a schedule are linked to the schedule and show a schedule badge in the Jobs page
- [ ] Schedule-triggered jobs use computed date ranges based on the schedule's type-specific parameters (e.g., lookback_days)

## Scope

| Feature                                       | In Scope | Future |
| --------------------------------------------- | -------- | ------ |
| Generic schedules table with cron expressions | ✅       |        |
| CRUD API for schedules                        | ✅       |        |
| Worker schedule checking and auto-trigger     | ✅       |        |
| Cron presets: Hourly, Daily, Weekly, Monthly  | ✅       |        |
| Advanced custom cron editor                   | ✅       |        |
| Schedule preview with next execution times    | ✅       |        |
| Active/inactive toggle and delete schedules   | ✅       |        |
| Schedule badge on triggered jobs              | ✅       |        |
| Type-specific parameters per schedule         | ✅       |        |
| Schedule management UI                        | ✅       |        |
| Email/notification on job completion          |          | ✅     |

## Out of Scope

- **Notifications**: No email or push notifications when a scheduled job completes

## Dependencies

- Existing worker binary with poll loop (from #40)
- Existing drift detection API and service (from #40)
- Existing Jobs page and job detail views (Sub-feature B)
- Rust cron parsing library (e.g., `cron` crate)

## Open Questions

- Should there be a limit on how many schedules a user can create? **Recommendation**: No hard limit, but warn if creating overlapping schedules for the same job type.
