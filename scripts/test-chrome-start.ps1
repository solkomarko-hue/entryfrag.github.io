
param(
  [string]$OutputDir = $(Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) "artifacts\baseline") (Get-Date -Format "yyyyMMdd-HHmmss"))
)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)
$baseUrl = "http://localhost:4782/"
$productId = "navi-2025-jersey"
$promoCode = "SIGNA"
$stubCity = "Kyiv"
$stubBranch = "Branch 1"
$script:ChromeSocket = $null
$script:CdpMessageId = 0
 $script:OwnedServerPowerShell = $null
 $script:OwnedServerAsync = $null
 $script:OwnedChromeProcess = $null

function Write-Step {
  param([string]$Message)
  Write-Host "[baseline] $Message"
}

function Find-ChromePath {
  foreach ($candidate in $chromeCandidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  throw "Chrome or Edge was not found in the expected install locations."
}

function Test-EntryfragServer {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $asyncConnect = $client.BeginConnect("127.0.0.1", 4782, $null, $null)
    if (-not $asyncConnect.AsyncWaitHandle.WaitOne(1500)) {
      $client.Close()
      return $false
    }
    $client.EndConnect($asyncConnect)
    $stream = $client.GetStream()
    $writer = New-Object System.IO.StreamWriter($stream)
    $writer.NewLine = "`r`n"
    $writer.WriteLine("GET / HTTP/1.1")
    $writer.WriteLine("Host: localhost:4782")
    $writer.WriteLine("Connection: close")
    $writer.WriteLine("")
    $writer.Flush()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    $client.Close()
    return $body -like "HTTP/1.1 200*"
  } catch {
    return $false
  }
}
function Start-EntryfragServer {
  if (Test-EntryfragServer) {
    Write-Step "Using the already running ENTRYFRAG server at $baseUrl"
    return
  }

  $orderLoggerScript = Join-Path $root "order-logger.ps1"
  if (-not (Test-Path $orderLoggerScript)) {
    throw "Missing order logger script: $orderLoggerScript"
  }

  Write-Step "Starting order logger at $baseUrl"
  $orderLoggerContent = Get-Content $orderLoggerScript -Raw
  $escapedRoot = $root.Replace("'", "''")
  $ps = [System.Management.Automation.PowerShell]::Create()
  [void]$ps.AddScript("$`PSScriptRoot = '$escapedRoot';" + [Environment]::NewLine + $orderLoggerContent)
  $async = $ps.BeginInvoke()
  $script:OwnedServerPowerShell = $ps
  $script:OwnedServerAsync = $async

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if (Test-EntryfragServer) {
      Write-Step "ENTRYFRAG server is ready"
      return
    }
    if ($async.IsCompleted) {
      $errorText = if ($ps.Streams.Error.Count) { ($ps.Streams.Error | ForEach-Object { $_.ToString() }) -join "; " } else { "order logger stopped before becoming ready" }
      throw "Order logger exited before becoming ready: $errorText"
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for the ENTRYFRAG server to start."
}

function Stop-EntryfragServer {
  if ($script:OwnedServerPowerShell) {
    Write-Step "Stopping the order logger started for the baseline run"
    try {
      $script:OwnedServerPowerShell.Stop()
    } catch {}
    try {
      $script:OwnedServerPowerShell.Dispose()
    } catch {}
    $script:OwnedServerPowerShell = $null
    $script:OwnedServerAsync = $null
  }
}

function Start-ChromeSession {
  param(
    [string]$ChromePath,
    [int]$Port
  )

  $profileDir = Join-Path $env:TEMP ("entryfrag-baseline-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

  Write-Step "Starting headless browser on port $Port"
  $script:OwnedChromeProcess = Start-Process $ChromePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profileDir",
    "about:blank"
  ) -PassThru

  $targetsUrl = "http://127.0.0.1:$Port/json/list"
  $deadline = (Get-Date).AddSeconds(15)
  $pageTarget = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $targets = Invoke-RestMethod -Uri $targetsUrl -TimeoutSec 2
      $pageTarget = $targets | Where-Object { $_.type -eq "page" -and $_.webSocketDebuggerUrl } | Select-Object -First 1
      if ($pageTarget) {
      Write-Step 'Page target candidate discovered'
        break
      }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }

  if (-not $pageTarget.webSocketDebuggerUrl) {
    throw "Timed out waiting for the browser page debugging endpoint."
  }

  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  Write-Step 'Preparing CDP websocket'
  $socket.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(20)
  $socket.ConnectAsync([Uri]$pageTarget.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $script:ChromeSocket = $socket
  Write-Step 'CDP websocket connected'
  $script:CdpMessageId = 0
  Write-Step 'CDP command completed: Page.enable'

  Write-Step 'CDP command completed: Runtime.enable'
  Invoke-Cdp -Method "Page.enable" | Out-Null
  Write-Step 'CDP command completed: Network.enable'
  Invoke-Cdp -Method "Runtime.enable" | Out-Null
  Write-Step 'CDP command completed: addScriptToEvaluateOnNewDocument'
  Invoke-Cdp -Method "Network.enable" | Out-Null
  Invoke-Cdp -Method "Page.addScriptToEvaluateOnNewDocument" -Params @{
    source = @"
(() => {
  const originalFetch = window.fetch.bind(window);
  window.__baseline = { confirms: [], alerts: [] };
  window.confirm = (message) => {
    window.__baseline.confirms.push(String(message || ""));
    return true;
  };
  window.alert = (message) => {
    window.__baseline.alerts.push(String(message || ""));
  };
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("https://api.novaposhta.ua/v2.0/json/")) {
      let payload = {};
      try {
        payload = JSON.parse(init?.body || "{}");
      } catch {}
      let data = [];
      if (payload.calledMethod === "getCities") {
        data = [{ Ref: "baseline-kyiv", Description: "Kyiv" }];
      } else if (payload.calledMethod === "getWarehouses") {
        data = [{ Description: "Branch 1" }];
      }
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(input, init);
  };
})();
"@
  } | Out-Null
}

