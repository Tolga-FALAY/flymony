const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;

const handleResponse = async (r) => {
    if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Bir hata oluştu');
    }
    return r.json();
};

export const api = {
    // Artists
    getArtists: () => fetch(`${API_BASE}/artists`).then(handleResponse),
    createArtist: (data) => fetch(`${API_BASE}/artists`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    updateArtist: (id, data) => fetch(`${API_BASE}/artists/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    deleteArtist: (id) => fetch(`${API_BASE}/artists/${id}`, { method: 'DELETE' }).then(handleResponse),

    // Songs
    getSongs: () => fetch(`${API_BASE}/songs`).then(handleResponse),
    createSong: (data) => fetch(`${API_BASE}/songs`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    updateSong: (id, data) => fetch(`${API_BASE}/songs/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    deleteSong: (id) => fetch(`${API_BASE}/songs/${id}`, { method: 'DELETE' }).then(handleResponse),

    // Guests
    getGuests: () => fetch(`${API_BASE}/guests`).then(handleResponse),
    createGuest: (data) => fetch(`${API_BASE}/guests`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    updateGuest: (id, data) => fetch(`${API_BASE}/guests/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    deleteGuest: (id) => fetch(`${API_BASE}/guests/${id}`, { method: 'DELETE' }).then(handleResponse),

    // Requests
    getRequests: () => fetch(`${API_BASE}/requests`).then(handleResponse),
    createRequest: (data) => fetch(`${API_BASE}/requests`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    updateRequest: (id, data) => fetch(`${API_BASE}/requests/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse),
    deleteRequest: (id) => fetch(`${API_BASE}/requests/${id}`, { method: 'DELETE' }).then(handleResponse),
};
