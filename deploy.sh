#!/bin/bash

# Flymony Otomatik & Güvenli Deployment Scripti
echo "==========================================="
echo "   Flymony Güvenli Güncelleme Başlatılıyor "
echo "==========================================="

# 1. Proje ana dizinine git
cd /var/www/flymony || exit

echo ">>> 1. Yerel değişiklikler temizleniyor..."
git reset --hard HEAD

echo ">>> 2. En güncel kodlar GitHub'dan çekiliyor..."
git pull origin main

echo ">>> 3. Backend paketleri yükleniyor..."
cd backend || exit
npm install --omit=dev

# Veritabanı ve env dosya izinlerini sıkılaştır
chmod 600 .env 2>/dev/null || true
chmod 600 song_requests.db 2>/dev/null || true
cd /var/www/flymony || exit

echo ">>> 4. Frontend (React) projesi derleniyor..."
cd frontend || exit
npm install
npm run build
cd /var/www/flymony || exit

echo ">>> 5. Backend servisi (PM2) yeniden başlatılıyor..."
pm2 reload flymony || pm2 start backend/server.js --name flymony

echo "==========================================="
echo "   Güncelleme Başarıyla Tamamlandı!   "
echo "==========================================="
