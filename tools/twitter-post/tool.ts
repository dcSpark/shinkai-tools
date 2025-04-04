import { getAccessToken } from './shinkai-local-support.ts';

type CONFIG = {};
type INPUTS = {
    text: string;
    imagePath?: string;
};
type OUTPUT = {
    data: any;
};

async function uploadMedia(bearerToken: string, imagePath: string): Promise<string> {
  try {
    const imageData = await Deno.readFile(imagePath);
    const formData = new FormData();
    formData.append('media', new Blob([imageData]));
    formData.append('media_category', 'tweet_image');
    const url = 'https://upload.twitter.com/1.1/media/upload.json?media_category=tweet_image';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Media upload failed: ${response.status} : ${response.statusText}`);
    }

    const data = await response.json();
    return data.media_id_string;
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

async function postTweet(bearerToken: string, text: string, mediaId?: string) {
  try {
    const url = 'https://api.x.com/2/tweets';
    const tweetBody: any = { text };
    
    if (mediaId) {
      tweetBody.media = {
        media_ids: [mediaId]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetBody)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status} : ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Tweet posted:', data);
    return data;
  } catch (error) {
    console.error('Error posting tweet:', error);
    throw error;
  }
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {    
    const accessToken = await getAccessToken("twitter");
    let mediaId: string | undefined;
    
    if (inputs.imagePath) {
      mediaId = await uploadMedia(accessToken, inputs.imagePath);
    }
    
    return { data: await postTweet(accessToken, inputs.text, mediaId) };
}
