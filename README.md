# HH3D Desktop Tool - Multi-Account Management Suite

Ứng dụng quản lý đa tài khoản dạng **Desktop Dashboard** chuyên nghiệp được xây dựng trên nền tảng **React**, **TypeScript** và **Tailwind CSS**.

---

## 🎯 Giới Thiệu Tổng Quan

HH3D Desktop Tool được thiết kế nhằm phục vụ việc điều phối và tự động hóa hàng trăm tài khoản game đồng thời. Ứng dụng cung cấp giao diện Desktop Native (chuẩn Electron) với hiệu năng cao, tối ưu hóa cho màn hình **1366x768** và **1920x1080**.

---

## 🏗️ Cấu Trúc Dự Án (Project Architecture)

Dự án được tổ chức theo mô hình mô-đun hóa hiện đại (Modular Architecture):

```
HH3D-Desktop-Tool/
├── src/
│   ├── components/
│   │   ├── layout/               # Thành phần khung ứng dụng Desktop Shell
│   │   │   ├── AppHeader.tsx     # Thanh công cụ trên (Window title, quick actions, search)
│   │   │   ├── AppSidebar.tsx    # Thanh điều hướng trái (Menu tab & danh sách Nhóm)
│   │   │   └── AppStatusBar.tsx  # Thanh trạng thái tổng ở đáy ứng dụng
│   │   ├── modals/               # Các cửa sổ Modal nổi
│   │   │   ├── MiniBrowserModal.tsx # Giả lập Electron Mini Browser Webview cho tài khoản
│   │   │   ├── AddProfileModal.tsx  # Modal thêm single hoặc bulk profile
│   │   │   ├── AddGroupModal.tsx    # Modal tạo nhóm quản lý mới
│   │   │   └── ProxyEditModal.tsx   # Modal nhập danh sách Proxy hàng loạt
│   │   └── views/                # Các màn hình chức năng chính
│   │       ├── DashboardView.tsx       # Màn hình Tổng Quan & Chỉ Số Hệ Thống
│   │       ├── ProfileManagerView.tsx  # Màn hình Bảng Profile chính (200 accounts)
│   │       ├── ProxyManagerView.tsx    # Màn hình Quản Lý Network Proxy (40 proxies)
│   │       ├── BatchManagerView.tsx    # Màn hình Lịch Chạy Tự Động Hàng Loạt
│   │       ├── ActivitySettingsView.tsx# Màn hình Tùy Chỉnh Kịch Bản Game (Lua/JSON)
│   │       ├── LogsView.tsx            # Màn hình Nhật Ký Hệ Thống Chi Tiết
│   │       └── GeneralSettingsView.tsx # Màn hình Cài Đặt Hệ Thống & Backup JSON
│   ├── services/
│   │   ├── desktopBridge.ts      # Service Abstraction (Mô hình cầu nối IPC)
│   │   └── mockDataGenerator.ts  # Trình tạo dữ liệu giả lập (200 profiles, 40 proxies)
│   ├── types/
│   │   └── index.ts              # Khai báo TypeScript strict interfaces
│   ├── App.tsx                   # Component gốc của ứng dụng
│   ├── main.tsx                  # Entry point React 19
│   └── index.css                 # Configuration CSS với Tailwind
├── metadata.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔌 Service Abstraction & Electron IPC Bridge

Ứng dụng áp dụng thiết kế **`IDesktopBridgeService` Abstraction**:

- Tất cả các thao tác dữ liệu (như `getProfiles()`, `startProfiles()`, `addProxiesBatch()`, `testProxy()`) được gọi thông qua giao diện `desktopBridge`.
- Khi chạy trên trình duyệt preview web, ứng dụng tự động chạy phiên bản `MockDesktopBridgeService` lưu cache vào `localStorage` và tự động mô phỏng thay đổi trạng thái theo thời gian thực.
- Khi đóng gói vào ứng dụng Electron thật, bạn chỉ cần thay `MockDesktopBridgeService` bằng `ElectronIPCBridgeService` (gọi `window.electron.ipcRenderer.invoke(...)`) mà **không cần chỉnh sửa bất kỳ component UI nào**.

---

## 📊 Bộ Dữ Liệu Khởi Tạo (Mock Data)

1. **200 Profiles**: Với tên nhân vật chuẩn tiếng Việt (ví dụ: `ThiênSứ_HH3D`, `ĐộcCô_CầuBại`), UID dạng `HH3D-XXXXX`, được phân bổ đều vào 5 nhóm.
2. **40 Proxies**: Địa chỉ IP SOCKS5/HTTP thực tế với chỉ số Latency (Ping ms) và trạng thái kết nối.
3. **5 Nhóm Quản Lý**:
   - Nhóm Chính (Main)
   - Nhóm Farm 01
   - Nhóm Farm 02
   - Nhóm Clone Guild
   - Nhóm VIP Speed

---

## ⚡ Các Bảng Lọc Trạng Thái (Status Filters)

Thanh trạng thái và bộ lọc hỗ trợ các trạng thái:
- **Running (Đang chạy)**: Đang bốt tự động.
- **Waiting (Đang chờ)**: Chờ hồi thể lực / Chờ mốc giờ hẹn kịch bản.
- **Stopped (Đã dừng)**: Tạm dừng lệnh.
- **Proxy Error (Lỗi Proxy)**: Mất kết nối đến Proxy SOCKS5.
- **Login Required (Cần đăng nhập)**: Hết hạn phiên làm việc.

---

## 🚀 Hướng Dẫn Chạy & Build Dự Án

```bash
# Cài đặt dependencies
npm install

# Khởi chạy giao diện phát triển (port 3000)
npm run dev

# Kiểm tra cú pháp TypeScript strict
npm run lint

# Build cho bản sản xuất
npm run build
```

---

*Phát triển bởi đội ngũ HH3D Automation Suite.*
