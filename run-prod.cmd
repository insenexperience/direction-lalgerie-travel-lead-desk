@echo off
REM Build + serveur Next.js en mode production (port 3000 par defaut).
cd /d "%~dp0"
call npm run build
if errorlevel 1 exit /b 1
call npm run start
