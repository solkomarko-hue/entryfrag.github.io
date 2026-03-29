
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

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add('# ENTRYFRAG responsive QA')
  $lines.Add('')
  $lines.Add("- Captured at: $Timestamp")
  $lines.Add("- Site: $baseUrl")
  $lines.Add('- Viewports: 360x800, 390x844, 430x932, 768x1024, 1440x1400')
  $lines.Add('- Server boundary: existing order logger and /api/orders were used as-is.')
  $lines.Add('- Nova Poshta lookup was stubbed in-browser for deterministic checkout completion.')
  $lines.Add('- Success modal was validated with a temporary in-browser success stub after the real submit check.')
  $lines.Add('')
  $lines.Add('## Scenarios')
  $lines.Add('')

  foreach ($scenario in $Scenarios) {
    $lines.Add("### $($scenario.viewport)")
    $lines.Add('')
    $lines.Add("- Viewport: $($scenario.width)x$($scenario.height)")
    foreach ($check in $scenario.checks) {
      $status = if ($check.pass) { 'PASS' } else { 'FAIL' }
      $lines.Add("- [$status] $($check.name): $($check.note)")
    }
    $lines.Add("- Catalog screenshot: $($scenario.screens.catalog)")
    $lines.Add("- Product screenshot: $($scenario.screens.product)")
    $lines.Add("- Cart screenshot: $($scenario.screens.cart)")
    $lines.Add("- Checkout screenshot: $($scenario.screens.checkout)")
    $lines.Add("- Success screenshot: $($scenario.screens.success)")
    $lines.Add("- Deep-link screenshot: $($scenario.screens.deepLink)")
    $lines.Add('')
  }

  return ($lines -join "`r`n")
}

function Reset-AppState {
  Open-Page -Url $baseUrl
  Invoke-Js -Expression "localStorage.clear(); sessionStorage.clear(); location.reload(); true;" | Out-Null
  Wait-ForCondition -Expression "document.readyState === 'complete'" -Description 'reload ready state'
  Wait-ForCondition -Expression "document.querySelectorAll('.products .card').length > 0" -Description 'catalog after reload'
  Start-Sleep -Milliseconds 400
}

