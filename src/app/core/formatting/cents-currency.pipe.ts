import { Pipe, type PipeTransform } from '@angular/core';

import { isDefined } from '../utils/is-defined';

@Pipe({ name: 'centsCurrency' })
export class CentsCurrencyPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  /**
   * Could be also implemented using Angular's built-in CurrencyPipe
   * as  private readonly currencyPipe = new CurrencyPipe('en-US');
   *   return this.currencyPipe.transform(cents / 100, 'USD');
   * But if we want to avoid as much dependencies as possible, we can use the Intl.NumberFormat approach.
   */

  transform(cents: number | null | undefined): string {
    if (!isDefined(cents)) {
      return '—';
    }
    return this.formatter.format(cents / 100);
  }
}
