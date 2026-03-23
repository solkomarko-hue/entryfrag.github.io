@echo off
setlocal
set "SITE_URL=http://localhost:4782/"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%SITE_URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "%SITE_URL%"
  endlocal
  exit /b 0
)

call "%~dp0start-order-logger.cmd"
call "%~dp0start-telegram-bot.cmd"
echo Waiting for ENTRYFRAG local server...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; 1..30 | %% { try { Invoke-WebRequest -Uri '%SITE_URL%' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; $ready=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo ENTRYFRAG server did not start on %SITE_URL%
  echo Check the ENTRYFRAG Order Logger window for the exact error.
  exit /b 1
)
start "" "%SITE_URL%"
endlocal
