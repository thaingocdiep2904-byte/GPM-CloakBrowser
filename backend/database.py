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
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                fingerprint_seed INTEGER NOT NULL,
                proxy TEXT,
                timezone TEXT,
                locale TEXT,
                platform TEXT DEFAULT 'windows',
                user_agent TEXT,
                screen_width INTEGER DEFAULT 1920,
                screen_height INTEGER DEFAULT 1080,
                gpu_vendor TEXT,
                gpu_renderer TEXT,
                hardware_concurrency INTEGER,
                humanize BOOLEAN DEFAULT 1,
                human_preset TEXT DEFAULT 'default',
                headless BOOLEAN DEFAULT 0,
                geoip BOOLEAN DEFAULT 1,
                clipboard_sync BOOLEAN DEFAULT 1,
                auto_launch BOOLEAN DEFAULT 0,
                color_scheme TEXT,
                notes TEXT,
                user_data_dir TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                canvas_noise TEXT DEFAULT 'off',
                client_rect_noise TEXT DEFAULT 'off',
                webgl_noise TEXT DEFAULT 'off',
                audio_noise TEXT DEFAULT 'on',
                webgl_meta_masked BOOLEAN DEFAULT 1,
                media_devices_masked BOOLEAN DEFAULT 1,
                media_audio_inputs INTEGER DEFAULT 2,
                media_audio_outputs INTEGER DEFAULT 1,
                media_video_inputs INTEGER DEFAULT 0,
                device_memory INTEGER DEFAULT 4,
                mac_address TEXT,
                browser_brand TEXT,
                storage_quota INTEGER
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
        """)
        conn.commit()

        # Migrations for existing databases
        cols = {row[1] for row in conn.execute("PRAGMA table_info(profiles)").fetchall()}
        if "clipboard_sync" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN clipboard_sync BOOLEAN DEFAULT 1")
            conn.commit()
        if "launch_args" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN launch_args TEXT DEFAULT '[]'")
            conn.commit()
        if "auto_launch" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN auto_launch BOOLEAN DEFAULT 0")
            conn.commit()
        if "last_run" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN last_run TEXT")
            conn.commit()
            
        # Hardware fingerprints migrations
        if "canvas_noise" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN canvas_noise TEXT DEFAULT 'off'")
        if "client_rect_noise" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN client_rect_noise TEXT DEFAULT 'off'")
        if "webgl_noise" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN webgl_noise TEXT DEFAULT 'off'")
        if "audio_noise" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN audio_noise TEXT DEFAULT 'on'")
        if "webgl_meta_masked" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN webgl_meta_masked BOOLEAN DEFAULT 1")
        if "media_devices_masked" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN media_devices_masked BOOLEAN DEFAULT 1")
        if "media_audio_inputs" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN media_audio_inputs INTEGER DEFAULT 2")
        if "media_audio_outputs" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN media_audio_outputs INTEGER DEFAULT 1")
        if "media_video_inputs" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN media_video_inputs INTEGER DEFAULT 0")
        if "device_memory" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN device_memory INTEGER DEFAULT 4")
        if "mac_address" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN mac_address TEXT")
        if "browser_brand" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN browser_brand TEXT")
        if "storage_quota" not in cols:
            conn.execute("ALTER TABLE profiles ADD COLUMN storage_quota INTEGER")
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
                hardware_concurrency, humanize, human_preset, headless, geoip,
                clipboard_sync, auto_launch, color_scheme, launch_args, notes,
                user_data_dir, created_at, updated_at,
                canvas_noise, client_rect_noise, webgl_noise, audio_noise,
                webgl_meta_masked, media_devices_masked, media_audio_inputs,
                media_audio_outputs, media_video_inputs, device_memory, mac_address,
                browser_brand, storage_quota
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                fields.get("headless", False),
                fields.get("geoip", True),
                fields.get("clipboard_sync", True),
                fields.get("auto_launch", False),
                fields.get("color_scheme"),
                json.dumps(fields.get("launch_args") or []),
                fields.get("notes"),
                user_data_dir, now, now,
                fields.get("canvas_noise", "off"),
                fields.get("client_rect_noise", "off"),
                fields.get("webgl_noise", "off"),
                fields.get("audio_noise", "on"),
                fields.get("webgl_meta_masked", True),
                fields.get("media_devices_masked", True),
                fields.get("media_audio_inputs", 2),
                fields.get("media_audio_outputs", 1),
                fields.get("media_video_inputs", 0),
                fields.get("device_memory", 4),
                fields.get("mac_address"),
                fields.get("browser_brand"),
                fields.get("storage_quota"),
            ),
        )
        for t in tags:
            conn.execute(
                "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                (profile_id, t["tag"], t.get("color")),
            )
        conn.commit()

    return get_profile(profile_id)  # type: ignore[return-value]


def get_profile(profile_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            return None
        profile = dict(row)
        profile["launch_args"] = json.loads(profile.get("launch_args") or "[]")
        tags = conn.execute(
            "SELECT tag, color FROM profile_tags WHERE profile_id = ?",
            (profile_id,),
        ).fetchall()
        profile["tags"] = [dict(t) for t in tags]
        return profile


def list_profiles() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM profiles ORDER BY created_at DESC").fetchall()
        profiles = []
        for row in rows:
            profile = dict(row)
            profile["launch_args"] = json.loads(profile.get("launch_args") or "[]")
            tags = conn.execute(
                "SELECT tag, color FROM profile_tags WHERE profile_id = ?",
                (profile["id"],),
            ).fetchall()
            profile["tags"] = [dict(t) for t in tags]
            profiles.append(profile)
        return profiles


def update_profile(profile_id: str, **fields: Any) -> dict[str, Any] | None:
    existing = get_profile(profile_id)
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
        "hardware_concurrency", "humanize", "human_preset", "headless", "geoip",
        "clipboard_sync", "auto_launch", "color_scheme", "launch_args", "notes", "last_run",
        "canvas_noise", "client_rect_noise", "webgl_noise", "audio_noise",
        "webgl_meta_masked", "media_devices_masked", "media_audio_inputs",
        "media_audio_outputs", "media_video_inputs", "device_memory", "mac_address",
        "browser_brand", "storage_quota",
    ):
        if col in fields:
            update_cols.append(f"{col} = ?")
            update_vals.append(fields[col])

    if update_cols:
        update_cols.append("updated_at = ?")
        update_vals.append(_now())
        update_vals.append(profile_id)
        with get_db() as conn:
            conn.execute(
                f"UPDATE profiles SET {', '.join(update_cols)} WHERE id = ?",
                update_vals,
            )
            conn.commit()

    if tags is not None:
        with get_db() as conn:
            conn.execute("DELETE FROM profile_tags WHERE profile_id = ?", (profile_id,))
            for t in tags:
                conn.execute(
                    "INSERT INTO profile_tags (profile_id, tag, color) VALUES (?, ?, ?)",
                    (profile_id, t["tag"], t.get("color")),
                )
            conn.commit()

    return get_profile(profile_id)


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
                    hardware_concurrency, humanize, human_preset, headless, geoip,
                    clipboard_sync, auto_launch, color_scheme, launch_args, notes,
                    user_data_dir, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                    fields.get("headless", False),
                    fields.get("geoip", True),
                    fields.get("clipboard_sync", True),
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
                "headless": fields.get("headless", False),
                "geoip": fields.get("geoip", True),
                "clipboard_sync": fields.get("clipboard_sync", True),
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

