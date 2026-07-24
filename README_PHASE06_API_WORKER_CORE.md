# HH3D Desktop Tool — Phase 06A API Worker Core

## 1. Mục tiêu

Phase 06A xây dựng nền Worker chạy trong Electron main process. Worker có thể được khởi động cho từng profile, nhiều profile, nhóm hoặc batch mà không cần mở Mini Browser.

Phase này **chưa chạy module game cụ thể**. Mỗi worker chỉ thực hiện một lần kiểm tra session/network tới domain HH3D đã cho phép, sau đó duy trì trạng thái chạy bằng heartbeat nội bộ. Heartbeat không phát request mạng lặp lại.

## 2. Kiến trúc

```text
React Dashboard
  → AppBridge / preload IPC cụ thể
  → ProfileWorkerManager
      → hàng đợi + giới hạn concurrency
      → WorkerHttpClient
          → persistent partition của profile
          → cookie/session Chromium của profile
          → ProxySessionManager
      → WorkerLogRepository
      → BatchRepository
      → WorkerSettingsRepository
```

Các file backend chính:

```text
electron/worker/
├── BatchRepository.cjs
├── ProfileWorkerManager.cjs
├── SystemStatsService.cjs
├── WorkerHttpClient.cjs
├── WorkerLogRepository.cjs
├── WorkerSettingsRepository.cjs
├── workerConstants.cjs
└── workerValidation.cjs
```

## 3. Persistent session và cookie

Worker sử dụng đúng partition đã được Phase 04 tạo cho profile:

```text
persist:hh3d-profile-<safe-profile-id>-<hash>
```

`WorkerHttpClient` tạo request bằng Electron `net.request` với chính `Session` của partition và bật sử dụng cookie của session. Vì vậy Mini Browser và Worker của cùng một profile dùng chung cookie/session Chromium.

Cookie, token và nội dung credential không được đưa về React renderer và không được lưu vào log Worker.

## 4. Proxy

Trước mỗi request ban đầu, Worker gọi `ProxySessionManager.applyProxyToProfileSession(profileId)`.

- Profile không có proxy: dùng Direct.
- Profile có proxy hợp lệ: dùng đúng proxy đã gán.
- Proxy bị xóa, bị tắt hoặc cấu hình lỗi: Worker chuyển sang `proxy_error`.
- Nếu Chromium resolve thành `DIRECT` trong khi profile đang có proxy: request bị chặn.
- Không tự xoay proxy và không tự fallback sang Direct.

Proxy có username/password được xử lý trong Electron main bằng sự kiện `login` của `ClientRequest`. Credential chỉ được cung cấp khi `authInfo.isProxy === true` và host/port khớp proxy của profile. Credential không được dùng cho HTTP authentication của website.

## 5. Hàng đợi và concurrency

- Giới hạn toàn cục: 1–50 worker.
- Mặc định: 40.
- Profile vượt giới hạn chuyển sang trạng thái `queued` / `waiting`.
- Khi một worker dừng, profile tiếp theo trong hàng đợi được chạy.
- Batch có thể có giới hạn concurrency riêng nhưng vẫn không vượt giới hạn toàn cục.
- Start trùng một profile đang chạy hoặc đang chờ sẽ bị bỏ qua, không tạo worker thứ hai.

## 6. Trạng thái

Worker runtime hỗ trợ:

```text
stopped
queued
starting
running
stopping
error
proxy_error
login_required
```

Profile trong database được đồng bộ sang các trạng thái hiển thị tương ứng:

```text
stopped
waiting
running
proxy_error
login_required
```

Khi ứng dụng mở lại, worker không tự khôi phục. Các profile còn trạng thái `running` hoặc `waiting` từ lần chạy trước được chuẩn hóa về `stopped` mà không xóa cookie/session.

## 7. Network behavior của Phase 06A

Khi người dùng bấm Start:

1. Worker đi vào hàng đợi.
2. Khi có slot, Worker áp dụng Direct hoặc proxy của profile.
3. Worker thực hiện **một** request kiểm tra tới:

```text
https://hoathinh3d.st/
```

4. HTTP 2xx: chuyển `running`.
5. HTTP 401/403: chuyển `login_required`.
6. Proxy lỗi: chuyển `proxy_error`.
7. Sau đó chỉ có heartbeat nội bộ; không phát request mạng định kỳ.

Ứng dụng không tạo network request Worker lúc khởi động.

## 8. Batch, logs và settings

Schema database v3 bổ sung:

```json
{
  "schemaVersion": 3,
  "batches": [],
  "logs": [],
  "workerSettings": {},
  "activityConfig": {},
  "generalSettings": {}
}
```

Migration v2 → v3 giữ nguyên profile, group, proxy và các trường chưa biết.

- Batch được lưu vào `app-data.json`.
- Log Worker được lưu tối đa 2.000 dòng.
- Activity Settings và General Settings được lưu thật.
- Không có worker nào tự khởi chạy sau restart.

## 9. IPC

Các IPC Worker cụ thể:

```text
workers:start-profiles
workers:stop-profiles
workers:get-status
workers:list-statuses
workers:get-summary
workers:run-group
workers:stop-group
workers:status-changed
workers:summary-changed
```

Ngoài ra Phase 06A nối IPC thật cho batch, logs, activity settings, general settings và system stats. Không expose `ipcRenderer`, `invoke`, `send` hoặc `on` tổng quát.

## 10. Kiểm thử trên Windows

### Kiểm tra kỹ thuật

```cmd
npm install
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run electron:dev
```

### Kiểm tra runtime

1. Mở app và xác nhận không profile nào tự chạy.
2. Start một profile Direct; trạng thái phải đi `waiting → running`.
3. Stop profile; trạng thái trở về `stopped`.
4. Đặt concurrency = 2 rồi Start 5 profile; chỉ 2 profile chạy, 3 profile chờ.
5. Dừng một profile đang chạy; một profile chờ phải được chạy tiếp.
6. Start profile dùng proxy hoạt động; Worker phải chạy qua đúng session/proxy.
7. Start profile dùng proxy có auth; Worker phải dùng credential đã mã hóa mà không yêu cầu nhập lại.
8. Gán proxy hỏng; Worker phải chuyển `proxy_error`, không chạy Direct.
9. Start/Stop một nhóm.
10. Tạo batch, Start/Stop batch và restart app; batch/log/settings vẫn còn.
11. Đổi proxy khi Worker đang chạy; Worker phải dừng trước khi network config thay đổi.
12. Mở Mini Browser sau khi Worker dừng và xác nhận session đăng nhập vẫn còn.
13. Thoát app khi có Worker đang chạy; app phải dừng Worker an toàn. Mở lại không worker nào tự chạy.

## 11. Giới hạn hiện tại

- Chưa tích hợp Điểm Danh, Vấn Đáp, Tế Lễ, Bí Cảnh, Mê Cung hoặc module game khác.
- Chưa có lịch chạy định kỳ.
- Chưa có API command tùy ý từ renderer.
- Không có proxy rotation.
- Không sửa User-Agent hoặc fingerprint.
- Không tự đăng nhập.
- Không xử lý CAPTCHA hoặc Cloudflare bypass.

Các module game sẽ được đưa vào các phase sau dưới dạng task cố định, được kiểm tra và chạy trên nền Worker Core này.
