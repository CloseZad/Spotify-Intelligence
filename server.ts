import express from "express";
import { createServer as createViteServer } from "vite";
import SpotifyWebApi from "spotify-web-api-node";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// import { groqService } from "./src/services/groqService.ts";
import { claudeService } from "./src/services/claudeService";
import { geminiService } from "./src/services/geminiService.ts";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(
  cors({
    origin: "https://closezad.github.io",
    credentials: true, // Crucial for passing the Spotify auth cookies/sessions
  })
);
const PORT = 3000;

// Required for secure cookies behind a proxy
app.set("trust proxy", 1);

// Middleware
app.use(express.json());

const isProd = process.env.NODE_ENV === "production";

app.use(
  cookieSession({
    name: "spotify-session",
    keys: [process.env.SESSION_SECRET || "spotify-intelligence-secret"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  })
);

// --- FIXED: Simplified Redirect URI ---
const getRedirectUri = () => {
  if (process.env.NODE_ENV === "production") {
    // Make sure to add this to your .env file in production!
    return process.env.SPOTIFY_REDIRECT_URI || "";
  }
  return "http://127.0.0.1:3000/callback";
};

// GLOBAL TOKEN STORAGE (For demo purposes)
let globalAccessToken: string | null = null;
let globalRefreshToken: string | null = null;
let globalExpiresAt: number = 0;

// --- FIXED: Cleaned up Client Instantiation ---
export const getSpotifyClient = () => {
  const client = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: getRedirectUri(),
  });

  if (globalAccessToken) {
    client.setAccessToken(globalAccessToken);
  }
  return client;
};

// ==========================================
// 1. AUTH ROUTES
// ==========================================

app.get("/api/auth/url", (req, res) => {
  const client = getSpotifyClient();
  const redirectUri = client.getRedirectURI();

  const scopes = [
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-library-read",
  ];
  const authorizeURL = client.createAuthorizeURL(scopes, "state");
  res.json({ url: authorizeURL, redirectUri });
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  console.log("Auth callback received with code:", !!code);

  if (!code) return res.status(400).send("No code provided");

  try {
    const client = getSpotifyClient();
    const data = await client.authorizationCodeGrant(code as string);

    globalAccessToken = data.body.access_token;
    globalRefreshToken = data.body.refresh_token;
    globalExpiresAt = Date.now() + data.body.expires_in * 1000;

    console.log("Global Access Token Acquired!");

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error during Spotify Auth:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({ isAuthenticated: !!globalAccessToken });
});

app.post("/api/auth/logout", (req, res) => {
  globalAccessToken = null;
  globalRefreshToken = null;
  globalExpiresAt = 0;
  res.json({ success: true });
});

// ==========================================
// 2. THE AI AGENT ROUTE
// ==========================================

app.post("/api/chat", async (req, res) => {
  // Extract the chosen model, defaulting to claude if none is provided
  const { message, history = [], model = "claude" } = req.body;

  if (!globalAccessToken) {
    return res
      .status(401)
      .json({ error: "Please connect your Spotify account first." });
  }

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    console.log(`Agent received message (Model: ${model}):`, message);

    let result;

    // Route to the correct AI
    if (model === "gemini") {
      result = await geminiService.chat(message, history);
    } else {
      result = await claudeService.chat(message, history);
    }

    res.json({
      reply: result.text,
      history: result.history,
    });
  } catch (error) {
    console.error("Chat Agent Error:", error);
    res
      .status(500)
      .json({ error: "The AI encountered an error processing your request." });
  }
});

// ==========================================
// 3. SPOTIFY DATA PROXY ROUTES
// ==========================================

app.get("/api/spotify/me", async (req, res) => {
  try {
    const client = getSpotifyClient();
    const data = await client.getMe();
    res.json(data.body);
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.get("/api/spotify/top-tracks", async (req, res) => {
  try {
    const client = getSpotifyClient();
    const data = await client.getMyTopTracks({ limit: 20 });
    res.json(data.body);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch top tracks" });
  }
});

app.get("/api/spotify/top-artists", async (req, res) => {
  try {
    const client = getSpotifyClient();
    const data = await client.getMyTopArtists({ limit: 20 });
    res.json(data.body);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch top artists" });
  }
});

app.get("/api/spotify/recent-tracks", async (req, res) => {
  try {
    const client = getSpotifyClient();
    const data = await client.getMyRecentlyPlayedTracks({ limit: 20 });
    res.json(data.body);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recent tracks" });
  }
});

app.post("/api/spotify/create-playlist", async (req, res) => {
  const { name, description, tracks } = req.body;
  try {
    const client = getSpotifyClient();
    const me = await client.getMe();
    const playlistResponse = await client.createPlaylist(name, {
      description,
      public: false,
    });

    const playlist = playlistResponse.body;

    if (tracks && tracks.length > 0) {
      await client.addTracksToPlaylist(playlist.id, tracks);
    }
    res.json(playlist);
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

app.get("/api/spotify/search", async (req, res) => {
  const { q, type } = req.query;
  try {
    const client = getSpotifyClient();
    const data = await client.search(q as string, [(type as any) || "track"]);
    res.json(data.body);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// ==========================================
// 4. VITE FRONTEND MIDDLEWARE
// ==========================================

if (!isProd) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api/") || url.includes(".")) {
      return next();
    }

    try {
      const indexPath = path.resolve(__dirname, "index.html");
      let template = fs.readFileSync(indexPath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      next(e);
    }
  });
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
