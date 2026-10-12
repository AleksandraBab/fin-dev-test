import { InjectionToken } from '@angular/core';


// Angular InjectionToken for a factory that produces WorkerLike instances for unit tests 
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/**
 * Factory for the real producer worker. Injected as a factory (not the
 * worker instance itself) so each call produces a fresh Worker — needed
 * because a terminated Worker cannot be restarted.
 */
export const PRODUCER_WORKER_FACTORY = new InjectionToken<() => WorkerLike>(
  'PRODUCER_WORKER_FACTORY',
  {
    factory: () => () =>
      new Worker(new URL('./producer.worker', import.meta.url), { type: 'module' }),
  },
);
