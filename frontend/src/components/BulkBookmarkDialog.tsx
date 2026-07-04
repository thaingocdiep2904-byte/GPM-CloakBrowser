import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface BulkBookmarkDialogProps {
  profileIds: string[];
  onSave: (ids: string[], bookmarks: { name: string; url: string }[]) => Promise<any>;
  onCancel: () => void;
}

export function BulkBookmarkDialog({ profileIds, onSave, onCancel }: BulkBookmarkDialogProps) {
  const { lang, t } = useLanguage();
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
      setError(
        lang === "vi"
          ? "Vui lòng điền bookmarks đúng định dạng (ví dụ: Google|https://google.com) và bắt đầu bằng http:// hoặc https://"
          : "Please enter bookmarks in correct format (e.g. Google|https://google.com) starting with http:// or https://"
      );
      setSaving(false);
      return;
    }

    try {
      await onSave(profileIds, bookmarks);
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Cài đặt bookmarks thất bại." : "Failed to set bookmarks.")
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
            {lang === "vi" ? "Cài Đặt Bookmarks Hàng Loạt" : "Bulk Set Bookmarks"}
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
                  Bạn đang gán dấu trang (bookmarks) cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống để xóa sạch bookmarks cũ.
                </>
              ) : (
                <>
                  You are assigning bookmarks for <strong className="text-accent">{profileIds.length}</strong> selected profiles. Leave blank to clear old bookmarks.
                </>
              )}
            </span>
            
            <label className="block text-gray-400 mb-1.5 font-medium flex items-center justify-between">
              <span>{lang === "vi" ? "Danh sách Bookmarks" : "Bookmarks List"}</span>
              <span className="text-[10px] text-gray-500 font-normal">
                {lang === "vi" ? "(Định dạng: Tên|URL)" : "(Format: Name|URL)"}
              </span>
            </label>
            <textarea
              value={bookmarksText}
              onChange={(e) => setBookmarksText(e.target.value)}
              className="textarea w-full h-32 bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent"
              placeholder={`Ví dụ:\nGoogle|https://google.com\nFacebook|https://facebook.com`}
            />
            <span className="text-[10px] text-gray-500 block mt-1.5 leading-normal">
              {lang === "vi"
                ? "Ghi chú: Mỗi dấu trang viết trên một dòng. Dấu gạch đứng | ngăn cách giữa tên hiển thị và địa chỉ link."
                : "Note: One bookmark per line. Vertical pipe symbol | separates the display name and the URL address."
              }
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
