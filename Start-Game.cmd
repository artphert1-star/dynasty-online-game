@echo off
title Dynasty v1.3
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Game.ps1"
if errorlevel 1 pause
