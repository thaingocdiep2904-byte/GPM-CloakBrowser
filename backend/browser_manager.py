"""Launch/stop/track CloakBrowser instances per profile."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cloakbrowser import launch_persistent_context_async


import shutil
import stat

logger = logging.getLogger("cloakbrowser.manager.browser")


def _remove_readonly(func, path, excinfo):
    """Clear the readonly bit and reattempt rmtree."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


async def clear_profile_cache_folders(user_data_dir: Path):
    """An safely delayed and retried cache cleaner for Chromium profiles."""
    target_dirs = [
        # Thư mục cache ngoài
        user_data_dir / "ShaderCache",
        user_data_dir / "GrShaderCache",
        user_data_dir / "GraphiteDawnCache",
        user_data_dir / "BrowserMetrics",
        # Thư mục cache trong Default
        user_data_dir / "Default" / "Cache",
        user_data_dir / "Default" / "Code Cache",
        user_data_dir / "Default" / "GPUCache",
        user_data_dir / "Default" / "DawnGraphiteCache",
        user_data_dir / "Default" / "DawnWebGPUCache",
        user_data_dir / "Default" / "AutofillAiModelCache",
        user_data_dir / "Default" / "Service Worker",
    ]
    
    # Đợi 0.5 giây đầu
    await asyncio.sleep(0.5)
    
    # Thử lại tối đa 4 lần, mỗi lần cách nhau 0.5 giây
    for attempt in range(4):
        all_done = True
        for path in target_dirs:
            if path.exists() and path.is_dir():
                try:
                    shutil.rmtree(str(path), onerror=_remove_readonly)
                except Exception:
                    all_done = False
        if all_done:
            break
        await asyncio.sleep(0.5)


def _normalize_proxy(raw: str) -> str:
    """Convert common proxy formats to http://user:pass@host:port.

    Accepts:
      - http://user:pass@host:port  (already valid)
      - host:port:user:pass
      - host:port
    """
    if raw.startswith(("http://", "https://", "socks5://")):
        return raw
    parts = raw.split(":")
    if len(parts) == 4:
        host, port, user, passwd = parts
        return f"http://{user}:{passwd}@{host}:{port}"
    if len(parts) == 2:
        return f"http://{raw}"
    return raw


def _validate_proxy(url: str) -> None:
    """Validate that a normalized proxy URL has scheme, host, and port."""
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https", "socks5"):
        raise ValueError(
            f"Invalid proxy scheme '{parsed.scheme}'. Must be http, https, or socks5."
        )
    if not parsed.hostname:
        raise ValueError(f"Proxy URL missing hostname: {url}")
    if not parsed.port:
        raise ValueError(f"Proxy URL missing port: {url}")


