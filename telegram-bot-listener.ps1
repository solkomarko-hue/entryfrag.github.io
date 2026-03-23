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

$appConfig = Load-EnvFile -Path (Join-Path $PSScriptRoot ".env")
$botToken = Get-ConfigValue -Config $appConfig -Name "TELEGRAM_BOT_TOKEN"
if (-not $botToken) {
  throw "TELEGRAM_BOT_TOKEN is not set. Add it to .env or the environment before starting telegram-bot-listener.ps1."
}

$apiBase = "https://api.telegram.org/bot$botToken"
$offsetFile = Join-Path $PSScriptRoot "telegram-bot-offset.txt"
$ordersFile = Join-Path $PSScriptRoot "orders.json"
$managerChatFile = Join-Path $PSScriptRoot "telegram-manager-chat.txt"

function Invoke-TelegramApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [hashtable]$Body = @{}
  )

  $payload = $Body | ConvertTo-Json -Depth 8 -Compress
  return Invoke-RestMethod -Uri "$apiBase/$Method" -Method Post -ContentType "application/json" -Body $payload
}

function Get-Offset {
  if (Test-Path $offsetFile) {
    $raw = (Get-Content $offsetFile -Raw).Trim()
    if ($raw -match "^\d+$") {
      return [int64]$raw
    }
  }
  return 0
}

function Save-Offset {
  param([int64]$Value)
  Set-Content -Path $offsetFile -Value $Value -Encoding ascii
}

function Save-ManagerChatId {
  param(
    [Parameter(Mandatory)]
    [string]$ChatId
  )
  Set-Content -Path $managerChatFile -Value $ChatId -Encoding ascii
}

function Send-TelegramMessage {
  param(
    [Parameter(Mandatory)]
    [string]$ChatId,
    [Parameter(Mandatory)]
    [string]$Text,
    $ReplyMarkup = $null
  )

  $body = @{
    chat_id = $ChatId
    text = $Text
    parse_mode = "HTML"
  }
  if ($ReplyMarkup) {
    $body.reply_markup = $ReplyMarkup
  }
  Invoke-TelegramApi -Method "sendMessage" -Body $body | Out-Null
}

function Handle-CallbackQuery {
  param($CallbackQuery)

  $callbackId = $CallbackQuery.id
  $message = $CallbackQuery.message
  $data = [string]$CallbackQuery.data

  Invoke-TelegramApi -Method "answerCallbackQuery" -Body @{
    callback_query_id = $callbackId
    text = "Order marked as sent"
  } | Out-Null

  if ($data -like "done:*" -and $message) {
    Invoke-TelegramApi -Method "deleteMessage" -Body @{
      chat_id = $message.chat.id
      message_id = $message.message_id
    } | Out-Null
    $orderNumber = $data.Split(":")[1]
    Update-OrderStatus -OrderNumber $orderNumber -Status "confirmed"
  }
}

function Handle-Message {
  param($Message)

  $chatId = $Message.chat.id
  $text = $Message.text
  if ($text -eq "/start" -or $text -eq "/bindmanager") {
    Save-ManagerChatId -ChatId ([string]$chatId)
    Send-TelegramMessage -ChatId $chatId -Text "This chat is now connected to ENTRYFRAG order notifications."
    return
  }
  if ($text -eq "/orderhistory") {
    $orders = Read-Orders
    if (-not $orders.Count) {
      Send-TelegramMessage -ChatId $chatId -Text "No saved orders yet."
      return
    }
    $history = $orders | Sort-Object -Property receivedAt -Descending | Select-Object -First 10
    $lines = @()
    foreach ($order in $history) {
      $lines += "#$($order.orderNumber): $($order.status) ($($order.total) UAH) - $($order.customerName)"
    }
    $bodyText = "Recent orders:`n" + ($lines -join "`n")
    Send-TelegramMessage -ChatId $chatId -Text $bodyText
  }
}

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

function Update-OrderStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OrderNumber,
    [Parameter(Mandatory = $true)]
    [string]$Status
  )
  $orders = Read-Orders
  $found = $false
  foreach ($order in $orders) {
    if ($order.orderNumber -eq $OrderNumber) {
      $order.status = $Status
      $order.statusUpdatedAt = (Get-Date).ToString("o")
      $found = $true
      break
    }
  }
  if ($found) {
    Write-Orders $orders
  }
}

Write-Host "ENTRYFRAG Telegram bot listener started"

$offset = Get-Offset

  while ($true) {
    try {
      $updates = Invoke-TelegramApi -Method "getUpdates" -Body @{
        offset = $offset
        timeout = 25
        allowed_updates = @("callback_query", "message")
      }

      foreach ($update in $updates.result) {
      $offset = [int64]$update.update_id + 1
      Save-Offset -Value $offset

      if ($update.callback_query) {
        Handle-CallbackQuery -CallbackQuery $update.callback_query
      }
      if ($update.message) {
        Handle-Message -Message $update.message
      }
    }
  } catch {
    Write-Host "Telegram listener error: $($_.Exception.Message)"
    Start-Sleep -Seconds 3
  }
}
