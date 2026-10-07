import staticFiles from '@fastify/static';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type pg from 'pg';
import { z } from 'zod';
import {
  advancePlayer,
  applyAction,
  createPlayer,
  GameError,
  migratePlayerState,
  parseAction,
  parseAppearance,
  type PlayerState,
  type PublicPlayerState,
} from '@azeroth/game';

const COOKIE_NAME = 'wc_session';
const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;
const actionRequestSchema = z
  .object({
    idempotencyKey: z.uuid(),
    // Intent validation is shared with the engine so new content cannot drift
    // between the HTTP boundary and the authoritative game simulation.
    action: z.unknown().transform((value) => parseAction(value)),
  })
  .strict();
const sessionRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .regex(/^[\p{L}\p{N} '\-]+$/u)
      .optional(),
    appearance: z
      .unknown()
      .transform((value) => parseAppearance(value))
      .optional(),
  })
  .strict();

class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface AppOptions {
  pool: pg.Pool;
  now?: () => number;
  allowedOrigins?: string[];
  secureCookies?: boolean;
  logger?: boolean;
  clientDirectory?: string;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function publicPlayer(player: PlayerState | PublicPlayerState): PublicPlayerState {
  const result = { ...player };
  delete (result as Partial<PlayerState>).rngState;
  delete (result as Partial<PlayerState>).nextItemId;
  return result;
}

function sessionHash(request: FastifyRequest): string {
  const token = request.cookies[COOKIE_NAME];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new HttpError(
      401,
      'UNAUTHENTICATED',
      'Создайте гостевого героя, чтобы начать приключение.',
    );
  }
  return digest(token);
}

