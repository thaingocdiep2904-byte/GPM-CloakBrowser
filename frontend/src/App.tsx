import { useState, useCallback, useEffect } from "react";
import { Lock, X, Monitor, Settings, Terminal, Info } from "lucide-react";
import { useProfiles } from "./hooks/useProfiles";
import { api, setOnUnauthorized, type ProfileCreateData } from "./lib/api";
import { ProfileForm } from "./components/ProfileForm";
import { ProfileViewer } from "./components/ProfileViewer";
import { LoginPage } from "./components/LoginPage";
import { ProfileTable } from "./components/ProfileTable";
import { BulkCreateDialog } from "./components/BulkCreateDialog";
import { BulkStartupUrlDialog } from "./components/BulkStartupUrlDialog";
import { BulkResetProxyDialog } from "./components/BulkResetProxyDialog";
import { BulkCacheClearDialog } from "./components/BulkCacheClearDialog";
import { BulkGroupDialog } from "./components/BulkGroupDialog";
import { BulkBookmarkDialog } from "./components/BulkBookmarkDialog";
import { BulkImportDialog } from "./components/BulkImportDialog";
import { SettingsTab } from "./components/SettingsTab";
import { ApiTab } from "./components/ApiTab";
import { AboutTab } from "./components/AboutTab";
import logoImg from "./logo.png";

type AuthState = "checking" | "required" | "ok" | "error";
type View = "empty" | "create" | "edit" | "view";
type Tab = "profiles" | "settings" | "api" | "about";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    setOnUnauthorized(() => setAuthState("required"));

    api.authStatus()
      .then(({ auth_required, authenticated }) => {
        setAuthRequired(auth_required);
        if (!auth_required || authenticated) {
          setAuthState("ok");
        } else {
          setAuthState("required");
        }
      })
      .catch((err) => {
        console.warn("[auth] status check failed:", err);
        setAuthState("error");
      });

    return () => setOnUnauthorized(null);
  }, []);

  if (authState === "checking") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">Unable to reach the server</p>
          <button
            onClick={() => {
              setAuthState("checking");
              api.authStatus()
                .then(({ auth_required, authenticated }) => {
                  setAuthRequired(auth_required);
                  setAuthState(!auth_required || authenticated ? "ok" : "required");
                })
                .catch(() => setAuthState("error"));
            }}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (authState === "required") {
    return <LoginPage onSuccess={() => setAuthState("ok")} />;
  }

  return (
    <AppContent
      authRequired={authRequired}
      onLogout={async () => {
        await api.logout();
        setAuthState("required");
      }}
    />
  );
}

interface AppContentProps {
  authRequired: boolean;
  onLogout: () => void;
}

