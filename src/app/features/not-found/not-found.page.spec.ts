import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NotFoundPage } from './not-found.page';

describe('NotFoundPage', () => {
  let fixture: ComponentFixture<NotFoundPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
  });

  it('renders a heading announcing the page was not found', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('not found');
  });

  it('links back to the dashboard', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a')?.getAttribute('href')).toBe('/dashboard');
  });
});
