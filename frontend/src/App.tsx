import { useState, useCallback, useEffect } from "react";
import { Lock, X, Monitor, Settings, Terminal, Info } from "lucide-react";
import { useProfiles } from "./hooks/useProfiles";
import { api, setOnUnauthorized, type ProfileCreateData } from "./lib/api";
import { ProfileForm } from "./components/ProfileForm";
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
import { RecycleBinDialog } from "./components/RecycleBinDialog";
import logoImg from "./logo.png";

type AuthState = "checking" | "required" | "ok" | "error";
type View = "empty" | "create" | "edit";
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [useTrash, setUseTrash] = useState(true);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        setUseTrash(!s.no_trash);
      })
      .catch((err) => console.error("Failed to load settings in AppContent:", err));
  }, [activeTab]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  const handleTableLaunch = useCallback(async (id: string) => {
    setSelectedId(id);
    setView("empty"); // Đóng modal cấu hình
    await launch(id);
    // Chạy trực tiếp trên desktop thật, không chuyển sang view VNC nữa
    setView("empty");
  }, [launch, osName]);
  type ActiveBulkModal = "create" | "startup_url" | "reset_proxy" | "cache_clear" | "group" | "bookmark" | "import" | null;
  const [activeBulkModal, setActiveBulkModal] = useState<ActiveBulkModal>(null);
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);

  const handleBulkStartupUrl = useCallback(async (ids: string[], url: string) => {
    await api.bulkSetStartupUrl(ids, url);
    await refresh();
    showFeedback(`Đã thiết lập URL khởi động cho ${ids.length} profiles thành công!`);
  }, [refresh, showFeedback]);

  const handleBulkResetProxy = useCallback(async (ids: string[], proxies: string[]) => {
    await api.bulkResetProxy(ids, proxies);
    await refresh();
    showFeedback(`Đã cập nhật proxy cho ${ids.length} profiles thành công!`);
  }, [refresh, showFeedback]);

  const handleBulkGroup = useCallback(async (ids: string[], tags: { tag: string; color: string | null }[]) => {
    await api.bulkSetGroup(ids, tags);
    await refresh();
    showFeedback(`Đã gom nhóm cho ${ids.length} profiles thành công!`);
  }, [refresh, showFeedback]);

  const handleBulkCacheClear = useCallback(async (ids: string[]) => {
    await api.bulkClearCache(ids);
    await refresh();
    showFeedback(`Đã xóa cache cho ${ids.length} profiles thành công!`);
  }, [refresh, showFeedback]);

  const handleBulkBookmark = useCallback(async (ids: string[], bookmarks: { name: string; url: string }[]) => {
    await api.bulkSetBookmark(ids, bookmarks);
    await refresh();
    showFeedback(`Đã cập nhật dấu trang cho ${ids.length} profiles thành công!`);
  }, [refresh, showFeedback]);

  const handleBulkImport = useCallback(async (list: { name: string; proxy?: string; notes?: string }[]) => {
    await api.bulkImport(list);
    await refresh();
    showFeedback(`Đã nhập thành công ${list.length} profiles!`);
  }, [refresh, showFeedback]);

  const handleArrangeWindows = useCallback(async (ids: string[], layoutType: "grid" | "cascade") => {
    try {
      const res = await api.arrangeProfiles(ids, layoutType);
      if (res.success_count === 0 && res.failed_count === 0) {
        alert("Không có cửa sổ trình duyệt nào đang chạy để sắp xếp.");
      } else {
        showFeedback(`Đã sắp xếp xong: ${res.success_count} thành công, ${res.failed_count} thất bại.`);
      }
    } catch (err) {
      alert("Lỗi sắp xếp cửa sổ: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [showFeedback]);

  const triggerBulkStartupUrl = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setActiveBulkModal("startup_url");
  }, []);

  const triggerBulkResetProxy = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setActiveBulkModal("reset_proxy");
  }, []);

  const triggerBulkCacheClear = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setActiveBulkModal("cache_clear");
  }, []);

  const triggerBulkGroup = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setActiveBulkModal("group");
  }, []);

  const triggerBulkBookmark = useCallback((ids: string[]) => {
    setBulkTargetIds(ids);
    setActiveBulkModal("bookmark");
  }, []);

  useEffect(() => {
    api.getStatus()
      .then((status) => setOsName(status.os_name))
      .catch((err) => console.error("Failed to fetch system status:", err));
  }, []);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setView("empty");
  }, []);

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
      showFeedback("Đã tạo Profile thành công!");
    }
  }, [create, refresh, showFeedback]);

  const handleUpdate = useCallback(async (data: ProfileCreateData) => {
    if (!selectedId) return;
    const profile = await update(selectedId, data);
    if (profile) {
      setSelectedId(null);
      setView("empty");
      await refresh();
      showFeedback("Đã lưu cấu hình Profile thành công!");
    }
  }, [selectedId, update, refresh, showFeedback]);

  const handleClone = useCallback(async (id: string) => {
    try {
      await api.cloneProfile(id);
      await refresh();
      showFeedback("Nhân bản Profile thành công!");
    } catch (err) {
      alert("Lỗi nhân bản profile: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [refresh, showFeedback]);

  const handleBulkCreate = useCallback(async (data: any) => {
    await bulkCreate(data);
    setActiveBulkModal(null);
    showFeedback(`Đã tạo thành công ${data.count || 1} profiles!`);
  }, [bulkCreate, showFeedback]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await remove(selectedId);
    setSelectedId(null);
    setView("empty");
  }, [selectedId, remove]);


  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-surface-0 font-sans selection:bg-primary/30 selection:text-white relative">
      {/* Feedback Toast Toàn Cục */}
      {feedback && (
        <div className="fixed top-4 right-4 bg-emerald-600 border border-emerald-500 text-white text-xs px-4 py-2 rounded shadow-lg z-[9999] animate-bounce">
          {feedback}
        </div>
      )}
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
                onBulkNew={() => setActiveBulkModal("create")}
                onBulkStartupUrl={triggerBulkStartupUrl}
                onBulkResetProxy={triggerBulkResetProxy}
                onBulkCacheClear={triggerBulkCacheClear}
                onBulkGroup={triggerBulkGroup}
                onBulkBookmark={triggerBulkBookmark}
                onArrangeWindows={handleArrangeWindows}
                onBulkImport={() => setActiveBulkModal("import")}
                showFeedback={showFeedback}
                useTrash={useTrash}
                onOpenRecycleBin={() => setRecycleBinOpen(true)}
              />

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
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      ) : activeTab === "settings" ? (
        <SettingsTab showFeedback={showFeedback} />
      ) : activeTab === "api" ? (
        <ApiTab />
      ) : (
        <AboutTab />
      )}

      {activeBulkModal === "create" && (
        <BulkCreateDialog
          onSave={handleBulkCreate}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "startup_url" && (
        <BulkStartupUrlDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkStartupUrl}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "reset_proxy" && (
        <BulkResetProxyDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkResetProxy}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "cache_clear" && (
        <BulkCacheClearDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkCacheClear}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "group" && (
        <BulkGroupDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkGroup}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "bookmark" && (
        <BulkBookmarkDialog
          profileIds={bulkTargetIds}
          onSave={handleBulkBookmark}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {activeBulkModal === "import" && (
        <BulkImportDialog
          onImport={handleBulkImport}
          onCancel={() => setActiveBulkModal(null)}
        />
      )}

      {recycleBinOpen && (
        <RecycleBinDialog
          onCancel={() => setRecycleBinOpen(false)}
          onRefreshProfiles={refresh}
          showFeedback={showFeedback}
        />
      )}
    </div>
  );
}
