#!/bin/bash

echo "Iniciando WordWars..."
echo

echo "1. Iniciando servidor backend..."
gnome-terminal -- bash -c "npm run dev; exec bash" &

echo "2. Esperando 3 segundos..."
sleep 3

echo "3. Iniciando cliente frontend..."
gnome-terminal -- bash -c "npm run dev:client; exec bash" &

echo
echo "✅ Servidor backend: http://localhost:3000"
echo "✅ Cliente frontend: http://localhost:3001"
echo
echo "Presiona Enter para continuar..."
read
