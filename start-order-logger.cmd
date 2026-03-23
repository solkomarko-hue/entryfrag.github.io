@echo off
start "ENTRYFRAG Order Logger" powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0order-logger.ps1"
