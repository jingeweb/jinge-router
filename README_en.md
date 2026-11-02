# jinge-router

A lightweight SPA router for [jinge](https://github.com/jingeweb/jinge). Define pages with TSX and use HTML5 History or hash routing, nested layouts, redirects, reactive path parameters and queries, and links with active state.

[中文](./README.md)

## Installation and setup

```sh
pnpm add jinge jinge-router
pnpm add -D jinge-compiler vite typescript
```

Application TSX must be compiled by jinge-compiler. Enable its Vite plugin:

```ts
import { jingeVitePlugin } from 'jinge-compiler';
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [jingeVitePlugin()],
});
```

Set TypeScript's `jsx` option to `preserve` so jinge-compiler can process templates. Import from `jinge-router` in application code. By default, the Vite plugin selects `jinge-router/dev` during development and the production entry during builds. `jinge-router/source` exposes the source entry for framework and library development.

## Quick start

```tsx
// main.tsx
import { bootstrap } from 'jinge';
import {
  Router,
  RouterHref,
  RouterView,
  createRouter,
  useNavigate,
  useParams,
  useQuery,
} from 'jinge-router';

function Home() {
  return <h1>Home</h1>;
}

function User() {
  const params = useParams<{ id: number }>();
  const query = useQuery();
  const navigate = useNavigate();

  return (
    <section>
      <h1>User {params.id}</h1>
      <p>Tab: {query.tab ?? 'overview'}</p>
      <button on:click={() => navigate('/')}>Home</button>
    </section>
  );
}

function NotFound() {
  return <h1>Page not found</h1>;
}

const router = createRouter({
  mode: 'html5',
  routes: [
    { path: '/', component: Home },
    { path: '/users/:id<num>', component: User },
    { path: '/old-home', redirectTo: '/' },
    { path: '/*', component: NotFound },
  ],
});

function App() {
  return (
    <Router router={router}>
      <nav>
        <RouterHref to="/" exactActiveClass="selected">
          Home
        </RouterHref>
        <RouterHref to="/users/1" activeClass="selected">
          User 1
        </RouterHref>
      </nav>
      <RouterView />
    </Router>
  );
}

bootstrap(App, document.body);
```

Load the corresponding file from HTML with `<script type="module" src="/src/main.tsx"></script>`. At `/users/1?tab=activity`, `params.id` is the number `1` and `query.tab` is the string `'activity'`.

`Router` provides the routing context, and `RouterView` renders the matched page. Use links and hooks inside `Router`. Call `useParams()` in a page rendered by `RouterView` or one of that page's descendants.

## Routing modes and deployment paths

`createRouter()` accepts these options:

| Option     | Default   | Description                |
| ---------- | --------- | -------------------------- |
| `routes`   | Required  | Array of route definitions |
| `mode`     | `'html5'` | `'html5'` or `'hash'`      |
| `baseHref` | `'/'`     | Prefix for route paths     |

```ts
const router = createRouter({
  mode: 'html5',
  baseHref: '/app',
  routes: [{ path: '/users/:id<num>', component: User }],
});
```

Write route definitions and navigation targets relative to the router's root. In this example, continue using `/users/1`; do not add `/app` yourself.

| Configuration               | Example URL for navigation to `/users/1?tab=activity` |
| --------------------------- | ----------------------------------------------------- |
| `html5`, default base       | `/users/1?tab=activity`                               |
| `html5`, `baseHref: '/app'` | `/app/users/1?tab=activity`                           |
| `hash`, default base        | `/index.html#/users/1?tab=activity`                   |
| `hash`, `baseHref: '/app'`  | `/index.html#/app/users/1?tab=activity`               |

HTML5 mode requires the server to serve the SPA's HTML entry for application routes, so direct visits and reloads of nested pages do not return 404. Hash mode keeps the route and its query after `#` and does not require server handling for child routes. A query before `#` is not part of the route query.

`baseHref` applies to the path being matched, including the path inside the hash in hash mode. Configure static asset paths and Vite's `base` separately for your deployment. Hosting HTML at `/app/index.html` alone does not require an `/app` prefix inside hash routes.

## Path matching

| Pattern           | Example           | Result                                                   |
| ----------------- | ----------------- | -------------------------------------------------------- |
| Literal path      | `/about`          | Exact segment matching                                   |
| String parameter  | `/users/:name`    | `name` is a string                                       |
| Numeric parameter | `/users/:id<num>` | Accepts digit characters only; converts `id` to a number |
| Wildcard          | `/files/*`        | Matches the remaining path after the prefix              |

Numeric parameters do not accept a minus sign or decimal point. `*` must be the final path segment and cannot appear in a parent route with `children`. Its matched content is not exposed as a parameter. `/files/*` does not match `/files` itself; define a separate route for `/files` if needed.

Non-wildcard routes take precedence over wildcard routes. A wildcard with a longer prefix takes precedence over a broader wildcard. Routes with equal priority are matched in declaration order: **literal paths do not automatically outrank parameter paths**. For example, put `/users/new` before `/users/:name`.

An unmatched route clears the outlet. Use `/*` to provide a global fallback page.

## Nested routes, index pages and redirects

A parent layout renders the next page through its own `RouterView`. Child paths are relative to the parent:

```tsx
function ProjectsLayout() {
  return (
    <section>
      <h1>Projects</h1>
      <RouterView />
    </section>
  );
}

function ProjectOverview() {
  return <p>Select a project</p>;
}

function Project() {
  const params = useParams<{ id: number }>();
  return <h2>Project {params.id}</h2>;
}

const router = createRouter({
  routes: [
    {
      path: '/projects',
      component: ProjectsLayout,
      children: [{ component: ProjectOverview }, { path: ':id<num>', component: Project }],
    },
    { path: '/legacy', redirectTo: '/projects' },
  ],
});
```

At `/projects`, the child without a `path` renders as the index route. Each `children` array may contain at most one index route. At `/projects/42`, the parent layout stays mounted and its outlet renders `Project`. Omitting the parent's `component` uses an internal `RouterView` to render its child directly.

A parent can also redirect to a default child path:

```ts
{
  path: '/settings',
  redirectChild: 'profile',
  children: [{ path: 'profile', component: Profile }],
}
```

Visiting `/settings` replaces the URL with `/settings/profile`. `redirectTo` is a target relative to the router root; `redirectChild` is appended to the matched parent path. Both replace the current history entry. Avoid redirect cycles when configuring them.

## Reactive parameters and queries

`useParams<T>()` returns the parameter VM for the current outlet depth, including ancestor parameters. Child parameters override ancestor parameters with the same name. `<T>` supplies TypeScript types only; the `<num>` path suffix controls runtime conversion.

`useQuery()` returns the query VM shared by the router. Values are decoded using `URLSearchParams` and remain strings. Repeated keys use their first value; missing keys return `undefined`.

```tsx
import { watch } from 'jinge';
import { useParams, useQuery } from 'jinge-router';

function UserDetails() {
  const params = useParams<{ id: number }>();
  const query = useQuery();

  watch(
    params,
    'id',
    (id) => {
      console.log('Current user:', id);
    },
    { immediate: true },
  );

  return (
    <p>
      {params.id}: {query.tab ?? 'overview'}
    </p>
  );
}
```

When only parameters or the query change, matched page components are reused; their component functions do not run again. Read VM properties directly in templates for reactive updates, and use `watch()` for effects such as loading data. These objects expose route state. Mutating them does not navigate; update the URL through navigation instead.

## Navigation

Get the function returned by `useNavigate()` during component initialization, then call it from event handlers:

```tsx
function Actions() {
  const navigate = useNavigate();
  return (
    <>
      <button on:click={() => navigate('/users/2?tab=activity')}>User 2</button>
      <button on:click={() => navigate('/login', { replace: true })}>Replace</button>
      <button on:click={() => navigate(-1)}>Back</button>
      <button on:click={() => navigate(1)}>Forward</button>
    </>
  );
}
```

Use router paths starting with `/` for string targets. Do not add `baseHref` or the hash mode's `#` yourself. Numeric targets are passed to `history.go()`. Parent-relative navigation with `navigate('..')` is not implemented. Use ordinary `<a>` elements for external destinations.

## Link components

### RouterHref

Renders a native `<a>` element and handles navigation in the current window:

```tsx
<RouterHref to="/users/1" className="nav-link" activeClass="active" exactActiveClass="exact">
  User 1
</RouterHref>
```

| Property           | Description                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `to`               | Required target route path                                                                             |
| `className`        | Class always applied                                                                                   |
| `activeClass`      | Applied when the link's matched route chain is a prefix of the current chain, with matching parameters |
| `exactActiveClass` | Applied when active and both matched chains have the same length                                       |

A link to `/projects` can remain active while a child page is displayed. A parent link is not necessarily exactly active when an index child is rendered. Providing `exactActiveClass` alone also works.

Active state currently matches `to` directly. Use a canonical path without a query for active links; targets containing queries, redirects or noncanonical paths receive no extra resolution. `RouterHref` supports only the properties above and does not forward arbitrary `<a>` attributes. Use `RouterLink` for options such as `replace` or `target`.

### RouterLink

Customize the rendered content through its default slot. Slot state contains `href`, `active` and `exactActive`. `href` already accounts for the routing mode and `baseHref`.

```tsx
import { RouterLink } from 'jinge-router';

<RouterLink to="/users/1" replace>
  {(link) => (
    <a href={link.href} className={link.active ? 'selected' : ''}>
      User 1
    </a>
  )}
</RouterLink>;
```

| Property   | Default  | Description                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| `to`       | Required | Target route path                                                            |
| `replace`  | `false`  | Replace the current history entry                                            |
| `open`     | `false`  | Open the target with `window.open()`                                         |
| `noEvent`  | `false`  | Disable automatic click handling so the caller can handle it                 |
| `noActive` | `false`  | Disable active calculations; both flags stay false, while href still updates |

By default, the click handler is attached only to the first root DOM element rendered by the slot. Disable automatic handling when integrating with a component library or using native link behavior:

```tsx
<RouterLink to="/help" noEvent noActive>
  {(link) => (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      Help
    </a>
  )}
</RouterLink>
```

The `noActive` calculation switch is determined at component creation; the `noEvent` binding switch is determined at mount. Hooks and slots use jinge's compilation and reactivity mechanisms, not React's rendering model.

## Development and testing

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test:unit      # Node test runner + jsdom
pnpm test:e2e       # Playwright + Chrome headless
pnpm test          # Both test groups
pnpm build         # Declarations and dev/prod runtimes
```

E2e tests use an installed Google Chrome by default. CI installs it with `pnpm exec playwright install --with-deps chrome`. Alternatively, install Playwright Chromium and set `PLAYWRIGHT_CHANNEL=chromium`. The test build compiles router source and test TSX and loads source from the installed jinge package. To develop against adjacent repositories, temporarily switch the development dependencies to `link:../jinge` and `link:../jinge-compiler`.

Checks use oxlint; formatting and import sorting use oxfmt. Run `pnpm lint-fix` to apply fixes. Install the recommended Oxc extension in VS Code to format on save with the same configuration.

See [test documentation](./test/README.md) for additional commands, regression cases and report locations.

## Publishing and versioning

The [release workflow](./.github/workflows/ci.yml) runs when a GitHub Release is created or when dispatched manually. It installs locked dependencies, runs lint, module tests and Chrome headless e2e tests, builds JavaScript and type declarations, then publishes to npm. Existing versions are skipped. Browser failures upload the JSON report, screenshots and traces.

Configure npm trusted publishing for this workflow, or provide a `NODE_AUTH_TOKEN` repository secret with publish rights.

```sh
npm version patch      # Or pnpm release:patch / pnpm patch-version
npm version minor      # Other npm version arguments, such as major, also work
```

There is one root package, so npm version updates the version, commits it and creates a tag without a custom synchronization script. Push the commit and tag, then create a GitHub Release to publish. The version command itself does not push or publish.

## Current scope

Supports browser SPAs with a single nested outlet chain, using one `RouterView` per route depth. Navigation guards, named routes, named/parallel outlets, SSR and `..` parent-relative navigation are not currently provided.

## License

[License text](./LICENSE)
