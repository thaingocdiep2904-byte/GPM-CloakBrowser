import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface BulkStartupUrlDialogProps {
  profileIds: string[];
  onSave: (ids: string[], startupUrl: string) => Promise<any>;
  onCancel: () => void;
}

export function BulkStartupUrlDialog({ profileIds, onSave, onCancel }: BulkStartupUrlDialogProps) {
  const { lang, t } = useLanguage();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(profileIds, url.trim());
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Cấu hình URL khởi động thất bại." : "Failed to set startup URL.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg relative">
          <h2 className="text-sm font-semibold text-white">
            {lang === "vi" ? "Đặt URL Khởi Động Hàng Loạt" : "Bulk Set Startup URL"}
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
              <span>{lang === "vi" ? "Xác nhận" : "Confirm"}</span>
            </button>
          </div>
          <button type="button" onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors z-20" title={t("table.close_btn")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        <div className="p-5 space-y-4 text-xs text-gray-300">
          <div>
            <span className="text-[11px] text-gray-400 block mb-3 leading-relaxed">
              {lang === "vi" ? (
                <>
                  Bạn đang cấu hình URL khởi động tự động cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống nếu muốn xóa URL khởi động cũ.
                </>
              ) : (
                <>
                  You are configuring automatic startup URL for <strong className="text-accent">{profileIds.length}</strong> selected profiles. Leave empty to clear old startup URL.
                </>
              )}
            </span>
            <label className="block text-gray-400 mb-1.5 font-medium">{lang === "vi" ? "Địa chỉ URL" : "URL Address"}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent"
              placeholder="e.g. https://google.com"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
