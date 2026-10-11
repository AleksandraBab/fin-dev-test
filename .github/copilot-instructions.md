# FinDev Angular instructions

- This project currently runs **Angular 21.2.x** (see `package.json`). Rules below marked "v22+" describe upgrade-path behavior, not current behavior — follow the "on v21" guidance until the project actually upgrades.
- Use the local Angular CLI and follow the workspace configuration in `angular.json`.
- Build standalone Angular components. Prefer signals for local and derived state, and use `OnPush` change detection for new components unless a requirement needs another strategy.
- Keep TypeScript strict: do not weaken compiler options or use `any` to bypass type errors.
- Follow the existing SCSS, naming, and folder conventions. Use the Angular CLI to generate Angular artifacts when appropriate.
- Never define interfaces/types inside logic files (services, pipes, calculation/utility modules, components, workers). Extract every interface/type into a dedicated `models/` subfolder next to the code that uses it, as its own `<name>.model.ts` file (e.g. `core/metrics/models/instrument-metrics.model.ts`, `core/metrics/models/raw-market-record.model.ts`). A type that `extends`/directly derives from another type may live in that same base type's `.model.ts` file; otherwise give it its own file.
- Add or update focused unit tests for behavior changes. Run `npm run lint`, `npm test`, `npm run e2e`, and `npm run build` when the relevant changes permit it.
- Never place credentials, API keys, tokens, or private financial data in client-side code, Angular environment files, source control, logs, or test fixtures.
- Treat AI-generated or financial calculations as untrusted input: validate data at trust boundaries and require explicit user confirmation for irreversible actions.

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- On v21 (current), explicitly set `changeDetection: ChangeDetectionStrategy.OnPush` on new components — it is not yet the default. (`OnPush` only becomes the default starting in Angular v22+; drop the explicit setting once this project upgrades.)
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Use external template/style files (`templateUrl`/`styleUrl`), not inline `template`/`styles`, regardless of component size
- Signal Forms (`@angular/forms/signals`) are in developer preview on v21 and become stable in Angular v22+. For financial forms in this app, prefer Reactive Forms until this project upgrades and Signal Forms are stable; re-evaluate after the v22 upgrade.
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use `@Injectable({ providedIn: 'root' })` for new singleton services on v21. The `@Service` decorator replaces this starting in Angular v22+ — switch once this project upgrades.
- Use the `inject()` function instead of constructor injection