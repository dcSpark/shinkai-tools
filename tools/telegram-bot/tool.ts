import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { shinkaiSqliteQueryExecutor } from "./shinkai-local-tools.ts";

const TELEGRAM_API_URL = (BOT_TOKEN: string) => `https://api.telegram.org/bot${BOT_TOKEN}`;

interface State {
  lastUpdateId: number;
}

interface Message {
  chatId: number;
  text: string;
  is_bot: boolean;
  username: string;
  first_name: string;
  date: Date;
}

// Update table creation to use TEXT type for all columns
async function ensureTablesExist() {
  await shinkaiSqliteQueryExecutor({
    query: `
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_update_id TEXT NOT NULL DEFAULT '0'
    );
    `,
    params: []
  });
  await shinkaiSqliteQueryExecutor({
    query: `
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      is_bot TEXT NOT NULL
    );
    `,
    params: []
  });
}

// Update loadState to parse the string back to number
async function loadState(): Promise<State> {
  try {
    const result = await shinkaiSqliteQueryExecutor({
      query: `
      SELECT last_update_id FROM bot_state WHERE id = 1;
      `
    });
    console.log( { result: JSON.stringify(result )});
    return { lastUpdateId: parseInt(result.result[0].last_update_id, 10) };
  } catch (err) {
    const result = await shinkaiSqliteQueryExecutor({
      query: `
      INSERT INTO bot_state (id, last_update_id) values (1, '0'); ;
      `
    });
    console.error("Error loading state:", err);
    return { lastUpdateId: 0 };
  }
}

// Update saveState to convert number to string
async function saveState(state: State) {
  console.log( { saveState: JSON.stringify(state )});

  await shinkaiSqliteQueryExecutor({
    query: `
    UPDATE bot_state 
    SET last_update_id = ?
    WHERE id = 1
    `,
    params: [state.lastUpdateId.toString()]
  });
}

// Update appendChatHistory to convert boolean to string
async function appendChatHistory(username: string, message: string, isBot: boolean) {
  await shinkaiSqliteQueryExecutor({
    query: `
    INSERT INTO chat_history (username, message, is_bot)
    VALUES (?, ?, ?)
    `,
    params: [username, message, isBot ? 'true' : 'false']
  });
}

// Modify main function
async function main(BOT_TOKEN: string, CUSTOM_RULES: string | undefined) {
  await ensureTablesExist();
  let state = await loadState();
  let offset = state.lastUpdateId + 1;

  console.log("Checking for new updates... (offset:", offset, ")");
  const messages: Message[] = [];
  
  try {
    const res = await fetch(`${TELEGRAM_API_URL(BOT_TOKEN)}/getUpdates?offset=${offset}`);
    const data = await res.json();

    if (!data.ok) {
      console.error("Telegram API returned an error:", data);
      return;
    }

    // First loop: collect and log all new messages
    for (const update of data.result) {
      const updateId = update.update_id;
      if (updateId > state.lastUpdateId) {
        state.lastUpdateId = updateId;
      } else {
        continue;
      }

      if (update.message) {
        
        /*
        {
          update_id: 419044111,
          message: {
            message_id: 16,
            from: {
              id: 5670030839,
              is_bot: false,
              first_name: "Eddie",
              username: "edwardac",
              language_code: "en"
            },
            chat: {
              id: 5670030839,
              first_name: "Eddie",
              username: "edwardac",
              type: "private"
            },
            date: 1739234660,
            text: "how many r in strrawberries"
          }
        }
        */
        const chatId = update.message.chat.id;
        const text = update.message.text || "";
        const is_bot = update.message.from.is_bot || false;
        const username = update.message.from.username || '';
        const first_name = update.message.from.first_name || '';
        const date = new Date(update.date * 1000);

        messages.push({ chatId, text, is_bot, username, first_name, date });
        // Log user message
        await appendChatHistory(username || first_name, text, false);
      }
    }

    // Second loop: process messages by user and send one response per user
    const userMessages = new Map<string, { chatId: number, messages: string[] }>();
    
    for (const msg of messages) {
      const userKey = msg.username || msg.first_name;
      if (!userMessages.has(userKey)) {
        userMessages.set(userKey, { chatId: msg.chatId, messages: [] });
      }
      userMessages.get(userKey)?.messages.push(msg.text);
    }

    // Process each user's messages
    for (const [username, data] of userMessages) {
      if (data.messages.length > 0) {
        try {
          // Get chat history from database
          const chatHistoryResult = await shinkaiSqliteQueryExecutor({
            query: `
            SELECT timestamp, is_bot, message 
            FROM chat_history 
            WHERE username = ?
            ORDER BY timestamp DESC
            LIMIT 50
            `,
            params: [username]
          });

          const chatHistory = chatHistoryResult.result
            .map((row: any) => `${row.timestamp} [${row.is_bot === 'true' ? 'BOT' : username}] ${row.message}`)
            .reverse()
            .join('\n');
          
          const rules = CUSTOM_RULES || `* Please respond to this chat with something witty, and make it easy to keep the conversation going.`;
          const prompt = `
<SYSTEM>
    * This is a chat history with a user.
    * You are the "BOT" in the CHAT_HISTORY tag .
    * The chat history is in the format TIMESTAMP [SENDER] MESSAGE
    * Follow the RULES tag to generate the response.
    * Use FORMAT tag to format the response.
</SYSTEM>

<CHAT_HISTORY>
${chatHistory}
</CHAT_HISTORY>

<RULES>
${rules}
</RULES>

<FORMAT>
    * Please respond in the same language as the user's message.
    * Respond in plain text.
    * Aviod comments, ideas suggestions aside from the response.
</FORMAT>
          `;
          console.log(prompt);
          const response = await shinkaiLlmPromptProcessor({
            prompt: prompt,
            format: "text"
          });
          messages.push({
            chatId: data.chatId,
            text: response.message,
            is_bot: true,
            username: 'BOT',
            first_name: 'BOT',
            date: new Date()
          });
          // Log bot response
          await appendChatHistory(username, response.message, true);
          
          // Send the response
          const replyUrl = `${TELEGRAM_API_URL(BOT_TOKEN)}/sendMessage?chat_id=${data.chatId}&text=${encodeURIComponent(response.message)}`;
          await fetch(replyUrl);
        } catch (err) {
          console.error(`Error processing messages for user ${username}:`, err);
        }
      }
    }

    if (state.lastUpdateId) {
      // Save updated state back to the database
      await saveState(state);
    }

  } catch (err) {
    console.error("Error fetching updates:", err);
  }
  return messages;
}

type CONFIG = {
  BOT_TOKEN: string;
  CUSTOM_RULES: string | undefined;
};
type INPUTS = {};
type OUTPUT = {};

export async function run(config: CONFIG, parameters: INPUTS): Promise<OUTPUT> {
    const BOT_TOKEN = config.BOT_TOKEN;
    const CUSTOM_RULES = config.CUSTOM_RULES;
    return { messages: await main(BOT_TOKEN, CUSTOM_RULES) };
}