import {
  Play,
  Square,
  Trash2,
  Edit2,
  Laptop,
  FolderOpen,
  Copy,
  Folder,
  Puzzle,
  Bookmark,
  RefreshCw,
  Check,
  AlertCircle,
  MoreHorizontal
} from "lucide-react";
import { type Profile } from "../lib/api";
import { StatusIndicator } from "./StatusIndicator";

interface ProfileRowProps {
  profile: Profile;
  idx: number;
  isSelected: boolean;
  proxyCheckState?: {
    checking?: boolean;
    status?: "live" | "dead" | "direct" | "no_proxy";
    ip?: string;
    country?: string | null;
    error?: string | null;
  };
  isActiveMenu: boolean;
  lang: string;
  t: (key: string, options?: any) => string;
  onRowMouseDown: (e: React.MouseEvent, id: string, idx: number) => void;
  onRowMouseEnter: (idx: number) => void;
  onSelect: (id: string) => void;
  onLaunch: (id: string) => void;
  onStop: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onEditExtension: (id: string, name: string) => void;
  onClone: (id: string) => void;
  onImportCookie: (id: string, name: string) => void;
  onExportCookie: (id: string, name: string) => void;
  onExportProfile: (id: string, name: string) => void;
  onCopyId: (id: string) => void;
  onCopyPath: (path: string) => void;
  onOpenLocation: (id: string) => void;
  setActiveMenuId: (id: string | null) => void;
}

export function ProfileRow({
  profile,
  idx,
  isSelected,
  proxyCheckState,
  isActiveMenu,
  // lang is kept for future use; t() handles all translations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lang: _lang,
  t,
  onRowMouseDown,
  onRowMouseEnter,
  onSelect,
  onLaunch,
  onStop,
  onEdit,
  onDelete,
  onEditExtension,
  onClone,
  onImportCookie,
  onExportCookie,
  onExportProfile,
  onCopyId,
  onCopyPath,
  onOpenLocation,
  setActiveMenuId
}: ProfileRowProps) {
  return (
    <tr
      onMouseDown={(e) => onRowMouseDown(e, profile.id, idx)}
      onMouseEnter={() => onRowMouseEnter(idx)}
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
          if (bytes < 1024 * 1024 * 1024) return <span className="text-teal-400">{(bytes / (1024 * 1024)).toFixed(1)} MB</span>;
          return <span className="text-amber-400">{(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB</span>;
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
          const state = proxyCheckState;

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
        })()}
      </td>
      <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
        {profile.last_run ? (
          <span title={new Date(profile.last_run).toLocaleString()} className="text-gray-300">
            {(() => {
              const d = new Date(profile.last_run);
              const now = new Date();
              const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
              if (diff < 60) return t("time.seconds_ago", { count: diff });
              if (diff < 3600) return t("time.minutes_ago", { count: Math.floor(diff / 60) });
              if (diff < 86400) return t("time.hours_ago", { count: Math.floor(diff / 3600) });
              return t("time.days_ago", { count: Math.floor(diff / 86400) });
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

          <div className="menu-3-dots-container relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(isActiveMenu ? null : profile.id); }}
              className={`flex items-center justify-center h-7 w-7 rounded transition-colors ${
                isActiveMenu ? "bg-surface-4 text-white" : "bg-surface-3 hover:bg-surface-4 text-gray-400 hover:text-white"
              }`}
              title={t("table.col_action")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isActiveMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-surface-1 border border-border rounded-md shadow-2xl py-1 z-30 text-left animate-fade-in text-[11px]">
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
                    onDelete(profile.id);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t("menu.delete")}</span>
                </button>
                <button
                  onMouseDown={() => {
                    onEditExtension(profile.id, profile.name);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Puzzle className="h-3.5 w-3.5" />
                  <span>{t("menu.edit_extension")}</span>
                </button>

                <div className="border-t border-border/60 my-1"></div>

                <button
                  onMouseDown={async () => {
                    setActiveMenuId(null);
                    onClone(profile.id);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t("menu.clone")}</span>
                </button>
                <button
                  onMouseDown={() => {
                    onImportCookie(profile.id, profile.name);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{t("menu.import_cookie")}</span>
                </button>
                <button
                  onMouseDown={() => {
                    onExportCookie(profile.id, profile.name);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{t("menu.export_cookie")}</span>
                </button>
                <button
                  onMouseDown={() => {
                    onExportProfile(profile.id, profile.name);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{t("menu.export_profile")}</span>
                </button>

                <div className="border-t border-border/60 my-1"></div>

                <button
                  onMouseDown={() => {
                    onCopyId(profile.id);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center gap-2 text-gray-300 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t("menu.copy_id")}</span>
                </button>
                <button
                  onMouseDown={() => {
                    onCopyPath(profile.user_data_dir);
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
                    onOpenLocation(profile.id);
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
}