def _init_profile_defaults(user_data_dir: Path) -> None:
    """Set up bookmarks and DuckDuckGo search on first launch."""
    default_dir = user_data_dir / "Default"
    default_dir.mkdir(parents=True, exist_ok=True)

    # --- Bookmarks (only on first launch) ---
    bookmarks_path = default_dir / "Bookmarks"
    if not bookmarks_path.exists():
        ts = str(int(time.time() * 1_000_000))  # Chrome timestamp format
        _id = 1

        def bm(name: str, url: str) -> dict:
            nonlocal _id
            _id += 1
            return {"type": "url", "id": str(_id), "name": name, "url": url, "date_added": ts}

        def folder(name: str, children: list) -> dict:
            nonlocal _id
            _id += 1
            return {"type": "folder", "id": str(_id), "name": name, "children": children, "date_added": ts, "date_modified": ts}

        bookmarks = {
            "checksum": "",
            "roots": {
                "bookmark_bar": {
                    "type": "folder", "id": "1", "name": "Bookmarks bar",
                    "date_added": ts, "date_modified": ts,
                    "children": [
                        folder("Detection Tests", [
                            bm("Rebrowser Bot Detector", "https://bot-detector.rebrowser.net/"),
                            bm("Incolumitas", "https://bot.incolumitas.com/"),
                            bm("SannySort", "https://bot.sannysoft.com/"),
                            bm("BrowserScan Bot", "https://www.browserscan.net/bot-detection"),
                            bm("FingerprintJS Demo", "https://demo.fingerprint.com/web-scraping"),
                            bm("Pixelscan", "https://pixelscan.net/fingerprint-check"),
                            bm("CreepJS", "https://abrahamjuliot.github.io/creepjs/"),
                            bm("fingerprint-scan", "https://fingerprint-scan.com/"),
                            bm("DeviceInfo Bot", "https://deviceandbrowserinfo.com/are_you_a_bot"),
                        ]),
                        folder("Fingerprint", [
                            bm("BrowserLeaks Canvas", "https://browserleaks.com/canvas"),
                            bm("BrowserLeaks WebGL", "https://browserleaks.com/webgl"),
                            bm("BrowserLeaks Fonts", "https://browserleaks.com/fonts"),
                            bm("BrowserLeaks JS", "https://browserleaks.com/javascript"),
                            bm("FingerprintJS OSS", "https://fingerprintjs.github.io/fingerprintjs/"),
                            bm("Audio FP", "https://audiofingerprint.openwpm.com/"),
                            bm("DeviceInfo", "https://deviceandbrowserinfo.com/info_device"),
                        ]),
                        folder("Headers & TLS", [
                            bm("httpbin headers", "https://httpbin.org/headers"),
                            bm("httpbin IP", "https://httpbin.org/ip"),
                            bm("TLS Fingerprint", "https://tls.browserleaks.com/"),
                        ]),
                        folder("reCAPTCHA", [
                            bm("Google v3 Demo", "https://recaptcha-demo.appspot.com/recaptcha-v3-request-scores.php"),
                            bm("2captcha v3", "https://2captcha.com/demo/recaptcha-v3"),
                            bm("Turnstile", "https://peet.ws/turnstile-test/non-interactive.html"),
                        ]),
                    ],
                },
                "other": {"type": "folder", "id": "2", "name": "Other bookmarks", "children": []},
                "synced": {"type": "folder", "id": "3", "name": "Mobile bookmarks", "children": []},
            },
            "version": 1,
        }
        bookmarks_path.write_text(json.dumps(bookmarks, indent=2))
        logger.info("Created default bookmarks for %s", user_data_dir.name)

    # --- Cốc Cốc and Session Restore in Preferences ---
    prefs_path = default_dir / "Preferences"
    try:
        if prefs_path.exists():
            data = json.loads(prefs_path.read_text())
        else:
            data = {}
            
        data["default_search_provider_data"] = {
            "template_url_data": {
                "short_name": "Cốc Cốc",
                "keyword": "coccoc.com",
                "url": "https://coccoc.com/search?q={searchTerms}",
                "suggestions_url": "https://coccoc.com/search/suggest?q={searchTerms}",
                "safe_for_autoreplace": True,
                "id": "2",
                "prepopulate_id": "99",
                "sync_guid": "coccoc_search_provider"
            }
        }
        
        if "profile" not in data:
            data["profile"] = {}
        data["profile"]["default_search_provider"] = {
            "enabled": True
        }
        data["profile"]["exit_type"] = "Normal"
        data["profile"]["exited_cleanly"] = True
        
        # Configure reopen tabs (restore session)
        from . import database as db
        app_settings = db.get_all_settings()
        reopen_tabs = db.to_bool(app_settings.get("reopen_tabs"))
        if "session" not in data:
            data["session"] = {}
        data["session"]["restore_on_startup"] = 1 if reopen_tabs else 5
        data["session"]["restore_on_startup_migrated"] = True
        
        prefs_path.write_text(json.dumps(data, indent=2))
        logger.info("Configured Preferences for %s (reopen_tabs=%s)", user_data_dir.name, reopen_tabs)
    except Exception as e:
        logger.warning("Error configuring Cốc Cốc and Session in Preferences for %s: %s", user_data_dir.name, e)


BASE_CDP_PORT = 5100
CDP_PORT_RANGE = 100  # cycle through 5100-5199 to avoid TIME_WAIT collisions


@dataclass
class RunningProfile:
    profile_id: str
    context: Any  # Playwright BrowserContext
    cdp_port: int


