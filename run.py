import os
import sys
import subprocess
import time
import shutil
from pathlib import Path
import webbrowser

# Dinh nghia cac duong dan chinh
ROOT_DIR = Path(__file__).parent.resolve()
DATA_DIR = ROOT_DIR / "data"
VENV_DIR = ROOT_DIR / ".venv"
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

# Thiet lap bien moi truong DATA_DIR cho backend
os.environ["DATA_DIR"] = str(DATA_DIR)

def print_banner(text):
    print("=" * 60)
    print(f" >>> {text} <<<")
    print("=" * 60)

def find_browser():
    # Tim kiem Microsoft Edge
    edge_paths = [
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in edge_paths:
        if os.path.exists(p):
            return p, "edge"
            
    # Tim kiem Google Chrome neu khong co Edge
    chrome_paths = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    for p in chrome_paths:
        if os.path.exists(p):
            return p, "chrome"
            
    return None, None

def setup_environment():
    print_banner("1. THIET LAP MOI TRUONG PYTHON")
    
    # Tao thu muc data neu chua co
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "profiles").mkdir(parents=True, exist_ok=True)
    
    # Kiem tra venv
    if not VENV_DIR.exists():
        print(f"Dang tao moi truong ao Python (.venv) tai: {VENV_DIR}...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        print("Da tao moi truong ao thanh cong.")
        
        pip_path = VENV_DIR / "Scripts" / "pip.exe"
        python_path = VENV_DIR / "Scripts" / "python.exe"
        
        print("Dang cap nhat pip...")
        subprocess.run([str(python_path), "-m", "pip", "install", "--upgrade", "pip"], check=True)
        
        print("Dang cai dat cac thu vien backend tu requirements.txt...")
        subprocess.run([str(pip_path), "install", "-r", str(BACKEND_DIR / "requirements.txt")], check=True)
        
        # Cai dat CloakBrowser tu thu muc cuc bo
        local_cloak_path = ROOT_DIR.parent / "CloakBrowser"
        if local_cloak_path.exists():
            print(f"Dang cai dat CloakBrowser tu ma nguon cuc bo tai: {local_cloak_path}...")
            subprocess.run([str(pip_path), "install", "-e", str(local_cloak_path)], check=True)
        else:
            print("Khong tim thay ma nguon CloakBrowser cuc bo. Dang cai dat tu PyPI...")
            subprocess.run([str(pip_path), "install", "cloakbrowser[geoip]"], check=True)
            
        print("Dang kiem tra va tai nhi phan CloakBrowser Chromium (neu chua co)...")
        # Goi python trong venv de chay ensure_binary()
        subprocess.run([
            str(python_path), "-c", 
            "from cloakbrowser.download import ensure_binary; ensure_binary()"
        ], check=True)
        print("Tai nhi phan CloakBrowser thanh cong.")
    else:
        print("Moi truong ao Python (.venv) da ton tai. Bo qua thiet lap lai de khoi dong nhanh.")

def setup_frontend():
    print_banner("2. BIEN DICH GIAO DIEN REACT FRONTEND")
    
    dist_dir = FRONTEND_DIR / "dist"
    if dist_dir.exists():
        print("Thu muc build frontend da ton tai. Bo qua buoc build de tiet kiem thoi gian.")
        print("Neu muon build lai, vui long xoa thu muc 'frontend/dist' roi chay lai script nay.")
        return
        
    print("Dang cai dat thu vien frontend (npm install)...")
    # Chay qua cmd.exe de tranh chinh sach han che thuc thi script cua PowerShell
    subprocess.run("cmd.exe /c npm install", cwd=str(FRONTEND_DIR), shell=True, check=True)
    
    print("Dang bien dich frontend (npm run build)...")
    subprocess.run("cmd.exe /c npm run build", cwd=str(FRONTEND_DIR), shell=True, check=True)
    print("Bien dich frontend thanh cong.")

def main():
    try:
        setup_environment()
        setup_frontend()
    except subprocess.CalledProcessError as e:
        print(f"\n[LOI] Qua trinh thiet la that bai: {e}")
        input("Nhan Enter de thoat...")
        sys.exit(1)
        
    print_banner("3. KHOI CHAY CLOAKBROWSER MANAGER")
    
    python_path = VENV_DIR / "Scripts" / "python.exe"
    
    # Khoi chay FastAPI backend
    print("Dang khoi dong FastAPI backend (Uvicorn)...")
    log_file_path = DATA_DIR / "backend.log"
    # Mo file log ghi log tu backend
    log_file = open(log_file_path, "a", encoding="utf-8")
    
    # Ghi log ngan cach cho lan chay moi
    log_file.write(f"\n=== NEW LAUNCH AT {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
    log_file.flush()
    
    backend_proc = subprocess.Popen(
        [
            str(python_path), "-m", "uvicorn", "backend.main:app",
            "--host", "127.0.0.1", "--port", "8080", "--log-level", "info"
        ],
        cwd=str(ROOT_DIR),
        stdout=log_file,
        stderr=log_file
    )
    
    # Doi backend khoi dong
    print("Dang cho backend san sang...")
    time.sleep(3)
    
    browser_bin, browser_type = find_browser()
    app_url = "http://localhost:8080"
    
    browser_proc = None
    if browser_bin:
        print(f"Dang mo giao dien quan ly bang {browser_type.upper()} o che do App...")
        # Tao profile Edge/Chrome tam thoi de chay app doc lap
        profile_dir = DATA_DIR / "manager-browser-profile"
        profile_dir.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            browser_bin,
            f"--app={app_url}",
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check"
        ]
        
        browser_proc = subprocess.Popen(cmd)
        print("Giao dien da hien thi. Vui long khong tat cua so Terminal nay.")
        print("Khi ban dong ung dung quan ly, he thong se tu dong tat sach tien trinh backend.")
        
        # Doi cua so trinh duyet quan ly dong
        try:
            start_wait = time.time()
            browser_proc.wait(timeout=3)
            # Neu no thoat trong vong duoi 3 giay, trinh duyet da chuyen sang instance dang chay khac
            if time.time() - start_wait < 3:
                print("Trinh duyet da chuyen giao dien sang cua so hien tai.")
                print("\n" + "=" * 60)
                print(" Ung dung dang chay tai: http://localhost:8080")
                print(" Nhan ENTER tai day de tat toan bo ung dung va don dep tien trinh.")
                print("=" * 60)
                try:
                    input()
                except KeyboardInterrupt:
                    pass
            else:
                print("\nDa phat hien dong giao dien quan ly.")
        except subprocess.TimeoutExpired:
            # Neu sau 3 giay trinh duyet van chay (che do App hoat dong thuc su)
            try:
                browser_proc.wait()
                print("\nDa phat hien dong giao dien quan ly.")
            except KeyboardInterrupt:
                print("\nDa nhan tin hieu dung (Ctrl+C).")
    else:
        print("Khong tim thay Edge hoac Chrome. Dang mo giao dien bang trinh duyet mac dinh...")
        webbrowser.open(app_url)
        print("\n" + "=" * 60)
        print(" Ung dung dang chay tai: http://localhost:8080")
        print(" Nhan ENTER tai day de tat toan bo ung dung va don dep tien trinh.")
        print("=" * 60)
        try:
            input()
        except KeyboardInterrupt:
            pass
            
    # Don dep: Tat backend FastAPI
    print("Dang tat FastAPI backend...")
    backend_proc.terminate()
    try:
        backend_proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        backend_proc.kill()
    
    # Dong file log backend
    try:
        log_file.close()
    except Exception:
        pass
        
    print("Da tat toan bo ung dung thanh cong.")
    time.sleep(1)

if __name__ == "__main__":
    main()
