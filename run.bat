@echo off
rem Q淘族本地开发服务器（默认端口 6100）：打开 http://localhost:6100/
cd /d "%~dp0"
where node >nul 2>nul && (
  start "" http://localhost:6100/
  node scripts\serve.js 6100
) || (
  where python >nul 2>nul && python scripts\serve.py 6100 || echo 需要先安装 Node.js 或 Python
)
pause
