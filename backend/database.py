"""SQLite database operations for browser profiles."""

from __future__ import annotations

import datetime
import json
import random
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import os

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
DB_PATH = DATA_DIR / "profiles.db"


def to_bool(val: Any) -> bool:
    if not val:
        return False
    return str(val).lower() in ("true", "1", "yes", "on")


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                fingerprint_seed INTEGER NOT NULL,
                proxy TEXT,
                timezone TEXT,
                locale TEXT,
                geoip BOOLEAN DEFAULT 1,
                platform TEXT DEFAULT 'windows',
                user_agent TEXT,
                screen_width INTEGER DEFAULT 1920,
                screen_height INTEGER DEFAULT 1080,
                gpu_vendor TEXT,
                gpu_renderer TEXT,
                hardware_concurrency INTEGER,
                humanize BOOLEAN DEFAULT 1,
                human_preset TEXT DEFAULT 'default',
                auto_launch BOOLEAN DEFAULT 0,
                color_scheme TEXT,
                notes TEXT,
                user_data_dir TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_deleted BOOLEAN DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS profile_tags (
                profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
                tag TEXT NOT NULL,
                color TEXT,
                PRIMARY KEY (profile_id, tag)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS extensions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT,
                path TEXT NOT NULL,
                is_shared BOOLEAN DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profile_extensions (
                profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
                extension_id TEXT REFERENCES extensions(id) ON DELETE CASCADE,
                is_enabled BOOLEAN DEFAULT 1,
                PRIMARY KEY (profile_id, extension_id)
            );
        """)
        conn.commit()

        # Migrations for existing databases
        cols = {row[1] for row in conn.execute("PRAGMA table_info(profiles)").fetchall()}

        if "launch_args" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN launch_args TEXT DEFAULT '[]'")
            conn.commit()
        if "auto_launch" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN auto_launch BOOLEAN DEFAULT 0")
            conn.commit()
        if "last_run" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN last_run TEXT")
            conn.commit()
        if "is_deleted" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN is_deleted BOOLEAN DEFAULT 0")
            conn.commit()
            
        # Thực sự xóa cột vật lý không hoạt động khỏi database SQLite
        for old_col in (
            "canvas_noise", "client_rect_noise", "webgl_noise", "audio_noise",
            "webgl_meta_masked", "media_devices_masked", "media_audio_inputs",
            "media_audio_outputs", "media_video_inputs", "device_memory", "browser_brand",
            "clipboard_sync"
        ):
            if old_col in cols:
                try:
                    conn.execute(f"ALTER TABLE profiles DROP COLUMN {old_col}")
                except Exception as e:
                    logger.warning("Không thể xóa cột %s bằng ALTER TABLE DROP COLUMN: %s", old_col, e)
                    
        if "mac_address" in cols:
            try:
                conn.execute("ALTER TABLE profiles DROP COLUMN mac_address")
            except Exception as e:
                logger.warning("Không thể xóa cột mac_address bằng ALTER TABLE DROP COLUMN: %s", e)
        if "headless" in cols:
            try:
                conn.execute("ALTER TABLE profiles DROP COLUMN headless")
            except Exception as e:
                logger.warning("Không thể xóa cột headless bằng ALTER TABLE DROP COLUMN: %s", e)
                
        conn.execute("DELETE FROM settings WHERE key IN ('compression_mode', 'gpm_automate_path', 'license_key', 'storage_type')")
        conn.commit()


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def create_profile(
    name: str,
    fingerprint_seed: int | None = None,
    **fields: Any,
) -> dict[str, Any]:
    profile_id = str(uuid.uuid4())
    seed = fingerprint_seed if fingerprint_seed is not None else random.randint(10000, 99999)
    user_data_dir = str(get_profiles_dir() / profile_id)
    now = _now()
    tags = fields.pop("tags", None) or []

    with get_db() as conn:
        conn.execute(
            """INSERT INTO profiles (
                id, name, fingerprint_seed, proxy, timezone, locale, platform,
                user_agent, screen_width, screen_height, gpu_vendor, gpu_renderer,
                hardware_concurrency, humanize, human_preset, geoip,
                auto_launch, color_scheme, launch_args, notes,
                user_data_dir, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                profile_id, name, seed,
                fields.get("proxy"),
                fields.get("timezone"),
                fields.get("locale"),
                fields.get("platform", "windows"),
                fields.get("user_agent"),
                fields.get("screen_width", 1920),
                fields.get("screen_height", 1080),
                fields.get("gpu_vendor"),
                fields.get("gpu_renderer"),
                fields.get("hardware_concurrency"),
                fields.get("humanize", True),
                fields.get("human_preset", "default"),
                fields.get("geoip", True),
                fields.get("auto_launch", False),
                fields.get("color_scheme"),
                json.dumps(fields.get("launch_args") or []),
                fields.get("notes"),
                user_data_dir, now, now,
            ),
        )
        for t in tags:
            conn.execute(
                "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                (profile_id, t["tag"], t.get("color")),
            )
        conn.commit()

    return get_profile(profile_id)  # type: ignore[return-value]


