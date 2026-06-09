#!/bin/bash

# Flymony Otomatik Deployment Scripti
echo "==========================================="
echo "   Flymony Guncellemesi Baslatiliyor...   "
echo "==========================================="

# 1. Proje ana dizinine git
cd /var/www/flymony || exit

echo ">>> 1. Yerel degisiklikler temizleniyor..."
git reset --hard HEAD

echo ">>> 2. En guncel kodlar GitHub'dan cekiliyor..."
git pull

echo ">>> 3. Frontend (React) projesi derleniyor..."
cd frontend || exit
npm run build

echo ">>> 4. Backend servisi (PM2) yeniden baslatiliyor..."
cd /var/www/flymony || exit
pm2 restart flymony

echo "==========================================="
echo "   Guncelleme Basariyla Tamamlandi!   "
echo "==========================================="
