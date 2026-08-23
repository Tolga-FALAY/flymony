import React, { useState, useEffect } from 'react';
import Artists from './components/Artists';
import Songs from './components/Songs';
import Guests from './components/Guests';
import Requests from './components/Requests';
import Gigs from './components/Gigs';
import OtherOperations from './components/OtherOperations';
import Parameters from './components/Parameters';
import Notes from './components/Notes';
import store from './store';
import ChordFullscreenViewer from './components/ChordFullscreenViewer';
import LoginModal from './components/LoginModal';
import TwoFactorSetupModal from './components/TwoFactorSetupModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import api from './api';

const NAV_ITEMS = [
  {
    key: 'requests',
    label: 'İstekler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    )
  },
  {
    key: 'gigs',
    label: 'Sahneler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  },
  {
    key: 'songs',
    label: 'Şarkılar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  },
  {
    key: 'artists',
    label: 'Sanatçılar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    )
  },
  {
    key: 'guests',
    label: 'Misafirler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    key: 'otherOperations',
    label: 'Diğer İşlemler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  },
  {
    key: 'parameters',
    label: 'Parametreler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  }
];

const VALID_TABS = ['requests', 'gigs', 'songs', 'artists', 'guests', 'otherOperations', 'parameters', 'notes'];

function getInitialTab() {
  try {
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem('flymony_active_tab');
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch (e) {
    console.warn("Aktif tab okunamadı:", e);
  }
  return 'requests';
}

function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('flymony_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [notesCount, setNotesCount] = useState(0);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  useEffect(() => {
    // Check initial auth status
    api.getMe()
      .then(res => {
        if (res && res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(err => {
        console.warn('Auth check failed:', err);
        setCurrentUser(null);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    store.load().then(updateCounts);
  };

  const handleLogout = async () => {
    if (!window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) return;
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setCurrentUser(null);
    }
  };

  const switchTab = (tabKey) => {
    if (!VALID_TABS.includes(tabKey)) return;
    setActiveTab(tabKey);
    try {
      localStorage.setItem('flymony_active_tab', tabKey);
      window.location.hash = tabKey;
    } catch (e) {
      console.warn("Aktif tab kaydedilemedi:", e);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('flymony_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn("Sidebar tercihi kaydedilemedi:", e);
      }
      return next;
    });
  };

  const [counts, setCounts] = useState({
    requests: 0,
    songs: 0,
    artists: 0,
    guests: 0,
    gigs: 0
  });

  const updateCounts = () => {
    setCounts({
      requests: (store.requests || []).length,
      songs:    (store.songs || []).length,
      artists:  (store.artists || []).length,
      guests:   (store.guests || []).length,
      gigs:     (store.gigs || []).length
    });
    setNotesCount((store.activeNotes || []).length);
  };

  useEffect(() => {
    if (currentUser) {
      store.load().then(updateCounts);
    }
    window.addEventListener('store-updated', updateCounts);
    return () => window.removeEventListener('store-updated', updateCounts);
  }, [currentUser]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
        try {
          localStorage.setItem('flymony_active_tab', hash);
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleOpenSongModalExternal = (e) => {
      if (e.detail && e.detail.song) {
        switchTab('songs');
      }
    };
    const handleOpenGigFromGuest = (e) => {
      if (e.detail && e.detail.gigId) {
        switchTab('gigs');
      }
    };
    window.addEventListener('open-song-modal-from-external', handleOpenSongModalExternal);
    window.addEventListener('open-gig-from-guest', handleOpenGigFromGuest);
    return () => {
      window.removeEventListener('open-song-modal-from-external', handleOpenSongModalExternal);
      window.removeEventListener('open-gig-from-guest', handleOpenGigFromGuest);
    };
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleNavClick(key) {
    switchTab(key);
    setMenuOpen(false);
  }

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      try {
        localStorage.setItem('flymony_active_tab', activeTab);
        window.location.hash = activeTab;
      } catch (e) {
        // ignore
      }
      localStorage.removeItem('flymony_db_cache_react');
      localStorage.removeItem('flymony_db_cache_react_time');
      if (typeof DB !== 'undefined' && DB.loadFromFirestore) {
        await DB.loadFromFirestore(true);
      }
      await store.load(true);
      updateCounts();
    } catch (e) {
      console.error("Yenileme hatası:", e);
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}${menuOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/flymonyLogo.png" alt="FLY Logo" className="logo-img" />
          <button 
            type="button" 
            className="sidebar-collapse-btn" 
            onClick={toggleSidebar} 
            title={sidebarCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt (İkon Modu)"}
          >
            {sidebarCollapsed ? '➔' : '◀'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => handleNavClick(item.key)}
              title={`${item.label} ${counts[item.key] !== undefined ? `(${counts[item.key]})` : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">
                {item.label} {counts[item.key] !== undefined ? `(${counts[item.key]})` : ''}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="nav-btn nav-btn--refresh"
            onClick={handleRefresh}
            title="Kayıtları Sistemden Yeniden Çek (Yenile)"
            disabled={isRefreshing}
            style={{ marginTop: '0.25rem' }}
          >
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            </span>
            <span className="nav-label">{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>

          {/* NOT EKLE / NOTLAR TAB BUTTON */}
          <button
            type="button"
            className={`nav-btn nav-btn--notes ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => handleNavClick('notes')}
            title={notesCount > 0 ? `Notlar (${notesCount} Aktif Not)` : "Notlar (0 Not)"}
            style={{ marginTop: '0.25rem', position: 'relative' }}
          >
            {sidebarCollapsed ? (
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: notesCount > 0 ? '#ef4444' : '#0284c7',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  boxShadow: notesCount > 0 ? '0 0 8px rgba(239, 68, 68, 0.8)' : 'none',
                  margin: 'auto'
                }}
              >
                {notesCount}
              </span>
            ) : (
              <>
                <span className="nav-icon">📝</span>
                <span className="nav-label">
                  Notlar
                </span>
                <span 
                  style={{
                    marginLeft: 'auto',
                    background: notesCount > 0 ? '#ef4444' : '#0284c7',
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '1px 6px',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    minWidth: '18px',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    boxShadow: notesCount > 0 ? '0 0 6px rgba(239, 68, 68, 0.7)' : 'none'
                  }}
                >
                  {notesCount}
                </span>
              </>
            )}
          </button>
        </nav>
        
        {/* User Profile & Security Section in Sidebar */}
        {currentUser && (
          <div className="sidebar-user-section">
            {!sidebarCollapsed ? (
              <>
                <div className="sidebar-user-card" title={currentUser.Email || currentUser.Username}>
                  <div className="sidebar-user-avatar">
                    {currentUser.Username ? currentUser.Username.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="sidebar-user-info">
                    <span className="sidebar-user-name">{currentUser.Username}</span>
                    <span className="sidebar-user-role">
                      {currentUser.TwoFactorEnabled ? '🛡️ 2FA Aktif' : '⚠️ 2FA Kapalı'} • {currentUser.Role === 'admin' ? 'Yönetici' : 'Misafir'}
                    </span>
                  </div>
                </div>

                <div className="sidebar-user-actions">
                  <button
                    type="button"
                    className="sidebar-user-action-btn"
                    onClick={() => setIs2FASetupModalOpen(true)}
                    title="2FA Güvenlik Ayarları"
                  >
                    🔐 2FA
                  </button>
                  <button
                    type="button"
                    className="sidebar-user-action-btn"
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    title="Şifre Değiştir"
                  >
                    🔑 Şifre
                  </button>
                  <button
                    type="button"
                    className="sidebar-user-action-btn btn-logout"
                    onClick={handleLogout}
                    title="Güvenli Çıkış"
                  >
                    🚪 Çıkış
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="nav-btn"
                onClick={handleLogout}
                title="Güvenli Çıkış Yap"
                style={{ color: '#ef4444' }}
              >
                <span className="nav-icon">🚪</span>
              </button>
            )}
          </div>
        )}

        <div className="sidebar-footer">flymony • v2.6</div>
      </aside>

      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="app-main">
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menüyü aç/kapat"
        >
          <span className={`hamburger-icon${menuOpen ? ' hamburger-icon--open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
        <div className="content-panel">
          <div style={{ display: activeTab === 'requests' ? 'block' : 'none' }}><Requests /></div>
          <div style={{ display: activeTab === 'gigs' ? 'block' : 'none' }}><Gigs /></div>
          <div style={{ display: activeTab === 'songs' ? 'block' : 'none' }}><Songs /></div>
          <div style={{ display: activeTab === 'artists' ? 'block' : 'none' }}><Artists /></div>
          <div style={{ display: activeTab === 'guests' ? 'block' : 'none' }}><Guests /></div>
          <div style={{ display: activeTab === 'otherOperations' ? 'block' : 'none' }}><OtherOperations /></div>
          <div style={{ display: activeTab === 'parameters' ? 'block' : 'none' }}><Parameters /></div>
          <div style={{ display: activeTab === 'notes' ? 'block' : 'none' }}><Notes /></div>
        </div>
      </main>

      <ChordFullscreenViewer />

      {/* Login & 2FA Modal when not authenticated */}
      <LoginModal
        isOpen={!isCheckingAuth && !currentUser}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* 2FA Setup / Settings Modal */}
      <TwoFactorSetupModal
        isOpen={is2FASetupModalOpen}
        onClose={() => setIs2FASetupModalOpen(false)}
        currentUser={currentUser}
        onStatusChange={(updatedUser) => setCurrentUser(updatedUser)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
}

export default App;
