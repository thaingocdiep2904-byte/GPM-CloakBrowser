import { useState } from "react";
import { X, Upload, Check, Save, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

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
  const { lang, t } = useLanguage();
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
          setError(lang === "vi" ? "File JSON phải chứa một mảng các cookies." : "JSON file must contain an array of cookies.");
          return;
        }
        setCookieJson(text);
        setFileFeedback(
          lang === "vi"
            ? `Đã tải file: ${file.name} (${parsed.length} cookies)`
            : `Loaded file: ${file.name} (${parsed.length} cookies)`
        );
        setError(null);
      } catch (err) {
        setError(lang === "vi" ? "Không thể đọc file JSON. Vui lòng kiểm tra định dạng." : "Failed to read JSON file. Please check format.");
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieJson.trim()) {
      setError(lang === "vi" ? "Vui lòng dán nội dung JSON cookie hoặc chọn file." : "Please paste JSON cookie content or select a file.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let parsedCookies: any[];
      try {
        parsedCookies = JSON.parse(cookieJson.trim());
      } catch (err) {
        setError(lang === "vi" ? "Nội dung cookie dán vào không đúng định dạng JSON hợp lệ." : "Pasted cookie content is not a valid JSON format.");
        setSaving(false);
        return;
      }

      if (!Array.isArray(parsedCookies)) {
        setError(lang === "vi" ? "Cookie JSON phải là một mảng danh sách cookies." : "Cookie JSON must be an array of cookies.");
        setSaving(false);
        return;
      }

      const res = await api.importCookies(profileId, parsedCookies);
      onSuccess(res.imported);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Nhập cookie thất bại." : "Failed to import cookies.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg relative">
          <h2 className="text-sm font-semibold text-white">
            {lang === "vi" ? "Import Cookies cho Profile" : "Import Cookies for Profile"}
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
              <span>{lang === "vi" ? "Nhập Cookies" : "Import Cookies"}</span>
            </button>
          </div>
          <button type="button" onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors z-20" title={t("table.close_btn")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 pt-4 text-xs text-gray-400">
          {lang === "vi" ? "Nhập cookies cho profile:" : "Import cookies for profile:"}{" "}
          <strong className="text-accent text-[13px]">{profileName}</strong>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-rose-600/15 border border-rose-600/30 text-rose-400 text-xs rounded">
            {error}
          </div>
        )}

        <div className="p-5 space-y-4 text-xs text-gray-300">
          {/* File Upload Option */}
          <div className="border border-dashed border-border/80 rounded p-4 bg-surface-2/40 flex flex-col items-center justify-center text-center relative hover:bg-surface-2/60 transition-colors">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-6 w-6 text-gray-500 mb-1.5" />
            <span className="font-medium text-gray-300">
              {lang === "vi" ? "Kéo thả hoặc click chọn file .json cookies" : "Drag & drop or click to choose .json cookies file"}
            </span>
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
            <label className="block text-gray-400 font-medium">
              {lang === "vi" ? "Hoặc dán mã JSON Cookie trực tiếp" : "Or paste JSON Cookie code directly"}
            </label>
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
        </div>
      </form>
    </div>
  );
}
