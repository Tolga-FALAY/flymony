# 🛡️ Hetzner Sunucu, Nginx & Veritabanı Güvenlik (Hardening) Rehberi

Bu rehber, **Flymony** uygulamasının Hetzner Cloud sunucusunda en yüksek kurumsal güvenlik seviyesine ulaştırılması için adım adım uygulanacak talimatları içerir.

---

## 1. Hetzner Cloud Firewall & UFW (Güvenlik Duvarı)

Sunucunuzun tüm iç portları (Node.js 5000 dahil) dış dünyaya kapatılmalı, yalnızca Nginx (80/443) ve SSH erişimine izin verilmelidir.

### 1.1. Hetzner Cloud Panelinden Firewall Tanımı:
Hetzner Cloud Console -> **Firewalls** sekmesine gidin ve şu kuralları ekleyin:
- **Inbound Rules:**
  - `TCP` / `Port 22` (veya değiştirdiğiniz SSH portu) / `Source: Any IPv4/IPv6` (veya sadece kendi sabit IP'niz)
  - `TCP` / `Port 80` / `Source: Any` (HTTP)
  - `TCP` / `Port 443` / `Source: Any` (HTTPS)
- **Outbound Rules:**
  - `Tüm Protokoller / Any` (Sunucunun paket ve güncelleme çekebilmesi için)

### 1.2. Sunucu İçi UFW (Uncomplicated Firewall) Ayarları:
Sunucuya SSH ile bağlandıktan sonra çalıştırın:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
sudo ufw status verbose
```

---

## 2. SSH Güvenliği ve Şifreli Girişi Kapatma

Brute-force (kaba kuvvet) saldırılarına karşı şifre ile SSH girişi kesinlikle kapatılmalı, sadece SSH anahtarı (ED25519) kullanılmalıdır.

1. Bilgisayarınızda (yerel) anahtarınız yoksa üretin:
   ```bash
   ssh-keygen -t ed25519 -C "tolga-flymony-admin"
   ```
2. Anahtarınızı Hetzner sunucunuza kopyalayın:
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519.pub root@SUNUCU_IP_ADRESI
   ```
3. Sunucuda SSH yapılandırma dosyasını düzenleyin:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
   Şu parametreleri güncelleyin:
   ```ini
   PasswordAuthentication no
   PubkeyAuthentication yes
   PermitEmptyPasswords no
   X11Forwarding no
   MaxAuthTries 3
   ```
4. SSH servisini yeniden başlatın:
   ```bash
   sudo systemctl restart sshd
   ```

---

## 3. Fail2ban (Otomatik Saldırgan Engelleme) Kurulumu

Fail2ban, şüpheli giriş denemeleri veya Nginx'e yapılan zararlı taramaları tespit ederek saldırganın IP adresini otomatik olarak güvenlik duvarında (UFW) banlar.

```bash
sudo apt update && sudo apt install -y fail2ban
```

`/etc/fail2ban/jail.local` dosyası oluşturun:
```ini
[DEFAULT]
bantime = 1d
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
```
Servisi başlatın:
```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status
```

---

## 4. Nginx Reverse Proxy & SSL (HTTPS) Yapılandırması

Node.js uygulamanız (port 5000) doğrudan internete açılmamalıdır. Nginx, SSL şifrelemesini yönetir ve hassas dosyalara (`.git`, `.env`, `*.db`) erişimi sunucu düzeyinde engeller.

### 4.1. Nginx Site Konfigürasyonu (`/etc/nginx/sites-available/flymony`):
```nginx
# HTTP -> HTTPS Yönlendirmesi
server {
    listen 80;
    listen [::]:80;
    server_name flymony.siteniz.com; # Kendi domain adresinizi yazın

    return 301 https://$host$request_uri;
}

# Güvenli HTTPS Sunucusu
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name flymony.siteniz.com;

    # Let's Encrypt SSL Sertifikaları (Certbot tarafından doldurulur)
    # ssl_certificate /etc/letsencrypt/live/flymony.siteniz.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/flymony.siteniz.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Güvenlik Başlıkları
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Maksimum Yükleme Boyutu (Fotoğraf ve Medyalar İçin)
    client_max_body_size 50M;

    # 🚨 KRİTİK GÜVENLİK KURALI: Gizli Dosyaları ve Veritabanlarını Kesin Olarak Blokla
    location ~ /\.(git|env|ht|svn) {
        deny all;
        return 404;
    }

    location ~ \.(db|sqlite|sqlite3|sql|log|sh)$ {
        deny all;
        return 404;
    }

    # Express Backend Proxy
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktif edin ve test edin:
```bash
sudo ln -s /etc/nginx/sites-available/flymony /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.2. Ücretsiz Let's Encrypt SSL Sertifikası Alma:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d flymony.siteniz.com
```

---

## 5. Otomatik & Şifreli SQLite Veritabanı Yedeklemesi

Kişisel verilerin kaybolmaması için her gece otomatik SQLite `.backup` alınmalı ve 14 günden eski yedekler temizlenmelidir.

### 5.1. Yedekleme Scripti Oluşturun (`/usr/local/bin/backup_flymony.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/flymony"
DB_PATH="/var/www/flymony/backend/song_requests.db"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
TARGET_FILE="$BACKUP_DIR/flymony_db_$DATE.db"

mkdir -p "$BACKUP_DIR"

# SQLite Canlı ve Güvenli Backup Komutu (Kilitlenme yapmaz)
sqlite3 "$DB_PATH" ".backup '$TARGET_FILE'"

# Sadece root okuyabilir
chmod 600 "$TARGET_FILE"

# Gzip ile sıkıştır
gzip "$TARGET_FILE"

# 14 günden eski yedekleri otomatik sil
find "$BACKUP_DIR" -type f -name "flymony_db_*.gz" -mtime +14 -delete

echo "[$(date)] Flymony veritabanı yedeği alındı: $TARGET_FILE.gz" >> /var/log/flymony_backup.log
```

Çalıştırma izni verin:
```bash
sudo chmod +x /usr/local/bin/backup_flymony.sh
```

### 5.2. Gece 03:00 Cronjob Tanımı:
```bash
sudo crontab -e
```
En alta ekleyin:
```cron
0 3 * * * /usr/local/bin/backup_flymony.sh >/dev/null 2>&1
```

---

## 6. Canlıya Alma (İlk Kurulum ve Güvenlik Adımları)

Sunucuda `.env` dosyasını oluşturup güçlü şifreler belirleyin:
```bash
cd /var/www/flymony/backend
cp .env.example .env
nano .env
```

`JWT_SECRET` ve `ADMIN_DEFAULT_PASSWORD` alanlarını güncelleyin.
Ardından PM2 ile başlatın:
```bash
pm2 start server.js --name flymony
pm2 save
pm2 startup
```

Artık Flymony; **kod hırsızlığına, veritabanı indirilmesine, brute-force saldırılarına ve yetkisiz erişimlere karşı tam donanımlı kurumsal güvenlik kalkanına sahiptir.**
