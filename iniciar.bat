@echo off
title Mango Hub

start cmd /k "cd /d C:\VoiceDonations && npm start"
timeout /t 2 > nul
start cmd /k "cloudflared tunnel --url http://localhost:3000"

echo Mango Hub iniciado correctamente.
pause