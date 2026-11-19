@echo off
rem DEVELOPMENT ONLY: rebuilds the app after changing the source code.
rem To USE the app you do not need this file: use iniciar.bat.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo This file is only for developers and needs Node.js installed on Windows.
  echo To use the app, open iniciar.bat.
  pause
  exit /b 1
)
set "PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "PNPM=corepack pnpm"
call %PNPM% install --frozen-lockfile
if errorlevel 1 call %PNPM% install
if errorlevel 1 goto failed
call %PNPM% build
if errorlevel 1 goto failed
echo.
echo Done. Use iniciar.bat to open the app.
pause
exit /b 0
:failed
echo Something went wrong. See the messages above.
pause
exit /b 1
