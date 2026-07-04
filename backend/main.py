"""CloakBrowser Manager — FastAPI application.

Serves the React dashboard (static files) and provides a REST API
for browser profile management with live VNC viewing.
"""

from __future__ import annotations

import asyncio
import sys
import hmac

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
import logging
import os
import shutil
from contextlib import asynccontextmanager
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import starlette.requests
from starlette.types import ASGIApp, Receive, Scope, Send

from . import database as db
from .browser_manager import BrowserManager
from .models import (
    LaunchResponse,
    LoginRequest,
    ProfileCreate,
    ProfileResponse,
    ProfileStatusResponse,
    ProfileUpdate,
    StatusResponse,
    TagResponse,
    BulkActionRequest,
    BulkCreateRequest,
    BulkActionResponse,
    BulkProxyCheckResponse,
    BulkStartupUrlRequest,
    BulkResetProxyRequest,
    BulkBookmarkRequest,
    BulkGroupRequest,
    BulkImportRequest,
    AppSettings,
    ArrangeWindowsRequest,
)

logger = logging.getLogger("cloakbrowser.manager")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logging.getLogger("websockets").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("asyncio").setLevel(logging.WARNING)

# Optional authentication via AUTH_TOKEN env var.
# If not set, all routes are open (local dev). If set, all /api/* routes
# (except /api/auth/* and /api/status) require Bearer token or cookie.
AUTH_TOKEN: str | None = os.environ.get("AUTH_TOKEN") or None

# Paths that bypass authentication even when AUTH_TOKEN is set
_AUTH_EXEMPT = frozenset({"/api/auth/status", "/api/auth/login", "/api/status"})


def _check_auth(scope: Scope) -> bool:
    """Check if the request has a valid auth token (header or cookie)."""
    # Check Authorization: Bearer <token> header
    for key, val in scope.get("headers", []):
        if key == b"authorization":
            auth_value = val.decode()
            if auth_value.startswith("Bearer "):
                token = auth_value[7:]
                if token and hmac.compare_digest(token, AUTH_TOKEN):
                    return True
            break

    # Check auth_token cookie
    for key, val in scope.get("headers", []):
        if key == b"cookie":
            cookies = SimpleCookie()
            cookies.load(val.decode())
            if "auth_token" in cookies:
                cookie_val = cookies["auth_token"].value
                if cookie_val and hmac.compare_digest(cookie_val, AUTH_TOKEN):
                    return True
            break

    return False


def _is_https(request: Request) -> bool:
    """Check if the original client connection was HTTPS (via reverse proxy header)."""
    proto = request.headers.get("x-forwarded-proto", "")
    return "https" in proto


async def _check_websocket_origin(websocket: WebSocket) -> bool:
    """Reject cross-origin WebSocket connections (CSWSH protection).

    Browsers always send an Origin header on WebSocket upgrades.
    Non-browser clients (Playwright, curl) typically don't — those are allowed.
    If Origin is present, its host must match the request Host header.
    """
    origin = None
    host = None
    for key, val in websocket.scope.get("headers", []):
        if key == b"origin":
            origin = val.decode("latin-1")
        elif key == b"host":
            host = val.decode("latin-1")

    # No Origin header → non-browser client (Playwright, Puppeteer) → allow
    if not origin:
        return True

    # Parse origin to extract host:port
    try:
        parsed = urlparse(origin)
        origin_host = parsed.hostname or ""
        origin_port = parsed.port
    except ValueError:
        logger.warning("WebSocket origin malformed: %s", origin)
        await websocket.close(code=4403, reason="Origin not allowed")
        return False
    # Build origin netloc (host:port or just host if default port)
    if origin_port and origin_port not in (80, 443):
        origin_netloc = f"{origin_host}:{origin_port}"
    else:
        origin_netloc = origin_host

    if not host:
        return True  # no Host header to compare against

    # Strip default port from Host too (some proxies send "example.com:443")
    host_normalized = host
    if host.endswith(":80") or host.endswith(":443"):
        host_normalized = host.rsplit(":", 1)[0]

    if origin_netloc == host_normalized:
        return True

    logger.warning("WebSocket origin mismatch: origin=%s host=%s", origin, host)
    await websocket.close(code=4403, reason="Origin not allowed")
    return False


