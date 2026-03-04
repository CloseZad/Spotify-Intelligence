import Anthropic from "@anthropic-ai/sdk";
import { getSpotifyClient } from "../../server";
import type {
  MessageParam,
  Tool,
  ToolUseBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources";

const tools: Tool[] = [
  {
    name: "get_top_tracks",
    description: "Get the user's top tracks from Spotify.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_top_artists",
    description: "Get the user's top artists from Spotify.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_tracks",
    description: "Get the user's recently played tracks from Spotify.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_tracks",
    description: "Search for tracks on Spotify by query.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (e.g., track name, artist).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_playlist",
    description: "Create a new playlist on the user's Spotify account.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the playlist." },
        description: {
          type: "string",
          description: "A brief description of the playlist.",
        },
        trackUris: {
          type: "array",
          items: { type: "string" },
          description: "An array of Spotify track URIs to add to the playlist.",
        },
      },
      required: ["name", "trackUris"],
    },
  },
];

const systemInstruction = `You are Spotify Intelligence, an AI assistant that helps users understand their listening habits and manage their Spotify account.
You can fetch their top tracks, top artists, recently played tracks, search for songs, and create playlists.
When a user asks a question about their favorites or trends, use the tools to get the data first.
When a user wants to create a playlist, search for relevant tracks if they don't provide specific ones, and then use the create_playlist tool.
Always be helpful, concise, and professional.`;

export const claudeService = {
  async chat(message: string, history: MessageParam[] = []) {
    // Initialize inside the function so dotenv has already run
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const messages: MessageParam[] = [...history];
    messages.push({ role: "user", content: message });

    let keepLooping = true;
    let finalResponseText = "";

    while (keepLooping) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemInstruction,
        messages,
        tools,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter(
          (block): block is ToolUseBlock => block.type === "tool_use"
        );

        const toolResults: ToolResultBlockParam[] = [];

        for (const call of toolUses) {
          let result;
          const args = call.input as any;

          try {
            const client = getSpotifyClient();

            if (call.name === "get_top_tracks") {
              const data = await client.getMyTopTracks({ limit: 20 });
              result = data.body.items;
            } else if (call.name === "get_top_artists") {
              const data = await client.getMyTopArtists({ limit: 20 });
              result = data.body.items;
            } else if (call.name === "get_recent_tracks") {
              const data = await client.getMyRecentlyPlayedTracks({
                limit: 20,
              });
              result = data.body.items.map((item: any) => item.track);
            } else if (call.name === "search_tracks") {
              const data = await client.search(args.query, ["track"]);
              result = data.body.tracks?.items;
            } else if (call.name === "create_playlist") {
              const playlist = await client.createPlaylist(args.name, {
                description: args.description ?? "",
                public: false,
              });
              if (args.trackUris?.length > 0) {
                await client.addTracksToPlaylist(
                  playlist.body.id,
                  args.trackUris
                );
              }
              result = playlist.body;
            } else {
              result = { error: `Tool ${call.name} is not implemented.` };
            }
          } catch (error) {
            console.error(`Error executing ${call.name}:`, error);
            result = { error: "Failed to execute function." };
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result),
          });
        }

        messages.push({ role: "user", content: toolResults });
      } else {
        const textBlock = response.content.find(
          (block) => block.type === "text"
        );
        finalResponseText =
          textBlock && textBlock.type === "text" ? textBlock.text : "";
        keepLooping = false;
      }
    }

    return { text: finalResponseText, history: messages };
  },
};
