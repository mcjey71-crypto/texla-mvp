// Read-only release check. It never creates documents or sends stored user content.
import assert from 'node:assert/strict';

const endpoint = new URL(process.env.VITE_COLLABORATION_URL);
const origin = 'https://mcjey71-crypto.github.io';
assert.equal(endpoint.protocol, 'https:', 'The collaboration server must use HTTPS.');
const health = await fetch(new URL('/health', endpoint), {
  headers: { Origin: origin }, signal: AbortSignal.timeout(20000), redirect: 'error',
});
assert.equal(health.status, 200, 'The collaboration server did not return HTTP 200.');
assert.equal(health.headers.get('access-control-allow-origin'), origin, 'The server must allow the Texla website origin.');
const data = await health.json();
assert.equal(data.service, 'texla-collaboration');
assert.equal(data.version, 1, 'The server protocol is incompatible with this client.');
const preflight = await fetch(new URL('/rooms', endpoint), {
  method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  signal: AbortSignal.timeout(20000), redirect: 'error',
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
assert.ok(preflight.headers.get('access-control-allow-methods')?.split(',').map(method => method.trim()).includes('POST'));
assert.ok(preflight.headers.get('access-control-allow-headers')?.toLowerCase().split(',').map(header => header.trim()).includes('content-type'));
console.log('Collaboration service responds correctly and allows requests from the Texla website.');
