import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEFAULT_PRODUCER_SETTINGS } from '../../core/producer/models/producer-settings.model';
import { ProducerService } from '../../core/producer/producer.service';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let component: SettingsPage;
  let applySettings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    applySettings = vi.fn();
    const fakeProducerService = {
      settings: signal(DEFAULT_PRODUCER_SETTINGS),
      applySettings,
    };

    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: ProducerService, useValue: fakeProducerService }],
    });

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds the form from the service’s current settings', () => {
    expect(component.form.getRawValue()).toEqual(DEFAULT_PRODUCER_SETTINGS);
  });

  describe('boundary validation', () => {
    const cases: [keyof typeof DEFAULT_PRODUCER_SETTINGS, number, boolean][] = [
      ['instrumentCount', 0, false],
      ['instrumentCount', 1, true],
      ['instrumentCount', 50, true],
      ['instrumentCount', 51, false],
      ['updatesPerBatch', 0, false],
      ['updatesPerBatch', 1, true],
      ['updatesPerBatch', 1000, true],
      ['updatesPerBatch', 1001, false],
      ['batchIntervalMs', 49, false],
      ['batchIntervalMs', 50, true],
      ['batchIntervalMs', 2000, true],
      ['batchIntervalMs', 2001, false],
    ];

    for (const [field, value, expectedValid] of cases) {
      it(`${field}=${value} is ${expectedValid ? 'valid' : 'invalid'}`, () => {
        component.form.controls[field].setValue(value);
        expect(component.form.controls[field].valid).toBe(expectedValid);
      });
    }

    it('rejects non-integer values', () => {
      component.form.controls.instrumentCount.setValue(2.5);
      expect(component.form.controls.instrumentCount.valid).toBe(false);
    });
  });

  it('does not call applySettings while editing — only Apply does', () => {
    component.form.controls.instrumentCount.setValue(10);

    expect(applySettings).not.toHaveBeenCalled();
  });

  it('calls applySettings with the form’s current draft values on Apply', () => {
    component.form.setValue({ instrumentCount: 10, updatesPerBatch: 200, batchIntervalMs: 1000 });

    component.onApply();

    expect(applySettings).toHaveBeenCalledWith({
      instrumentCount: 10,
      updatesPerBatch: 200,
      batchIntervalMs: 1000,
    });
  });

  it('does not call applySettings when the form is invalid', () => {
    component.form.controls.instrumentCount.setValue(0);

    component.onApply();

    expect(applySettings).not.toHaveBeenCalled();
  });
});
