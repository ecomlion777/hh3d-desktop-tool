# Phase 03A – Local JSON Storage (HH3D Desktop Tool)

Tài liệu chi tiết cấu trúc, quy trình vận hành, kiến trúc kiên định và kiểm thử hệ thống lưu trữ JSON cục bộ (Local JSON Storage) cho ứng dụng HH3D Desktop Tool.

---

## 1. Vị Trí File Dữ Liệu Trên Hệ Thống

Dữ liệu profile và nhóm profile được lưu trữ hoàn toàn trong thư mục dữ liệu ứng dụng Electron (UserData Directory):

- **Thư mục lưu trữ chính**: `%APPDATA%\<app-name>\hh3d-data\` (trên Windows)
- **File dữ liệu chính**: `%APPDATA%\<app-name>\hh3d-data\app-data.json`
- **File sao lưu dự phòng (Backup)**: `%APPDATA%\<app-name>\hh3d-data\app-data.backup.json`
- **File ghi tạm thời (Temporary Write)**: `%APPDATA%\<app-name>\hh3d-data\app-data.tmp.json`

> **Lưu ý**: Dữ liệu người dùng hoàn toàn cách ly với nguồn mã nguồn (`src/`) cũng như thư mục biên dịch `dist/`.

---

## 2. Cấu Trúc File JSON (`app-data.json`)

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-07-23T04:15:00.000Z",
  "profiles": [
    {
      "id": "profile_1",
      "uid": "HH3D-88001",
      "displayName": "VũĐế_Pro_1",
      "characterName": "VũĐế_Pro_1",
      "avatarUrl": "https://api.dicebear.com/7.x/bottts/svg?seed=HH3D_Char_1",
      "groupId": "group_1",
      "group": "Nhóm Chính (Main)",
      "status": "stopped",
      "profilePath": "C:\\HH3D_AppData\\Profiles\\profile_1",
      "proxyId": "proxy_1",
      "proxyAddress": "103.142.10.100:8001",
      "level": 70,
      "stamina": 100,
      "createdAt": "2026-07-23T04:15:00.000Z",
      "updatedAt": "2026-07-23T04:15:00.000Z"
    }
  ],
  "groups": [
    {
      "id": "group_1",
      "name": "Nhóm Chính (Main)",
      "description": "Dàn clone chính cày cấp và săn boss top",
      "color": "#10b981",
      "createdAt": "2026-07-23T04:15:00.000Z",
      "updatedAt": "2026-07-23T04:15:00.000Z"
    }
  ]
}
```

---

## 3. Kiến Trúc Hàng Đợi Ghi An Toàn (Resilient Atomic Write Queue)

1. **Tự Động Seed & Validate Shape**:
   - Nếu file `app-data.json` chưa tồn tại, `JsonDatabase.cjs` tự động tạo thư mục và khởi tạo 200 profile mock cùng 5 nhóm mặc định.
   - Trước khi trả dữ liệu cho repository, `validateDatabaseShape` kiểm tra nghiêm ngặt `schemaVersion`, kiểu dữ liệu và thuộc tính bắt buộc của `profiles` & `groups`.

2. **Ghi Tức Thì Dựa Trên Deep Snapshot (`structuredClone` / `JSON.parse`)**:
   - Mọi thao tác lưu nhận bản sao sâu (snapshot) của dữ liệu tại thời điểm enqueue, ngăn ngừa hiện tượng biến đổi object ngoại vi làm hỏng dữ liệu đang nằm trong hàng đợi.

3. **Cơ Chế Phục Hồi Hàng Đợi (Write Queue Chain Catch Recovery)**:
   - Chuỗi `writePromiseChain` trong `JsonDatabase.cjs` tự động bắt lỗi bằng `.catch(...)` và trả chuỗi về trạng thái `Promise.resolve()`.
   - Nếu 1 thao tác ghi bị lỗi, duy nhất caller của thao tác đó nhận Promise rejection. Các thao tác ghi tiếp theo trong hàng đợi vẫn tiếp tục thực thi bình thường mà không bị ngắt quãng vĩnh viễn.

