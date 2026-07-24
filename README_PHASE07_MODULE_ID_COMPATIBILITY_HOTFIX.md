# Phase 07 Module ID Compatibility Hotfix

## Root cause

Profiles created by the old mock UI contained placeholder module IDs such as
`daily_quest` and `dungeon`. Phase 07 introduced a reviewed catalog with codes
such as `diem_danh`, `bi_canh`, and `framework_diagnostic`.

The bulk module modal kept hidden legacy IDs in its state and submitted them to
Electron. The backend correctly rejected the unknown `daily_quest` code, which
prevented the selected real modules from being saved.

## Fixes

- Existing app-data.json profiles are cleaned automatically on the next application start.
- Hidden legacy IDs are removed before the module modal submits.
- Backend ignores only the five known pre-Phase-07 placeholder IDs.
- Truly unknown module codes are still rejected.
- Existing profile module lists are filtered against the current catalog when
  merging or calculating common selections.
- New seed profiles and imported profiles no longer receive fake module IDs.
- Single-profile Edit Profile no longer owns a second stale module editor;
  module configuration is handled only through the Profile Manager Module modal.
- The Activity Settings `Chạy thử` action uses a one-off forced manual run for
  ready modules, without permanently enabling them.

No game module implementation was added by this hotfix.
