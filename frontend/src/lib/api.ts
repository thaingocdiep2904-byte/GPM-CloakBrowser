/**
 * API client for CloakBrowser Manager backend.
 */

export interface Profile {
  id: string;
  name: string;
  fingerprint_seed: number;
  proxy: string | null;
  timezone: string | null;
  locale: string | null;
  platform: string;
  user_agent: string | null;
  screen_width: number;
  screen_height: number;
  gpu_vendor: string | null;
  gpu_renderer: string | null;
  hardware_concurrency: number | null;
  humanize: boolean;
  human_preset: string;
  headless: boolean;
  geoip: boolean;
  clipboard_sync: boolean;
  auto_launch: boolean;
  color_scheme: string | null;
  launch_args: string[];
  notes: string | null;
  user_data_dir: string;
  created_at: string;
  updated_at: string;
  tags: { tag: string; color: string | null }[];
  status: "running" | "stopped";
  vnc_ws_port: number | null;
  cdp_url: string | null;
  last_run: string | null;
  storage_bytes: number;
  canvas_noise?: string;
  client_rect_noise?: string;
  webgl_noise?: string;
  audio_noise?: string;
  webgl_meta_masked?: boolean;
  media_devices_masked?: boolean;
  media_audio_inputs?: number;
  media_audio_outputs?: number;
  media_video_inputs?: number;
  device_memory?: number;
  mac_address?: string;
  browser_brand?: string | null;
}

export interface ProfileCreateData {
  name: string;
  fingerprint_seed?: number | null;
  proxy?: string | null;
  timezone?: string | null;
  locale?: string | null;
  platform?: string;
  user_agent?: string | null;
  screen_width?: number;
  screen_height?: number;
  gpu_vendor?: string | null;
  gpu_renderer?: string | null;
  hardware_concurrency?: number | null;
  humanize?: boolean;
  human_preset?: string;
  headless?: boolean;
  geoip?: boolean;
  clipboard_sync?: boolean;
  auto_launch?: boolean;
  color_scheme?: string | null;
  launch_args?: string[];
  notes?: string | null;
  tags?: { tag: string; color: string | null }[];
  canvas_noise?: string;
  client_rect_noise?: string;
  webgl_noise?: string;
  audio_noise?: string;
  webgl_meta_masked?: boolean;
  media_devices_masked?: boolean;
  media_audio_inputs?: number;
  media_audio_outputs?: number;
  media_video_inputs?: number;
  device_memory?: number;
  mac_address?: string;
  browser_brand?: string | null;
}

export interface LaunchResult {
  profile_id: string;
  status: string;
  vnc_ws_port: number | null;
  display: string | null;
  cdp_url: string | null;
}

export interface SystemStatus {
  running_count: number;
  binary_version: string;
  profiles_total: number;
  os_name: string;
}

export interface BulkActionResult {
  success: string[];
  failed: Record<string, string>;
}

export interface BulkCreateData {
  count: number;
  name_pattern: string;
  proxies?: string[];
  platform?: string;
  screen_width?: number;
  screen_height?: number;
  humanize?: boolean;
  headless?: boolean;
  geoip?: boolean;
  clipboard_sync?: boolean;
  auto_launch?: boolean;
  notes?: string | null;
  tags?: { tag: string; color: string | null }[];
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Global 401 callback — set by App to trigger login page on auth failure
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  _onUnauthorized = cb;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    if (res.status === 401 && _onUnauthorized) {
      _onUnauthorized();
      throw new ApiError(401, "Unauthorized");
    }
    let errorMsg = res.statusText;
    try {
      const body = await res.json();
      if (body.detail) {
        if (typeof body.detail === "string") {
          errorMsg = body.detail;
        } else {
          errorMsg = JSON.stringify(body.detail);
        }
      }
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errorMsg);
  }
  return res.json();
}

