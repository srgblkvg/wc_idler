import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

describe('built-client preview preserves the API and file boundary', () => {
  const pool = new pg.Pool();
  const connect = vi.spyOn(pool, 'connect');
  let directory: string;
  let app: ReturnType<typeof buildApp>;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'azeroth-preview-'));
    await writeFile(join(directory, 'index.html'), '<!doctype html><title>Preview</title>');
    await writeFile(join(directory, '.env'), 'PRIVATE_MARKER=do-not-serve');
    app = buildApp({ pool, clientDirectory: directory });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await rm(directory, { recursive: true, force: true });
  });
  it('serves the built page while API authentication remains enforced', async () => {
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    const api = await app.inject({ method: 'GET', url: '/api/game' });
    expect(api.statusCode).toBe(401);
    expect(api.json().code).toBe('UNAUTHENTICATED');
    expect(connect).not.toHaveBeenCalled();
  });
  it('never exposes dotfiles or parent paths', async () => {
    for (const url of ['/.env', '/%2eenv', '/../.env', '/%2e%2e/.env']) {
      const response = await app.inject({ method: 'GET', url });
      expect([400, 403, 404]).toContain(response.statusCode);
      expect(response.body).not.toContain('PRIVATE_MARKER');
    }
  });
});
