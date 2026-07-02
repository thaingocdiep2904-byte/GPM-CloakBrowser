import { Save, Trash2, X, RefreshCw, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import type { Profile, ProfileCreateData } from "../lib/api";

interface ProfileFormProps {
  profile: Profile | null; // null = create mode
  onSave: (data: ProfileCreateData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

const RESOLUTION_PRESETS: Record<string, { width: number; height: number }> = {
  "1920 × 1080 (Full HD)": { width: 1920, height: 1080 },
  "2560 × 1440 (QHD)": { width: 2560, height: 1440 },
  "1366 × 768 (HD)": { width: 1366, height: 768 },
  "1440 × 900": { width: 1440, height: 900 },
  "1536 × 864": { width: 1536, height: 864 },
  "1280 × 720 (720p)": { width: 1280, height: 720 },
};

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

const GPU_PRESETS: Record<string, { vendor: string; renderer: string }> = {
  "NVIDIA GeForce RTX 4090": {
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "NVIDIA GeForce RTX 4070": {
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "NVIDIA GeForce RTX 3070": {
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "NVIDIA GeForce RTX 3060": {
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "NVIDIA GeForce GTX 1660 Super": {
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER (0x000021C4) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "AMD Radeon RX 7900 XTX": {
    vendor: "Google Inc. (AMD)",
    renderer: "ANGLE (AMD, AMD Radeon RX 7900 XTX (0x0000744C) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "AMD Radeon RX 6800 XT": {
    vendor: "Google Inc. (AMD)",
    renderer: "ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "AMD Radeon RX 580": {
    vendor: "Google Inc. (AMD)",
    renderer: "ANGLE (AMD, AMD Radeon RX 580 (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "Intel Arc A770": {
    vendor: "Google Inc. (Intel)",
    renderer: "ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "Intel UHD Graphics 770": {
    vendor: "Google Inc. (Intel)",
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 770 (0x00004680) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "Intel UHD Graphics 630": {
    vendor: "Google Inc. (Intel)",
    renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00009BC8) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  "Apple M3 Pro (macOS)": {
    vendor: "Google Inc. (Apple)",
    renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)",
  },
  "Apple M2 (macOS)": {
    vendor: "Google Inc. (Apple)",
    renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
  },
};

const generateRandomMac = () => {
  const hex = "0123456789ABCDEF";
  let mac = "";
  for (let i = 0; i < 6; i++) {
    mac += hex[Math.floor(Math.random() * 16)];
    mac += hex[Math.floor(Math.random() * 16)];
    if (i < 5) mac += "-";
  }
  return mac;
};

export function ProfileForm({ profile, onSave, onDelete, onCancel }: ProfileFormProps) {
  const isEdit = profile !== null;

  const [activeTab, setActiveTab] = useState<"quick" | "conn" | "soft" | "hard">("quick");

  const [form, setForm] = useState<ProfileCreateData>({
    name: "",
    platform: "windows",
    screen_width: 1920,
    screen_height: 1080,
    humanize: true,
    human_preset: "default",
    headless: false,
    geoip: true,
    clipboard_sync: true,
    auto_launch: false,
    launch_args: [],
    tags: [],
    canvas_noise: "off",
    client_rect_noise: "off",
    webgl_noise: "off",
    audio_noise: "on",
    webgl_meta_masked: true,
    media_devices_masked: true,
    media_audio_inputs: 2,
    media_audio_outputs: 1,
    media_video_inputs: 0,
    device_memory: 4,
    mac_address: "",
    browser_brand: "",
    storage_quota: null,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState<string | null>("#6366f1");
  const [launchArgInput, setLaunchArgInput] = useState("");
  const [startupUrl, setStartupUrl] = useState("");

  useEffect(() => {
    if (profile) {
      const args = profile.launch_args ?? [];
      const foundUrl = args.find((a) => a.startsWith("http://") || a.startsWith("https://")) || "";
      setStartupUrl(foundUrl);
      const cleanArgs = args.filter((a) => !(a.startsWith("http://") || a.startsWith("https://")));

      setForm({
        name: profile.name,
        fingerprint_seed: profile.fingerprint_seed,
        proxy: profile.proxy,
        timezone: profile.timezone,
        locale: profile.locale,
        platform: profile.platform as any,
        user_agent: profile.user_agent,
        screen_width: profile.screen_width,
        screen_height: profile.screen_height,
        gpu_vendor: profile.gpu_vendor,
        gpu_renderer: profile.gpu_renderer,
        hardware_concurrency: profile.hardware_concurrency,
        humanize: profile.humanize,
        human_preset: profile.human_preset as any,
        headless: profile.headless,
        geoip: profile.geoip,
        clipboard_sync: profile.clipboard_sync,
        auto_launch: profile.auto_launch,
        color_scheme: profile.color_scheme as any,
        launch_args: cleanArgs,
        notes: profile.notes,
        tags: profile.tags ?? [],
        canvas_noise: profile.canvas_noise ?? "off",
        client_rect_noise: profile.client_rect_noise ?? "off",
        webgl_noise: profile.webgl_noise ?? "off",
        audio_noise: profile.audio_noise ?? "on",
        webgl_meta_masked: profile.webgl_meta_masked !== undefined ? profile.webgl_meta_masked : true,
        media_devices_masked: profile.media_devices_masked !== undefined ? profile.media_devices_masked : true,
        media_audio_inputs: profile.media_audio_inputs ?? 2,
        media_audio_outputs: profile.media_audio_outputs ?? 1,
        media_video_inputs: profile.media_video_inputs ?? 0,
        device_memory: profile.device_memory ?? 4,
        mac_address: profile.mac_address ?? generateRandomMac(),
        browser_brand: profile.browser_brand ?? "",
        storage_quota: profile.storage_quota ?? null,
      });
    } else {
      setStartupUrl("");
      setForm({
        name: "",
        platform: "windows",
        screen_width: 1920,
        screen_height: 1080,
        humanize: true,
        human_preset: "default",
        headless: false,
        geoip: true,
        clipboard_sync: true,
        auto_launch: false,
        launch_args: [],
        tags: [],
        canvas_noise: "off",
        client_rect_noise: "off",
        webgl_noise: "off",
        audio_noise: "on",
        webgl_meta_masked: true,
        media_devices_masked: true,
        media_audio_inputs: 2,
        media_audio_outputs: 1,
        media_video_inputs: 0,
        device_memory: 4,
        mac_address: generateRandomMac(),
        browser_brand: "",
        storage_quota: null,
      });
    }
  }, [profile?.id]);

  const set = <K extends keyof ProfileCreateData>(key: K, value: ProfileCreateData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const finalArgs = [...(form.launch_args ?? [])];
      if (startupUrl.trim()) {
        finalArgs.push(startupUrl.trim());
      }
      const payload = { ...form, launch_args: finalArgs };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Xóa profile này? Toàn bộ dữ liệu trình duyệt trên ổ đĩa sẽ bị xóa vĩnh viễn.")) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const applyGpuPreset = (name: string) => {
    const preset = GPU_PRESETS[name];
    if (preset) {
      set("gpu_vendor", preset.vendor);
      set("gpu_renderer", preset.renderer);
    }
  };

  const randomizeSeed = () => {
    set("fingerprint_seed", Math.floor(Math.random() * 90000) + 10000);
  };

  const handleRandomizeAll = () => {
    const newSeed = Math.floor(Math.random() * 90000) + 10000;
    
    const cpuOptions = [4, 6, 8, 12, 16, 20];
    const newCpu = cpuOptions[Math.floor(Math.random() * cpuOptions.length)];
    
    const ramOptions = [4, 8, 12, 16, 32];
    const newRam = ramOptions[Math.floor(Math.random() * ramOptions.length)];
    
    const newMac = generateRandomMac();
    
    const gpuKeys = Object.keys(GPU_PRESETS);
    const randomGpuKey = gpuKeys[Math.floor(Math.random() * gpuKeys.length)] as string;
    const preset = randomGpuKey ? GPU_PRESETS[randomGpuKey] : undefined;
    
    setForm((prev) => ({
      ...prev,
      fingerprint_seed: newSeed,
      hardware_concurrency: newCpu,
      device_memory: newRam,
      mac_address: newMac,
      gpu_vendor: preset?.vendor || prev.gpu_vendor || "Google Inc. (NVIDIA)",
      gpu_renderer: preset?.renderer || prev.gpu_renderer || "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      canvas_noise: Math.random() > 0.5 ? "on" : "off",
      audio_noise: Math.random() > 0.5 ? "on" : "off",
      webgl_noise: Math.random() > 0.5 ? "on" : "off",
    }));
  };

  const currentResolution = Object.entries(RESOLUTION_PRESETS).find(
    ([, v]) => v.width === form.screen_width && v.height === form.screen_height,
  )?.[0] ?? "custom";

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (form.tags?.some((t) => t.tag === tag)) return;
    set("tags", [...(form.tags ?? []), { tag, color: tagColor }]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    set("tags", (form.tags ?? []).filter((t) => t.tag !== tag));
  };

  const addLaunchArg = () => {
    const arg = launchArgInput.trim();
    if (!arg) return;
    if ((form.launch_args ?? []).includes(arg)) return;
    set("launch_args", [...(form.launch_args ?? []), arg]);
    setLaunchArgInput("");
  };

  const removeLaunchArg = (idx: number) => {
    set("launch_args", (form.launch_args ?? []).filter((_, i) => i !== idx));
  };

  return (
    <form onSubmit={handleSubmit} className="px-8 py-6 w-full max-w-6xl mx-auto flex flex-col text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 border-b border-border/80 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white uppercase tracking-wide">
            {isEdit ? "Cấu Hình Profile" : "Tạo Profile Mới"}
          </h2>
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger flex items-center gap-1.5 px-3 py-1 rounded text-[11px]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deleting ? "Đang xóa..." : "Xóa Profile"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mr-8">
          <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors font-medium">
            Hủy bỏ
          </button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white transition-colors font-medium flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? "Đang lưu..." : isEdit ? "Lưu lại" : "Tạo Profile"}</span>
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-border/60 mb-5 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("quick")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${
            activeTab === "quick" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Quick action
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("conn")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${
            activeTab === "conn" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Connection
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("soft")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${
            activeTab === "soft" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Software
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hard")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${
            activeTab === "hard" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Hardware
        </button>
      </div>

      {/* Main Grid Layout — flex-1 để chiếm hết chiều cao còn lại */}
      <div className="flex-1 grid gap-6 pb-6" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
        {/* Left Column (Active Tab Content) */}
        <div className="space-y-5 bg-surface-1/40 p-5 rounded-lg border border-border/40">
          
          {/* TAB 1: QUICK ACTION */}
          {activeTab === "quick" && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Tên Profile</label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ví dụ: Tài khoản Facebook 01"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Startup URL (Trang chủ khởi động)</label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                  type="url"
                  value={startupUrl}
                  onChange={(e) => setStartupUrl(e.target.value)}
                  placeholder="Ví dụ: https://google.com (Để trống để mở trang Tab Mới)"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Hệ Điều Hành (Platform)</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.platform}
                    onChange={(e) => set("platform", e.target.value as any)}
                  >
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                    <option value="linux">Linux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Browser Brand</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={(form as any).browser_brand ?? ""}
                    onChange={(e) => set("browser_brand" as any, e.target.value || null)}
                  >
                    <option value="">Chrome (Mặc định)</option>
                    <option value="Edge">Microsoft Edge</option>
                    <option value="Opera">Opera</option>
                    <option value="Vivaldi">Vivaldi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Hạt Giống Vân Tay (Seed)</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs no-spin"
                      type="number"
                      value={form.fingerprint_seed ?? ""}
                      onChange={(e) => set("fingerprint_seed", e.target.value ? Number(e.target.value) : null)}
                      placeholder="Tự động (ngẫu nhiên)"
                    />
                    <button
                      type="button"
                      onClick={randomizeSeed}
                      className="px-3 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border"
                      title="Sinh seed ngẫu nhiên"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Ghi Chú</label>
                <textarea
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs h-24 resize-none"
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  placeholder="Nhập ghi chú cá nhân cho profile này..."
                />
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTION */}
          {activeTab === "conn" && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">Cấu Hình Proxy</label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs font-mono"
                  value={form.proxy ?? ""}
                  onChange={(e) => set("proxy", e.target.value || null)}
                  placeholder="http://user:pass@host:port hoặc socks5://host:port"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Múi Giờ (Timezone)</label>
                  <input
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.timezone ?? ""}
                    onChange={(e) => set("timezone", e.target.value || null)}
                    placeholder="Ví dụ: Asia/Ho_Chi_Minh (Để trống để tự sinh)"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Ngôn Ngữ (Locale)</label>
                  <input
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.locale ?? ""}
                    onChange={(e) => set("locale", e.target.value || null)}
                    placeholder="Ví dụ: vi-VN,en-US (Để trống để tự sinh)"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={form.geoip ?? false}
                  onChange={(e) => set("geoip", e.target.checked)}
                  className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs">Tự động cấu hình Timezone/Locale dựa trên IP của Proxy (GeoIP)</span>
              </label>
            </div>
          )}

          {/* TAB 3: SOFTWARE */}
          {activeTab === "soft" && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">User Agent</label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs font-mono"
                  value={form.user_agent ?? ""}
                  onChange={(e) => set("user_agent", e.target.value || null)}
                  placeholder="Tự động sinh từ hạt giống (seed)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Color Scheme (Chế độ giao diện)</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.color_scheme ?? ""}
                    onChange={(e) => set("color_scheme", e.target.value || null as any)}
                  >
                    <option value="">Mặc định hệ thống</option>
                    <option value="light">Sáng (Light)</option>
                    <option value="dark">Tối (Dark)</option>
                    <option value="no-preference">Không ưu tiên</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.humanize ?? false}
                    onChange={(e) => set("humanize", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>Mô phỏng hành vi chuột, bàn phím và cuộn giống người thật (Anti-bot bypass)</span>
                </label>
                {form.humanize && (
                  <div className="pl-6">
                    <label className="block text-gray-400 mb-1.5 font-medium">Chế độ mô phỏng</label>
                    <select
                      className="input w-full max-w-xs bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                      value={form.human_preset}
                      onChange={(e) => set("human_preset", e.target.value as any)}
                    >
                      <option value="default">Mặc định (Tốc độ bình thường)</option>
                      <option value="careful">Cẩn thận (Tốc độ chậm, tự nhiên)</option>
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.clipboard_sync ?? true}
                    onChange={(e) => set("clipboard_sync", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>Đồng bộ khay nhớ tạm (Clipboard sync) mặc định trong cửa sổ VNC</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.auto_launch ?? false}
                    onChange={(e) => set("auto_launch", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>Tự động khởi chạy profile khi Container/App được bật</span>
                </label>
              </div>

              {/* Tags */}
              <div className="border-t border-border/60 pt-3">
                <label className="block text-gray-400 mb-2 font-medium">Nhãn Nhóm (Tags)</label>
                {(form.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(form.tags ?? []).map((t) => (
                      <span
                        key={t.tag}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface-3 text-gray-300 font-medium"
                        style={t.color ? { backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40`, borderWidth: "1px" } : undefined}
                      >
                        {t.tag}
                        <button type="button" onClick={() => removeTag(t.tag)} className="hover:opacity-75">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <div className="flex gap-1">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTagColor(c)}
                        className="w-4 h-4 rounded-full border-2 transition-transform"
                        style={{
                          backgroundColor: c,
                          borderColor: tagColor === c ? "#fff" : "transparent",
                          transform: tagColor === c ? "scale(1.2)" : undefined,
                        }}
                      />
                    ))}
                  </div>
                  <input
                    className="input flex-1 bg-surface-2 border border-border rounded px-3 py-1.5 text-white text-xs"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Tên nhóm mới..."
                  />
                  <button type="button" onClick={addTag} className="px-3 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border">
                    Thêm
                  </button>
                </div>
              </div>

              {/* Launch Args */}
              <div className="border-t border-border/60 pt-3">
                <label className="block text-gray-400 mb-1.5 font-medium">Đối số khởi chạy (Chromium Launch Flags)</label>
                <p className="text-[10px] text-gray-500 mb-2">Các flags Chromium tùy chỉnh (ví dụ: --disable-web-security, --incognito)</p>
                {(form.launch_args ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(form.launch_args ?? []).map((arg, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-surface-3 text-gray-300 font-mono"
                      >
                        {arg}
                        <button type="button" onClick={() => removeLaunchArg(idx)} className="hover:opacity-70">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="input flex-1 bg-surface-2 border border-border rounded px-3 py-1.5 text-white text-xs font-mono"
                    value={launchArgInput}
                    onChange={(e) => setLaunchArgInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLaunchArg(); } }}
                    placeholder="Ví dụ: --disable-notifications"
                  />
                  <button type="button" onClick={addLaunchArg} className="px-3 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border">
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HARDWARE */}
          {activeTab === "hard" && (
            <div className="space-y-4">
              <span className="text-[10px] text-gray-400 block mb-2 leading-relaxed bg-surface-3/30 p-2.5 rounded border border-border/40">
                Phần mềm đã tạo ngẫu nhiên một thông tin phần cứng. Nếu không quá hiểu về Fingerprint, bạn có thể không quan tâm tới phần này. Các thông số về RAM, CPU Core, Audio, Media outputs, WebGL, Tên card màn hình... đã được sinh ngẫu nhiên!
              </span>

              {/* Phân giải màn hình */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1">
                  <label className="block text-gray-400 mb-1 font-medium">Phân giải màn hình</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={currentResolution}
                    onChange={(e) => {
                      const preset = RESOLUTION_PRESETS[e.target.value];
                      if (preset) {
                        set("screen_width", preset.width);
                        set("screen_height", preset.height);
                      } else {
                        // Custom
                        set("screen_width", 1920);
                        set("screen_height", 1080);
                      }
                    }}
                  >
                    {Object.keys(RESOLUTION_PRESETS).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="custom">Tự cấu hình (Custom)</option>
                  </select>
                </div>
                {currentResolution === "custom" && (
                  <>
                    <div>
                      <label className="block text-gray-400 mb-1 font-medium">Chiều rộng (Width)</label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                        type="number"
                        value={form.screen_width ?? 1920}
                        onChange={(e) => set("screen_width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 font-medium">Chiều cao (Height)</label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                        type="number"
                        value={form.screen_height ?? 1080}
                        onChange={(e) => set("screen_height", Number(e.target.value))}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Canvas, Client rect, WebGL, Audio noise */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Canvas noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.canvas_noise ?? "off"}
                    onChange={(e) => set("canvas_noise", e.target.value)}
                  >
                    <option value="off">Off (Tắt)</option>
                    <option value="on">On (Bật)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Client rect noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.client_rect_noise ?? "off"}
                    onChange={(e) => set("client_rect_noise", e.target.value)}
                  >
                    <option value="off">Off (Tắt)</option>
                    <option value="on">On (Bật)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">WebGL image noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.webgl_noise ?? "off"}
                    onChange={(e) => set("webgl_noise", e.target.value)}
                  >
                    <option value="off">Off (Tắt)</option>
                    <option value="on">On (Bật)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Audio noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.audio_noise ?? "on"}
                    onChange={(e) => set("audio_noise", e.target.value)}
                  >
                    <option value="off">Off (Tắt)</option>
                    <option value="on">On (Bật)</option>
                  </select>
                </div>
              </div>

              {/* WebGL Meta masked */}
              <div className="space-y-2 border-t border-border/40 pt-3">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={form.webgl_meta_masked ?? true}
                    onChange={(e) => set("webgl_meta_masked", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>WebGL Meta masked (Ẩn danh thông số card màn hình)</span>
                </label>
                {form.webgl_meta_masked && (
                  <div className="grid grid-cols-1 gap-2.5 pl-6">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Mẫu GPU Presets</label>
                      <select
                        className="input w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-white text-xs"
                        value=""
                        onChange={(e) => { if (e.target.value) applyGpuPreset(e.target.value); }}
                      >
                        <option value="">-- Chọn card mẫu để sinh nhanh --</option>
                        {Object.keys(GPU_PRESETS).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">GPU Vendor</label>
                        <input
                          className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                          value={form.gpu_vendor ?? ""}
                          onChange={(e) => set("gpu_vendor", e.target.value || null)}
                          placeholder="Mặc định sinh từ seed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">GPU Renderer</label>
                        <input
                          className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                          value={form.gpu_renderer ?? ""}
                          onChange={(e) => set("gpu_renderer", e.target.value || null)}
                          placeholder="Mặc định sinh từ seed"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Media devices masked */}
              <div className="space-y-2 border-t border-border/40 pt-3">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={form.media_devices_masked ?? true}
                    onChange={(e) => set("media_devices_masked", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>Media devices masked (Audio inputs / Audio outputs / Video inputs)</span>
                </label>
                {form.media_devices_masked && (
                  <div className="grid grid-cols-3 gap-3 pl-6">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Audio Inputs (Microphone)</label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                        type="number"
                        min={0}
                        value={form.media_audio_inputs ?? 2}
                        onChange={(e) => set("media_audio_inputs", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Audio Outputs (Speaker)</label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                        type="number"
                        min={0}
                        value={form.media_audio_outputs ?? 1}
                        onChange={(e) => set("media_audio_outputs", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Video Inputs (Camera)</label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                        type="number"
                        min={0}
                        value={form.media_video_inputs ?? 0}
                        onChange={(e) => set("media_video_inputs", Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CPU core, RAM, Storage Quota, MAC address */}
              <div className="grid grid-cols-4 gap-3 border-t border-border/40 pt-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Số nhân CPU</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.hardware_concurrency ?? ""}
                    onChange={(e) => set("hardware_concurrency", e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Tự động</option>
                    <option value="2">2 nhân</option>
                    <option value="4">4 nhân</option>
                    <option value="6">6 nhân</option>
                    <option value="8">8 nhân</option>
                    <option value="12">12 nhân</option>
                    <option value="16">16 nhân</option>
                    <option value="20">20 nhân</option>
                    <option value="24">24 nhân</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">RAM giả lập</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.device_memory ?? 4}
                    onChange={(e) => set("device_memory", Number(e.target.value))}
                  >
                    <option value="2">2 GB</option>
                    <option value="4">4 GB</option>
                    <option value="8">8 GB</option>
                    <option value="12">12 GB</option>
                    <option value="16">16 GB</option>
                    <option value="24">24 GB</option>
                    <option value="32">32 GB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Storage Quota (MB)</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={(form as any).storage_quota ?? ""}
                    onChange={(e) => set("storage_quota" as any, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Mặc định (Auto)</option>
                    <option value="1000">1,000 MB (~1 GB)</option>
                    <option value="5000">5,000 MB (~5 GB) — Bypass Incognito</option>
                    <option value="10000">10,000 MB (~10 GB)</option>
                    <option value="50000">50,000 MB (~50 GB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">MAC Address</label>
                  <div className="flex gap-1.5">
                    <input
                      className="input flex-1 bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                      value={form.mac_address ?? ""}
                      onChange={(e) => set("mac_address", e.target.value)}
                      placeholder="BE-A3-D2-69-4C-49"
                    />
                    <button
                      type="button"
                      onClick={() => set("mac_address", generateRandomMac())}
                      className="px-2 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border"
                      title="Sinh MAC ngẫu nhiên"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Button Tạo thông số mới */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRandomizeAll}
                  className="flex items-center gap-1 px-4 py-2 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-colors border border-indigo-500/30 font-medium text-[11px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Tạo thông số mới</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column (Fingerprint Summary Panel) */}
        <div className="bg-surface-2/40 border border-border/80 rounded-lg p-5 flex flex-col space-y-3.5 text-xs text-gray-300 shadow-xl h-fit sticky top-0">
          <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 mb-1.5">
            <Layers className="h-4 w-4 text-accent" />
            <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Thông số vân tay</h3>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500 font-medium">User-agent</span>
              <span className="text-[11px] text-white font-mono break-all leading-normal bg-surface-2/60 p-2 rounded border border-border/30">
                {form.user_agent || `Mozilla/5.0 (${form.platform === 'macos' ? 'Macintosh; Intel Mac OS X 10_15_7' : form.platform === 'linux' ? 'X11; Linux x86_64' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Hệ điều hành</span>
                <span className="text-white font-medium capitalize">{form.platform}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Hạt giống (Seed)</span>
                <span className="text-white font-mono">{form.fingerprint_seed ?? "Ngẫu nhiên"}</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-border/30 flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500 font-medium">Đường dẫn Proxy</span>
              <span className="text-white font-mono break-all">{form.proxy || "Không dùng Proxy (Kết nối trực tiếp)"}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Màn hình (Screen)</span>
                <span className="text-white font-mono">{form.screen_width} × {form.screen_height}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">RAM giả lập</span>
                <span className="text-white font-medium">{form.device_memory} GB</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Múi giờ (Timezone)</span>
                <span className="text-white font-mono break-all">{form.geoip ? "Tự động (GeoIP)" : form.timezone || "Tự động"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Ngôn ngữ (Locale)</span>
                <span className="text-white font-mono break-all">{form.geoip ? "Tự động (GeoIP)" : form.locale || "Tự động"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Số nhân CPU</span>
                <span className="text-white font-mono">{form.hardware_concurrency ?? "Tự động"} cores</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">MAC Address</span>
                <span className="text-white font-mono break-all">{form.mac_address || "Tự động"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Browser Brand</span>
                <span className="text-white font-medium">{(form as any).browser_brand || "Chrome"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Storage Quota</span>
                <span className="text-white font-mono">{(form as any).storage_quota ? `${(form as any).storage_quota} MB` : "Tự động"}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/30 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500 font-medium">Canvas Noise</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${form.canvas_noise === 'on' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-surface-3 text-gray-400'}`}>
                  {form.canvas_noise === 'on' ? 'NOISE' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500 font-medium">Client Rect Noise</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${form.client_rect_noise === 'on' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-surface-3 text-gray-400'}`}>
                  {form.client_rect_noise === 'on' ? 'NOISE' : 'OFF'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500 font-medium">WebGL Meta</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${form.webgl_meta_masked ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-surface-3 text-gray-400'}`}>
                  {form.webgl_meta_masked ? 'MASKED' : 'REAL'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500 font-medium">Audio Context</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${form.audio_noise === 'on' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-surface-3 text-gray-400'}`}>
                  {form.audio_noise === 'on' ? 'NOISE' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
