import { useState, useEffect } from "react";
import { X, Puzzle, ToggleLeft, ToggleRight, Trash2, Plus, Upload, Loader2, AlertCircle, Save } from "lucide-react";
import { api, type Extension, type ProfileExtension } from "../lib/api";
import { useLanguage } from "../lib/i18n";

interface ExtensionDialogProps {
  profileIds: string[];
  profileName: string;
  onCancel: () => void;
  onSave?: (msg: string) => void;
}

export function ExtensionDialog({ profileIds, profileName, onCancel, onSave }: ExtensionDialogProps) {
  const { lang, t } = useLanguage();
  const [profileExtensions, setProfileExtensions] = useState<ProfileExtension[]>([]);
  const [allExtensions, setAllExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [profileIds]);

  const fetchData = async () => {
    if (profileIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // Use the first profile as the reference state
      const [pExts, allExts] = await Promise.all([
        api.getProfileExtensions(profileIds[0]!),
        api.getExtensions(),
      ]);
      setProfileExtensions(pExts);
      setAllExtensions(allExts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Không thể tải dữ liệu extension." : "Failed to load extension data.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (extId: string, currentEnabled: boolean) => {
    setProfileExtensions((prev) =>
      prev.map((e) => (e.id === extId ? { ...e, is_enabled: !currentEnabled } : e))
    );
  };

  const handleRemove = (extId: string) => {
    setProfileExtensions((prev) => prev.filter((e) => e.id !== extId));
  };

  const handleAdd = (extId: string) => {
    const targetExt = allExtensions.find((e) => e.id === extId);
    if (targetExt) {
      setProfileExtensions((prev) => [
        ...prev,
        {
          id: targetExt.id,
          name: targetExt.name,
          version: targetExt.version,
          path: targetExt.path,
          is_shared: targetExt.is_shared,
          is_enabled: true,
        },
      ]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      setError(
        lang === "vi"
          ? "Vui lòng chỉ tải lên file có định dạng nén .zip."
          : "Please upload .zip compressed files only."
      );
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const newExt = await api.uploadExtension(file, false);
      setAllExtensions((prev) => [...prev, newExt]);

      // Add to local state (assigned list)
      setProfileExtensions((prev) => [
        ...prev,
        {
          id: newExt.id,
          name: newExt.name,
          version: newExt.version,
          path: newExt.path,
          is_shared: newExt.is_shared,
          is_enabled: true,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Lỗi khi tải lên extension." : "Error uploading extension.")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = profileExtensions.map((e) => ({
        id: e.id,
        is_enabled: e.is_enabled
      }));
      
      await Promise.all(
        profileIds.map((pid) => api.updateProfileExtensions(pid, payload))
      );
      
      if (onSave) {
        onSave(
          lang === "vi"
            ? "Đã lưu cấu hình extension thành công!"
            : "Extension configuration saved successfully!"
        );
      } else {
        onCancel();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (lang === "vi" ? "Lỗi khi lưu cấu hình extension." : "Error saving extension configuration.")
      );
    } finally {
      setSaving(false);
    }
  };

  const availableExtensions = allExtensions.filter(
    (ext) => !profileExtensions.some((pe) => pe.id === ext.id)
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface-1 border border-border rounded-lg shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border relative">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                {lang === "vi" ? "Quản lý Extension" : "Manage Extensions"}
              </h2>
              <p className="text-[10px] text-gray-400">
                {profileIds.length > 1
                  ? (lang === "vi" ? `Đã chọn: ${profileIds.length} profiles` : `Selected: ${profileIds.length} profiles`)
                  : (lang === "vi" ? `Profile: ${profileName}` : `Profile: ${profileName}`)
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-8">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-1.5 px-4 rounded text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-violet-950/20 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{lang === "vi" ? "Lưu lại" : "Save"}</span>
            </button>
          </div>
          <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors z-20" title={t("table.close_btn")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-2.5 bg-rose-950/30 border border-rose-800/40 text-rose-300 text-[11px] rounded flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
            <span className="text-xs text-gray-400">
              {lang === "vi" ? "Đang tải dữ liệu extension..." : "Loading extension data..."}
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-gray-300">
            
            {/* 1. Profile Extensions Section */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-2">
                {lang === "vi" ? "Extension đã gán" : "Assigned Extensions"} ({profileExtensions.length})
              </h3>
              {profileExtensions.length === 0 ? (
                <div className="p-4 bg-surface-2/40 border border-border/50 rounded-md text-center text-gray-500 italic">
                  {lang === "vi"
                    ? "Chưa có extension nào được gán cho các profile này."
                    : "No extensions assigned to these profiles."}
                </div>
              ) : (
                <div className="border border-border/50 rounded-md bg-surface-2/20 divide-y divide-border/40">
                  {profileExtensions.map((ext) => (
                    <div key={ext.id} className="flex items-center justify-between p-3 hover:bg-surface-3/15 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Puzzle className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{ext.name}</p>
                          <p className="text-[10px] text-gray-500">v{ext.version || "1.0"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Toggle Button */}
                        <button
                          onClick={() => handleToggle(ext.id, ext.is_enabled)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title={ext.is_enabled ? (lang === "vi" ? "Tắt Extension" : "Disable Extension") : (lang === "vi" ? "Bật Extension" : "Enable Extension")}
                        >
                          {ext.is_enabled ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-gray-500" />
                          )}
                        </button>
                        
                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemove(ext.id)}
                          className="p-1 hover:bg-rose-950/20 text-gray-500 hover:text-rose-400 rounded transition-all"
                          title={lang === "vi" ? "Gỡ khỏi Profile" : "Remove from Profile"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Available Extensions in System */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
                {lang === "vi" ? "Kho Extension hệ thống" : "System Extensions Repository"} ({availableExtensions.length})
              </h3>
              {availableExtensions.length === 0 ? (
                <div className="p-4 bg-surface-2/40 border border-border/50 rounded-md text-center text-gray-500 italic">
                  {lang === "vi" ? "Không còn extension nào chưa cài đặt." : "No more extensions to install."}
                </div>
              ) : (
                <div className="border border-border/50 rounded-md bg-surface-2/20 max-h-40 overflow-y-auto divide-y divide-border/40">
                  {availableExtensions.map((ext) => (
                    <div key={ext.id} className="flex items-center justify-between p-3 hover:bg-surface-3/15 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Puzzle className="h-4 w-4 text-gray-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-200 truncate">{ext.name}</p>
                          <p className="text-[10px] text-gray-500">v{ext.version || "1.0"}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleAdd(ext.id)}
                        className="bg-surface-3 hover:bg-emerald-600 border border-border hover:border-emerald-500 text-white p-1 rounded transition-all flex items-center gap-1 text-[10px]"
                        title={lang === "vi" ? "Thêm vào các Profile" : "Add to Profiles"}
                      >
                        <Plus className="h-3 w-3" />
                        <span>{lang === "vi" ? "Thêm" : "Add"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Direct Upload Section */}
            <div className="border-t border-border pt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                {lang === "vi" ? "Tải lên Extension mới (.zip)" : "Upload New Extension (.zip)"}
              </h3>
              <div className="relative border border-dashed border-border/70 hover:border-amber-500/70 rounded-md p-4 bg-surface-2/10 hover:bg-surface-2/25 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                    <span className="text-[11px] text-amber-400 font-medium">
                      {lang === "vi" ? "Đang tải và giải nén extension..." : "Uploading and extracting extension..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-gray-400 group-hover:text-amber-500 transition-colors" />
                    <div className="text-[11px] text-gray-400">
                      <span className="text-amber-500 font-semibold group-hover:underline">
                        {lang === "vi" ? "Nhấp để tải lên" : "Click to upload"}
                      </span>{" "}
                      {lang === "vi" ? "file .zip extension" : "extension .zip file"}
                    </div>
                    <span className="text-[9px] text-gray-500">
                      {lang === "vi"
                        ? "Hệ thống sẽ giải nén và tự động gán vào các profile"
                        : "The system will extract and automatically assign to profiles"}
                    </span>
                  </>
                )}
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
