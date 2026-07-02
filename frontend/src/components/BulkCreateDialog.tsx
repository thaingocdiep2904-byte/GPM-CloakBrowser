import { useState } from "react";
import { X } from "lucide-react";
import type { BulkCreateData } from "../lib/api";

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
      setError("Vui lòng điền tên mẫu.");
      return;
    }
    if (count <= 0) {
      setError("Số lượng phải lớn hơn 0.");
      return;
    }

    setSaving(true);
    setError(null);

    // Phân tích danh sách proxy (mỗi dòng 1 proxy)
    const proxies = proxiesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const payload: BulkCreateData = {
      count,
      name_pattern: namePattern,
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
      setError(err instanceof Error ? err.message : "Tạo hàng loạt thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface-1 border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-white">Tạo Profile Hàng Loạt</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-gray-300">
          <div className="grid grid-cols-2 gap-4">
            {/* Tên mẫu */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">Tên mẫu</label>
              <input
                type="text"
                value={namePattern}
                onChange={(e) => setNamePattern(e.target.value)}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
                placeholder="Ví dụ: Profile_[NUM]"
                required
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Chữ <code className="text-accent bg-surface-3 px-1 rounded">[NUM]</code> sẽ tự động tăng từ 1.
              </span>
            </div>

            {/* Số lượng */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">Số lượng cần tạo</label>
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          {/* Danh sách Proxy */}
          <div>
            <label className="block text-gray-400 mb-1.5 font-medium flex items-center gap-1">
              <span>Danh sách Proxy</span>
              <span className="text-[10px] text-gray-500 font-normal">(Mỗi dòng một proxy - Tùy chọn)</span>
            </label>
            <textarea
              value={proxiesText}
              onChange={(e) => setProxiesText(e.target.value)}
              className="textarea w-full h-24 bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono"
              placeholder="Định dạng: host:port hoặc host:port:user:pass hoặc http://user:pass@host:port"
            />
            <span className="text-[10px] text-gray-500 block mt-1">
              Hệ thống sẽ gán xoay vòng lần lượt các proxy này cho các profile được tạo.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            {/* Hệ điều hành */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">Hệ điều hành giả lập</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white"
              >
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
              </select>
            </div>

            {/* Độ phân giải */}
            <div>
              <label className="block text-gray-400 mb-1.5 font-medium">Độ phân giải màn hình</label>
              <select
                value={currentResolution}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrentResolution(val);
                  const preset = RESOLUTION_PRESETS[val];
                  if (preset) {
                    setWidth(preset.width);
                    setHeight(preset.height);
                  }
                }}
                className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
              >
                {Object.keys(RESOLUTION_PRESETS).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value="custom">Tự cấu hình (Custom)</option>
              </select>
            </div>
          </div>

          {currentResolution === "custom" && (
            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4">
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Chiều rộng (Width)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 1920)}
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Chiều cao (Height)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 1080)}
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={humanize}
                onChange={(e) => setHumanize(e.target.checked)}
                className="rounded border-gray-600 bg-surface-3 text-accent focus:ring-accent mt-0.5"
              />
              <div>
                <span className="font-medium text-white block">Humanize</span>
                <span className="text-[10px] text-gray-500">Mô phỏng hành vi di chuột, cuộn như người thật.</span>
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
                <span className="text-[10px] text-gray-500">Chạy ngầm ẩn trình duyệt (không khuyến khích antidetect).</span>
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
                <span className="text-[10px] text-gray-500">Tự động cấu hình múi giờ và ngôn ngữ theo IP Proxy.</span>
              </div>
            </label>
          </div>

          {/* Ghi chú */}
          <div className="border-t border-border pt-4">
            <label className="block text-gray-400 mb-1.5 font-medium">Ghi chú chung</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="textarea w-full h-16 bg-surface-2 border border-border rounded px-3 py-2 text-white"
              placeholder="Nhập ghi chú chung áp dụng cho tất cả các profile..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="btn bg-surface-3 hover:bg-surface-4 text-gray-200 border border-border px-4 py-2 rounded transition-colors"
              disabled={saving}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded transition-colors font-medium"
              disabled={saving}
            >
              {saving ? "Đang tạo..." : "Tạo hàng loạt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
