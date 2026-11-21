export default {
  async fetch(request) {
    if (new URL(request.url).pathname === '/api/message') {
      return new Response('Hello World!');
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
