# Script PowerShell tạo Desktop Shortcut cho CloakBrowser Manager
$ErrorActionPreference = "Stop"

# Lấy đường dẫn của thư mục hiện tại chứa script này
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}

# Xác định đường dẫn Desktop của người dùng hiện tại
$DesktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "CloakBrowser Manager.lnk")

# Tạo COM Object WScript.Shell để quản lý Shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($DesktopPath)

# Cấu hình các thông số Shortcut
$Shortcut.TargetPath = "$ScriptDir\run.bat"
$Shortcut.Arguments = ""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Khởi chạy ứng dụng CloakBrowser Manager"

# Lấy biểu tượng từ Microsoft Edge nếu có (để shortcut trông chuyên nghiệp)
$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $EdgePath) {
    $Shortcut.IconLocation = "$EdgePath,0"
} else {
    # Hoặc từ Chrome
    $ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (Test-Path $ChromePath) {
        $Shortcut.IconLocation = "$ChromePath,0"
    }
}

# Lưu shortcut
$Shortcut.Save()

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Đã tạo biểu tượng khởi chạy ngoài Desktop thành công! " -ForegroundColor Green
Write-Host " Tên Shortcut: CloakBrowser Manager.lnk " -ForegroundColor Green
Write-Host " Đường dẫn thư mục: $ScriptDir " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
