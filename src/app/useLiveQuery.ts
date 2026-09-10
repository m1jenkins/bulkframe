import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

export function useLiveQuery<T>(querier: () => Promise<T> | T, initial: T, deps: unknown[] = []): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({
      next: setValue,
      error: () => undefined,
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
