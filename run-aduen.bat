@echo off
setlocal

cd /d "%~dp0app"

if "%~1"=="" goto dev
if /i "%~1"=="dev" goto dev
if /i "%~1"=="test" goto test
if /i "%~1"=="lint" goto lint
if /i "%~1"=="build" goto build
if /i "%~1"=="e2e" goto e2e
if /i "%~1"=="verify" goto verify

echo Usage: run-aduen.bat [dev^|test^|lint^|build^|e2e^|verify]
exit /b 1

:dev
echo Starting Aduen development server...
npm run dev
exit /b %errorlevel%

:test
npm test
exit /b %errorlevel%

:lint
npm run lint
exit /b %errorlevel%

:build
npm run build
exit /b %errorlevel%

:e2e
npm run test:e2e
exit /b %errorlevel%

:verify
call "%~f0" lint
if errorlevel 1 exit /b %errorlevel%
call "%~f0" test
if errorlevel 1 exit /b %errorlevel%
call "%~f0" build
if errorlevel 1 exit /b %errorlevel%
call "%~f0" e2e
exit /b %errorlevel%
