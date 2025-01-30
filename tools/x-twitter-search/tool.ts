type CONFIG = {
    apiKey: string;
};

type INPUTS = {
    command: 'search-top' | 'search-suggestions' | 'search-latest' | 'get-user-posts' | 'get-post-by-id';
    searchQuery?: string;
    username?: string;
    tweetId?: string;
};

type OUTPUT = {
    data: any;
};

const baseUrl = 'https://twttrapi.p.rapidapi.com';

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { apiKey } = config;
    let url: string;

    switch (inputs.command) {
        case 'search-top':
            if (!inputs.searchQuery) {
                throw new Error('"searchQuery" is required for search-top command.');
            }
            url = `${baseUrl}/search-top?query=${inputs.searchQuery}`;
            break;
        case 'search-suggestions':
            if (!inputs.searchQuery) {
                throw new Error('"searchQuery" is required for search-suggestions command.');
            }
            url = `${baseUrl}/search-suggestions?query=${inputs.searchQuery}`;
            break;
        case 'search-latest':
            if (!inputs.searchQuery) {
                throw new Error('"searchQuery" is required for search-latest command.');
            }
            url = `${baseUrl}/search-latest?query=${inputs.searchQuery}`;
            break;
        case 'get-user-posts':
            if (!inputs.username) {
                throw new Error('"username" is required for get-user-posts command.');
            }
            url = `${baseUrl}/user-tweets?username=${inputs.username}`;
            break;
        case 'get-post-by-id':
            if (!inputs.tweetId) {
                throw new Error('"tweetId" is required for get-post-by-id command.');
            }
            url = `${baseUrl}/get-tweet?tweet_id=${inputs.tweetId}`;
            break;
        default:
            throw new Error('Invalid command provided.');
    }


    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'x-rapidapi-host': 'twttrapi.p.rapidapi.com',
            'x-rapidapi-key': apiKey,
        },
    });

    const data = await response.json();
    return { data };
}