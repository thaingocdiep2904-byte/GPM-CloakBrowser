import { useState } from "react";
import { X } from "lucide-react";

interface BulkBookmarkDialogProps {
  profileIds: string[];
  onSave: (ids: string[], bookmarks: { name: string; url: string }[]) => Promise<any>;
  onCancel: () => void;
}

export function BulkBookmarkDialog({ profileIds, onSave, onCancel }: BulkBookmarkDialogProps) {
  const [bookmarksText, setBookmarksText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const bookmarks = bookmarksText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const idx = line.indexOf("|");
        if (idx !== -1) {
          const name = line.substring(0, idx).trim();
          const url = line.substring(idx + 1).trim();
          return { name: name || url, url };
        }
        return { name: line, url: line };
      })
      .filter((bm) => bm.url.startsWith("http://") || bm.url.startsWith("https://"));

    if (bookmarksText.trim().length > 0 && bookmarks.length === 0) {
      setError("Vui lòng điền bookmarks đúng định dạng (ví dụ: Google|https://google.com) và bắt đầu bằng http:// hoặc https://");
      setSaving(false);
      return;
    }

    try {
      await onSave(profileIds, bookmarks);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cài đặt bookmarks thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <div className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg">
          <h2 className="text-sm font-semibold text-white">Cài Đặt Bookmarks Hàng Loạt</h2>
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
              Bạn đang gán dấu trang (bookmarks) cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống để xóa sạch bookmarks cũ.
            </span>
            
            <label className="block text-gray-400 mb-1.5 font-medium flex items-center justify-between">
              <span>Danh sách Bookmarks</span>
              <span className="text-[10px] text-gray-500 font-normal">(Định dạng: Tên|URL)</span>
            </label>
            <textarea
              value={bookmarksText}
              onChange={(e) => setBookmarksText(e.target.value)}
              className="textarea w-full h-32 bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent"
              placeholder={`Ví dụ:\nGoogle|https://google.com\nFacebook|https://facebook.com`}
            />
            <span className="text-[10px] text-gray-500 block mt-1.5 leading-normal">
              Ghi chú: Mỗi dấu trang viết trên một dòng. Dấu gạch đứng <code className="text-accent">|</code> ngăn cách giữa tên hiển thị và địa chỉ link.
            </span>
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
