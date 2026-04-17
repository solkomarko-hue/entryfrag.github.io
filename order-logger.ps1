$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::Expect100Continue = $false
try {
  [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
} catch {}

function Load-EnvFile {
  param([string]$Path)

  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()
    $result[$key] = $value
  }

  return $result
}

function Get-ConfigValue {
  param(
    [hashtable]$Config,
    [string]$Name
  )

  $processValue = [System.Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue.Trim()
  }

  if ($Config.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($Config[$Name])) {
    return $Config[$Name]
  }

  return ""
}

$port = 4782
$siteRoot = $PSScriptRoot
$ordersFile = Join-Path $PSScriptRoot "orders.json"
$managerChatFile = Join-Path $PSScriptRoot "telegram-manager-chat.txt"
$appConfig = Load-EnvFile -Path (Join-Path $PSScriptRoot ".env")
$telegramBotToken = Get-ConfigValue -Config $appConfig -Name "TELEGRAM_BOT_TOKEN"
$telegramFallbackChatId = Get-ConfigValue -Config $appConfig -Name "TELEGRAM_CHAT_ID"
$telegramApiBase = if ($telegramBotToken) { "https://api.telegram.org/bot$telegramBotToken" } else { "" }

function Ensure-OrdersFile {
  if (-not (Test-Path $ordersFile)) {
    "[]" | Out-File -FilePath $ordersFile -Encoding utf8
  }
}

function Read-Orders {
  Ensure-OrdersFile
  $content = Get-Content $ordersFile -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($content)) {
    return @()
  }
  return $content | ConvertFrom-Json
}

function Write-Orders($orders) {
  $orders | ConvertTo-Json -Depth 6 | Out-File -FilePath $ordersFile -Encoding utf8
}

function Append-Order($order) {
  $orders = Read-Orders
  $orders += $order
  Write-Orders $orders
}

function Remove-Order {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OrderNumber
  )

  $orders = Read-Orders
  $filtered = @($orders | Where-Object { $_.orderNumber -ne $OrderNumber })
  if ($filtered.Count -eq $orders.Count) {
    return $false
  }
  Write-Orders $filtered
  return $true
}

function Update-OrderRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OriginalOrderNumber,
    [Parameter(Mandatory = $true)]
    [psobject]$UpdatedOrder
  )

  $orders = @()
  foreach ($entry in (Read-Orders)) {
    $orders += $entry
  }

  $existingIndex = -1
  for ($i = 0; $i -lt $orders.Count; $i++) {
    if ([string]$orders[$i].orderNumber -eq $OriginalOrderNumber) {
      $existingIndex = $i
      break
    }
  }

  if ($existingIndex -lt 0) {
    return @{ Error = "order_not_found" }
  }

  $nextOrderNumber = [string]$UpdatedOrder.orderNumber
  if ([string]::IsNullOrWhiteSpace($nextOrderNumber)) {
    return @{ Error = "missing_order_number" }
  }

  for ($i = 0; $i -lt $orders.Count; $i++) {
    if ($i -ne $existingIndex -and [string]$orders[$i].orderNumber -eq $nextOrderNumber.Trim()) {
      return @{ Error = "duplicate_order_number" }
    }
  }

  $merged = @{}
  foreach ($property in $orders[$existingIndex].PSObject.Properties) {
    $merged[$property.Name] = $property.Value
  }
  foreach ($property in $UpdatedOrder.PSObject.Properties) {
    $merged[$property.Name] = $property.Value
  }
  $merged["orderNumber"] = $nextOrderNumber.Trim()

  $orders[$existingIndex] = [pscustomobject]$merged
  Write-Orders $orders
  return @{ Order = $orders[$existingIndex] }
}

function Get-ManagerChatId {
  if (Test-Path $managerChatFile) {
    $chatId = (Get-Content $managerChatFile -Raw).Trim()
    if (-not [string]::IsNullOrWhiteSpace($chatId)) {
      return $chatId
    }
  }
  return $telegramFallbackChatId
}

function Get-ContentType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    ".svg" { return "image/svg+xml" }
    default { return "application/octet-stream" }
  }
}

function Send-HttpResponse {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.Sockets.TcpClient]$Client,
    [Parameter(Mandatory = $true)]
    [int]$StatusCode,
    [byte[]]$BodyBytes = @(),
    [string]$ContentType = "application/json; charset=utf-8"
  )

  $stream = $Client.GetStream()
  $statusText = switch ($StatusCode) {
    200 { "OK" }
    204 { "No Content" }
    400 { "Bad Request" }
    404 { "Not Found" }
    500 { "Internal Server Error" }
    502 { "Bad Gateway" }
    503 { "Service Unavailable" }
    default { "OK" }
  }
  $headers = @(
    "HTTP/1.1 $StatusCode $statusText",
    "Access-Control-Allow-Origin: *",
    "Access-Control-Allow-Methods: GET, POST, OPTIONS",
    "Access-Control-Allow-Headers: Content-Type, Authorization",
    "Content-Type: $ContentType",
    "Content-Length: $($BodyBytes.Length)",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($BodyBytes.Length -gt 0) {
    $stream.Write($BodyBytes, 0, $BodyBytes.Length)
  }
  $stream.Flush()
}