class AuthMiddleware:
    """Raw ASGI middleware for optional token auth.

    Uses raw ASGI instead of BaseHTTPMiddleware because the latter
    breaks WebSocket routes (wraps request body, preventing WS upgrade).
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        # Pass through if auth disabled, or non-HTTP/WS scope (e.g. lifespan)
        if not AUTH_TOKEN or scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope["path"]

        # Skip auth for exempt endpoints and non-API paths (static frontend)
        if path in _AUTH_EXEMPT or not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        if _check_auth(scope):
            await self.app(scope, receive, send)
            return

        # Reject — unauthenticated
        if scope["type"] == "websocket":
            # ASGI requires receiving websocket.connect before sending close
            await receive()
            await send({"type": "websocket.close", "code": 4401, "reason": "Unauthorized"})
        else:
            response = JSONResponse({"detail": "Unauthorized"}, status_code=401)
            await response(scope, receive, send)


# Singleton browser manager
browser_mgr = BrowserManager()

# Frontend build directory (React production build)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"


# RFB server message translator and filters removed (VNC disabled).


async def auto_update_cloakbrowser_task():
    try:
        raw_settings = db.get_all_settings()
        if raw_settings.get("auto_update_cloakbrowser") != "true":
            logger.info("Auto update CloakBrowser is disabled.")
            return

        logger.info("Auto update CloakBrowser is enabled. Checking for updates...")
        import sys
        python_exe = sys.executable
        root_dir = Path(__file__).parent.parent.resolve()
        local_cloak_path = root_dir.parent / "CloakBrowser"
        
        if local_cloak_path.exists():
            logger.info(f"Local CloakBrowser repository found at {local_cloak_path}. Pulling latest changes...")
            git_proc = await asyncio.create_subprocess_exec(
                "git", "pull",
                cwd=str(local_cloak_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout_git, stderr_git = await git_proc.communicate()
            if git_proc.returncode == 0:
                logger.info("Git pull CloakBrowser success: %s", stdout_git.decode().strip())
            else:
                logger.warning("Git pull CloakBrowser warning/failed: %s", stderr_git.decode().strip())
                
            # Re-install ở chế độ editable
            pip_proc = await asyncio.create_subprocess_exec(
                python_exe, "-m", "pip", "install", "-e", str(local_cloak_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await pip_proc.communicate()
        else:
            # Cài từ PyPI
            logger.info("No local CloakBrowser repo. Upgrading from PyPI...")
            pip_proc = await asyncio.create_subprocess_exec(
                python_exe, "-m", "pip", "install", "--upgrade", "cloakbrowser",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await pip_proc.communicate()
            
        # Tải/Cập nhật binary Chromium
        logger.info("Verifying CloakBrowser Chromium binary...")
        proc_bin = await asyncio.create_subprocess_exec(
            python_exe, "-c", "from cloakbrowser.download import ensure_binary; ensure_binary()",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc_bin.communicate()
        logger.info("CloakBrowser update process completed.")
    except Exception as e:
        logger.error("Error during auto update CloakBrowser: %s", str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    await browser_mgr.cleanup_stale()
    browser_mgr._auto_launch_task = asyncio.create_task(browser_mgr.auto_launch_all())
    
    # Khởi chạy background task update CloakBrowser
    asyncio.create_task(auto_update_cloakbrowser_task())
    
    logger.info("CloakBrowser Manager started")
    yield
    logger.info("Shutting down — stopping all browsers...")
    if browser_mgr._auto_launch_task and not browser_mgr._auto_launch_task.done():
        browser_mgr._auto_launch_task.cancel()
        await asyncio.gather(browser_mgr._auto_launch_task, return_exceptions=True)
    await browser_mgr.cleanup_all()


app = FastAPI(title="CloakBrowser Manager", lifespan=lifespan, docs_url=None)
app.add_middleware(AuthMiddleware)

from fastapi.responses import HTMLResponse

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <title>CloakBrowser Manager - API Docs</title>
    <style>
      body { background-color: #0b0f19 !important; margin: 0; padding: 0; }
      #swagger-ui { 
        filter: invert(0.89) hue-rotate(180deg) !important; 
        background-color: #f3f4f6 !important; 
        padding: 10px 20px;
      }
      .swagger-ui .info .title { color: #000000 !important; }
      #swagger-ui img { filter: invert(1) hue-rotate(180deg) !important; }
    </style>
    </head>
    <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        const ui = SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.OAS3
            ],
            layout: "BaseLayout",
            deepLinking: true,
            showExtensions: true,
            showCommonExtensions: true
        });
    </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


# ── Authentication ────────────────────────────────────────────────────────────


@app.get("/api/auth/status")
async def auth_status(request: starlette.requests.Request):
    """Check if auth is enabled and if the current request is authenticated.

    Exempt from auth middleware so the frontend can always call it.
    """
    authenticated = False
    if AUTH_TOKEN:
        authenticated = _check_auth(request.scope)
    return {"auth_required": AUTH_TOKEN is not None, "authenticated": authenticated}


@app.post("/api/auth/login")
async def auth_login(body: LoginRequest, request: Request, response: Response):
    if not AUTH_TOKEN:
        return {"ok": True}
    if not body.token or not hmac.compare_digest(body.token, AUTH_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid token")
    is_https = _is_https(request)
    response.set_cookie(
        key="auth_token",
        value=AUTH_TOKEN,
        httponly=True,
        samesite="strict",
        secure=is_https,
        path="/",
    )
    return {"ok": True}


@app.post("/api/auth/logout")
async def auth_logout(request: Request, response: Response):
    is_https = _is_https(request)
    response.delete_cookie(
        key="auth_token", path="/", secure=is_https, samesite="strict",
    )
    return {"ok": True}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_storage_bytes(user_data_dir: str) -> int:
    """Return total size in bytes using fast os.scandir (limited depth for performance)."""
    try:
        total = 0
        p = Path(user_data_dir)
        if not p.exists():
            return 0

        def _scan(path: Path, depth: int) -> None:
            nonlocal total
            if depth > 4:
                return
            try:
                with os.scandir(path) as it:
                    for entry in it:
                        if entry.is_file(follow_symlinks=False):
                            try:
                                total += entry.stat(follow_symlinks=False).st_size
                            except OSError:
                                pass
                        elif entry.is_dir(follow_symlinks=False):
                            _scan(Path(entry.path), depth + 1)
            except PermissionError:
                pass

        _scan(p, 0)
        return total
    except Exception:
        return 0


# In-memory storage cache: {profile_id: (bytes, timestamp)}
_storage_cache: dict[str, tuple[int, float]] = {}
_STORAGE_CACHE_TTL = 60  # seconds


def _get_storage_bytes_cached(profile_id: str, user_data_dir: str) -> int:
    """Return storage bytes from cache, compute fresh if expired."""
    import time
    cached = _storage_cache.get(profile_id)
    if cached and (time.monotonic() - cached[1]) < _STORAGE_CACHE_TTL:
        return cached[0]
    size = _get_storage_bytes(user_data_dir)
    _storage_cache[profile_id] = (size, time.monotonic())
    return size


def _enrich_profile(profile: dict, browser_mgr: BrowserManager, fresh_storage: bool = False) -> ProfileResponse:
    """Add status, storage_bytes to profile dict and return ProfileResponse."""
    pid = profile["id"]
    status = browser_mgr.get_status(pid)
    profile["status"] = status["status"]
    profile["vnc_ws_port"] = status["vnc_ws_port"]
    profile["cdp_url"] = status["cdp_url"]
    profile["tags"] = [TagResponse(**t) for t in profile.get("tags", [])]
    udd = profile.get("user_data_dir", "")
    if fresh_storage:
        profile["storage_bytes"] = _get_storage_bytes(udd)
    else:
        profile["storage_bytes"] = _get_storage_bytes_cached(pid, udd)
    return ProfileResponse(**profile)


# ── Profile CRUD ──────────────────────────────────────────────────────────────


@app.get("/api/profiles", response_model=list[ProfileResponse])
async def list_profiles():
    profiles = db.list_profiles()
    return [_enrich_profile(p, browser_mgr) for p in profiles]


@app.post("/api/profiles", response_model=ProfileResponse, status_code=201)
async def create_profile(req: ProfileCreate):
    data = req.model_dump()
    tags = data.pop("tags", None)
    if tags:
        data["tags"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in tags]
    else:
        data["tags"] = []
    profile = db.create_profile(**data)
    return _enrich_profile(profile, browser_mgr)


# ── Recycle Bin routes MUST be defined BEFORE {profile_id} routes ──
@app.get("/api/profiles/deleted", response_model=list[ProfileResponse])
async def list_deleted_profiles():
    profiles = db.list_deleted_profiles()
    return [_enrich_profile(p, browser_mgr) for p in profiles]


@app.get("/api/profiles/{profile_id}", response_model=ProfileResponse)
async def get_profile(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _enrich_profile(profile, browser_mgr)


@app.put("/api/profiles/{profile_id}", response_model=ProfileResponse)
async def update_profile(profile_id: str, req: ProfileUpdate):
    # Only pass fields that were explicitly set
    data = req.model_dump(exclude_unset=True)
    tags = data.pop("tags", None)
    if tags is not None:
        data["tags"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in tags]
    profile = db.update_profile(profile_id, **data)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _enrich_profile(profile, browser_mgr)


@app.delete("/api/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    # Stop browser if running
    if profile_id in browser_mgr.running:
        await browser_mgr.stop(profile_id)

    profile = db.get_profile(profile_id)
    if not profile:
        # Check in deleted profiles just in case
        deleted_list = db.list_deleted_profiles()
        profile = next((p for p in deleted_list if p["id"] == profile_id), None)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

    app_settings = db.get_all_settings()
    no_trash = db.to_bool(app_settings.get("no_trash"))
    
    if no_trash:
        # Xóa vĩnh viễn
        user_data_dir = Path(profile["user_data_dir"])
        db.delete_profile(profile_id)
        if user_data_dir.exists():
            shutil.rmtree(user_data_dir, ignore_errors=True)
    else:
        # Xóa tạm thời (đưa vào thùng rác)
        db.soft_delete_profile(profile_id)

    return {"ok": True}


# (Đã chuyển route /api/profiles/deleted lên trên route {profile_id})


@app.post("/api/profiles/{profile_id}/restore")
async def restore_profile(profile_id: str):
    success = db.restore_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found or restore failed")
    return {"ok": True}


@app.delete("/api/profiles/{profile_id}/force")
async def force_delete_profile(profile_id: str):
    # Stop browser if running
    if profile_id in browser_mgr.running:
        await browser_mgr.stop(profile_id)

    # Check in deleted profiles
    deleted_list = db.list_deleted_profiles()
    profile = next((p for p in deleted_list if p["id"] == profile_id), None)
    if not profile:
        profile = db.get_profile(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

    user_data_dir = Path(profile["user_data_dir"])
    db.delete_profile(profile_id)
    if user_data_dir.exists():
        shutil.rmtree(user_data_dir, ignore_errors=True)
    return {"ok": True}


@app.post("/api/profiles/{profile_id}/clone", response_model=ProfileResponse)
async def clone_profile(profile_id: str):
    old_profile = db.get_profile(profile_id)
    if not old_profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Tạo fields mới bằng cách loại bỏ các trường tự sinh
    fields = {}
    exclude_keys = {"id", "user_data_dir", "created_at", "updated_at", "name"}
    for k, v in old_profile.items():
        if k not in exclude_keys:
            fields[k] = v

    # Tạo tên mới
    new_name = f"{old_profile['name']} - Copy"

    # Tạo profile trong database (hàm này tự sinh id và user_data_dir mới)
    new_profile = db.create_profile(name=new_name, **fields)

    # Sao chép dữ liệu trình duyệt cũ sang thư mục mới
    old_dir = old_profile.get("user_data_dir")
    new_dir = new_profile.get("user_data_dir")
    if old_dir and os.path.exists(old_dir) and new_dir:
        try:
            shutil.copytree(old_dir, new_dir, dirs_exist_ok=True)
        except Exception as e:
            logger.error(f"Error copying user data directory during clone: {e}")

    return _enrich_profile(new_profile, browser_mgr)


# ── Launch / Stop ─────────────────────────────────────────────────────────────


@app.post("/api/profiles/{profile_id}/launch", response_model=LaunchResponse)
async def launch_profile(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile_id in browser_mgr.running:
        raise HTTPException(status_code=409, detail="Profile is already running")

    try:
        running = await browser_mgr.launch(profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to launch profile %s: %s", profile_id, exc)
        raise HTTPException(status_code=500, detail="Failed to launch browser")

    # Record last run time
    try:
        db.set_last_run(profile_id)
    except Exception:
        pass  # Non-critical

    return LaunchResponse(
        profile_id=profile_id,
        status="running",
        vnc_ws_port=None,
        display=None,
        cdp_url=f"/api/profiles/{profile_id}/cdp",
    )


@app.post("/api/profiles/{profile_id}/stop")
async def stop_profile(profile_id: str):
    if profile_id not in browser_mgr.running:
        raise HTTPException(status_code=404, detail="Profile is not running")
    await browser_mgr.stop(profile_id)
    return {"ok": True}


@app.get("/api/profiles/{profile_id}/status", response_model=ProfileStatusResponse)
async def get_profile_status(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    status = browser_mgr.get_status(profile_id)
    return ProfileStatusResponse(**status)


@app.post("/api/profiles/{profile_id}/open-folder")
async def open_profile_folder(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    user_data_dir = Path(profile["user_data_dir"])
    if not user_data_dir.exists():
        user_data_dir.mkdir(parents=True, exist_ok=True)
        
    import subprocess
    import sys
    try:
        if os.name == "nt":
            os.startfile(str(user_data_dir))
        else:
            opener = "open" if sys.platform == "darwin" else "xdg-open"
            subprocess.Popen([opener, str(user_data_dir)])
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {exc}")


@app.post("/api/profiles/{profile_id}/import-cookies")
async def import_profile_cookies(profile_id: str, cookies: list[dict]):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    playwright_cookies = []
    for cookie in cookies:
        name = cookie.get("name")
        value = cookie.get("value")
        if not name or value is None:
            continue
            
        p_cookie = {
            "name": str(name),
            "value": str(value),
        }
        
        domain = cookie.get("domain")
        url = cookie.get("url")
        
        if domain:
            p_cookie["domain"] = str(domain)
        elif url:
            p_cookie["url"] = str(url)
        else:
            continue
            
        if "path" in cookie:
            p_cookie["path"] = str(cookie["path"])
            
        if "secure" in cookie:
            p_cookie["secure"] = bool(cookie["secure"])
            
        if "httpOnly" in cookie:
            p_cookie["httpOnly"] = bool(cookie["httpOnly"])
            
        same_site_raw = cookie.get("sameSite")
        if same_site_raw:
            same_site_raw = str(same_site_raw).lower()
            if "no_res" in same_site_raw or same_site_raw == "none":
                p_cookie["sameSite"] = "None"
            elif same_site_raw == "lax":
                p_cookie["sameSite"] = "Lax"
            elif same_site_raw == "strict":
                p_cookie["sameSite"] = "Strict"
                
        exp = cookie.get("expirationDate") or cookie.get("expires")
        if exp is not None:
            try:
                exp_val = float(exp)
                if exp_val > 0:
                    p_cookie["expires"] = int(exp_val)
            except (ValueError, TypeError):
                pass
                
        playwright_cookies.append(p_cookie)

    if profile_id in browser_mgr.running:
        running = browser_mgr.running[profile_id]
        success_count = 0
        for pc in playwright_cookies:
            try:
                await running.context.add_cookies([pc])
                success_count += 1
            except Exception:
                pass
        return {"ok": True, "imported": success_count}
        
    from cloakbrowser import launch_persistent_context_async
    try:
        user_data_dir = Path(profile["user_data_dir"])
        user_data_dir.mkdir(parents=True, exist_ok=True)
        (user_data_dir / "Default").mkdir(parents=True, exist_ok=True)
        
        context = await launch_persistent_context_async(
            user_data_dir=profile["user_data_dir"],
            headless=True,
            geoip=False,
            humanize=False
        )
        success_count = 0
        for pc in playwright_cookies:
            try:
                await context.add_cookies([pc])
                success_count += 1
            except Exception:
                pass
        await context.close()
        return {"ok": True, "imported": success_count}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import cookies: {exc}")


@app.get("/api/profiles/{profile_id}/export-cookies")
async def export_profile_cookies(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    cookies = []
    if profile_id in browser_mgr.running:
        running = browser_mgr.running[profile_id]
        try:
            cookies = await running.context.cookies()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to export active cookies: {exc}")
    else:
        from cloakbrowser import launch_persistent_context_async
        try:
            context = await launch_persistent_context_async(
                user_data_dir=profile["user_data_dir"],
                headless=True,
                geoip=False,
                humanize=False
            )
            cookies = await context.cookies()
            await context.close()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to export cookies: {exc}")
            
    # Tra ve file JSON tai xuong truc tiep
    import json
    from fastapi.responses import Response
    from urllib.parse import quote
    
    filename = f"cookies_{profile['name'].replace(' ', '_')}.json"
    encoded_filename = quote(filename)
    content = json.dumps(cookies, indent=2)
    
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@app.get("/api/profiles/{profile_id}/export-profile")
async def export_profile(profile_id: str):
    profile = db.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if profile_id in browser_mgr.running:
        raise HTTPException(
            status_code=400, 
            detail="Vui lòng đóng trình duyệt trước khi xuất profile." if db.get_setting("language", "vi") == "vi" else "Please close the browser before exporting the profile."
        )
        
    import io
    import os
    import json
    import zipfile
    from pathlib import Path
    from fastapi.responses import Response
    from urllib.parse import quote
    
    extensions = db.get_profile_extensions(profile_id)
    
    metadata = {
        "profile": {k: v for k, v in profile.items() if k != "tags"},
        "tags": profile.get("tags", []),
        "extensions": extensions
    }
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        metadata_content = json.dumps(metadata, indent=2, ensure_ascii=False)
        zip_file.writestr("metadata.json", metadata_content)
        
        user_data_path = Path(profile["user_data_dir"])
        if user_data_path.exists() and user_data_path.is_dir():
            for root, dirs, files in os.walk(user_data_path):
                for file in files:
                    file_path = Path(root) / file
                    try:
                        rel_path = file_path.relative_to(user_data_path)
                        zip_file.write(str(file_path), arcname=os.path.join("browser_data", rel_path))
                    except Exception as e:
                        logger.warning(f"Error packing file {file_path}: {e}")
                        
    zip_content = zip_buffer.getvalue()
    zip_buffer.close()
    
    filename = f"cloak_profile_{profile['name'].replace(' ', '_')}_{profile_id[:8]}.zip"
    encoded_filename = quote(filename)
    
    return Response(
        content=zip_content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@app.post("/api/profiles/bulk-export-profiles")
async def bulk_export_profiles(req: BulkActionRequest):
    running_profiles = [pid for pid in req.profile_ids if pid in browser_mgr.running]
    if running_profiles:
        raise HTTPException(
            status_code=400, 
            detail="Vui lòng đóng các trình duyệt trước khi xuất hàng loạt profile." if db.get_setting("language", "vi") == "vi" else "Please close the browsers before bulk exporting profiles."
        )
        
    import io
    import os
    import json
    import zipfile
    import datetime
    from pathlib import Path
    from fastapi.responses import Response
    from urllib.parse import quote
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for pid in req.profile_ids:
            profile = db.get_profile(pid)
            if not profile:
                continue
                
            extensions = db.get_profile_extensions(pid)
            metadata = {
                "profile": {k: v for k, v in profile.items() if k != "tags"},
                "tags": profile.get("tags", []),
                "extensions": extensions
            }
            
            metadata_content = json.dumps(metadata, indent=2, ensure_ascii=False)
            zip_file.writestr(f"profiles/{pid}/metadata.json", metadata_content)
            
            user_data_path = Path(profile["user_data_dir"])
            if user_data_path.exists() and user_data_path.is_dir():
                for root, dirs, files in os.walk(user_data_path):
                    for file in files:
                        file_path = Path(root) / file
                        try:
                            rel_path = file_path.relative_to(user_data_path)
                            zip_file.write(
                                str(file_path), 
                                arcname=os.path.join("profiles", pid, "browser_data", rel_path)
                            )
                        except Exception as e:
                            logger.warning(f"Error packing file {file_path} for profile {pid}: {e}")
                            
    zip_content = zip_buffer.getvalue()
    zip_buffer.close()
    
    filename = f"cloak_profiles_bulk_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    encoded_filename = quote(filename)
    
    return Response(
        content=zip_content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@app.post("/api/profiles/import-profile")
async def import_profile_endpoint(file: UploadFile = File(...)):
    import io
    import os
    import json
    import zipfile
    import shutil
    import uuid
    import datetime
    from pathlib import Path
    
    file_content = await file.read()
    zip_buffer = io.BytesIO(file_content)
    
    try:
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            namelist = zip_file.namelist()
            is_bulk = "metadata.json" not in namelist
            
            imported_profiles = []
            
            if not is_bulk:
                try:
                    metadata_str = zip_file.read("metadata.json").decode("utf-8")
                    metadata = json.loads(metadata_str)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Không thể đọc file cấu hình metadata.json: {e}")
                    
                profile_data = metadata.get("profile")
                tags_data = metadata.get("tags", [])
                extensions_data = metadata.get("extensions", [])
                
                if not profile_data:
                    raise HTTPException(status_code=400, detail="Thiếu cấu hình profile (profile metadata) trong gói ZIP.")
                    
                orig_id = profile_data["id"]
                new_id = orig_id
                existing = db.get_profile(orig_id)
                if existing:
                    new_id = str(uuid.uuid4())
                    profile_data["name"] = f"{profile_data['name']}_Imported"
                    
                new_user_data_dir = str(db.get_profiles_dir() / new_id)
                os.makedirs(new_user_data_dir, exist_ok=True)
                
                for name in namelist:
                    if name.startswith("browser_data/"):
                        rel_path = name[len("browser_data/"):]
                        if not rel_path or rel_path.endswith("/"):
                            continue
                        target_path = os.path.join(new_user_data_dir, rel_path)
                        os.makedirs(os.path.dirname(target_path), exist_ok=True)
                        with zip_file.open(name) as source, open(target_path, "wb") as target:
                            shutil.copyfileobj(source, target)
                            
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                
                with db.get_db() as conn:
                    conn.execute(
                        """INSERT OR REPLACE INTO profiles (
                            id, name, fingerprint_seed, proxy, timezone, locale, platform,
                            user_agent, screen_width, screen_height, gpu_vendor, gpu_renderer,
                            hardware_concurrency, humanize, human_preset, geoip,
                            auto_launch, color_scheme, launch_args, notes,
                            user_data_dir, created_at, updated_at,
                            is_deleted
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            new_id,
                            profile_data.get("name", "Imported Profile"),
                            profile_data.get("fingerprint_seed", 12345),
                            profile_data.get("proxy"),
                            profile_data.get("timezone"),
                            profile_data.get("locale"),
                            profile_data.get("platform", "windows"),
                            profile_data.get("user_agent"),
                            profile_data.get("screen_width", 1920),
                            profile_data.get("screen_height", 1080),
                            profile_data.get("gpu_vendor"),
                            profile_data.get("gpu_renderer"),
                            profile_data.get("hardware_concurrency"),
                            1 if profile_data.get("humanize", True) else 0,
                            profile_data.get("human_preset", "default"),
                            1 if profile_data.get("geoip", True) else 0,
                            1 if profile_data.get("auto_launch", False) else 0,
                            profile_data.get("color_scheme"),
                            json.dumps(profile_data.get("launch_args", [])),
                            profile_data.get("notes"),
                            new_user_data_dir,
                            profile_data.get("created_at", now_str),
                            now_str,
                            0
                        )
                    )
                    
                    conn.execute("DELETE FROM profile_tags WHERE profile_id = ?", (new_id,))
                    for t in tags_data:
                        conn.execute(
                            "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                            (new_id, t["tag"], t.get("color")),
                        )
                        
                    conn.execute("DELETE FROM profile_extensions WHERE profile_id = ?", (new_id,))
                    for ext in extensions_data:
                        ext_exists = conn.execute("SELECT 1 FROM extensions WHERE id = ?", (ext["id"],)).fetchone()
                        if ext_exists:
                            conn.execute(
                                "INSERT INTO profile_extensions (profile_id, extension_id, is_enabled) VALUES (?, ?, ?)",
                                (new_id, ext["id"], 1 if ext.get("is_enabled", True) else 0),
                            )
                    conn.commit()
                imported_profiles.append(db.get_profile(new_id))
            else:
                profile_ids_in_zip = set()
                for name in namelist:
                    if name.startswith("profiles/") and "/" in name[len("profiles/"):]:
                        pid = name[len("profiles/"):].split("/")[0]
                        profile_ids_in_zip.add(pid)
                        
                for pid in profile_ids_in_zip:
                    metadata_key = f"profiles/{pid}/metadata.json"
                    if metadata_key not in namelist:
                        continue
                        
                    try:
                        metadata_str = zip_file.read(metadata_key).decode("utf-8")
                        metadata = json.loads(metadata_str)
                    except Exception as e:
                        logger.warning(f"Không thể đọc file cấu hình cho profile {pid} trong gói ZIP bulk: {e}")
                        continue
                        
                    profile_data = metadata.get("profile")
                    tags_data = metadata.get("tags", [])
                    extensions_data = metadata.get("extensions", [])
                    
                    if not profile_data:
                        continue
                        
                    orig_id = profile_data["id"]
                    new_id = orig_id
                    existing = db.get_profile(orig_id)
                    if existing:
                        new_id = str(uuid.uuid4())
                        profile_data["name"] = f"{profile_data['name']}_Imported"
                        
                    new_user_data_dir = str(db.get_profiles_dir() / new_id)
                    os.makedirs(new_user_data_dir, exist_ok=True)
                    
                    prefix = f"profiles/{pid}/browser_data/"
                    for name in namelist:
                        if name.startswith(prefix):
                            rel_path = name[len(prefix):]
                            if not rel_path or rel_path.endswith("/"):
                                continue
                            target_path = os.path.join(new_user_data_dir, rel_path)
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with zip_file.open(name) as source, open(target_path, "wb") as target:
                                shutil.copyfileobj(source, target)
                                
                    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    
                    with db.get_db() as conn:
                        conn.execute(
                            """INSERT OR REPLACE INTO profiles (
                                id, name, fingerprint_seed, proxy, timezone, locale, platform,
                                user_agent, screen_width, screen_height, gpu_vendor, gpu_renderer,
                                hardware_concurrency, humanize, human_preset, geoip,
                                auto_launch, color_scheme, launch_args, notes,
                                user_data_dir, created_at, updated_at,
                                is_deleted
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                new_id,
                                profile_data.get("name", "Imported Profile"),
                                profile_data.get("fingerprint_seed", 12345),
                                profile_data.get("proxy"),
                                profile_data.get("timezone"),
                                profile_data.get("locale"),
                                profile_data.get("platform", "windows"),
                                profile_data.get("user_agent"),
                                profile_data.get("screen_width", 1920),
                                profile_data.get("screen_height", 1080),
                                profile_data.get("gpu_vendor"),
                                profile_data.get("gpu_renderer"),
                                profile_data.get("hardware_concurrency"),
                                1 if profile_data.get("humanize", True) else 0,
                                profile_data.get("human_preset", "default"),
                                1 if profile_data.get("geoip", True) else 0,
                                1 if profile_data.get("auto_launch", False) else 0,
                                profile_data.get("color_scheme"),
                                json.dumps(profile_data.get("launch_args", [])),
                                profile_data.get("notes"),
                                new_user_data_dir,
                                profile_data.get("created_at", now_str),
                                now_str,
                                0
                            )
                        )
                        
                        conn.execute("DELETE FROM profile_tags WHERE profile_id = ?", (new_id,))
                        for t in tags_data:
                            conn.execute(
                                "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                                (new_id, t["tag"], t.get("color")),
                            )
                            
                        conn.execute("DELETE FROM profile_extensions WHERE profile_id = ?", (new_id,))
                        for ext in extensions_data:
                            ext_exists = conn.execute("SELECT 1 FROM extensions WHERE id = ?", (ext["id"],)).fetchone()
                            if ext_exists:
                                conn.execute(
                                    "INSERT INTO profile_extensions (profile_id, extension_id, is_enabled) VALUES (?, ?, ?)",
                                    (new_id, ext["id"], 1 if ext.get("is_enabled", True) else 0),
                                )
                        conn.commit()
                    imported_profiles.append(db.get_profile(new_id))
                    
            return imported_profiles
            
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File không phải định dạng ZIP hợp lệ.")
    except Exception as e:
        logger.error(f"Error importing profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/profiles/bulk-export-cookies")
async def bulk_export_cookies(req: BulkActionRequest):
    import io
    import zipfile
    import json
    import datetime
    from fastapi.responses import Response
    from urllib.parse import quote
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for pid in req.profile_ids:
            profile = db.get_profile(pid)
            if not profile:
                continue
                
            cookies = []
            if pid in browser_mgr.running:
                running = browser_mgr.running[pid]
                try:
                    cookies = await running.context.cookies()
                except Exception:
                    pass
            else:
                from cloakbrowser import launch_persistent_context_async
                try:
                    context = await launch_persistent_context_async(
                        user_data_dir=profile["user_data_dir"],
                        headless=True,
                        geoip=False,
                        humanize=False
                    )
                    cookies = await context.cookies()
                    await context.close()
                except Exception:
                    pass
                    
            file_name = f"cookies_{profile['name'].replace(' ', '_')}.json"
            file_content = json.dumps(cookies, indent=2)
            zip_file.writestr(file_name, file_content)
            
    zip_content = zip_buffer.getvalue()
    zip_buffer.close()
    
    filename = f"bulk_cookies_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    encoded_filename = quote(filename)
    
    return Response(
        content=zip_content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


# ── Bulk Operations ────────────────────────────────────────────────────────────


@app.post("/api/profiles/bulk-launch", response_model=BulkActionResponse)
async def bulk_launch_profiles(req: BulkActionRequest):
    success = []
    failed = {}
    for pid in req.profile_ids:
        profile = db.get_profile(pid)
        if not profile:
            failed[pid] = "Profile not found"
            continue
        if pid in browser_mgr.running:
            success.append(pid)
            continue
        try:
            await browser_mgr.launch(profile)
            success.append(pid)
        except Exception as exc:
            logger.error("Bulk launch failed for %s: %s", pid, exc)
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-stop", response_model=BulkActionResponse)
async def bulk_stop_profiles(req: BulkActionRequest):
    success = []
    failed = {}
    for pid in req.profile_ids:
        if pid not in browser_mgr.running:
            success.append(pid)
            continue
        try:
            await browser_mgr.stop(pid)
            success.append(pid)
        except Exception as exc:
            logger.error("Bulk stop failed for %s: %s", pid, exc)
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-delete", response_model=BulkActionResponse)
async def bulk_delete_profiles(req: BulkActionRequest):
    success = []
    failed = {}
    
    app_settings = db.get_all_settings()
    no_trash = db.to_bool(app_settings.get("no_trash"))

    for pid in req.profile_ids:
        try:
            if pid in browser_mgr.running:
                await browser_mgr.stop(pid)
            profile = db.get_profile(pid)
            if not profile:
                success.append(pid)
                continue
            
            if no_trash:
                user_data_dir = Path(profile["user_data_dir"])
                db.delete_profile(pid)
                if user_data_dir.exists():
                    shutil.rmtree(user_data_dir, ignore_errors=True)
            else:
                db.soft_delete_profile(pid)
            success.append(pid)
        except Exception as exc:
            logger.error("Bulk delete failed for %s: %s", pid, exc)
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-restore", response_model=BulkActionResponse)
async def bulk_restore_profiles(req: BulkActionRequest):
    success = []
    failed = {}
    for pid in req.profile_ids:
        try:
            ok = db.restore_profile(pid)
            if ok:
                success.append(pid)
            else:
                failed[pid] = "Profile not found in Recycle Bin"
        except Exception as exc:
            logger.error("Bulk restore failed for %s: %s", pid, exc)
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-force-delete", response_model=BulkActionResponse)
async def bulk_force_delete_profiles(req: BulkActionRequest):
    success = []
    failed = {}
    deleted_list = db.list_deleted_profiles()
    deleted_map = {p["id"]: p for p in deleted_list}
    
    for pid in req.profile_ids:
        try:
            if pid in browser_mgr.running:
                await browser_mgr.stop(pid)
            
            profile = deleted_map.get(pid)
            if not profile:
                profile = db.get_profile(pid)
                
            if not profile:
                success.append(pid)
                continue
                
            user_data_dir = Path(profile["user_data_dir"])
            db.delete_profile(pid)
            if user_data_dir.exists():
                shutil.rmtree(user_data_dir, ignore_errors=True)
            success.append(pid)
        except Exception as exc:
            logger.error("Bulk force delete failed for %s: %s", pid, exc)
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-create", response_model=list[ProfileResponse], status_code=201)
async def bulk_create_profiles_endpoint(req: BulkCreateRequest):
    data = req.model_dump()
    name_pattern = data.pop("name_pattern")
    count = data.pop("count")
    proxies = data.pop("proxies", [])
    
    tags = data.pop("tags", None)
    if tags:
        data["tags"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in tags]
    else:
        data["tags"] = []
        
    created_list = db.bulk_create_profiles(
        name_pattern=name_pattern,
        count=count,
        proxies=proxies,
        **data
    )
    
    result = []
    for profile in created_list:
        status = browser_mgr.get_status(profile["id"])
        profile["status"] = status["status"]
        profile["vnc_ws_port"] = status["vnc_ws_port"]
        profile["cdp_url"] = status["cdp_url"]
        profile["tags"] = [TagResponse(**t) for t in profile.get("tags", [])]
        result.append(ProfileResponse(**profile))
    return result


@app.post("/api/profiles/bulk-check-proxy", response_model=BulkProxyCheckResponse)
async def bulk_check_profiles_proxy(req: BulkActionRequest):
    from backend.proxy_utils import check_proxy_connection
    from backend.models import BulkProxyCheckResponse, ProxyCheckResult
    import asyncio
    
    results = {}
    
    async def process_single(pid: str):
        profile = db.get_profile(pid)
        if not profile:
            results[pid] = ProxyCheckResult(status="no_proxy", ip="-", error="Profile not found")
            return
        
        proxy_str = profile.get("proxy") or ""
        res = await check_proxy_connection(proxy_str)
        results[pid] = ProxyCheckResult(**res)

    await asyncio.gather(*(process_single(pid) for pid in req.profile_ids))
    return BulkProxyCheckResponse(results=results)


@app.post("/api/profiles/bulk-startup-url", response_model=BulkActionResponse)
async def bulk_startup_url(req: BulkStartupUrlRequest):
    success = []
    failed = {}
    for pid in req.profile_ids:
        try:
            profile = db.get_profile(pid)
            if not profile:
                failed[pid] = "Profile not found"
                continue
            args = [a for a in profile.get("launch_args", []) if not (a.startswith("http://") or a.startswith("https://"))]
            if req.startup_url.strip():
                args.append(req.startup_url.strip())
            db.update_profile(pid, launch_args=args)
            success.append(pid)
        except Exception as exc:
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-reset-proxy", response_model=BulkActionResponse)
async def bulk_reset_proxy(req: BulkResetProxyRequest):
    success = []
    failed = {}
    for i, pid in enumerate(req.profile_ids):
        try:
            proxy = req.proxies[i % len(req.proxies)] if req.proxies else None
            db.update_profile(pid, proxy=proxy)
            success.append(pid)
        except Exception as exc:
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-group", response_model=BulkActionResponse)
async def bulk_group(req: BulkGroupRequest):
    success = []
    failed = {}
    for pid in req.profile_ids:
        try:
            db.update_profile(pid, tags=[t.model_dump() for t in req.tags])
            success.append(pid)
        except Exception as exc:
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-clear-cache", response_model=BulkActionResponse)
async def bulk_clear_cache(req: BulkActionRequest):
    success = []
    failed = {}
    from .browser_manager import clear_profile_cache_folders
    for pid in req.profile_ids:
        try:
            profile = db.get_profile(pid)
            if not profile:
                failed[pid] = "Profile not found"
                continue
            if pid in browser_mgr.running:
                failed[pid] = "Profile is currently running"
                continue
            user_data_dir = Path(profile["user_data_dir"])
            await clear_profile_cache_folders(user_data_dir)
            success.append(pid)
        except Exception as exc:
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


@app.post("/api/profiles/bulk-bookmark", response_model=BulkActionResponse)
async def bulk_bookmark(req: BulkBookmarkRequest):
    import time
    import json
    success = []
    failed = {}
    ts = str(int(time.time() * 1_000_000))
    for pid in req.profile_ids:
        try:
            profile = db.get_profile(pid)
            if not profile:
                failed[pid] = "Profile not found"
                continue
            user_data_dir = Path(profile["user_data_dir"])
            default_dir = user_data_dir / "Default"
            default_dir.mkdir(parents=True, exist_ok=True)
            bookmarks_path = default_dir / "Bookmarks"
            
            children = []
            for idx, bm in enumerate(req.bookmarks):
                children.append({
                    "type": "url",
                    "id": str(idx + 2),
                    "name": bm.name,
                    "url": bm.url,
                    "date_added": ts
                })
                
            chrome_bookmarks = {
                "checksum": "",
                "roots": {
                    "bookmark_bar": {
                        "type": "folder",
                        "id": "1",
                        "name": "Bookmarks bar",
                        "date_added": ts,
                        "date_modified": ts,
                        "children": children
                    },
                    "other": {"type": "folder", "id": "2", "name": "Other bookmarks", "children": []},
                    "synced": {"type": "folder", "id": "3", "name": "Mobile bookmarks", "children": []}
                },
                "version": 1
            }
            bookmarks_path.write_text(json.dumps(chrome_bookmarks, indent=2))
            success.append(pid)
        except Exception as exc:
            failed[pid] = str(exc)
    return BulkActionResponse(success=success, failed=failed)


# ── VNC Virtualization Removed ────────────────────────────────────────────────
# All browser instances run directly on the physical desktop.
# Virtual screen displays, xclip sync, and KasmVNC/RFB websocket filters are disabled.


# ── System Status ─────────────────────────────────────────────────────────────


@app.get("/api/status", response_model=StatusResponse)
async def get_system_status():
    import os
    from cloakbrowser.config import CHROMIUM_VERSION

    profiles = db.list_profiles()
    return StatusResponse(
        running_count=len(browser_mgr.running),
        binary_version=CHROMIUM_VERSION,
        profiles_total=len(profiles),
        os_name=os.name,
    )



# ── CDP WebSocket Proxy ──────────────────────────────────────────────────────
# Simple bidirectional passthrough — CDP is standard JSON over WebSocket,
# no protocol translation needed (unlike VNC which requires RFB filtering).


@app.get("/api/profiles/{profile_id}/cdp")
async def cdp_info(profile_id: str):
    """Return CDP connection info. Prevents SPA catch-all from serving index.html."""
    running = browser_mgr.running.get(profile_id)
    if not running:
        raise HTTPException(status_code=404, detail="Profile not running")
    return {
        "cdp_url": f"/api/profiles/{profile_id}/cdp",
        "usage": "playwright.chromium.connect_over_cdp('http://<host>/api/profiles/"
        + profile_id + "/cdp')",
    }


@app.get("/api/profiles/{profile_id}/cdp/json/version/")
@app.get("/api/profiles/{profile_id}/cdp/json/version")
async def cdp_json_version(profile_id: str, request: Request):
    """Proxy Chrome's /json/version, rewriting WS URLs to go through our proxy."""
    running = browser_mgr.running.get(profile_id)
    if not running:
        raise HTTPException(status_code=404, detail="Profile not running")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://127.0.0.1:{running.cdp_port}/json/version", timeout=5
            )
            data = resp.json()
    except Exception as exc:
        logger.error("CDP proxy: failed to reach Chrome CDP for %s: %s", profile_id, exc)
        raise HTTPException(status_code=502, detail="CDP endpoint unreachable")

    # Rewrite webSocketDebuggerUrl to point through our proxy
    host = request.headers.get("host", "localhost:8080")
    ws_scheme = "wss" if _is_https(request) else "ws"
    data["webSocketDebuggerUrl"] = f"{ws_scheme}://{host}/api/profiles/{profile_id}/cdp"
    return data


