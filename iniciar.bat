@echo off
setlocal enabledelayedexpansion
title ContextFlow - Servidor Local

echo ========================================================
echo               ContextFlow - Iniciando...
echo ========================================================
echo.

REM 1. Verifica se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao foi encontrado no seu sistema.
    echo Por favor, instale o Node.js [versao 22 ou superior] para executar o ContextFlow.
    echo Baixe em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 2. Localiza a pasta platform
set "PLATFORM_DIR=%~dp0contextflow2\platform"
if not exist "!PLATFORM_DIR!\package.json" (
    set "PLATFORM_DIR=%~dp0platform"
)

if not exist "!PLATFORM_DIR!\package.json" (
    echo [ERRO] Nao foi possivel encontrar a pasta platform do projeto.
    echo Verifique se este arquivo bat esta na raiz do projeto.
    echo.
    pause
    exit /b 1
)

cd /d "!PLATFORM_DIR!"

REM 3. Verifica se os pacotes estao instalados
if not exist "node_modules" (
    echo [INFO] Instalando dependencias do projeto pela primeira vez...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias com npm install.
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas.
    echo.
)

echo [INFO] Iniciando o servidor do ContextFlow na porta 4780...
echo [INFO] Seu navegador padrao sera aberto em instantes em http://127.0.0.1:4780
echo.
echo ========================================================
echo   Pressione CTRL+C nesta janela para encerrar o servidor.
echo ========================================================
echo.

REM Abre o navegador automaticamente apos 2 segundos em segundo plano
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4780"

REM Inicia o servidor local
npm run dev

pause