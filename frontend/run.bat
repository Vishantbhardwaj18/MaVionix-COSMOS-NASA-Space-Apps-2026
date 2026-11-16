@echo off
rem Start COSMOS on Windows: API on :8000, website on :3000.
rem   run.bat          live mode (asks NASA/IPAC IRSA and JPL; needs internet)
rem   run.bat demo     sample mode (no internet needed; everything is labelled synthetic)
rem   run.bat check    test that this computer can reach the SPHEREx archive, then exit
setlocal
cd /d "%~dp0"
set MODE=%1
if "%MODE%"=="" set MODE=live

where python >nul 2>nul || (echo Python 3.11+ is required: https://www.python.org/downloads/ & exit /b 1)
where node >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & exit /b 1)

if not exist backend\.venv (
  echo == Setting up Python, first run only ==
  python -m venv backend\.venv || exit /b 1
  backend\.venv\Scripts\python -m pip install --quiet --upgrade pip
  backend\.venv\Scripts\pip install --quiet -r backend\requirements.txt || exit /b 1
)
if "%MODE%"=="check" (
  cd backend
  .venv\Scripts\python scripts\verify_irsa.py 270 66.56
  exit /b %errorlevel%
)
if not exist frontend\node_modules (
  echo == Installing the website's packages, first run only ==
  pushd frontend & call npm ci --no-audit --no-fund & popd
)
if not exist frontend\.next\BUILD_ID (
  echo == Building the website ==
  pushd frontend & call npm run build & popd
)

set COSMOS_MODE=live
if "%MODE%"=="demo" set COSMOS_MODE=demo
set COSMOS_API_URL=http://localhost:8000
echo == Starting the API in %COSMOS_MODE% mode on http://localhost:8000 ==
start "COSMOS API" /d backend cmd /c ".venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
echo == Starting the website on http://localhost:3000 ==
echo    Open http://localhost:3000 in a browser. Close both windows to stop.
cd frontend
call npx next start -p 3000
