import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { cors } from 'hono/cors';
import logger from './libs/logger.js';
import Users from './api/Users.js';
import Store from './api/Store.js';

const app = new Hono();
const users = new Users();
const store = new Store();

// CORS
app.use('*', cors({
  origin: '*'
}));


// Custom logger for Hono
export const customLogger = (message: string, ...rest: any[]) => {
  if (rest.length > 1) {
    logger.info({ data: rest }, message);
  } else if (rest.length > 0 ) {
    logger.info(rest[0], message);
  } else {
    logger.info({}, message);
  }
}
app.use(honoLogger(customLogger));

// Users API endpoints
app.get('/user/me', async (c) => users.getMe(c));
app.post('/user/update', async (c) => users.updateUser(c));

// Store API endpoints
app.get('/store', async (c) => store.getStore(c));

// Root endpoint
app.get('/', (c) => {
  return c.json({ message: 'Shinkai Store API Server is running.' }, { status: 200 });
});

// Start server
const port = process.env.PORT ? Number(process.env.PORT) : 3300;
serve({
  fetch: app.fetch,
  port
});

logger.info(`Server is running on http://localhost:${port}`);