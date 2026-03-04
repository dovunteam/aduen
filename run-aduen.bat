@echo off
setlocal

cd /d "%~dp0app"

if "%~1"=="" goto dev
if /i "%~1"=="dev" goto dev
if /i "%~1"=="test" goto test
if /i "%~1"=="lint" goto lint
if /i "%~1"=="build" goto build
if /i "%~1"=="e2e" goto e2e
if /i "%~1"=="pilot-score" goto pilot-score
if /i "%~1"=="verify" goto verify

echo Usage: run-aduen.bat [dev^|test^|lint^|build^|e2e^|pilot-score^|verify]
exit /b 1

:dev
echo Starting Aduen development server and opening the local page...
npm run dev -- --open
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

:pilot-score
if "%~2"=="" (
  echo Usage: run-aduen.bat pilot-score "C:\path\to\anonymised-case-log.csv" [--operator-rate=RM/hour] [--institution-commitment=yes]
  exit /b 1
)
npm run score:pilot -- "%~2" %~3 %~4
exit /b %errorlevel%

:verify
call npm run check:encoding
if errorlevel 1 exit /b %errorlevel%
call npm run check:docs
if errorlevel 1 exit /b %errorlevel%
call "%~f0" lint
if errorlevel 1 exit /b %errorlevel%
call "%~f0" test
if errorlevel 1 exit /b %errorlevel%
call "%~f0" build
if errorlevel 1 exit /b %errorlevel%
call "%~f0" e2e
exit /b %errorlevel%