export function buildApp(options: AppOptions) {
  const { pool, now = Date.now } = options;
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === 'production';
  const origins = new Set(
    options.allowedOrigins ?? [process.env.APP_ORIGIN ?? 'http://localhost:5173'],
  );
  const app = Fastify({
    bodyLimit: 8_192,
    // Enable only behind the single trusted ingress with no public API port.
    trustProxy:
      process.env.TRUST_PROXY === '1' ? (_address: string, hop: number) => hop === 0 : false,
    logger: options.logger ? { redact: ['req.headers.cookie', 'res.headers.set-cookie'] } : false,
  });
  if (options.clientDirectory) {
    app.register(staticFiles, { root: options.clientDirectory, dotfiles: 'deny' });
  }
  app.register(cookie);
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.addHook('onRequest', async (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (!origin || !origins.has(origin)) {
        throw new HttpError(403, 'CSRF_ORIGIN', 'Запрос должен быть отправлен с сайта игры.');
      }
      const site = request.headers['sec-fetch-site'];
      if (site === 'cross-site') {
        throw new HttpError(403, 'CSRF_ORIGIN', 'Запросы с другого сайта запрещены.');
      }
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Некорректный запрос. Проверьте действие и обязательные поля.',
        code: 'INVALID_REQUEST',
      });
    }
    if (error instanceof GameError) {
      return reply.code(400).send({ error: error.message, code: error.code });
    }
    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode < 500
    ) {
      const message =
        error.statusCode === 429
          ? 'Слишком много запросов. Подождите немного.'
          : error.statusCode === 413
            ? 'Запрос слишком большой.'
            : 'Некорректный запрос.';
      const code =
        'code' in error && typeof error.code === 'string' ? error.code : 'INVALID_REQUEST';
      return reply.code(error.statusCode).send({ error: message, code });
    }
    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({
      error: 'Сервер не смог выполнить запрос. Попробуйте ещё раз.',
      code: 'INTERNAL_ERROR',
    });
  });

  async function withPlayer<T>(
    request: FastifyRequest,
    work: (client: pg.PoolClient, player: PlayerState) => Promise<T>,
  ): Promise<T> {
    const tokenHash = sessionHash(request);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // All state reads and writes take the same player lock, so elapsed time and
      // combat rewards are applied exactly once even across multiple tabs.
      const result = await client.query<{ state: unknown }>(
        `SELECT p.state FROM players p
         JOIN guest_sessions s ON s.player_id = p.id
         WHERE s.token_hash = $1 AND s.expires_at > now()
         FOR UPDATE OF p`,
        [tokenHash],
      );
      const stored = result.rows[0]?.state;
      if (!stored)
        throw new HttpError(
          401,
          'UNAUTHENTICATED',
          'Гостевая сессия истекла. Начните новое приключение.',
        );
      const player = migratePlayerState(stored);
      const previousVersion =
        typeof stored === 'object' ? Reflect.get(stored, 'schemaVersion') : undefined;
      if (previousVersion !== player.schemaVersion) await savePlayer(client, player);
      const output = await work(client, player);
      await client.query('COMMIT');
      return output;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function savePlayer(client: pg.PoolClient, player: PlayerState): Promise<void> {
    await client.query('UPDATE players SET state = $1::jsonb, updated_at = now() WHERE id = $2', [
      JSON.stringify(player),
      player.id,
    ]);
  }

  app.get('/api/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', database: 'postgresql' };
    } catch {
      return reply.code(503).send({ status: 'unavailable', database: 'postgresql' });
    }
  });

  app.post(
    '/api/session',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = sessionRequestSchema.parse(request.body ?? {});
      reply.header('Cache-Control', 'no-store');
      if (request.cookies[COOKIE_NAME]) {
        try {
          return await withPlayer(request, async (client, stored) => {
            const player = advancePlayer(stored, now());
            await savePlayer(client, player);
            return { player: publicPlayer(player) };
          });
        } catch (error) {
          // Invalid and expired sessions may start anew; database failures never
          // silently replace an existing character.
          if (!(error instanceof HttpError) || error.statusCode !== 401) throw error;
        }
      }
      const timestamp = now();
      const player = createPlayer({
        id: randomUUID(),
        name: input.name ?? 'Странник',
        now: timestamp,
        rngSeed: randomBytes(4).readUInt32LE(),
        appearance: input.appearance,
      });
      const token = randomBytes(32).toString('base64url');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO players (id, display_name, state) VALUES ($1, $2, $3::jsonb)',
          [player.id, player.name, JSON.stringify(player)],
        );
        await client.query(
          'INSERT INTO guest_sessions (token_hash, player_id, expires_at) VALUES ($1, $2, $3)',
          [digest(token), player.id, new Date(timestamp + SESSION_AGE_SECONDS * 1_000)],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      reply.setCookie(COOKIE_NAME, token, {
        path: '/api',
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        maxAge: SESSION_AGE_SECONDS,
      });
      return reply.code(201).send({ player: publicPlayer(player) });
    },
  );

  app.get('/api/game', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return withPlayer(request, async (client, stored) => {
      const player = advancePlayer(stored, now());
      await savePlayer(client, player);
      return { player: publicPlayer(player) };
    });
  });

  app.post('/api/game/action', async (request, reply) => {
    const { action, idempotencyKey } = actionRequestSchema.parse(request.body);
    // JSON object property order is not part of an action's meaning.
    const actionHash = digest(JSON.stringify(action, Object.keys(action).sort()));
    reply.header('Cache-Control', 'no-store');
    return withPlayer(request, async (client, stored) => {
      const previous = await client.query<{
        action_hash: string;
        response: { player: Omit<PublicPlayerState, 'schemaVersion'> & { schemaVersion: number } };
      }>(
        'SELECT action_hash, response FROM action_receipts WHERE player_id = $1 AND idempotency_key = $2',
        [stored.id, idempotencyKey],
      );
      if (previous.rows[0]) {
        const receipt = previous.rows[0];
        const oldSchema = receipt.response.player.schemaVersion !== stored.schemaVersion;
        // The earliest v1 API encoded intent fields with `type` first. Honor
        // that historical hash only while upgrading its old-schema receipt.
        const { type, ...intentFields } = action;
        const historicalHash = digest(JSON.stringify({ type, ...intentFields }));
        const historicalMatch =
          receipt.response.player.schemaVersion === 1 && receipt.action_hash === historicalHash;
        if (receipt.action_hash !== actionHash && !(oldSchema && historicalMatch)) {
          throw new HttpError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Этот ключ запроса уже использован для другого действия.',
          );
        }
        if (oldSchema) {
          // Replaying a receipt must never re-award an old quest or re-equip an
          // item. Advance the current save and replace only the obsolete DTO.
          const player = advancePlayer(stored, now());
          await savePlayer(client, player);
          const response = { player: publicPlayer(player) };
          await client.query(
            'UPDATE action_receipts SET action_hash = $1, response = $2::jsonb WHERE player_id = $3 AND idempotency_key = $4',
            [actionHash, JSON.stringify(response), player.id, idempotencyKey],
          );
          return response;
        }
        return { player: publicPlayer(receipt.response.player as PublicPlayerState) };
      }
      const timestamp = now();
      const player = applyAction(advancePlayer(stored, timestamp), action, timestamp);
      await savePlayer(client, player);
      const response = { player: publicPlayer(player) };
      await client.query(
        'INSERT INTO action_receipts (player_id, idempotency_key, action_hash, response) VALUES ($1, $2, $3, $4::jsonb)',
        [player.id, idempotencyKey, actionHash, JSON.stringify(response)],
      );
      return response;
    });
  });

  return app;
}
