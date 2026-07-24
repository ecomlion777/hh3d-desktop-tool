# Phase 06A Network Probe Hotfix

## Root cause

The Worker readiness probe used the HH3D homepage and rejected immediately when
Electron emitted `ClientRequest.close` without a response callback. Real
Chromium proxy traffic can reach that terminal event without giving the Worker
a usable response event, even though the same proxy succeeds in the Phase 05
proxy test.

## Changes

- Uses the same lightweight endpoint as the proven Proxy Test service:
  `https://api.ipify.org?format=json`
- Adds `api.ipify.org` to the fixed Worker allowlist.
- Uses Chromium session credentials/cookies with `credentials: include`.
- Removes `ClientRequest.close` as an immediate failure source.
- Uses response/error/abort listeners and the configured timeout as the
  authoritative completion paths.
- Keeps authenticated proxy handling and no-Direct-fallback behavior unchanged.
- Keeps all Worker requests in Electron main and exposes no arbitrary request API.

## Apply

Copy the included `electron` and `tests` folders over the project root.

Run:

```cmd
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run electron:dev
```

Then start one profile. Expected result:

`Worker Core: Session/network sẵn sàng`
