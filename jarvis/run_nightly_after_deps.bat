@echo off
REM Wait for indexer + status generator to finish, then run nightly learner.
REM Called by start_jarvis.bat in background.

:wait_loop
if exist jarvis_data\.indexer_done (
    if exist jarvis_data\.status_done goto :run_nightly
)
timeout /t 5 /nobreak >nul
goto :wait_loop

:run_nightly
del jarvis_data\.indexer_done jarvis_data\.status_done 2>nul
echo [%date% %time%] Nightly learner demarre (deps OK)
python jarvis\nightly_learner.py > jarvis_data\last_nightly_learner.log 2>&1
echo [%date% %time%] Nightly learner termine (code=%errorlevel%)

echo [%date% %time%] Activity brief (yesterday) demarre...
python -c "import sys,os;sys.path.insert(0,os.path.join('jarvis'));from observers.daily_brief_generator import generate_brief;r=generate_brief();print(r['status'])" > jarvis_data\last_activity_brief.log 2>&1
echo [%date% %time%] Activity brief termine (code=%errorlevel%)

echo [%date% %time%] Extraction signaux internes demarre...
python jarvis\scripts\extract_signals.py > jarvis_data\last_extract_signals.log 2>&1
echo [%date% %time%] Extraction signaux terminee (code=%errorlevel%)
