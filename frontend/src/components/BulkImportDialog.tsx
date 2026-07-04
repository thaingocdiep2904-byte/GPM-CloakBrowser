import { useState } from "react";
import { X, Upload, FileText, Save, Loader2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface BulkImportDialogProps {
  onImport: (profiles: { name: string; proxy?: string; notes?: string }[]) => Promise<any>;
  onCancel: () => void;
}

export function BulkImportDialog({ onImport, onCancel }: BulkImportDialogProps) {
  const { lang, t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; proxy: string; notes: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length <= 1) {
          setError(lang === "vi" ? "Tệp tin trống hoặc chỉ chứa tiêu đề." : "The file is empty or only contains headers.");
          return;
        }

        const parsed: { name: string; proxy: string; notes: string }[] = [];
        // Bỏ qua dòng tiêu đề thứ nhất, parse từ dòng 2
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i] || "";
          const parts = line.split(",").map(part => {
            let clean = part.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.substring(1, clean.length - 1).replace(/""/g, '"');
            }
            return clean;
          });

          if (parts[0]) {
            parsed.push({
              name: parts[0],
              proxy: parts[1] || "",
              notes: parts[2] || ""
            });
          }
        }

        setCsvPreview(parsed.slice(0, 10)); // Xem trước tối đa 10 dòng
      } catch (err) {
        setError(lang === "vi" ? "Lỗi phân tích cú pháp tệp CSV." : "Failed to parse CSV file.");
      }
    };
    reader.readAsText(selectedFile, "UTF-8");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(lang === "vi" ? "Vui lòng chọn tệp tin CSV." : "Please select a CSV file.");
      return;
    }

    setSaving(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const listToImport: { name: string; proxy?: string; notes?: string }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i] || "";
          const parts = line.split(",").map(part => {
            let clean = part.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.substring(1, clean.length - 1).replace(/""/g, '"');
            }
            return clean;
          });

          if (parts[0]) {
            listToImport.push({
              name: parts[0],
              proxy: parts[1] || undefined,
              notes: parts[2] || undefined
            });
          }
        }

        if (listToImport.length === 0) {
          setError(lang === "vi" ? "Không tìm thấy profile hợp lệ để nhập." : "No valid profiles found to import.");
          setSaving(false);
          return;
        }

        await onImport(listToImport);
        onCancel();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : (lang === "vi" ? "Nhập hàng loạt thất bại." : "Failed to bulk import.")
        );
      } finally {
        setSaving(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2 rounded-t-lg relative">
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Upload className="h-4 w-4 text-emerald-500" />
            <span>{lang === "vi" ? "Nhập Profile Từ File Excel/CSV" : "Import Profiles From Excel/CSV"}</span>
          </h2>
          <div className="flex items-center gap-2 mr-8">
            <button
              type="submit"
              disabled={saving || !file}
              className={`px-4 py-1.5 rounded text-white font-medium transition-colors text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/20 ${
                file ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-800 opacity-55 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{lang === "vi" ? "Xác nhận nhập" : "Confirm Import"}</span>
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
                  Tải lên file CSV được xuất từ Excel để nhập hàng loạt profile. Tệp tin của bạn cần có định dạng sau:
                  <code className="block bg-surface-2 p-2 border border-border rounded font-mono text-[10px] mt-1 text-accent whitespace-pre">
                    Tên profile,Proxy,Ghi chú{"\n"}
                    Profile_Demo_1,113.161.44.15:8080,Ghi chú tài khoản 1{"\n"}
                    Profile_Demo_2,113.161.44.16:8080:user:pass,Ghi chú tài khoản 2
                  </code>
                </>
              ) : (
                <>
                  Upload a CSV file exported from Excel to bulk import profiles. Your file should have the following format:
                  <code className="block bg-surface-2 p-2 border border-border rounded font-mono text-[10px] mt-1 text-accent whitespace-pre">
                    Profile Name,Proxy,Notes{"\n"}
                    Profile_Demo_1,113.161.44.15:8080,Account Notes 1{"\n"}
                    Profile_Demo_2,113.161.44.16:8080:user:pass,Account Notes 2
                  </code>
                </>
              )}
            </span>

              {/* Drag & Drop File Input */}
              <div className="border border-dashed border-border hover:border-accent rounded-lg p-6 flex flex-col items-center justify-center bg-surface-2/40 cursor-pointer relative transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="h-8 w-8 text-gray-500 mb-2" />
                <span className="font-medium text-gray-300">
                  {file ? file.name : (lang === "vi" ? "Kéo thả hoặc Click để chọn tệp CSV" : "Drag & Drop or Click to choose CSV file")}
                </span>
                <span className="text-[10px] text-gray-500 mt-1">
                  {lang === "vi" ? "Hỗ trợ định dạng .csv hoặc .txt" : "Supports .csv or .txt formats"}
                </span>
              </div>
          </div>

          {/* Preview list */}
          {csvPreview.length > 0 && (
            <div className="space-y-2">
              <label className="block text-gray-400 font-medium">
                {lang === "vi" ? "Xem trước dữ liệu nhập (Tối đa 10 dòng):" : "Preview import data (Max 10 lines):"}
              </label>
              <div className="bg-surface-2 border border-border rounded max-h-40 overflow-y-auto font-mono text-[10px] divide-y divide-border/40">
                {csvPreview.map((item, idx) => (
                  <div key={idx} className="p-2 flex items-center justify-between gap-4">
                    <span className="text-white font-medium truncate flex-1 flex items-center gap-1">
                      <FileText className="h-3 w-3 text-gray-400" />
                      {item.name}
                    </span>
                    <span className="text-gray-400 truncate max-w-xs">{item.proxy || (lang === "vi" ? "(Không proxy)" : "(No proxy)")}</span>
                    <span className="text-gray-500 truncate max-w-xs">{item.notes || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
