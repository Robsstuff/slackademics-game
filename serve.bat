@echo off
echo =============================================
echo  SLACKADEMICS — Local Server
echo =============================================
echo.
echo Finding your local IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto found
)
:found
set IP=%IP:~1%
echo.
echo  PC address:   http://%IP%:8000/
echo  Open this on your phone (same WiFi)
echo.
echo  Press Ctrl+C to stop the server
echo =============================================
python -m http.server 8000
pause