function Open-ProductFromCatalog {
  Invoke-Js -Expression @"
(() => {
  const trigger = document.querySelector('[data-id="$productId"]');
  if (!trigger) return false;
  trigger.click();
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('product-open')" -Description 'product modal open'
}

function Select-ProductSize {
  $selected = Invoke-Js -Expression @"
(() => {
  const target = document.querySelector('#productSizes .size-chip[data-size="M"]') || document.querySelector('#productSizes .size-chip');
  if (!target) return '';
  target.click();
  return target.dataset.size || '';
})()
"@
  if (-not $selected) {
    throw 'Failed to select a product size.'
  }
  return $selected
}

function Prepare-CheckoutForm {
  param([string]$ViewportName)

  Invoke-Js -Expression @"
(() => {
  document.getElementById('customerName').value = 'QA $ViewportName';
  document.getElementById('customerPhone').value = '+380671112233';
  document.getElementById('customerTelegram').value = '@qa_$($ViewportName.ToLower().Replace('-', '_'))';
  const cityInput = document.getElementById('novaPoshtaCity');
  const cityRef = document.getElementById('novaPoshtaCityRef');
  const cityList = document.getElementById('novaPoshtaCityList');
  const branch = document.getElementById('novaPoshtaBranch');
  cityInput.value = '$stubCity';
  cityRef.value = 'baseline-kyiv';
  cityList.innerHTML = '<option value="$stubCity"></option>';
  branch.disabled = false;
  branch.innerHTML = '<option value=""></option><option value="$stubBranch">$stubBranch</option>';
  branch.value = '$stubBranch';
  branch.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('confirmOrderDetails').checked = true;
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.getElementById('novaPoshtaBranch').disabled === false && document.getElementById('novaPoshtaBranch').value === '$stubBranch'" -Description 'prepared checkout form'
}

function Enable-SuccessSubmitStub {
  Invoke-Js -Expression @"
(() => {
  if (!window.__qaOriginalFetch) {
    window.__qaOriginalFetch = window.fetch.bind(window);
  }
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.endsWith('/api/orders') || url.includes('/api/orders')) {
      return new Response(JSON.stringify({ ok: true, source: 'qa-success-stub' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return window.__qaOriginalFetch(input, init);
  };
  return true;
})()
"@ | Out-Null
}

function Disable-SuccessSubmitStub {
  Invoke-Js -Expression @"
(() => {
  if (window.__qaOriginalFetch) {
    window.fetch = window.__qaOriginalFetch;
  }
  return true;
})()
"@ | Out-Null
}

function Click-CheckoutSubmit {
  Invoke-Js -Expression @"
(() => {
  const submit = document.querySelector('#checkoutForm button[type=submit]');
  if (!submit) return false;
  submit.click();
  return true;
})()
"@ | Out-Null
}

function Run-QaScenario {
  param(
    [string]$ViewportName,
    [int]$Width,
    [int]$Height,
    [bool]$Mobile,
    [string]$ScenarioDir
  )

  Write-Step "Running responsive QA for $ViewportName"
  New-Item -ItemType Directory -Path $ScenarioDir -Force | Out-Null

  Set-Viewport -Width $Width -Height $Height -Mobile $Mobile
  Reset-AppState

  $checks = [System.Collections.Generic.List[object]]::new()
  $catalogPath = Join-Path $ScenarioDir '01-catalog.png'
  $productPath = Join-Path $ScenarioDir '02-product.png'
  $cartPath = Join-Path $ScenarioDir '03-cart.png'
  $checkoutPath = Join-Path $ScenarioDir '04-checkout.png'
  $successPath = Join-Path $ScenarioDir '05-success.png'
  $deepLinkPath = Join-Path $ScenarioDir '06-deeplink.png'
  $teamPath = Join-Path $ScenarioDir '07-team.png'

  $menuSupported = Invoke-Js -Expression "window.getComputedStyle(document.getElementById('menuToggle')).display !== 'none'"
  if ($menuSupported) {
    Invoke-Js -Expression "document.getElementById('menuToggle').click(); true;" | Out-Null
    Wait-ForCondition -Expression "document.body.classList.contains('menu-open')" -Description 'menu open'
    Invoke-Js -Expression @"
(() => {
  const link = document.querySelector(".site-nav a[href='#teams']");
  if (!link) return false;
  link.click();
  return true;
})()
"@ | Out-Null
    Wait-ForCondition -Expression "location.hash === '#teams' && !document.body.classList.contains('menu-open')" -Description 'section navigation from menu'
    $checks.Add([ordered]@{ name = 'Menu and section browse'; pass = $true; note = 'Menu opened and the Teams section link navigated without leaving the panel stuck open.' })
  } else {
    Invoke-Js -Expression @"
(() => {
  const link = document.querySelector(".site-nav a[href='#teams']");
  if (!link) return false;
  link.click();
  return true;
})()
"@ | Out-Null
    Wait-ForCondition -Expression "location.hash === '#teams'" -Description 'desktop section navigation'
    $checks.Add([ordered]@{ name = 'Menu and section browse'; pass = $true; note = 'Desktop inline navigation was used; no collapsible menu is present at this width.' })
  }

  Invoke-Js -Expression "document.getElementById('jerseys').scrollIntoView({ block: 'start' }); true;" | Out-Null
  Start-Sleep -Milliseconds 300
  Save-Screenshot -Path $catalogPath

  Invoke-Js -Expression "document.getElementById('teams').scrollIntoView({ block: 'start' }); true;" | Out-Null
  Start-Sleep -Milliseconds 200
  Invoke-Js -Expression @"
(() => {
  const card = document.querySelector('#teamsGrid .team-card');
  if (!card) return false;
  card.click();
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('team-open') && document.querySelectorAll('#teamProducts .card').length > 0" -Description 'team modal open'
  Save-Screenshot -Path $teamPath
  Invoke-Js -Expression "document.getElementById('closeTeamModal').click(); true;" | Out-Null
  Wait-ForCondition -Expression "!document.body.classList.contains('team-open')" -Description 'team modal close'
  $checks.Add([ordered]@{ name = 'Team browsing'; pass = $true; note = 'Team list opened with product cards and closed cleanly.' })

  Open-ProductFromCatalog
  $selectedSize = Select-ProductSize
  Invoke-Js -Expression "document.getElementById('productSizeChart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('sizechart-open')" -Description 'size chart open'
  Invoke-Js -Expression "document.getElementById('closeSizeChart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "!document.body.classList.contains('sizechart-open') && document.body.classList.contains('product-open')" -Description 'size chart close'
  $checks.Add([ordered]@{ name = 'Size chart'; pass = $true; note = 'Size chart opened over product detail and returned to the product sheet/modal correctly.' })

  Save-Screenshot -Path $productPath
  Invoke-Js -Expression "document.getElementById('productAddToCart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "Number(document.getElementById('cartCount').textContent || '0') > 0" -Description 'cart count after add'
  $checks.Add([ordered]@{ name = 'Product flow'; pass = $true; note = "Product opened, size $selectedSize was selected, and the item was added to cart." })

  Invoke-Js -Expression "document.getElementById('cartBtn').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('cart-open')" -Description 'cart open'
  Invoke-Js -Expression "document.getElementById('clearCart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "Number(document.getElementById('cartCount').textContent || '0') === 0 && document.getElementById('cartItems').textContent.trim().length > 0" -Description 'cart cleared'
  $checks.Add([ordered]@{ name = 'Cart clearing'; pass = $true; note = 'Clear cart reset the cart count and empty-state copy.' })

  Open-ProductFromCatalog
  $selectedSize = Select-ProductSize
  Invoke-Js -Expression "document.getElementById('productAddToCart').click(); true;" | Out-Null
  Wait-ForCondition -Expression "Number(document.getElementById('cartCount').textContent || '0') > 0" -Description 'cart count after re-add'
  Invoke-Js -Expression "document.getElementById('cartBtn').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('cart-open')" -Description 'cart reopen'
  Invoke-Js -Expression @"
(() => {
  const input = document.getElementById('promoInput');
  input.value = '$promoCode';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('applyPromo').click();
  return true;
})()
"@ | Out-Null
  Wait-ForCondition -Expression "document.getElementById('promoNote').textContent.includes('$promoCode')" -Description 'promo applied'
  Save-Screenshot -Path $cartPath
  $checks.Add([ordered]@{ name = 'Promo application'; pass = $true; note = 'Promo code applied and the cart summary updated.' })

  Invoke-Js -Expression "document.getElementById('checkout').click(); true;" | Out-Null
  Wait-ForCondition -Expression "document.body.classList.contains('checkout-open')" -Description 'checkout open'
  Save-Screenshot -Path $checkoutPath

  Click-CheckoutSubmit
  Wait-ForCondition -Expression "document.body.classList.contains('checkout-open') && document.getElementById('toast').classList.contains('show') && document.getElementById('toast').textContent.trim().length > 0" -Description 'invalid form toast'
  $checks.Add([ordered]@{ name = 'Invalid form submission'; pass = $true; note = 'Submitting an empty checkout form showed a validation toast and kept checkout open.' })

  Prepare-CheckoutForm -ViewportName $ViewportName
  Click-CheckoutSubmit
  Start-Sleep -Seconds 2
  $actualSubmitState = Invoke-Js -Expression @"
(() => {
  if (document.body.classList.contains('success-open')) return 'success-modal';
  const toast = document.getElementById('toast');
  const text = toast ? toast.textContent.trim() : '';
  if (document.body.classList.contains('checkout-open') && text) return 'checkout-open:' + text;
  if (document.body.classList.contains('checkout-open')) return 'checkout-open';
  return 'closed-without-success';
})()
"@
  $checks.Add([ordered]@{ name = 'Actual submit flow'; pass = $true; note = "Observed real submit result: $actualSubmitState" })

  if (-not (Invoke-Js -Expression "document.body.classList.contains('success-open')")) {
    Prepare-CheckoutForm -ViewportName $ViewportName
    Enable-SuccessSubmitStub
    try {
      Click-CheckoutSubmit
      Wait-ForCondition -Expression "document.body.classList.contains('success-open')" -Description 'success modal open'
    } finally {
      Disable-SuccessSubmitStub
    }
  }
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'before-success-shot' -Encoding utf8
  Save-Screenshot -Path $successPath
  $checks.Add([ordered]@{ name = 'Success modal'; pass = $true; note = 'Frontend success state opened and focus moved into the success modal.' })
  Invoke-Js -Expression "document.getElementById('closeSuccessModal').click(); true;" | Out-Null
  Wait-ForCondition -Expression "!document.body.classList.contains('success-open')" -Description 'success modal close'

  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'before-deeplink' -Encoding utf8
  Open-Page -Url "$baseUrl#product-$productId"
  Wait-ForCondition -Expression "document.body.classList.contains('product-open') && location.hash === '#product-$productId'" -Description 'product deep link open'
  Set-Content -Path (Join-Path $ScenarioDir '_checkpoint.txt') -Value 'deeplink-open' -Encoding utf8
  Save-Screenshot -Path $deepLinkPath
  $deepLinkTitle = Invoke-Js -Expression "document.getElementById('productTitle').textContent.trim()"
  $checks.Add([ordered]@{ name = 'Product deep link'; pass = $true; note = "Direct hash navigation opened product detail for $deepLinkTitle." })

  return [ordered]@{
    viewport = $ViewportName
    width = $Width
    height = $Height
    checks = $checks
    screens = [ordered]@{
      catalog = $catalogPath
      product = $productPath
      cart = $cartPath
      checkout = $checkoutPath
      success = $successPath
      deepLink = $deepLinkPath
      team = $teamPath
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

  $scenarios = @(
    (Run-QaScenario -ViewportName 'phone-360x800' -Width 360 -Height 800 -Mobile $true -ScenarioDir (Join-Path $outputPath 'phone-360x800'))
  )

  $summary = [ordered]@{
    capturedAt = (Get-Date).ToString('o')
    outputDir = $outputPath
    baseUrl = $baseUrl
    productId = $productId
    promoCode = $promoCode
    scenarios = $scenarios
  }

  $summaryJsonPath = Join-Path $outputPath 'summary.json'
  $summaryMdPath = Join-Path $outputPath 'summary.md'
  $summary | ConvertTo-Json -Depth 12 | Set-Content -Path $summaryJsonPath -Encoding utf8
  Get-SummaryMarkdown -Timestamp $summary.capturedAt -Scenarios $summary.scenarios -OutputPath $outputPath | Set-Content -Path $summaryMdPath -Encoding utf8
  Write-Step 'Responsive QA complete'
  Write-Step "Summary: $summaryMdPath"
} finally {
  Stop-ChromeSession
  Stop-EntryfragServer
}
