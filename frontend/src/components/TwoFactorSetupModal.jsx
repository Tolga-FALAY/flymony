import React, { useState, useEffect } from 'react';
import api from '../api';

export default function TwoFactorSetupModal({ isOpen, onClose, currentUser, onStatusChange }) {
  const [step, setStep] = useState(1); // 1: QR & Setup, 2: Verification, 3: Success
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const isAlreadyEnabled = currentUser?.TwoFactorEnabled;

  useEffect(() => {
    if (isOpen && !isAlreadyEnabled) {
      initiateSetup();
    } else {
      setStep(1);
      setErrorMsg('');
      setVerifyCode('');
      setDisablePassword('');
    }
  }, [isOpen, isAlreadyEnabled]);

  const initiateSetup = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.setup2FA();
      setQrCodeUrl(res.qrCodeUrl);
      setSecretKey(res.secret);
      setBackupCodes(res.backupCodes || []);
      setStep(1);
    } catch (err) {
      setErrorMsg(err.message || '2FA kurulumu başlatılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable2FA = async (e) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      setErrorMsg('Lütfen 6 haneli doğrulama kodunu girin.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.enable2FA(verifyCode.trim(), backupCodes);
      if (res.success) {
        setStep(3);
        if (onStatusChange) onStatusChange({ ...currentUser, TwoFactorEnabled: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Doğrulama kodu geçersiz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      setErrorMsg('2FA kapatmak için mevcut şifrenizi girin.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.disable2FA(disablePassword);
      if (res.success) {
        alert('İki Aşamalı Doğrulama başarıyla devre dışı bırakıldı.');
        if (onStatusChange) onStatusChange({ ...currentUser, TwoFactorEnabled: false });
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Şifre hatalı veya işlem başarısız.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content two-factor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔐 İki Aşamalı Doğrulama (2FA) Güvenliği</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {errorMsg && (
            <div className="auth-alert-danger" style={{ marginBottom: '16px' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {isAlreadyEnabled ? (
            /* 2FA Already Active - Offer Disable Option */
            <div className="two-factor-active-view">
              <div className="two-factor-status-badge active">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span>İki Aşamalı Doğrulama (2FA) Hesabınızda AKTİF</span>
              </div>
              <p className="two-factor-desc">
                Hesabınız Google Authenticator ve kurtarma kodları ile korunmaktadır. Her girişte 6 haneli kod istenecektir.
              </p>

              <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

              <h4>2FA'yı Devre Dışı Bırak</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Güvenlik gereği 2FA'yı kapatmak için mevcut şifrenizi girmeniz gerekir.
              </p>

              <form onSubmit={handleDisable2FA}>
                <div className="auth-field" style={{ marginBottom: '16px' }}>
                  <input
                    type="password"
                    className="auth-input"
                    placeholder="Mevcut şifrenizi girin"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={isLoading}
                  style={{ width: '100%' }}
                >
                  {isLoading ? 'İşleniyor...' : '2FA Korumasını Kapat'}
                </button>
              </form>
            </div>
          ) : step === 1 ? (
            /* Step 1: Scan QR Code & Backup Codes */
            <div className="two-factor-setup-view">
              <p className="two-factor-instruction">
                <strong>1. Adım:</strong> Telefonunuzdaki <strong>Google Authenticator</strong>, <strong>Apple Passwords</strong> veya <strong>Authy</strong> uygulamasını açıp aşağıdaki QR kodu tarayın:
              </p>

              <div className="two-factor-qr-wrap">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="2FA QR Code" className="two-factor-qr-img" />
                ) : (
                  <div className="two-factor-loading">QR Kod oluşturuluyor...</div>
                )}
              </div>

              <div className="two-factor-secret-row">
                <span>Veya anahtarı manuel girin:</span>
                <code>{secretKey}</code>
                <button type="button" className="btn btn-outline btn-sm" onClick={copySecret}>
                  {copiedSecret ? 'Kopyalandı!' : 'Kopyala'}
                </button>
              </div>

              <div className="two-factor-backup-box">
                <div className="two-factor-backup-header">
                  <strong>⚠️ Acil Durum Kurtarma Kodları</strong>
                  <button type="button" className="btn btn-sm btn-outline" onClick={copyBackupCodes}>
                    {copiedCodes ? 'Kopyalandı!' : 'Kodları Kopyala'}
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 8px 0' }}>
                  Telefonunuzu kaybederseniz bu kodlar ile giriş yapabilirsiniz. Her kod 1 kez kullanılır.
                </p>
                <div className="two-factor-backup-codes">
                  {backupCodes.map((code, idx) => (
                    <span key={idx} className="backup-code-item">{code}</span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                  Devam Et (Kodu Doğrula) →
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            /* Step 2: Enter 6-digit Code to Confirm */
            <form onSubmit={handleEnable2FA} className="two-factor-confirm-view">
              <p className="two-factor-instruction">
                <strong>2. Adım:</strong> Kurulumu tamamlamak için uygulamanızın ürettiği güncel <strong>6 haneli doğrulama kodunu</strong> girin:
              </p>

              <div className="auth-field" style={{ margin: '20px 0' }}>
                <input
                  type="text"
                  className="auth-input auth-code-input"
                  placeholder="000000"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                  ← Geri (QR Kod)
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Doğrulanıyor...' : '2FA Etkinleştir ve Kaydet'}
                </button>
              </div>
            </form>
          ) : (
            /* Step 3: Success */
            <div className="two-factor-success-view">
              <div className="two-factor-status-badge active">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Tebrikler! 2FA Başarıyla Etkinleştirildi</span>
              </div>
              <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Hesabınız artık en yüksek güvenlik seviyesinde korunmaktadır. Bir sonraki girişinizde doğrulama kodu istenecektir.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '20px' }}
                onClick={onClose}
              >
                Tamamla ve Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
