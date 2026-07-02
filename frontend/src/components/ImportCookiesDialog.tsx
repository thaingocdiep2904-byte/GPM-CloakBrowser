import { useState } from "react";
import { X, Upload, Check } from "lucide-react";
import { api } from "../lib/api";

interface ImportCookiesDialogProps {
  profileId: string;
  profileName: string;
  onSuccess: (importedCount: number) => void;
  onCancel: () => void;
}

export function ImportCookiesDialog({
  profileId,
  profileName,
  onSuccess,
  onCancel
}: ImportCookiesDialogProps) {
  const [cookieJson, setCookieJson] = useState("");
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đọc file JSON từ máy tính người dùng
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Kiểm tra xem có phải JSON hợp lệ không
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setError("File JSON phải chứa một mảng các cookies.");
          return;
        }
        setCookieJson(text);
        setFileFeedback(`Đã tải file: ${file.name} (${parsed.length} cookies)`);
        setError(null);
      } catch (err) {
        setError("Không thể đọc file JSON. Vui lòng kiểm tra định dạng.");
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieJson.trim()) {
      setError("Vui lòng dán nội dung JSON cookie hoặc chọn file.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let parsedCookies: any[];
      try {
        parsedCookies = JSON.parse(cookieJson.trim());
      } catch (err) {
        setError("Nội dung cookie dán vào không đúng định dạng JSON hợp lệ.");
        setSaving(false);
        return;
      }

      if (!Array.isArray(parsedCookies)) {
        setError("Cookie JSON phải là một mảng danh sách cookies.");
        setSaving(false);
        return;
      }

      const res = await api.importCookies(profileId, parsedCookies);
      onSuccess(res.imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nhập cookie thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <div className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg">
          <h2 className="text-sm font-semibold text-white">Import Cookies cho Profile</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 pt-4 text-xs text-gray-400">
          Nhập cookies cho profile: <strong className="text-accent text-[13px]">{profileName}</strong>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-gray-300">
          {/* File Upload Option */}
          <div className="border border-dashed border-border/80 rounded p-4 bg-surface-2/40 flex flex-col items-center justify-center text-center relative hover:bg-surface-2/60 transition-colors">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-6 w-6 text-gray-500 mb-1.5" />
            <span className="font-medium text-gray-300">Kéo thả hoặc click chọn file .json cookies</span>
            <span className="text-[10px] text-gray-500 mt-0.5">EditThisCookie / Puppeteer / Playwright JSON format</span>
            
            {fileFeedback && (
              <div className="mt-2.5 px-3 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 rounded flex items-center gap-1.5 font-medium text-[10px]">
                <Check className="h-3.5 w-3.5" />
                <span>{fileFeedback}</span>
              </div>
            )}
          </div>

          {/* Textarea Option */}
          <div className="space-y-1.5">
            <label className="block text-gray-400 font-medium">Hoặc dán mã JSON Cookie trực tiếp</label>
            <textarea
              value={cookieJson}
              onChange={(e) => {
                setCookieJson(e.target.value);
                setFileFeedback(null);
              }}
              rows={6}
              className="w-full bg-surface-2 border border-border rounded px-3 py-2 text-white font-mono focus:border-accent placeholder-gray-600 text-[10px] resize-none"
              placeholder='[{"name": "cookie_name", "value": "cookie_val", "domain": ".example.com", "path": "/"}]'
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
              {saving ? "Đang nhập cookies..." : "Nhập Cookies"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
