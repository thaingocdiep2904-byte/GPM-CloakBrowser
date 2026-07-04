import { Save, X, RefreshCw, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import type { Profile, ProfileCreateData } from "../lib/api";
import { useLanguage } from "../lib/i18n";

interface ProfileFormProps {
  profile: Profile | null; // null = create mode
  onSave: (data: ProfileCreateData) => Promise<void>;
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

export function ProfileForm({ profile, onSave }: ProfileFormProps) {
  const { lang, t } = useLanguage();
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
  });

  const [saving, setSaving] = useState(false);
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
      });
    } else {
      setStartupUrl("");
      const newSeed = Math.floor(Math.random() * 90000) + 10000;
      const cpuOptions = [4, 6, 8, 12, 16];
      const newCpu = cpuOptions[Math.floor(Math.random() * cpuOptions.length)];
      const ramOptions = [4, 8, 12, 16, 32];
      const newRam = ramOptions[Math.floor(Math.random() * ramOptions.length)];
      const gpuKeys = Object.keys(GPU_PRESETS);
      const randomGpuKey = gpuKeys[Math.floor(Math.random() * gpuKeys.length)] as string;
      const preset = randomGpuKey ? GPU_PRESETS[randomGpuKey] : undefined;

      setForm({
        name: "",
        platform: "windows",
        screen_width: 1920,
        screen_height: 1080,
        humanize: true,
        human_preset: "default",
        headless: false,
        geoip: true,
        auto_launch: false,
        launch_args: [],
        tags: [],
        canvas_noise: Math.random() > 0.5 ? "on" : "off",
        client_rect_noise: "off",
        webgl_noise: Math.random() > 0.5 ? "on" : "off",
        audio_noise: "on",
        webgl_meta_masked: true,
        media_devices_masked: true,
        media_audio_inputs: 2,
        media_audio_outputs: 1,
        media_video_inputs: 0,
        fingerprint_seed: newSeed,
        hardware_concurrency: newCpu,
        device_memory: newRam,
        gpu_vendor: preset?.vendor || "Google Inc. (NVIDIA)",
        gpu_renderer: preset?.renderer || "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)",
        mac_address: generateRandomMac(),
        browser_brand: "",
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
            {isEdit ? t("form.edit_title") : t("form.create_title")}
          </h2>
        </div>
        <div className="flex items-center gap-2 mr-8">
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded bg-accent hover:bg-accent/90 text-white transition-colors font-medium flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? t("form.saving") : t("form.save")}</span>
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-border/60 mb-5 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("quick")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${activeTab === "quick" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
        >
          {lang === "vi" ? "Thiết lập nhanh" : "Quick action"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("conn")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${activeTab === "conn" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
        >
          {lang === "vi" ? "Cấu hình mạng" : "Connection"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("soft")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${activeTab === "soft" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
        >
          {lang === "vi" ? "Phần mềm" : "Software"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hard")}
          className={`px-4 py-2 font-semibold uppercase tracking-wider border-b-2 text-[10px] transition-colors ${activeTab === "hard" ? "border-accent text-accent bg-surface-1/40" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
        >
          {lang === "vi" ? "Phần cứng" : "Hardware"}
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
                <label className="block text-gray-400 mb-1.5 font-medium">
                  {lang === "vi" ? "Tên Profile" : "Profile Name"}
                </label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={lang === "vi" ? "Ví dụ: Tài khoản Facebook 01" : "e.g., Facebook Account 01"}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">
                  {lang === "vi" ? "Startup URL (Trang chủ khởi động)" : "Startup URL"}
                </label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                  type="url"
                  value={startupUrl}
                  onChange={(e) => setStartupUrl(e.target.value)}
                  placeholder={lang === "vi" ? "Ví dụ: https://google.com (Để trống để mở trang Tab Mới)" : "e.g., https://google.com (Leave blank for New Tab)"}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">
                    {lang === "vi" ? "Hệ Điều Hành" : "OS Platform"}
                  </label>
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
                    <option value="">Chrome ({lang === "vi" ? "Mặc định" : "Default"})</option>
                    <option value="Edge">Microsoft Edge</option>
                    <option value="Opera">Opera</option>
                    <option value="Vivaldi">Vivaldi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">Browser Fingerprint (Seed)</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs no-spin"
                      type="number"
                      value={form.fingerprint_seed ?? ""}
                      onChange={(e) => set("fingerprint_seed", e.target.value ? Number(e.target.value) : null)}
                      placeholder={lang === "vi" ? "Tự động (ngẫu nhiên)" : "Auto (random)"}
                    />
                    <button
                      type="button"
                      onClick={randomizeSeed}
                      className="px-3 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border"
                      title={lang === "vi" ? "Tự động tạo ngẫu nhiên (Seed)" : "Auto-generate random seed"}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">
                  {lang === "vi" ? "Ghi Chú" : "Notes"}
                </label>
                <textarea
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs h-24 resize-none"
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  placeholder={lang === "vi" ? "Nhập ghi chú cá nhân cho profile này..." : "Enter personal notes for this profile..."}
                />
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTION */}
          {activeTab === "conn" && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1.5 font-medium">
                  {lang === "vi" ? "Cấu Hình Proxy" : "Proxy Configuration"}
                </label>
                <input
                  className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs font-mono"
                  value={form.proxy ?? ""}
                  onChange={(e) => set("proxy", e.target.value || null)}
                  placeholder="http://user:pass@host:port or socks5://host:port"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">
                    {lang === "vi" ? "Múi Giờ" : "Timezone"}
                  </label>
                  <input
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.timezone ?? ""}
                    onChange={(e) => set("timezone", e.target.value || null)}
                    placeholder={lang === "vi" ? "Ví dụ: Asia/Ho_Chi_Minh (Để trống để tự động)" : "e.g., Asia/Ho_Chi_Minh (Leave blank for auto)"}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">
                    {lang === "vi" ? "Ngôn Ngữ" : "Locale"}
                  </label>
                  <input
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.locale ?? ""}
                    onChange={(e) => set("locale", e.target.value || null)}
                    placeholder={lang === "vi" ? "Ví dụ: vi-VN,en-US (Để trống để tự động)" : "e.g., vi-VN,en-US (Leave blank for auto)"}
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
                <span className="text-xs">
                  {lang === "vi"
                    ? "Tự động cấu hình Timezone/Locale dựa trên IP của Proxy (GeoIP)"
                    : "Automatically configure Timezone/Locale based on Proxy IP (GeoIP)"}
                </span>
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
                  placeholder={lang === "vi" ? "Tự động Browser Fingerprint (Seed)" : "Auto Browser Fingerprint (Seed)"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1.5 font-medium">
                    {lang === "vi" ? "Chế độ giao diện (Color Scheme)" : "Color Scheme"}
                  </label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                    value={form.color_scheme ?? ""}
                    onChange={(e) => set("color_scheme", e.target.value || null as any)}
                  >
                    <option value="">{lang === "vi" ? "Mặc định hệ thống" : "System default"}</option>
                    <option value="light">{lang === "vi" ? "Sáng (Light)" : "Light"}</option>
                    <option value="dark">{lang === "vi" ? "Tối (Dark)" : "Dark"}</option>
                    <option value="no-preference">{lang === "vi" ? "Không ưu tiên" : "No preference"}</option>
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
                  <span>
                    {lang === "vi"
                      ? "Mô phỏng hành vi chuột, bàn phím và cuộn giống người thật (Anti-bot bypass)"
                      : "Emulate human-like mouse, keyboard and scroll behaviors (Anti-bot bypass)"}
                  </span>
                </label>
                {form.humanize && (
                  <div className="pl-6">
                    <label className="block text-gray-400 mb-1.5 font-medium">
                      {lang === "vi" ? "Chế độ mô phỏng" : "Emulation Preset"}
                    </label>
                    <select
                      className="input w-full max-w-xs bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                      value={form.human_preset}
                      onChange={(e) => set("human_preset", e.target.value as any)}
                    >
                      <option value="default">{lang === "vi" ? "Mặc định (Tốc độ bình thường)" : "Default (Normal speed)"}</option>
                      <option value="careful">{lang === "vi" ? "Cẩn thận (Tốc độ chậm, tự nhiên)" : "Careful (Slower, natural speed)"}</option>
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.auto_launch ?? false}
                    onChange={(e) => set("auto_launch", e.target.checked)}
                    className="rounded border-border bg-surface-2 h-4 w-4 text-accent focus:ring-0"
                  />
                  <span>
                    {lang === "vi" ? "Tự động khởi chạy profile khi Phần mềm được bật" : "Auto launch profile on application startup"}
                  </span>
                </label>
              </div>

              {/* Tags */}
              <div className="border-t border-border/60 pt-3">
                <label className="block text-gray-400 mb-2 font-medium">
                  {lang === "vi" ? "Nhãn Nhóm (Tags)" : "Tags / Groups"}
                </label>
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
                    placeholder={lang === "vi" ? "Tên nhóm mới..." : "New tag / group name..."}
                  />
                  <button type="button" onClick={addTag} className="px-3 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border">
                    {lang === "vi" ? "Thêm" : "Add"}
                  </button>
                </div>
              </div>

              {/* Launch Args */}
              <div className="border-t border-border/60 pt-3">
                <label className="block text-gray-400 mb-1.5 font-medium">
                  {lang === "vi" ? "Đối số khởi chạy (Chromium Launch Flags)" : "Chromium Launch Flags"}
                </label>
                <p className="text-[10px] text-gray-500 mb-2">
                  {lang === "vi" ? "Các flags Chromium tùy chỉnh (ví dụ: --disable-web-security, --incognito)" : "Custom Chromium flags (e.g., --disable-web-security, --incognito)"}
                </p>
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
                    placeholder={lang === "vi" ? "Ví dụ: --disable-notifications" : "e.g., --disable-notifications"}
                  />
                  <button type="button" onClick={addLaunchArg} className="px-3 py-1.5 rounded bg-surface-3 hover:bg-surface-4 text-gray-300 transition-colors border border-border">
                    {lang === "vi" ? "Thêm" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HARDWARE */}
          {activeTab === "hard" && (
            <div className="space-y-4">
              <span className="text-[10px] text-gray-400 block mb-2 leading-relaxed bg-surface-3/30 p-2.5 rounded border border-border/40">
                {lang === "vi"
                  ? "Phần mềm đã tạo ngẫu nhiên một thông tin phần cứng. Nếu không quá hiểu về Fingerprint, bạn có thể không quan tâm tới phần này. Các thông số về RAM, CPU Core, Audio, Media outputs, WebGL, Tên card màn hình... tự động tạo ngẫu nhiên."
                  : "The software has automatically generated random hardware information. If you don't fully understand Fingerprinting, you can leave these settings as default. RAM, CPU cores, Audio, Media devices, WebGL, GPU... are auto-randomized."}
              </span>

              {/* Phân giải màn hình */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1">
                  <label className="block text-gray-400 mb-1 font-medium">
                    {lang === "vi" ? "Phân giải màn hình" : "Screen Resolution"}
                  </label>
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
                    <option value="custom">{lang === "vi" ? "Tự cấu hình (Custom)" : "Custom Resolution"}</option>
                  </select>
                </div>
                {currentResolution === "custom" && (
                  <>
                    <div>
                      <label className="block text-gray-400 mb-1 font-medium">
                        {lang === "vi" ? "Chiều rộng (Width)" : "Width"}
                      </label>
                      <input
                        className="input w-full bg-surface-2 border border-border rounded px-3 py-2 text-white text-xs"
                        type="number"
                        value={form.screen_width ?? 1920}
                        onChange={(e) => set("screen_width", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 font-medium">
                        {lang === "vi" ? "Chiều cao (Height)" : "Height"}
                      </label>
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
                    <option value="off">Off ({lang === "vi" ? "Tắt" : "Off"})</option>
                    <option value="on">On ({lang === "vi" ? "Bật" : "On"})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Client rect noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.client_rect_noise ?? "off"}
                    onChange={(e) => set("client_rect_noise", e.target.value)}
                  >
                    <option value="off">Off ({lang === "vi" ? "Tắt" : "Off"})</option>
                    <option value="on">On ({lang === "vi" ? "Bật" : "On"})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">WebGL image noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.webgl_noise ?? "off"}
                    onChange={(e) => set("webgl_noise", e.target.value)}
                  >
                    <option value="off">Off ({lang === "vi" ? "Tắt" : "Off"})</option>
                    <option value="on">On ({lang === "vi" ? "Bật" : "On"})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">Audio noise</label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.audio_noise ?? "on"}
                    onChange={(e) => set("audio_noise", e.target.value)}
                  >
                    <option value="off">Off ({lang === "vi" ? "Tắt" : "Off"})</option>
                    <option value="on">On ({lang === "vi" ? "Bật" : "On"})</option>
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
                  <span>
                    {lang === "vi" ? "WebGL Meta masked (Ẩn danh thông số card màn hình)" : "WebGL Meta masked (Spoof graphic card details)"}
                  </span>
                </label>
                {form.webgl_meta_masked && (
                  <div className="grid grid-cols-1 gap-2.5 pl-6">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">
                        {lang === "vi" ? "Mẫu GPU Presets" : "GPU Presets"}
                      </label>
                      <select
                        className="input w-full bg-surface-2 border border-border rounded px-3 py-1.5 text-white text-xs"
                        value=""
                        onChange={(e) => { if (e.target.value) applyGpuPreset(e.target.value); }}
                      >
                        <option value="">-- {lang === "vi" ? "Thiết lập mặc định" : "Default preset"} --</option>
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
                          placeholder={lang === "vi" ? "Mặc định tự động tạo" : "Auto-generated by default"}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">GPU Renderer</label>
                        <input
                          className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                          value={form.gpu_renderer ?? ""}
                          onChange={(e) => set("gpu_renderer", e.target.value || null)}
                          placeholder={lang === "vi" ? "Mặc định tự động tạo" : "Auto-generated by default"}
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
                  <label className="block text-gray-400 mb-1 font-medium">
                    {lang === "vi" ? "Số nhân CPU" : "CPU Cores"}
                  </label>
                  <select
                    className="input w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-white text-xs"
                    value={form.hardware_concurrency ?? ""}
                    onChange={(e) => set("hardware_concurrency", e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">{lang === "vi" ? "Tự động" : "Auto"}</option>
                    <option value="2">2 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="4">4 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="6">6 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="8">8 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="12">12 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="16">16 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="20">20 {lang === "vi" ? "nhân" : "cores"}</option>
                    <option value="24">24 {lang === "vi" ? "nhân" : "cores"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-medium">
                    {lang === "vi" ? "Dung lượng RAM" : "RAM Memory"}
                  </label>
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
                      title={lang === "vi" ? "Tạo MAC ngẫu nhiên" : "Randomize MAC address"}
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
                  <span>{lang === "vi" ? "Tạo thông số mới" : "Randomize all hardware"}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column (Fingerprint Summary Panel) */}
        <div className="bg-surface-2/40 border border-border/80 rounded-lg p-5 flex flex-col space-y-3.5 text-xs text-gray-300 shadow-xl h-fit sticky top-0">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-1.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                {lang === "vi" ? "Thông số vân tay" : "Fingerprint Summary"}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleRandomizeAll}
              className="p-1 rounded bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/25 text-indigo-400 hover:text-white transition-colors"
              title={lang === "vi" ? "Tạo ngẫu nhiên nhanh toàn bộ thông số phần cứng/phần mềm" : "Quick randomize all configuration"}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
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
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Hệ điều hành" : "OS Platform"}
                </span>
                <span className="text-white font-medium capitalize">{form.platform}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Browser Fingerprint (Seed)</span>
                <span className="text-white font-mono">
                  {form.fingerprint_seed ?? (lang === "vi" ? "Ngẫu nhiên" : "Random")}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-border/30 flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500 font-medium">
                {lang === "vi" ? "Đường dẫn Proxy" : "Proxy connection"}
              </span>
              <span className="text-white font-mono break-all">
                {form.proxy || (lang === "vi" ? "Không dùng Proxy (Kết nối trực tiếp)" : "No Proxy (Direct Connection)")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Màn hình (Screen)" : "Resolution"}
                </span>
                <span className="text-white font-mono">{form.screen_width} × {form.screen_height}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Dung lượng RAM" : "RAM Memory"}
                </span>
                <span className="text-white font-medium">{form.device_memory} GB</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Múi giờ (Timezone)" : "Timezone"}
                </span>
                <span className="text-white font-mono break-all">
                  {form.geoip ? (lang === "vi" ? "Tự động (GeoIP)" : "Auto (GeoIP)") : form.timezone || (lang === "vi" ? "Tự động" : "Auto")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Ngôn ngữ (Locale)" : "Locale"}
                </span>
                <span className="text-white font-mono break-all">
                  {form.geoip ? (lang === "vi" ? "Tự động (GeoIP)" : "Auto (GeoIP)") : form.locale || (lang === "vi" ? "Tự động" : "Auto")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">
                  {lang === "vi" ? "Số nhân CPU" : "CPU Cores"}
                </span>
                <span className="text-white font-mono">
                  {form.hardware_concurrency ?? (lang === "vi" ? "Tự động" : "Auto")} cores
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">MAC Address</span>
                <span className="text-white font-mono break-all">
                  {form.mac_address || (lang === "vi" ? "Tự động" : "Auto")}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-border/30">
              <div>
                <span className="text-[10px] text-gray-500 font-medium block">Browser Brand</span>
                <span className="text-white font-medium">{form.browser_brand || "Chrome"}</span>
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
