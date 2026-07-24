# Phase 11 — Module Chúc Phúc & Lì Xì Tiên Duyên

## Phạm vi

Module `chuc_phuc` thực hiện đúng hai bước:

1. Chúc phúc các phòng cưới Đạo Lữ và Hồng Nhan.
2. Nhận lì xì đang có sẵn trong Tiên Duyên.

Module `tien_duyen` sau này chỉ dành cho:

1. Cầu Nguyện.
2. Tặng hoa bạn bè.

Nhận lì xì không được chạy lặp lại trong module Tiên Duyên.

## API được sử dụng

Trang context:

`/tien-duyen`

REST action endpoint:

`/wp-json/hh3d/v1/action`

Actions:

- `show_all_wedding`
- `hh3d_add_blessing`
- `hh3d_receive_li_xi`

Endpoint Chúc Phúc Hồng Nhan:

`/wp-json/hh3d/v1/hong-nhan/bless`

## Luồng thực thi

1. Tải trang Tiên Duyên bằng persistent Chromium session của profile.
2. Lấy WordPress REST nonce và `securityToken`.
3. Nếu thiếu context, lấy bổ sung từ trang chủ.
4. Gọi `show_all_wedding` để lấy danh sách phòng cưới.
5. Với phòng Đạo Lữ chưa chúc: gọi `hh3d_add_blessing`.
6. Với phòng Hồng Nhan: dùng endpoint riêng vì trạng thái `has_blessed` có thể không chính xác.
7. Với phòng có `has_li_xi`: gọi `hh3d_receive_li_xi`.
8. Lưu kết quả, phần thưởng và `nextRunAt`.
9. Khi Worker còn chạy, module tự kiểm tra lại sau 30 phút.

## Thứ tự mặc định

1. Chúc Phúc
2. Điểm Danh
3. Vấn Đáp
4. Tế Lễ
5. Hoang Vực
6. Thí Luyện
7. Phúc Lợi
8. Bí Cảnh
9. Khoáng Mạch
10. Tiên Duyên
11. Mê Cung
12. Luyện Đan

Các module chưa được chuyển code vẫn ở trạng thái `planned` và không gửi request game.

## Bảo mật và session

- Cookie và nonce không được gửi về React renderer.
- Proxy credential không được ghi log.
- Module dùng đúng persistent partition và proxy đã gán cho profile.
- Proxy đã gán mà lỗi không được fallback sang Direct.
- Chỉ chấp nhận domain HTTPS trong cấu hình website hiện tại.

## Kết quả

Ví dụ thành công:

`Chúc Phúc: đã gửi 2 lời chúc, đã nhận 1 lì xì (50 Xu). Đã kiểm tra 4/4 phòng.`

Không có thao tác mới:

`Chúc Phúc: Không có phòng cưới mới hoặc lì xì cần nhận.`

## Mã lỗi

- `WORKER_LOGIN_REQUIRED`
- `CHUC_PHUC_PAGE_HTTP_ERROR`
- `CHUC_PHUC_NONCE_NOT_FOUND`
- `CHUC_PHUC_SECURITY_TOKEN_NOT_FOUND`
- `CHUC_PHUC_CONTEXT_REJECTED`
- `CHUC_PHUC_LIST_FAILED`
- `CHUC_PHUC_INVALID_RESPONSE`
- `CHUC_PHUC_ACTIONS_FAILED`

## Kiểm thử Windows

```cmd
npm run lint
npm run build
npm run test:phase08
npm run test:phase09
npm run test:phase10
npm run test:phase11
npm run electron:dev
```

Kiểm thử thật:

1. Chọn profile đã đăng nhập.
2. Vào Activity Settings → Chúc Phúc → Chạy thử.
3. Xác nhận lời chúc và lì xì được xử lý.
4. Chạy lại để xác nhận trạng thái đã hoàn tất không bị coi là lỗi.
5. Bật module cho profile rồi Start Worker.
6. Xác nhận Chúc Phúc chạy trước Điểm Danh.
7. Giữ Worker chạy và xác nhận module kiểm tra lại sau 30 phút.