@app.get("/api/profiles/{profile_id}/cdp/json/list/")
@app.get("/api/profiles/{profile_id}/cdp/json/list")
@app.get("/api/profiles/{profile_id}/cdp/json/")
@app.get("/api/profiles/{profile_id}/cdp/json")
async def cdp_json_list(profile_id: str, request: Request):
    """Proxy Chrome's /json/list, rewriting WS URLs."""
    running = browser_mgr.running.get(profile_id)
    if not running:
        raise HTTPException(status_code=404, detail="Profile not running")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://127.0.0.1:{running.cdp_port}/json/list", timeout=5
            )
            data = resp.json()
    except Exception as exc:
        logger.error("CDP proxy: failed to reach Chrome CDP for %s: %s", profile_id, exc)
        raise HTTPException(status_code=502, detail="CDP endpoint unreachable")

    host = request.headers.get("host", "localhost:8080")
    ws_scheme = "wss" if _is_https(request) else "ws"
    for entry in data:
        if "webSocketDebuggerUrl" in entry:
            ws_path = entry["webSocketDebuggerUrl"].split("/devtools/")[-1]
            entry["webSocketDebuggerUrl"] = (
                f"{ws_scheme}://{host}/api/profiles/{profile_id}/cdp/devtools/{ws_path}"
            )
    return data


