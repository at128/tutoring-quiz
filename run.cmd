@echo off
rem Runs Tutoring Quiz on Windows with one command (Docker Desktop required). Options: --reset, --stop, --help.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run.ps1" %*
set "TQ_EXIT=%ERRORLEVEL%"
rem Double-clicked: keep the window open so the addresses and accounts can be read.
if "%~1"=="" if not defined TQ_NO_BROWSER pause
exit /b %TQ_EXIT%
