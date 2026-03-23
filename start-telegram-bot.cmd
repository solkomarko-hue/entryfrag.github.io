@echo off
start "ENTRYFRAG Telegram Bot" powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0telegram-bot-listener.ps1"