async def _proxy_cdp_websocket(
    websocket: WebSocket, target_url: str, label: str,
) -> None:
    """Bidirectional WebSocket proxy between a FastAPI client and a CDP target.

    Used by both browser-level and page-level CDP proxy endpoints.
    """
    import websockets

    try:
        async with websockets.connect(
            target_url, max_size=None, ping_interval=None, ping_timeout=None
        ) as cdp_ws:
            logger.info("%s: connected to %s", label, target_url)

            async def client_to_cdp():
                try:
                    while True:
                        msg = await websocket.receive()
                        if msg.get("type") == "websocket.disconnect":
                            break
                        if "text" in msg and msg["text"]:
                            await cdp_ws.send(msg["text"])
                        elif "bytes" in msg and msg["bytes"]:
                            await cdp_ws.send(msg["bytes"])
                except WebSocketDisconnect:
                    pass
                except Exception as exc:
                    logger.warning("%s [c->cdp]: %s: %s", label, type(exc).__name__, exc)

            async def cdp_to_client():
                try:
                    async for msg in cdp_ws:
                        if isinstance(msg, str):
                            await websocket.send_text(msg)
                        else:
                            await websocket.send_bytes(msg)
                except WebSocketDisconnect:
                    pass
                except Exception as exc:
                    logger.warning("%s [cdp->c]: %s: %s", label, type(exc).__name__, exc)

            c2d = asyncio.create_task(client_to_cdp(), name="c2d")
            d2c = asyncio.create_task(cdp_to_client(), name="d2c")
            done, pending = await asyncio.wait(
                [c2d, d2c], return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            logger.info("%s: disconnected", label)

    except Exception as exc:
        logger.error("%s error: %s", label, exc)
    finally:
        try:
            await websocket.close()
        except Exception as exc:
            logger.debug("%s: websocket.close() failed: %s", label, exc)


@app.websocket("/api/profiles/{profile_id}/cdp")
async def cdp_proxy(websocket: WebSocket, profile_id: str):
    """Proxy WebSocket frames between external tools and Chrome's CDP."""
    if not await _check_websocket_origin(websocket):
        return

    running = browser_mgr.running.get(profile_id)
    if not running:
        await websocket.close(code=4004, reason="Profile not running")
        return

    await websocket.accept()

    # Get browser-level CDP WebSocket URL from Chrome
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://127.0.0.1:{running.cdp_port}/json/version", timeout=5
            )
            ws_url = resp.json()["webSocketDebuggerUrl"]
    except Exception as exc:
        logger.error("CDP proxy: failed to get WS URL for %s: %s", profile_id, exc)
        await websocket.close(code=4005, reason="CDP not available")
        return

    await _proxy_cdp_websocket(websocket, ws_url, f"CDP proxy [{profile_id}]")


