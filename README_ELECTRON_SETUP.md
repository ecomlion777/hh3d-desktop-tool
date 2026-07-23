# Hướng Dẫn Cấu Hình & Chạy HH3D Desktop Shell (Electron)

Tài liệu hướng dẫn khởi chạy ứng dụng HH3D Desktop Tool ở chế độ Electron Desktop Shell tối thiểu trên Windows (CMD / PowerShell).

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

- **Node.js**: v18.x trở lên (khuyên dùng Node 20 LTS hoặc Node 22)
- **npm**: v9.x trở lên
- **Hệ điều hành**: Windows 10/11 (CMD hoặc PowerShell)

---

## 2. Cài Đặt Dependencies

Mở terminal CMD hoặc PowerShell tại thư mục gốc của project và chạy:

```bash
npm install
```

> **Ghi chú**: Phiên bản Electron được khóa chính xác ở `39.8.10`.

---

## 3. Các Lệnh Khởi Chạy (Available NPM Scripts)

### A. Chạy bản Web Browser thuần túy (Development Mode):
```bash
npm run dev
```
Mở giao diện Web React thuần tại: `http://localhost:3000` (dùng simulated Mock IPC Bridge).

---

### B. Chạy Electron ở chế độ Development (Hot Reloading Web + Desktop Window):
```bash
npm run electron:dev
```
- Tự động chạy Vite Dev Server tại `http://127.0.0.1:3000`
- Chờ server sẵn sàng rồi mở cửa sổ Electron Desktop Shell kết nối trực tiếp tới Dev Server.

---

### C. Build ứng dụng React:
```bash
npm run build
```
Biên dịch ứng dụng React thành bundle tĩnh trong thư mục `dist/`.

---

### D. Chạy Electron bằng bản Production Bundle (sau khi npm run build):
```bash
npm run electron:start
```
Mở cửa sổ Electron Desktop Shell độc lập, tải trực tiếp file `dist/index.html` từ ổ đĩa local mà không cần web server hay kết nối internet.

---

## 4. Cấu Trúc Electron Shell

- `electron/main.cjs`: Tiến trình chính (Main Process), quản lý BrowserWindow, vòng đời ứng dụng, bảo mật sandbox, và IPC Handler `app:get-versions`.
- `electron/preload.cjs`: Preload script sử dụng `contextBridge` để expose an toàn API `window.desktopBridge.getVersions()`.
- `src/types/electron.d.ts`: Khai báo kiểu dữ liệu TypeScript cho `window.desktopBridge`.

---

## 5. Tính Năng Bảo Mật Trong Shell

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- Khóa duy nhất 1 Instance (`app.requestSingleInstanceLock()`)
- Chặn điều hướng ngoài (`will-navigate`) và chặn mở cửa sổ lạ (`setWindowOpenHandler`)
