# DNSE Desk

Bàn giao dịch chứng khoán cá nhân, Next.js 16 và React 19, nối DNSE LightSpeed API V2.

Dữ liệu và lệnh đi qua route nội bộ. API Key và API Secret chỉ nằm trên server.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Cấu hình

Sao chép `.env.example` thành `.env.local` nếu chưa có, rồi điền:

- `DNSE_API_KEY` — API Key trên Entrade X
- `DNSE_API_SECRET` — API Secret (chỉ hiện một lần lúc tạo key)

Đổi env xong thì chạy lại `npm run dev`.

Đặt, sửa, hủy lệnh cần trading token. Trên bàn giao dịch, gửi OTP email hoặc nhập Smart OTP từ ứng dụng Entrade X. Token lưu trong cookie httpOnly khoảng 8 giờ và không được gửi lại cho trình duyệt.

## Lưu ý

Ứng dụng này giữ secret và có thể gửi lệnh thật. Chỉ chạy trên máy của bạn, không đưa server ra mạng công khai khi chưa có lớp đăng nhập riêng.
