import { Info, Shield, CheckCircle, Heart } from "lucide-react";
import logoImg from "../logo.png";

export function AboutTab() {
  return (
    <div className="flex-1 bg-surface-0 overflow-y-auto p-6 text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-white tracking-wide">Giới thiệu</h1>
        </div>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-primaryScale-900/40 via-surface-1 to-surface-1 border border-border p-8 rounded-xl flex items-center gap-6 shadow-2xl">
          <img src={logoImg} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-border/60 p-2 flex-shrink-0 bg-surface-2" />
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">CloakBrowser Manager</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-lg">
              Hệ thống quản lý profile trình duyệt antidetect, bảo mật dấu vân tay số và tự động hóa đa tài khoản chuyên nghiệp.
            </p>
            <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-500">
              <span className="bg-surface-2 border border-border px-2 py-0.5 rounded font-mono text-gray-300">v1.2.0 Stable</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span>Bản quyền vĩnh viễn</span>
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-1 border border-border p-5 rounded-lg space-y-2 hover:border-primary/30 transition-all">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-white">Chống dấu vân tay (Antidetect)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Ngăn chặn theo dõi qua Canvas, WebGL, Audio, ClientRects, WebRTC, GeoIP, và User-Agent. Mỗi profile là một dấu vân tay độc bản.
            </p>
          </div>

          <div className="bg-surface-1 border border-border p-5 rounded-lg space-y-2 hover:border-primary/30 transition-all">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Điều khiển qua VNC & CDP</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Tích hợp VNC Viewer trực quan hiển thị trực tiếp giao diện trình duyệt và mở cổng CDP để tự động hóa bằng script Playwright/Puppeteer.
            </p>
          </div>
        </div>

        {/* Binary License Information */}
        <div className="bg-surface-1 border border-border p-6 rounded-lg space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thông tin bản quyền & Bản quyền nhị phân</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Phần mềm được cung cấp dưới dạng giấy phép độc quyền thương mại của CloakBrowser Team. Vui lòng không sao chép trái phép, dịch ngược hoặc phân phối lại dưới bất kỳ hình thức nào.
          </p>
          <div className="pt-2">
            <a
              href="file:///d:/APP/CloakBrowser/CloakBrowser-Manager/BINARY-LICENSE.md"
              className="text-xs text-primary hover:underline font-semibold"
            >
              Đọc BINARY-LICENSE.md
            </a>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-border/60 pt-6 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>Made by CloakBrowser Team with</span>
            <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
          </div>
          <span>© 2026 CloakBrowser Team. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
