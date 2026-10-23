import { describe, expect, it } from 'vitest';
import { readConfig } from '../../backend/src/config.js';
const production = {
  DATABASE_URL: 'postgresql://runtime:synthetic@database/app',
  RATE_LIMIT_SECRET: 'synthetic-test-private-rate-secret-32-characters',
  NODE_ENV: 'production',
  COOKIE_SECURE: 'true',
  CORS_ORIGINS: 'https://staging.example.test',
  TRUST_PROXY_HOPS: '1',
};
describe('production safety', () => {
  it('requires secure cookies, exact HTTPS origins and private secrets', () => {
    expect(readConfig(production).secureCookie).toBe(true);
    for (const change of [
      { COOKIE_SECURE: 'false' },
      { CORS_ORIGINS: 'http://localhost:8080' },
      { CORS_ORIGINS: 'https://staging.example.test/path' },
      { CORS_ORIGINS: '*' },
      { RATE_LIMIT_SECRET: 'CHANGE_ME_secret_at_least_32_characters' },
    ])
      expect(() => readConfig({ ...production, ...change })).toThrow();
  });
  it('keeps development cookies and origins usable without proxy trust', () => {
    const config = readConfig({
      DATABASE_URL: production.DATABASE_URL,
      RATE_LIMIT_SECRET: production.RATE_LIMIT_SECRET,
    });
    expect(config.secureCookie).toBe(false);
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.origins).toEqual(['http://localhost:5173']);
  });
});
