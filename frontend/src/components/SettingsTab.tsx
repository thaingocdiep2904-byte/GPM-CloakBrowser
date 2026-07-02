import { useState, useEffect } from "react";
import { Sparkles, RotateCw, Save, AlertTriangle } from "lucide-react";
import { api, type AppSettings } from "../lib/api";

export function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>({
    profile_path: "",
    compression_mode: "default",
    license_key: "CLOAK-XXXX-XXXX-XXXX",
    language: "vi",
    storage_type: "local",
    theme: "dark",
    reopen_tabs: false,
    auto_clear_cache: true,
    auto_resize_window: false,
    no_trash: false,

    default_extensions: "[]",
    shared_extensions: "[]",
    auto_update_cloakbrowser: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } fillly: {
      setLoading(false);
    }
  };

  const fillly = () => {
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    api.getSettings()
      .then((data) => {
        setSettings(data);
      })
      .catch((err) => {
        console.error("Failed to load settings:", err);
      })
      .finally(fillly);
  }, []);

  const handleSelectFolder = async (field: "profile_path") => {
    try {
      const res = await api.selectFolder();
      if (res.path) {
        setSettings((prev) => ({ ...prev, [field]: res.path as string }));
      }
    } catch (err) {
      alert("Không thể chọn thư mục: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings(settings);
      setMessage({ text: "Đã lưu cài đặt thành công! Một số thay đổi sẽ có hiệu lực sau khi khởi động lại ứng dụng.", type: "success" });
    } catch (err) {
      setMessage({ text: "Lỗi khi lưu cài đặt: " + (err instanceof Error ? err.message : String(err)), type: "error" });
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-0">
        <div className="text-gray-400 text-sm">Đang tải cài đặt hệ thống...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-0 overflow-y-auto p-6 text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <h1 className="text-xl font-bold text-white tracking-wide">Setting</h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded text-xs transition-colors">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            <span>AI Support</span>
          </button>
          <button
            onClick={fetchSettings}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded text-gray-400 hover:text-white transition-colors"
            title="Làm mới"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-6 text-sm border ${
            message.type === "success"
              ? "bg-green-500/15 border-green-500/30 text-green-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Warning Text */}
      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/80 p-3 rounded text-xs mb-6 leading-relaxed">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>Bạn cần khởi động lại ứng dụng khi thay đổi các thông tin về việc lưu trữ Profile (đường dẫn không được chứa kí tự Tiếng Việt)</span>
      </div>

      <div className="space-y-8 max-w-4xl">
        {/* Section 1: Storage Path */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24">Trên PC</span>
            <button
              onClick={() => handleSelectFolder("profile_path")}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
            >
              Thay đổi
            </button>
            <span
              onClick={() => handleSelectFolder("profile_path")}
              className="text-xs text-gray-300 font-mono bg-surface-1 hover:bg-surface-2 border border-border/40 hover:border-accent/50 px-2 py-1.5 rounded transition-all cursor-pointer select-all"
              title="Click để thay đổi thư mục lưu trữ profile"
            >
              {settings.profile_path || "Chưa cấu hình (Click để chọn)"}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24 mt-1">Chế độ nén</span>
            <div className="space-y-2">
              <div className="flex items-center gap-6 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="compression_mode"
                    checked={settings.compression_mode === "default"}
                    onChange={() => setSettings((prev) => ({ ...prev, compression_mode: "default" }))}
                    className="accent-primary"
                  />
                  <span>Mặc định</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="compression_mode"
                    checked={settings.compression_mode === "7z"}
                    onChange={() => setSettings((prev) => ({ ...prev, compression_mode: "7z" }))}
                    className="accent-primary"
                  />
                  <span>7Z</span>
                </label>
              </div>
              <p className="text-[11px] text-gray-500 max-w-xl leading-relaxed">
                Trình nén được sử dụng khi Import / Export / Backup / Restore và nén profile khi đẩy lên cloud nếu sử dụng. 7Z được đề xuất là nhanh và ổn định hơn trình nén mặc định của Windows
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: General settings */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Cài đặt chung</h2>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24">Ngôn ngữ</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSettings((prev) => ({ ...prev, language: "en" }))}
                className={`p-1 rounded transition-all ${settings.language === "en" ? "bg-primary/20 border border-primaryScale-500 scale-110" : "opacity-50 hover:opacity-100"}`}
                title="English"
              >
                <span className="text-xl">🇺🇸</span>
              </button>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, language: "cn" }))}
                className={`p-1 rounded transition-all ${settings.language === "cn" ? "bg-primary/20 border border-primaryScale-500 scale-110" : "opacity-50 hover:opacity-100"}`}
                title="Chinese"
              >
                <span className="text-xl">🇨🇳</span>
              </button>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, language: "vi" }))}
                className={`p-1 rounded transition-all ${settings.language === "vi" ? "bg-primary/20 border border-primaryScale-500 scale-110" : "opacity-50 hover:opacity-100"}`}
                title="Tiếng Việt"
              >
                <span className="text-xl">🇻🇳</span>
              </button>
              <span className="text-[11px] text-red-400 ml-2">Restart to full applied</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24">Theme</span>
            <div className="flex items-center gap-2">
              <select
                value={settings.theme}
                disabled
                className="bg-surface-2 border border-border rounded text-xs px-2 py-1.5 focus:outline-none w-32 cursor-not-allowed opacity-75 text-gray-400"
              >
                <option value="dark">Dark</option>
              </select>
              <span className="text-[11px] text-gray-500">Chưa hỗ trợ giao diện Sáng (Light)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Browser settings */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Trình duyệt</h2>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.reopen_tabs}
                onChange={(e) => setSettings((prev) => ({ ...prev, reopen_tabs: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>Mở lại các tab đang hoạt động ở phiên trước</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_clear_cache}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_clear_cache: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>Tự động xóa cache khi đóng</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_resize_window}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_resize_window: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>Tự động thay đổi kích thước cửa sổ theo cài đặt profile</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.no_trash}
                onChange={(e) => setSettings((prev) => ({ ...prev, no_trash: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>Không sử dụng thùng rác profile</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_update_cloakbrowser ?? false}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_update_cloakbrowser: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>Tự động cập nhật phiên bản CloakBrowser khi khởi động</span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-semibold text-gray-400 w-36">Thông số profile mặc định</span>
            <button
              onClick={() => alert("Tính năng chỉnh sửa cấu hình vân tay mặc định đang được tối ưu hóa.")}
              className="px-3 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
            >
              Chỉnh sửa
            </button>
          </div>
        </div>

        {/* Section 4: Extensions */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Extensions</h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-36">Extension mặc định</span>
                <button
                  onClick={() => alert("Chỉnh sửa Extension mặc định sẽ mở thư mục extension chung.")}
                  className="px-3 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
                >
                  Sửa Extension
                </button>
              </div>
              <p className="text-[11px] text-gray-500 max-w-xl">
                Extension sẽ được cài đặt trực tiếp vào thư mục của profile khi khởi tạo. Dung lượng của profile sẽ bao gồm cả dung lượng các extension được cài đặt thêm
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-36">Extension dùng chung</span>
                <button
                  onClick={() => alert("Chỉnh sửa Extension dùng chung sẽ mở bảng quản lý extension.")}
                  className="px-3 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
                >
                  Chỉnh sửa
                </button>
              </div>
              <p className="text-[11px] text-gray-500 max-w-xl">
                Extension sẽ được cài đặt một lần duy nhất ngay trên local PC, việc này giúp giảm đáng kể dung lượng lưu trữ. Tuy nhiên nếu bạn import profile sang một máy tính khác, máy tính đó cũng sẽ cần cài đặt extension này tại mục Cài đặt
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-border/60 pt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 bg-primary hover:bg-primaryScale-600 active:bg-primaryScale-700 text-white rounded text-sm font-semibold transition-all shadow-lg hover:shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Đang lưu..." : "Lưu"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
