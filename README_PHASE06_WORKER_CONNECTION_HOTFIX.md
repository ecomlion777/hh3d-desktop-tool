# Phase 06A Worker Connection Hotfix

## Root cause

Electron `IncomingMessage` requires the `end` listener to be registered before
the `data` listener. The previous Worker client registered `data` first.

For small or cached responses, the stream could finish immediately after
entering flowing mode, so the request-level `close` event was observed while
the Worker still believed the response had not ended. This produced:

`WORKER_CONNECTION_CLOSED`

## Changes

- Registers `end` before `data`.
- Tracks whether a response started and ended.
- Adds explicit `aborted` handling.
- Distinguishes:
  - `WORKER_RESPONSE_INCOMPLETE`
  - `WORKER_NO_RESPONSE`
- Keeps proxy authentication and no-direct-fallback behavior unchanged.
- Updates the Phase 06 test so a successful request emits the real terminal
  `close` event after the response ends.

## Apply

Copy the included `electron` and `tests` folders over the project root, then run:

```cmd
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run electron:dev
```
