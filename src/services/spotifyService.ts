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
    const response = await fetch("/api/auth/url");
    const data = await response.json();
    return data.url;
  },

  async getAuthStatus(): Promise<boolean> {
    const response = await fetch("/api/auth/status");
    const data = await response.json();
    return data.isAuthenticated;
  },

  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
  },

  async getMe(): Promise<any> {
    const response = await fetch("/api/spotify/me");
    if (!response.ok) throw new Error("Unauthorized");
    return response.json();
  },

  async getTopTracks(): Promise<SpotifyTrack[]> {
    const response = await fetch("/api/spotify/top-tracks");
    const data = await response.json();
    return data.items;
  },

  async getTopArtists(): Promise<SpotifyArtist[]> {
    const response = await fetch("/api/spotify/top-artists");
    const data = await response.json();
    return data.items;
  },

  async getRecentTracks(): Promise<SpotifyTrack[]> {
    const response = await fetch("/api/spotify/recent-tracks");
    const data = await response.json();
    return data.items.map((item: any) => item.track);
  },

  async searchTracks(query: string): Promise<SpotifyTrack[]> {
    const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&type=track`);
    const data = await response.json();
    return data.tracks.items;
  },

  async createPlaylist(name: string, description: string, tracks: string[]): Promise<any> {
    const response = await fetch("/api/spotify/create-playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, tracks }),
    });
    return response.json();
  },
};
