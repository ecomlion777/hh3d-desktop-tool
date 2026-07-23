# Phase 04A domain redirect hotfix

## Root cause

The Mini Browser starts at:

`https://hoathinh3d.co/`

That address redirects to:

`https://hoathinh3d.st/`

The existing top-level navigation guard only allowed `hoathinh3d.co`, so Electron blocked the redirect and `loadURL()` rejected with `ERR_FAILED (-2)`.

## Files replaced

- `electron/browser/browserConstants.cjs`
- `electron/browser/browserValidation.cjs`

## Apply

Copy the `electron` folder from this patch over the project root:

`D:\HH3D-Desktop-App\04-electron-source`

Then restart:

```cmd
npm run lint
npm run build
npm run electron:dev
```

The patch keeps HTTPS-only navigation and only permits:

- `hoathinh3d.co`
- `*.hoathinh3d.co`
- `hoathinh3d.st`
- `*.hoathinh3d.st`
