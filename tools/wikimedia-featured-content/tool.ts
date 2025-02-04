import axios from 'npm:axios';

type Configurations = {
  project?: string;
  language?: string;
};

type Parameters = {
  date?: string;
};

type Result = {
  featured: {
    tfa: {
      title: string;
      extract: string;
      url: string;
    };
    image: {
      title: string;
      description: string;
      url: string;
    };
    news: Array<{
      story: string;
      links: Array<{
        title: string;
        url: string;
      }>;
    }>;
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
    
    // Format date as YYYY/MM/DD
    let date: string;
    if (params.date) {
      const d = new Date(params.date);
      date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    } else {
      const d = new Date();
      date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }
    
    const api_url = `https://api.wikimedia.org/feed/v1/${project}/${language}/featured/${date}`;
    
    const response = await axios.get(api_url, {
      headers: {
        'User-Agent': 'ShinkaiWikimediaFeaturedContent/1.0',
        'Accept': 'application/json',
        'Api-User-Agent': 'ShinkaiWikimediaFeaturedContent/1.0 (https://github.com/dcSpark/shinkai-tools)'
      }
    });

    if (!response.data) {
      throw new Error('No data received from Wikimedia API');
    }

    const { tfa, image, news } = response.data;

    if (!tfa || !image) {
      throw new Error('Required data missing from API response');
    }

    return {
      featured: {
        tfa: {
          title: tfa.title,
          extract: tfa.extract || tfa.description || '',
          url: `https://${language}.${project}.org/wiki/${encodeURIComponent(tfa.title.replace(/ /g, '_'))}`
        },
        image: {
          title: image.title,
          description: image.description?.text || '',
          url: image.image?.source || image.thumbnail?.source || ''
        },
        news: (news || []).map((item: any) => ({
          story: item.story || '',
          links: (item.links || []).map((link: any) => ({
            title: link.title || '',
            url: `https://${language}.${project}.org/wiki/${encodeURIComponent((link.title || '').replace(/ /g, '_'))}`
          }))
        }))
      }
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`No featured content found for the specified date`);
      }
      throw new Error(`Failed to fetch featured content: ${error.response?.data?.detail || error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};
