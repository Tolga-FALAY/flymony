import React, { useState } from 'react';
import Artists from './components/Artists';
import Songs from './components/Songs';
import Guests from './components/Guests';
import Requests from './components/Requests';

function App() {
  const [activeTab, setActiveTab] = useState('requests');

  return (
    <div className="container">
      <header>
        <div className="logo-area">
          <img src="/flymonyLogo.png" alt="FLY Logo" className="logo-img" />
        </div>
        <nav>
          <button 
            className={`nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            İstekler
          </button>
          <button 
            className={`nav-btn ${activeTab === 'songs' ? 'active' : ''}`}
            onClick={() => setActiveTab('songs')}
          >
            Şarkılar
          </button>
          <button 
            className={`nav-btn ${activeTab === 'artists' ? 'active' : ''}`}
            onClick={() => setActiveTab('artists')}
          >
            Sanatçılar
          </button>
          <button 
            className={`nav-btn ${activeTab === 'guests' ? 'active' : ''}`}
            onClick={() => setActiveTab('guests')}
          >
            Misafirler
          </button>
        </nav>
      </header>

      <main className="content-panel">
        {activeTab === 'requests' && <Requests />}
        {activeTab === 'songs' && <Songs />}
        {activeTab === 'artists' && <Artists />}
        {activeTab === 'guests' && <Guests />}
      </main>
    </div>
  );
}

export default App;
