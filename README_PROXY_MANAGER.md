# HH3D Desktop Tool — Phase 05A Proxy Manager

## 1. Phạm vi

Phase 05A bổ sung Proxy Manager thật cho Electron Desktop:

- CRUD và import proxy HTTP, HTTPS, SOCKS4, SOCKS5.
- Gán một proxy cho một hoặc nhiều profile.
- Áp proxy vào đúng persistent partition của profile trước khi mở Mini Browser.
- Hỗ trợ proxy có username/password bằng Electron `safeStorage`.
- Kiểm tra kết nối một lần qua Chromium networking và hiển thị IP công khai quan sát được cùng độ trễ.
- Không tự xoay proxy, không tự đổi IP, không sửa fingerprint và chưa có API Worker.

## 2. Kiến trúc

```text
React Proxy Manager
  → AppBridge
  → preload IPC cụ thể
  → Electron Main
      ├─ ProxyRepository
      ├─ ProxySecretStore
      ├─ ProxySessionManager
      ├─ ProxyTestService
      └─ ProfileBrowserManager
```

### Public metadata

Thông tin không bí mật được lưu trong:

```text
<app.getPath('userData')>/hh3d-data/app-data.json
```

Ví dụ:

```json
{
  "id": "proxy_...",
  "name": "Proxy 01",
  "protocol": "http",
  "host": "127.0.0.1",
  "port": 8080,
  "enabled": true,
  "authRequired": true,
  "hasCredentials": true
}
```

`app-data.json` không chứa username/password hoặc ciphertext của credential.

### Encrypted secrets

Credential được mã hóa riêng tại:

```text
<app.getPath('userData')>/hh3d-data/proxy-secrets.json
```

Các file hỗ trợ:

```text
proxy-secrets.tmp.json
proxy-secrets.backup.json
```

`ProxySecretStore` dùng:

- `safeStorage.isEncryptionAvailable()`
- `safeStorage.encryptString()`
- `safeStorage.decryptString()`

Encrypted `Buffer` được lưu dưới dạng Base64. Không có plaintext fallback. Nếu mã hóa hệ điều hành không khả dụng, proxy không xác thực vẫn dùng được nhưng lưu credential mới sẽ bị từ chối.

Credential được ràng buộc với môi trường người dùng hệ điều hành hiện tại. Không nên sao chép `proxy-secrets.json` sang tài khoản Windows hoặc máy khác và kỳ vọng giải mã thành công.

## 3. Database schema v2

Phase 05 nâng `app-data.json` lên:

```json
{
  "schemaVersion": 2,
  "profiles": [],
  "groups": [],
  "proxies": []
}
```

Migration v1 → v2 dùng atomic write và backup hiện có. Profile và group được giữ nguyên. Vì Phase 04 từng có các `proxyId` giả chỉ để hiển thị, migration lưu ID cũ vào `legacyProxyId`, đặt `proxyId` về `null` và khởi động Phase 05 ở Direct mode để tránh profile bị khóa bởi một proxy record không tồn tại.

Schema mới hơn phiên bản ứng dụng hỗ trợ sẽ bị từ chối thay vì bị ghi đè.

## 4. Proxy rules

Rule được dựng duy nhất trong Electron Main từ protocol/host/port đã validate:

```text
http://HOST:PORT
https://HOST:PORT
socks4://HOST:PORT
socks5://HOST:PORT
```

Cấu hình Electron:

```js
{
  mode: 'fixed_servers',
  proxyRules: '<generated rule>',
  proxyBypassRules: '<local>'
}
```

Không đưa username/password vào `proxyRules` và không thêm `direct://` fallback.

## 5. Áp proxy theo profile

Mỗi profile tiếp tục dùng partition Phase 04:

```text
persist:hh3d-profile-<safeSlug>-<sha256Hash>
```

Trước khi tạo Mini Browser:

1. Đọc profile và `proxyId` từ database.
2. Nếu không gán proxy, đặt session về `mode: direct`.
3. Nếu đã gán proxy, xác minh proxy tồn tại và đang bật.
4. Gọi `session.setProxy(...)`.
5. Reload cấu hình proxy khi API khả dụng.
6. Đóng các pooled connection cũ.
7. Gọi `resolveProxy(TARGET_URL)`.
8. Nếu kết quả chứa `DIRECT` trong khi profile đã gán proxy, từ chối mở Mini Browser với `PROXY_DIRECT_FALLBACK_DETECTED`.

Ứng dụng không tự chọn proxy khác và không tự bỏ `proxyId` khi cấu hình lỗi.

Khi đổi hoặc bỏ gán proxy trong lúc Mini Browser đang mở, cửa sổ được đóng hoàn toàn trước, cấu hình mạng mới được áp dụng, và ứng dụng không tự mở lại.

## 6. Proxy authentication

Credential chỉ được dùng khi Electron báo:

```js
authInfo.isProxy === true
```

