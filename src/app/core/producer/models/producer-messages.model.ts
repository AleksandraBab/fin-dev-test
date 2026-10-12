export interface InitCommand {
  readonly type: 'init';
  readonly sessionId: string;
  readonly instrumentCount: number;
  readonly updatesPerBatch: number;
  readonly batchIntervalMs: number;
}

export interface PauseCommand {
  readonly type: 'pause';
  readonly sessionId: string;
}

export interface ResumeCommand {
  readonly type: 'resume';
  readonly sessionId: string;
}

export type ProducerCommand = InitCommand | PauseCommand | ResumeCommand;

export interface StatusEvent {
  readonly type: 'status';
  readonly sessionId: string;
  readonly running: boolean;
  readonly symbols: readonly string[];
}

export interface BatchEvent {
  readonly type: 'batch';
  readonly sessionId: string;
  readonly buffer: ArrayBuffer;
  readonly strideLength: number;
}

export interface ProducerErrorEvent {
  readonly type: 'error';
  readonly sessionId: string | null;
  readonly message: string;
}

export type ProducerEvent = StatusEvent | BatchEvent | ProducerErrorEvent;
