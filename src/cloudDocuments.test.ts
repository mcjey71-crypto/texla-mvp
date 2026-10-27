import { describe, expect, it } from 'vitest';
import { cloudPayload } from './cloudDocuments';
import { publicConfiguration } from './supabase';

describe('account configuration and document payloads', () => {
  it('accepts only a complete public configuration', () => {
    expect(publicConfiguration(undefined, undefined)).toBeNull();
    expect(publicConfiguration('https://project.supabase.co', 'sb_publishable_example')).toEqual({url:'https://project.supabase.co', key:'sb_publishable_example'});
    for (const key of ['sb_secret_private', 'service_role', 'eyJhbGciOiJIUzI1NiJ9', 'Pegue su clave']) expect(() => publicConfiguration('https://project.supabase.co', key)).toThrow();
    expect(() => publicConfiguration('http://project.supabase.co', 'sb_publishable_example')).toThrow();
    expect(() => publicConfiguration('https://project.supabase.co', '')).toThrow();
  });
  it('never uploads sharing capabilities or cloud account metadata', () => {
    const payload = cloudPayload({ id:'local', title:'Tesis', updated:1, content:{type:'doc',content:[{type:'paragraph'}]}, shared:{server:'https://example.com',room:'room',token:'private-edit-token',ownerToken:'private-owner-token'},cloud:{ownerId:'private-account',revision:5,dirty:true} });
    expect(JSON.stringify(payload)).not.toContain('private-'); expect(payload.document.title).toBe('Tesis');
    expect(() => cloudPayload({id:'large',title:'Grande',updated:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x'.repeat(1024*1024)}]}]}})).toThrow();
  });
});
