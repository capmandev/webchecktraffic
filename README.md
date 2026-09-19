# 🚀 Affiliate Traffic Checker MVP

Website MVP cực kỳ đơn giản dành cho Affiliate Marketer để kiểm tra nhanh **Monthly Traffic của website**.

---

## 🌟 Tính năng chính

- **Kiểm tra Single & Bulk Domain**: Nhập một domain hoặc paste danh sách hàng loạt domain (tự động phân tách và xử lý).
- **Chuẩn hóa thông minh (Domain Normalization)**:
  - Tự động xóa `http://`, `https://`, `//`
  - Tự động xóa `www.`
  - Tự động xóa path, query string, hash fragment, dấu gạch chéo cuối
  - Tự động loại bỏ domain trùng nhau
  - Validate định dạng domain hợp lệ (từ chối domain sai cú pháp)
- **Cơ chế Cache 30 ngày (Tối ưu chi phí API)**:
  - Kiểm tra database trước khi gọi Scarpa API.
  - Domain đã quét `< 30 ngày` ➡️ Dùng ngay dữ liệu cache trong DB (**không gọi Scarpa API**).
  - Domain chưa có hoặc `>= 30 ngày` ➡️ Gọi Scarpa API và cập nhật lại `checked_at`, **giữ nguyên trạng thái ⭐**.
- **Hiển thị tối giản & tập trung**:
  - Chỉ hiển thị đúng 2 thông tin: **Domain** và **Monthly Traffic** (định dạng dấu phẩy dễ đọc: `1,250,000`).
  - Không có biểu đồ hay metric dư thừa (không bounce rate, keywords, cpc, rank...).
- **Khu vực "KẾT QUẢ ĐÃ QUÉT"**:
  - Lưu trữ toàn bộ lịch sử domain đã kiểm tra từ Supabase.
  - **Đánh dấu ⭐**: Click ⭐ / ☆ để lưu domain tiềm năng, lưu trực tiếp vào database.
  - **Bộ lọc Traffic**: Lọc linh hoạt theo `MIN` và `MAX` traffic.
  - **Bộ lọc Starred**: Chuyển đổi tab `[ ALL ]` và `[ ★ STARRED ]`.
  - **Xóa 1 domain**: Nút 🗑 kèm popup xác nhận `[Hủy] [Xóa]`.
  - **Xóa hàng loạt**: Checkbox từng dòng + `Chọn tất cả` + `[ XÓA ĐÃ CHỌN ]` kèm popup xác nhận số lượng.
- **Bảo mật tuyệt đối**:
  - `SCARPA_API_KEY` chỉ lưu ở phía Serverless backend qua biến môi trường, không bao giờ lộ ở frontend hay network tab của browser.

---

## 🛠️ Cài đặt & Hướng dẫn sử dụng

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Thiết lập Database (Supabase)

1. Tạo một dự án mới trên [Supabase](https://supabase.com).
2. Vào mục **SQL Editor**, mở file [`supabase/schema.sql`](./supabase/schema.sql), dán toàn bộ nội dung và bấm **Run**.
3. Vào **Project Settings ➡️ API**, lấy:
   - `Project URL`
   - `anon public key` hoặc `service_role secret key`

### 3. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Scarpa API Configuration (Được cung cấp bởi Owner)
SCARPA_API_KEY=your-scarpa-api-key
SCARPA_API_ENDPOINT=https://api.scarpa.example/traffic

# Mock fallback khi chưa có API key / Supabase (Mặc định: true để test nhanh)
ENABLE_MOCK_FALLBACK=true
```

> **Lưu ý**: Khi `ENABLE_MOCK_FALLBACK=true`, nếu bạn chưa điền API Key hoặc Supabase, hệ thống sẽ sử dụng mock engine để bạn có thể trải nghiệm toàn bộ UI/UX, bộ lọc, cache và thao tác xóa ngay trên máy cục bộ!

### 4. Khởi chạy ứng dụng

```bash
npm run dev
```

Truy cập: [http://localhost:3005](http://localhost:3005)

---

## 🧪 Kiểm thử (Unit Tests)

Chạy kiểm thử logic chuẩn hóa domain và kiểm tra cache 30 ngày:

```bash
npm run test:normalize
```

---

## 🚀 Triển khai (Deployment)

Dự án được tối ưu 100% để deploy trực tiếp lên **Vercel**:
1. Đẩy code lên GitHub repository.
2. Import project vào [Vercel](https://vercel.com).
3. Điền các Environment Variables trong phần cấu hình project trên Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SCARPA_API_KEY`
   - `SCARPA_API_ENDPOINT`
4. Bấm **Deploy**.
