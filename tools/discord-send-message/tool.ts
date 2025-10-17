export type CONFIG = {
  discord_token: string;
};

export type INPUTS = {
  channelId: string;
  content?: string;
  replyToMessageId?: string;
  mentionUser?: string; // Remains a string, comma-separated
};

export type OUTPUT = {
  success: boolean;
  message?: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      avatar?: string;
    };
    timestamp: string;
    editedTimestamp?: string;
    embeds: {
      title?: string;
      description?: string;
      url?: string;
      type: string;
    }[];
    reactions: {
      emoji: string;
      count: number;
    }[];
    repliedTo?: {
      messageId: string;
      author: string;
    };
    mentionEveryone: boolean;
    mentions: string[];
    webhookId?: string;
  };
  error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  console.log("🚀 Starting Discord message send...");
  
  // Validate inputs
  if (!config.discord_token) throw new Error("❌ Discord token is missing in config.");
  if (!inputs.channelId) throw new Error("❌ Channel ID is missing in inputs.");
  if (!inputs.content || inputs.content.trim() === '') {
    throw new Error("❌ Content is required.");
  }

  const url = `https://discord.com/api/v10/channels/${inputs.channelId}/messages`;

  let finalContent = inputs.content;
  if (inputs.mentionUser) {
    console.log(`🔔 Mentioning users: ${inputs.mentionUser}`);
    const userIds = inputs.mentionUser.split(',').map(id => id.trim());
    for (const userId of userIds) {
      finalContent = await addMention(finalContent, userId, config.discord_token);
    }
  }

  console.log("📤 Sending message (JSON)...");
  return await sendMessage(url, config.discord_token, finalContent, inputs.replyToMessageId);
}

// ✅ SEND MESSAGE (JSON)
async function sendMessage(
  url: string, token: string, content: string, replyTo?: string
): Promise<OUTPUT> {
  const payload: any = { content };

  if (replyTo) {
    payload.message_reference = { 
      message_id: replyTo, 
      fail_if_not_exists: false 
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Discord Error:", { status: response.status, errorText });
    return { 
      success: false, 
      error: `Failed to send: ${response.status} ${response.statusText} - ${errorText}` 
    };
  }

  const result = await response.json();
  console.log("✅ Message sent! ID:", result.id);
  return { success: true, message: mapDiscordResponse(result) };
}

// ✅ MENTION HELPER
async function addMention(content: string, mentionUser: string, token: string): Promise<string> {
  let mentionFormat = "";
  if (mentionUser.startsWith("<@") && mentionUser.endsWith(">")) {
    mentionFormat = mentionUser;
  } else if (/^\d{17,19}$/.test(mentionUser)) {
    mentionFormat = `<@${mentionUser}>`;
  } else {
    try {
      const userResponse = await fetch(`https://discord.com/api/v10/users/${mentionUser}`, {
        headers: { "Authorization": `Bot ${token}` }
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        mentionFormat = `<@${userData.id}>`;
      } else {
        mentionFormat = `@${mentionUser}`;
      }
    } catch {
      mentionFormat = `@${mentionUser}`;
    }
  }
  return content.includes(mentionFormat) ? content : `${mentionFormat} ${content}`.trim();
}

// ✅ RESPONSE MAPPER (DRY + CLEAN)
function mapDiscordResponse(payload: any) {
  return {
    id: payload.id,
    content: payload.content || "",
    author: {
      id: payload.author.id,
      username: payload.author.username,
      avatar: payload.author.avatar ? `https://cdn.discordapp.com/avatars/${payload.author.id}/${payload.author.avatar}.png` : undefined
    },
    timestamp: payload.timestamp,
    editedTimestamp: payload.edited_timestamp || undefined,
    embeds: payload.embeds?.map((emb: any) => ({
      title: emb.title, description: emb.description, url: emb.url, type: emb.type
    })) || [],
    reactions: payload.reactions?.map((rxn: any) => ({
      emoji: rxn.emoji?.name || rxn.emoji?.id || "👍",
      count: rxn.count
    })) || [],
    repliedTo: payload.message_reference ? {
      messageId: payload.message_reference.message_id,
      author: payload.referenced_message?.author?.username || "Unknown"
    } : undefined,
    mentionEveryone: payload.mention_everyone || false,
    mentions: payload.mentions?.map((m: any) => m.id) || [],
    webhookId: payload.webhook_id || undefined
  };
}