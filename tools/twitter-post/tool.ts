import { getAccessToken } from './shinkai-local-support.ts';

type CONFIG = {};
type INPUTS = {
    text: string;
};
type OUTPUT = {
};

async function postTweet(bearerToken: string, text: string) {
  try {
    const url = 'https://api.x.com/2/tweets';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status} : ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Tweet posted:', data);
    return data;
  } catch (error) {
    console.error('Error posting tweet:', error);
    return error;
  }
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const accessToken = await getAccessToken("twitter");
    return await postTweet(accessToken, inputs.text)    
    
}