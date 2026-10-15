// EXAMPLE ONLY — a throwaway backend for the spike e2e. Its endpoints and shapes are not a template contract.
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_PORT ?? 4010);
const hits = { items: 0, itemsAuthorized: 0, login: 0 };

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (req.method === 'GET' && url.pathname === '/__hits') return json(res, 200, hits);
  if (req.method === 'GET' && url.pathname === '/items') {
    hits.items += 1;
    if (req.headers.authorization) hits.itemsAuthorized += 1;
    const renderedAt = new Date().toISOString();
    return json(res, 200, [
      { id: 'a', name: 'Alpha', renderedAt },
      { id: 'b', name: 'Beta', renderedAt },
    ]);
  }
  if (req.method === 'POST' && url.pathname === '/auth/login') {
    hits.login += 1;
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const { username, password } = JSON.parse(raw || '{}');
    if (!username || password !== 'secret') return json(res, 401, { type: 'invalid_credentials' });
    return json(res, 200, { userId: `u-${username}`, name: username, accessToken: `token-${crypto.randomUUID()}` });
  }
  json(res, 404, { type: 'not_found' });
}).listen(port, '127.0.0.1', () => console.log(`mock backend on ${port}`));
