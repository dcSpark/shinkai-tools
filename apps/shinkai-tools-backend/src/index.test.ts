import { fastify } from './index';

test('GET /health', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/health',
  });
  expect(response.json().status).toBe('ok');
});

test('GET /tool/definition', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/tool/run',
    body: {
      code: `
                class BaseTool {
        constructor(config) {
            this.config = config;
        }
        setConfig(value) {
            this.config = value;
            return this.config;
        }
        getConfig() {
            return this.config;
        }
    }
    class Tool extends BaseTool {
        constructor(config) {
            super(config);
        }
        async run() {
            const result = await new Promise((resolve) => {
                setTimeout(() => {
                    resolve(100);
                }, 200);
            });
            return { data: result };
        }
    }
    globalThis.tool = { Tool };
        `,
    },
  });
  expect(response.json().data).toBe(100);
});
