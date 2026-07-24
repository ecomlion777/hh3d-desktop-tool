# HH3D Desktop Tool — Phase 09: Module Tế Lễ

## Mục tiêu

Chuyển chức năng **Tế Lễ Tông Môn** từ userscript HH3D sang Module Framework/API Worker của ứng dụng desktop.

Module chạy trong Electron main process, sử dụng đúng:

- Persistent Chromium session của profile.
- Cookie đăng nhập của profile.
- Proxy hoặc Direct mode đã cấu hình cho profile.
- Tên miền website động trong General Settings.

Mini Browser không cần mở trong lúc module chạy, nhưng profile phải được đăng nhập thủ công ít nhất một lần trước đó.

## Luồng thực thi

1. Tải trang `/danh-sach-thanh-vien-tong-mon` với cache-busting.
2. Kiểm tra profile còn đăng nhập.
3. Trích xuất `security_token` từ HTML.
4. Trích xuất WordPress REST nonce từ trang thành viên.
5. Nếu trang thành viên không có nonce, tải trang chủ để lấy nonce.
6. Gửi `POST /wp-json/tong-mon/v1/te-le-tong-mon`.
7. Payload:

```json
{
  "action": "te_le_tong_mon",
  "security_token": "<internal>"
}
```

8. Gửi nonce và security token trong header theo cơ chế website.
9. Nếu nonce hoặc security token hết hạn, tải lại context và thử đúng một lần.
10. Phân tích kết quả, ghi runtime status và log module.

## Bảo mật

- Không trả nonce hoặc security token về React renderer.
- Không ghi nonce, security token, cookie hay proxy credential vào log.
- Renderer không được truyền URL hoặc action tùy ý cho module.
- Proxy đã gán nhưng lỗi sẽ không fallback sang Direct.
- Chỉ dùng URL được WebsiteConfigService cho phép.

## Kết quả module

### Thành công mới

```text
outcome: success
Tế Lễ: Tế lễ thành công (N cống hiến)
```

### Đã tế lễ trong ngày

```text
outcome: already_done
Tế Lễ: Bạn đã tế lễ hôm nay rồi
```

Trường hợp đã tế lễ vẫn được xem là hoàn thành, không phải lỗi Worker.

## Mã lỗi

- `WORKER_LOGIN_REQUIRED`: Profile chưa đăng nhập hoặc session hết hạn.
- `TE_LE_PAGE_HTTP_ERROR`: Không tải được trang thành viên Tông Môn.
- `TE_LE_SECURITY_TOKEN_NOT_FOUND`: Không tìm thấy security token.
- `TE_LE_NONCE_NOT_FOUND`: Không tìm thấy REST nonce.
- `TE_LE_CONTEXT_REJECTED`: Nonce/security token bị từ chối sau lần tải lại.
- `TE_LE_INVALID_RESPONSE`: Máy chủ trả dữ liệu không phải JSON hợp lệ.
- `TE_LE_NOT_IN_CLAN`: Tài khoản chưa thuộc Tông Môn.
- `TE_LE_FAILED`: API Tế Lễ trả lỗi khác.

## Kiểm thử trên Windows

```cmd
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run test:phase06b
npm run test:phase07
npm run test:phase08
npm run test:phase09
npm run electron:dev
```

### Chạy thử thủ công

1. Đăng nhập profile qua Mini Browser.
2. Vào Activity Settings.
3. Chọn profile.
4. Bấm **Chạy thử** tại module **Tế Lễ**.
5. Xác nhận kết quả Success hoặc Already Done.

### Chạy qua Worker

1. Chọn profile trong Profile Manager.
2. Mở **Module**.
3. Bật **Tế Lễ**.
4. Bấm Start Worker.
5. Worker chạy theo thứ tự module đã bật.

## Giới hạn Phase 09

- Không tự gia nhập Tông Môn.
- Không tự đăng nhập tài khoản.
- Không tự đổi Tông Môn.
- Không lặp request sau khi hoàn thành.
- Không triển khai Vấn Đáp hoặc Bí Cảnh trong phase này.
