import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface BulkResetProxyDialogProps {
  profileIds: string[];
  onSave: (ids: string[], proxies: string[]) => Promise<any>;
  onCancel: () => void;
}

export function BulkResetProxyDialog({ profileIds, onSave, onCancel }: BulkResetProxyDialogProps) {
  const { lang, t } = useLanguage();
  const [proxiesText, setProxiesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const proxies = proxiesText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    try {
      await onSave(profileIds, proxies);
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Thay đổi proxy thất bại." : "Failed to change proxy.")
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
            {lang === "vi" ? "Thay Đổi Proxy Hàng Loạt" : "Bulk Change Proxy"}
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
                  Bạn đang thay đổi proxy cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống danh sách proxy nếu muốn xóa cấu hình proxy cũ.
                </>
              ) : (
                <>
                  You are changing proxies for <strong className="text-accent">{profileIds.length}</strong> selected profiles. Leave the proxy list blank to remove old proxy configuration.
                </>
              )}
            </span>
            <label className="block text-gray-400 mb-1.5 font-medium flex items-center justify-between">
              <span>{lang === "vi" ? "Danh sách Proxy mới" : "New Proxy List"}</span>
              <span className="text-[10px] text-gray-500 font-normal">
                {lang === "vi" ? "(Mỗi dòng một proxy)" : "(One proxy per line)"}
              </span>
            </label>
            <textarea
              value={proxiesText}
              onChange={(e) => setProxiesText(e.target.value)}
              className="textarea w-full h-32 bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent"
              placeholder="Định dạng: host:port hoặc host:port:user:pass"
            />
            <span className="text-[10px] text-gray-500 block mt-1.5 leading-normal">
              {lang === "vi"
                ? "Hệ thống sẽ gán xoay vòng lần lượt các proxy này cho các profile đã chọn."
                : "The system will sequentially rotate and assign these proxies to the selected profiles."
              }
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
