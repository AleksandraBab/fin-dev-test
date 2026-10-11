import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProducerService } from '../../core/producer/producer.service';
import { SETTINGS_BOUNDS } from '../../core/producer/models/producer-settings.model';
import { integerValidator } from '../../core/validators/integer.validator';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly producer = inject(ProducerService);

  readonly bounds = SETTINGS_BOUNDS;

  readonly form = new FormGroup({
    instrumentCount: new FormControl(this.producer.settings().instrumentCount, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SETTINGS_BOUNDS.instrumentCount.min),
        Validators.max(SETTINGS_BOUNDS.instrumentCount.max),
        integerValidator,
      ],
    }),
    updatesPerBatch: new FormControl(this.producer.settings().updatesPerBatch, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SETTINGS_BOUNDS.updatesPerBatch.min),
        Validators.max(SETTINGS_BOUNDS.updatesPerBatch.max),
        integerValidator,
      ],
    }),
    batchIntervalMs: new FormControl(this.producer.settings().batchIntervalMs, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SETTINGS_BOUNDS.batchIntervalMs.min),
        Validators.max(SETTINGS_BOUNDS.batchIntervalMs.max),
        integerValidator,
      ],
    }),
  });

  isInvalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  onApply(): void {
    if (this.form.invalid) {
      return;
    }
    this.producer.applySettings(this.form.getRawValue());
  }
}
