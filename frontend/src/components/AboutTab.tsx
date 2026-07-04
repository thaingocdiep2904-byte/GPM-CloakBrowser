import { Info, Shield, CheckCircle, Heart } from "lucide-react";
import logoImg from "../logo.png";
import { useLanguage } from "../lib/i18n";

export function AboutTab() {
  const { lang } = useLanguage();
  return (
    <div className="flex-1 bg-surface-0 overflow-y-auto p-6 text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-white tracking-wide">
            {lang === "vi" ? "Giới thiệu" : "About"}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-primaryScale-900/40 via-surface-1 to-surface-1 border border-border p-8 rounded-xl flex items-center gap-6 shadow-2xl">
          <img src={logoImg} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-border/60 p-2 flex-shrink-0 bg-surface-2" />
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">CloakBrowser Manager</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-lg">
              {lang === "vi" 
                ? "Hệ thống quản lý profile trình duyệt antidetect, bảo mật dấu vân tay số và tự động hóa đa tài khoản chuyên nghiệp."
                : "Anti-detect browser profile manager, protecting digital fingerprint and professional multi-account automation."
              }
            </p>
            <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-500">
              <span className="bg-surface-2 border border-border px-2 py-0.5 rounded font-mono text-gray-300">v1.2.0 Stable</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span>{lang === "vi" ? "Bản phát hành miễn phí" : "Free Open Source Edition"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-1 border border-border p-5 rounded-lg space-y-2 hover:border-primary/30 transition-all">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-white">
              {lang === "vi" ? "Chống dấu vân tay (Antidetect)" : "Digital Fingerprint Protection"}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {lang === "vi"
                ? "Tự động giả lập Canvas, WebGL, Audio, GPU, CPU Cores dựa trên seed và nhân trình duyệt CloakBrowser. Đồng bộ múi giờ và ngôn ngữ tự động qua GeoIP."
                : "Automatically simulate Canvas, WebGL, Audio, GPU, and CPU Cores based on seed and CloakBrowser core. Synchronize timezone and language automatically via GeoIP."
              }
            </p>
          </div>

          <div className="bg-surface-1 border border-border p-5 rounded-lg space-y-2 hover:border-primary/30 transition-all">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h3 className="text-sm font-semibold text-white">
              {lang === "vi" ? "Chạy trực tiếp & CDP" : "Native Run & CDP Automation"}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {lang === "vi"
                ? "Trình duyệt khởi chạy trực tiếp trên máy thật với tốc độ cao nhất, đồng thời mở cổng CDP để tự động hóa bằng script Playwright/Puppeteer."
                : "Browser launches natively on real hardware for maximum performance, exposing CDP port for automation via Playwright/Puppeteer scripts."
              }
            </p>
          </div>
        </div>

        {/* Project License Information */}
        <div className="bg-surface-1 border border-border p-6 rounded-lg space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {lang === "vi" ? "Giấy phép mã nguồn mở" : "Open Source License"}
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            {lang === "vi"
              ? "Phần mềm được cung cấp miễn phí cho mục đích sử dụng cá nhân và phát triển tự động hóa. Vui lòng tuân thủ các điều khoản MIT và giấy phép nhị phân của CloakBrowser Core."
              : "This software is provided free of charge for personal use and automation development. Please comply with the MIT terms and CloakBrowser Core binary licenses."
            }
          </p>
          <div className="pt-2">
            <a
              href="file:///d:/APP/CloakBrowser/CloakBrowser-Manager/BINARY-LICENSE.md"
              className="text-xs text-primary hover:underline font-semibold"
            >
              {lang === "vi" ? "Đọc BINARY-LICENSE.md" : "Read BINARY-LICENSE.md"}
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
