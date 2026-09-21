'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Key,
  Zap,
  AlertCircle,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react';

export default function GuidePage() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedKeyFormat, setCopiedKeyFormat] = useState(false);

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white pb-16">
      {/* Toast notification */}
      {copiedLink && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce border border-slate-800">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Đã copy link hướng dẫn! Bạn có thể dán gửi cho đồng đội.</span>
        </div>
      )}

      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm tracking-wider shadow-xs">
              TC
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 block leading-tight">TRAFFIC CHECKER</span>
              <span className="text-[10px] text-slate-500 font-medium">Tài liệu & Hướng dẫn sử dụng</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{copiedLink ? 'Đã copy link' : 'Chia sẻ link'}</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <span>Vào app check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-b from-blue-50/70 to-transparent border-b border-blue-100/50 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>HƯỚNG DẪN DÀNH CHO TEAM AFFILIATE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Cách Đăng Ký, Lấy Scrappa API Key & Dán Vào Webchecktraffic
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Mỗi thành viên chỉ mất chưa đầy 1 phút để tạo tài khoản miễn phí nhận <strong>50 credits Similarweb/tháng</strong>. Toàn bộ key được đồng bộ dùng chung trên Supabase cho cả nhóm.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Miễn phí 100%</span>
                <span className="text-sm font-extrabold text-slate-900">50 credits / tài khoản</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Dùng chung cả Team</span>
                <span className="text-sm font-extrabold text-slate-900">10 slots key đồng bộ</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Dữ liệu Similarweb</span>
                <span className="text-sm font-extrabold text-slate-900">100% số liệu thực</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Guide Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        {/* Step 1 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                1
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Đăng ký tài khoản Scrappa miễn phí
              </h2>
            </div>

            <a
              href="https://scrappa.co/register"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors self-start sm:self-auto"
            >
              <span>Mở trang đăng ký scrappa.co</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Mở trang <a href="https://scrappa.co/register" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline hover:text-blue-800">scrappa.co/register</a>. Điền Họ tên, địa chỉ Email cá nhân và Mật khẩu. Sau đó bấm nút <strong>Sign Up Free (50 Credits)</strong>. Bạn sẽ được chuyển thẳng vào trang quản trị ngay lập tức mà <em>hoàn toàn không cần thẻ ngân hàng (No credit card required)</em>.
          </p>

          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-950 mt-3">
            <img
              src="/images/guide-step1-register.jpg"
              alt="Màn hình đăng ký tài khoản Scrappa"
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* Step 2 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
              2
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Lấy API Key từ Scrappa Dashboard
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ở thanh menu điều hướng bên trái của Scrappa, bấm vào mục <strong>API Keys</strong> (có biểu tượng chiếc chìa khóa 🔑). Tại bảng <strong>Your API Key</strong>, bấm nút màu xanh <strong>Copy Key</strong> để sao chép mã khóa vào bộ nhớ tạm.
          </p>

          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-950 mt-3">
            <img
              src="/images/guide-step2-copy-key.jpg"
              alt="Màn hình lấy mã API Key từ Scrappa"
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* Step 3 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                3
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Dán Key vào app Webchecktraffic & Lưu cấu hình
              </h2>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-colors self-start sm:self-auto"
            >
              <span>Mở Webchecktraffic</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <p>
              1. Vào website <strong>https://webchecktraffic.vercel.app</strong> (nhập mật khẩu truy cập <code>3mteam</code>).
            </p>
            <p>
              2. Bấm vào nút <strong>⚙️ Cấu hình API</strong> ở góc trên bên phải (hoặc bấm nút đỏ <code>[ ⚠ X key hết lượt ]</code> nếu có).
            </p>
            <p>
              3. Chọn một ô slot còn trống (ví dụ: <code>Key #1:</code>, <code>Key #2:</code>...) hoặc ô đang viền đỏ báo <code>⚠ 0 credits (HẾT LƯỢT)</code>. Dán (Ctrl + V) key vừa copy vào ô.
            </p>
            <p>
              4. Bấm nút <strong>Lưu cấu hình (Đồng bộ cả Team)</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Hệ thống sẽ ngay lập tức kiểm tra số dư và hiển thị nhãn xanh <strong>✓ Còn 50 credits</strong>, đồng thời lưu lên Supabase để tất cả các thành viên khác dùng chung ngay lập tức!
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-950 mt-3">
            <img
              src="/images/guide-step3-paste-app.jpg"
              alt="Màn hình dán key vào ứng dụng"
              className="w-full h-auto object-cover"
            />
          </div>
        </section>

        {/* Team Pro-tips */}
        <section className="p-6 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Mẹo tối ưu cho cả Team:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-amber-900 leading-relaxed">
            <li>
              <strong>Nhân rộng hạn mức:</strong> 10 thành viên tạo 10 tài khoản free = <strong>500 lượt check Similarweb/tháng hoàn toàn miễn phí</strong>.
            </li>
            <li>
              <strong>Tự xoay key thông minh:</strong> Khi bạn check một danh sách domain, nếu Key 1 hết lượt thì hệ thống tự động lấy Key 2, Key 3 tiếp tục quét mà không bao giờ bị dừng.
            </li>
            <li>
              <strong>Nhận diện key hết hạn:</strong> Khi trên đầu trang xuất hiện nút đỏ <code>[ ⚠ X key hết lượt ]</code>, bất kỳ ai cũng có thể bấm vào, xem ô nào hết credit, tạo thêm tài khoản mới và dán vào thay thế.
            </li>
          </ul>
        </section>

        {/* Bottom CTA Box */}
        <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold">Chia sẻ hướng dẫn này cho đồng đội?</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copy đường link này và gửi vào nhóm chat (Telegram, Zalo, Slack...) để mọi người cùng tạo key.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs transition-colors shadow-sm"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600" />
              <span>{copiedLink ? 'Đã copy link!' : 'Copy Link Hướng Dẫn'}</span>
            </button>

            <Link
              href="/"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Vào app check traffic</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
