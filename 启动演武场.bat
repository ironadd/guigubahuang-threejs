@echo off
chcp 65001 >nul
title 鬼谷八荒 · 登仙大成斗法演武 (Three.js)
cd /d "%~dp0"
echo ========================================================
echo   正在启动【鬼谷八荒 · 登仙境大成斗法演武场】...
echo   启动后请在浏览器打开: http://localhost:5188
echo ========================================================
start "" "http://localhost:5188"
call npm run dev
pause
