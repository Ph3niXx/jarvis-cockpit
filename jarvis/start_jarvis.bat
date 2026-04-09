@echo off
chcp 65001 > nul
echo ========================================
echo    JARVIS - Demarrage du systeme
echo ========================================
echo.

REM Set working directory to repo root
cd /d "%~dp0\.."

REM Set Supabase env vars if not already set
if "%SUPABASE_URL%"=="" (
  set SUPABASE_URL=https://mrmgptqpflzyavdfqwwv.supabase.co
)
if "%SUPABASE_KEY%"=="" (
  set SUPABASE_KEY=sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e
)
if "%SUPABASE_SERVICE_KEY%"=="" (
  echo   [!] SUPABASE_SERVICE_KEY non defini. Le snapshot ne sera pas upsert dans Supabase.
  echo       Definis-la avec: set SUPABASE_SERVICE_KEY=ta_cle_service_role
)
if "%ANTHROPIC_API_KEY%"=="" (
  echo   [!] ANTHROPIC_API_KEY non defini. Le mode Cloud ne sera pas disponible.
  echo       Definis-la avec: set ANTHROPIC_API_KEY=ta_cle_anthropic
)

REM 1. Verify LM Studio is running
echo [1/4] Verification de LM Studio...
curl -s -o nul -w "%%{http_code}" http://localhost:1234/v1/models > "%TEMP%\jarvis_lms.txt" 2>nul
set /p LMS_STATUS=<"%TEMP%\jarvis_lms.txt"
del "%TEMP%\jarvis_lms.txt" 2>nul

if not "%LMS_STATUS%"=="200" (
  echo.
  echo   [X] LM Studio n'est pas lance sur le port 1234.
  echo       Ouvre LM Studio et charge Qwen3.5 9B avant de relancer.
  echo.
  pause
  exit /b 1
)
echo       [OK] LM Studio detecte
echo.

REM 2. Check index freshness
echo [2/4] Verification de l'indexation...
python jarvis\check_index_freshness.py
set FRESHNESS=%ERRORLEVEL%

if %FRESHNESS% EQU 2 (
  echo.
  echo   [!] Erreur lors du check. Le serveur demarre quand meme.
  goto :start_tunnel
)

if %FRESHNESS% EQU 0 (
  echo.
  echo   [...] Indexation incrementale en arriere-plan...
  if not exist jarvis_data mkdir jarvis_data
  start /B "" python jarvis\indexer.py --incremental > jarvis_data\last_indexer.log 2>&1
  echo         Logs : jarvis_data\last_indexer.log
) else (
  echo.
  echo   [OK] Tout est deja indexe, rien a faire.
)

REM 2b. Generate project status snapshot
echo.
echo   [...] Generation du snapshot de statut en arriere-plan...
if not exist jarvis_data mkdir jarvis_data
start /B "" python jarvis\status_generator.py > jarvis_data\last_status_gen.log 2>&1
echo         Logs : jarvis_data\last_status_gen.log

:start_tunnel
echo.

REM 3. Launch Cloudflare Tunnel via Python helper
echo [3/4] Lancement du tunnel Cloudflare...
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo   [!] cloudflared n'est pas installe.
  echo       Installe-le avec : winget install cloudflare.cloudflared
  echo       Le serveur va demarrer en local uniquement.
  echo.
  goto :start_server
)

start /B "" python jarvis\start_tunnel.py
REM Give tunnel time to start and register URL
timeout /t 12 /nobreak >nul
echo.

:start_server
echo [4/4] Lancement du serveur Jarvis sur http://localhost:8765...
echo       Stop avec Ctrl+C
echo.
python jarvis\server.py

REM Cleanup: kill cloudflared on exit
taskkill /F /IM cloudflared.exe >nul 2>nul

echo.
echo [BYE] Jarvis arrete.
pause
