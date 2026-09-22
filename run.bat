@echo off
rem Q-Tao-Zu local dev server (default port 6100).
rem NOTE: keep this file ASCII-only. cmd.exe reads .bat in the system codepage (GBK on
rem Chinese Windows), and UTF-8 Chinese comments contain trailing bytes like 0x5C / 0x7C
rem which cmd misreads as command separators.
rem serve.js falls back to the next free port when 6100 is taken, and --open opens the
rem ACTUAL port (do not hardcode the URL here, or it will open a dead address).
cd /d "%~dp0"
where node >nul 2>nul && (
  node scripts\serve.js 6100 --open
) || (
  where python >nul 2>nul && python scripts\serve.py 6100 || echo Node.js or Python is required
)
pause
