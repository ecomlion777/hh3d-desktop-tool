# Phase 10 Phúc Lợi Scheduler & Live Countdown Hotfix

## Lỗi đã sửa

Bản Phase 10 ban đầu chỉ chạy các module một lần khi Worker khởi động rồi chờ
lệnh Stop. Module Phúc Lợi có trả `nextRunAt`, nhưng Worker không có scheduler
để chạy lại module khi thời gian đó đến.

Giao diện cũng chỉ hiển thị chuỗi countdown được trả về ở lần request trước nên
đồng hồ đứng yên.

## Cơ chế mới

1. `ModuleRunner` vẫn ghi `nextRunAt` vào `moduleSettings`.
2. `ProfileWorkerManager` đọc module có lịch gần nhất trong khi Worker đang chạy.
3. Worker chờ tới đúng `nextRunAt`.
4. Khi đến giờ, Worker tự chạy lại module `phuc_loi`.
5. Sau khi mở rương, module lấy countdown mới từ máy chủ và lưu lịch kế tiếp.
6. Quy trình lặp lại cho tới khi đủ 4/4 rương hoặc người dùng dừng Worker.
7. Profile không có module lên lịch vẫn giữ trạng thái Running như trước.

## Countdown giao diện

`ProfileManagerView` sử dụng một đồng hồ UI chung, cập nhật mỗi giây:

- Cột **Hoạt động hiện tại** thay countdown cũ bằng countdown trực tiếp.
- Cột **Lần chạy tiếp** hiển thị `MM:SS` hoặc `HH:MM:SS`.
- Không ghi database mỗi giây.
- Nguồn thời gian là `profile.nextRunAt` do Electron main lưu.

## An toàn request

- Không polling API mỗi giây.
- Trong thời gian chờ chỉ có heartbeat nội bộ.
- API Phúc Lợi chỉ được gọi lại khi `nextRunAt` tới hạn.
- Có khoảng nghỉ tối thiểu 1 giây sau mỗi lần chạy để ngăn loop nếu server trả
  countdown lỗi.
- Session, proxy và cơ chế không fallback Direct được giữ nguyên.

## Cài đặt

Chép các file trong ZIP đè vào project rồi chạy:

```cmd
npm run lint
npm run build
npm run test:phase08
npm run test:phase09
npm run test:phase10
npm run electron:dev
```

## Kiểm thử thật

1. Bật Phúc Lợi cho một profile.
2. Start Worker.
3. Xác nhận countdown giảm từng giây.
4. Giữ Worker chạy tới `00:00`.
5. Xác nhận rương kế tiếp được mở tự động.
6. Xác nhận tiến độ tăng và countdown mới xuất hiện.
