# HH3D Desktop Tool — Phase 12: Module Vấn Đáp Smart

## 1. Phạm vi

Phase 12 chuyển module Vấn Đáp Smart từ userscript `v2.5.8.1` sang Electron API Worker.
Module chạy trong Electron main process, dùng persistent Chromium session và proxy của từng profile, không cần mở Mini Browser khi thực thi.

## 2. Luồng thực thi

1. Tải ngân hàng QA từ URL cố định của userscript.
2. Dùng cache dùng chung toàn ứng dụng trong 60 phút.
3. Lưu cache đã kiểm tra hợp lệ tại:
   `<userData>/hh3d-data/van-dap-question-bank.json`.
4. Tải `/van-dap-tong-mon` bằng session của profile.
5. Trích xuất:
   - WordPress REST nonce.
   - `securityToken`.
   - action động `vdLoad` và `vdSave` nếu frontend mã hóa action.
6. Gọi `load_quiz_data` để lấy trạng thái mới nhất.
7. Chỉ xử lý câu có `is_correct = 0`.
8. Chọn đúng một câu có độ tin cậy đủ cao.
9. Gửi `save_quiz_result` với `question_id` và chỉ số option.
10. Chờ tối thiểu 900 ms rồi tải lại trạng thái server.
11. Lặp đến khi hoàn thành hoặc không còn câu có thể trả lời an toàn.

## 3. Smart Match v2.5.8.1

Thứ tự so khớp câu hỏi:

1. Exact Match giữ dấu tiếng Việt.
2. Exact Match sau khi bỏ dấu.
3. Fuzzy Match có ngưỡng cao theo độ dài câu.

Các điều kiện an toàn:

- Câu chứa số khác nhau không được fuzzy-match.
- Nhiều QA gần giống nhưng dẫn đến đáp án khác nhau sẽ bị coi là mơ hồ.
- Top 1 và Top 2 quá sát nhau nhưng khác đáp án sẽ bị bỏ qua.
- Không còn cơ chế chỉ trùng một từ rồi chọn đáp án.

Thứ tự so khớp đáp án:

1. Exact Match.
2. Match bỏ dấu.
3. Alias đặc biệt.
4. Fuzzy Match có ngưỡng và margin bắt buộc.

Alias hỗ trợ:

- `Tất cả đáp án` / `Tất cả đáp án trên`.
- `Cả 1 và 2` / `1 và 2` / `Cả đáp án 1 và 2`.
- Nhiều đáp án hợp lệ khai báo bằng Array hoặc dấu `|` / `||`.
- Loại bỏ ghi chú trong ngoặc ở cuối đáp án.

## 4. Ngân hàng QA

Nguồn được khóa cứng trong backend:

`https://gist.githubusercontent.com/mrchou-tvt/94b1732e3351fb34667a7e6d45b39de5/raw/vandap.json`

Renderer không thể truyền URL tùy ý cho backend.

Định dạng hỗ trợ:

- `{ "questions": { "Câu hỏi": "Đáp án" } }`
- Array item `{ question, answer }`.
- Array item `{ q, a }`.
- Object mapping trực tiếp `Câu hỏi -> Đáp án`.

Cache:

- Fresh cache: 60 phút mặc định.
- Cache dùng chung cho toàn bộ profile, tránh 40 profile cùng tải Gist.
- Cache được ghi atomic vào file riêng.
- Nếu GitHub tạm lỗi nhưng có cache đã xác thực, module dùng stale cache.
- Không lưu cookie, nonce, security token hoặc proxy credential trong cache.

## 5. Kết quả và log

Các action log mới:

- `VAN_DAP_QA_READY`
- `VAN_DAP_ANSWER_ACCEPTED`
- `VAN_DAP_ANSWER_WRONG`
- `VAN_DAP_SKIPPED`
- `VAN_DAP_SUBMIT_SKIPPED`

Ví dụ thành công:

`Vấn Đáp: Hoàn thành 5/5 câu đúng; đã gửi 5 câu.`

Ví dụ chưa đủ độ tin cậy:

`Vấn Đáp: đúng 3/5; đã gửi 3 câu, bỏ qua 2 câu chưa đủ độ tin cậy.`

Module không đoán đáp án khi thiếu dữ liệu. Câu chưa đủ độ tin cậy được bỏ qua và Worker tiếp tục module kế tiếp.

## 6. Mã lỗi

- `WORKER_LOGIN_REQUIRED`
- `VAN_DAP_PAGE_HTTP_ERROR`
- `VAN_DAP_SECURITY_TOKEN_NOT_FOUND`
- `VAN_DAP_NONCE_NOT_FOUND`
- `VAN_DAP_QA_HTTP_ERROR`
- `VAN_DAP_QA_INVALID_JSON`
- `VAN_DAP_QA_INVALID`
- `VAN_DAP_CONTEXT_REJECTED`
- `VAN_DAP_LOAD_FAILED`
- `VAN_DAP_SAVE_FAILED`
- `VAN_DAP_INVALID_RESPONSE`

## 7. Thứ tự module

Phase 12 giữ thứ tự:

1. Chúc Phúc
2. Điểm Danh
3. Vấn Đáp
4. Tế Lễ
5. Hoang Vực
6. Thí Luyện
7. Phúc Lợi
8. Bí Cảnh
9. Khoáng Mạch
10. Tiên Duyên
11. Mê Cung
12. Luyện Đan

## 8. Kiểm thử Windows

```cmd
npm install
npm run lint
npm run build
npm run test:phase08
npm run test:phase09
npm run test:phase10
npm run test:phase11
npm run test:phase12
npm run electron:dev
```

Kiểm thử thật:

1. Profile đã đăng nhập.
2. Activity Settings → Vấn Đáp → Chạy thử.
3. Kiểm tra log từng câu.
4. Chạy lại sau khi hoàn thành: module phải báo `already_done`.
5. Dùng một profile có proxy tốt và một profile Direct.
6. Profile proxy hỏng phải báo lỗi proxy, không fallback Direct.
7. Bật Chúc Phúc, Điểm Danh, Vấn Đáp, Tế Lễ và Start Worker để xác nhận thứ tự.
