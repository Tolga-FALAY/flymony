const API_BASE = 'http://localhost:5000/api';

export const api = {
    // Artists
    getArtists: () => fetch(`${API_BASE}/artists`).then(r => r.json()),
    createArtist: (data) => fetch(`${API_BASE}/artists`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    updateArtist: (id, data) => fetch(`${API_BASE}/artists/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    deleteArtist: (id) => fetch(`${API_BASE}/artists/${id}`, { method: 'DELETE' }).then(r => r.json()),

    // Songs
    getSongs: () => fetch(`${API_BASE}/songs`).then(r => r.json()),
    createSong: (data) => fetch(`${API_BASE}/songs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    updateSong: (id, data) => fetch(`${API_BASE}/songs/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    deleteSong: (id) => fetch(`${API_BASE}/songs/${id}`, { method: 'DELETE' }).then(r => r.json()),

    // Guests
    getGuests: () => fetch(`${API_BASE}/guests`).then(r => r.json()),
    createGuest: (data) => fetch(`${API_BASE}/guests`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    updateGuest: (id, data) => fetch(`${API_BASE}/guests/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    deleteGuest: (id) => fetch(`${API_BASE}/guests/${id}`, { method: 'DELETE' }).then(r => r.json()),

    // Requests
    getRequests: () => fetch(`${API_BASE}/requests`).then(r => r.json()),
    createRequest: (data) => fetch(`${API_BASE}/requests`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
    deleteRequest: (id) => fetch(`${API_BASE}/requests/${id}`, { method: 'DELETE' }).then(r => r.json()),
};
