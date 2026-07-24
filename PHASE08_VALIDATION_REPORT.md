# Phase 08 Validation Report

## Automated checks

- Điểm Danh manifest is `ready` and runnable.
- REST nonce extraction supports `customRestNonce`, `restNonce`, `wpApiSettings.nonce`, generic nonce and hidden `_wpnonce`.
- Correct endpoint: `/wp-json/hh3d/v1/action`.
- Correct action: `daily_check_in`.
- Successful check-in is accepted.
- Already checked-in response is accepted as `already_done`.
- Expired nonce is refreshed exactly once.
- Login page/session expiry is reported as `WORKER_LOGIN_REQUIRED`.
- ModuleRunner result persistence and logs are verified.
- No renderer-facing arbitrary request API is added.
- Database schema remains version 4.
- Electron remains version 39.8.10.

## Windows verification still required

1. Use a profile already logged in through Mini Browser.
2. Run Điểm Danh once and verify the server message/streak.
3. Run again and verify `already_done` is treated as success.
4. Test a Direct profile and a proxied profile.
5. Log out a test profile and verify `Cần đăng nhập`.
6. Enable Điểm Danh for a profile, Start Worker, and verify the module runs after session_check.
