import { useState, useEffect } from "react";
import { RotateCw, Save, AlertTriangle, Puzzle, Trash2, Upload, Loader2 } from "lucide-react";
import { api, type AppSettings, type Extension } from "../lib/api";
import { useLanguage } from "../lib/i18n";

interface SettingsTabProps {
  showFeedback?: (msg: string) => void;
}

export function SettingsTab({ showFeedback }: SettingsTabProps) {
  const { lang, t, setLang } = useLanguage();
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

  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loadingExts, setLoadingExts] = useState(true);
  const [uploadingExt, setUploadingExt] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);
  const [defaultExtIds, setDefaultExtIds] = useState<string[]>([]);

  const fetchExtensions = async () => {
    setLoadingExts(true);
    try {
      const exts = await api.getExtensions();
      setExtensions(exts);
    } catch (err) {
      console.error("Failed to load extensions:", err);
    } finally {
      setLoadingExts(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  useEffect(() => {
    if (settings.default_extensions) {
      try {
        const parsed = JSON.parse(settings.default_extensions);
        setDefaultExtIds(Array.isArray(parsed) ? parsed : []);
      } catch {
        setDefaultExtIds([]);
      }
    }
  }, [settings.default_extensions]);

  const handleToggleDefaultExt = (extId: string) => {
    setDefaultExtIds((prev: string[]) => {
      const updated = prev.includes(extId)
        ? prev.filter((id: string) => id !== extId)
        : [...prev, extId];
      setSettings((prevSettings: AppSettings) => ({
        ...prevSettings,
        default_extensions: JSON.stringify(updated),
      }));
      return updated;
    });
  };

  const handleUploadExt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      setExtError(lang === "vi" ? "Vui lòng tải lên file định dạng zip." : "Please upload a zip format file.");
      return;
    }
    setUploadingExt(true);
    setExtError(null);
    try {
      const newExt = await api.uploadExtension(file, true);
      setExtensions((prev: Extension[]) => [...prev, newExt]);
    } catch (err) {
      setExtError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Tải lên thất bại." : "Upload failed.")
      );
    } finally {
      setUploadingExt(false);
    }
  };

  const handleDeleteExt = async (extId: string) => {
    if (
      !confirm(
        lang === "vi"
          ? "Bạn có chắc chắn muốn xóa extension này khỏi hệ thống không? Tất cả các profile đang sử dụng sẽ bị gỡ bỏ tiện ích này."
          : "Are you sure you want to delete this extension from the system? All profiles using it will have this extension removed."
      )
    )
      return;
    try {
      await api.deleteExtension(extId);
      setExtensions((prev: Extension[]) => prev.filter((e: Extension) => e.id !== extId));
      setDefaultExtIds((prev: string[]) => {
        const updated = prev.filter((id: string) => id !== extId);
        setSettings((prevSettings: AppSettings) => ({
          ...prevSettings,
          default_extensions: JSON.stringify(updated),
        }));
        return updated;
      });
    } catch (err) {
      setExtError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Xóa thất bại." : "Delete failed.")
      );
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
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
      .finally(() => setLoading(false));
  }, []);

  const handleSelectFolder = async (field: "profile_path") => {
    try {
      const res = await api.selectFolder();
      if (res.path) {
        setSettings((prev) => ({ ...prev, [field]: res.path as string }));
      }
    } catch (err) {
      alert((lang === "vi" ? "Không thể chọn thư mục: " : "Cannot select folder: ") + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      if (settings.language) {
        setLang(settings.language as any);
      }
      if (showFeedback) {
        showFeedback(t("settings_tab.save") + "!");
      }
    } catch (err) {
      if (showFeedback) {
        showFeedback(t("settings_tab.save") + " failed: " + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-0">
        <div className="text-gray-400 text-sm">
          {lang === "vi" ? "Đang tải cài đặt hệ thống..." : "Loading system settings..."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface-0 overflow-y-auto p-6 text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <h1 className="text-xl font-bold text-white tracking-wide">
          {lang === "vi" ? "Cài đặt hệ thống" : "System Settings"}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white transition-colors font-medium flex items-center gap-1.5 text-xs shadow-md shadow-violet-950/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>
              {saving
                ? (lang === "vi" ? "Đang lưu..." : "Saving...")
                : (lang === "vi" ? "Lưu cài đặt" : "Save Settings")
              }
            </span>
          </button>

          <button
            onClick={fetchSettings}
            className="p-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded text-gray-400 hover:text-white transition-colors"
            title={lang === "vi" ? "Làm mới" : "Refresh"}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Warning Text */}
      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/80 p-3 rounded text-xs mb-6 leading-relaxed">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          {lang === "vi"
            ? "Bạn cần khởi động lại ứng dụng khi thay đổi các thông tin về việc lưu trữ Profile (đường dẫn không được chứa kí tự Tiếng Việt)"
            : "You need to restart the application when changing Profile storage path (the path must not contain Unicode/special characters)"
          }
        </span>
      </div>

      <div className="space-y-8 max-w-4xl">
        {/* Section 1: Storage Path */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24">
              {lang === "vi" ? "Trên PC" : "On PC"}
            </span>
            <button
              onClick={() => handleSelectFolder("profile_path")}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
            >
              {lang === "vi" ? "Thay đổi" : "Change"}
            </button>
            <span
              onClick={() => handleSelectFolder("profile_path")}
              className="text-xs text-gray-300 font-mono bg-surface-1 hover:bg-surface-2 border border-border/40 hover:border-accent/50 px-2 py-1.5 rounded transition-all cursor-pointer select-all"
              title={lang === "vi" ? "Click để thay đổi thư mục lưu trữ profile" : "Click to change profile storage directory"}
            >
              {settings.profile_path || (lang === "vi" ? "Chưa cấu hình (Click để chọn)" : "Not configured (Click to select)")}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24 mt-1">
              {lang === "vi" ? "Chế độ nén" : "Compression Mode"}
            </span>
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
                  <span>{lang === "vi" ? "Mặc định" : "Default"}</span>
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
                {lang === "vi"
                  ? "Trình nén được sử dụng khi Import / Export / Backup / Restore và nén profile khi đẩy lên cloud nếu sử dụng. 7Z được đề xuất là nhanh và ổn định hơn trình nén mặc định của Windows"
                  : "Compression mode used for Import / Export / Backup / Restore and cloud backup. 7Z is recommended for faster and more stable compression than the default Windows zip compression"
                }
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: General settings */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {lang === "vi" ? "Cài đặt chung" : "General Settings"}
          </h2>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 w-24">{t("settings_tab.language")}</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSettings((prev) => ({ ...prev, language: "en" }))}
                className={`p-1 rounded transition-all ${settings.language === "en" ? "bg-primary/20 border border-primaryScale-500 scale-110" : "opacity-50 hover:opacity-100"}`}
                title="English"
              >
                <span className="text-xl">🇺🇸</span>
              </button>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, language: "vi" }))}
                className={`p-1 rounded transition-all ${settings.language === "vi" ? "bg-primary/20 border border-primaryScale-500 scale-110" : "opacity-50 hover:opacity-100"}`}
                title="Tiếng Việt"
              >
                <span className="text-xl">🇻🇳</span>
              </button>
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
              <span className="text-[11px] text-gray-500">
                {lang === "vi" ? "Chưa hỗ trợ giao diện Sáng (Light)" : "Light theme is not supported yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Browser settings */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {lang === "vi" ? "Trình duyệt" : "Browser"}
          </h2>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.reopen_tabs}
                onChange={(e) => setSettings((prev) => ({ ...prev, reopen_tabs: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>
                {lang === "vi" ? "Mở lại các tab đang hoạt động ở phiên trước" : "Reopen tabs active from previous session"}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_clear_cache}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_clear_cache: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>
                {lang === "vi" ? "Tự động xóa cache khi đóng" : "Auto clear cache when closed"}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_resize_window}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_resize_window: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>
                {lang === "vi" ? "Tự động thay đổi kích thước cửa sổ theo cài đặt profile" : "Auto resize window according to profile settings"}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={!settings.no_trash}
                onChange={(e) => setSettings((prev) => ({ ...prev, no_trash: !e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>
                {lang === "vi" ? "Sử dụng chế độ thùng rác profile" : "Use profile recycle bin mode"}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.auto_update_cloakbrowser ?? false}
                onChange={(e) => setSettings((prev) => ({ ...prev, auto_update_cloakbrowser: e.target.checked }))}
                className="rounded border-border bg-surface-2 accent-primary h-4 w-4"
              />
              <span>
                {lang === "vi" ? "Tự động cập nhật phiên bản CloakBrowser khi khởi động" : "Auto update CloakBrowser version on startup"}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-semibold text-gray-400 w-36">
              {lang === "vi" ? "Thông số profile mặc định" : "Default Profile Settings"}
            </span>
            <button
              onClick={() => alert(lang === "vi" ? "Tính năng chỉnh sửa cấu hình vân tay mặc định đang được tối ưu hóa." : "Feature for editing default fingerprint configuration is under optimization.")}
              className="px-3 py-1 bg-surface-2 hover:bg-surface-3 border border-border text-xs rounded transition-colors"
            >
              {lang === "vi" ? "Chỉnh sửa" : "Edit"}
            </button>
          </div>
        </div>

        {/* Section 4: Extensions */}
        <div className="border-t border-border/60 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {lang === "vi" ? "Kho Extension Hệ Thống" : "System Extensions Repository"}
            </h2>
            
            {/* Upload Button */}
            <div className="relative overflow-hidden cursor-pointer bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs py-1.5 px-3 rounded flex items-center gap-1.5 transition-all select-none">
              <input
                type="file"
                accept=".zip"
                onChange={handleUploadExt}
                disabled={uploadingExt}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploadingExt ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{lang === "vi" ? "Đang cài đặt..." : "Installing..."}</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>{lang === "vi" ? "Thêm Extension (.zip)" : "Add Extension (.zip)"}</span>
                </>
              )}
            </div>
          </div>

          {extError && (
            <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 text-rose-300 text-[11px] rounded">
              {extError}
            </div>
          )}

          {loadingExts ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
              <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
              <span>{lang === "vi" ? "Đang tải danh sách tiện ích..." : "Loading extensions list..."}</span>
            </div>
          ) : extensions.length === 0 ? (
            <div className="p-4 bg-surface-2/40 border border-border/50 rounded-md text-center text-gray-500 italic text-xs">
              {lang === "vi"
                ? "Chưa có extension nào trong hệ thống. Hãy tải lên file .zip để bắt đầu."
                : "No extensions in system yet. Please upload a .zip file to start."
              }
            </div>
          ) : (
            <div className="border border-border/50 rounded-md bg-surface-2/20 divide-y divide-border/40 text-xs">
              {/* Header hàng */}
              <div className="flex items-center justify-between p-2.5 bg-surface-2/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-16 text-center">{lang === "vi" ? "Mặc định" : "Default"}</span>
                  <span>{lang === "vi" ? "Tên Extension" : "Extension Name"}</span>
                </div>
                <div className="pr-4">{lang === "vi" ? "Phiên bản" : "Version"}</div>
                <div className="pr-4">{lang === "vi" ? "Hành động" : "Actions"}</div>
              </div>

              {extensions.map((ext: Extension) => {
                const isDefault = defaultExtIds.includes(ext.id);
                return (
                  <div key={ext.id} className="flex items-center justify-between p-3 hover:bg-surface-3/15 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Checkbox default */}
                      <div className="w-16 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={() => handleToggleDefaultExt(ext.id)}
                          className="h-3.5 w-3.5 rounded border-border bg-surface-2 text-violet-600 focus:ring-violet-500/40"
                          title={lang === "vi" ? "Đặt làm extension mặc định cho profile mới" : "Set as default extension for new profiles"}
                        />
                      </div>

                      {/* Icon & Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Puzzle className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-white truncate" title={ext.name}>
                          {ext.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-gray-400 font-mono text-[10px] pr-4">
                      v{ext.version || "1.0"}
                    </div>

                    <div className="pr-4">
                      <button
                        onClick={() => handleDeleteExt(ext.id)}
                        className="p-1 hover:bg-rose-950/20 text-gray-500 hover:text-rose-400 rounded transition-all"
                        title={lang === "vi" ? "Xóa vĩnh viễn khỏi hệ thống" : "Permanently delete from system"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-[10px] text-gray-500 leading-relaxed bg-surface-1/40 p-2.5 rounded border border-border/30">
            {lang === "vi" ? (
              <>
                * <strong>Extension mặc định:</strong> Các tiện ích được tick chọn ở cột trên sẽ tự động được gán và bật mặc định mỗi khi bạn tạo một profile trình duyệt mới.<br />
                * <strong>Tải lên extension:</strong> Bạn có thể giải nén tiện ích từ Chrome Web Store (dùng công cụ download CRX/ZIP) rồi nén lại thành định dạng .zip thông thường để tải lên đây.
              </>
            ) : (
              <>
                * <strong>Default Extensions:</strong> Checked extensions will be automatically assigned and enabled by default for new browser profiles.<br />
                * <strong>Upload Extension:</strong> You can download extension files from Chrome Web Store (using a CRX/ZIP downloader), and pack them into a standard .zip format to upload here.
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
