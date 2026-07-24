# Phase 12 Worker Continuation Hotfix — Validation

- Exact server phrase `Đạo hữu đã gửi lời chúc cho phòng này rồi!`: benign/already_done.
- Non-fatal game-module failure: next module executes.
- Login/session identity failure: chain stops.
- Proxy-routing failure: chain stops.
- Worker initial chain passes `continueOnError: true`.
- Scheduled module errors receive a five-minute retry deadline and do not terminate Worker.
