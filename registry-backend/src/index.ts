import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { PrivyClient } from '@privy-io/server-auth';

const app = new Hono();
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!, // app id
  process.env.PRIVY_APP_SECRET! // app secret
);

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth) {
    return c.text('Unauthorized', { status: 401 });
  }
  try {
    const user = await privy.getUser({ idToken: auth });
    return c.json(user, { status: 200 });
  } catch (e: any) {
    return c.text(e.message, { status: 500 });
  }
})

app.post('/register', async (c) => {
  const auth = c.req.header('Authorization');
  const data = await c.req.json();
  if (!auth) {
    return c.text('Unauthorized', { status: 401 });
  }
  try {
    const user = await privy.getUser({ idToken: auth });
    const metadata = await privy.setCustomMetadata(user.id, data);
    return c.json(metadata, { status: 200 });
  } catch (e: any) {
    return c.text(e.message, { status: 500 });
  }
})

app.get('/', (c) => {
  return c.text('Shinkai Store API Server', { status: 200 });
})

serve({
  fetch: app.fetch,
  port
})
