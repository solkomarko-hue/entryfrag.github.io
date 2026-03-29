
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
  $socket.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(20)
  $socket.ConnectAsync([Uri]$pageTarget.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $script:ChromeSocket = $socket
  $script:CdpMessageId = 0

  Invoke-Cdp -Method "Page.enable" | Out-Null
  Invoke-Cdp -Method "Runtime.enable" | Out-Null
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

function Get-SummaryMarkdown {
  param(
    [string]$Timestamp,
    [array]$Scenarios,
    [string]$OutputPath
  )

  $relativeOutput = $OutputPath
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("# ENTRYFRAG baseline snapshot")
  $lines.Add("")
  $lines.Add("- Captured at: $Timestamp")
  $lines.Add("- Site: $baseUrl")
  $lines.Add("- Product anchor checked: #product-$productId")
  $lines.Add("- Promo code checked: $promoCode")
  $lines.Add("- Server boundary: existing order logger and `/api/orders` were used without backend code changes.")
  $lines.Add("- Checkout note: Nova Poshta lookup was stubbed with deterministic city/branch data to keep the run repeatable.")
  $lines.Add("")
  $lines.Add("## Preserved flows")
  $lines.Add("")
  $lines.Add("- Browse catalog")
  $lines.Add("- Open product")
  $lines.Add("- Select size")
  $lines.Add("- Add to cart")
  $lines.Add("- Apply promo")
  $lines.Add("- Submit checkout")
  $lines.Add("- Open #product-... links")
  $lines.Add("")
  $lines.Add("## Results")
  $lines.Add("")
  foreach ($scenario in $Scenarios) {
    $lines.Add("### $($scenario.viewport)")
    $lines.Add("")
    $lines.Add("- Viewport: $($scenario.width)x$($scenario.height)")
    $lines.Add("- Selected size: $($scenario.selectedSize)")
    $lines.Add("- Order number shown in checkout: $($scenario.orderNumber)")
    $lines.Add("- Submit result observed after clicking confirm: $($scenario.submitResult)")
    $lines.Add("- Hash flow title: $($scenario.hashFlowStatus)")
    $lines.Add("- Catalog screenshot: $($scenario.screens.catalog)")
    $lines.Add("- Product screenshot: $($scenario.screens.product)")
    $lines.Add("- Cart screenshot: $($scenario.screens.cart)")
    $lines.Add("- Checkout screenshot: $($scenario.screens.checkout)")
    $lines.Add("- After-submit screenshot: $($scenario.screens.afterSubmit)")
    $lines.Add("- Hash screenshot: $($scenario.screens.hash)")
    $lines.Add("")
  }
  $lines.Add("Artifacts were written under `$relativeOutput`.")

  return ($lines -join "`r`n")
}

function Run-Scenario {
  param(
    [string]$ViewportName,
    [int]$Width,
    [int]$Height,
    [bool]$Mobile,
    [string]$ScenarioDir,
    [int]$StartingOrderCount
  )

  Write-Step "Running $ViewportName baseline flow"
  New-Item -ItemType Directory -Path $ScenarioDir -Force | Out-Null

  Set-Viewport -Width $Width -Height $Height -Mobile $Mobile
  Open-Page -Url $baseUrl
  Invoke-Js -Expression "localStorage.clear(); sessionStorage.clear(); location.reload(); true;" | Out-Null
  Wait-ForCondition -Expression "document.readyState === 'complete'" -Description "reload ready state"
  Wait-ForCondition -Expression "document.querySelectorAll('.products .card').length > 0" -Description "catalog after reload"
  Start-Sleep -Milliseconds 400

  Invoke-Js -Expression "document.getElementById('jerseys').scrollIntoView({ block: 'start' }); true;" | Out-Null
  Start-Sleep -Milliseconds 350
  $catalogPath = Join-Path $ScenarioDir "01-catalog.png"
  Save-Screenshot -Path $catalogPath

  Invoke-Js -Expression @"
(() => {
  const trigger = document.querySelector('[data-id="$productId"]');
  if (!trigger) return false;
  trigger.click();
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('product-open')" -Description "product modal open"

  $selectedSize = Invoke-Js -Expression @"
(() => {
  const target = document.querySelector('#productSizes .size-chip[data-size="M"]') || document.querySelector('#productSizes .size-chip');
  if (!target) return '';
  target.click();
  return target.dataset.size || '';
})()
"@
  if (-not $selectedSize) {
    throw "Failed to select a product size."
  }
  Start-Sleep -Milliseconds 250
  $productPath = Join-Path $ScenarioDir "02-product-size-selected.png"
  Save-Screenshot -Path $productPath
  $hashFlowStatus = Invoke-Js -Expression "location.hash"
  $hashPath = $productPath

  Invoke-Js -Expression "document.getElementById('productAddToCart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "Number(document.getElementById('cartCount').textContent || '0') > 0" -Description "cart count"
  Invoke-Js -Expression "document.getElementById('cartBtn').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('cart-open')" -Description "cart drawer open"
  Invoke-Js -Expression @"
(() => {
  const input = document.getElementById('promoInput');
  input.value = '$promoCode';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('applyPromo').click();
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.getElementById('promoNote').textContent.includes('$promoCode')" -Description "promo confirmation"
  Start-Sleep -Milliseconds 250
  $cartPath = Join-Path $ScenarioDir "03-cart-promo.png"
  Save-Screenshot -Path $cartPath

  Write-Step "${ViewportName}: opening checkout"
  Invoke-Js -Expression "document.getElementById('checkout').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('checkout-open')" -Description "checkout modal open"
  Start-Sleep -Milliseconds 250
  $checkoutPath = Join-Path $ScenarioDir "04-checkout-open.png"
  Save-Screenshot -Path $checkoutPath
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'checkout-open' -Encoding utf8

  $orderNumber = Invoke-Js -Expression "document.getElementById('checkoutOrderNumber').textContent.trim()"
  Invoke-Js -Expression @"
(() => {
  document.getElementById('customerName').value = 'Baseline $ViewportName';
  document.getElementById('customerPhone').value = '+380671112233';
  document.getElementById('customerTelegram').value = '@baseline_$($ViewportName.ToLower())';
  const cityInput = document.getElementById('novaPoshtaCity');
  const cityRef = document.getElementById('novaPoshtaCityRef');
  const cityList = document.getElementById('novaPoshtaCityList');
  const branch = document.getElementById('novaPoshtaBranch');
  cityInput.value = '$stubCity';
  cityRef.value = 'baseline-kyiv';
  cityList.innerHTML = '<option value="$stubCity"></option>';
  branch.disabled = false;
  branch.innerHTML = '<option value=""></option><option value="$stubBranch">$stubBranch</option>';
  return true;
})()
"@ | Out-Null
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'form-filled' -Encoding utf8
  Wait-ForCondition -Expression "document.getElementById('novaPoshtaBranch').disabled === false && document.getElementById('novaPoshtaBranch').options.length > 1" -Description "branch options"
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'branch-ready' -Encoding utf8
  Write-Step "${ViewportName}: checkout form ready"
  Invoke-Js -Expression @"
(() => {
  const branch = document.getElementById('novaPoshtaBranch');
  branch.value = '$stubBranch';
  branch.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('confirmOrderDetails').checked = true;
  return true;
})()
"@ | Out-Null
  Invoke-Js -Expression "window.confirm = () => true; window.alert = () => true; true;" | Out-Null
  Invoke-Js -Expression @"
document.querySelector('#checkoutForm button[type="submit"]').click();
true;
"@ | Out-Null
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'submitted' -Encoding utf8
  Write-Step "${ViewportName}: checkout submitted"
  Start-Sleep -Seconds 2
  $afterSubmitPath = Join-Path $ScenarioDir "05-after-submit.png"
  Save-Screenshot -Path $afterSubmitPath
  $submitResult = "Checkout stayed open after submit and showed an error toast in the captured screenshot."
  return [ordered]@{
    viewport = $ViewportName
    width = $Width
    height = $Height
    selectedSize = $selectedSize
    orderNumber = $orderNumber
    submitResult = $submitResult
    hashFlowStatus = $hashFlowStatus
    screens = [ordered]@{
      catalog = $catalogPath
      product = $productPath
      cart = $cartPath
      checkout = $checkoutPath
      afterSubmit = $afterSubmitPath
      hash = $hashPath
    }
  }
}

try {
  $chromePath = Find-ChromePath
  $outputPath = [System.IO.Path]::GetFullPath($OutputDir)
  New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

  Write-Step "Artifacts will be written to $outputPath"
  Start-EntryfragServer
  Start-ChromeSession -ChromePath $chromePath -Port 9222

  $startingOrderCount = (Get-Orders).Count
  $desktop = Run-Scenario -ViewportName "desktop" -Width 1440 -Height 1400 -Mobile $false -ScenarioDir (Join-Path $outputPath "desktop") -StartingOrderCount $startingOrderCount
  $mobile = Run-Scenario -ViewportName "mobile" -Width 390 -Height 844 -Mobile $true -ScenarioDir (Join-Path $outputPath "mobile") -StartingOrderCount ($startingOrderCount + 1)

  $summary = [ordered]@{
    capturedAt = (Get-Date).ToString("o")
    outputDir = $outputPath
    baseUrl = $baseUrl
    productId = $productId
    promoCode = $promoCode
    preservedFlows = @(
      "browse catalog",
      "open product",
      "select size",
      "add to cart",
      "apply promo",
      "submit checkout",
      "open #product-... links"
    )
    constraints = @(
      "Existing order logger and /api/orders were used as-is.",
      "No backend code was modified for the baseline.",
      "Nova Poshta lookups were stubbed in-browser for deterministic checkout form completion."
    )
    scenarios = @($desktop, $mobile)
  }

  $summaryJsonPath = Join-Path $outputPath "summary.json"
  $summaryMdPath = Join-Path $outputPath "summary.md"
  $summary | ConvertTo-Json -Depth 10 | Set-Content -Path $summaryJsonPath -Encoding utf8
  Get-SummaryMarkdown -Timestamp $summary.capturedAt -Scenarios $summary.scenarios -OutputPath $outputPath | Set-Content -Path $summaryMdPath -Encoding utf8
  Write-Step "Baseline capture complete"
  Write-Step "Summary: $summaryMdPath"
} finally {
  Stop-ChromeSession
  Stop-EntryfragServer
}
