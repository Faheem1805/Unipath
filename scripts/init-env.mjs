import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.log('.env already exists; preserved.');
  process.exit(0);
}
let content = readFileSync('.env.example', 'utf8');
content = content
  .replaceAll('CHANGE_ME_database_password', randomBytes(24).toString('hex'))
  .replace('CHANGE_ME_random_string_at_least_32_characters', randomBytes(32).toString('hex'));
writeFileSync('.env', content, { mode: 0o600 });
console.log('Created .env with random local credentials.');