export const api = {
  authStatus: () =>
    request<{ auth_required: boolean; authenticated: boolean }>("/api/auth/status"),

  login: (token: string) =>
    request<{ ok: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  listProfiles: () => request<Profile[]>("/api/profiles"),

  getProfile: (id: string) => request<Profile>(`/api/profiles/${id}`),

  createProfile: (data: ProfileCreateData) =>
    request<Profile>("/api/profiles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProfile: (id: string, data: Partial<ProfileCreateData>) =>
    request<Profile>(`/api/profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteProfile: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}`, { method: "DELETE" }),

  launchProfile: (id: string) =>
    request<LaunchResult>(`/api/profiles/${id}/launch`, { method: "POST" }),

  stopProfile: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/stop`, { method: "POST" }),

  getStatus: () => request<SystemStatus>("/api/status"),

  setClipboard: (id: string, text: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/clipboard`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getClipboard: (id: string) =>
    request<{ text: string }>(`/api/profiles/${id}/clipboard`),

  cloneProfile: (id: string) =>
    request<Profile>(`/api/profiles/${id}/clone`, {
      method: "POST",
    }),

  bulkLaunchProfiles: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-launch", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkStopProfiles: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-stop", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkDeleteProfiles: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkCreateProfiles: (data: BulkCreateData) =>
    request<Profile[]>("/api/profiles/bulk-create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  bulkCheckProxy: (ids: string[]) =>
    request<BulkProxyCheckResult>("/api/profiles/bulk-check-proxy", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkSetStartupUrl: (ids: string[], startupUrl: string) =>
    request<BulkActionResult>("/api/profiles/bulk-startup-url", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids, startup_url: startupUrl }),
    }),

  bulkResetProxy: (ids: string[], proxies: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-reset-proxy", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids, proxies }),
    }),

  bulkSetGroup: (ids: string[], tags: { tag: string; color: string | null }[]) =>
    request<BulkActionResult>("/api/profiles/bulk-group", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids, tags }),
    }),

  bulkClearCache: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-clear-cache", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkSetBookmark: (ids: string[], bookmarks: { name: string; url: string }[]) =>
    request<BulkActionResult>("/api/profiles/bulk-bookmark", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids, bookmarks }),
    }),

  arrangeProfiles: (ids: string[], layoutType: "grid" | "cascade") =>
    request<{ success_count: number; failed_count: number }>("/api/profiles/arrange", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids, layout_type: layoutType }),
    }),

  openFolder: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/open-folder`, { method: "POST" }),

  importCookies: (id: string, cookies: any[]) =>
    request<{ ok: boolean; imported: number }>(`/api/profiles/${id}/import-cookies`, {
      method: "POST",
      body: JSON.stringify(cookies),
    }),

  exportCookies: (id: string) =>
    request<{ cookies: any[] }>(`/api/profiles/${id}/export-cookies`),

  getSettings: () => request<AppSettings>("/api/settings"),

  updateSettings: (settings: AppSettings) =>
    request<AppSettings>("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),

  selectFolder: () =>
    request<{ path: string | null }>("/api/settings/select-folder", {
      method: "POST",
    }),

  // Extension APIs
  getExtensions: () =>
    request<Extension[]>("/api/extensions"),

  uploadExtension: (file: File, isShared: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_shared", isShared ? "true" : "false");
    return request<Extension>("/api/extensions/upload", {
      method: "POST",
      body: formData,
    });
  },

  deleteExtension: (id: string) =>
    request<{ ok: boolean }>(`/api/extensions/${id}`, {
      method: "DELETE",
    }),

  getProfileExtensions: (profileId: string) =>
    request<ProfileExtension[]>(`/api/profiles/${profileId}/extensions`),

  updateProfileExtensions: (profileId: string, extensions: { id: string; is_enabled: boolean }[]) =>
    request<{ ok: boolean }>(`/api/profiles/${profileId}/extensions`, {
      method: "POST",
      body: JSON.stringify({ extensions }),
    }),

  toggleProfileExtension: (profileId: string, extId: string, isEnabled: boolean) =>
    request<{ ok: boolean }>(`/api/profiles/${profileId}/extensions/${extId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ is_enabled: isEnabled }),
    }),

  bulkUpdateExtensions: (profileIds: string[], extensionIds: string[], mode: "append" | "overwrite") =>
    request<{ ok: boolean }>("/api/profiles/bulk/extensions", {
      method: "POST",
      body: JSON.stringify({
        profile_ids: profileIds,
        extension_ids: extensionIds,
        mode: mode,
      }),
    }),

  getDeletedProfiles: () =>
    request<Profile[]>("/api/profiles/deleted"),

  restoreProfile: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/restore`, {
      method: "POST",
    }),

  forceDeleteProfile: (id: string) =>
    request<{ ok: boolean }>(`/api/profiles/${id}/force`, {
      method: "DELETE",
    }),

  bulkRestoreProfiles: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-restore", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),

  bulkForceDeleteProfiles: (ids: string[]) =>
    request<BulkActionResult>("/api/profiles/bulk-force-delete", {
      method: "POST",
      body: JSON.stringify({ profile_ids: ids }),
    }),
};

export interface Extension {
  id: string;
  name: string;
  version: string | null;
  path: string;
  is_shared: boolean;
  created_at: string;
}

export interface ProfileExtension {
  id: string;
  name: string;
  version: string | null;
  path: string;
  is_shared: boolean;
  is_enabled: boolean;
}


export interface AppSettings {
  profile_path?: string;
  license_key?: string;
  language?: "en" | "cn" | "vi";
  storage_type?: "local" | "s3";
  theme?: "dark" | "light";
  reopen_tabs?: boolean;
  auto_clear_cache?: boolean;
  auto_resize_window?: boolean;
  no_trash?: boolean;
  default_extensions?: string;
  shared_extensions?: string;
  auto_update_cloakbrowser?: boolean;
}

export interface ProxyCheckResult {
  status: "live" | "dead" | "no_proxy";
  ip: string;
  country?: string | null;
  error?: string | null;
}

export interface BulkProxyCheckResult {
  results: Record<string, ProxyCheckResult>;
}


