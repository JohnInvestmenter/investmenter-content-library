@echo off
REM AI Search Setup Script for Windows
REM This script will install and configure Ollama with Llama 3.1 8B

echo ========================================
echo   Content Library - AI Search Setup
echo ========================================
echo.

REM Check if Ollama is already installed
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Ollama is already installed
    goto :check_model
) else (
    echo [INFO] Ollama not found. Please install from:
    echo https://ollama.com/download/windows
    echo.
    echo After installation, run this script again.
    pause
    exit /b 1
)

:check_model
echo.
echo [INFO] Checking for Llama 3.1 8B model...
ollama list | findstr "llama3.1:8b" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Llama 3.1 8B is already downloaded
    goto :test_model
) else (
    echo [INFO] Llama 3.1 8B not found. Downloading now...
    echo This will take 5-10 minutes (4.7GB download)
    echo.
    ollama pull llama3.1:8b
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to download model
        pause
        exit /b 1
    )
    echo [OK] Model downloaded successfully
)

:test_model
echo.
echo [INFO] Testing AI model with translation query...
echo.

REM Create temporary test file
echo Translate to German: "Search for investment documents" > %TEMP%\ai-test-prompt.txt

REM Test the model
ollama run llama3.1:8b < %TEMP%\ai-test-prompt.txt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Model test failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Your AI Search is ready to use!
echo.
echo Next steps:
echo 1. Ollama is running in the background
echo 2. Open your Content Library in a browser
echo 3. Follow INTEGRATION_GUIDE.md to add AI search
echo.
echo To test manually:
echo   ollama run llama3.1:8b
echo   Type: "Translate to German: real estate"
echo.
echo Optional: Try Qwen for potentially better German support:
echo   ollama pull qwen2.5:7b
echo   ollama run qwen2.5:7b
echo.
pause
