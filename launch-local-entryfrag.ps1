$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$orderScript = Join-Path $root "order-logger.ps1"
$telegramScript = Join-Path $root "telegram-bot-listener.ps1"
$siteUrl = "http://localhost:4782/"

function Test-EntryfragServer {
  try {
    Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

Write-Host "Starting ENTRYFRAG local services..."

if (Test-EntryfragServer) {
  Write-Host "ENTRYFRAG server is already running."
  Start-Process $siteUrl
  exit 0
}

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", $telegramScript
) | Out-Null

$orderProcess = Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", $orderScript
) -PassThru

Write-Host "Telegram listener opened in a separate window."
Write-Host "Order logger started under launcher control."
Write-Host "Waiting for local server before opening the browser..."
Write-Host ""

$ready = $false
1..40 | ForEach-Object {
  if (Test-EntryfragServer) {
    $ready = $true
    break
  }
  if ($orderProcess.HasExited) {
    Write-Host "Order logger process stopped unexpectedly with exit code: $($orderProcess.ExitCode)"
    break
  }
  Write-Host "Still waiting for http://localhost:4782/ ..."
  Start-Sleep -Seconds 1
}

if ($ready) {
  Write-Host "ENTRYFRAG is running at $siteUrl"
  Start-Process $siteUrl
} else {
  Write-Host "ENTRYFRAG server did not start on $siteUrl"
  Write-Host "Check the ENTRYFRAG Order Logger window for the exact error."
}
