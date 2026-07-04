import { useState, useEffect } from "react";

export type Language = "vi" | "en";

// Initial language loaded from localStorage or default to 'vi'
let currentLang: Language = (localStorage.getItem("app_lang") as Language) || "vi";

// Global listeners for reactive re-render when language changes
const listeners = new Set<() => void>();

export const translations = {
  vi: {
    // App.tsx / Menu
    menu: {
      profiles: "Quản lý Profile",
      settings: "Cài đặt hệ thống",
      api: "API",
      about: "Giới thiệu",
      logout: "Đăng xuất",
      version: "Phiên bản binary",
      edit: "Chỉnh sửa",
      delete: "Xóa",
      edit_extension: "Sửa Extension",
      clone: "Nhân bản",
      import_cookie: "Import cookie",
      export_cookie: "Export cookie",
      copy_id: "Copy ID",
      copy_path: "Copy Path",
      open_location: "Open profile location"
    },
    // ProfileTable.tsx
    table: {
      search_placeholder: "Tìm kiếm profile (tên, proxy, ghi chú)...",
      selected_count: "Đã chọn {count} profiles",
      open: "Mở",
      close: "Đóng",
      arrange: "Sắp xếp",
      arrange_grid: "Dạng lưới (Grid)",
      arrange_cascade: "Xếp tầng (Cascade)",
      delete: "Xóa",
      copy_id: "Copy ID",
      copy_name: "Copy tên",
      copy_proxy: "Copy Proxy",
      copy_ua: "Copy UA",
      bulk_proxy: "Kiểm tra proxy",
      bulk_reset_proxy: "Cài đặt Proxy",
      bulk_startup: "Đặt URL khởi động",
      bulk_bookmark: "Đặt Bookmarks",
      bulk_group: "Gom nhóm",
      bulk_cache: "Xóa Cache",
      bulk_extension: "Sửa Extension",
      bulk_export: "Export profiles",
      bulk_export_cookies: "Export cookies",
      bulk_import: "Import",
      col_name: "Tên Profile",
      col_group: "Nhóm",
      col_os: "OS",
      col_storage: "Storage",
      col_status: "Trạng thái",
      col_proxy: "Proxy IP",
      col_last_run: "Lần chạy cuối",
      col_notes: "Ghi chú",
      col_action: "Thao tác",
      status_running: "Đang chạy",
      status_stopped: "Đã dừng",
      status_ready: "Sẵn sàng",
      no_profiles: "Không tìm thấy profile nào phù hợp.",
      confirm_delete_title: "Xóa Profile",
      confirm_delete_desc: "Bạn có chắc chắn muốn xóa {count} profile đã chọn không?",
      confirm_delete_warning: "Các profile này sẽ được chuyển vào thùng rác.",

      btn_new: "Thêm mới",
      btn_bulk_new: "Tạo theo số lượng",
      btn_trash: "Thùng rác",
      filter_group_all: "Nhóm: Tất cả",
      filter_group: "Nhóm: {group}",
      sort_newest: "Sắp xếp: Mới nhất",
      sort_oldest: "Sắp xếp: Cũ nhất",
      sort_name_asc: "Tên: A-Z",
      sort_name_desc: "Tên: Z-A",
      ctrl_a_tip: "Mẹo: Nhấn Ctrl + A để chọn toàn bộ",
      total_count: "Tổng số: {count} profiles",
      proxy_checking: "Đang kiểm tra IP máy...",
      proxy_error: "Lỗi",
      proxy_conn_error: "Lỗi kết nối",
      not_run_yet: "Chưa chạy",
      trash_confirm_title_trash: "Chuyển vào Thùng rác",
      trash_confirm_title_perm: "Xác nhận xóa vĩnh viễn",
      close_btn: "Đóng"
    },
    // ProfileForm.tsx
    form: {
      create_title: "Tạo mới Browser Profile",
      edit_title: "Chỉnh sửa Browser Profile",
      save: "Lưu cấu hình",
      saving: "Đang lưu...",
      cancel: "Hủy bỏ",
      tab_basic: "Cấu hình cơ bản",
      tab_proxy: "Cấu hình Proxy",
      tab_software: "Cài đặt phần mềm",
      tab_fingerprint: "Dấu vân tay (Fingerprint)",
      tab_webgl: "WebGL & Media",
      tab_notes: "Ghi chú & Tag",
      field_name: "Tên Profile",
      field_platform: "Hệ điều hành",
      field_ua: "User-Agent (Trình duyệt)",
      field_screen: "Độ phân giải màn hình",
      field_proxy_type: "Loại Proxy",
      field_proxy_host: "Host / IP",
      field_proxy_port: "Port",
      field_proxy_user: "User",
      field_proxy_pass: "Password",
      field_proxy_check: "Kiểm tra Proxy",
      field_timezone: "Múi giờ (Timezone)",
      field_locale: "Ngôn ngữ (Locale)",
      field_auto_locale: "Tự động lấy theo IP Proxy",
      field_humanize: "Chế độ mô phỏng (Humanize)",
      field_humanize_desc: "Mô phỏng hành vi di chuyển chuột, cuộn trang tự nhiên của con người",
      field_headless: "Chế độ ẩn danh (Headless)",
      field_headless_desc: "Chạy trình duyệt ngầm không hiển thị cửa sổ giao diện",
      field_geoip: "Tự động lấy múi giờ/ngôn ngữ theo định vị IP",
      field_auto_launch: "Tự động khởi chạy profile khi Phần mềm được bật",
      field_canvas: "Canvas Noise",
      field_client_rect: "ClientRects Noise",
      field_webgl_noise: "WebGL Image Noise",
      field_audio_noise: "Audio Noise",
      field_webgl_meta: "WebGL Metadata Masking",
      field_media_devices: "Media Devices Masking",
      field_mac: "MAC Address",
      field_brand: "Browser Brand",
      field_concurrency: "Hardware Concurrency (CPU Cores)",
      field_memory: "Device Memory (RAM GB)",
      field_notes: "Ghi chú",
      field_tags: "Nhãn / Tag (nhấn Enter để thêm)"
    },
    // RecycleBinDialog.tsx
    recycle: {
      title: "Thùng Rác Profile",
      search_placeholder: "Tìm kiếm profile trong thùng rác...",
      restore_selected: "Khôi phục đã chọn",
      delete_selected: "Xóa vĩnh viễn đã chọn",
      loading: "Đang tải dữ liệu thùng rác...",
      error: "Lỗi tải dữ liệu",
      retry: "Tải lại",
      empty: "Thùng rác trống",
      col_deleted_at: "Ngày Xóa",
      confirm_restore_title: "Khôi phục Profile",
      confirm_restore_desc: "Bạn có chắc chắn muốn khôi phục profile \"{name}\" không?",
      confirm_restore_warning: "Profile sẽ được khôi phục về danh sách quản lý bình thường.",
      confirm_delete_title: "Xóa vĩnh viễn Profile",
      confirm_delete_desc: "Bạn có chắc chắn muốn xóa vĩnh viễn profile \"{name}\" không?",
      confirm_delete_warning: "Hành động này sẽ xóa hoàn toàn dữ liệu trên ổ đĩa và KHÔNG THỂ hoàn tác!"
    },
    // SettingsTab.tsx
    settings_tab: {
      title: "Cài đặt hệ thống",
      save: "Lưu cài đặt",
      saving: "Đang lưu...",
      restart_warning: "Bạn cần khởi động lại ứng dụng khi thay đổi các thông tin về việc lưu trữ Profile (đường dẫn không được chứa kí tự Tiếng Việt)",
      path: "Đường dẫn lưu trữ Profile",
      change: "Thay đổi",
      compression: "Chế độ nén",
      compression_desc: "Trình nén sử dụng khi Import/Export/Backup/Restore. 7Z được khuyến nghị nhanh và tốt hơn.",
      general: "Cài đặt chung",
      language: "Ngôn ngữ",
      theme: "Theme (Giao diện tối)",
      theme_desc: "Chưa hỗ trợ giao diện Sáng (Light)",
      browser: "Cài đặt trình duyệt",
      reopen_tabs: "Mở lại các tab đang hoạt động ở phiên trước",
      auto_clear_cache: "Tự động xóa cache khi đóng",
      auto_resize: "Tự động thay đổi kích thước cửa sổ theo cài đặt profile",
      use_trash: "Sử dụng chế độ thùng rác profile",
      auto_update: "Tự động cập nhật phiên bản CloakBrowser khi khởi động",
      default_settings: "Thông số profile mặc định",
      default_settings_edit: "Chỉnh sửa",
      extension_title: "Kho Extension Hệ Thống",
      extension_add: "Thêm Extension (.zip)",
      extension_uploading: "Đang cài đặt...",
      extension_empty: "Chưa có extension nào. Tải lên file .zip để bắt đầu.",
      extension_default: "Mặc định",
      extension_name: "Tên Extension",
      extension_version: "Phiên bản",
      extension_action: "Hành động",
      pc_storage: "Trên PC",
      loading: "Đang tải cài đặt hệ thống...",
      refresh: "Làm mới",
      path_empty: "Chưa cấu hình (Click để chọn)",
      ext_upload_zip: "Vui lòng tải lên file định dạng zip.",
      ext_confirm_delete: "Bạn có chắc chắn muốn xóa extension này khỏi hệ thống không? Tất cả các profile đang sử dụng sẽ bị gỡ bỏ tiện ích này.",
      ext_default_title: "Đặt làm extension mặc định cho profile mới",
      ext_delete_title: "Xóa vĩnh viễn khỏi hệ thống",
      ext_instruction_1: "* **Extension mặc định:** Các tiện ích được tick chọn ở cột trên sẽ tự động được gán và bật mặc định mỗi khi bạn tạo một profile trình duyệt mới.",
      ext_instruction_2: "* **Tải lên extension:** Bạn có thể giải nén tiện ích từ Chrome Web Store (dùng công cụ download CRX/ZIP) rồi nén lại thành định dạng .zip thông thường để tải lên đây."
    },
    // Time relative
    time: {
      seconds_ago: "{count}s trước",
      minutes_ago: "{count}ph trước",
      hours_ago: "{count}h trước",
      days_ago: "{count}ng trước"
    }
  },
  en: {
    // App.tsx / Menu
    menu: {
      profiles: "Profiles",
      settings: "Settings",
      api: "API",
      about: "About",
      logout: "Logout",
      version: "Binary version",
      edit: "Edit Profile",
      delete: "Delete Profile",
      edit_extension: "Edit Extension",
      clone: "Clone Profile",
      import_cookie: "Import Cookies",
      export_cookie: "Export Cookies",
      copy_id: "Copy ID",
      copy_path: "Copy Path",
      open_location: "Open profile location"
    },
    // ProfileTable.tsx
    table: {
      search_placeholder: "Search profiles (name, proxy, notes)...",
      selected_count: "{count} profiles selected",
      open: "Open",
      close: "Close",
      arrange: "Arrange",
      arrange_grid: "Grid Layout",
      arrange_cascade: "Cascade Layout",
      delete: "Delete",
      copy_id: "Copy ID",
      copy_name: "Copy Name",
      copy_proxy: "Copy Proxy",
      copy_ua: "Copy UA",
      bulk_proxy: "Check Proxy",
      bulk_reset_proxy: "Set Proxy",
      bulk_startup: "Set Startup URL",
      bulk_bookmark: "Set Bookmarks",
      bulk_group: "Set Group",
      bulk_cache: "Clear Cache",
      bulk_extension: "Edit Extension",
      bulk_export: "Export profiles",
      bulk_export_cookies: "Export cookies",
      bulk_import: "Import",
      col_name: "Profile Name",
      col_group: "Group",
      col_os: "OS",
      col_storage: "Storage",
      col_status: "Status",
      col_proxy: "Proxy IP",
      col_last_run: "Last Run",
      col_notes: "Notes",
      col_action: "Actions",
      status_running: "Running",
      status_stopped: "Stopped",
      status_ready: "Ready",
      no_profiles: "No profiles found.",
      confirm_delete_title: "Delete Profile",
      confirm_delete_desc: "Are you sure you want to delete {count} selected profiles?",
      confirm_delete_warning: "These profiles will be moved to the recycle bin.",

      btn_new: "Create New",
      btn_bulk_new: "Bulk Create",
      btn_trash: "Recycle Bin",
      filter_group_all: "Group: All",
      filter_group: "Group: {group}",
      sort_newest: "Sort: Newest",
      sort_oldest: "Sort: Oldest",
      sort_name_asc: "Name: A-Z",
      sort_name_desc: "Name: Z-A",
      ctrl_a_tip: "Tip: Press Ctrl + A to select all",
      total_count: "Total: {count} profiles",
      proxy_checking: "Checking proxy IP...",
      proxy_error: "Error",
      proxy_conn_error: "Connection Error",
      not_run_yet: "Never run",
      trash_confirm_title_trash: "Move to Recycle Bin",
      trash_confirm_title_perm: "Permanently Delete",
      close_btn: "Close"
    },
    // ProfileForm.tsx
    form: {
      create_title: "Create Browser Profile",
      edit_title: "Edit Browser Profile",
      save: "Save Profile",
      saving: "Saving...",
      cancel: "Cancel",
      tab_basic: "Basic settings",
      tab_proxy: "Proxy settings",
      tab_software: "Software settings",
      tab_fingerprint: "Fingerprint",
      tab_webgl: "WebGL & Media",
      tab_notes: "Notes & Tags",
      field_name: "Profile Name",
      field_platform: "Operating System",
      field_ua: "User-Agent",
      field_screen: "Screen Resolution",
      field_proxy_type: "Proxy Type",
      field_proxy_host: "Host / IP",
      field_proxy_port: "Port",
      field_proxy_user: "User",
      field_proxy_pass: "Password",
      field_proxy_check: "Check Proxy",
      field_timezone: "Timezone",
      field_locale: "Locale",
      field_auto_locale: "Auto-detect from proxy IP",
      field_humanize: "Humanize Emulation",
      field_humanize_desc: "Emulate natural human mouse movement, scrolling, and keyboard actions",
      field_headless: "Headless Mode",
      field_headless_desc: "Run browser in background without showing graphical window",
      field_geoip: "Auto-detect timezone/locale based on IP location",
      field_auto_launch: "Auto launch profile when Software starts",
      field_canvas: "Canvas Noise",
      field_client_rect: "ClientRects Noise",
      field_webgl_noise: "WebGL Image Noise",
      field_audio_noise: "Audio Noise",
      field_webgl_meta: "WebGL Metadata Masking",
      field_media_devices: "Media Devices Masking",
      field_mac: "MAC Address",
      field_brand: "Browser Brand",
      field_concurrency: "Hardware Concurrency (CPU Cores)",
      field_memory: "Device Memory (RAM GB)",
      field_notes: "Notes",
      field_tags: "Tags (press Enter to add)"
    },
    // RecycleBinDialog.tsx
    recycle: {
      title: "Recycle Bin",
      search_placeholder: "Search profiles in recycle bin...",
      restore_selected: "Restore Selected",
      delete_selected: "Delete Permanently",
      loading: "Loading recycle bin data...",
      error: "Error loading data",
      retry: "Retry",
      empty: "Recycle bin is empty",
      col_deleted_at: "Deleted Date",
      confirm_restore_title: "Restore Profile",
      confirm_restore_desc: "Are you sure you want to restore profile \"{name}\"?",
      confirm_restore_warning: "The profile will be restored back to your active list.",
      confirm_delete_title: "Permanently Delete",
      confirm_delete_desc: "Are you sure you want to permanently delete profile \"{name}\"?",
      confirm_delete_warning: "This action will delete all browser files from disk and CANNOT be undone!"
    },
    // SettingsTab.tsx
    settings_tab: {
      title: "System Settings",
      save: "Save Settings",
      saving: "Saving...",
      restart_warning: "You need to restart the application when changing the Profile storage path (the path must not contain Vietnamese characters)",
      path: "Profile Storage Directory",
      change: "Change Path",
      compression: "Compression Mode",
      compression_desc: "Compression tool used during Import/Export/Backup/Restore. 7Z is recommended.",
      general: "General Settings",
      language: "Language",
      theme: "Theme (Dark Mode)",
      theme_desc: "Light theme is currently not supported",
      browser: "Browser Settings",
      reopen_tabs: "Reopen tabs that were active in the previous session",
      auto_clear_cache: "Automatically clear cache on close",
      auto_resize: "Automatically resize window based on profile setting",
      use_trash: "Enable profile recycle bin mode",
      auto_update: "Automatically update CloakBrowser binary on startup",
      default_settings: "Default Profile Settings",
      default_settings_edit: "Edit Settings",
      extension_title: "System Extension Manager",
      extension_add: "Add Extension (.zip)",
      extension_uploading: "Installing...",
      extension_empty: "No extensions uploaded yet. Upload a .zip file to start.",
      extension_default: "Default",
      extension_name: "Extension Name",
      extension_version: "Version",
      extension_action: "Actions",
      pc_storage: "On PC",
      loading: "Loading system settings...",
      refresh: "Refresh",
      path_empty: "Not configured (Click to select)",
      ext_upload_zip: "Please upload a ZIP file.",
      ext_confirm_delete: "Are you sure you want to delete this extension? It will be removed from all profiles.",
      ext_default_title: "Set as default extension for new profiles",
      ext_delete_title: "Permanently delete from system",
      ext_instruction_1: "* **Default Extensions:** Ticked extensions will automatically be assigned and enabled when creating a new browser profile.",
      ext_instruction_2: "* **Upload Extension:** You can extract an extension from Chrome Web Store (using CRX/ZIP download tools) then zip it normally to upload here."
    },
    // Time relative
    time: {
      seconds_ago: "{count}s ago",
      minutes_ago: "{count}m ago",
      hours_ago: "{count}h ago",
      days_ago: "{count}d ago"
    }
  }
};

export const i18n = {
  getLang(): Language {
    return currentLang;
  },
  setLang(lang: Language) {
    if (lang !== currentLang) {
      currentLang = lang;
      localStorage.setItem("app_lang", lang);
      listeners.forEach((listener) => listener());
    }
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  t(key: string, replacements?: Record<string, string | number>): string {
    const keys = key.split(".");
    let value: any = translations[currentLang];
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        // Fallback to Vietnamese translation
        let fallback: any = translations["vi"];
        for (const fk of keys) {
          if (fallback && typeof fallback === "object" && fk in fallback) {
            fallback = fallback[fk];
          } else {
            fallback = null;
            break;
          }
        }
        value = fallback;
        break;
      }
    }

    let result = typeof value === "string" ? value : key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    return result;
  }
};

export function useLanguage() {
  const [lang, setLangState] = useState<Language>(currentLang);
  useEffect(() => {
    return i18n.subscribe(() => {
      setLangState(i18n.getLang());
    });
  }, []);
  return { lang, t: i18n.t, setLang: i18n.setLang };
}
