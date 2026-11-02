@echo off
chcp 936 >nul
title 上传到 GitHub
cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [x] 这里不是 git 仓库，确认双击的是 class-memory 文件夹里的这个 bat。
  echo.
  pause
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo.
  echo   还没有远程仓库。把 GitHub 仓库地址粘贴到下面，回车。
  echo.
  set /p REPO=  仓库地址: 
  if "%REPO%"=="" (
    echo   [x] 没输入地址，退出。
    pause
    exit /b 1
  )
  git remote add origin "%REPO%"
)

for /f "delims=" %%a in ('git remote get-url origin') do echo   远程地址：%%a

echo.
echo   正在推送……
echo   注：网络不稳时会自动重试，最多 25 次，别关窗口。
echo.

set /a TRY=0

:PUSH
set /a TRY+=1
git push -u origin main
if not errorlevel 1 goto DONE
if %TRY% GEQ 25 goto FAIL
echo   第 %TRY% 次没连上，2 秒后重试……
ping -n 3 127.0.0.1 >nul
goto PUSH

:DONE
echo.
echo  ============================================
echo   搞定！刷新 GitHub 页面就能看到代码了。
echo  ============================================
echo.
pause
exit /b 0

:FAIL
echo.
echo  --------------------------------------------------
echo   [x] 试了 25 次都没连上。
echo.
echo   1. 换个时间再试（这个网络会间歇性掐连接）
echo   2. 验证连接：  ssh -T git@github.com
echo      看到 "Hi 用户名!" 就是通了
echo   3. 检查公钥：https://github.com/settings/keys
echo  --------------------------------------------------
echo.
pause
exit /b 1