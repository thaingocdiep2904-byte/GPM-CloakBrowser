@echo off
title CloakBrowser Manager Launcher
cd /d "%~dp0"
echo Khoi chay CloakBrowser Manager...
python run.py
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Ung dung gap su co va da bi dung.
    pause
)