class BrowserManager:
    def __init__(self):
        self.running: dict[str, RunningProfile] = {}
        self._launching: set[str] = set()  # profile IDs currently being launched
        self._lock = asyncio.Lock()
        self._next_cdp_port = BASE_CDP_PORT
        self._auto_launch_task: asyncio.Task | None = None

    async def launch(self, profile: dict[str, Any], window_x: int | None = None, window_y: int | None = None) -> RunningProfile:
        """Launch a browser instance for the given profile."""
        profile_id = profile["id"]

        async with self._lock:
            if profile_id in self.running or profile_id in self._launching:
                raise RuntimeError(f"Profile {profile_id} is already running")
            self._launching.add(profile_id)


        try:
            cdp_port = self._allocate_cdp_port()
        except ValueError:
            async with self._lock:
                self._launching.discard(profile_id)
            raise

        # Clean stale Chromium lock files (left by previous container crashes)
        user_data_dir = Path(profile["user_data_dir"])
        for lock_file in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
            lock_path = user_data_dir / lock_file
            lock_path.unlink(missing_ok=True)

        # Set up bookmarks and search engine on first launch
        _init_profile_defaults(user_data_dir)

        try:
            # Get settings for window resizing
            from . import database as db
            app_settings = db.get_all_settings()
            auto_resize = db.to_bool(app_settings.get("auto_resize_window"))
            if auto_resize:
                w = profile.get("screen_width", 1920)
                h = profile.get("screen_height", 1080)
            else:
                w = 1920
                h = 1080



            # Build fingerprint args from profile settings
            extra_args = self._build_fingerprint_args(profile)
            
            # Load reopen_tabs setting
            reopen_tabs = db.to_bool(app_settings.get("reopen_tabs"))
            
            # Add --restore-last-session flag when reopen_tabs is enabled
            if reopen_tabs:
                extra_args.append("--restore-last-session")
            
            # Load profile extensions
            profile_exts = db.get_profile_extensions(profile["id"])
            enabled_ext_paths = [e["path"] for e in profile_exts if e.get("is_enabled")]
            
            # Load system default extensions
            import json
            default_exts_str = app_settings.get("default_extensions", "[]")
            try:
                default_ext_ids = json.loads(default_exts_str)
                if default_ext_ids:
                    all_exts = db.get_all_extensions()
                    for ext in all_exts:
                        if ext["id"] in default_ext_ids:
                            if ext["path"] not in enabled_ext_paths:
                                enabled_ext_paths.append(ext["path"])
            except Exception:
                pass
                
            if enabled_ext_paths:
                ext_paths_str = ",".join(enabled_ext_paths)
                extra_args.append(f"--disable-extensions-except={ext_paths_str}")
                extra_args.append(f"--load-extension={ext_paths_str}")

            color_scheme = profile.get("color_scheme")
            if color_scheme == "dark":
                extra_args.append("--force-dark-mode")

            if window_x is not None and window_y is not None:
                extra_args.append(f"--window-position={window_x},{window_y}")
                extra_args.append(f"--window-size={w},{h}")

            extra_args += profile.get("launch_args") or []
            extra_args.append(f"--remote-debugging-port={cdp_port}")

            # Extract startup URLs (arguments starting with http:// or https://)
            startup_urls = [arg for arg in extra_args if arg.startswith("http://") or arg.startswith("https://")]
            # Filter them out of Chromium launch arguments to prevent launch crashes
            extra_args = [arg for arg in extra_args if not (arg.startswith("http://") or arg.startswith("https://"))]

            # Normalize proxy format (host:port:user:pass → http://user:pass@host:port)
            raw_proxy = profile.get("proxy") or None
            proxy = _normalize_proxy(raw_proxy) if raw_proxy else None
            if proxy:
                _validate_proxy(proxy)

            # Launch CloakBrowser directly on the desktop
            context = await launch_persistent_context_async(
                user_data_dir=profile["user_data_dir"],
                headless=False,
                proxy=proxy,
                args=extra_args,
                timezone=profile.get("timezone") or None,
                locale=profile.get("locale") or None,
                humanize=bool(profile.get("humanize", False)),
                human_preset=profile.get("human_preset", "default"),
                geoip=bool(profile.get("geoip", False)),
                color_scheme=profile.get("color_scheme") or None,
                user_agent=profile.get("user_agent") or None,
                viewport={
                    "width": w,
                    "height": h,
                } if auto_resize else None,
                env=os.environ.copy(),
            )

            running = RunningProfile(
                profile_id=profile_id,
                context=context,
                cdp_port=cdp_port,
            )

            # Auto-cleanup if browser crashes or user closes Chrome
            context.on("close", lambda: asyncio.ensure_future(
                self._on_browser_closed(profile_id)
            ))

            async with self._lock:
                self.running[profile_id] = running
                self._launching.discard(profile_id)

            logger.info(
                "Launched profile %s (cdp_port=%d)",
                profile_id, cdp_port,
            )

            return running

        except BaseException:
            async with self._lock:
                self._launching.discard(profile_id)
            raise

    async def _clear_profile_cache(self, profile_id: str):
        """Clean up Chromium cache directories if auto_clear_cache setting is enabled."""
        try:
            from . import database as db
            app_settings = db.get_all_settings()
            if not db.to_bool(app_settings.get("auto_clear_cache", "true")):
                return
                
            profile = db.get_profile(profile_id)
            if not profile:
                return
                
            user_data_dir = Path(profile["user_data_dir"])
            await clear_profile_cache_folders(user_data_dir)
            logger.info("Auto cleared cache directories for profile %s", profile_id)
        except Exception as e:
            logger.warning("Error auto clearing cache for profile %s: %s", profile_id, e)

    async def _on_browser_closed(self, profile_id: str):
        """Called when browser exits (crash, or stop())."""
        async with self._lock:
            running = self.running.pop(profile_id, None)

        if running:
            logger.info("Browser closed for profile %s, cleaning up", profile_id)
            await self._clear_profile_cache(profile_id)

    async def stop(self, profile_id: str):
        """Stop a running browser instance."""
        # Pop before close so _on_browser_closed() finds nothing to clean up
        async with self._lock:
            running = self.running.pop(profile_id, None)

        if not running:
            return

        logger.info("Stopping profile %s", profile_id)

        try:
            await running.context.close()
        except Exception as exc:
            logger.warning("Error closing context for %s: %s", profile_id, exc)

        await self._clear_profile_cache(profile_id)

    def get_status(self, profile_id: str) -> dict[str, Any]:
        """Get running status for a profile."""
        running = self.running.get(profile_id)
        if running:
            return {
                "status": "running",
                "vnc_ws_port": None,
                "display": None,
                "cdp_url": f"/api/profiles/{profile_id}/cdp",
            }
        return {"status": "stopped", "vnc_ws_port": None, "display": None, "cdp_url": None}

    async def cleanup_all(self):
        """Stop all running profiles. Called on shutdown."""
        async with self._lock:
            profile_ids = list(self.running.keys())

        for pid in profile_ids:
            await self.stop(pid)

    async def cleanup_stale(self):
        """Kill orphan processes from previous runs."""
        pass

    async def auto_launch_all(self):
        """Launch all profiles with auto_launch=True. Called on startup."""
        from . import database as db

        profiles = db.list_profiles()
        auto_profiles = [p for p in profiles if p.get("auto_launch")]
        if not auto_profiles:
            logger.info("No profiles configured for auto-launch")
            return

        logger.info("Auto-launching %d profile(s)...", len(auto_profiles))
        for profile in auto_profiles:
            try:
                await asyncio.wait_for(self.launch(profile), timeout=60)
                logger.info("Auto-launched profile %s (%s)", profile["name"], profile["id"])
            except Exception as exc:
                logger.error(
                    "Auto-launch failed for profile %s (%s): %s",
                    profile["name"], profile["id"], exc,
                )
        logger.info("Auto-launch complete: %d running", len(self.running))

    def _allocate_cdp_port(self) -> int:
        """Find a free CDP port using a rotating counter to avoid TIME_WAIT collisions."""
        for _ in range(CDP_PORT_RANGE):
            port = self._next_cdp_port
            self._next_cdp_port = BASE_CDP_PORT + (
                (self._next_cdp_port + 1 - BASE_CDP_PORT) % CDP_PORT_RANGE
            )
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("127.0.0.1", port))
                    return port
                except OSError:
                    continue
        raise ValueError("No free CDP ports available in range %d-%d" % (BASE_CDP_PORT, BASE_CDP_PORT + CDP_PORT_RANGE - 1))

    def _build_fingerprint_args(self, profile: dict[str, Any]) -> list[str]:
        """Build extra Chromium args from profile fingerprint settings."""
        args: list[str] = [
            "--disable-infobars",
            "--test-type",  # suppress "unsupported flag: --no-sandbox" bad flags warning
        ]

        seed = profile.get("fingerprint_seed")
        if seed is not None:
            args.append(f"--fingerprint={seed}")

        p = profile.get("platform")
        if p:
            # Map our "macos" to binary's "macos"
            args.append(f"--fingerprint-platform={p}")

        vendor = profile.get("gpu_vendor")
        if vendor:
            args.append(f"--fingerprint-gpu-vendor={vendor}")

        renderer = profile.get("gpu_renderer")
        if renderer:
            args.append(f"--fingerprint-gpu-renderer={renderer}")

        hw = profile.get("hardware_concurrency")
        if hw is not None:
            args.append(f"--fingerprint-hardware-concurrency={hw}")

        sw = profile.get("screen_width")
        sh = profile.get("screen_height")
        if sw:
            args.append(f"--fingerprint-screen-width={sw}")
        if sh:
            args.append(f"--fingerprint-screen-height={sh}")

        return args

    async def arrange_windows(self, profile_ids: list[str], layout_type: str = "grid") -> dict[str, Any]:
        """Arrange active browser windows using CDP."""
        import math
        
        # 1. Filter only currently running profiles
        active_profiles: list[RunningProfile] = []
        for pid in profile_ids:
            if pid in self.running:
                active_profiles.append(self.running[pid])
                
        if not active_profiles:
            return {"success_count": 0, "failed_count": 0}
            
        # 2. Get screen resolution via ctypes
        screen_w, screen_h = _get_primary_screen_resolution()
        
        # Subtract some pixels for Windows taskbar (typically at the bottom, ~60px)
        usable_h = max(screen_h - 60, 400)
        usable_w = screen_w
        
        success_count = 0
        failed_count = 0
        
        N = len(active_profiles)
        
        # 3. Calculate grids
        if layout_type == "grid":
            cols = math.ceil(math.sqrt(N))
            rows = math.ceil(N / cols)
            
            cell_w = usable_w // cols
            cell_h = usable_h // rows
            
            for idx, running in enumerate(active_profiles):
                col = idx % cols
                row = idx // cols
                x = col * cell_w
                y = row * cell_h
                
                try:
                    pages = running.context.pages
                    page = pages[0] if pages else await running.context.new_page()
                    session = await running.context.new_cdp_session(page)
                    
                    win_info = await session.send("Browser.getWindowForTarget")
                    window_id = win_info["windowId"]
                    
                    await session.send("Browser.setWindowBounds", {
                        "windowId": window_id,
                        "bounds": {
                            "left": int(x),
                            "top": int(y),
                            "width": int(cell_w),
                            "height": int(cell_h),
                            "windowState": "normal"
                        }
                    })
                    success_count += 1
                except Exception as e:
                    logger.error("Failed to set window bounds for %s via CDP: %s", running.profile_id, e)
                    failed_count += 1
                    
        else:  # cascade layout
            win_w = min(1000, usable_w - 100)
            win_h = min(750, usable_h - 100)
            
            for idx, running in enumerate(active_profiles):
                # Offset cascade step (e.g. 45px each step)
                offset = idx * 45
                x = 50 + (offset % (usable_w - win_w))
                y = 50 + (offset % (usable_h - win_h))
                
                try:
                    pages = running.context.pages
                    page = pages[0] if pages else await running.context.new_page()
                    session = await running.context.new_cdp_session(page)
                    
                    win_info = await session.send("Browser.getWindowForTarget")
                    window_id = win_info["windowId"]
                    
                    await session.send("Browser.setWindowBounds", {
                        "windowId": window_id,
                        "bounds": {
                            "left": int(x),
                            "top": int(y),
                            "width": int(win_w),
                            "height": int(win_h),
                            "windowState": "normal"
                        }
                    })
                    success_count += 1
                except Exception as e:
                    logger.error("Failed to cascade window for %s via CDP: %s", running.profile_id, e)
                    failed_count += 1
                    
        return {"success_count": success_count, "failed_count": failed_count}


def _get_primary_screen_resolution() -> tuple[int, int]:
    """Retrieve primary monitor resolution using Win32 API via ctypes."""
    try:
        import ctypes
        user32 = ctypes.windll.user32
        return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    except Exception:
        # Fallback for non-Windows platforms or test environments
        return 1920, 1080
