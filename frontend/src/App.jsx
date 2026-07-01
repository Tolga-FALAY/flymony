import React, { useState, useEffect } from 'react';
import Artists from './components/Artists';
import Songs from './components/Songs';
import Guests from './components/Guests';
import Requests from './components/Requests';
import OtherOperations from './components/OtherOperations';
import Parameters from './components/Parameters';
import store from './store';
import ChordFullscreenViewer from './components/ChordFullscreenViewer';

const NAV_ITEMS = [
  {
    key: 'requests',
    label: 'İstekler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  },
  {
    key: 'songs',
    label: 'Şarkılar',
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
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  },
  {
    key: 'parameters',
    label: 'Parametreler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    )
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('requests');
  const [menuOpen, setMenuOpen] = useState(false);

  // Kayıt sayaçları — store'daki listelerin length'inden okunur.
  // Firestore'a ekstra okuma yapılmaz.
  const [counts, setCounts] = useState({ requests: 0, songs: 0, artists: 0, guests: 0 });

  const updateCounts = () => {
    setCounts({
      requests: store.requests.length,
      songs:    store.songs.length,
      artists:  store.artists.length,
      guests:   store.guests.length
    });
  };

  useEffect(() => {
    // Uygulama açılışında tüm koleksiyonları bir kez yükle (4 okuma toplamda)
    store.load().then(updateCounts);

    // Store her güncellendiğinde (CRUD sonrası) sayaçları yenile — Firestore okuma YOK
    window.addEventListener('store-updated', updateCounts);
    return () => window.removeEventListener('store-updated', updateCounts);
  }, []);

  useEffect(() => {
    const handleOpenSongModalExternal = (e) => {
      if (e.detail && e.detail.song) {
        setActiveTab('songs');
      }
    };
    window.addEventListener('open-song-modal-from-external', handleOpenSongModalExternal);
    return () => window.removeEventListener('open-song-modal-from-external', handleOpenSongModalExternal);
  }, []);

  function handleNavClick(key) {
    setActiveTab(key);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/flymonyLogo.png" alt="FLY Logo" className="logo-img" />
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-btn ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => handleNavClick(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">
                {item.label} {counts[item.key] !== undefined ? `(${counts[item.key]})` : ''}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">flymony · yönetim paneli</div>
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
          <div style={{ display: activeTab === 'songs' ? 'block' : 'none' }}><Songs /></div>
          <div style={{ display: activeTab === 'artists' ? 'block' : 'none' }}><Artists /></div>
          <div style={{ display: activeTab === 'guests' ? 'block' : 'none' }}><Guests /></div>
          <div style={{ display: activeTab === 'otherOperations' ? 'block' : 'none' }}><OtherOperations /></div>
          <div style={{ display: activeTab === 'parameters' ? 'block' : 'none' }}><Parameters /></div>
        </div>
      </main>
      <ChordFullscreenViewer />
    </div>
  );
}

export default App;
