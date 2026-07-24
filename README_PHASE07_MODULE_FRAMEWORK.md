# Phase 07 — Module Framework

## 1. Mục tiêu

Phase 07 tạo lớp kiến trúc để các chức năng HH3D được chuyển từ userscript sang Electron API Worker theo từng module độc lập, có kiểm soát và có trạng thái rõ ràng.

Phase này **không triển khai hành động game**. Các module game được đăng ký ở trạng thái `planned`; chỉ hai module nền được phép chạy:

- `session_check`: kiểm tra persistent Chromium session/network trước khi Worker hoạt động.
- `framework_diagnostic`: chẩn đoán registry/context/logging và không gửi request mạng.

## 2. Kiến trúc

```text
electron/modules/
├── ModuleRegistry.cjs
├── ModuleRunner.cjs
├── ModuleSettingsRepository.cjs
├── moduleConstants.cjs
├── moduleValidation.cjs
└── builtin/
    ├── SessionCheckModule.cjs
    └── FrameworkDiagnosticModule.cjs
```

### ModuleRegistry

- Lưu manifest cố định của từng module.
- Chặn module trùng `code`.
- Chỉ module `implementationState: ready` mới được đăng ký handler.
- `runnable` chỉ bằng `true` khi manifest sẵn sàng và thực sự có handler trong Electron main.

### ModuleSettingsRepository

- Lưu cấu hình module riêng theo từng profile.
- Gán module cho nhiều profile trong một transaction JSON duy nhất.
- Đồng bộ `profiles.enabledModules` để giữ khả năng tương thích với UI cũ.
- Module bắt buộc `session_check` luôn được bật.

### ModuleRunner

- Chỉ chạy module đã đăng ký trong main process.
- Renderer không được gửi URL, method hoặc request tùy ý.
- Kiểm tra profile, module, trạng thái triển khai, trigger và cấu hình trước khi chạy.
- Chặn hai lần chạy đồng thời cùng một module trên cùng profile.
- Có `AbortSignal`, timeout cứng, runtime status và log.
- Timeout vẫn kết thúc ở lớp framework nếu handler tương lai quên xử lý `AbortSignal`.

### ProfileWorkerManager

Worker Core không còn tự gọi probe trực tiếp. Khi Start profile:

1. Chạy module bắt buộc `session_check`.
2. Khi session/network sẵn sàng, profile chuyển `Running`.
3. Chạy tuần tự các module `ready`, đã bật và hỗ trợ trigger `worker_start`.
4. Module `planned` không bao giờ được gọi.

## 3. Database schema v4

Phase 07 migration:

```text
schemaVersion 3 → schemaVersion 4
```

Thêm trường:

```json
{
  "moduleSettings": []
}
```

Mỗi bản ghi có dạng:

```json
{
  "profileId": "profile_1",
  "moduleCode": "framework_diagnostic",
  "enabled": false,
  "config": {},
  "lastResult": "success",
  "lastRunAt": "ISO_DATE",
  "nextRunAt": null,
  "settingsVersion": 1,
  "updatedAt": "ISO_DATE"
}
```

Migration giữ nguyên profile, nhóm, proxy, credential, batch, log, Worker settings và tên miền động của các phase trước.

## 4. Danh mục module

Danh mục Phase 07 gồm 17 module:

### Sẵn sàng

- Kiểm tra Session / Network
- Chẩn đoán Module Framework

### Đã đăng ký nhưng chờ chuyển code

- Điểm Danh
- Tế Lễ
- Vấn Đáp
- Thí Luyện
- Phúc Lợi
- Hoang Vực
- Bí Cảnh
- Khoáng Mạch
- Tiên Duyên
- Luyện Đan
- Mê Cung
- Đổ Thạch
- Bảng Hoạt Động Ngày
- Vòng Quay Phúc Vận
- Mã Thưởng

Các module chờ chuyển code có thể được lưu lựa chọn theo profile nhưng nút chạy bị vô hiệu hóa và backend trả `MODULE_NOT_IMPLEMENTED` nếu bị gọi trái phép.

## 5. IPC an toàn

Các channel cụ thể:

```text
modules:list-catalog
modules:get-profile-settings
modules:save-profile-settings
modules:apply-to-profiles
modules:run-once
modules:get-runtime-status
modules:list-runtime-statuses
modules:status-changed
modules:settings-changed
```

Preload chỉ expose từng hàm cụ thể. Không expose `ipcRenderer`, `invoke`, `send`, `on` tổng quát hay một API HTTP tùy ý.

## 6. Giao diện

### Activity Settings

- Hiển thị toàn bộ catalog.
- Phân biệt `Ready` và `Planned`.
- Chọn profile để chạy thử module thủ công.
- Hiển thị runtime state, thời gian và lỗi thật.
- Giữ phần cấu hình concurrency Worker.

### Profile Manager

- Chọn một hoặc nhiều profile.
- Mở modal Module.
- Bật/tắt theo catalog thật.
- Module bắt buộc bị khóa.
- Module `planned` được đánh dấu rõ là chưa triển khai.

## 7. Bảo mật và giới hạn

- Không gọi API game trong Phase 07.
- Không thực thi code/module tải từ xa.
- Không dùng `eval`, `new Function` hoặc dynamic module path từ renderer.
- Không thay đổi User-Agent, fingerprint, TLS hoặc Chromium security.
- Không thêm proxy rotation, CAPTCHA/Cloudflare bypass hoặc browser automation.
- Không tự chạy module lúc khởi động ứng dụng.
- Module chỉ chạy khi người dùng Start Worker hoặc bấm chạy thử.

## 8. Kiểm thử Windows

Chạy:

```cmd
npm install
npm run lint
npm run build
npm run test:phase05b
npm run test:phase06
npm run test:phase06b
npm run test:phase07
npm run electron:dev
```

Kiểm tra thủ công:

1. Mở Activity Settings và xác nhận có 17 module.
2. Chạy `Chẩn đoán Module Framework`; phải thành công mà không làm thay đổi IP/network.
3. Chạy `Kiểm tra Session / Network`; phải trả HTTP 200 với profile/proxy hợp lệ.
4. Module `Khoáng Mạch` hoặc module planned khác không có nút chạy khả dụng.
5. Chọn nhiều profile trong Profile Manager và lưu lựa chọn module.
6. Đóng/mở Electron; lựa chọn module vẫn còn.
7. Start profile; Worker vẫn đi qua `session_check` và proxy đúng của profile.
8. Proxy hỏng vẫn không fallback Direct.

## 9. Hướng phát triển tiếp theo

Các phase sau sẽ chuyển từng module game vào handler riêng. Mỗi module phải có test parser/token/request riêng và không sửa lan sang module đã ổn định.
