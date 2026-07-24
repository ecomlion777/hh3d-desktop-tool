# Phase 06A Validation Report

## Phạm vi

- Database migration schema v2 → v3.
- Queue và concurrency Worker.
- Persistent Chromium Session theo profile.
- Direct/proxy consistency.
- Authenticated proxy request trong Electron main.
- Batch/log/settings persistence.
- Không tự phát request lúc startup.

## Kiểm tra đã chạy trong môi trường build

### Electron CJS syntax

```text
PASS — toàn bộ file .cjs trong electron/ và tests/ vượt qua node --check
```

### Phase 05 regression

```json
{
  "status": "PASS",
  "schemaVersion": 3,
  "proxies": 3,
  "profiles": 2,
  "secretsEncrypted": true,
  "oneToOneAssignment": true
}
```

### Phase 06 backend integration

```json
{
  "status": "PASS",
  "schemaVersion": 3,
  "fetchCount": 4,
  "logs": 21,
  "batches": 1,
  "concurrencyQueue": true,
  "proxyDirectFallbackBlocked": true,
  "authenticatedProxyWorker": true,
  "startupNetworkRequests": 0
}
```

### TypeScript static verification

```text
PASS — TypeScript 5.8.3 với cấu hình kiểm tra cục bộ và module shim tạm.
```

Các file shim dùng để kiểm tra không được đóng gói trong ZIP phát hành.

## Chưa xác nhận trong container

`npm ci` không hoàn thành do môi trường container không tải được dependency. Vì vậy các lệnh sau phải được chạy lại trên Windows có `node_modules` thật:

```cmd
npm run lint
npm run build
npm run electron:dev
npm run electron:start
```

## Điều kiện nghiệm thu Windows

- Không request Worker lúc app startup.
- Start/Stop profile hoạt động.
- Giới hạn concurrency 1–50 hoạt động.
- Queue tự chạy profile tiếp theo khi có slot.
- Cookie/session Mini Browser được Worker dùng lại.
- Proxy có auth hoạt động với Worker.
- Proxy lỗi không fallback Direct.
- Group và Batch Start/Stop hoạt động.
- Log, batch và settings tồn tại sau restart.
- Thoát app dừng toàn bộ Worker.
- Mini Browser Phase 04 và Proxy Manager Phase 05 không hồi quy.
