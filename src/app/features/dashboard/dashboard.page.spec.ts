import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { createInitialMetrics, type InstrumentMetrics } from '../../core/metrics/models/instrument-metrics.model';
import { ProducerService, type ProducerStatus } from '../../core/producer/producer.service';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let pause: ReturnType<typeof vi.fn>;
  let resume: ReturnType<typeof vi.fn>;
  let retry: ReturnType<typeof vi.fn>;
  let statusSignal: ReturnType<typeof signal<ProducerStatus>>;
  let metricsSignal: ReturnType<typeof signal<ReadonlyMap<string, InstrumentMetrics>>>;

  beforeEach(() => {
    pause = vi.fn();
    resume = vi.fn();
    retry = vi.fn();
    statusSignal = signal<ProducerStatus>('running');
    metricsSignal = signal<ReadonlyMap<string, InstrumentMetrics>>(new Map());

    const fakeProducerService = {
      status: statusSignal,
      metrics: metricsSignal,
      pause,
      resume,
      retry,
    };

    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: ProducerService, useValue: fakeProducerService }],
    });

    fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
  });

  it('shows a loading placeholder before any instrument is known', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Loading…');
  });

  it('shows an error placeholder instead of "Loading…" when the producer errored before any data arrived', () => {
    statusSignal.set('error');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Unable to load market data.');
    expect(text).not.toContain('Loading…');
  });

  it('shows unavailable values and zero volume for a freshly seeded instrument', () => {
    metricsSignal.set(new Map([['ALFA', createInitialMetrics('ALFA')]]));
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    const cells = Array.from(row!.querySelectorAll('th, td')).map((el) => el.textContent?.trim());
    expect(cells).toEqual(['ALFA', '—', '—', '0', '—', '—']);
  });

  it('calls pause() when running and the control is activated', () => {
    statusSignal.set('running');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();

    expect(pause).toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it('calls resume() when paused and the control is activated', () => {
    statusSignal.set('paused');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();

    expect(resume).toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it('shows no Retry button while not errored', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).not.toContain('Retry');
  });

  it('shows a Retry button that calls producer.retry() when errored, regardless of whether rows already exist', () => {
    metricsSignal.set(new Map([['ALFA', createInitialMetrics('ALFA')]]));
    statusSignal.set('error');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const retryButton = Array.from(compiled.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    );
    expect(retryButton).toBeTruthy();

    retryButton!.click();

    expect(retry).toHaveBeenCalled();
  });
});