@app.websocket("/api/profiles/{profile_id}/cdp/devtools/{path:path}")
async def cdp_page_proxy(websocket: WebSocket, profile_id: str, path: str):
    """Proxy page-specific CDP WebSocket connections (e.g. /devtools/page/GUID)."""
    if not await _check_websocket_origin(websocket):
        return

    running = browser_mgr.running.get(profile_id)
    if not running:
        await websocket.close(code=4004, reason="Profile not running")
        return

    await websocket.accept()

    target_url = f"ws://127.0.0.1:{running.cdp_port}/devtools/{path}"
    await _proxy_cdp_websocket(websocket, target_url, f"CDP page proxy [{profile_id}]")



@app.post("/api/profiles/grid-layout")
async def grid_layout_route():
    import os
    if os.name != "nt":
        raise HTTPException(status_code=400, detail="Grid layout is only supported on Windows")
        
    running_pids = list(browser_mgr.running.keys())
    if not running_pids:
        return {"arranged": 0}
        
    profile_names = []
    for pid in running_pids:
        p = db.get_profile(pid)
        if p:
            profile_names.append(p["name"])
            
    from backend.proxy_utils import arrange_windows_grid
    arranged = arrange_windows_grid(profile_names)
    return {"arranged": arranged}


# ── Settings Management ───────────────────────────────────────────────────────

