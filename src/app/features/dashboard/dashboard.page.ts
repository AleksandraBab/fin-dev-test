import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

import { CentsCurrencyPipe } from '../../core/formatting/cents-currency.pipe';
import { ImbalancePipe } from '../../core/formatting/imbalance.pipe';
import { deriveMetrics } from '../../core/metrics/metrics-calculations';
import { ProducerService } from '../../core/producer/producer.service';
import { DASHBOARD_COLUMNS } from './dashboard-columns.model';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, CentsCurrencyPipe, ImbalancePipe, TitleCasePipe],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly producer = inject(ProducerService);

  protected readonly displayedColumns = DASHBOARD_COLUMNS;

  protected readonly rows = computed(() => Array.from(this.producer.metrics().values(), deriveMetrics));

  public togglePause(): void {
    if (this.producer.status() === 'paused') {
      this.producer.resume();
    } else {
      this.producer.pause();
    }
  }
}
