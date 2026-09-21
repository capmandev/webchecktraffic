# 📖 Hướng Dẫn Đăng Ký, Lấy Scrappa API Key & Cài Vào Webchecktraffic

Tài liệu này hướng dẫn chi tiết từng bước cho các thành viên trong team cách tự tạo tài khoản **Scrappa** miễn phí, lấy mã **API Key** và dán vào ứng dụng **Webchecktraffic** để dùng chung cho cả nhóm.

---

## ⚡ Tóm tắt nhanh:
- **Trang đăng ký:** [https://scrappa.co/register](https://scrappa.co/register)
- **Hạn mức miễn phí:** **50 credits Similarweb / tài khoản / tháng** (Không cần thẻ tín dụng).
- **Quy mô Team:** Hệ thống hỗ trợ **10 slot key dùng chung** = Tối đa **500 lượt kiểm tra traffic thật / tháng**.
- **Đồng bộ tự động:** Khi bạn nhập hoặc thay key, hệ thống tự động lưu vào **Supabase** để toàn bộ team cùng sử dụng ngay lập tức.

---

## 📌 Bước 1: Đăng ký tài khoản Scrappa miễn phí

1. Mở trình duyệt và truy cập liên kết: **[https://scrappa.co/register](https://scrappa.co/register)**
2. Nhập các thông tin đăng ký:
   - **Full Name:** Họ và tên của bạn (hoặc tên bất kỳ).
   - **Email address:** Địa chỉ email của bạn (mỗi email tương ứng với 1 tài khoản nhận 50 credits/tháng).
   - **Password:** Mật khẩu bảo vệ tài khoản.
3. Bấm nút màu xanh **Sign Up Free (50 Credits) ↗**.
4. Không cần nhập thẻ Visa/Mastercard, tài khoản của bạn sẽ được kích hoạt ngay lập tức với 50 credits miễn phí.

![Minh họa đăng ký tài khoản Scrappa](/images/guide-step1-register.jpg)

---

## 🔑 Bước 2: Lấy API Key từ Scrappa Dashboard

1. Sau khi đăng nhập thành công vào trang quản trị Scrappa Dashboard.
2. Nhìn vào thanh menu bên trái, tìm và bấm vào mục **API Keys** (biểu tượng hình chìa khóa 🔑).
3. Tại giao diện quản lý API Keys:
   - Bạn sẽ nhìn thấy thẻ **Your API Key** chứa chuỗi mã token (ví dụ: `scr_live_...`).
   - Bên cạnh có thông tin hạn mức: **Plan: Free Tier**, **Credits: 50/50 remaining**.
4. Bấm vào nút **Copy Key** màu xanh để sao chép toàn bộ mã API Key vào bộ nhớ tạm (Clipboard).

![Minh họa lấy API Key từ Scrappa](/images/guide-step2-copy-key.jpg)

---

## 💻 Bước 3: Dán Key vào app Webchecktraffic & Lưu cấu hình

1. Truy cập vào ứng dụng Webchecktraffic: **[https://webchecktraffic.vercel.app](https://webchecktraffic.vercel.app)**
2. Nhập mật khẩu truy cập: `3mteam`
3. Trên thanh tiêu đề góc trên bên phải, bấm vào nút **⚙️ Cấu hình API** (hoặc nút **[ ⚠ X key hết lượt ]** nếu có key bị cạn credit).
4. Trong bảng cấu hình 10 slots key:
   - Tìm một ô còn trống (ví dụ: `Key #1:`, `Key #2:`, `Key #3:`...) hoặc ô đang báo cảnh báo đỏ **`⚠ 0 credits (HẾT LƯỢT)`**.
   - Bấm nút `X` để xóa key cũ (nếu có) và dán (**Ctrl + V**) mã API Key bạn vừa copy ở Bước 2 vào ô.
5. Bấm nút màu xanh **"Lưu cấu hình (Đồng bộ cả Team)"** ở cuối bảng.
6. Hệ thống sẽ ngay lập tức:
   - Kiểm tra số dư credits thực tế qua Scrappa và hiển thị nhãn xanh: **`✓ Còn 50 credits`**.
   - Lưu cấu hình lên cơ sở dữ liệu **Supabase**, tất cả các thành viên khác trong team khi mở web đều tự động nhận và dùng key này!

![Minh họa dán Key vào Webchecktraffic](/images/guide-step3-paste-app.jpg)

---

## 💡 Mẹo Tối Ưu Cho Cả Team

> [!TIP]
> **Tận dụng tối đa 10 slots key cho cả nhóm:**
> - Mỗi thành viên trong nhóm có thể đăng ký 1 tài khoản Scrappa bằng email cá nhân của mình.
> - Điền lần lượt vào các slot từ `Key #1` đến `Key #10`.
> - 10 keys x 50 credits = **500 lượt kiểm tra Similarweb/tháng hoàn toàn miễn phí**!

> [!NOTE]
> **Cơ chế tự động xoay vòng (Key Rotation):**
> - Khi bạn check danh sách domain, hệ thống sẽ dùng Key #1. Nếu Key #1 hết hạn mức (về 0 credit), hệ thống sẽ tự động chuyển sang Key #2, Key #3,... mà không làm gián đoạn lượt quét.

> [!WARNING]
> **Cách xử lý khi thấy nút cảnh báo đỏ `[ ⚠ X key hết lượt ]`:**
> - Khi nhìn thấy nút cảnh báo đỏ trên đầu trang, nghĩa là trong 10 key có slot đã hết lượt credits.
> - Bất kỳ thành viên nào cũng có thể bấm vào nút đó, xem ô nào đang có viền đỏ `⚠ 0 credits`, tạo tài khoản Scrappa mới và dán key mới vào để thay thế ngay lập tức.
