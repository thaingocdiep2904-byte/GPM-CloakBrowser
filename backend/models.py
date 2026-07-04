"""Pydantic models for profile CRUD operations."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProfileCreate(BaseModel):
    name: str
    fingerprint_seed: int | None = None  # random if not set
    proxy: str | None = None  # "http://user:pass@host:port" or null
    timezone: str | None = None  # "America/New_York"
    locale: str | None = None  # "en-US"
    platform: Literal["windows", "macos", "linux"] = "windows"
    user_agent: str | None = None
    screen_width: int = 1920
    screen_height: int = 1080
    gpu_vendor: str | None = None
    gpu_renderer: str | None = None
    hardware_concurrency: int | None = None
    humanize: bool = True
    human_preset: Literal["default", "careful"] = "default"
    geoip: bool = True
    clipboard_sync: bool = True
    auto_launch: bool = False
    color_scheme: Literal["light", "dark", "no-preference"] | None = None
    launch_args: list[str] = Field(default_factory=list)
    notes: str | None = None
    tags: list[TagCreate] | None = None
    canvas_noise: str | None = "off"
    client_rect_noise: str | None = "off"
    webgl_noise: str | None = "off"
    audio_noise: str | None = "on"
    webgl_meta_masked: bool | None = True
    media_devices_masked: bool | None = True
    media_audio_inputs: int | None = 2
    media_audio_outputs: int | None = 1
    media_video_inputs: int | None = 0
    device_memory: int | None = 4
    browser_brand: str | None = None


class ProfileUpdate(BaseModel):
    name: str | None = None
    fingerprint_seed: int | None = None
    proxy: str | None = Field(default=None)
    timezone: str | None = Field(default=None)
    locale: str | None = Field(default=None)
    platform: Literal["windows", "macos", "linux"] | None = None
    user_agent: str | None = Field(default=None)
    screen_width: int | None = None
    screen_height: int | None = None
    gpu_vendor: str | None = Field(default=None)
    gpu_renderer: str | None = Field(default=None)
    hardware_concurrency: int | None = Field(default=None)
    humanize: bool | None = None
    human_preset: Literal["default", "careful"] | None = None
    geoip: bool | None = None
    clipboard_sync: bool | None = None
    auto_launch: bool | None = None
    color_scheme: Literal["light", "dark", "no-preference"] | None = Field(default=None)
    launch_args: list[str] | None = None
    notes: str | None = Field(default=None)
    tags: list[TagCreate] | None = None
    canvas_noise: str | None = None
    client_rect_noise: str | None = None
    webgl_noise: str | None = None
    audio_noise: str | None = None
    webgl_meta_masked: bool | None = None
    media_devices_masked: bool | None = None
    media_audio_inputs: int | None = None
    media_audio_outputs: int | None = None
    media_video_inputs: int | None = None
    device_memory: int | None = None
    browser_brand: str | None = Field(default=None)


class TagCreate(BaseModel):
    tag: str
    color: str | None = None  # hex color


class TagResponse(BaseModel):
    tag: str
    color: str | None = None


class ProfileResponse(BaseModel):
    id: str
    name: str
    fingerprint_seed: int
    proxy: str | None = None
    timezone: str | None = None
    locale: str | None = None
    platform: str = "windows"
    user_agent: str | None = None
    screen_width: int = 1920
    screen_height: int = 1080
    gpu_vendor: str | None = None
    gpu_renderer: str | None = None
    hardware_concurrency: int | None = None
    humanize: bool = True
    human_preset: str = "default"
    geoip: bool = True
    clipboard_sync: bool = True
    auto_launch: bool = False
    canvas_noise: str | None = "off"
    client_rect_noise: str | None = "off"
    webgl_noise: str | None = "off"
    audio_noise: str | None = "on"
    webgl_meta_masked: bool | None = True
    media_devices_masked: bool | None = True
    media_audio_inputs: int | None = 2
    media_audio_outputs: int | None = 1
    media_video_inputs: int | None = 0
    device_memory: int | None = 4
    browser_brand: str | None = None

    @field_validator("clipboard_sync", mode="before")
    @classmethod
    def coerce_clipboard_sync(cls, v: object) -> bool:
        return v if v is not None else True

    color_scheme: str | None = None
    launch_args: list[str] = []
    notes: str | None = None
    user_data_dir: str
    created_at: str
    updated_at: str
    tags: list[TagResponse] = []
    status: str = "stopped"  # "running" | "stopped"
    vnc_ws_port: int | None = None
    cdp_url: str | None = None
    last_run: str | None = None
    storage_bytes: int | None = None


class LaunchResponse(BaseModel):
    profile_id: str
    status: str = "running"
    vnc_ws_port: int | None = None
    display: str | None = None
    cdp_url: str | None = None


class StatusResponse(BaseModel):
    running_count: int
    binary_version: str
    profiles_total: int
    os_name: str


class ProfileStatusResponse(BaseModel):
    status: str  # "running" | "stopped"
    vnc_ws_port: int | None = None
    display: str | None = None
    cdp_url: str | None = None



class LoginRequest(BaseModel):
    token: str


class BulkActionRequest(BaseModel):
    profile_ids: list[str]


class BulkCreateRequest(BaseModel):
    count: int
    name_pattern: str
    proxies: list[str] | None = None
    platform: str = "windows"
    screen_width: int = 1920
    screen_height: int = 1080
    humanize: bool = True
    geoip: bool = True
    clipboard_sync: bool = True
    auto_launch: bool = False
    notes: str | None = None
    tags: list[TagCreate] | None = None


class BulkActionResponse(BaseModel):
    success: list[str]
    failed: dict[str, str]


class ProxyCheckResult(BaseModel):
    status: str
    ip: str | None = None
    country: str | None = None
    error: str | None = None


class BulkProxyCheckResponse(BaseModel):
    results: dict[str, ProxyCheckResult]


class BulkStartupUrlRequest(BaseModel):
    profile_ids: list[str]
    startup_url: str


class BulkResetProxyRequest(BaseModel):
    profile_ids: list[str]
    proxies: list[str] | None = None


class BookmarkItem(BaseModel):
    name: str
    url: str


class BulkBookmarkRequest(BaseModel):
    profile_ids: list[str]
    bookmarks: list[BookmarkItem]


class BulkGroupRequest(BaseModel):
    profile_ids: list[str]
    tags: list[TagCreate]


class ImportItem(BaseModel):
    name: str
    proxy: str | None = None
    notes: str | None = None


class BulkImportRequest(BaseModel):
    profiles: list[ImportItem]


class AppSettings(BaseModel):
    profile_path: str | None = None
    license_key: str | None = "CLOAK-XXXX-XXXX-XXXX"
    language: Literal["en", "vi"] | None = "vi"
    storage_type: Literal["local", "s3"] | None = "local"
    theme: Literal["light", "dark"] | None = "dark"
    reopen_tabs: bool | None = False
    auto_clear_cache: bool | None = True
    auto_resize_window: bool | None = False
    no_trash: bool | None = False
    default_extensions: str | None = "[]"
    shared_extensions: str | None = "[]"
    auto_update_cloakbrowser: bool | None = False


class ExtensionResponse(BaseModel):
    id: str
    name: str
    version: str | None = None
    path: str
    is_shared: bool
    created_at: str


class ProfileExtensionResponse(BaseModel):
    id: str
    name: str
    version: str | None = None
    path: str
    is_shared: bool
    is_enabled: bool


class ProfileExtensionItem(BaseModel):
    id: str
    is_enabled: bool


class ProfileExtensionUpdateRequest(BaseModel):
    extensions: list[ProfileExtensionItem]


class ProfileExtensionToggleRequest(BaseModel):
    is_enabled: bool


class BulkExtensionUpdateRequest(BaseModel):
    profile_ids: list[str]
    extension_ids: list[str]
    mode: Literal["arrange", "append", "overwrite"]  # giữ nguyên hoặc để Literal của mode cũ

class ArrangeWindowsRequest(BaseModel):
    profile_ids: list[str]
    layout_type: Literal["grid", "cascade"] = "grid"


