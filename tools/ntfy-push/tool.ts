import axios from 'npm:axios@1.7.7';

type Configurations = {
  serverUrl?: string;
  topic: string;
};

type Parameters = {
  message: string;
  title?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string;
};

type Result = {
  success: boolean;
  message: string;
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (
  config: C,
  inputs: I
) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters
): Promise<Result> => {
  try {
    const serverUrl = configurations.serverUrl || 'https://ntfy.sh';
    const { topic } = configurations; // Accessing topic from configurations
    const { message, title, priority, tags } = params;

    // Build request headers
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
    };

    if (title) {
      headers['Title'] = title;
    }

    if (priority) {
      headers['Priority'] = priority;
    }

    if (tags) {
      headers['Tags'] = tags;
    }

    // Send notification using ntfy's HTTP API
    const response = await axios.post(
      `${serverUrl}/${topic}`,
      message,
      { headers }
    );

    if (response.status === 200) {
      return {
        success: true,
        message: 'Notification sent successfully'
      };
    } else {
      return {
        success: false,
        message: `Failed to send notification: HTTP ${response.status}`
      };
    }
  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      message: `Error: ${errorMessage}`
    };
  }
};
