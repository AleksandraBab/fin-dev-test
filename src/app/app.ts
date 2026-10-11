import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ProducerService } from './core/producer/producer.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = 'Realtime Fintech Dashboard';

  // Injected here, not just in the pages that happen to care about it right
  // now, so the error banner below is visible regardless of which route is
  // active — a producer error can occur while the user is on Settings, not
  // only while looking at the Dashboard.
  protected readonly producer = inject(ProducerService);
}
