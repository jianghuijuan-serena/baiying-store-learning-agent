@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install it, then run this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4180/ in your browser.
node server.mjs
if errorlevel 1 pause
