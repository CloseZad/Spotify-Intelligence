import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

import { getSpotifyClient } from "../../server";

const getTopTracksTool: FunctionDeclaration = {
  name: "get_top_tracks",
  description: "Get the user's top tracks from Spotify.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getTopArtistsTool: FunctionDeclaration = {
  name: "get_top_artists",
  description: "Get the user's top artists from Spotify.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getRecentTracksTool: FunctionDeclaration = {
  name: "get_recent_tracks",
  description: "Get the user's recently played tracks from Spotify.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const searchTracksTool: FunctionDeclaration = {
  name: "search_tracks",
  description: "Search for tracks on Spotify by query.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query (e.g., track name, artist).",
      },
    },
    required: ["query"],
  },
};

const createPlaylistTool: FunctionDeclaration = {
  name: "create_playlist",
  description: "Create a new playlist on the user's Spotify account.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The name of the playlist." },
      description: {
        type: Type.STRING,
        description: "A brief description of the playlist.",
      },
      trackUris: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "An array of Spotify track URIs to add to the playlist.",
      },
    },
    required: ["name", "trackUris"],
  },
};

const tools = [
  {
    functionDeclarations: [
      getTopTracksTool,
      getTopArtistsTool,
      getRecentTracksTool,
      searchTracksTool,
      createPlaylistTool,
    ],
  },
];

export const geminiService = {
  async chat(message: string, history: any[] = []) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are Spotify Intelligence, an AI assistant that helps users understand their listening habits and manage their Spotify account.
        You can fetch their top tracks, top artists, recently played tracks, search for songs, and create playlists.
        When a user asks a question about their favorites or trends, use the tools to get the data first.
        When a user wants to create a playlist, search for relevant tracks if they don't provide specific ones, and then use the create_playlist tool.
        Always be helpful, concise, and professional.`,
        tools,
      },
      history,
    });

    let response = await chat.sendMessage({ message });
    let functionCalls = response.functionCalls;

    while (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];
      for (const call of functionCalls) {
        let result;
        try {
          const client = getSpotifyClient();

          if (call.name === "get_top_tracks") {
            const data = await client.getMyTopTracks({ limit: 20 });
            result = data.body.items;
          } else if (call.name === "get_top_artists") {
            const data = await client.getMyTopArtists({ limit: 20 });
            result = data.body.items;
          } else if (call.name === "get_recent_tracks") {
            const data = await client.getMyRecentlyPlayedTracks({ limit: 20 });
            result = data.body.items.map((item: any) => item.track);
          } else if (call.name === "search_tracks") {
            const data = await client.search(call.args.query as string, [
              "track",
            ]);
            result = data.body.tracks?.items;
          } else if (call.name === "create_playlist") {
            const playlist = await client.createPlaylist(
              call.args.name as string,
              {
                description: (call.args.description as string) || "",
                public: false,
              }
            );
            if (
              call.args.trackUris &&
              (call.args.trackUris as string[]).length > 0
            ) {
              await client.addTracksToPlaylist(
                playlist.body.id,
                call.args.trackUris as string[]
              );
            }
            result = playlist.body;
          }
        } catch (error) {
          result = { error: "Failed to execute function." };
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result },
            id: call.id,
          },
        });
      }

      const nextResponse = await chat.sendMessage({
        message: {
          parts: functionResponses,
        } as any,
      });

      response = nextResponse;
      functionCalls = response.functionCalls;
    }

    return {
      text: response.text,
      history: await chat.getHistory(),
    };
  },
};
