import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import type { BulkCreateData } from "../lib/api";
import { useLanguage } from "../lib/i18n";

const RESOLUTION_PRESETS: Record<string, { width: number; height: number }> = {
  "1920 × 1080 (Full HD)": { width: 1920, height: 1080 },
  "2560 × 1440 (QHD)": { width: 2560, height: 1440 },
  "1366 × 768 (HD)": { width: 1366, height: 768 },
  "1440 × 900": { width: 1440, height: 900 },
  "1536 × 864": { width: 1536, height: 864 },
  "1280 × 720 (720p)": { width: 1280, height: 720 },
};

interface BulkCreateDialogProps {
  onSave: (data: BulkCreateData) => Promise<any>;
  onCancel: () => void;
}

export function BulkCreateDialog({ onSave, onCancel }: BulkCreateDialogProps) {
  const { lang, t } = useLanguage();
  const [count, setCount] = useState(5);
  const [namePattern, setNamePattern] = useState("Profile_[NUM]");
  const [proxiesText, setProxiesText] = useState("");
  const [platform, setPlatform] = useState<"windows" | "macos" | "linux">("windows");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [currentResolution, setCurrentResolution] = useState("1920 × 1080 (Full HD)");
  const [humanize, setHumanize] = useState(true);
  const [headless, setHeadless] = useState(false);
  const [geoip, setGeoip] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namePattern.trim()) {
      setError(lang === "vi" ? "Vui lòng điền tên mẫu." : "Please fill in the name pattern.");
      return;
    }
    if (count <= 0) {
      setError(lang === "vi" ? "Số lượng phải lớn hơn 0." : "Quantity must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);

    const proxies = proxiesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const payload: BulkCreateData = {
      count,
      name_pattern: namePattern.trim(),
      proxies: proxies.length > 0 ? proxies : undefined,
      platform,
      screen_width: width,
      screen_height: height,
      humanize,
      headless,
      geoip,
      notes: notes.trim() || null,
    };

    try {
      await onSave(payload);
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Tạo hàng loạt thất bại." : "Failed to bulk create.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border relative">
          <h2 className="text-base font-semibold text-white">
            {lang === "vi" ? "Tạo Profile Hàng Loạt" : "Bulk Create Profiles"}
          </h2>
          <div className="flex items-center gap-2 mr-8">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white font-medium transition-colors text-xs flex items-center gap-1.5 shadow-md shadow-violet-950/20 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{saving ? t("form.saving") : t("table.btn_bulk_new")}</span>
            </button>
          </div>
          <button type="button" onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors z-20" title={t("table.close_btn")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-gray-300">
          <div className="grid grid-cols-2 gap-4">
            {/* Tên mẫu */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">
                {lang === "vi" ? "Tên mẫu" : "Name Pattern"}
              </label>
              <input
                type="text"
                value={namePattern}
                onChange={(e) => setNamePattern(e.target.value)}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
                placeholder="Ví dụ: Profile_[NUM]"
                required
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                {lang === "vi" ? (
                  <>
                    Chữ <code className="text-accent bg-surface-3 px-1 rounded">[NUM]</code> sẽ tự động tăng từ 1.
                  </>
                ) : (
                  <>
                    The word <code className="text-accent bg-surface-3 px-1 rounded">[NUM]</code> will auto-increment from 1.
                  </>
                )}
              </span>
            </div>

            {/* Số lượng */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">
                {lang === "vi" ? "Số lượng cần tạo" : "Quantity to Create"}
              </label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            {/* Platform */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">
                {lang === "vi" ? "Hệ điều hành giả lập" : "Emulated OS"}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="select w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
              >
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
              </select>
            </div>

            {/* Độ phân giải */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">
                {lang === "vi" ? "Màn hình (Resolution)" : "Screen Resolution"}
              </label>
              <select
                value={currentResolution}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentResolution(val);
                  if (RESOLUTION_PRESETS[val]) {
                    setWidth(RESOLUTION_PRESETS[val]!.width);
                    setHeight(RESOLUTION_PRESETS[val]!.height);
                  }
                }}
                className="select w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
              >
                {Object.keys(RESOLUTION_PRESETS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proxy */}
          <div className="border-t border-border pt-4">
            <label className="block text-gray-400 mb-1.5 font-medium flex items-center justify-between">
              <span>
                {lang === "vi" ? "Danh sách Proxy gán xoay vòng (Không bắt buộc)" : "List of Proxy Rotating (Optional)"}
              </span>
              <span className="text-[10px] text-gray-500 font-normal">
                {lang === "vi" ? "(Mỗi dòng một proxy)" : "(One proxy per line)"}
              </span>
            </label>
            <textarea
              value={proxiesText}
              onChange={(e) => setProxiesText(e.target.value)}
              className="textarea w-full h-24 bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono"
              placeholder="Định dạng: host:port hoặc host:port:user:pass"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">
              {lang === "vi"
                ? "Hệ thống sẽ tự động gán proxy xoay vòng lần lượt từ trên xuống dưới cho các profile được tạo."
                : "The system will automatically assign proxies sequentially from top to bottom to the created profiles."
              }
            </span>
          </div>

          {/* Cấu hình nâng cao */}
          <div className="border-t border-border pt-4 grid grid-cols-3 gap-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={humanize}
                onChange={(e) => setHumanize(e.target.checked)}
                className="rounded border-gray-600 bg-surface-3 text-accent focus:ring-accent mt-0.5"
              />
              <div>
                <span className="font-medium text-white block">Humanize</span>
                <span className="text-[10px] text-gray-500">
                  {lang === "vi" ? "Giả lập hành vi cuộn chuột và gõ phím giống con người." : "Emulate human-like scrolling and typing behaviors."}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => setHeadless(e.target.checked)}
                className="rounded border-gray-600 bg-surface-3 text-accent focus:ring-accent mt-0.5"
              />
              <div>
                <span className="font-medium text-white block">Headless</span>
                <span className="text-[10px] text-gray-500">
                  {lang === "vi" ? "Chạy ngầm ẩn trình duyệt." : "Run browser hidden in background."}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={geoip}
                onChange={(e) => setGeoip(e.target.checked)}
                className="rounded border-gray-600 bg-surface-3 text-accent focus:ring-accent mt-0.5"
              />
              <div>
                <span className="font-medium text-white block">GeoIP</span>
                <span className="text-[10px] text-gray-500">
                  {lang === "vi" ? "Cấu hình múi giờ và ngôn ngữ theo IP Proxy." : "Configure timezone and locale based on Proxy IP."}
                </span>
              </div>
            </label>
          </div>

          {/* Ghi chú */}
          <div className="border-t border-border pt-4">
            <label className="block text-gray-400 mb-1.5 font-medium">
              {lang === "vi" ? "Ghi chú chung" : "General Notes"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="textarea w-full h-16 bg-surface-2 border border-border rounded px-3 py-2 text-white"
              placeholder={
                lang === "vi"
                  ? "Nhập ghi chú chung áp dụng cho tất cả các profile..."
                  : "Enter general notes applied to all profiles..."
              }
            />
          </div>
        </div>
      </form>
    </div>
  );
}
