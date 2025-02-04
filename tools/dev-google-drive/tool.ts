import { getAccessToken } from './shinkai-local-support.ts';

type CONFIG = {};
type INPUTS = { url: string, method: string, body?: string, query_params?: string, headers?: Record<string, string> };
type OUTPUT = { status: number, statusText: string, data: any };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const accessToken = await getAccessToken('GoogleDrive');
    
    const url = new URL(inputs.url);
    if (inputs.query_params) {
        url.search += inputs.query_params;
    }

    const headers = new Headers({
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...inputs.headers
    });

    const options: RequestInit = {
        method: inputs.method,
        headers: headers
    };

    if (inputs.body) {
        headers.set('Content-Type', 'application/json');
        options.body = inputs.body;
    }

    const response = await fetch(url, options);
    let data;
    try {
        data = await response.json();
    } catch (error) {
        console.log(error);
        data = await response.text();
    }

    return {
        status: response.status,
        statusText: response.statusText,
        data: data
    };
}
