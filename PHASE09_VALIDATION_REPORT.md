# Phase 09 Validation Report — Tế Lễ

## Kết quả

```text
PASS
```

## Kiểm tra đã chạy

- Cú pháp toàn bộ Electron/test `.cjs`.
- Phase 05B Proxy Manager regression.
- Phase 06 API Worker Core regression.
- Phase 06B Dynamic Domain regression.
- Phase 07 Module Framework regression.
- Phase 08 Điểm Danh regression.
- Phase 09 Tế Lễ integration test.

## Phase 09 assertions

- `te_le` được đánh dấu `ready`, version `1.0.0`.
- Module handler được đăng ký trong Electron main.
- Trích xuất `security_token` từ JavaScript, input và data attribute.
- Trích xuất REST nonce từ trang thành viên.
- Fallback lấy nonce từ trang chủ.
- Gửi đúng endpoint và action Tế Lễ.
- Gửi security token trong header và JSON body.
- Retry nonce/security token đúng một lần.
- Nhận diện đã tế lễ là kết quả hoàn thành.
- Nhận diện session hết hạn.
- Nhận diện tài khoản chưa thuộc Tông Môn.
- ModuleRunner lưu result và log thành công.
- Không thay đổi database schemaVersion 4.
- Không thêm dependency.
- Electron giữ nguyên `39.8.10`.

## Kết quả test

```json
{
  "status": "PASS",
  "module": "te_le",
  "endpoint": "/wp-json/tong-mon/v1/te-le-tong-mon",
  "action": "te_le_tong_mon",
  "securityTokenExtraction": true,
  "nonceExtraction": true,
  "securityContextRetry": true,
  "alreadyDoneAccepted": true,
  "loginRequiredDetected": true,
  "clanMembershipErrorDetected": true,
  "runnerIntegration": true
}
```

## Chưa kiểm thử trong môi trường đóng gói

- `npm run lint` với dependency local đầy đủ.
- `npm run build` với Vite local.
- API Tế Lễ thật trên Windows và tài khoản người dùng.

Các bước này phải được xác nhận trên máy Windows trước khi commit/tag Phase 09.
