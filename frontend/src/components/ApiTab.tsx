import { useState } from "react";
import { Terminal, Copy, Check, ExternalLink, Code, BookOpen } from "lucide-react";

type SubTab = "docs" | "playwright";

export function ApiTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("playwright");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const code1 = `import requests
from playwright.sync_api import sync_playwright

# Địa chỉ của CloakBrowser Manager API
MANAGER_URL = "http://localhost:8080"
# ID của profile cần kết nối (lấy từ bảng quản lý)
PROFILE_ID = "YOUR_PROFILE_UUID"

def main():
    # 1. Khởi chạy profile thông qua API
    print("Đang khởi chạy profile...")
    launch_res = requests.post(f"{MANAGER_URL}/api/profiles/{PROFILE_ID}/launch")
    if launch_res.status_code not in (200, 201):
        print("Lỗi khởi chạy profile:", launch_res.text)
        return
    
    # 2. Lấy thông tin trạng thái profile (bao gồm CDP Port và VNC Port)
    status_res = requests.get(f"{MANAGER_URL}/api/profiles/{PROFILE_ID}/status")
    status_data = status_res.json()
    
    if status_data.get("status") != "running":
        print("Profile chưa khởi chạy thành công.")
        return
        
    # Lấy devtools websocket port từ cdp_url hoặc cdp_port
    # Ở phiên bản local, CDP được mở tại 127.0.0.1
    # Tìm devtools port trong status_data
    # CDP URL có dạng: "/api/profiles/id/cdp"
    # Port devtools thực tế sẽ nằm trong khoảng 5100-5199
    # Bạn cũng có thể dùng thư viện để parse port hoặc lấy trực tiếp
    # Chúng tôi sẽ lấy trực tiếp qua kết nối CDP cục bộ
    
    # Ở đây chúng ta giả sử port devtools được trả về hoặc bạn có thể tìm qua log.
    # Trong CloakBrowser, CDP port được tự động cấp phát và có thể lấy từ status API
    cdp_port = status_data.get("cdp_port") or 5100 # Cổng gán cho profile
    
    print(f"Kết nối tới CDP port: {cdp_port}")
    
    # 3. Sử dụng Playwright kết nối tới Browser Instance đang chạy
    with sync_playwright() as p:
        # Kết nối qua CDP (Chrome DevTools Protocol)
        browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{cdp_port}")
        
        # Lấy context đầu tiên (mặc định đã được tạo sẵn khi mở profile)
        context = browser.contexts[0]
        page = context.pages[0] if context.pages else context.new_page()
        
        # 4. Điều khiển trình duyệt như bình thường
        page.goto("https://bot-detector.rebrowser.net/")
        print("Tiêu đề trang:", page.title())
        
        # Chụp ảnh màn hình làm ví dụ
        page.screenshot(path="rebrowser_test.png")
        print("Đã chụp ảnh màn hình lưu tại rebrowser_test.png")
        
        # Đóng kết nối Playwright (trình duyệt vẫn chạy trên VNC)
        browser.close()

if __name__ == "__main__":
    main()`;

  const code2 = `import asyncio
from playwright.async_api import async_playwright
import httpx

MANAGER_URL = "http://localhost:8080"
PROFILE_ID = "YOUR_PROFILE_UUID"

async def main():
    async with httpx.AsyncClient() as client:
        # Khởi chạy profile
        await client.post(f"{MANAGER_URL}/api/profiles/{PROFILE_ID}/launch")
        
        # Lấy trạng thái
        status_resp = await client.get(f"{MANAGER_URL}/api/profiles/{PROFILE_ID}/status")
        status = status_resp.json()
        
    cdp_port = status.get("cdp_port") or 5100
    
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{cdp_port}")
        context = browser.contexts[0]
        page = context.pages[0] if context.pages else await context.new_page()
        
        await page.goto("https://browserleaks.com/canvas")
        title = await page.title()
        print("Title:", title)
        
        await browser.close()

asyncio.run(main())`;

  return (
    <div className="flex-1 bg-surface-0 flex flex-col h-screen text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h1 className="text-sm font-bold text-white tracking-wide">API & Automation</h1>
        </div>
        
        {/* Sub-tabs điều hướng */}
        <div className="flex bg-surface-2 p-1 rounded-lg border border-border/80">
          <button
            onClick={() => setActiveSubTab("docs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === "docs"
                ? "bg-primary text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Interactive API (Swagger docs)</span>
          </button>
          <button
            onClick={() => setActiveSubTab("playwright")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === "playwright"
                ? "bg-primary text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>Mẫu Playwright Python</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {activeSubTab === "docs" ? (
          <div className="w-full h-[calc(100vh-140px)] border border-border rounded-lg overflow-hidden bg-white shadow-2xl">
            <iframe
              src="/docs"
              title="FastAPI Swagger UI Docs"
              className="w-full h-full border-none"
            />
          </div>
        ) : (
          <div className="max-w-4xl space-y-8 animate-fade-in">
            {/* Instruction Intro */}
            <div className="space-y-3">
              <p className="text-sm text-gray-300 leading-relaxed">
                CloakBrowser hỗ trợ giao thức <strong>Chrome DevTools Protocol (CDP)</strong> tiêu chuẩn, cho phép các công cụ tự động hóa như <strong>Playwright</strong>, <strong>Puppeteer</strong> hoặc <strong>Selenium</strong> kết nối trực tiếp vào profile đang chạy.
              </p>
              <div className="bg-surface-1 border border-border p-4 rounded-lg space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Luồng hoạt động:</h3>
                <ol className="list-decimal list-inside text-xs space-y-1.5 text-gray-400">
                  <li>Gửi yêu cầu khởi chạy profile qua endpoint HTTP của CloakBrowser Manager.</li>
                  <li>Lấy thông tin cổng CDP (cổng gán tự động từ <code className="bg-surface-2 px-1 py-0.5 rounded text-gray-300">5100-5199</code>).</li>
                  <li>Kết nối thư viện tự động hóa Playwright/Puppeteer của bạn qua CDP port cục bộ để điều khiển.</li>
                </ol>
              </div>
            </div>

            {/* Sync Python Playwright Code */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span>Mẫu Python Playwright (Đồng bộ - Synchronous)</span>
                </h2>
                <button
                  onClick={() => handleCopy(code1, "code1")}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-border rounded text-xs transition-colors text-gray-300"
                >
                  {copied === "code1" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-green-400 font-semibold">Đã Copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-surface-1 border border-border rounded-lg p-4 overflow-x-auto text-[11px] font-mono leading-relaxed text-gray-300 max-h-[450px]">
                <code>{code1}</code>
              </pre>
            </div>

            {/* Async Python Playwright Code */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span>Mẫu Python Playwright (Bất đồng bộ - Asynchronous)</span>
                </h2>
                <button
                  onClick={() => handleCopy(code2, "code2")}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-border rounded text-xs transition-colors text-gray-300"
                >
                  {copied === "code2" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-green-400 font-semibold">Đã Copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-surface-1 border border-border rounded-lg p-4 overflow-x-auto text-[11px] font-mono leading-relaxed text-gray-300 max-h-[350px]">
                <code>{code2}</code>
              </pre>
            </div>

            {/* Additional information link */}
            <div className="border-t border-border/60 pt-6 flex items-center justify-between text-xs text-gray-500">
              <span>Tài liệu tham khảo Playwright CDP</span>
              <a
                href="https://playwright.dev/python/docs/api/class-browser#browser-connect-over-cdp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <span>Playwright Doc</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
