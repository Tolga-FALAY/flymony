import React, { useState } from 'react';
import api from '../api';

export default function LoginModal({ isOpen, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 2FA state
  const [require2FA, setRequire2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState(false);

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username.trim() || !password) {
      setErrorMsg('Lütfen kullanıcı adı ve şifrenizi girin.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      if (res.require2FA) {
        setRequire2FA(true);
        setTempToken(res.tempToken);
        setIsLoading(false);
        return;
      }

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!twoFactorCode.trim()) {
      setErrorMsg(isBackupCodeMode ? 'Lütfen kurtarma kodunuzu girin.' : 'Lütfen 6 haneli doğrulama kodunu girin.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.verify2FA(tempToken, twoFactorCode.trim());
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Doğrulama kodu hatalı veya süresi dolmuş.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPassword = () => {
    setRequire2FA(false);
    setTempToken('');
    setTwoFactorCode('');
    setErrorMsg('');
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h2 className="auth-title">Flymony Yönetim Paneli</h2>
          <p className="auth-subtitle">
            {require2FA 
              ? 'İki Aşamalı Doğrulama (2FA) gereklidir' 
              : 'Devam etmek için güvenli giriş yapın'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="auth-alert-danger">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {!require2FA ? (
          /* Step 1: Username & Password Form */
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Kullanıcı Adı veya E-Posta</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Kullanıcı adınızı girin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Şifre</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="auth-btn-loading">
                  <span className="auth-spinner"></span> Giriş Yapılıyor...
                </span>
              ) : (
                'Güvenli Giriş Yap'
              )}
            </button>
          </form>
        ) : (
          /* Step 2: 2FA Verification Form */
          <form onSubmit={handle2FASubmit} className="auth-form">
            <div className="auth-2fa-info">
              <div className="auth-2fa-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>
              <p>
                {isBackupCodeMode
                  ? 'Kurulum sırasında aldığınız 8 haneli kurtarma kodlarından birini girin.'
                  : 'Google Authenticator veya kimlik doğrulayıcı uygulamanızdaki 6 haneli kodu girin.'}
              </p>
            </div>

            <div className="auth-field">
              <label className="auth-label">
                {isBackupCodeMode ? 'Kurtarma Kodu (Örn: A1B2-C3D4)' : '6 Haneli Doğrulama Kodu'}
              </label>
              <div className="auth-input-wrap">
                <input
                  type="text"
                  className="auth-input auth-code-input"
                  placeholder={isBackupCodeMode ? 'XXXX-XXXX' : '000000'}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  maxLength={isBackupCodeMode ? 10 : 6}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Doğrulanıyor...' : 'Kodu Doğrula ve Gir'}
            </button>

            <div className="auth-2fa-actions">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setIsBackupCodeMode(!isBackupCodeMode);
                  setTwoFactorCode('');
                  setErrorMsg('');
                }}
              >
                {isBackupCodeMode ? '← 6 Haneli Kod ile Giriş Yap' : 'Cihazıma erişemiyorum (Kurtarma Kodu Kullan)'}
              </button>
              <button
                type="button"
                className="auth-link-btn auth-back-btn"
                onClick={handleBackToPassword}
              >
                ← Kullanıcı Adı & Şifreye Dön
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <span>🔒 256-bit SSL & JWT Uçtan Uca Şifreli Bağlantı</span>
        </div>
      </div>
    </div>
  );
}
