@echo off
setlocal
set "FLUX_BRAVE_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%FLUX_BRAVE_EXE%" set "FLUX_BRAVE_EXE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%FLUX_BRAVE_EXE%" set "FLUX_BRAVE_EXE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%FLUX_BRAVE_EXE%" (
    echo Brave was not found. Install Brave before using this launcher.
    pause
    exit /b 1
)
rem Open the live site by default. Use the --local argument for development.
set "FLUX_APP_URL=https://fluxcafe.store/items"
if /i "%~1"=="--local" set "FLUX_APP_URL=http://localhost:3000/items"
rem Keep printing settings and sign-in separate from the regular Brave profile.
start "" "%FLUX_BRAVE_EXE%" --user-data-dir="%LOCALAPPDATA%\FLUX-POS\BravePrinting" --kiosk-printing --no-first-run --no-default-browser-check --app="%FLUX_APP_URL%"
endlocal
