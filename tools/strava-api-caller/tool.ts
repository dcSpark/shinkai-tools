import { getAccessToken } from './shinkai-local-support.ts';

type CONFIG = {};

type INPUTS = {
  endpoint: 'activities' | 'athlete' | 'zones';
  params?: Record<string, any>;
};

type OUTPUT = {
  data?: any;
  error?: string;
};

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

async function callStravaApi(
  endpoint: string,
  accessToken: string,
  params?: Record<string, any>
): Promise<any> {
  let url = new URL(`${STRAVA_API_BASE}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Strava API error: ${response.status} ${response.statusText} - ${errText}`);
  }

  return await response.json();
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  try {
    const { endpoint, params } = inputs;
    // Get access token for Strava
    // The scopes needed depend on endpoint:
    // activities: activity:read or activity:read_all
    // athlete: profile:read or profile:read_all
    // zones: profile:read_all

    let requiredScope = '';
    switch (endpoint) {
      case 'activities':
        // We request activity:read scope as minimum.
        requiredScope = 'activity:read';
        break;
      case 'athlete':
        // profile:read scope minimum
        requiredScope = 'profile:read';
        break;
      case 'zones':
        // Requires profile:read_all
        requiredScope = 'profile:read_all';
        break;
      default:
        return { error: 'Invalid endpoint specified' };
    }

    const accessToken = await getAccessToken('strava-full');

    if (!accessToken) {
      return { error: 'Failed to get access token for Strava' };
    }

    switch (endpoint) {
      case 'activities':
        // GET /athlete/activities
        // params can be: before, after, page, per_page
        return {
          data: await callStravaApi('/athlete/activities', accessToken, params),
        };
      case 'athlete':
        // GET /athlete
        return {
          data: await callStravaApi('/athlete', accessToken),
        };
      case 'zones':
        // GET /athlete/zones
        return {
          data: await callStravaApi('/athlete/zones', accessToken),
        };
    }

    return { error: 'Unhandled endpoint' };
  } catch (error: any) {
    return { error: error.message ?? String(error) };
  }
}