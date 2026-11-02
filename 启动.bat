@echo off
chcp 936 >nul
title 课堂记忆库
cd /d "%~dp0"

if not exist "node_modules\vite" (
  echo.
  echo   第一次运行，正在装依赖，可能要几分钟……
  call npm install
  if errorlevel 1 (
    echo.
    echo   [x] 装依赖失败。先确认装了 Node.js：node -v
    pause
    exit /b 1
  )
)

set PORT=5173

rem 如果上次的窗口没关，端口还占着，Vite 会换到 5174，二维码就失效了。
rem 所以这里先把占用者结束掉，保证永远开在 5173。
set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do set PID=%%a
if defined PID (
  echo.
  echo   端口 %PORT% 被占用（PID %PID%），大概是上次的窗口没关。
  echo   正在关掉它，保证还是原来的地址……
  taskkill /PID %PID% /F >nul 2>&1
  ping -n 2 127.0.0.1 >nul
)

echo.
echo   ============================================
echo     课堂记忆库 正在启动
echo   ============================================
echo.
echo   电脑上打开：  http://localhost:%PORT%
echo   手机上扫码：  项目里的 二维码.png
echo.
echo   *** 这个窗口别关，关了服务就停 ***
echo.

start "" cmd /c "ping -n 4 127.0.0.1 >nul && start http://localhost:%PORT%"

call npm run dev

echo.
echo   服务已停止。
pause