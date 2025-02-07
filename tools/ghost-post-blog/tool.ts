import GhostAdminAPI from "https://esm.sh/@tryghost/admin-api@1.4.0";

type CONFIG = {
  apiKey: string;
  ghostUrl: string;
};

type INPUTS = {
  title: string;
  body: string;
  publish?: boolean;
};

type OUTPUT = {
  id: string;
  url: string;
};


const getApi = (API_URL: string, API_KEY: string) => {
  const api = new GhostAdminAPI({
    url: API_URL,
    key: API_KEY,
    version: "v3" // Change this if you use a different API version.
  });

  /**
  * Creates a new article (as a draft) in your Ghost blog.
  *
  * @param title - The title of the article.
  * @param body - The HTML content of the article.
  * @returns An object with the created article's `id` and `url`.
  */
  async function createArticle(
    title: string,
    body: string
  ): Promise<{ id: string; url: string }> {
    const children = body.split(/\n+/).map(line => ({
      "type":"markdown",
      "version":1,
      "markdown":line
    }));
    const lexical = {
      "root":{
        "children":children,
        "direction":null,
        "format":"",
        "indent":0,
        "version":1
      }
    }
    try {
      const post = await api.posts.add({
        title: title,
        lexical: JSON.stringify(lexical),
        status: "draft" // Create as a draft; publish later with publishArticle().
      });

      // The API response should include the article id.
      // Note: The URL may only be available after publishing. In drafts it might be empty.
      return { id: post.id, url: post.url || "" };
    } catch (error) {
      console.error("Error creating article:", error);
      throw error;
    }
  }
  /**
  * Publishes an existing article by updating its status to "published".
  *
  * @param articleId - The ID of the article to publish.
  * @returns An object with the published article's `id` and `url`.
  */
  async function publishArticle(
    articleId: string
  ): Promise<{ id: string; url: string }> {
    try {
      // Update the post by setting its status to "published".
      const publishedPost = await api.posts.edit({
        id: articleId,
        status: "published"
      });
      
      // After publishing, the URL should be available.
      return { id: publishedPost.id, url: publishedPost.url };
    } catch (error) {
      console.error("Error publishing article:", error);
      throw error;
    }
  }
  return { createArticle, publishArticle }
}


export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { apiKey } = config;
  const { title, body } = inputs;
  const { createArticle, publishArticle } = getApi(config.ghostUrl, apiKey);
  const article = await createArticle(title, body);
  inputs.publish && await publishArticle(article.id);
  return article;
}
