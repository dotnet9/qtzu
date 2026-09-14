@echo off
rem Q淘族本地开发服务器（默认端口 6000）：打开 http://localhost:6000/
cd /d "%~dp0"
where node >nul 2>nul && (
  start "" http://localhost:6000/
  node scripts\serve.js 6000
) || (
  where python >nul 2>nul && python scripts\serve.py 6000 || echo 需要先安装 Node.js 或 Python
)
pause
