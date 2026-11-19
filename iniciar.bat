@echo off
rem Le jardin de Melina - starts the app (Windows). Window messages are in French (no accents, for console safety).
rem Needs only Node.js 22.13+ (installed on Windows OR portable inside the "runtime" folder).
chcp 65001 >nul
cd /d "%~dp0"
title Le jardin de Melina

set "NODE_EXE="
if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"
if not defined NODE_EXE for /d %%D in ("%~dp0runtime\node-v*") do if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%P in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%P"
if not defined NODE_EXE goto sem_node

"%NODE_EXE%" -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)"
if errorlevel 1 goto node_antigo

if not exist "apps\server\dist\server.mjs" goto sem_app
if not exist "apps\game\dist\index.html" goto sem_app

echo Ouverture de Le jardin de Melina...
set "MELINA_OPEN_BROWSER=1"
"%NODE_EXE%" --disable-warning=ExperimentalWarning "apps\server\dist\server.mjs"
if errorlevel 1 goto erro
goto fim

:sem_node
echo.
echo  Node.js est introuvable sur cet ordinateur.
echo  L'application en a besoin pour fonctionner. Choisissez UNE des options :
echo.
echo  OPTION 1 - Installer (le plus simple)
echo    1. Ouvrez https://nodejs.org et telechargez la version LTS pour Windows.
echo    2. Installez avec les options par defaut.
echo    3. Ouvrez iniciar.bat de nouveau.
echo.
echo  OPTION 2 - Sans rien installer dans Windows (portable)
echo    1. Sur https://nodejs.org/fr/download, telechargez le "Windows Binary (.zip)" x64.
echo    2. Extrayez le contenu du zip dans : %~dp0runtime
echo       (il doit exister runtime\node-v...\node.exe ou runtime\node.exe)
echo    3. Ouvrez iniciar.bat de nouveau.
echo.
pause
exit /b 1

:node_antigo
echo.
echo  Le Node.js trouve est trop ancien :
"%NODE_EXE%" --version
echo  L'application a besoin de Node.js 22.13 ou plus recent. Mettez-le a jour sur https://nodejs.org
echo.
pause
exit /b 1

:sem_app
echo.
echo  Fichiers de l'application introuvables (apps\server\dist ou apps\game\dist).
echo  Le dossier de l'application semble incomplet. Voir le README.md.
echo.
pause
exit /b 1

:erro
echo.
echo  L'application s'est arretee avec une erreur. Lisez le message ci-dessus et la section
echo  "Troubleshooting" du README.md.
echo.
pause
exit /b 1

:fim
