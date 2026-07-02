import { useState } from "react";
import { X } from "lucide-react";

interface BulkStartupUrlDialogProps {
  profileIds: string[];
  onSave: (ids: string[], startupUrl: string) => Promise<any>;
  onCancel: () => void;
}

export function BulkStartupUrlDialog({ profileIds, onSave, onCancel }: BulkStartupUrlDialogProps) {
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
      setError(err instanceof Error ? err.message : "Cấu hình URL khởi động thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <div className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg">
          <h2 className="text-sm font-semibold text-white">Đặt URL Khởi Động Hàng Loạt</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-gray-300">
          <div>
            <span className="text-[11px] text-gray-400 block mb-3 leading-relaxed">
              Bạn đang cấu hình URL khởi động tự động cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống nếu muốn xóa URL khởi động cũ.
            </span>
            <label className="block text-gray-400 mb-1.5 font-medium">Địa chỉ URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent"
              placeholder="Ví dụ: https://google.com"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white font-medium transition-colors"
            >
              {saving ? "Đang lưu..." : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