function New-JsonResponse {
  param(
    [int]$StatusCode,
    [string]$Body
  )
  return @{
    StatusCode = $StatusCode
    BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    ContentType = "application/json; charset=utf-8"
  }
}

function New-FileResponse {
  param(
    [int]$StatusCode,
    [byte[]]$BodyBytes,
    [string]$ContentType
  )
  return @{
    StatusCode = $StatusCode
    BodyBytes = $BodyBytes
    ContentType = $ContentType
  }
}

function Get-LocalFileResponse {
  param([string]$RequestPath)

  $relative = $RequestPath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relative)) {
    $relative = "index.html"
  }
  $relative = $relative -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $fullRoot = [System.IO.Path]::GetFullPath($siteRoot)
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $siteRoot $relative))
  if (-not $candidate.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return New-JsonResponse -StatusCode 404 -Body '{"error":"not_found"}'
  }
  if (-not (Test-Path $candidate) -or (Get-Item $candidate).PSIsContainer) {
    return New-JsonResponse -StatusCode 404 -Body '{"error":"not_found"}'
  }
  return New-FileResponse -StatusCode 200 -BodyBytes ([System.IO.File]::ReadAllBytes($candidate)) -ContentType (Get-ContentType -Path $candidate)
}

function Read-HttpRequest {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.Sockets.TcpClient]$Client
  )

  $stream = $Client.GetStream()
  $stream.ReadTimeout = 10000
  $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)

  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    throw "Empty request"
  }

  $parts = $requestLine.Split(" ")
  $headers = @{}
  while ($true) {
    $line = $reader.ReadLine()
    if ([string]::IsNullOrEmpty($line)) {
      break
    }
    $index = $line.IndexOf(":")
    if ($index -gt 0) {
      $name = $line.Substring(0, $index).Trim().ToLowerInvariant()
      $value = $line.Substring($index + 1).Trim()
      $headers[$name] = $value
    }
  }

  $body = ""
  $contentLength = 0
  if ($headers.ContainsKey("content-length")) {
    [void][int]::TryParse($headers["content-length"], [ref]$contentLength)
  }
  if ($contentLength -gt 0) {
    $buffer = New-Object char[] $contentLength
    $read = 0
    while ($read -lt $contentLength) {
      $chunk = $reader.Read($buffer, $read, $contentLength - $read)
      if ($chunk -le 0) {
        break
      }
      $read += $chunk
    }
    $body = -join $buffer[0..($read - 1)]
  }

  return @{
    Method = $parts[0]
    Path = $parts[1]
    Body = $body
    Headers = $headers
  }
}

function Test-AdminAccess {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Headers
  )

  if (-not $Headers.ContainsKey("authorization")) {
    return $false
  }

  $authHeader = [string]$Headers["authorization"]
  if (-not $authHeader.StartsWith("Basic ")) {
    return $false
  }

  try {
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($authHeader.Substring(6)))
    $separatorIndex = $decoded.IndexOf(":")
    if ($separatorIndex -lt 0) {
      return $false
    }
    $username = $decoded.Substring(0, $separatorIndex)
    $password = $decoded.Substring($separatorIndex + 1)
    return $username -eq "ENTRYFRAGADMIN" -and $password -eq "efs1mpleg0at@"
  } catch {
    return $false
  }
}