function Stop-ChromeSession {
  if ($script:ChromeSocket) {
    try {
      $script:ChromeSocket.Dispose()
    } catch {}
    $script:ChromeSocket = $null
  }
  if ($script:OwnedChromeProcess -and -not $script:OwnedChromeProcess.HasExited) {
    Write-Step "Stopping the headless browser"
    Stop-Process -Id $script:OwnedChromeProcess.Id -Force
  }
}

function Receive-CdpMessage {
  if (-not $script:ChromeSocket) {
    throw "Chrome DevTools socket is not connected."
  }

  $buffer = New-Object byte[] 8192
  $builder = [System.Text.StringBuilder]::new()

  do {
    $segment = [ArraySegment[byte]]::new($buffer)
    $result = $script:ChromeSocket.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      throw "Chrome DevTools closed the WebSocket connection."
    }
    [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
  } while (-not $result.EndOfMessage)

  return $builder.ToString()
}

function Invoke-Cdp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,
    $Params = @{}
  )

  if (-not $script:ChromeSocket) {
    throw "Chrome DevTools socket is not connected."
  }

  $script:CdpMessageId += 1
  $messageId = $script:CdpMessageId
  $payload = @{
    id = $messageId
    method = $Method
    params = $Params
  }
  $json = $payload | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $script:ChromeSocket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  while ($true) {
    $rawMessage = Receive-CdpMessage
    if ([string]::IsNullOrWhiteSpace($rawMessage)) {
      continue
    }
    $response = $rawMessage | ConvertFrom-Json
    if ($response.id -ne $messageId) {
      continue
    }
    if ($response.error) {
      throw "$Method failed: $($response.error.message)"
    }
    return $response.result
  }
}

function Invoke-Js {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Expression,
    [switch]$AwaitPromise
  )

  $result = Invoke-Cdp -Method "Runtime.evaluate" -Params @{
    expression = $Expression
    awaitPromise = [bool]$AwaitPromise
    returnByValue = $true
    userGesture = $true
  }

  if ($result.exceptionDetails) {
    $detail = $result.exceptionDetails
    $message = if ($detail.exception -and $detail.exception.description) { $detail.exception.description } elseif ($detail.text) { $detail.text } else { "unknown browser exception" }
    throw "Browser evaluation failed: $message"
  }

  return $result.result.value
}

function Wait-ForCondition {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Expression,
    [int]$TimeoutMs = 10000,
    [int]$IntervalMs = 150,
    [string]$Description = "browser condition"
  )

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($stopwatch.ElapsedMilliseconds -lt $TimeoutMs) {
    try {
      $value = Invoke-Js -Expression $Expression
      if ($value) {
        return $true
      }
    } catch {}
    Start-Sleep -Milliseconds $IntervalMs
  }

  throw "Timed out waiting for $Description."
}

function Set-Viewport {
  param(
    [int]$Width,
    [int]$Height,
    [bool]$Mobile
  )

  Invoke-Cdp -Method "Emulation.setDeviceMetricsOverride" -Params @{
    width = $Width
    height = $Height
    deviceScaleFactor = 1
    mobile = $Mobile
  } | Out-Null
  Invoke-Cdp -Method "Emulation.setTouchEmulationEnabled" -Params @{
    enabled = $Mobile
    maxTouchPoints = 5
  } | Out-Null
}

function Open-Page {
  param([string]$Url)

  Invoke-Cdp -Method "Page.navigate" -Params @{ url = $Url } | Out-Null
  Wait-ForCondition -Expression "document.readyState === 'complete'" -Description "document ready state"
  Wait-ForCondition -Expression "document.querySelectorAll('.products .card').length > 0" -Description "catalog cards"
}

function Save-Screenshot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $capture = Invoke-Cdp -Method "Page.captureScreenshot" -Params @{
    format = "png"
    fromSurface = $true
  }
  [System.IO.File]::WriteAllBytes($Path, [Convert]::FromBase64String($capture.data))
}

function Get-Orders {
  $ordersPath = Join-Path $root "orders.json"
  if (-not (Test-Path $ordersPath)) {
    return @()
  }

  $raw = Get-Content $ordersPath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @()
  }

  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) {
    return $parsed
  }
  return @($parsed)
}

function Wait-ForOrderCount {
  param(
    [int]$MinimumCount,
    [int]$TimeoutMs = 10000
  )

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($stopwatch.ElapsedMilliseconds -lt $TimeoutMs) {
    $orders = Get-Orders
    if ($orders.Count -ge $MinimumCount) {
      return $orders
    }
    Start-Sleep -Milliseconds 200
  }

  throw "Timed out waiting for a new order to be written to orders.json."
}

try {
  $chromePath = Find-ChromePath
  Write-Step "Testing browser bootstrap"
  Start-EntryfragServer
  Start-ChromeSession -ChromePath $chromePath -Port 9333
  Write-Step "Chrome session is ready"
} finally {
  Stop-ChromeSession
  Stop-EntryfragServer
}
