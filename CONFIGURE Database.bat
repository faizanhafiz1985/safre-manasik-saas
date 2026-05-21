@echo off
title Safre Manasik - Database Configuration
color 0E
cls

echo ============================================
echo    SAFRE MANASIK - DATABASE CONFIGURATION
echo ============================================
echo.
echo  This will update the backend\.env file with
echo  your PostgreSQL connection settings.
echo.
echo  Press ENTER to keep the current value shown
echo  in brackets, or type a new value.
echo.

set ENV_FILE=%~dp0backend\.env

:: ── Check .env file exists ────────────────────────────────────────────────────
if not exist "%ENV_FILE%" (
    echo  ERROR: backend\.env not found at:
    echo  %ENV_FILE%
    echo.
    echo  Make sure you are running this from the
    echo  "Safre Manasik Application" folder.
    pause
    exit /b 1
)

echo ============================================
echo   PostgreSQL Connection Settings
echo ============================================
echo.

:: ── Collect inputs ────────────────────────────────────────────────────────────
set /p PG_HOST=  PostgreSQL Host      [localhost]:
if "%PG_HOST%"=="" set PG_HOST=localhost

set /p PG_PORT=  PostgreSQL Port      [5432]:
if "%PG_PORT%"=="" set PG_PORT=5432

set /p PG_USER=  PostgreSQL Username  [postgres]:
if "%PG_USER%"=="" set PG_USER=postgres

echo.
echo  IMPORTANT: Type your PostgreSQL password carefully.
echo  (Characters will NOT be hidden - this is a .bat limitation)
echo.
set /p PG_PASS=  PostgreSQL Password  [SafreManasik@2024]:
if "%PG_PASS%"=="" set PG_PASS=SafreManasik@2024

set /p PG_DB=    Database Name        [safre_manasik]:
if "%PG_DB%"=="" set PG_DB=safre_manasik

:: ── Build connection string ───────────────────────────────────────────────────
set DB_URL=postgresql://%PG_USER%:%PG_PASS%@%PG_HOST%:%PG_PORT%/%PG_DB%

echo.
echo ============================================
echo   Review Your Settings
echo ============================================
echo.
echo   Host     : %PG_HOST%
echo   Port     : %PG_PORT%
echo   Username : %PG_USER%
echo   Password : %PG_PASS%
echo   Database : %PG_DB%
echo.
echo   Connection URL:
echo   %DB_URL%
echo.
echo ============================================
echo.

set /p CONFIRM=  Save these settings? (Y/N):
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo  Cancelled. No changes were made.
    echo.
    pause
    exit /b 0
)

:: ── Write new .env file ───────────────────────────────────────────────────────
echo.
echo  Writing backend\.env ...

(
echo NODE_ENV=development
echo PORT=5000
echo.
echo DATABASE_URL="%DB_URL%"
echo.
echo JWT_SECRET=safre-manasik-jwt-secret-key-change-in-production-2024
echo JWT_EXPIRES_IN=7d
echo.
echo COMPANY_NAME=Safre Manasik Travel
echo COMPANY_EMAIL=info@safremanasik.com
echo COMPANY_PHONE=+966-11-000-0000
echo COMPANY_ADDRESS=Olaya District, Riyadh, Saudi Arabia
echo.
echo FRONTEND_URL=http://localhost:3000
echo UPLOAD_DIR=uploads
) > "%ENV_FILE%"

echo  Done! backend\.env has been updated.

:: ── Optionally test connection ────────────────────────────────────────────────
echo.
echo ============================================
echo   Test Database Connection?
echo ============================================
echo.
set /p TEST=  Test connection now? Requires psql installed (Y/N):
if /i "%TEST%"=="Y" (
    echo.
    echo  Testing connection...
    "%PG_BIN%\psql.exe" -h %PG_HOST% -p %PG_PORT% -U %PG_USER% -d postgres -c "SELECT 'Connected successfully!' AS status;" 2>nul
    if %errorlevel% EQU 0 (
        echo.
        echo  Connection test PASSED!
    ) else (
        :: Try without psql path variable
        psql -h %PG_HOST% -p %PG_PORT% -U %PG_USER% -d postgres -c "SELECT 'Connected successfully!' AS status;" 2>nul
        if %errorlevel% EQU 0 (
            echo.
            echo  Connection test PASSED!
        ) else (
            echo.
            echo  Could not run psql test (psql may not be in PATH).
            echo  Settings were saved. Run SETUP to apply the schema.
        )
    )
)

echo.
echo ============================================
echo   CONFIGURATION COMPLETE
echo ============================================
echo.
echo   Next steps:
echo     1. Run  SETUP Safre Manasik.bat   (first time only)
echo     2. Run  START Safre Manasik.bat   to launch the app
echo.
pause
