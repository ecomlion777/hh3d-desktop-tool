# Phase 04A – Direct Fix Report

Bản này được sửa trực tiếp từ `hh3d-phase-04a-mini-browser.zip(5).zip`, không qua AI Studio.

## Các lỗi đã sửa

- Đồng bộ đúng props giữa `App.tsx`, `ProfileManagerView` và toàn bộ modal liên quan.
- Sửa fallback `GeneralAppSettings` dùng đúng trường `theme`, `checkUpdateAuto`, `language`.
- Sửa Rules of Hooks trong các modal còn lỗi.
- Sửa lựa chọn mặc định của nhóm/proxy khi dữ liệu thay đổi.
- Bỏ `alert()` trong nút Mini Browser trên toolbar; lỗi được đưa vào banner ứng dụng.
- Ngăn lỗi tải trang ban đầu phát sự kiện `error` hai lần.
- Bổ sung permission policy mặc định từ chối quyền đặc biệt cho từng persistent partition.
- Sửa `clearStorageData()` không còn dùng quota không tương thích.
- Giữ nguyên partition SHA-256, HTTPS-only navigation, lifecycle đóng cửa sổ và JSON storage Phase 03A.
- Sửa hướng dẫn đường dẫn dữ liệu để không hard-code `%APPDATA%` sai.

## File đã sửa trực tiếp

- `electron/browser/ProfileBrowserManager.cjs`
- `src/App.tsx`
- `src/components/modals/AssignGroupModal.tsx`
- `src/components/modals/AssignProfilesToProxyModal.tsx`
- `src/components/modals/AssignProxyModal.tsx`
- `src/components/modals/ImportProfilesModal.tsx`
- `src/components/modals/ProxyEditModal.tsx`
- `src/components/modals/ToggleModulesModal.tsx`
- `src/components/views/GeneralSettingsView.tsx`
- `src/components/views/ProfileManagerView.tsx`
- `src/pages/ProfileManagerPage.tsx`

## Kiểm tra đã thực hiện trong môi trường sửa

- Toàn bộ file Electron `.cjs` vượt qua `node --check`.
- Kiểm tra tương thích TypeScript/TSX bằng TypeScript 5.8.3 và khai báo module ngoài tạm thời: đạt.
- Kiểm tra Rules of Hooks tĩnh trên toàn bộ modal: không còn hook nằm sau conditional return.
- Kiểm tra partition collision: các ID `profile:a`, `profile/a`, `profile?a`, `profile-a` tạo partition khác nhau.
- Kiểm tra URL guard: chỉ HTTPS của `hoathinh3d.co` và subdomain được cho phép.
- Mô phỏng initial load lỗi: chuỗi trạng thái cuối là `opening → loading → error`, không phát `error` hai lần.
- Mô phỏng browser unresponsive rồi người dùng đóng: trạng thái cuối là `closed`.
- Kiểm tra permission handler chỉ cấu hình một lần cho mỗi partition.
- Kiểm tra Clear Session gọi đúng `clearStorageData`, `clearCache`, `flushStorageData`.

## Cần xác nhận trên Windows

Sau khi chép source vào repository local, chạy:

```cmd
npm install
npm run lint
npm run build
npm run electron:dev
```

Sau đó kiểm thử session thật theo `README_MINI_BROWSER_SESSION.md`.
