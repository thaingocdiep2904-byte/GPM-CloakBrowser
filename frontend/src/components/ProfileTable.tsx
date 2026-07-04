import { useState, useMemo, useEffect } from "react";
import {
  Play,
  Square,
  Trash2,
  Edit2,
  Plus,
  Search,
  Laptop,
  Trash,
  FolderOpen,
  LayoutGrid,
  Copy,
  Folder,
  Puzzle,
  ShieldAlert,
  Settings,
  Link,
  Bookmark,
  RefreshCw,
  Info,
  X,
  Check,
  AlertCircle,
  MoreHorizontal,
  Layers,
  ChevronDown
} from "lucide-react";
import { api, type Profile } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { StatusIndicator } from "./StatusIndicator";
import { ImportCookiesDialog } from "./ImportCookiesDialog";
import { ExtensionDialog } from "./ExtensionDialog";

interface ProfileTableProps {
  profiles: Profile[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onLaunch: (id: string) => Promise<any>;
  onStop: (id: string) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onClone: (id: string) => Promise<any>;
  onBulkLaunch: (ids: string[]) => Promise<any>;
  onBulkStop: (ids: string[]) => Promise<any>;
  onBulkDelete: (ids: string[]) => Promise<any>;
  onNew: () => void;
  onBulkNew: () => void;
  onBulkStartupUrl: (ids: string[]) => void;
  onBulkResetProxy: (ids: string[]) => void;
  onBulkCacheClear: (ids: string[]) => void;
  onBulkGroup: (ids: string[]) => void;
  onBulkBookmark: (ids: string[]) => void;
  onArrangeWindows: (ids: string[], layoutType: "grid" | "cascade") => Promise<void>;
  onBulkImport: () => void;
  showFeedback: (msg: string) => void;
  useTrash?: boolean;
  onOpenRecycleBin?: () => void;
}

export function ProfileTable({
  profiles,
  onSelect,
  onEdit,
  onLaunch,
  onStop,
  onDelete,
  onClone,
  onBulkLaunch,
  onBulkStop,
  onBulkDelete,
  onNew,
  onBulkNew,
  onBulkStartupUrl,
  onBulkResetProxy,
  onBulkCacheClear,
  onBulkGroup,
  onBulkBookmark,
  onArrangeWindows,
  onBulkImport,
  showFeedback,
  useTrash = true,
  onOpenRecycleBin,
}: ProfileTableProps) {
  const { lang, t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [proxyCheckStates, setProxyCheckStates] = useState<Record<string, {
    checking: boolean;
    status?: 'live' | 'dead' | 'no_proxy' | 'direct';
    ip?: string;
    country?: string | null;
    error?: string | null;
  }>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [importCookiesTarget, setImportCookiesTarget] = useState<{ id: string; name: string } | null>(null);
  const [extensionTarget, setExtensionTarget] = useState<{ ids: string[]; name: string } | null>(null);

  const selectedProfiles = useMemo(() => {
    return profiles.filter((p) => selectedIds.includes(p.id));
  }, [profiles, selectedIds]);

  const anyRunning = useMemo(() => {
    return selectedProfiles.some((p) => p.status === "running");
  }, [selectedProfiles]);

  const anyStopped = useMemo(() => {
    return selectedProfiles.some((p) => p.status !== "running");
  }, [selectedProfiles]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleMouseDownOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".menu-3-dots-container")) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDownOutside);
    return () => document.removeEventListener("mousedown", handleMouseDownOutside);
  }, []);

  // Lấy danh sách tag/nhóm duy nhất để lọc
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    profiles.forEach((p) => p.tags.forEach((t) => tags.add(t.tag)));
    return Array.from(tags);
  }, [profiles]);

  // Bộ lọc và tìm kiếm profile
  const filtered = useMemo(() => {
    let result = profiles.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.proxy && p.proxy.toLowerCase().includes(search.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()))
    );

    // Lọc theo tag/nhóm
    if (groupFilter !== "all") {
      result = result.filter((p) => p.tags.some((t) => t.tag === groupFilter));
    }

    // Sắp xếp
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [profiles, search, groupFilter, sortBy]);

  // Phím tắt Ctrl+A (chọn tất cả) và Escape (bỏ chọn)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang gõ vào ô nhập liệu
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(filtered.map((p) => p.id));
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered]);

  // MouseUp event listener để dừng quét chuột chọn
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartIndex(null);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleRowMouseDown = (e: React.MouseEvent, id: string, idx: number) => {
    const target = e.target as HTMLElement;
    // Bỏ qua nếu click vào nút, menu, input, link hoặc thẻ span click tên profile
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest(".profile-name-link")
    ) {
      return;
    }

    if (e.button !== 0) return; // Chỉ xử lý chuột trái

    if (e.ctrlKey || e.metaKey) {
      // Ctrl + Click: toggle dòng này
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setLastClickedIndex(idx);
    } else if (e.shiftKey && lastClickedIndex !== null) {
      // Shift + Click: Chọn range từ lastClickedIndex đến idx
      const start = Math.min(lastClickedIndex, idx);
      const end = Math.max(lastClickedIndex, idx);
      const rangeIds = filtered.slice(start, end + 1).map((p) => p.id);
      setSelectedIds(rangeIds);
    } else {
      // Click bình thường: Chọn duy nhất dòng này và bắt đầu drag chọn
      setSelectedIds([id]);
      setLastClickedIndex(idx);
      setIsDragging(true);
      setDragStartIndex(idx);
    }
  };

  const handleRowMouseEnter = (idx: number) => {
    if (!isDragging || dragStartIndex === null) return;
    const start = Math.min(dragStartIndex, idx);
    const end = Math.max(dragStartIndex, idx);
    const rangeIds = filtered.slice(start, end + 1).map((p) => p.id);
    setSelectedIds(rangeIds);
  };



  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showFeedback(msg))
      .catch(() => showFeedback(lang === "vi" ? "Lỗi sao chép bộ nhớ tạm" : "Failed to copy to clipboard"));
  };

  const handleBulkCopy = (type: "id" | "name") => {
    if (selectedIds.length === 0) return;
    const selectedProfiles = profiles.filter((p) => selectedIds.includes(p.id));
    
    if (type === "id") {
      const ids = selectedProfiles.map((p) => p.id).join("\n");
      copyToClipboard(ids, lang === "vi" ? `Đã sao chép ${selectedIds.length} ID vào bộ nhớ tạm!` : `Copied ${selectedIds.length} IDs to clipboard!`);
    } else {
      const names = selectedProfiles.map((p) => p.name).join("\n");
      copyToClipboard(names, lang === "vi" ? `Đã sao chép ${selectedIds.length} tên vào bộ nhớ tạm!` : `Copied ${selectedIds.length} names to clipboard!`);
    }
  };

  const handleExportCSV = () => {
    if (selectedIds.length === 0) return;
    const selectedProfiles = profiles.filter((p) => selectedIds.includes(p.id));
    const headers = ["ID", "Tên Profile", "Proxy", "Hệ điều hành", "Ghi chú"];
    const rows = selectedProfiles.map(p => [p.id, p.name, p.proxy || "", p.platform, p.notes || ""]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `profiles_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback(lang === "vi" ? `Đã xuất dữ liệu ${selectedIds.length} profile thành công!` : `Successfully exported ${selectedIds.length} profiles!`);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return;

    switch (action) {
      case "launch":
        await onBulkLaunch(selectedIds);
        break;
      case "stop":
        await onBulkStop(selectedIds);
        break;
      case "delete":
        if (selectedIds.length > 0) {
          setDeleteTargetIds(selectedIds);
          setDeleteConfirmOpen(true);
        }
        break;
      case "proxy_check":
        setProxyCheckStates((prev) => {
          const next = { ...prev };
          selectedIds.forEach((id) => {
            next[id] = { checking: true };
          });
          return next;
        });
        try {
          const res = await api.bulkCheckProxy(selectedIds);
          setProxyCheckStates((prev) => {
            const next = { ...prev };
            Object.entries(res.results).forEach(([id, result]) => {
              next[id] = {
                checking: false,
                status: result.status,
                ip: result.ip,
                country: result.country,
                error: result.error,
              };
            });
            return next;
          });
          showFeedback(lang === "vi" ? `Đã kiểm tra xong ${selectedIds.length} proxy!` : `Successfully checked ${selectedIds.length} proxies!`);
        } catch (err) {
          showFeedback((lang === "vi" ? "Lỗi kiểm tra proxy: " : "Proxy check error: ") + (err instanceof Error ? err.message : String(err)));
          setProxyCheckStates((prev) => {
            const next = { ...prev };
            selectedIds.forEach((id) => {
              if (next[id]?.checking) {
                next[id] = { checking: false, error: lang === "vi" ? "Lỗi kết nối" : "Connection error" };
              }
            });
            return next;
          });
        }
        break;
      case "grid_layout":
        onArrangeWindows(selectedIds, "grid");
        break;
      case "cascade_layout":
        onArrangeWindows(selectedIds, "cascade");
        break;
      case "group":
        onBulkGroup(selectedIds);
        break;
      case "proxy_reset":
        onBulkResetProxy(selectedIds);
        break;
      case "startup_url":
        onBulkStartupUrl(selectedIds);
        break;
      case "bookmarks":
        onBulkBookmark(selectedIds);
        break;
      case "cache":
        onBulkCacheClear(selectedIds);
        break;
      case "import_excel":
        onBulkImport();
        break;
      case "export_excel":
        handleExportCSV();
        break;
      case "cookies":
        await handleBulkExportCookies(selectedIds);
        break;
      case "extension":
        setExtensionTarget({ ids: selectedIds, name: lang === "vi" ? `Đã chọn ${selectedIds.length} profiles` : `Selected ${selectedIds.length} profiles` });
        break;
      case "excel":
      case "version":
      case "sync":
        alert(lang === "vi" ? `Chức năng "${action}" đang được lên kế hoạch và sẽ sớm khả dụng ở Giai đoạn tiếp theo.` : `Feature "${action}" is planned and will be available in the next phase.`);
        break;
      default:
        break;
    }
  };

  const handleBulkExportCookies = async (ids: string[]) => {
    showFeedback(lang === "vi" ? "Đang xuất cookies hàng loạt..." : "Bulk exporting cookies...");
    try {
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/zip",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/profiles/bulk-export-cookies`, {
        method: "POST",
        headers,
        body: JSON.stringify({ profile_ids: ids }),
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || (lang === "vi" ? "Lỗi từ server" : "Server error"));
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const filename = `bulk_cookies_${new Date().toISOString().slice(0, 10)}.zip`;
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showFeedback(lang === "vi" ? "Xuất cookies thành công!" : "Cookies exported successfully!");
    } catch (err: any) {
      console.error(err);
      alert((lang === "vi" ? "Không thể xuất cookies: " : "Cannot export cookies: ") + (err.message || err));
    }
  };

  const handleExportCookies = async (id: string, name: string) => {
    showFeedback(lang === "vi" ? "Đang xuất cookies..." : "Exporting cookies...");
    try {
      const token = localStorage.getItem("auth_token") || "";
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch(`/api/profiles/${id}/export-cookies`, { headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || (lang === "vi" ? "Lỗi từ server" : "Server error"));
      }
      
      const cookiesData = await res.json();
      
      // Chuyển đổi dữ liệu sang định dạng JSON Blob chuẩn và tải về
      const blob = new Blob([JSON.stringify(cookiesData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const filename = `cookies_${name.replace(/\s+/g, '_')}.json`;
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showFeedback(lang === "vi" ? "Xuất cookies thành công!" : "Cookies exported successfully!");
    } catch (err: any) {
      console.error(err);
      alert((lang === "vi" ? "Không thể xuất cookies: " : "Cannot export cookies: ") + (err.message || err));
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 relative select-none">
      {/* Feedback Toast */}


      {/* 1. Top Menu Action Bar (Giống GPM-Login) */}
      <div className="p-4 border-b border-border flex items-center justify-between gap-4 flex-wrap bg-surface-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onNew} className="btn-menu bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs rounded font-medium flex items-center gap-1.5 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            <span>{t("table.btn_new")}</span>
          </button>
          
          <button onClick={onBulkNew} className="btn-menu bg-amber-600 hover:bg-amber-700 text-white py-1.5 px-3 text-xs rounded font-medium flex items-center gap-1.5 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            <span>{t("table.btn_bulk_new")}</span>
          </button>

          <button onClick={() => handleBulkAction("import_excel")} className="btn-menu bg-surface-3 hover:bg-surface-4 border border-border text-gray-200 py-1.5 px-3 text-xs rounded font-medium flex items-center gap-1.5 transition-colors" title="Import profiles">
            <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
            <span>{t("table.bulk_import")}</span>
          </button>

          {useTrash && onOpenRecycleBin && (
            <button onClick={onOpenRecycleBin} className="btn-menu bg-surface-3 hover:bg-surface-4 border border-border text-gray-200 py-1.5 px-3 text-xs rounded font-medium flex items-center gap-1.5 transition-colors animate-pulse" title={t("table.btn_trash")}>
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>{t("table.btn_trash")}</span>
            </button>
          )}

          <button onClick={() => handleBulkAction("grid_layout")} className="btn-menu bg-surface-3 hover:bg-surface-4 border border-border text-gray-200 py-1.5 px-3 text-xs rounded font-medium flex items-center gap-1.5 transition-colors" title={t("table.arrange")}>
            <LayoutGrid className="h-3.5 w-3.5 text-cyan-500" />
            <span>{t("table.arrange")}</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="p-3 border-b border-border/60 bg-surface-1/50 flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              placeholder={t("table.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-8 bg-surface-2 border border-border rounded text-white text-xs focus:outline-none focus:border-border-hover focus:ring-1 focus:ring-accent/30 placeholder-gray-500"
            />
          </div>

          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-8 w-36 bg-surface-2 border border-border rounded px-2.5 text-white text-xs focus:outline-none focus:border-border-hover focus:ring-1 focus:ring-accent/30"
          >
            <option value="all">{t("table.filter_group_all")}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{t("table.filter_group", { group: tag })}</option>
            ))}
          </select>

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 w-40 bg-surface-2 border border-border rounded px-2.5 text-white text-xs focus:outline-none focus:border-border-hover focus:ring-1 focus:ring-accent/30"
          >
            <option value="newest">{t("table.sort_newest")}</option>
            <option value="oldest">{t("table.sort_oldest")}</option>
            <option value="name-asc">{t("table.sort_name_asc")}</option>
            <option value="name-desc">{t("table.sort_name_desc")}</option>
          </select>

          <span className="text-gray-500 text-[10px] hidden md:inline ml-1">
            {t("table.ctrl_a_tip")}
          </span>
        </div>
        
        <div className="text-gray-400 font-medium mr-1">
          {t("table.total_count", { count: filtered.length })}
        </div>
      </div>

      {/* 3. Fully-Featured Bulk Action Bar (Giống GPM-Login) */}
      <div className="bg-surface-2 border-b border-border px-4 py-2 flex flex-col gap-2.5 text-xs border-l-4 border-l-accent">
        {/* Hàng 1: Trạng thái chọn và các nút hành động cốt lõi */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className={`text-gray-400 hover:text-white p-0.5 rounded hover:bg-surface-3 transition-colors mr-1 ${
                selectedIds.length === 0 ? "opacity-30 cursor-not-allowed pointer-events-none" : ""
              }`}
              title="Bỏ chọn tất cả"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="font-semibold text-gray-200">
              {t("table.selected_count", { count: selectedIds.length })}
            </span>
            <div className="h-3 w-px bg-border mx-1"></div>
            
            {/* Nút hành động chính */}
            {anyStopped && (
              <button
                onClick={() => handleBulkAction("launch")}
                disabled={selectedIds.length === 0}
                className={`btn-bulk bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                  selectedIds.length === 0 ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                <span>{t("table.open")}</span>
              </button>
            )}
            <button
              onClick={() => handleBulkAction("stop")}
              disabled={selectedIds.length === 0 || !anyRunning}
              className={`btn-bulk bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                (selectedIds.length === 0 || !anyRunning) ? "opacity-30 cursor-not-allowed pointer-events-none" : ""
              }`}
            >
              <Square className="h-3.5 w-3.5" />
              <span>{t("table.close")}</span>
            </button>
            <div className="relative group">
              <button
                disabled={selectedIds.length === 0 || !anyRunning}
                className={`btn-bulk bg-surface-3 hover:bg-surface-4 border border-border text-gray-300 font-medium px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
                  (selectedIds.length === 0 || !anyRunning) ? "opacity-30 cursor-not-allowed pointer-events-none" : ""
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5 text-violet-400" />
                <span>{t("table.arrange")}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              <div className="absolute left-0 mt-1 hidden group-hover:block bg-surface-1 border border-border rounded-lg shadow-xl py-1 z-30 min-w-[140px] transition-all">
                <button
                  onClick={() => handleBulkAction("grid_layout")}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-2 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-violet-400" />
                  <span>{t("table.arrange_grid")}</span>
                </button>
                <button
                  onClick={() => handleBulkAction("cascade_layout")}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-2 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  <span>{t("table.arrange_cascade")}</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => handleBulkAction("delete")}
              disabled={selectedIds.length === 0}
              className={`btn-bulk bg-surface-3 hover:bg-rose-950 hover:text-rose-400 border border-border text-gray-300 font-medium px-3 py-1 rounded flex items-center gap-1 transition-colors ${
                selectedIds.length === 0 ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
              }`}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>{t("table.delete")}</span>
            </button>
          </div>

        </div>

        {/* Hàng 2: Tất cả các nút cấu hình phụ (Copy, Proxy, Bookmark, Extension, v.v.) */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-border/40">
          {/* Copy Actions */}
          <button
            onClick={() => handleBulkCopy("id")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
            title={t("table.copy_id")}
          >
            <Copy className="h-3 w-3 text-cyan-400" />
            <span>{t("table.copy_id")}</span>
          </button>
          <button
            onClick={() => handleBulkCopy("name")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
            title={t("table.copy_name")}
          >
            <Copy className="h-3 w-3 text-blue-400" />
            <span>{t("table.copy_name")}</span>
          </button>

          <div className="w-px h-4 bg-border/60 mx-0.5"></div>

          {/* Export Actions */}
          <button
            onClick={() => handleBulkAction("export_excel")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
            title={t("table.bulk_export")}
          >
            <span>{t("table.bulk_export")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("cookies")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
            title={t("table.bulk_export_cookies")}
          >
            <span>{t("table.bulk_export_cookies")}</span>
          </button>

          <div className="w-px h-4 bg-border/60 mx-0.5"></div>

          {/* Config Actions */}
          <button
            onClick={() => handleBulkAction("group")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <Folder className="h-3 w-3 text-amber-500" />
            <span>{t("table.bulk_group")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("extension")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <Puzzle className="h-3 w-3 text-violet-400" />
            <span>{t("table.bulk_extension")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("proxy_check")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <ShieldAlert className="h-3 w-3 text-emerald-400" />
            <span>{t("table.bulk_proxy")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("proxy_reset")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <Settings className="h-3 w-3 text-yellow-500" />
            <span>{t("table.bulk_reset_proxy")}</span>
          </button>

          <button
            onClick={() => handleBulkAction("startup_url")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <Link className="h-3 w-3 text-teal-400" />
            <span>{t("table.bulk_startup")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("bookmarks")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <Bookmark className="h-3 w-3 text-purple-400" />
            <span>{t("table.bulk_bookmark")}</span>
          </button>
          <button
            onClick={() => handleBulkAction("cache")}
            disabled={selectedIds.length === 0}
            className={`btn-bulk-sub ${selectedIds.length === 0 ? "opacity-45 cursor-not-allowed pointer-events-none" : ""}`}
          >
            <RefreshCw className="h-3 w-3 text-sky-400" />
            <span>{t("table.bulk_cache")}</span>
          </button>

        </div>
      </div>

      {/* 4. Table Content List */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 text-sm gap-2">
            <Info className="h-8 w-8 text-gray-600" />
            <span>{t("table.no_profiles")}</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-gray-400 font-semibold bg-surface-1 sticky top-0 z-10">
                <th className="py-3 px-4">{t("table.col_name")}</th>
                <th className="py-3 px-4 w-32">Group</th>
                <th className="py-3 px-4 w-20">{t("table.col_os")}</th>
                <th className="py-3 px-4 w-24">Storage</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4">Proxy IP</th>
                <th className="py-3 px-4 w-32">{t("table.col_last_run")}</th>
                <th className="py-3 px-4">{t("table.col_notes")}</th>
                <th className="py-3 px-4 w-36 text-right">{t("table.col_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((profile, idx) => {
                const isSelected = selectedIds.includes(profile.id);
                return (
                  <tr
                    key={profile.id}
                    onMouseDown={(e) => handleRowMouseDown(e, profile.id, idx)}
                    onMouseEnter={() => handleRowMouseEnter(idx)}
                    className={`cursor-pointer transition-colors border-b border-border/20 select-none ${
                      isSelected ? "bg-surface-3/90 text-white font-medium border-l-2 border-l-accent" : "hover:bg-surface-1/70"
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-white max-w-xs truncate">
                      <span onClick={() => onSelect(profile.id)} className="profile-name-link truncate cursor-pointer hover:text-accent hover:underline">
                        {profile.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      <div className="flex flex-wrap gap-1">
                        {profile.tags.length > 0 ? (
                          profile.tags.map((t) => (
                            <span
                              key={t.tag}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 font-normal"
                              style={t.color ? { backgroundColor: `${t.color}20`, color: t.color } : undefined}
                            >
                              {t.tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Laptop className="h-3.5 w-3.5 text-gray-500" />
                        <span className="capitalize">{profile.platform}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
                      {(() => {
                        const bytes = profile.storage_bytes || 0;
                        if (bytes === 0) return <span className="text-gray-600">0 B</span>;
                        if (bytes < 1024) return <span>{bytes} B</span>;
                        if (bytes < 1024 * 1024) return <span className="text-blue-400">{(bytes / 1024).toFixed(1)} KB</span>;
                        if (bytes < 1024 * 1024 * 1024) return <span className="text-teal-400">{(bytes / (1024*1024)).toFixed(1)} MB</span>;
                        return <span className="text-amber-400">{(bytes / (1024*1024*1024)).toFixed(2)} GB</span>;
                      })()}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusIndicator status={profile.status} />
                        <span className="capitalize">{profile.status === "running" ? t("table.status_running") : t("table.status_ready")}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono max-w-xs" title={profile.proxy || "Direct Connection"}>
                      {(() => {
                        const state = proxyCheckStates[profile.id];
                        
                        if (!state) {
                          return profile.proxy ? (
                            <span className="text-gray-300 truncate block">{profile.proxy}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          );
                        }
                        
                        if (state.checking) {
                          return (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span className="truncate block">{profile.proxy || t("table.proxy_checking")}</span>
                            </div>
                          );
                        }
                        
                        if (state.status === "live") {
                          return (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                              <span className="truncate block" title={`IP thực: ${state.ip} (${state.country || 'N/A'})`}>
                                {state.ip} <span className="text-[10px] opacity-75 font-sans">({state.country || 'Live'})</span>
                              </span>
                            </div>
                          );
                        }

                        if (state.status === "direct") {
                          return (
                            <div className="flex items-center gap-1.5 text-blue-400">
                              <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                              <span className="truncate block" title={`IP máy: ${state.ip} (${state.country || 'N/A'})`}>
                                {state.ip} <span className="text-[10px] opacity-75 font-sans">({state.country || 'Direct'})</span>
                              </span>
                            </div>
                          );
                        }
                        
                        if (state.status === "dead") {
                          return (
                            <div className="flex items-center gap-1.5 text-rose-400" title={state.error || t("table.proxy_conn_error")}>
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                              <span className="truncate block opacity-85">
                                {profile.proxy || "Direct Connection"} <span className="text-[10px] font-sans">({t("table.proxy_error")})</span>
                              </span>
                            </div>
                          );
                        }
                        
                        return profile.proxy ? (
                          <span className="text-gray-300 truncate block">{profile.proxy}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        );
                      })()}</td>
                    <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
                      {profile.last_run ? (
                        <span title={new Date(profile.last_run).toLocaleString()} className="text-gray-300">
                          {(() => {
                            const d = new Date(profile.last_run);
                            const now = new Date();
                            const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
                            if (diff < 60) return t("time.seconds_ago", { count: diff });
                            if (diff < 3600) return t("time.minutes_ago", { count: Math.floor(diff/60) });
                            if (diff < 86400) return t("time.hours_ago", { count: Math.floor(diff/3600) });
                            return t("time.days_ago", { count: Math.floor(diff/86400) });
                          })()}
                        </span>
                      ) : (
                        <span className="text-gray-600">{t("table.not_run_yet")}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 truncate max-w-xs" title={profile.notes || ""}>
                      {profile.notes || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Nút Run/Stop chính */}
                        {profile.status === "running" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onStop(profile.id); }}
                            className="flex items-center justify-center h-7 px-3 gap-1 rounded bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors text-[11px] font-medium"
                            title="Dừng trình duyệt"
                          >
                            <Square className="h-3 w-3" />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); onLaunch(profile.id); }}
                            className="flex items-center justify-center h-7 px-3 gap-1 rounded bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors text-[11px] font-medium"
                            title="Mở trình duyệt"
                          >
                            <Play className="h-3 w-3" />
                            <span>Run</span>
                          </button>
                        )}

                        {/* Nút 3 chấm và Dropdown */}
                        <div className="menu-3-dots-container relative inline-block">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === profile.id ? null : profile.id); }}
                            className={`flex items-center justify-center h-7 w-7 rounded transition-colors ${
                              activeMenuId === profile.id ? "bg-surface-4 text-white" : "bg-surface-3 hover:bg-surface-4 text-gray-400 hover:text-white"
                            }`}
                            title={t("table.col_action")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {activeMenuId === profile.id && (
                            <div className="absolute right-0 mt-1 w-52 bg-surface-1 border border-border rounded-md shadow-2xl py-1 z-30 text-left animate-fade-in text-[11px]">
                              {/* Nhom 1: Chinh sua, Xoa, Sua Extension */}
                              <button
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  onEdit(profile.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                <span>{t("menu.edit")}</span>
                              </button>
                              <button
                                onMouseDown={() => {
                                  setDeleteTargetIds([profile.id]);
                                  setDeleteConfirmOpen(true);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-400 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t("menu.delete")}</span>
                              </button>
                              <button
                                onMouseDown={() => {
                                  setExtensionTarget({ ids: [profile.id], name: profile.name });
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Puzzle className="h-3.5 w-3.5" />
                                <span>{t("menu.edit_extension")}</span>
                              </button>

                              <div className="border-t border-border/60 my-1"></div>

                              {/* Nhom 2: Nhan ban, Import/Export cookie */}
                              <button
                                onMouseDown={async () => {
                                  setActiveMenuId(null);
                                  try {
                                    await onClone(profile.id);
                                    showFeedback(lang === "vi" ? "Đã nhân bản profile thành công!" : "Profile cloned successfully!");
                                  } catch (err) {
                                    alert((lang === "vi" ? "Lỗi nhân bản: " : "Clone failed: ") + (err instanceof Error ? err.message : String(err)));
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>{t("menu.clone")}</span>
                              </button>
                              <button
                                onMouseDown={() => {
                                  setImportCookiesTarget({ id: profile.id, name: profile.name });
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Bookmark className="h-3.5 w-3.5" />
                                <span>{t("menu.import_cookie")}</span>
                              </button>
                              <button
                                onMouseDown={() => {
                                  handleExportCookies(profile.id, profile.name);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Bookmark className="h-3.5 w-3.5" />
                                <span>{t("menu.export_cookie")}</span>
                              </button>

                              <div className="border-t border-border/60 my-1"></div>

                              {/* Nhom 3: Copy ID, Copy Path, Open profile location */}
                              <button
                                onMouseDown={() => {
                                  copyToClipboard(profile.id, lang === "vi" ? "Đã sao chép ID profile!" : "Profile ID copied!");
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>{t("menu.copy_id")}</span>
                              </button>
                              <button
                                onMouseDown={() => {
                                  copyToClipboard(profile.user_data_dir, lang === "vi" ? "Đã sao chép đường dẫn profile!" : "Profile path copied!");
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                              >
                                <Folder className="h-3.5 w-3.5" />
                                <span>{t("menu.copy_path")}</span>
                              </button>
                              <button
                                onMouseDown={async () => {
                                  setActiveMenuId(null);
                                  try {
                                    await api.openFolder(profile.id);
                                    showFeedback(lang === "vi" ? "Đã mở thư mục profile!" : "Profile directory opened!");
                                  } catch (err) {
                                    alert((lang === "vi" ? "Lỗi mở thư mục: " : "Open folder failed: ") + (err instanceof Error ? err.message : String(err)));
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors font-medium text-emerald-400 hover:text-white"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-emerald-500" />
                                <span>{t("menu.open_location")}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* React Custom Delete Confirm Modal giống app Windows */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-surface-1 border border-border rounded-lg shadow-2xl w-full max-w-md flex flex-col relative animate-scale-up">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Trash className="h-4 w-4 text-rose-500" />
                {useTrash ? t("table.trash_confirm_title_trash") : t("table.trash_confirm_title_perm")}
              </h3>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors"
                title={t("table.close_btn")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Body Modal */}
            <div className="p-5 text-gray-300 text-xs leading-relaxed">
              {deleteTargetIds.length === 1 ? (
                <div>
                  {lang === "vi" ? (
                    <>
                      Bạn có chắc chắn muốn xóa profile{" "}
                      <strong className="text-white">
                        "{profiles.find((p) => p.id === deleteTargetIds[0])?.name}"
                      </strong>{" "}
                      không?
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete profile{" "}
                      <strong className="text-white">
                        "{profiles.find((p) => p.id === deleteTargetIds[0])?.name}"
                      </strong>?
                    </>
                  )}
                  {useTrash ? (
                    <p className="mt-2 text-amber-400 font-medium">
                      ℹ️ {lang === "vi" ? "Profile sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại sau." : "Profile will be moved to the Recycle Bin. You can restore it later."}
                    </p>
                  ) : (
                    <p className="mt-2 text-rose-400 font-medium">
                      ⚠️ {lang === "vi" ? "Cảnh báo: Thao tác này sẽ xóa vĩnh viễn dữ liệu trình duyệt trên ổ đĩa và không thể hoàn tác." : "Warning: This will permanently delete all browser profile data from disk and cannot be undone."}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {lang === "vi" ? (
                    <>
                      Bạn có chắc chắn muốn xóa{" "}
                      <strong className="text-white">{deleteTargetIds.length} profiles</strong> đã chọn không?
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete the{" "}
                      <strong className="text-white">{deleteTargetIds.length} selected profiles</strong>?
                    </>
                  )}
                  {useTrash ? (
                    <p className="mt-2 text-amber-400 font-medium">
                      ℹ️ {lang === "vi" ? "Các profile sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại sau." : "Profiles will be moved to the Recycle Bin. You can restore them later."}
                    </p>
                  ) : (
                    <p className="mt-2 text-rose-400 font-medium">
                      ⚠️ {lang === "vi" ? "Cảnh báo: Thao tác này sẽ xóa vĩnh viễn toàn bộ dữ liệu trình duyệt trên ổ đĩa của các profile này." : "Warning: This will permanently delete all browser files from disk for these profiles."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 p-3 bg-surface-2/40 border-t border-border/60 rounded-b-lg">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-1.5 rounded bg-surface-3 hover:bg-surface-4 border border-border text-gray-300 font-medium transition-colors text-xs"
              >
                {t("form.cancel")}
              </button>
              <button
                onClick={async () => {
                  const idsToDelete = [...deleteTargetIds];
                  const nameToDelete = profiles.find((p) => p.id === idsToDelete[0])?.name;
                  setDeleteConfirmOpen(false);
                  setDeleteTargetIds([]);
                  if (idsToDelete.length === 1) {
                    await onDelete(idsToDelete[0]!);
                    showFeedback(useTrash
                      ? (lang === "vi" ? `Đã chuyển profile "${nameToDelete}" vào Thùng rác!` : `Moved profile "${nameToDelete}" to Recycle Bin!`)
                      : (lang === "vi" ? `Đã xóa vĩnh viễn profile "${nameToDelete}"!` : `Permanently deleted profile "${nameToDelete}"!`)
                    );
                  } else {
                    await onBulkDelete(idsToDelete);
                    setSelectedIds([]);
                    showFeedback(useTrash
                      ? (lang === "vi" ? `Đã chuyển ${idsToDelete.length} profile vào Thùng rác!` : `Moved ${idsToDelete.length} profiles to Recycle Bin!`)
                      : (lang === "vi" ? `Đã xóa vĩnh viễn ${idsToDelete.length} profile!` : `Permanently deleted ${idsToDelete.length} profiles!`)
                    );
                  }
                }}
                className={`px-4 py-1.5 rounded text-white font-medium transition-colors text-xs flex items-center gap-1.5 shadow-md ${
                  useTrash
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-950/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-950/20"
                }`}
              >
                {useTrash ? t("table.trash_confirm_title_trash") : t("table.trash_confirm_title_perm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {importCookiesTarget && (
        <ImportCookiesDialog
          profileId={importCookiesTarget.id}
          profileName={importCookiesTarget.name}
          onSuccess={(count) => {
            setImportCookiesTarget(null);
            showFeedback(lang === "vi" ? `Đã nhập thành công ${count} cookies!` : `Successfully imported ${count} cookies!`);
          }}
          onCancel={() => setImportCookiesTarget(null)}
        />
      )}

      {extensionTarget && (
        <ExtensionDialog
          profileIds={extensionTarget.ids}
          profileName={extensionTarget.name}
          onCancel={() => {
            setExtensionTarget(null);
            setSelectedIds([]);
          }}
          onSave={(msg) => {
            setExtensionTarget(null);
            setSelectedIds([]);
            showFeedback(msg);
          }}
        />
      )}
    </div>
  );
}
