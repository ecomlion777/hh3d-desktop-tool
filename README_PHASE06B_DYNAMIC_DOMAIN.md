# Phase 06B — Dynamic HH3D Website Domain

Phase 06B removes the hard-coded HH3D website domain from Mini Browser, proxy
resolution, and the API Worker request allowlist.

## Settings

Open:

`General Settings → Tên Miền Website Hiện Tại`

Configure:

- **Base URL:** the current primary website domain.
- **Allowed redirect domains:** domains that Chromium may follow when the site
  redirects between `.co`, `.com`, `.st`, or a future replacement domain.

Accepted Base URL examples:

- `hoathinh3d.co`
- `hoathinh3d.com`
- `https://hoathinh3d.st/`

The app normalizes the value to `https://<hostname>/`.

## Security rules

- HTTPS is mandatory.
- Username/password in the website URL are rejected.
- Non-default ports are rejected in Phase 06B.
- Mini Browser top-level navigation is limited to the configured host list and
  their subdomains.
- Worker Core still allows its fixed network probe host `api.ipify.org`.
- Arbitrary renderer-controlled requests are not exposed.

## Runtime behavior after a domain change

Saving a changed domain configuration:

1. Persists the normalized values in `generalSettings` inside `app-data.json`.
2. Stops active API Workers.
3. Closes active Mini Browser windows.
4. Preserves profile partitions, cookies, localStorage, IndexedDB, proxy
   assignments, and encrypted proxy credentials.
5. Uses the new Base URL the next time Mini Browser or a future game module is
   started.

A different domain may require a new manual login because website cookies are
scoped by domain. The app does not copy cookies between unrelated domains.

## Internal architecture

- `electron/website/websiteValidation.cjs`
  - Normalizes and validates Base URL and allowed hosts.
- `electron/website/WebsiteConfigService.cjs`
  - Reads current persisted settings on demand.
- `ProfileBrowserManager`
  - Opens the configured Base URL and uses the dynamic navigation allowlist.
- `ProxySessionManager`
  - Resolves the configured Base URL when verifying an assigned proxy.
- `WorkerHttpClient`
  - Allows future module URLs only when approved by WebsiteConfigService.
  - Exposes `buildWebsiteUrl(relativePath)` inside Electron main for Phase 07.

## Validation

Run:

```cmd
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run test:phase06b
npm run electron:dev
```
