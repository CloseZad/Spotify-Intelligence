import React, { useState, useEffect, useRef } from "react";
import {
  Music,
  Send,
  User,
  LogOut,
  Plus,
  History,
  TrendingUp,
  Mic,
  Settings,
  LayoutDashboard,
  MessageSquare,
  Loader2,
  Disc,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  spotifyService,
  SpotifyTrack,
  SpotifyArtist,
} from "./services/spotifyService";

interface Message {
  role: "user" | "model";
  content: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [redirectUri, setRedirectUri] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
    fetchRedirectUri();
  }, []);

  const fetchRedirectUri = async () => {
    try {
      const response = await fetch("/api/auth/url");
      const data = await response.json();
      setRedirectUri(data.redirectUri);
    } catch (e) {
      console.error("Failed to fetch redirect URI", e);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkAuth = async () => {
    const status = await spotifyService.getAuthStatus();
    setIsAuthenticated(status);
    if (status) {
      const userData = await spotifyService.getMe();
      setUser(userData);
    }
  };

  const handleConnect = async () => {
    const url = await spotifyService.getAuthUrl();
    const authWindow = window.open(url, "spotify_auth", "width=600,height=700");

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        checkAuth();
        window.removeEventListener("message", handleMessage);
      }
    };
    window.addEventListener("message", handleMessage);
  };

  const handleLogout = async () => {
    await spotifyService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setMessages([]);
    setHistory([]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history }),
      }).then((res) => res.json());

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: result.reply || "I'm sorry, I couldn't process that.",
        },
      ]);
      setHistory(result.history);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <Music className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Spotify Intelligence
            </h1>
            <p className="text-zinc-400">
              Connect your account to explore your listening habits with AI.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-full transition-all flex items-center justify-center gap-2 group"
          >
            Connect with Spotify
            <Music className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>
          <p className="text-xs text-zinc-500">
            We only request access to read your listening data and manage your
            playlists.
          </p>
          {redirectUri && (
            <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Current Environment Redirect URI
              </p>
              <code className="text-xs text-emerald-500 break-all bg-black/30 p-2 rounded block border border-emerald-500/20">
                {redirectUri}
              </code>
              <p className="text-[10px] text-zinc-500 mt-2 italic">
                You must add this exact URL to your Spotify App settings. If you
                share this app, the URL will change, and you'll need to add the
                new one too.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-800/50 bg-zinc-900/30 flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Music className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Spotify Intel
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active
          />
          <SidebarItem icon={<MessageSquare size={18} />} label="AI Chat" />
          <SidebarItem icon={<TrendingUp size={18} />} label="Insights" />
          <SidebarItem icon={<History size={18} />} label="Recent" />
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={
                  user?.images?.[0]?.url ||
                  "https://picsum.photos/seed/user/100/100"
                }
                alt="User"
                className="w-10 h-10 rounded-full border border-zinc-700"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden">
                <p className="font-medium truncate">{user?.display_name}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-zinc-400">
              AI System Active
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                <Disc className="w-8 h-8 text-emerald-500 animate-spin-slow" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                  How can I help you today?
                </h2>
                <p className="text-zinc-400">
                  Ask me about your favorite artists, create a playlist for a
                  specific mood, or analyze your recent listening trends.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <SuggestionCard
                  title="Analyze Trends"
                  desc="What are my top tracks this month?"
                  onClick={() => setInput("What are my top tracks this month?")}
                />
                <SuggestionCard
                  title="Create Playlist"
                  desc="Make a chill lo-fi playlist for studying"
                  onClick={() =>
                    setInput("Make a chill lo-fi playlist for studying")
                  }
                />
                <SuggestionCard
                  title="Discover Artists"
                  desc="Who are my most listened to artists?"
                  onClick={() =>
                    setInput("Who are my most listened to artists?")
                  }
                />
                <SuggestionCard
                  title="Recent Activity"
                  desc="What have I been listening to lately?"
                  onClick={() =>
                    setInput("What have I been listening to lately?")
                  }
                />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl p-4 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-sm text-zinc-400">
                      Analyzing your music...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-zinc-800/50 bg-[#0a0a0a]">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your Spotify..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-widest">
            Powered by Claude & Spotify API
          </p>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active
          ? "bg-emerald-500/10 text-emerald-500"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function SuggestionCard({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-left hover:border-emerald-500/50 hover:bg-zinc-800/50 transition-all group"
    >
      <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">
        {title}
      </p>
      <p className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
        {desc}
      </p>
    </button>
  );
}
