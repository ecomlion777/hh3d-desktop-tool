# Phase 10 — Module Phúc Lợi

## Mục tiêu

Chuyển Phúc Lợi Đường từ userscript HH3D sang Module Framework/API Worker.
Module chạy trong Electron main bằng persistent Chromium session và proxy của
profile, không cần mở Mini Browser.

## Luồng thực thi

1. Tải `/phuc-loi-duong` bằng session của profile.
2. Kiểm tra đăng nhập.
3. Lấy `securityToken`/`security_token`.
4. Đọc action map động `plTimer`, `plOpen`, `plClaim` từ `hh3dData` hoặc dữ liệu
   được mã hóa bằng biến `k`/`d`.
5. Gọi theme AJAX `get_next_time_pl` để lấy tiến độ rương và countdown.
6. Nếu countdown bằng `00:00`, mở đúng rương kế tiếp bằng `open_chest_pl`.
7. Tải lại trạng thái từ server để lấy countdown thật của VIP hoặc tài khoản
   thường, không tự đoán thời gian.
8. Trong hai ngày cuối tháng theo múi giờ Việt Nam, thử nhận bonus mốc 1–4 bằng
   `claim_bonus_reward`; dừng khi gặp mốc chưa đủ điều kiện.

## Tương thích frontend

Module hỗ trợ đồng thời:

- Action động trong `hh3dData.act`.
- Action map XOR/Base64 trong biến `k` và `d`.
- Action name cũ như `get_next_time_pl`.
- Field `security` cũ nằm cạnh từng action.
- `securityToken` camelCase và `security_token` snake_case.
- Tên miền động của Phase 06B.

## Kết quả

- `waiting`: chưa đến giờ mở rương tiếp theo.
- `opened`: vừa mở một rương và đã tải lại countdown.
- `already_done`: đã hoàn tất 4/4 rương.
- `WORKER_LOGIN_REQUIRED`: session hết hạn hoặc chưa đăng nhập.
- `PHUC_LOI_*`: lỗi context, phản hồi hoặc mở rương.

`nextRunAt` được lưu theo countdown server. Phase 10 chưa tự tạo scheduler chạy
lại module; người dùng có thể chạy lại thủ công hoặc trong lần Worker kế tiếp.

## An toàn

- Không log security token, action token, cookie hoặc proxy credential.
- Không fallback Direct khi profile đã gán proxy.
- Không tải hoặc thực thi JavaScript từ website.
- Không tự gửi request lặp vô hạn.
- Bonus tháng chỉ được thử trong hai ngày cuối tháng và tối đa 4 request.
