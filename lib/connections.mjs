import os from 'node:os';
import path from 'node:path';
import { CredentialStore, PublicError, models } from './oauth.mjs';

export function connection(reference, {root = process.env.CENMAX_N8N_CREDENTIAL_DIR || path.join(os.homedir(), '.config', 'cenmax-n8n'), fetcher = fetch} = {}) {
  if (typeof reference !== 'string' || !/^[a-f0-9]{64}$/.test(reference)) throw new PublicError('Choose a valid Cenmax AI connection reference.');
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new PublicError('Use an absolute private Cenmax AI credential directory.');
  return new CredentialStore('n8n', reference, {root, fetcher});
}

export async function availableModels(reference, options) {
  return models(connection(reference, options), options?.fetcher);
}
