import { useState } from "react";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface BulkGroupDialogProps {
  profileIds: string[];
  onSave: (ids: string[], tags: { tag: string; color: string | null }[]) => Promise<any>;
  onCancel: () => void;
}

const TAG_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#f97316", // orange
  "#ec4899", // pink
];

export function BulkGroupDialog({ profileIds, onSave, onCancel }: BulkGroupDialogProps) {
  const { lang, t } = useLanguage();
  const [tags, setTags] = useState<{ tag: string; color: string | null }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState<string | null>("#6366f1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (tags.some((t) => t.tag === tag)) return;
    setTags([...tags, { tag, color: tagColor }]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t.tag !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(profileIds, tags);
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Gom nhóm profile thất bại." : "Failed to assign group.")
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
            {lang === "vi" ? "Gom Nhóm Hàng Loạt" : "Bulk Assign Groups"}
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
                  Bạn đang gom nhóm cho <strong className="text-accent">{profileIds.length}</strong> profile đã chọn. Để trống danh sách nhãn nếu muốn xóa bỏ toàn bộ nhóm cũ của các profile này.
                </>
              ) : (
                <>
                  You are assigning groups for <strong className="text-accent">{profileIds.length}</strong> selected profiles. Leave the tag list blank to clear all old groups.
                </>
              )}
            </span>
            
            <label className="label">{lang === "vi" ? "Nhãn (Tags)" : "Tags"}</label>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1 bg-surface-2 border border-border rounded px-3 py-2 text-white"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder={lang === "vi" ? "Ví dụ: Nuôi nick, MMO..." : "e.g. Account Farm, MMO..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 rounded bg-surface-3 hover:bg-surface-4 border border-border text-white flex items-center justify-center transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Chọn màu cho nhãn */}
            <div className="flex items-center gap-1.5 mb-4">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTagColor(c)}
                  className={`h-5 w-5 rounded-full border transition-all ${
                    tagColor === c ? "border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Danh sách nhãn đang chọn */}
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-3.5 bg-surface-2 border border-border rounded">
                {tags.map((t) => (
                  <span
                    key={t.tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: t.color ? `${t.color}20` : undefined,
                      color: t.color || undefined,
                      border: t.color ? `1px solid ${t.color}35` : undefined,
                    }}
                  >
                    <span>{t.tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(t.tag)}
                      className="text-gray-400 hover:text-white font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 border border-dashed border-border rounded text-gray-500">
                {lang === "vi" ? "Chưa gán nhãn nào (sẽ xóa sạch nhãn cũ)" : "No tags assigned (will clear old tags)"}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
