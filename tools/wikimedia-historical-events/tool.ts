import axios from 'npm:axios';

type Configurations = {
  project?: string;
  language?: string;
};

type Parameters = {
  date?: string;
  type?: 'all' | 'events' | 'births' | 'deaths' | 'holidays';
};

type HistoricalEvent = {
  text: string;
  year: string;
  links: Array<{
    title: string;
    url: string;
  }>;
};

type Result = {
  events: {
    selected_date: string;
    events?: HistoricalEvent[];
    births?: HistoricalEvent[];
    deaths?: HistoricalEvent[];
    holidays?: HistoricalEvent[];
  };
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
    const project = configurations?.project || 'wikipedia';
    const language = configurations?.language || 'en';
    const type = params.type || 'all';

    // Parse and format the date
    let month: string;
    let day: string;
    
    if (params.date) {
      const d = new Date(params.date);
      month = String(d.getMonth() + 1).padStart(2, '0');
      day = String(d.getDate()).padStart(2, '0');
    } else {
      const d = new Date();
      month = String(d.getMonth() + 1).padStart(2, '0');
      day = String(d.getDate()).padStart(2, '0');
    }
    
    const api_url = `https://api.wikimedia.org/feed/v1/${project}/${language}/onthisday/${type}/${month}/${day}`;
    
    const response = await axios.get(api_url, {
      headers: {
        'User-Agent': 'ShinkaiWikimediaHistoricalEvents/1.0',
        'Accept': 'application/json',
        'Api-User-Agent': 'ShinkaiWikimediaHistoricalEvents/1.0 (https://github.com/dcSpark/shinkai-tools)'
      }
    });

    if (!response.data) {
      throw new Error('No data received from Wikimedia API');
    }

    const formatEvents = (events: any[]): HistoricalEvent[] => {
      if (!Array.isArray(events)) return [];
      return events.map(event => ({
        text: event.text || '',
        year: (event.year || '').toString(),
        links: (event.pages || []).map((page: any) => ({
          title: page.title || '',
          url: `https://${language}.${project}.org/wiki/${encodeURIComponent((page.title || '').replace(/ /g, '_'))}`
        }))
      }));
    };

    const result: Result = {
      events: {
        selected_date: params.date || new Date().toISOString().split('T')[0]
      }
    };

    if (type === 'all' || type === 'events') {
      result.events.events = formatEvents(response.data.events || []);
    }
    if (type === 'all' || type === 'births') {
      result.events.births = formatEvents(response.data.births || []);
    }
    if (type === 'all' || type === 'deaths') {
      result.events.deaths = formatEvents(response.data.deaths || []);
    }
    if (type === 'all' || type === 'holidays') {
      result.events.holidays = formatEvents(response.data.holidays || []);
    }

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`No historical events found for the specified date`);
      }
      throw new Error(`Failed to fetch historical events: ${error.response?.data?.detail || error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};
