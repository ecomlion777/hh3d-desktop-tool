# Mini Browser Session Architecture & Security Reference (Phase 04A)

## 1. Actual ProfileBrowserManager Architecture

The `ProfileBrowserManager` class (`electron/browser/ProfileBrowserManager.cjs`) manages isolated Chromium browser sessions for game profiles in the HH3D Desktop Application.

- **Main Window & Child Popups:** Each active profile runs in a dedicated `BrowserWindow` with custom security event handlers (`will-navigate`, `will-redirect`, `setWindowOpenHandler`, `will-prevent-unload`).
- **Guaranteed Window Teardown:** Implements a Promise-based `forceCloseWindow` helper with fallback timeout (`1500ms`) and `win.destroy()` to ensure windows close without waiting indefinitely on beforeunload handlers.
- **Child Window Teardown Order:** Closing a profile browser closes all child popup windows first before closing the main window.
- **Error State Preservation:** On failed page loads or renderer crashes, the manager captures the error state (`state: 'error'`) and retains it in `lastKnownStatuses` even after window teardown until re-opened or cleared.
- **Safe Quit Handling:** On application exit, `closeAllBrowsers()` sequentially closes all child and main windows without clearing state prematurely or deleting partition storage data.

---

## 2. Exact Partition Generation Implementation

Partition strings are generated deterministically per profile ID via `getPartitionForProfile(profileId)` in `electron/browser/browserValidation.cjs`:

```js
const crypto = require('crypto');
const { PARTITION_PREFIX } = require('./browserConstants.cjs'); // 'persist:hh3d-profile-'

function sanitizeProfileId(profileId) {
  const normalized = validateProfileId(profileId);
  const safeId = normalized.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!safeId) return 'default';
  return safeId;
}

function getPartitionForProfile(profileId) {
  const normalizedId = validateProfileId(profileId);
  const safeSlug = sanitizeProfileId(normalizedId).slice(0, 48);

  const idHash = crypto
    .createHash('sha256')
    .update(normalizedId, 'utf8')
    .digest('hex')
    .slice(0, 12);

  return `${PARTITION_PREFIX}${safeSlug}-${idHash}`;
}
```

### Partition Key Rules:
- **Prefix:** `persist:` forces Electron to save cookies, localStorage, IndexedDB, and cache persistently across app restarts.
- **Safe Slug:** Replaces non-alphanumeric characters (except `-` and `_`) with hyphens `-` and slices up to 48 characters.
- **SHA-256 Hash:** Appends a 12-character SHA-256 digest of raw `profileId` to guarantee unique partition names and prevent collisions (e.g. `profile:1` vs `profile/1`).

---

## 3. Electron userData Session Storage Location

Electron stores partition storage directories inside the app's `userData` path:
- **Windows:** `<app.getPath('userData')>\Partitions\hh3d-profile-<safeSlug>-<idHash>\`
- **macOS:** `<app.getPath('userData')>/Partitions/hh3d-profile-<safeSlug>-<idHash>/`
- **Linux:** `<app.getPath('userData')>/Partitions/hh3d-profile-<safeSlug>-<idHash>/`

*Note: The exact parent folder depends on the Electron application name and build metadata.*
To see the exact directory used by the current build, open:
**General Settings → Local Storage → Data directory.**

Inside each partition directory, Chromium maintains standard storage files:
- `Cookies` (SQLite DB)
- `Local Storage/leveldb`
- `IndexedDB/`
- `Cache/`

---

## 4. Windows Session-Persistence Test Procedure

To verify session persistence across application restarts on Windows:
1. Launch HH3D Desktop Application on Windows.
2. Open Mini Browser for Profile A.
3. Log in or store session cookies/localStorage on `https://hoathinh3d.co/`.
4. Close the Mini Browser window for Profile A.
5. Exit HH3D Desktop Application completely.
6. Relaunch HH3D Desktop Application.
7. Re-open Mini Browser for Profile A.
8. Confirm session state/cookies remain active without requiring re-authentication.

---

## 5. Profile A vs Profile B Isolation Test

To verify isolation between separate profile partitions:
1. Open Mini Browser for Profile A (`persist:hh3d-profile-a-...`).
2. Open Mini Browser for Profile B (`persist:hh3d-profile-b-...`).
3. Set distinct session cookies or localStorage values in Profile A.
4. Verify in Profile B's browser DevTools that Profile A's cookies and localStorage are completely inaccessible.

---

## 6. Clear Session Test

To verify partition session clearing (`clearMiniBrowserSession`):
1. Open Mini Browser for Profile A and log in.
2. In the Profile Manager, select "Xóa Session Mini Browser" (Clear Session).
3. Confirm that any open Mini Browser window for Profile A is closed first.
4. Re-open Mini Browser for Profile A.
5. Confirm all cookies, localStorage, IndexedDB, and HTTP cache have been cleared.

---

## 7. Cookies Are Not Stored in app-data.json

- `app-data.json` stores application state, profiles metadata, groups, proxies, and settings ONLY.
- Cookies, authentication tokens, and browser session caches are managed exclusively by Chromium inside partition directories under `userData`.
- No raw cookies or passwords are ever saved into `app-data.json`.

---

## 8. Current Phase 04A Limitations

1. **Proxy Support:** Proxy routing per profile partition is not yet linked to Mini Browser sessions in Phase 04A.
2. **API Workers:** Background worker scripts and background API polling engines are not implemented in Phase 04A.
3. **Browser Automation:** Automated form filling, login macros, auto-play scripts, and DOM automation are explicitly excluded in Phase 04A.

---

## 9. Proxy Support Is Not Implemented

Individual profile proxy configurations (IP, port, username, password) are tracked in profile records but are not yet hooked up to Chromium partition webRequest or session proxy settings in Phase 04A.

---

## 10. API Workers Are Not Implemented

Background headless workers, auto-claim timers, and server API polling workers are scheduled for future phases.

---

## 11. Browser Automation Is Not Implemented

No Puppeteer, Playwright, Selenium, or synthetic click/keyboard automation libraries are included or permitted. All browser interactions are performed manually by the user.

---

## 12. Direct Partition Directory Usage Warning

> **CRITICAL WARNING:** Do NOT manually edit, move, or delete partition directories under `<app.getPath('userData')>\Partitions\` while Electron is running. Modifying underlying LevelDB or SQLite cookie files while Chromium locks them can cause database corruption or unexpected browser crashes. Use the application's built-in "Xóa Session Mini Browser" (Clear Session) feature instead.
