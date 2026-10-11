import { Pipe, type PipeTransform } from '@angular/core';

import { isDefined } from '../utils/is-defined';

@Pipe({ name: 'imbalance' })
export class ImbalancePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (!isDefined(value)) {
      return '—';
    }
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${Math.abs(value).toFixed(3)}`;
  }
}
