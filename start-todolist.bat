@echo off
title TodoList Launcher

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
