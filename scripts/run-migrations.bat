@echo off
echo World Cup LMS - Database Migration Runner
echo ==========================================
echo.
echo This script will run all database migrations for the World Cup LMS app.
echo.
echo You need your Supabase Service Role Key (found in Supabase Dashboard -^> Settings -^> API)
echo.

if "%SUPABASE_SECRET%"=="" (
    echo ❌ SUPABASE_SECRET not set!
    echo.
    echo Please set it first:
    echo    set SUPABASE_SECRET=your_service_role_key_here
    echo.
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ SUPABASE_SECRET is set
echo.
echo Running migrations...
echo.

cd /d "%~dp0\.."
node scripts/run-migrations.js

echo.
pause