function AppContent({ authRequired, onLogout }: AppContentProps) {
  const { profiles, loading, error, refresh, create, update, remove, launch, stop, bulkLaunch, bulkStop, bulkDelete, bulkCreate } = useProfiles();
  const [activeTab, setActiveTab] = useState<Tab>("profiles");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("empty");
  const [osName, setOsName] = useState<string | null>(null);

  const handleTableLaunch = useCallback(async (id: string) => {
    setSelectedId(id);
    setView("empty"); // Đóng modal cấu hình
    const result = await launch(id);
    if (result && osName !== "nt") setView("view");
  }, [launch, osName]);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [bulkStartupUrlOpen, setBulkStartupUrlOpen] = useState(false);
  const [bulkResetProxyOpen, setBulkResetProxyOpen] = useState(false);
  const [bulkCacheClearOpen, setBulkCacheClearOpen] = useState(false);
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkBookmarkOpen, setBulkBookmarkOpen] = useState(false);
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const handleBulkStartupUrl = useCallback(async (ids: string[], url: string) => {
    await api.bulkSetStartupUrl(ids, url);
    await refresh();
  }, [refresh]);

  const handleBulkResetProxy = useCallback(async (ids: string[], proxies: string[]) => {
    await api.bulkResetProxy(ids, proxies);
    await refresh();
  }, [refresh]);

  const handleBulkGroup = useCallback(async (ids: string[], tags: { tag: string; color: string | null }[]) => {
    await api.bulkSetGroup(ids, tags);
    await refresh();
  }, [refresh]);

  const handleBulkCacheClear = useCallback(async (ids: string[]) => {
    await api.bulkClearCache(ids);
    await refresh();
  }, [refresh]);

  const handleBulkBookmark = useCallback(async (ids: string[], bookmarks: { name: string; url: string }[]) => {
    await api.bulkSetBookmark(ids, bookmarks);
    await refresh();
  }, [refresh]);

  const handleBulkImport = useCallback(async (list: { name: string; proxy?: string; notes?: string }[]) => {
    await api.bulkImport(list);
    await refresh();
  }, [refresh]);

  const handleGridLayout = useCallback(async () => {
    try {
      const res = await api.gridLayout();
      if (res.arranged === 0) {
        alert("Không có cửa sổ trình duyệt nào đang chạy để sắp xếp.");
      } else {
        alert(`Đã sắp xếp xong ${res.arranged} cửa sổ trình duyệt đang chạy dạng lưới!`);
      }
    } catch (err) {
      alert("Lỗi sắp xếp cửa sổ: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const triggerBulkStartupUrl = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setBulkStartupUrlOpen(true);
  }, []);

  const triggerBulkResetProxy = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setBulkResetProxyOpen(true);
  }, []);

  const triggerBulkCacheClear = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setBulkCacheClearOpen(true);
  }, []);

  const triggerBulkGroup = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setBulkGroupOpen(true);
  }, []);

  const triggerBulkBookmark = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setBulkBookmarkOpen(true);
  }, []);

  useEffect(() => {
    api.getStatus()
      .then((status) => setOsName(status.os_name))
      .catch((err) => console.error("Failed to fetch system status:", err));
  }, []);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    const profile = profiles.find((p) => p.id === id);
    setView(profile?.status === "running" ? "view" : "empty");
  }, [profiles]);

  const handleEdit = useCallback((id: string) => {
    setSelectedId(id);
    setView("edit");
  }, []);

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setView("create");
  }, []);

  const handleCreate = useCallback(async (data: ProfileCreateData) => {
    const profile = await create(data);
    if (profile) {
      setSelectedId(null);
      setView("empty");
      await refresh();
    }
  }, [create, refresh]);

  const handleUpdate = useCallback(async (data: ProfileCreateData) => {
    if (!selectedId) return;
    const profile = await update(selectedId, data);
    if (profile) {
      setSelectedId(null);
      setView("empty");
      await refresh();
    }
  }, [selectedId, update, refresh]);

  const handleClone = useCallback(async (id: string) => {
    try {
      await api.cloneProfile(id);
      await refresh();
    } catch (err) {
      alert("Lỗi nhân bản profile: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [refresh]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await remove(selectedId);
    setSelectedId(null);
    setView("empty");
  }, [selectedId, remove]);

  const handleVncDisconnect = useCallback(() => {
    setView("empty"); // Quay về danh sách chính
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-surface-0 font-sans selection:bg-primary/30 selection:text-white">
      {/* Dock (Sidebar điều hướng bên trái ngoài cùng) */}
      <div className="w-[150px] border-r border-border bg-surface-2 flex flex-col py-4 px-2 flex-shrink-0 gap-1 z-10">
        <div className="flex items-center gap-2 px-1 py-2 mb-4 border-b border-border/40 pb-3">
          <img src={logoImg} alt="Logo" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
          <span className="text-white font-bold text-xs tracking-tight leading-tight">CloakBrowser Manager</span>
        </div>

        {/* Tab 1: Profiles */}
        <button
          onClick={() => setActiveTab("profiles")}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all w-full ${
            activeTab === "profiles"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-gray-400 hover:text-white hover:bg-surface-3"
          }`}
          title="Quản lý Profiles"
        >
          <Monitor className="h-4 w-4 flex-shrink-0" />
          <span>Quản lý Profile</span>
        </button>

        {/* Tab 2: Settings */}
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all w-full ${
            activeTab === "settings"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-gray-400 hover:text-white hover:bg-surface-3"
          }`}
          title="Quản lý Settings"
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          <span>Cài đặt hệ thống</span>
        </button>

        {/* Tab 3: API */}
        <button
          onClick={() => setActiveTab("api")}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all w-full ${
            activeTab === "api"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-gray-400 hover:text-white hover:bg-surface-3"
          }`}
          title="Tài liệu API Playwright"
        >
          <Terminal className="h-4 w-4 flex-shrink-0" />
          <span>Tài liệu & API</span>
        </button>

        {/* Tab 4: About */}
        <button
          onClick={() => setActiveTab("about")}
          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all w-full ${
            activeTab === "about"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-gray-400 hover:text-white hover:bg-surface-3"
          }`}
          title="Giới thiệu"
        >
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>Giới thiệu</span>
        </button>

        {/* Nút đăng xuất nếu có yêu cầu auth */}
        {authRequired && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all w-full text-rose-400 hover:text-white hover:bg-rose-600/20 mt-auto border border-rose-500/20"
            title="Đăng xuất khỏi hệ thống"
          >
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>

      {/* Vùng hiển thị nội dung theo Tab */}
      {activeTab === "profiles" ? (
        <div className="flex-1 flex flex-col min-w-0">

            {/* Error banner */}
            {error && (
              <div className="px-4 py-2 bg-red-600/15 border-b border-red-600/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain relative">
              {view !== "view" ? (
                <ProfileTable
                  profiles={profiles}
                  onSelect={handleSelect}
                  onEdit={handleEdit}
                  onLaunch={handleTableLaunch}
                  onStop={stop}
                  onDelete={remove}
                  onClone={handleClone}
                  onBulkLaunch={bulkLaunch}
                  onBulkStop={bulkStop}
                  onBulkDelete={bulkDelete}
                  onNew={handleNew}
                  onBulkNew={() => setBulkCreateOpen(true)}
                  onBulkStartupUrl={triggerBulkStartupUrl}
                  onBulkResetProxy={triggerBulkResetProxy}
                  onBulkCacheClear={triggerBulkCacheClear}
                  onBulkGroup={triggerBulkGroup}
                  onBulkBookmark={triggerBulkBookmark}
                  onGridLayout={handleGridLayout}
                  onBulkImport={() => setBulkImportOpen(true)}
                />
              ) : (
                selected && selected.status === "running" && (
                  <ProfileViewer
                    key={selected.id}
                    profileId={selected.id}
                    cdpUrl={selected.cdp_url}
                    clipboardSync={selected.clipboard_sync}
                    onDisconnect={handleVncDisconnect}
                  />
                )
              )}

              {/* Modal overlay cho Tạo và Sửa profile đơn lẻ */}
              {(view === "create" || (view === "edit" && selected)) && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-50 animate-fade-in backdrop-blur-xs">
                  <div className="bg-surface-1 border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] min-h-[600px] flex flex-col relative animate-scale-up overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedId(null);
                        setView("empty");
                      }}
                      className="absolute top-5 right-6 text-gray-400 hover:text-white p-1 rounded hover:bg-surface-3 transition-colors z-20"
                      title="Đóng cửa sổ"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <div className="flex-1 overflow-y-auto">
                      <ProfileForm
                        profile={view === "edit" ? selected : null}
                        onSave={view === "create" ? handleCreate : handleUpdate}
                        onDelete={view === "edit" ? handleDelete : undefined}
                        onCancel={() => {
                          setSelectedId(null);
                          setView("empty");
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      ) : activeTab === "settings" ? (
        <SettingsTab />
      ) : activeTab === "api" ? (
        <ApiTab />
      ) : (
        <AboutTab />
      )}

      {bulkCreateOpen && (
        <BulkCreateDialog
          onSave={bulkCreate}
          onCancel={() => setBulkCreateOpen(false)}
        />
      )}

      {bulkStartupUrlOpen && (
        <BulkStartupUrlDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkStartupUrl}
          onCancel={() => setBulkStartupUrlOpen(false)}
        />
      )}

      {bulkResetProxyOpen && (
        <BulkResetProxyDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkResetProxy}
          onCancel={() => setBulkResetProxyOpen(false)}
        />
      )}

      {bulkCacheClearOpen && (
        <BulkCacheClearDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkCacheClear}
          onCancel={() => setBulkCacheClearOpen(false)}
        />
      )}

      {bulkGroupOpen && (
        <BulkGroupDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkGroup}
          onCancel={() => setBulkGroupOpen(false)}
        />
      )}

      {bulkBookmarkOpen && (
        <BulkBookmarkDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkBookmark}
          onCancel={() => setBulkBookmarkOpen(false)}
        />
      )}

      {bulkImportOpen && (
        <BulkImportDialog
          onImport={handleBulkImport}
          onCancel={() => setBulkImportOpen(false)}
        />
      )}
    </div>
  );
}
