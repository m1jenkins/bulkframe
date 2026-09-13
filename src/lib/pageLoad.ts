export const DEEP_LOAD_DEFAULTS = {
  maxMs: 40_000,
  maxRounds: 70,
  idleLimit: 5,
  minRounds: 8,
  stepMs: 650,
  heightSlack: 80,
};

export type DeepLoadOptions = Partial<typeof DEEP_LOAD_DEFAULTS>;

export type DeepLoadSnapshot = {
  scrollHeight: number;
  uniqueImages: number;
  mediaCount: number;
};

export type DeepLoadState = {
  lastHeight: number;
  lastUnique: number;
  lastMedia: number;
  idleRounds: number;
  rounds: number;
};

export function initialDeepLoadState(): DeepLoadState {
  return { lastHeight: 0, lastUnique: 0, lastMedia: 0, idleRounds: 0, rounds: 0 };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function advanceDeepLoad(
  prev: DeepLoadState,
  snapshot: DeepLoadSnapshot,
  now: number,
  startedAt: number,
  options: DeepLoadOptions = {},
): { stop: boolean; next: DeepLoadState } {
  const opts = { ...DEEP_LOAD_DEFAULTS, ...options };
  const grewHeight = snapshot.scrollHeight > prev.lastHeight + opts.heightSlack;
  const grewUnique = snapshot.uniqueImages > prev.lastUnique;
  const grewMedia = snapshot.mediaCount > prev.lastMedia;
  const next: DeepLoadState = {
    lastHeight: snapshot.scrollHeight,
    lastUnique: snapshot.uniqueImages,
    lastMedia: snapshot.mediaCount,
    idleRounds: grewHeight || grewUnique || grewMedia ? 0 : prev.idleRounds + 1,
    rounds: prev.rounds + 1,
  };

  if (now - startedAt >= opts.maxMs) return { stop: true, next };
  if (next.rounds >= opts.maxRounds) return { stop: true, next };
  if (next.rounds < opts.minRounds) return { stop: false, next };
  if (next.idleRounds >= opts.idleLimit) return { stop: true, next };
  return { stop: false, next };
}