def _get_profile_by_conn(conn, profile_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    if not row:
        return None
    profile = dict(row)
    profile["launch_args"] = json.loads(profile.get("launch_args") or "[]")
    profile["user_data_dir"] = str(get_profiles_dir() / profile_id)
    tags = conn.execute(
        "SELECT tag, color FROM profile_tags WHERE profile_id = ?",
        (profile_id,),
    ).fetchall()
    profile["tags"] = [dict(t) for t in tags]
    return profile


def get_profile(profile_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        return _get_profile_by_conn(conn, profile_id)


def list_profiles() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM profiles WHERE is_deleted = 0 ORDER BY created_at DESC").fetchall()
        profiles = []
        for row in rows:
            profile = dict(row)
            profile["launch_args"] = json.loads(profile.get("launch_args") or "[]")
            profile["user_data_dir"] = str(get_profiles_dir() / profile["id"])
            tags = conn.execute(
                "SELECT tag, color FROM profile_tags WHERE profile_id = ?",
                (profile["id"],),
            ).fetchall()
            profile["tags"] = [dict(t) for t in tags]
            profiles.append(profile)
        return profiles


def list_deleted_profiles() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM profiles WHERE is_deleted = 1 ORDER BY created_at DESC").fetchall()
        profiles = []
        for row in rows:
            profile = dict(row)
            profile["launch_args"] = json.loads(profile.get("launch_args") or "[]")
            profile["user_data_dir"] = str(get_profiles_dir() / profile["id"])
            tags = conn.execute(
                "SELECT tag, color FROM profile_tags WHERE profile_id = ?",
                (profile["id"],),
            ).fetchall()
            profile["tags"] = [dict(t) for t in tags]
            profiles.append(profile)
        return profiles


def soft_delete_profile(profile_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE profiles SET is_deleted = 1 WHERE id = ?",
            (profile_id,),
        )
        conn.commit()
        return cursor.rowcount > 0


def restore_profile(profile_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE profiles SET is_deleted = 0 WHERE id = ?",
            (profile_id,),
        )
        conn.commit()
        return cursor.rowcount > 0


def update_profile(profile_id: str, **fields: Any) -> dict[str, Any] | None:
    with get_db() as conn:
        existing = _get_profile_by_conn(conn, profile_id)
        if not existing:
            return None

        tags = fields.pop("tags", None)

        # Only update fields that were explicitly provided
        update_cols = []
        update_vals = []
        # Pre-serialize launch_args to JSON before the generic update loop
        if "launch_args" in fields:
            fields["launch_args"] = json.dumps(fields["launch_args"] or [])

        for col in (
            "name", "fingerprint_seed", "proxy", "timezone", "locale", "platform",
            "user_agent", "screen_width", "screen_height", "gpu_vendor", "gpu_renderer",
            "hardware_concurrency", "humanize", "human_preset", "geoip",
            "auto_launch", "color_scheme", "launch_args", "notes", "last_run",
        ):
            if col in fields:
                update_cols.append(f"{col} = ?")
                update_vals.append(fields[col])

        if update_cols:
            update_cols.append("updated_at = ?")
            update_vals.append(_now())
            update_vals.append(profile_id)
            conn.execute(
                f"UPDATE profiles SET {', '.join(update_cols)} WHERE id = ?",
                update_vals,
            )

        if tags is not None:
            conn.execute("DELETE FROM profile_tags WHERE profile_id = ?", (profile_id,))
            for t in tags:
                conn.execute(
                    "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                    (profile_id, t["tag"], t.get("color")),
                )
        conn.commit()
        return _get_profile_by_conn(conn, profile_id)


def delete_profile(profile_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        conn.commit()
        return cursor.rowcount > 0


def set_last_run(profile_id: str) -> None:
    """Update last_run timestamp for profile."""
    with get_db() as conn:
        conn.execute(
            "UPDATE profiles SET last_run = ? WHERE id = ?",
            (_now(), profile_id),
        )
        conn.commit()


def bulk_create_profiles(
    name_pattern: str,
    count: int,
    proxies: list[str],
    **fields: Any,
) -> list[dict[str, Any]]:
    created = []
    tags = fields.pop("tags", None) or []
    
    with get_db() as conn:
        for i in range(1, count + 1):
            name = name_pattern.replace("[NUM]", str(i)) if "[NUM]" in name_pattern else f"{name_pattern}_{i}"
            profile_id = str(uuid.uuid4())
            seed = random.randint(10000, 99999)
            user_data_dir = str(get_profiles_dir() / profile_id)
            now = _now()
            
            proxy = proxies[(i - 1) % len(proxies)] if proxies else None
            
            conn.execute(
                """INSERT INTO profiles (
                    id, name, fingerprint_seed, proxy, timezone, locale, platform,
                    user_agent, screen_width, screen_height, gpu_vendor, gpu_renderer,
                    hardware_concurrency, humanize, human_preset, geoip,
                    auto_launch, color_scheme, launch_args, notes,
                    user_data_dir, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    profile_id, name, seed,
                    proxy,
                    fields.get("timezone"),
                    fields.get("locale"),
                    fields.get("platform", "windows"),
                    fields.get("user_agent"),
                    fields.get("screen_width", 1920),
                    fields.get("screen_height", 1080),
                    fields.get("gpu_vendor"),
                    fields.get("gpu_renderer"),
                    fields.get("hardware_concurrency"),
                    fields.get("humanize", True),
                    fields.get("human_preset", "default"),
                    fields.get("geoip", True),
                    fields.get("auto_launch", False),
                    fields.get("color_scheme"),
                    json.dumps(fields.get("launch_args") or []),
                    fields.get("notes"),
                    user_data_dir, now, now,
                ),
            )
            for t in tags:
                conn.execute(
                    "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                    (profile_id, t["tag"], t.get("color")),
                )
            
            created.append({
                "id": profile_id,
                "name": name,
                "fingerprint_seed": seed,
                "proxy": proxy,
                "timezone": fields.get("timezone"),
                "locale": fields.get("locale"),
                "platform": fields.get("platform", "windows"),
                "user_agent": fields.get("user_agent"),
                "screen_width": fields.get("screen_width", 1920),
                "screen_height": fields.get("screen_height", 1080),
                "gpu_vendor": fields.get("gpu_vendor"),
                "gpu_renderer": fields.get("gpu_renderer"),
                "hardware_concurrency": fields.get("hardware_concurrency"),
                "humanize": fields.get("humanize", True),
                "human_preset": fields.get("human_preset", "default"),
                "geoip": fields.get("geoip", True),
                "auto_launch": fields.get("auto_launch", False),
                "color_scheme": fields.get("color_scheme"),
                "launch_args": fields.get("launch_args") or [],
                "notes": fields.get("notes"),
                "user_data_dir": user_data_dir,
                "created_at": now,
                "updated_at": now,
                "tags": tags,
            })
            
        conn.commit()
    return created


def get_setting(key: str, default: Any = None) -> str | None:
    """Get a configuration value from settings table."""
    with get_db() as conn:
        try:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else default
        except sqlite3.OperationalError:
            return default


def set_setting(key: str, value: str) -> None:
    """Save or update a configuration value in settings table."""
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )
        conn.commit()


def get_all_settings() -> dict[str, str]:
    """Retrieve all configuration settings."""
    with get_db() as conn:
        try:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            return {row["key"]: row["value"] for row in rows}
        except sqlite3.OperationalError:
            return {}


def get_profiles_dir() -> Path:
    """Get the active directory for browser profile user data."""
    path = get_setting("profile_path")
    if path:
        return Path(path)
    return DATA_DIR / "profiles"


def get_all_extensions() -> list[dict[str, Any]]:
    """Retrieve all registered extensions."""
    with get_db() as conn:
        rows = conn.execute("SELECT id, name, version, path, is_shared, created_at FROM extensions").fetchall()
        return [dict(row) for row in rows]


def create_extension(id: str, name: str, version: str | None, path: str, is_shared: bool = False) -> dict[str, Any]:
    """Register a new extension."""
    now = _now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO extensions (id, name, version, path, is_shared, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (id, name, version, path, 1 if is_shared else 0, now),
        )
        conn.commit()
    return {
        "id": id,
        "name": name,
        "version": version,
        "path": path,
        "is_shared": is_shared,
        "created_at": now,
    }


def delete_extension(ext_id: str) -> None:
    """Delete an extension registration."""
    with get_db() as conn:
        conn.execute("DELETE FROM extensions WHERE id = ?", (ext_id,))
        conn.commit()


def get_profile_extensions(profile_id: str) -> list[dict[str, Any]]:
    """Get extensions assigned to a profile, joined with extension details."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT e.id, e.name, e.version, e.path, e.is_shared, pe.is_enabled
            FROM profile_extensions pe
            JOIN extensions e ON pe.extension_id = e.id
            WHERE pe.profile_id = ?
            """,
            (profile_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def update_profile_extensions(profile_id: str, extensions: list[dict[str, Any]]) -> None:
    """Set the exact extensions and their states for a profile."""
    with get_db() as conn:
        # Delete old associations
        conn.execute("DELETE FROM profile_extensions WHERE profile_id = ?", (profile_id,))
        # Insert new associations
        for ext in extensions:
            conn.execute(
                "INSERT INTO profile_extensions (profile_id, extension_id, is_enabled) VALUES (?, ?, ?)",
                (profile_id, ext["id"], 1 if ext["is_enabled"] else 0),
            )
        conn.commit()


def toggle_profile_extension(profile_id: str, extension_id: str, is_enabled: bool) -> None:
    """Toggle a profile's extension enabled state."""
    with get_db() as conn:
        conn.execute(
            "UPDATE profile_extensions SET is_enabled = ? WHERE profile_id = ? AND extension_id = ?",
            (1 if is_enabled else 0, profile_id, extension_id),
        )
        conn.commit()


def bulk_update_profiles_extensions(profile_ids: list[str], extension_ids: list[str], mode: str) -> None:
    """Apply extensions to multiple profiles (append or overwrite)."""
    with get_db() as conn:
        if mode == "overwrite":
            for pid in profile_ids:
                conn.execute("DELETE FROM profile_extensions WHERE profile_id = ?", (pid,))
                for ext_id in extension_ids:
                    conn.execute(
                        "INSERT INTO profile_extensions (profile_id, extension_id, is_enabled) VALUES (?, ?, 1)",
                        (pid, ext_id),
                    )
        else:  # append
            for pid in profile_ids:
                for ext_id in extension_ids:
                    conn.execute(
                        "INSERT OR IGNORE INTO profile_extensions (profile_id, extension_id, is_enabled) VALUES (?, ?, 1)",
                        (pid, ext_id),
                    )
        conn.commit()

