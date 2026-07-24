# Phase 12 Hotfix — Worker tiếp tục khi một module lỗi

## Lỗi đã sửa

1. Phản hồi `Đạo hữu đã gửi lời chúc cho phòng này rồi!` trước đây không khớp mẫu `already done`, nên bị phân loại thành `CHUC_PHUC_ACTIONS_FAILED`.
2. `ModuleRunner.runEnabledForProfile()` trước đây ném lỗi ngay tại module đầu tiên thất bại, làm Worker dừng và bỏ qua Vấn Đáp, Tế Lễ, Phúc Lợi cùng các module phía sau.
3. Module chạy theo lịch nếu lỗi cũng làm vòng Worker kết thúc.

## Cơ chế mới

- Các trạng thái Chúc Phúc đã hoàn thành được coi là `already_done`.
- Lỗi riêng của một module được ghi log nhưng Worker tiếp tục module kế tiếp.
- Module theo lịch lỗi sẽ được thử lại sau 5 phút, không làm profile dừng.
- Các lỗi sau vẫn dừng Worker ngay:
  - `WORKER_LOGIN_REQUIRED`
  - lỗi Proxy/Tunnel/SOCKS
  - phát hiện Direct fallback
  - yêu cầu Stop/Cancel
  - profile không còn tồn tại

## Kiểm tra

```cmd
npm run lint
npm run build
npm run test:phase11
npm run test:phase12
npm run electron:dev
```
