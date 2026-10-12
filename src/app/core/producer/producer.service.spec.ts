import { TestBed } from '@angular/core/testing';

import { RAW_RECORD_FIELD_COUNT } from '../metrics/models/raw-market-record.model';
import type { InitCommand, ProducerCommand, ProducerEvent } from './models/producer-messages.model';
import { ProducerService } from './producer.service';
import { PRODUCER_WORKER_FACTORY, type WorkerLike } from './worker.token';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: ProducerCommand[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message as ProducerCommand);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(event: ProducerEvent): void {
    this.onmessage?.({ data: event } as MessageEvent);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  lastInit(): InitCommand {
    const init = [...this.posted].reverse().find((c): c is InitCommand => c.type === 'init');
    if (!init) {
      throw new Error('no init command was posted');
    }
    return init;
  }
}

function makeBatchBuffer(records: readonly (readonly number[])[]): ArrayBuffer {
  const flat = records.flat();
  return new Int32Array(flat).buffer;
}

describe('ProducerService', () => {
  let workers: FakeWorker[];
  let fakeWorker: FakeWorker;
  let service: ProducerService;

  beforeEach(() => {
    workers = [];
    const factory = () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    };

    TestBed.configureTestingModule({
      providers: [{ provide: PRODUCER_WORKER_FACTORY, useValue: factory }],
    });
    service = TestBed.inject(ProducerService);
    fakeWorker = workers[0];
  });

  it('starts a run with the default settings immediately on construction', () => {
    const init = fakeWorker.lastInit();
    expect(init.instrumentCount).toBe(5);
    expect(init.updatesPerBatch).toBe(100);
    expect(init.batchIntervalMs).toBe(500);
    expect(service.status()).toBe('initializing');
  });

  function bootstrapRunning(symbols: readonly string[] = ['ALFA', 'BETA']): string {
    const sessionId = fakeWorker.lastInit().sessionId;
    fakeWorker.emit({ type: 'status', sessionId, running: true, symbols });
    return sessionId;
  }

  describe('receiving batches', () => {
    it('updates metrics for a batch tagged with the current run', () => {
      const sessionId = bootstrapRunning(['ALFA']);

      fakeWorker.emit({
        type: 'batch',
        sessionId,
        buffer: makeBatchBuffer([[0, 10_200, 30, 10_196, 10_200, 600, 400]]),
        recordCount: 1,
        strideLength: RAW_RECORD_FIELD_COUNT,
      });

      const alfa = service.metrics().get('ALFA');
      expect(alfa?.lastPriceCents).toBe(10_200);
      expect(alfa?.cumulativeVolume).toBe(30);
    });

    it('rejects a batch tagged with a superseded run, leaving the new run untouched', () => {
      const staleSessionId = bootstrapRunning(['ALFA']);

      service.applySettings({ instrumentCount: 1, updatesPerBatch: 10, batchIntervalMs: 100 });
      const newSessionId = bootstrapRunning(['ALFA']);
      expect(newSessionId).not.toBe(staleSessionId);

      fakeWorker.emit({
        type: 'batch',
        sessionId: staleSessionId,
        buffer: makeBatchBuffer([[0, 99_999, 999, 1, 2, 3, 4]]),
        recordCount: 1,
        strideLength: RAW_RECORD_FIELD_COUNT,
      });

      expect(service.metrics().get('ALFA')?.lastPriceCents).toBeNull();
      expect(service.metrics().get('ALFA')?.cumulativeVolume).toBe(0);
    });
  });

  describe('applySettings', () => {
    it('clears the previous run’s metrics and totals and starts a new run', () => {
      const sessionId = bootstrapRunning(['ALFA']);
      fakeWorker.emit({
        type: 'batch',
        sessionId,
        buffer: makeBatchBuffer([[0, 10_000, 10, 9_900, 10_100, 100, 100]]),
        recordCount: 1,
        strideLength: RAW_RECORD_FIELD_COUNT,
      });
      expect(service.metrics().get('ALFA')?.cumulativeVolume).toBe(10);

      service.applySettings({ instrumentCount: 2, updatesPerBatch: 50, batchIntervalMs: 250 });

      expect(service.settings()).toEqual({
        instrumentCount: 2,
        updatesPerBatch: 50,
        batchIntervalMs: 250,
      });
      expect(service.metrics().size).toBe(0);
      expect(fakeWorker.lastInit().instrumentCount).toBe(2);
    });

    it('starts generation even if the previous run was paused', () => {
      bootstrapRunning(['ALFA']);
      service.pause();
      expect(service.status()).toBe('paused');

      service.applySettings({ instrumentCount: 1, updatesPerBatch: 10, batchIntervalMs: 100 });

      expect(service.status()).toBe('initializing');
      const sessionId = bootstrapRunning(['ALFA']);
      expect(service.status()).toBe('running');
      expect(fakeWorker.lastInit().sessionId).toBe(sessionId);
    });
  });

  describe('pause/resume', () => {
    it('pause() posts a pause command and flips status to paused', () => {
      const sessionId = bootstrapRunning(['ALFA']);

      service.pause();

      expect(service.status()).toBe('paused');
      const pauseCommand = fakeWorker.posted.find((c) => c.type === 'pause');
      expect(pauseCommand).toEqual({ type: 'pause', sessionId });
    });

    it('resume() flips status back to running without resetting metrics', () => {
      const sessionId = bootstrapRunning(['ALFA']);
      fakeWorker.emit({
        type: 'batch',
        sessionId,
        buffer: makeBatchBuffer([[0, 10_000, 10, 9_900, 10_100, 100, 100]]),
        recordCount: 1,
        strideLength: RAW_RECORD_FIELD_COUNT,
      });
      service.pause();

      service.resume();

      expect(service.status()).toBe('running');
      expect(service.metrics().get('ALFA')?.cumulativeVolume).toBe(10);
      const resumeCommand = fakeWorker.posted.find((c) => c.type === 'resume');
      expect(resumeCommand).toEqual({ type: 'resume', sessionId });
    });

    it('is a no-op to pause when not running, and to resume when not paused', () => {
      bootstrapRunning(['ALFA']);
      const postedCountBeforePause = fakeWorker.posted.length;

      service.resume(); // not paused yet
      expect(fakeWorker.posted.length).toBe(postedCountBeforePause);

      service.pause();
      const postedCountAfterPause = fakeWorker.posted.length;
      service.pause(); // already paused
      expect(fakeWorker.posted.length).toBe(postedCountAfterPause);
    });
  });

  describe('errors', () => {
    it('surfaces an initialization error reported before any run was established', () => {
      fakeWorker.emit({ type: 'error', sessionId: null, message: 'Wasm module failed to load' });

      expect(service.status()).toBe('error');
      expect(service.errorMessage()).toBe('Wasm module failed to load');
    });

    it('ignores an error tagged with a superseded run', () => {
      const staleSessionId = bootstrapRunning(['ALFA']);
      service.applySettings({ instrumentCount: 1, updatesPerBatch: 10, batchIntervalMs: 100 });
      bootstrapRunning(['ALFA']);

      fakeWorker.emit({ type: 'error', sessionId: staleSessionId, message: 'stale failure' });

      expect(service.status()).toBe('running');
      expect(service.errorMessage()).toBeNull();
    });

    it('surfaces an uncaught worker-thread crash unconditionally, unlike a superseded-run error', () => {
      bootstrapRunning(['ALFA']);
      service.applySettings({ instrumentCount: 1, updatesPerBatch: 10, batchIntervalMs: 100 });

      fakeWorker.crash('TypeError: something.exploded is not a function');

      expect(service.status()).toBe('error');
      expect(service.errorMessage()).toBe('TypeError: something.exploded is not a function');
    });
  });

  describe('retry', () => {
    it('terminates the old worker and starts fresh with the last-applied settings', () => {
      fakeWorker.emit({ type: 'error', sessionId: null, message: 'Wasm module failed to load' });
      expect(service.status()).toBe('error');

      service.retry();

      expect(fakeWorker.terminated).toBe(true);
      expect(workers.length).toBe(2);
      const newWorker = workers[1];
      expect(newWorker.terminated).toBe(false);
      expect(newWorker.lastInit().instrumentCount).toBe(5); // DEFAULT_PRODUCER_SETTINGS, never changed in this test
      expect(service.status()).toBe('initializing');
    });

    it('retries with whatever settings were last applied, not the defaults', () => {
      service.applySettings({ instrumentCount: 7, updatesPerBatch: 20, batchIntervalMs: 200 });
      fakeWorker.crash('boom');

      service.retry();

      expect(workers[1].lastInit().instrumentCount).toBe(7);
    });

    it('is a no-op when there is no error to recover from', () => {
      const postedBefore = fakeWorker.posted.length;

      service.retry();

      expect(fakeWorker.posted.length).toBe(postedBefore);
      expect(workers.length).toBe(1);
    });
  });
});

describe('ProducerService construction failure', () => {
  it('surfaces a synchronous Worker-construction failure instead of throwing uncaught', () => {
    const throwingFactory = (): WorkerLike => {
      throw new Error('Workers are not supported in this environment');
    };

    TestBed.configureTestingModule({
      providers: [{ provide: PRODUCER_WORKER_FACTORY, useValue: throwingFactory }],
    });

    // The constructor itself triggers the first run, so this must not throw.
    const service = TestBed.inject(ProducerService);

    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('Workers are not supported in this environment');
  });
});
