export type CONFIG = {
  discord_token: string;
};

export type INPUTS = {
  channelId: string;
  userIds?: string; // Comma-separated user IDs (e.g., "123456789,987654321")
  limit?: number;
};

export type OUTPUT = {
  messages: {
    id: string;
    content: string;
    author: string;
    authorId: string;             
    timestamp: string;
    attachments: {               
      id: string;
      url: string;
      filename: string;
    }[];
    embeds: {                   
      title?: string;
      description?: string;
      url?: string;
    }[];
    reactions: {                  
      emoji: string;
      count: number;
    }[];
    repliedTo?: {                 
      messageId: string;
      author: string;
    };
  }[];
  filterInfo?: { // NEW: Filter statistics
    userIds: string[];
    totalFiltered: number;
    totalWithoutFilter: number;
  };
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  // Validate inputs
  if (!config.discord_token) {
    throw new Error("Discord token is missing in config.");
  }
  if (!inputs.channelId) {
    throw new Error("Channel ID is missing in inputs.");
  }
  const effectiveLimit = inputs.limit ?? 25;
  if (effectiveLimit <= 0) {
    throw new Error("Limit must be a positive number.");
  }

  // NEW: Parse user IDs for filtering
  const targetUserIds = inputs.userIds 
    ? inputs.userIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];
  
  const isFilteringUsers = targetUserIds.length > 0;

  const url = `https://discord.com/api/v10/channels/${inputs.channelId}/messages?limit=${effectiveLimit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bot ${config.discord_token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
  }

  const messagesData = await response.json();

  // Map the discord message structure to our output format
  const allMessages = (messagesData as any[]).map(message => ({
    id: message.id,
    content: message.content,
    author: message.author?.username || "Unknown",
    authorId: message.author?.id || "",                          
    timestamp: message.timestamp,
    attachments: message.attachments?.map((att: any) => ({     
      id: att.id,
      url: att.url,
      filename: att.filename
    })) || [],
    embeds: message.embeds?.map((emb: any) => ({               
      title: emb.title,
      description: emb.description,
      url: emb.url
    })) || [],
    reactions: message.reactions?.map((rxn: any) => ({        
      emoji: rxn.emoji?.name || rxn.emoji?.id || "👍",
      count: rxn.count
    })) || [],
    repliedTo: message.referenced_message ? {                    
      messageId: message.message_reference?.message_id || "",
      author: message.referenced_message.author?.username || "Unknown"
    } : undefined
  }));

  // NEW: Filter messages by user IDs if specified
  const filteredMessages = isFilteringUsers 
    ? allMessages.filter(msg => targetUserIds.includes(msg.authorId))
    : allMessages;

  // NEW: Build filter info
  const output: OUTPUT = { 
    messages: filteredMessages 
  };

  if (isFilteringUsers) {
    output.filterInfo = {
      userIds: targetUserIds,
      totalFiltered: filteredMessages.length,
      totalWithoutFilter: allMessages.length
    };
  }

  return output;
}