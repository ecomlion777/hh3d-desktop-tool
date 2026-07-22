# Hướng Dẫn Phát Triển Cục Bộ (Local Development Guide) - HH3D Desktop Tool

Tài liệu này hướng dẫn chi tiết cách thiết lập, cài đặt dependencies, chạy ứng dụng và đóng gói **HH3D Desktop Tool** hoàn toàn độc lập trên môi trường máy tính cục bộ (Local Development Environment).

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

- **Node.js**: Phiên bản `>= 18.0.0` (Khuyên dùng LTS 20.x hoặc mới hơn).
- **npm**: Phiên bản `>= 9.0.0` (đi kèm Node.js) hoặc **yarn** / **pnpm**.
- **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux.

---

## 🚀 Các Bước Khởi Chạy Cục Bộ

### Bước 1: Cài đặt Dependencies

Mở terminal tại thư mục gốc của dự án và chạy lệnh:

```bash
npm install
```

Lệnh này sẽ tự động tải và cài đặt toàn bộ các thư viện cần thiết (`react`, `react-dom`, `lucide-react`, `motion`, `vite`, `tailwindcss`, `typescript`, ...).

### Bước 2: Thiết lập Cấu Hình Môi Trường (Tùy chọn)

Dự án có sẵn file cấu hình mẫu `.env.example`. Bạn có thể sao chép thành `.env` nếu cần tùy chỉnh:

```bash
cp .env.example .env
```

*(Lưu ý: Ứng dụng hoạt động thuần túy client-side / offline desktop mode, không yêu cầu bất kỳ API Key hay Secret Key nào).*

### Bước 3: Khởi Chạy Server Phát Triển (Dev Server)

Chạy lệnh dev:

```bash
npm run dev
```

Sau khi chạy xong, mở trình duyệt web và truy cập địa chỉ:
```
http://localhost:3000
```

---

## 📜 Danh Sách Chi Tiết npm Scripts

Toàn bộ các lệnh npm scripts có sẵn trong file `package.json`:

| Lệnh npm | Lệnh thực thi thực tế | Mô tả chức năng |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port=3000 --host=0.0.0.0` | Khởi chạy Vite Dev Server ở cổng 3000, lắng nghe tất cả network interfaces (`0.0.0.0`), hỗ trợ Hot Module Reloading (HMR) cực nhanh. |
| `npm run build` | `vite build` | Biên dịch toàn bộ mã nguồn React & TypeScript sang mã sản xuất (production build) được tối ưu hóa trong thư mục `dist/`. |
| `npm run preview` | `vite preview` | Khởi chạy máy chủ HTTP tĩnh nhẹ để kiểm tra bản build trong thư mục `dist/` trước khi đóng gói hoặc triển khai. |
| `npm run lint` | `tsc --noEmit` | Kiểm tra cú pháp TypeScript và kiểm lỗi Type Safety trên toàn bộ codebase mà không sinh ra file output. |
| `npm run clean` | `rm -rf dist` | Dọn dẹp thư mục đầu ra `dist/` để chuẩn bị cho lượt build mới. |

---

## 🏛️ Kiến Trúc Hoạt Động & Lưu Trữ Dữ Liệu Cục Bộ

1. **Không Phụ Thuộc Cloud Database / External Services**:
   - Mọi dữ liệu về **Profiles (200 tài khoản)**, **Proxies (40 IP)**, **Nhóm**, **Kịch Bản Game**, và **Batch Tasks** được lưu trữ an toàn trong **`localStorage`** của trình duyệt hoặc máy tính cá nhân.
   - Khi khởi chạy lần đầu, ứng dụng tự động nạp dữ liệu khởi tạo chuẩn (seed mock data) từ `/src/mock/mockData.ts`.

2. **Không Phụ Thuộc Google AI Studio Runtime hay Gemini API**:
   - Ứng dụng là một **Desktop Operations Manager** thuần túy.
   - Không chứa bất kỳ lời gọi API nào tới Google AI Studio hay Gemini AI API.

3. **Khả Năng Đóng Gói Sang Electron Desktop App**:
   - Ứng dụng được thiết kế theo giao diện abstraction `AppBridge` (`/src/services/appBridgeService.ts`).
   - Môi trường trình duyệt: Chạy giao diện giả lập `MockAppBridge`.
   - Môi trường Electron Native: Tự động nhận diện `window.electron.ipcRenderer` để giao tiếp trực tiếp với tiến trình Main của Electron qua IPC Bridge.

---

## 🛠️ Cấu Trúc Thư Mục Dự Án (Project Structure)

```
/
├── src/
│   ├── components/
│   │   ├── layout/          # Desktop Shell (Header, Sidebar, StatusBar)
│   │   ├── modals/          # Cửa sổ nổi (Add Profile, MiniBrowser, Create Batch...)
│   │   └── views/           # Các màn hình chính (Dashboard, Profiles, Proxies, Batches, Settings...)
│   ├── hooks/               # Custom React Hooks (useAppBridge)
│   ├── mock/                # Dữ liệu khởi tạo ban đầu (200 Profiles, 40 Proxies)
│   ├── pages/               # Tầng bọc trang chính
│   ├── services/            # Bridge Layer (AppBridge, desktopBridge)
│   ├── shared/              # Types & Models chung
│   ├── types/               # TypeScript interfaces
│   ├── utils/               # Helper utilities (proxyParser, ...)
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind CSS style entry
├── .env.example             # Biến môi trường mẫu
├── package.json             # Cấu hình dự án & dependencies
├── tsconfig.json            # Cấu hình TypeScript
├── vite.config.ts           # Cấu hình Vite bundler
└── README_LOCAL_DEVELOPMENT.md
```

---

*Tài liệu được cập nhật cho phiên bản phát triển độc lập cục bộ HH3D Desktop Tool.*
