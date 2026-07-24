# Phase 10 Validation Report

- Module: `phuc_loi`
- State: `ready`
- Page: `/phuc-loi-duong`
- AJAX endpoint: `/wp-content/themes/halimmovies-child/hh3d-ajax.php`
- Timer action: `get_next_time_pl`
- Open action: `open_chest_pl`
- Monthly bonus action: `claim_bonus_reward`

## Automated coverage

- Dynamic action map parsing.
- Legacy action security parsing.
- Countdown parsing.
- Waiting result and `nextRunAt`.
- Open next chest and refresh server state.
- Completed 4/4 state.
- Security context retry.
- Login-required detection.
- Monthly bonus in the last two Vietnam-calendar days.
- ModuleRegistry and ModuleRunner integration.
- Phase 05–09 regression scripts remain available.

## Manual Windows checks required

1. Run with a logged-in profile whose next chest is not ready.
2. Run with a profile whose next chest is ready.
3. Confirm the page progress changes after the request.
4. Run with a completed 4/4 profile.
5. In the last two days of a month, verify monthly bonus result.
6. Verify proxy and Direct profiles separately.
