@echo off
cd /d "%~dp0"
echo Aeon Womb PC: http://localhost:8907/launcher.html
start "" http://localhost:8907/launcher.html
python -m http.server 8907