@app.get("/api/settings", response_model=AppSettings)
async def get_settings():
    raw_settings = db.get_all_settings()
    
    to_bool = db.to_bool
        
    profile_path = raw_settings.get("profile_path")
    if not profile_path:
        from backend.database import get_profiles_dir
        profile_path = str(get_profiles_dir())
        
    return AppSettings(
        profile_path=profile_path,
        language=raw_settings.get("language", "en"),
        theme=raw_settings.get("theme", "dark"),
        reopen_tabs=to_bool(raw_settings.get("reopen_tabs")),
        auto_clear_cache=to_bool(raw_settings.get("auto_clear_cache")),
        auto_resize_window=to_bool(raw_settings.get("auto_resize_window")),
        no_trash=to_bool(raw_settings.get("no_trash")),
        default_extensions=raw_settings.get("default_extensions", "[]"),
        shared_extensions=raw_settings.get("shared_extensions", "[]"),
        auto_update_cloakbrowser=to_bool(raw_settings.get("auto_update_cloakbrowser", "true")),
    )

@app.post("/api/settings", response_model=AppSettings)
async def update_settings(settings: AppSettings):
    data = settings.model_dump(exclude_unset=True)
    for key, val in data.items():
        if val is None:
            db.set_setting(key, "")
        elif isinstance(val, bool):
            db.set_setting(key, "true" if val else "false")
        else:
            db.set_setting(key, str(val))
    return await get_settings()