function Handle-Request {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Request
  )

  if ($Request.Method -eq "OPTIONS") {
    return New-JsonResponse -StatusCode 204 -Body ""
  }

  if ($Request.Method -eq "GET") {
    if ($Request.Path -eq "/api/orders") {
      if (-not (Test-AdminAccess -Headers $Request.Headers)) {
        return New-JsonResponse -StatusCode 401 -Body '{"error":"admin_auth_required"}'
      }

      $orders = @()
      foreach ($entry in (Read-Orders)) {
        $orders += $entry
      }
      $sortedOrders = @($orders | Sort-Object -Descending -Property @{ Expression = { [string]$_.receivedAt } })
      return New-JsonResponse -StatusCode 200 -Body ((@{ orders = $sortedOrders } | ConvertTo-Json -Depth 8 -Compress))
    }

    return Get-LocalFileResponse -RequestPath $Request.Path
  }

  if ($Request.Method -eq "POST" -and $Request.Path -eq "/api/orders/delete") {
    if (-not (Test-AdminAccess -Headers $Request.Headers)) {
      return New-JsonResponse -StatusCode 401 -Body '{"error":"admin_auth_required"}'
    }

    try {
      $json = $Request.Body | ConvertFrom-Json
    } catch {
      return New-JsonResponse -StatusCode 400 -Body '{"error":"invalid_json"}'
    }

    $orderNumber = [string]$json.orderNumber
    if ([string]::IsNullOrWhiteSpace($orderNumber)) {
      return New-JsonResponse -StatusCode 400 -Body '{"error":"missing_order_number"}'
    }

    $deleted = Remove-Order -OrderNumber $orderNumber.Trim()
    if (-not $deleted) {
      return New-JsonResponse -StatusCode 404 -Body '{"error":"order_not_found"}'
    }

    return New-JsonResponse -StatusCode 200 -Body '{"status":"ok"}'
  }

  if ($Request.Method -eq "POST" -and $Request.Path -eq "/api/orders/update") {
    if (-not (Test-AdminAccess -Headers $Request.Headers)) {
      return New-JsonResponse -StatusCode 401 -Body '{"error":"admin_auth_required"}'
    }

    try {
      $json = $Request.Body | ConvertFrom-Json
    } catch {
      return New-JsonResponse -StatusCode 400 -Body '{"error":"invalid_json"}'
    }

    $originalOrderNumber = [string]$json.originalOrderNumber
    if ([string]::IsNullOrWhiteSpace($originalOrderNumber)) {
      return New-JsonResponse -StatusCode 400 -Body '{"error":"missing_original_order_number"}'
    }

    if (-not $json.order) {
      return New-JsonResponse -StatusCode 400 -Body '{"error":"missing_order_payload"}'
    }

    $result = Update-OrderRecord -OriginalOrderNumber $originalOrderNumber.Trim() -UpdatedOrder $json.order
    if ($result.Error) {
      $statusCode = if ($result.Error -eq "order_not_found") { 404 } else { 400 }
      return New-JsonResponse -StatusCode $statusCode -Body ((@{ error = $result.Error } | ConvertTo-Json -Compress))
    }

    return New-JsonResponse -StatusCode 200 -Body ((@{ status = "ok"; order = $result.Order } | ConvertTo-Json -Depth 8 -Compress))
  }

  if ($Request.Method -ne "POST" -or ($Request.Path -ne "/orders" -and $Request.Path -ne "/api/orders")) {
    return New-JsonResponse -StatusCode 404 -Body '{"error":"not_found"}'
  }

  try {
    $json = $Request.Body | ConvertFrom-Json
  } catch {
    return New-JsonResponse -StatusCode 400 -Body '{"error":"invalid_json"}'
  }

  $order = $json.order
  $telegramData = $json.telegram
  if (-not $order) {
    $order = $json
  }

  if (-not $order.orderNumber) {
    return New-JsonResponse -StatusCode 400 -Body '{"error":"missing_order_number"}'
  }

  if ($telegramData -and $telegramData.message) {
    if (-not $telegramBotToken) {
      return New-JsonResponse -StatusCode 503 -Body '{"error":"missing_bot_token"}'
    }

    $chatId = Get-ManagerChatId
    if (-not $chatId) {
      return New-JsonResponse -StatusCode 503 -Body '{"error":"missing_chat_id"}'
    }

    try {
      $body = @{
        chat_id = $chatId
        text = $telegramData.message
      }
      if ($telegramData.replyMarkup) {
        $body.reply_markup = $telegramData.replyMarkup
      }
      Invoke-RestMethod -Uri "$telegramApiBase/sendMessage" -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 20 | Out-Null
      $order.telegramStatus = "sent"
    } catch {
      Write-Host "Telegram notify failed: $($_.Exception.Message)"
      $order.telegramStatus = "pending"
      $order.telegramError = $_.Exception.Message
      $order.receivedAt = (Get-Date).ToString("o")
      Append-Order $order
      return New-JsonResponse -StatusCode 200 -Body '{"status":"queued","warning":"telegram_unreachable"}'
    }
  }

  if (-not $order.telegramStatus) {
    $order.telegramStatus = "sent"
  }
  $order.receivedAt = (Get-Date).ToString("o")
  Append-Order $order
  return New-JsonResponse -StatusCode 200 -Body '{"status":"ok"}'
}

Write-Host "ENTRYFRAG order logger listening on http://localhost:$port/"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $request = Read-HttpRequest -Client $client
      $response = Handle-Request -Request $request
      Send-HttpResponse -Client $client -StatusCode $response.StatusCode -BodyBytes $response.BodyBytes -ContentType $response.ContentType
    } catch {
      Write-Host "Logger error: $($_.Exception.Message)"
      try {
        Send-HttpResponse -Client $client -StatusCode 500 -BodyBytes ([System.Text.Encoding]::UTF8.GetBytes('{"error":"internal"}')) -ContentType "application/json; charset=utf-8"
      } catch {}
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
