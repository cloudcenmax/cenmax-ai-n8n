import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomBytes } from 'node:crypto';

export const ORIGIN = 'https://console.ai.cenmax.in';
export const CLIENT_ID = 'cenmax-n8n';
export const API = `${ORIGIN}/app/v1`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export class PublicError extends Error {}
const failure = () => new PublicError('Cenmax AI request failed. Check your connection or sign in again.');

async function readBody(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length; if (size > 1024 * 1024) throw failure();
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch { await reader.cancel().catch(() => {}); throw failure(); }
}
export async function readJson(response) {
  try { return JSON.parse((await readBody(response)).toString('utf8')); }
  catch { throw failure(); }
}
export async function form(endpoint, fields, fetcher = fetch) {
  let response;
  try { response = await fetcher(`${ORIGIN}${endpoint}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: CLIENT_ID, ...fields}),
  }); } catch { throw failure(); }
  if (endpoint === '/oauth/revoke' && response.ok) {
    // RFC 7009 revocation succeeds by status; [] and an empty body are valid.
    await readBody(response);
    return {};
  }
  const data = await readJson(response);
  if (!response.ok) {
    const code = typeof data.error === 'string' ? data.error : '';
    if (['authorization_pending', 'slow_down', 'access_denied', 'expired_token'].includes(code)) {
      const error = failure(); error.code = code; throw error;
    }
    throw failure();
  }
  return data;
}
export function tokens(data, now = Date.now()) {
  if (data.token_type?.toLowerCase() !== 'bearer' ||
      typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 8192 ||
      typeof data.refresh_token !== 'string' || !data.refresh_token || data.refresh_token.length > 8192 ||
      !Number.isFinite(data.expires_in) || data.expires_in < 1 || data.expires_in > 86400 ||
      /[\r\n]/.test(data.access_token + data.refresh_token)) throw failure();
  return {accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: now + data.expires_in * 1000};
}
export async function deviceLogin(display, {fetcher = fetch, sleep = pause, now = Date.now} = {}) {
  const start = await form('/oauth/device/code', {scope: 'chat'}, fetcher);
  let verification;
  try { verification = new URL(start.verification_uri_complete || start.verification_uri); } catch { throw failure(); }
  if (verification.origin !== ORIGIN || verification.pathname !== '/oauth/device' || verification.username || verification.password || verification.hash ||
      typeof start.device_code !== 'string' || !start.device_code || start.device_code.length > 8192 ||
      typeof start.user_code !== 'string' || !/^[A-Z0-9-]{4,32}$/.test(start.user_code) ||
      !Number.isFinite(start.expires_in) || start.expires_in < 1 || start.expires_in > 1800) throw failure();
  let interval = Math.max(5, Math.min(60, Number(start.interval) || 5));
  const deadline = now() + start.expires_in * 1000;
  verification.search = new URLSearchParams({user_code: start.user_code}).toString();
  await display({url: verification.href, code: start.user_code});
  while (now() < deadline) {
    await sleep(interval * 1000);
    if (now() >= deadline) break;
    try { return tokens(await form('/oauth/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: start.device_code,
    }, fetcher), now()); }
    catch (error) {
      if (error.code === 'authorization_pending') continue;
      if (error.code === 'slow_down') { interval += 5; continue; }
      throw failure();
    }
  }
  throw new PublicError('Cenmax AI sign-in expired. Start sign-in again.');
}
export function binding(companyId, agentId) {
  if (![companyId, agentId].every(v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v))) {
    throw new PublicError('A valid Cenmax AI connection are required.');
  }
  return createHash('sha256').update(JSON.stringify([companyId, agentId])).digest('hex');
}
export class CredentialStore {
  constructor(companyId, agentId, {root = path.join(os.homedir(), '.config', 'cenmax-n8n'), fetcher = fetch} = {}) {
    this.root = path.resolve(root); this.key = binding(companyId, agentId); this.fetcher = fetcher;
    this.file = path.join(this.root, `${this.key}.json`); this.lockFile = path.join(this.root, `${this.key}.lock`);
  }
  async prepare() {
    await fs.mkdir(this.root, {recursive: true, mode: 0o700});
    // Every component is checked before credentials are opened; do not follow a configured symlink.
    let current = this.root;
    while (current !== path.dirname(current)) {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw failure();
      current = path.dirname(current);
    }
    const info = await fs.lstat(this.root);
    if ((info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())) throw failure();
  }
  async locked(action) {
    await this.prepare();
    let lock;
    for (let i = 0; i < 100; i++) {
      try { lock = await fs.open(this.lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); break; }
      catch (error) { if (error.code !== 'EEXIST') throw failure(); await pause(100); }
    }
    if (!lock) throw new PublicError('Cenmax AI credentials are busy. Try again after the active operation finishes.');
    try { return await action(); }
    finally { await lock.close(); await fs.unlink(this.lockFile); }
  }
  async read() {
    let handle;
    try {
      handle = await fs.open(this.file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 32768 || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) throw failure();
      const data = JSON.parse(await handle.readFile('utf8'));
      if (typeof data.accessToken !== 'string' || !data.accessToken || typeof data.refreshToken !== 'string' || !data.refreshToken || !Number.isFinite(data.expiresAt)) throw failure();
      return data;
    } catch { throw new PublicError('Sign in to Cenmax AI for this Cenmax AI connection first.'); }
    finally { await handle?.close(); }
  }
  async write(data) {
    const temp = path.join(this.root, `.${this.key}.${randomBytes(16).toString('hex')}.tmp`);
    let handle;
    try {
      handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(JSON.stringify(data)); await handle.sync(); await handle.close(); handle = null;
      await fs.rename(temp, this.file);
      const directory = await fs.open(this.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await handle?.close(); await fs.unlink(temp).catch(() => {}); }
  }
  async login(display) { return this.locked(async () => this.write(await deviceLogin(display, {fetcher: this.fetcher}))); }
  async accessToken() {
    return this.locked(async () => {
      let data = await this.read();
      if (data.expiresAt <= Date.now() + 60_000) {
        // Retire this generation durably before a single-use grant leaves the
        // process. A crash must leave a reconnect marker, never a replayable grant.
        await this.write({refreshInFlight: true});
        // Never retry a refresh automatically: the response may have been lost after rotation.
        try {
          data = tokens(await form('/oauth/token', {grant_type: 'refresh_token', refresh_token: data.refreshToken}, this.fetcher));
          await this.write(data);
        } catch {
          // An uncertain exchange must never reuse a potentially spent rotating token.
          await fs.unlink(this.file).catch(() => {});
          throw new PublicError('Cenmax AI sign-in must be renewed. Sign in again.');
        }
      }
      return data.accessToken;
    });
  }
  async logout() {
    return this.locked(async () => {
      const data = await this.read();
      await form('/oauth/revoke', {token: data.refreshToken, token_type_hint: 'refresh_token'}, this.fetcher);
      await form('/oauth/revoke', {token: data.accessToken, token_type_hint: 'access_token'}, this.fetcher);
      await fs.unlink(this.file);
    });
  }
}
export async function models(store, fetcher = fetch) {
  let response;
  try { response = await fetcher(`${API}/models`, {redirect: 'error', signal: AbortSignal.timeout(30_000), headers: {Authorization: `Bearer ${await store.accessToken()}`}}); }
  catch { throw failure(); }
  if (!response.ok) { await response.body?.cancel(); throw failure(); }
  const body = await readJson(response);
  if (!Array.isArray(body.data)) throw failure();
  return body.data.filter(m => typeof m.id === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(m.id) && m.owned_by === 'Cenmax AI')
    .map(m => ({id: m.id, label: typeof m.display_name === 'string' && m.display_name.length <= 128 && /^[\x20-\x7e]+$/.test(m.display_name) && m.display_name.endsWith('by Cenmax AI') ? m.display_name : `${m.id} by Cenmax AI`,
      context: Number.isSafeInteger(m.context_window) ? m.context_window : undefined,
      output: Number.isSafeInteger(m.max_output_tokens) ? m.max_output_tokens : undefined}));
}
