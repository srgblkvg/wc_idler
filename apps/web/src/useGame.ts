import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, PublicPlayerState } from '@azeroth/game';

type ResponseBody = { player?: PublicPlayerState; error?: string; code?: string };
async function request(path: string, body?: unknown): Promise<ResponseBody> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (response.status === 401 && body === undefined) return {};
  const data: ResponseBody = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Сервер недоступен (${response.status}). Попробуйте снова.`);
  return data;
}

export function useGame() {
  const [player, setPlayer] = useState<PublicPlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const errorSource = useRef<'read' | 'action' | null>(null);
  const mutation = useRef(false);
  const reading = useRef(false);
  const version = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (reading.current || mutation.current) return;
    reading.current = true;
    const currentVersion = version.current;
    try {
      const data = await request('/api/game');
      if (!mounted.current || version.current !== currentVersion) return;
      setPlayer(data.player || null);
      setConnected(true);
      if (errorSource.current !== 'action') {
        setError(null);
        errorSource.current = null;
      }
    } catch (e) {
      if (mounted.current && version.current === currentVersion) {
        setConnected(false);
        errorSource.current = 'read';
        setError(e instanceof Error ? e.message : 'Не удалось связаться с сервером.');
      }
    } finally {
      reading.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // One polling loop per authenticated character, including under React StrictMode.
  useEffect(() => {
    if (!player?.id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!active) return;
      if (!document.hidden) await refresh();
      if (active) timer = setTimeout(tick, 2500);
    };
    timer = setTimeout(tick, 2500);
    const onVisible = () => {
      if (!document.hidden && active) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [player?.id, refresh]);

  const mutate = useCallback(async (path: string, body: unknown) => {
    if (mutation.current) return false;
    mutation.current = true;
    version.current++;
    setPending(true);
    errorSource.current = null;
    setError(null);
    try {
      const data = await request(path, body);
      if (!data.player) throw new Error('Сервер не вернул состояние персонажа.');
      if (mounted.current) {
        setPlayer(data.player);
        setConnected(true);
      }
      return true;
    } catch (e) {
      if (mounted.current) {
        errorSource.current = 'action';
        setError(e instanceof Error ? e.message : 'Не удалось выполнить действие.');
        if (e instanceof TypeError) setConnected(false);
      }
      return false;
    } finally {
      mutation.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return {
    player,
    loading,
    pending,
    error,
    connected,
    needsCharacter: !player && !loading,
    refresh: () => {
      errorSource.current = null;
      setError(null);
      return refresh();
    },
    create: (name: string) => mutate('/api/session', { name }),
    act: (action: GameAction) =>
      mutate('/api/game/action', { idempotencyKey: crypto.randomUUID(), action }),
  };
}
