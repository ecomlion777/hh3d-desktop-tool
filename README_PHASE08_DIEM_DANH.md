# Phase 08 — Module Điểm Danh

## Mục tiêu

Phase 08 chuyển module game thật đầu tiên vào API Worker: **Điểm Danh**.
Module chạy hoàn toàn trong Electron main process, dùng đúng persistent Chromium
session, cookie và proxy của profile.

## Luồng thực thi

1. Worker hoặc người dùng chạy module `diem_danh`.
2. Module tải `/diem-danh` để lấy WordPress REST nonce.
3. Nếu trang Điểm Danh không có nonce, module thử trang chủ một lần.
4. Module gửi `POST /wp-json/hh3d/v1/action` với body:

```json
{ "action": "daily_check_in" }
```

5. Header gửi kèm `X-WP-Nonce`, `X-Requested-With`, `Origin` và `Referer`.
6. Nếu nonce bị hết hạn, module tải nonce mới và thử lại đúng một lần.
7. Kết quả thành công hoặc "đã điểm danh rồi" đều được lưu là kết quả hợp lệ.

## An toàn

- Renderer không được truyền URL hoặc action tùy ý.
- Endpoint và action được cố định trong module Electron.
- Không log cookie, nonce hoặc proxy credential.
- Proxy lỗi không fallback Direct.
- Module nhận AbortSignal và timeout từ ModuleRunner.
- Profile chưa đăng nhập trả `WORKER_LOGIN_REQUIRED`.

## Kích hoạt

- Chạy thử tại **Activity Settings → Điểm Danh → Chạy thử**.
- Bật Điểm Danh cho profile tại **Profile Manager → Module**.
- Khi profile được Start, Worker chạy `session_check` trước rồi mới chạy Điểm Danh.

## Kết quả

Các outcome chính:

- `success`: điểm danh mới thành công.
- `already_done`: tài khoản đã điểm danh trong ngày.
- `WORKER_LOGIN_REQUIRED`: session chưa đăng nhập hoặc đã hết hạn.
- `DIEM_DANH_NONCE_NOT_FOUND`: không lấy được REST nonce.
- `DIEM_DANH_NONCE_REJECTED`: nonce vẫn bị từ chối sau lần tải lại.
- `DIEM_DANH_FAILED`: API trả lỗi nghiệp vụ khác.

## Giới hạn

- Chưa có lịch chạy tự động theo giờ/ngày.
- Module chạy một lần khi Worker được Start hoặc khi người dùng bấm Chạy thử.
- Các module Tế Lễ, Vấn Đáp và hoạt động khác vẫn ở trạng thái Planned.
