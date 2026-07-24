# Phase 09 — Security Token Compatibility Hotfix

## Root cause

The real HH3D page currently exposes the shared page token as:

```js
hh3dData.securityToken
```

or JSON containing:

```json
{"securityToken":"..."}
```

The first Phase 09 implementation primarily recognized the legacy snake-case
name `security_token`, so the Tế Lễ module could not find the current token.

## Changes

- Recognizes `securityToken` camelCase used by current HH3D pages.
- Keeps support for legacy `security_token` forms and hidden input fields.
- Handles HTML entities and common escaped embedded JSON forms.
- If the clan member page lacks the token or nonce, fills the missing value
  from the configured website homepage using the same profile session/proxy.
- Does not log the token, cookie, nonce, or proxy credentials.
- Keeps the existing one-time context refresh/retry behavior.

## Files

- `electron/modules/helpers/securityToken.cjs`
- `electron/modules/builtin/ClanWorshipModule.cjs`
- `tests/phase09-clan-worship.test.cjs`

## Validation

```cmd
npm run lint
npm run build
npm run test:phase08
npm run test:phase09
npm run electron:dev
```

Phase 09 tests cover:

- camelCase `securityToken`
- legacy snake-case token
- escaped JSON and HTML entities
- homepage fallback
- nonce fallback
- context retry
- already-completed response
- login-required response
