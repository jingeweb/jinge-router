import { bootstrap, destroyComponent, onMount, onUnmount, vm } from 'jinge';

import {
  Router,
  RouterHref,
  RouterLink,
  RouterView,
  createRouter,
  useNavigate,
  useParams,
  useQuery,
} from '../../src';

export * from '../../src';
export * from '../../src/core/route';
export * from '../../src/core/path';
export * from '../../src/core/helper';
export * from '../../src/core/navigate';
export * from '../../src/core/view';
export * as rt from 'jinge';

export const events: string[] = [];
function track(name: string) {
  onMount(() => {
    events.push(`mount:${name}`);
  });
  onUnmount(() => {
    events.push(`unmount:${name}`);
  });
}
function Home() {
  track('home');
  return <h1 data-testid="page">Home</h1>;
}
function About() {
  track('about');
  const params = useParams();
  const query = useQuery();
  return (
    <section>
      <h1 data-testid="page">About</h1>
      <output data-testid="stale-id">{params.id}</output>
      <output data-testid="query">{query.tab}</output>
    </section>
  );
}
function User() {
  track('user');
  const params = useParams();
  const query = useQuery();
  return (
    <section data-testid="user">
      <h1 data-testid="page">User</h1>
      <output data-testid="user-id">{params.id}</output>
      <output data-testid="query">{query.tab}</output>
      <RouterView />
    </section>
  );
}
function UserIndex() {
  track('user-index');
  return <p data-testid="user-index">Index</p>;
}
function Post() {
  track('post');
  const params = useParams();
  return (
    <p data-testid="post">
      {params.id}:{params.postId}
    </p>
  );
}
function Shell() {
  track('shell');
  return (
    <section data-testid="shell">
      Shell
      <RouterView />
    </section>
  );
}
function Group() {
  track('group');
  return (
    <section data-testid="group">
      Group
      <RouterView />
    </section>
  );
}
function A() {
  track('a');
  return <p data-testid="a">A</p>;
}
function B() {
  track('b');
  return <p data-testid="b">B</p>;
}
function Other() {
  track('other');
  return <p data-testid="other">Other</p>;
}
function AutoIndex() {
  return <p data-testid="auto-index">Auto index</p>;
}
function Wildcard() {
  return <p data-testid="wildcard">Fallback</p>;
}
function Text() {
  const params = useParams();
  return <p data-testid="slug">{params.slug}</p>;
}

export function makeRoutes() {
  return [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/old', redirectTo: '/about' },
    {
      path: '/users/:id<num>',
      component: User,
      children: [{ component: UserIndex }, { path: 'posts/:postId', component: Post }],
    },
    {
      path: '/shell',
      component: Shell,
      children: [
        {
          path: 'group',
          component: Group,
          children: [
            { path: 'a', component: A },
            { path: 'b', component: B },
          ],
        },
        { path: 'other', component: Other },
      ],
    },
    { path: '/auto', children: [{ component: AutoIndex }] },
    {
      path: '/jump',
      redirectChild: 'child',
      children: [{ path: 'child', component: Other }],
    },
    { path: '/text/:slug', component: Text },
    { path: '/files/*', component: Wildcard },
  ];
}

function App(props: any) {
  const navigate = useNavigate();
  return (
    <>
      <nav data-testid="nav">
        <RouterHref to="/">Home</RouterHref>
        <RouterHref
          to="/about"
          className="about-link"
          activeClass="active"
          exactActiveClass="exact"
        >
          About
        </RouterHref>
        <RouterHref to={props.state.to}>Dynamic</RouterHref>
        <RouterHref to="/about" exactActiveClass="selected">
          Exact only
        </RouterHref>
        <RouterHref to="/shell" activeClass="ancestor" exactActiveClass="exact">
          Shell
        </RouterHref>
        <RouterLink
          to={props.state.to}
          noActive={props.noActive}
          noEvent={props.noEvent}
          open={props.open}
          replace={props.replace}
        >
          {(link) => (
            <a
              data-testid="custom-link"
              href={link.href}
              data-active={link.active}
              data-exact={link.exactActive}
            >
              Custom
            </a>
          )}
        </RouterLink>
        <button data-testid="go-user" on:click={() => navigate('/users/2')}>
          User 2
        </button>
        <button data-testid="replace-about" on:click={() => navigate('/about', { replace: true })}>
          Replace
        </button>
        <button data-testid="back" on:click={() => navigate(-1)}>
          Back
        </button>
      </nav>
      <RouterView />
    </>
  );
}
function Root(props: any) {
  return (
    <Router router={props.core}>
      <App
        state={props.state}
        noActive={props.noActive}
        noEvent={props.noEvent}
        open={props.open}
        replace={props.replace}
      />
    </Router>
  );
}
let current: { dispose: () => void } | undefined;
export function mountApp(options: any = {}) {
  current?.dispose();
  document.body.replaceChildren();
  events.length = 0;
  const core = createRouter({
    routes: makeRoutes(),
    mode: options.mode,
    baseHref: options.baseHref,
  });
  const state = vm({ to: options.to ?? '/about' });
  const host = bootstrap(Root, document.body, { core, state, ...options });
  let disposed = false;
  const app = {
    core,
    state,
    host,
    events,
    dispose() {
      if (disposed) return;
      disposed = true;
      destroyComponent(host);
      document.body.replaceChildren();
    },
  };
  current = app;
  return app;
}
export function disposeApp() {
  current?.dispose();
}
