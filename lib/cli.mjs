#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { connection, availableModels } from './connections.mjs';
import { PublicError } from './oauth.mjs';

const [action, reference, ...extra] = process.argv.slice(2);
try {
  if (extra.length || !['login', 'models', 'logout'].includes(action) || (action !== 'login' && !reference) || (action === 'login' && reference)) throw new PublicError('Usage: cenmax-n8n login | models CONNECTION | logout CONNECTION');
  const id = action === 'login' ? randomBytes(32).toString('hex') : reference;
  if (action === 'login') {
    await connection(id).login(({url, code}) => console.error(`Open ${url}\nApproval code: ${code}`));
    console.error('Connected. Store this connection reference in your n8n Cenmax AI credential; keep it private.');
    console.log(id);
  }
  if (action === 'models') for (const model of await availableModels(id)) console.log(`${model.id}\t${model.label}`);
  if (action === 'logout') { await connection(id).logout(); console.log('Cenmax AI disconnected.'); }
} catch (error) {
  console.error(error instanceof PublicError ? error.message : 'Cenmax AI operation failed.');
  process.exitCode = 1;
}