@app.post("/api/settings/select-folder")
async def select_folder():
    import sys
    if sys.platform != "win32":
        raise HTTPException(status_code=400, detail="Hộp thoại chọn thư mục chỉ hỗ trợ trên hệ điều hành Windows.")
        
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        path = filedialog.askdirectory(
            parent=root, 
            title="Chọn thư mục lưu trữ profile"
        )
        
        root.destroy()
        
        if not path:
            return {"path": None}
        path = path.replace("/", "\\")
        return {"path": path}
    except Exception as e:
        logger.error("Lỗi khi mở Folder Browser Dialog qua Tkinter: %s", e)
        raise HTTPException(status_code=500, detail=f"Không thể mở hộp thoại chọn thư mục: {e}")


# ── Extension Endpoints ───────────────────────────────────────────────────────

from .models import (
    ExtensionResponse,
    ProfileExtensionResponse,
    ProfileExtensionUpdateRequest,
    ProfileExtensionToggleRequest,
    BulkExtensionUpdateRequest,
)
import zipfile
import uuid

@app.get("/api/extensions", response_model=list[ExtensionResponse])
async def list_extensions():
    """List all registered extensions."""
    exts = db.get_all_extensions()
    return [
        ExtensionResponse(
            id=e["id"],
            name=e["name"],
            version=e["version"],
            path=e["path"],
            is_shared=bool(e["is_shared"]),
            created_at=e["created_at"]
        ) for e in exts
    ]

