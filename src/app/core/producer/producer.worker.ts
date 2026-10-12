import type {
  BatchEvent,
  InitCommand,
  PauseCommand,
  ProducerCommand,
  ProducerErrorEvent,
  ProducerEvent,
  ResumeCommand,
} from './models/producer-messages.model';
import type { WasmProducer, WasmProducerModule } from './models/wasm-producer-module.model';

let producer: WasmProducer | null = null;
let activeSessionId: string | null = null;
let latestRequestedSessionId: string | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let strideLength = 0;
let currentUpdatesPerBatch = 0;
let currentBatchIntervalMs = 0;

function postEvent(event: ProducerEvent, transfer?: Transferable[]): void {
  if (transfer) {
    self.postMessage(event, transfer);
  } else {
    self.postMessage(event);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stopInterval(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

let wasmModulePromise: Promise<WasmProducerModule> | null = null;

function getWasmModule(): Promise<WasmProducerModule> {
  if (!wasmModulePromise) {
    // Resolved relative to this worker script's own URL (not a hardcoded
    // absolute "/wasm/..." path) — the worker chunk and the wasm/ assets are
    // always siblings under the same deployed root, whatever that root is
    // (domain root on Cloudflare Pages, a "/repo-name/" prefix on GitHub
    // Pages, etc.), so this works regardless of hosting choice.
    const glueModulePath = new URL('wasm/producer.js', self.location.href).href;
    wasmModulePromise = import(glueModulePath).then(async (module: WasmProducerModule) => {
      await module.default();
      return module;
    });
  }
  return wasmModulePromise;
}

// Kick off loading immediately so a broken Wasm asset (missing file, bad
// MIME type, instantiation failure) is reported as early as possible,
// independent of whether any run has been requested yet.
getWasmModule().catch((error: unknown) => {
  const event: ProducerErrorEvent = { type: 'error', sessionId: null, message: toErrorMessage(error) };
  postEvent(event);
});

function generateAndPostBatch(sessionId: string, updatesPerBatch: number): void {
  if (!producer || sessionId !== activeSessionId) {
    return;
  }
  try {
    const records = producer.generate_batch(updatesPerBatch);
    const buffer = records.buffer as ArrayBuffer;
    const event: BatchEvent = {
      type: 'batch',
      sessionId,
      buffer,
      strideLength,
    };
    postEvent(event, [buffer]);
  } catch (error) {
    // A generation failure is treated as fatal for this session, not a
    // transient blip to retry on the next tick — otherwise a persistent
    // failure would keep firing every batchIntervalMs forever, repeating
    // the same error, until the user manually hits Retry.
    stopInterval();
    postEvent({ type: 'error', sessionId, message: toErrorMessage(error) });
  }
}

async function handleInit(command: InitCommand): Promise<void> {
  const { sessionId, instrumentCount, updatesPerBatch, batchIntervalMs } = command;
  latestRequestedSessionId = sessionId;
  stopInterval();
  try {
    const module = await getWasmModule();
    if (sessionId !== latestRequestedSessionId) {
      return;
    }
    strideLength = module.record_stride();
    producer?.free();
    producer = new module.Producer(instrumentCount, BigInt(Date.now()));
    activeSessionId = sessionId;
    currentUpdatesPerBatch = updatesPerBatch;
    currentBatchIntervalMs = batchIntervalMs;

    postEvent({ type: 'status', sessionId, running: true, symbols: producer.instrument_symbols() });
    intervalHandle = setInterval(() => {
      generateAndPostBatch(sessionId, currentUpdatesPerBatch);
    }, currentBatchIntervalMs);
  } catch (error) {
    postEvent({ type: 'error', sessionId, message: toErrorMessage(error) });
  }
}

function handlePause(command: PauseCommand): void {
  if (command.sessionId !== activeSessionId) {
    return;
  }
  stopInterval();
  postEvent({
    type: 'status',
    sessionId: command.sessionId,
    running: false,
    symbols: producer?.instrument_symbols() ?? [],
  });
}

function handleResume(command: ResumeCommand): void {
  if (command.sessionId !== activeSessionId || !producer) {
    return;
  }
  const { sessionId } = command;
  stopInterval();
  intervalHandle = setInterval(() => {
    generateAndPostBatch(sessionId, currentUpdatesPerBatch);
  }, currentBatchIntervalMs);
  postEvent({ type: 'status', sessionId, running: true, symbols: producer.instrument_symbols() });
}

self.onmessage = (event: MessageEvent<ProducerCommand>) => {
  const command = event.data;
  switch (command.type) {
    case 'init':
      void handleInit(command);
      break;
    case 'pause':
      handlePause(command);
      break;
    case 'resume':
      handleResume(command);
      break;
  }
};