Electron Main còn kiểm tra host và port của yêu cầu xác thực phải trùng proxy đã gán. Credential không được gửi cho Basic Auth của website. Mỗi lần mở browser giới hạn tối đa hai lần thử xác thực proxy để tránh vòng lặp vô hạn.

## 7. Proxy test

Mỗi test dùng một Electron session tạm, không có tiền tố `persist:` và không dùng partition thật của profile.

Quy trình:

1. Áp proxy vào session tạm.
2. Xác minh `resolveProxy()` không trả `DIRECT`.
3. Gửi request tới:

```text
https://api.ipify.org?format=json
```

4. Đo latency và đọc public IP nếu response hợp lệ.
5. Timeout mặc định 15 giây.
6. Đóng connection và xóa storage/cache của session test.

Kết quả chỉ nói test kết nối thành công hay thất bại và IP quan sát được; không khẳng định proxy ẩn danh hoặc an toàn.

Test nhiều proxy giới hạn tối đa 5 tác vụ đồng thời và không tự lặp ở nền.

## 8. Bulk import

Mỗi lần tối đa 500 dòng. Hỗ trợ:

```text
host:port
host:port:username:password
protocol://host:port
protocol://username:password@host:port
```

Protocol mặc định là HTTP. UI hiển thị preview valid/invalid trước khi lưu. Password không được đưa vào log hoặc lỗi hiển thị. Import không tự chạy test.

## 9. UI và IPC

Renderer chỉ nhận public proxy data, ví dụ:

- `hasCredentials`
- `maskedUsername`
- `assignedProfileCount`
- trạng thái test/IP/latency

Renderer không nhận:

- plaintext password
- decrypted credential object
- encrypted Base64
- nội dung secret file

Preload chỉ expose các IPC proxy cụ thể; không expose `ipcRenderer`, `invoke`, `send` hoặc `on` tổng quát.

## 10. Quy trình kiểm thử Windows

### Proxy không xác thực

1. Tạo proxy HTTP/HTTPS/SOCKS.
2. Bấm Test.
3. Xác nhận trạng thái, public IP và latency chỉ xuất hiện sau test thật.
4. Gán proxy cho Profile A.
5. Mở Mini Browser A và dùng một trang kiểm tra IP để đối chiếu.

### Proxy có xác thực

1. Tạo proxy với username/password.
2. Mở `app-data.json`: không được có password.
3. Mở `proxy-secrets.json`: chỉ có Base64 ciphertext, không có plaintext.
4. Restart Electron và xác nhận credential vẫn dùng được trên cùng tài khoản Windows.

### Cách ly profile

1. Gán Proxy A cho Profile A.
2. Gán Proxy B cho Profile B.
3. Mở từng Mini Browser và xác nhận IP khác nhau theo proxy tương ứng.
4. Cookie/session đăng nhập của hai profile vẫn độc lập như Phase 04.

### Không fallback Direct

1. Gán một proxy hỏng cho Profile C.
2. Mở Mini Browser C.
3. Browser phải báo lỗi proxy và không mở bằng đường truyền Direct.
4. Bỏ gán proxy rồi mở lại để kiểm tra Direct mode.

### Thay đổi và xóa

1. Đổi Profile A từ Proxy A sang Proxy B khi browser đang mở.
2. Xác nhận browser đóng và không tự mở lại.
3. Xóa Proxy B.
4. Profile vẫn tồn tại nhưng `proxyId` chuyển về `null`.
5. Cookie/session Mini Browser không bị xóa.

## 11. Kiểm tra kỹ thuật

```cmd
npm install
npm run lint
npm run build
npm run test:phase05
npm run electron:dev
```

Bài test `test:phase05` dùng Electron mocks để kiểm tra migration, mã hóa tách biệt, transaction, assignment và phát hiện Direct fallback. Nó không thay thế kiểm thử proxy mạng thật trên Windows.

## 12. Giới hạn Phase 05A

Chưa triển khai:

- API Worker.
- Proxy cho worker nền.
- Proxy rotation hoặc đổi IP tự động.
- Failover sang proxy khác.
- Browser fingerprint modification.
- Browser automation.
- Automatic login.
- CAPTCHA/Cloudflare bypass.
- IPv6 proxy host.

Không chỉnh sửa hoặc xóa thủ công `app-data.json` hay `proxy-secrets.json` khi Electron đang chạy.

---

## Phase 05B — Gán nhanh Proxy 1-1

Profile Manager có nút **Gán Proxy 1-1** để ghép N profile với N proxy khác nhau trong một transaction. Có bảng xem trước, phát hiện proxy thiếu/trùng, giữ mapping hợp lệ và tùy chọn chỉ dùng proxy Online. Khởi chạy nhiều profile hoặc chạy nhóm sẽ bị chặn nếu thiếu proxy, proxy bị tắt hoặc có proxy trùng trong cùng nhóm chạy.

Xem chi tiết tại `README_PHASE05B_ONE_TO_ONE_PROXY.md`.