@app.post("/api/extensions/upload", response_model=ExtensionResponse)
async def upload_extension(
    file: UploadFile = File(...),
    is_shared: bool = Form(False)
):
    """Upload a Chrome extension zip and extract it."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tải lên file nén định dạng .zip.")

    ext_id = str(uuid.uuid4())
    ext_dir = db.DATA_DIR / "extensions" / ext_id
    ext_dir.mkdir(parents=True, exist_ok=True)

    zip_path = ext_dir / "extension.zip"
    try:
        # Save zip file
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract zip file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(ext_dir)

        # Remove the zip file after extraction
        zip_path.unlink()

        # Find manifest.json to read name and version
        manifest_path = ext_dir / "manifest.json"
        # In case the zip contains a nested folder (e.g. extension_name/manifest.json)
        if not manifest_path.exists():
            # Search one level deep
            nested_manifests = list(ext_dir.glob("*/manifest.json"))
            if nested_manifests:
                manifest_path = nested_manifests[0]
                actual_ext_path = manifest_path.parent
            else:
                raise HTTPException(status_code=400, detail="Không tìm thấy tệp manifest.json hợp lệ trong file zip.")
        else:
            actual_ext_path = ext_dir

        # Read manifest.json
        import json
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        
        ext_name = manifest.get("name", "Unknown Extension")
        if ext_name.startswith("__MSG_") and ext_name.endswith("__"):
            ext_name = file.filename.rsplit(".", 1)[0]
            
        ext_version = manifest.get("version", "1.0")

        # Create record in DB
        res = db.create_extension(
            id=ext_id,
            name=ext_name,
            version=ext_version,
            path=str(actual_ext_path),
            is_shared=is_shared
        )
        return ExtensionResponse(
            id=res["id"],
            name=res["name"],
            version=res["version"],
            path=res["path"],
            is_shared=bool(res["is_shared"]),
            created_at=res["created_at"]
        )

    except Exception as e:
        if ext_dir.exists():
            shutil.rmtree(ext_dir, ignore_errors=True)
        logger.error("Lỗi khi tải và cài đặt extension: %s", e)
        raise HTTPException(status_code=500, detail=f"Lỗi khi cài đặt extension: {e}")

@app.delete("/api/extensions/{ext_id}")
async def delete_extension(ext_id: str):
    """Delete extension and its folder."""
    exts = db.get_all_extensions()
    target = None
    for e in exts:
        if e["id"] == ext_id:
            target = e
            break

    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy extension.")

    try:
        db.delete_extension(ext_id)
        uuid_dir = db.DATA_DIR / "extensions" / ext_id
        if uuid_dir.exists():
            shutil.rmtree(uuid_dir, ignore_errors=True)
        else:
            ext_path = Path(target["path"])
            if ext_path.exists():
                shutil.rmtree(ext_path, ignore_errors=True)

        return {"ok": True}
    except Exception as e:
        logger.error("Lỗi khi xóa extension: %s", e)
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa extension: {e}")

@app.get("/api/profiles/{profile_id}/extensions", response_model=list[ProfileExtensionResponse])
async def get_profile_extensions(profile_id: str):
    """Get extensions assigned to a profile."""
    p = db.get_profile(profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy profile.")

    exts = db.get_profile_extensions(profile_id)
    return [
        ProfileExtensionResponse(
            id=e["id"],
            name=e["name"],
            version=e["version"],
            path=e["path"],
            is_shared=bool(e["is_shared"]),
            is_enabled=bool(e["is_enabled"])
        ) for e in exts
    ]

@app.post("/api/profiles/{profile_id}/extensions")
async def update_profile_extensions(profile_id: str, body: ProfileExtensionUpdateRequest):
    """Update extensions assigned to a profile."""
    p = db.get_profile(profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy profile.")

    ext_list = [item.model_dump() for item in body.extensions]
    db.update_profile_extensions(profile_id, ext_list)
    return {"ok": True}

@app.post("/api/profiles/{profile_id}/extensions/{ext_id}/toggle")
async def toggle_profile_extension(profile_id: str, ext_id: str, body: ProfileExtensionToggleRequest):
    """Toggle profile's extension state."""
    db.toggle_profile_extension(profile_id, ext_id, body.is_enabled)
    return {"ok": True}

@app.post("/api/profiles/bulk/extensions")
async def bulk_update_extensions(body: BulkExtensionUpdateRequest):
    """Apply extensions to multiple profiles."""
    db.bulk_update_profiles_extensions(body.profile_ids, body.extension_ids, body.mode)
    return {"ok": True}


@app.post("/api/profiles/arrange")
async def arrange_windows(body: ArrangeWindowsRequest):
    """Arrange active browser windows using CDP."""
    res = await browser_mgr.arrange_windows(body.profile_ids, body.layout_type)
    return res


# ── Static Frontend ───────────────────────────────────────────────────────────

# Serve React build. Must be AFTER API routes so /api/* isn't caught by the SPA.
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — all non-API routes return index.html."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = FRONTEND_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
