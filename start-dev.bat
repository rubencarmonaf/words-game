@echo off
echo Iniciando WordWars...
echo.

echo 1. Iniciando servidor backend...
start "Backend Server" cmd /k "npm run dev"

echo 2. Esperando 3 segundos...
timeout /t 3 /nobreak > nul

echo 3. Iniciando cliente frontend...
start "Frontend Client" cmd /k "npm run dev:client"

echo.
echo ✅ Servidor backend: http://localhost:3000
echo ✅ Cliente frontend: http://localhost:4200
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
