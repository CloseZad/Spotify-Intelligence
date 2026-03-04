const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? "https://spotify-intelligence.onrender.com"
    : "http://127.0.0.1:3000";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  uri: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
}

export const spotifyService = {
  async getAuthUrl(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/auth/url`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.url;
  },

  async getAuthStatus() {
    const res = await fetch(`${API_BASE_URL}/api/auth/status`, {
      credentials: "include",
    });
    const data = await res.json();
    return data.isAuthenticated;
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/api/spotify/me`, {
      credentials: "include",
    });
    return res.json();
  },

  async getTopTracks(): Promise<SpotifyTrack[]> {
    const response = await fetch(`${API_BASE_URL}/api/spotify/top-tracks`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.items;
  },

  async getTopArtists(): Promise<SpotifyArtist[]> {
    const response = await fetch(`${API_BASE_URL}/api/spotify/top-artists`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.items;
  },

  async getRecentTracks(): Promise<SpotifyTrack[]> {
    const response = await fetch(`${API_BASE_URL}/api/spotify/recent-tracks`, {
      credentials: "include",
    });
    const data = await response.json();
    return data.items.map((item: any) => item.track);
  },

  async searchTracks(query: string): Promise<SpotifyTrack[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/search?q=${encodeURIComponent(
        query
      )}&type=track`,
      {
        credentials: "include",
      }
    );
    const data = await response.json();
    return data.tracks.items;
  },

  async createPlaylist(
    name: string,
    description: string,
    tracks: string[]
  ): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/api/spotify/create-playlist`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, tracks }),
      }
    );
    return response.json();
  },
};
