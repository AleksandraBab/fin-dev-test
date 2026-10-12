import { Injectable, inject, signal } from '@angular/core';

import { createInitialMetrics, type InstrumentMetrics } from '../metrics/models/instrument-metrics.model';
import { applyBatch, decodeBatch } from '../metrics/metrics-calculations';
import type { BatchEvent, ProducerCommand, ProducerErrorEvent, ProducerEvent, StatusEvent } from './models/producer-messages.model';
import { DEFAULT_PRODUCER_SETTINGS, type ProducerSettings } from './models/producer-settings.model';
import type { ProducerStatus } from './models/producer-status.model';
import { PRODUCER_WORKER_FACTORY, type WorkerLike } from './worker.token';

@Injectable({ providedIn: 'root' })
export class ProducerService {
  private readonly createWorker = inject(PRODUCER_WORKER_FACTORY);

  private worker: WorkerLike | null = null;
  private symbols: readonly string[] = [];
  private nextSessionId = 0;

  private readonly settingsState = signal<ProducerSettings>(DEFAULT_PRODUCER_SETTINGS);
  private readonly statusState = signal<ProducerStatus>('initializing');
  private readonly errorMessageState = signal<string | null>(null);
  private readonly metricsState = signal<ReadonlyMap<string, InstrumentMetrics>>(new Map());
  private readonly sessionIdState = signal<string>('');

  readonly settings = this.settingsState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly errorMessage = this.errorMessageState.asReadonly();
  readonly metrics = this.metricsState.asReadonly();

  constructor() {
    this.startRun(DEFAULT_PRODUCER_SETTINGS);
  }

  pause(): void {
    if (this.statusState() !== 'running') {
      return;
    }
    this.postCommand({ type: 'pause', sessionId: this.sessionIdState() });
    this.statusState.set('paused');
  }

  resume(): void {
    if (this.statusState() !== 'paused') {
      return;
    }
    this.postCommand({ type: 'resume', sessionId: this.sessionIdState() });
    this.statusState.set('running');
  }

  applySettings(settings: ProducerSettings): void {
    this.startRun(settings);
  }

  retry(): void {
    if (this.statusState() !== 'error') {
      return;
    }
    this.worker?.terminate();
    this.worker = null;
    this.startRun(this.settingsState());
  }

  private startRun(settings: ProducerSettings): void {
    const sessionId = String(this.nextSessionId++);
    this.symbols = [];
    this.settingsState.set(settings);
    this.sessionIdState.set(sessionId);
    this.errorMessageState.set(null);
    this.statusState.set('initializing');
    this.metricsState.set(new Map());

    this.postCommand({
      type: 'init',
      sessionId,
      instrumentCount: settings.instrumentCount,
      updatesPerBatch: settings.updatesPerBatch,
      batchIntervalMs: settings.batchIntervalMs,
    });
  }

  private postCommand(command: ProducerCommand): void {
    this.getWorker()?.postMessage(command);
  }

  private getWorker(): WorkerLike | null {
    if (!this.worker) {
      try {
        const worker = this.createWorker();
        worker.onmessage = (event) => this.handleEvent(event.data as ProducerEvent);
        worker.onerror = (event) => this.handleWorkerCrash(event.message);
        this.worker = worker;
      } catch (error) {
        this.handleWorkerCrash(error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    return this.worker;
  }

  private handleEvent(event: ProducerEvent): void {
    switch (event.type) {
      case 'status':
        this.handleStatus(event);
        break;
      case 'batch':
        this.handleBatch(event);
        break;
      case 'error':
        this.handleError(event);
        break;
    }
  }

  private handleStatus(event: StatusEvent): void {
    if (event.sessionId !== this.sessionIdState()) {
      return;
    }
    if (this.symbols.length === 0 && event.symbols.length > 0) {
      this.symbols = event.symbols;
      this.metricsState.set(
        new Map(event.symbols.map((symbol) => [symbol, createInitialMetrics(symbol)])),
      );
    }
    this.statusState.set(event.running ? 'running' : 'paused');
  }

  private handleBatch(event: BatchEvent): void {
    if (event.sessionId !== this.sessionIdState()) {
      return;
    }
    const records = decodeBatch(event.buffer, event.strideLength);
    this.metricsState.update((current) => applyBatch(current, records, this.symbols));
  }

  private handleError(event: ProducerErrorEvent): void {
    if (event.sessionId !== null && event.sessionId !== this.sessionIdState()) {
      return;
    }
    this.errorMessageState.set(event.message);
    this.statusState.set('error');
  }

  private handleWorkerCrash(message: string): void {
    this.errorMessageState.set(message || 'The producer worker crashed unexpectedly.');
    this.statusState.set('error');
  }
}
