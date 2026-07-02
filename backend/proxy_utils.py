import httpx
import asyncio

def parse_proxy_string(proxy_str: str) -> str:
    proxy_str = proxy_str.strip()
    if "://" in proxy_str:
        return proxy_str
    
    parts = proxy_str.split(":")
    if len(parts) == 2:
        host, port = parts
        return f"http://{host}:{port}"
    elif len(parts) == 4:
        host, port, user, password = parts
        return f"http://{user}:{password}@{host}:{port}"
    
    return f"http://{proxy_str}"

async def check_proxy_connection(proxy_str: str) -> dict:
    is_direct = not proxy_str or not proxy_str.strip() or proxy_str == "direct"
    
    try:
        url = "http://ip-api.com/json/?fields=status,message,countryCode,query"
        
        if is_direct:
            # Ket noi truc tiep khong qua proxy
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(url)
        else:
            parsed_url = parse_proxy_string(proxy_str)
            proxies = {
                "all://": parsed_url
            }
            async with httpx.AsyncClient(proxies=proxies, timeout=8.0) as client:
                response = await client.get(url)
                
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                return {
                    "status": "direct" if is_direct else "live",
                    "ip": data.get("query"),
                    "country": data.get("countryCode"),
                    "error": None
                }
            else:
                return {
                    "status": "dead",
                    "ip": "-",
                    "country": None,
                    "error": data.get("message", "IP API error")
                }
        else:
            return {
                "status": "dead",
                "ip": "-",
                "country": None,
                "error": f"HTTP status {response.status_code}"
            }
    except Exception as e:
        return {
            "status": "dead",
            "ip": "-",
            "country": None,
            "error": str(e)
        }


def arrange_windows_grid(profile_names: list[str]) -> int:
    import os
    if os.name != "nt":
        return 0
        
    import ctypes
    from ctypes import wintypes
    import math

    User32 = ctypes.windll.user32
    EnumWindows = User32.EnumWindows
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    GetWindowText = User32.GetWindowTextW
    GetWindowTextLength = User32.GetWindowTextLengthW
    IsWindowVisible = User32.IsWindowVisible
    MoveWindow = User32.MoveWindow

    hwnds = []

    def enum_cb(hwnd, lparam):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLength(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buf, length + 1)
                title = buf.value
                for name in profile_names:
                    if name in title and ("Chromium" in title or "Chrome" in title or "Cloak" in title):
                        hwnds.append(hwnd)
                        break
        return True

    EnumWindows(EnumWindowsProc(enum_cb), 0)

    if not hwnds:
        return 0

    num_windows = len(hwnds)
    cols = int(math.ceil(math.sqrt(num_windows)))
    rows = int(math.ceil(num_windows / cols))

    screen_w = User32.GetSystemMetrics(0)
    screen_h = User32.GetSystemMetrics(1) - 40  # taskbar offset

    win_w = screen_w // cols
    win_h = screen_h // rows

    arranged = 0
    for idx, hwnd in enumerate(hwnds):
        r = idx // cols
        c = idx % cols
        x = c * win_w
        y = r * win_h
        MoveWindow(hwnd, x, y, win_w, win_h, True)
        arranged += 1

    return arranged
