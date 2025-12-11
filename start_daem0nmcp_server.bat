@echo off
title Daem0nMCP Server
echo ============================================================
echo Daem0nMCP HTTP Server for Windows
echo ============================================================
echo.
echo This server MUST be running for Claude Code to use Daem0nMCP.
echo Leave this window open while using Claude Code.
echo.
cd /d "%~dp0"
python start_server.py --port 9876 %*
echo.
echo Server stopped.
pause