4. **Quy Trình Ghi 4 Bước An Toàn (Atomic Write Flow)**:
   - **Bước 1**: Ghi snapshot dữ liệu ra file tạm `app-data.tmp.json`.
   - **Bước 2**: Đọc lại và parse JSON từ `app-data.tmp.json` để xác nhận tính toàn vẹn cú pháp.
   - **Bước 3**: Tạo bản sao của `app-data.json` hiện tại thành `app-data.backup.json`.
   - **Bước 4**: Đổi tên `app-data.tmp.json` thành `app-data.json` nguyên tử.

---

## 4. Bất Biến Dữ Liệu & Tính Toán Nhóm Động (Repository Rules)

- **Nguyên Tắc Bất Biến (Immutability)**:
  - `ProfileRepository.cjs` và `GroupRepository.cjs` không bao giờ mutates trực tiếp mảng trả về từ `db.getData()`. Mọi thao tác thêm/sửa/xóa tạo bản sao mảng/object mới (`slice()`, `map()`, `filter()`).
- **Xử Lý Đồng Bộ Group / GroupId**:
  - `groupId` và tên nhóm (`group`) luôn được kiểm tra và đồng bộ tự động đối chiếu với danh sách nhóm thực tế.
  - Nếu nhóm bị xóa hoặc không tồn tại, profile được gỡ nhóm an toàn (`groupId = null`, `group = 'Chưa Phân Nhóm'`).
- **Thống Kê Nhóm Động (Dynamic Group Counting)**:
  - `GroupRepository.listGroups()` tính toán trực tiếp các chỉ số `profileCount`, `runningCount`, `waitingCount`, `stoppedCount` dựa trên danh sách `profiles` tại thời điểm gọi.

---

## 5. Tách Biệt Lớp Abstraction (Bridge & UI Decoupling)

- **Tránh Trực Tiếp Gọi `window.desktopBridge` Trong React Components**:
  - Mọi React components (`GeneralSettingsView`, `AppHeader`, v.v.) chỉ tương tác qua service `appBridge` hoặc custom hook `useAppBridge`.
- **Cơ Chế Báo Lỗi Khả Dụng Trong Electron (`ElectronPreloadBridge`)**:
  - Không fallback vô điều kiện về mock data khi chạy trong Electron. Nếu API IPC thiếu, bridge quăng ngoại lệ rõ ràng để phát hiện lỗi wiring.
  - `MockAppBridge` chỉ được khởi tạo lười (lazy getter) khi thực sự truy cập các tính năng chưa có IPC backend (proxies, batches, logs).

---

## 6. Quy Trình Kiểm Thử Persistence Trên Electron

Chạy các lệnh trong CMD hoặc PowerShell:

```bash
# 1. Khởi chạy Electron ở chế độ Development:
npm run electron:dev

# 2. Hoặc build và khởi chạy độc lập:
npm run build
npm run electron:start
```

**Các Bước Kiểm Thử Chức Năng**:
1. **Thêm Profile Mới**: Mở ứng dụng, tạo profile mới. Đóng Electron hoàn toàn và mở lại -> Profile vẫn tồn tại.
2. **Chỉnh Sửa Nhóm Profile**: Đổi tên hoặc màu sắc của một nhóm. Mở lại app -> Tên nhóm và tất cả các profile thuộc nhóm đã được cập nhật đồng bộ.
3. **Xóa Nhóm Profile**: Xóa nhóm. Mở lại app -> Nhóm đã biến mất, các profile thuộc nhóm cũ được chuyển sang `Chưa Phân Nhóm` (`groupId = null`), không profile nào bị mất dữ liệu.
4. **Kiểm Tra Cài Đặt Chung & Vị Trí File Backup**:
   - Truy cập trang **General Settings**.
   - Kiểm tra bảng thông tin **Local JSON Storage**: hiển thị đầy đủ đường dẫn thư mục `UserData` thực tế và nút **Xuất file JSON backup** hiển thị thông báo hướng dẫn file JSON đĩa thực.

