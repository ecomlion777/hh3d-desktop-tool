# Phase 05B — Gán Proxy nhanh kiểu GPM Login

## Mục tiêu

Tính năng này thay cơ chế bắt buộc “đủ N profile phải có đủ N proxy” bằng một luồng gán linh hoạt:

- Chọn bất kỳ số lượng profile nào.
- Dán danh sách proxy theo từng dòng.
- Chọn số lượng cần gán từ `1` đến `min(số profile đã chọn, số proxy hợp lệ)`.
- Dòng proxy thứ nhất gán cho profile thứ nhất, dòng thứ hai gán cho profile thứ hai.
- Proxy mới được import vào Proxy Manager và gán ngay trong cùng thao tác người dùng.
- Profile không nằm trong số lượng được gán giữ nguyên proxy hiện tại hoặc Direct.
- Luồng Start/Run không còn yêu cầu tất cả profile phải có proxy và không còn chặn vì proxy bị trùng.

## Cách sử dụng

1. Tại Profile Manager, tick các profile cần thao tác.
2. Bấm **Đặt Proxy nhanh**.
3. Dán danh sách proxy, một proxy mỗi dòng.
4. Nhập **Số lượng cần gán**.
5. Kiểm tra bảng xem trước.
6. Bấm **Áp dụng**.

## Định dạng proxy hỗ trợ

```text
host:port
host:port:username:password
protocol://host:port
protocol://username:password@host:port
```

Protocol mặc định là `http`.

## Quy tắc

- Chỉ các dòng proxy hợp lệ và không trùng hoàn toàn được dùng.
- Nếu chọn 40 profile nhưng chỉ dán 12 proxy, có thể gán cho 12 profile đầu; 28 profile còn lại không bị thay đổi.
- Nếu dán 50 proxy nhưng chỉ chọn 20 profile, tối đa 20 proxy được import và gán; phần dư không được import.
- Proxy không xác thực đã tồn tại và đang bật sẽ được dùng lại theo endpoint.
- Proxy có xác thực được import thành record riêng để không làm sai credential khi nhiều tài khoản dùng chung gateway host/port.
- Mini Browser đang mở của profile được gán sẽ được đóng bởi IPC gán 1-1 hiện có trước khi cập nhật.
- Không tự động mở lại Mini Browser.

## Luồng chạy

Start profile hoặc Run Group không phụ thuộc số lượng proxy:

- Profile không có proxy: dùng Direct khi mở network session.
- Profile có proxy: ProxySessionManager áp đúng proxy đã gán.
- Proxy đã gán nhưng lỗi: profile đó báo lỗi proxy và không fallback Direct.

## Không thay đổi

- Electron 39.8.10.
- Mã hóa credential bằng safeStorage.
- Phase 03 JSON transaction.
- Phase 04 persistent Mini Browser session.
- Không proxy rotation, browser automation hoặc API Worker.
