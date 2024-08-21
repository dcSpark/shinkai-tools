import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import z from 'zod';
import { BaseTool } from '@shinkai_protocol/shinkai-tools-builder';

export const fastify = Fastify({
  logger: true,
});

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.withTypeProvider<ZodTypeProvider>().route({
  method: 'GET',
  url: '/health',
  schema: {
    response: {
      200: z.object({ status: z.enum(['ok']) }),
    },
  },
  handler: function (request, reply) {
    return { status: 'ok' as const };
  },
});

fastify.withTypeProvider<ZodTypeProvider>().route({
  method: 'POST',
  url: '/tool/definition',
  schema: {
    body: z.object({
      code: z.string(),
    }),
    response: {
      200: z.any(),
    },
  },
  bodyLimit: 10485760, // 10 MiB to heavy tools
  handler: async function (request, reply) {
    const code = `
        ${request.body.code}
        const toolInstance = new Tool();
        toolInstance;
    `;
    const tool: BaseTool<any, any, any> = eval(code);
    const definition = await tool.getDefinition();
    console.log('tool definition', definition);
    return definition;
  },
});

fastify.withTypeProvider<ZodTypeProvider>().route({
  method: 'POST',
  url: '/tool/run',
  schema: {
    body: z.object({
      code: z.any(),
      configurations: z.any(),
      parameters: z.any(),
    }),
  },
  bodyLimit: 10485760, // 10 MiB to heavy tools
  handler: async function (request, reply) {
    const code = `
        ${request.body.code}
        const toolInstance = new Tool(${JSON.stringify(request.body.configurations)});
        toolInstance;
    `;
    const tool: BaseTool<any, any, any> = eval(code);
    tool.setConfig(request.body.configurations);
    const runResult = await tool.run(request.body.parameters);
    console.log('run result', runResult);
    return runResult;
  },
});

const port = parseInt(process.env.PORT || '') || 3000;
fastify.listen({ port }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
