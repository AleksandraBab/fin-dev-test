import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProducerService } from './core/producer/producer.service';
import { App } from './app';

describe('App', () => {
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let retry: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    errorSignal = signal<string | null>(null);
    retry = vi.fn();
    const fakeProducerService = { errorMessage: errorSignal, retry };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ProducerService, useValue: fakeProducerService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the app title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Realtime Fintech Dashboard');
  });

  it('renders navigation links to both pages', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(compiled.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard', '/settings']);
  });

  it('shows no error banner when there is nothing to report', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the producer error banner at the shell level, independent of the active route', async () => {
    errorSignal.set('Wasm module failed to load');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'Wasm module failed to load',
    );
  });

  it('calls producer.retry() when the Retry button in the error banner is clicked', async () => {
    errorSignal.set('Wasm module failed to load');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.app-error-retry')!.click();

    expect(retry).toHaveBeenCalled();
  });
});
