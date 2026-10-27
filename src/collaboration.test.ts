import { describe, expect, it } from 'vitest';
import { fromBase64, readShareLink, serverUrl, shareLink, sharedId, toBase64, validAccess } from '../shared/collaboration';
import { makeBackup, readBackup } from './backup';

const access = { server: 'https://texla.example', room: 'a'.repeat(32), token: 'b'.repeat(64), ownerToken: 'c'.repeat(64) };
describe('sharing capabilities and backups', () => {
  it('keeps editing access in the fragment and never includes the owner capability', () => {
    const link = shareLink(access, 'https://example.com/texla-mvp/?old=yes#old'); const url = new URL(link);
    expect(url.search).toBe(''); expect(url.pathname).toBe('/texla-mvp/'); expect(link).not.toContain(access.ownerToken);
    expect(readShareLink(url.hash)).toEqual({ server: access.server, room: access.room, token: access.token });
    expect(sharedId(access)).not.toBe(sharedId({ ...access, server: 'https://another.example' }));
  });
  it('only accepts HTTPS endpoints and local development addresses', () => {
    expect(serverUrl('https://texla.example/')).toBe('https://texla.example'); expect(serverUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
    for (const url of ['http://public.example', 'https://user:secret@texla.example', 'javascript:alert(1)', 'https://texla.example/path', 'https://texla.example/?token=yes']) expect(() => serverUrl(url)).toThrow();
    expect(validAccess({ ...access, token: 'guess' })).toBe(false); expect(() => readShareLink('#share=invalid')).toThrow(); expect(readShareLink('')).toBeNull();
  });
  it('round-trips binary CRDT updates without altering bytes', () => {
    const bytes = Uint8Array.from({ length: 50000 }, (_, i) => i % 256); expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
  it('exports independent documents without granting access to the shared original', () => {
    const backup = makeBackup({ id: sharedId(access), shared: access, title: 'Tesis', content: { type: 'doc', content: [{ type: 'paragraph' }] }, updated: 0 });
    expect(backup).not.toContain(access.token); expect(backup).not.toContain(access.ownerToken); expect(readBackup(backup).shared).toBeUndefined();
  });
});
