import React, { useState } from 'react';
import api from '../api';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Yeni şifreniz en az 8 karakter uzunluğunda olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.changePassword(oldPassword, newPassword);
      if (res.success) {
        setSuccessMsg('Şifreniz başarıyla değiştirildi.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Şifre değiştirilemedi. Mevcut şifrenizi kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔑 Şifre Değiştir</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
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

          {successMsg && (
            <div className="two-factor-status-badge active" style={{ marginBottom: '16px' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <div className="auth-field" style={{ marginBottom: '14px' }}>
            <label className="auth-label">Mevcut Şifre</label>
            <input
              type="password"
              className="auth-input"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="auth-field" style={{ marginBottom: '14px' }}>
            <label className="auth-label">Yeni Şifre (En az 8 karakter)</label>
            <input
              type="password"
              className="auth-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="auth-field" style={{ marginBottom: '20px' }}>
            <label className="auth-label">Yeni Şifre Tekrar</label>
            <input
              type="password"
              className="auth-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
