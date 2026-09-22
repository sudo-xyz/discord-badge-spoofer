@echo off
setlocal EnableDelayedExpansion
title Discord Badge Spoofer - Setup
cd /d "%~dp0"
cls

echo.
echo   ============================================================
echo      DISCORD BADGE SPOOFER  -  SETUP
echo   ============================================================
echo.
echo   [*] Checking for Node.js...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js is not installed or not in PATH.
    echo   [!] Please install Node.js 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODEV=%%v
echo   [+] Node.js found: !NODEV!
echo.

echo   [*] Installing dependencies...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   [!] npm install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo   ============================================================
echo      DEPENDENCIES INSTALLED
echo      LAUNCHING DISCORD BADGE SPOOFER...
echo   ============================================================
echo.
echo   Press CTRL+C at any time to exit.
echo.

timeout /t 3 /nobreak >nul

node index.js

echo.
echo   ============================================================
echo      SESSION ENDED
echo   ============================================================
echo.
pause
