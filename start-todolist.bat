@echo off
title TodoList Launcher

rem 前端在 frontend/ 子目录里。用 %~dp0（本脚本所在目录）定位，
rem 这样从桌面快捷方式启动也能工作，不受快捷方式「起始位置」影响。
cd /d "%~dp0frontend"

rem If the dev server is already running, just open the browser.
curl -s -o NUL --max-time 2 http://localhost:5173 && goto open

rem Otherwise start it in a separate minimized window.
start "TodoList Dev Server" /min cmd /c "npm run dev"

rem Poll until it responds (up to ~30s).
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
curl -s -o NUL --max-time 2 http://localhost:5173 && goto open
set /a tries+=1
if %tries% lss 30 goto wait

:open
start "" http://localhost:5173
exit /b
