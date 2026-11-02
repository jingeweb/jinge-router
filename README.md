# jinge-router

[jinge](https://github.com/jingeweb/jinge) 的轻量 SPA 路由库。使用 TSX 定义页面，支持 HTML5 History / hash 路由、嵌套布局、重定向、响应式路径参数和 query，以及带激活状态的链接。

[English](./README_en.md)

## 安装与配置

```sh
pnpm add jinge jinge-router
pnpm add -D jinge-compiler vite typescript
```

应用的 TSX 需要由 jinge-compiler 编译。在 Vite 中启用插件：

```ts
import { jingeVitePlugin } from 'jinge-compiler';
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [jingeVitePlugin()],
});
```

TypeScript 的 `jsx` 设为 `preserve`，让 jinge-compiler 处理模板。正常使用从 `jinge-router` 导入；Vite 插件在开发模式下默认切换到 `jinge-router/dev`，构建时默认使用生产入口。`jinge-router/source` 提供源码入口，用于框架或库的联调。

## 快速开始

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

HTML 入口使用 `<script type="module" src="/src/main.tsx"></script>` 加载对应文件。上例访问 `/users/1?tab=activity` 时，`params.id` 为数字 `1`，`query.tab` 为字符串 `'activity'`。

`Router` 提供路由上下文，`RouterView` 渲染当前匹配的页面。链接和 hooks 必须在 `Router` 内使用；`useParams()` 应在 `RouterView` 渲染的页面及其后代组件中调用。

## 路由模式与部署路径

`createRouter()` 接收以下选项：

| 选项       | 默认值    | 含义                  |
| ---------- | --------- | --------------------- |
| `routes`   | 必填      | 路由定义数组          |
| `mode`     | `'html5'` | `'html5'` 或 `'hash'` |
| `baseHref` | `'/'`     | 路由路径前缀          |

```ts
const router = createRouter({
  mode: 'html5',
  baseHref: '/app',
  routes: [{ path: '/users/:id<num>', component: User }],
});
```

路由定义和导航目标都写相对于 router 根的路径：上例仍使用 `/users/1`，不用手动加 `/app`。

| 配置                        | 导航到 `/users/1?tab=activity` 的 URL 示例 |
| --------------------------- | ------------------------------------------ |
| `html5`，默认 base          | `/users/1?tab=activity`                    |
| `html5`，`baseHref: '/app'` | `/app/users/1?tab=activity`                |
| `hash`，默认 base           | `/index.html#/users/1?tab=activity`        |
| `hash`，`baseHref: '/app'`  | `/index.html#/app/users/1?tab=activity`    |

HTML5 模式需要服务器将应用内页面路径回退到 SPA 的 HTML 入口，否则直接访问或刷新子页面可能返回 404。hash 模式将路由和路由 query 放在 `#` 后，不需要服务器处理子路由；`#` 前的 query 不属于路由 query。

`baseHref` 作用于被匹配的路由路径，在 hash 模式下也位于 hash 内。静态资源路径和 Vite 的 `base` 需按实际部署位置另行配置；仅把 HTML 放在 `/app/index.html` 下时，不必因此给 hash 路由设置 `/app` 前缀。

## 路径匹配

| 写法       | 示例              | 匹配结果                           |
| ---------- | ----------------- | ---------------------------------- |
| 静态路径   | `/about`          | 精确匹配路径段                     |
| 字符串参数 | `/users/:name`    | `name` 为字符串                    |
| 数字参数   | `/users/:id<num>` | 只接受数字字符，`id` 转换为 number |
| 通配符     | `/files/*`        | 匹配该前缀后的剩余路径             |

数字参数不接受负号或小数点。`*` 只能出现在最后一个路径段，且不能用于有 `children` 的父路由；通配符内容不会保存为参数。`/files/*` 不匹配 `/files` 本身，需要时为 `/files` 单独定义路由。

匹配时，普通路径优先于通配符路径，前缀更长的通配符优先于更宽泛的通配符。同优先级按声明顺序匹配，**不会自动让静态路径优先于参数路径**：例如 `/users/new` 应写在 `/users/:name` 前。

没有匹配时，出口会清空。可以用 `/*` 提供全局 fallback 页面。

## 嵌套路由、默认页与重定向

父布局通过自己的 `RouterView` 渲染下一层页面，子路由路径相对于父路由：

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

访问 `/projects` 会渲染没有 `path` 的 index 子路由，每组 `children` 最多定义一个 index。访问 `/projects/42` 会保留父布局，在其出口中渲染 `Project`。如果父路由省略 `component`，会使用内置 `RouterView` 直接转交给子路由。

也可以让父路由默认跳转到某个子路径：

```ts
{
  path: '/settings',
  redirectChild: 'profile',
  children: [{ path: 'profile', component: Profile }],
}
```

访问 `/settings` 将替换为 `/settings/profile`。`redirectTo` 是相对于 router 根的目标路径，`redirectChild` 是追加到已匹配父路径后的子路径。二者都替换当前 history 记录；配置两者时注意避免重定向循环。

## 响应式参数与 query

`useParams<T>()` 返回当前出口层级的参数 VM，包含祖先参数；同名参数以子路由为准。`<T>` 只提供 TypeScript 类型，运行时转换由路径中的 `<num>` 决定。

`useQuery()` 返回整个 router 共享的 query VM。值按 `URLSearchParams` 解码并保留为字符串；重复键取第一个值，不存在的键为 `undefined`。

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

只改变路径参数或 query 时，已匹配的页面组件会复用，不会重新执行组件函数。模板直接读取 VM 属性即可响应更新；需要执行数据加载等副作用时使用 `watch()`。这些对象用于读取路由状态，修改它们不会改变浏览器地址，应通过导航更新 URL。

## 导航

在组件初始化时获取 `useNavigate()` 返回的函数，随后可在事件回调中使用：

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

字符串目标统一使用以 `/` 开头的路由内路径，不手动添加 `baseHref` 或 hash 模式的 `#`。数字目标传递给 `history.go()`。父路由相对导航 `navigate('..')` 尚未实现；外部链接使用普通 `<a>`。

## 链接组件

### RouterHref

渲染原生 `<a>` 并处理当前窗口内的路由导航：

```tsx
<RouterHref to="/users/1" className="nav-link" activeClass="active" exactActiveClass="exact">
  User 1
</RouterHref>
```

| 属性               | 含义                                           |
| ------------------ | ---------------------------------------------- |
| `to`               | 目标路由路径，必填                             |
| `className`        | 始终附加的 class                               |
| `activeClass`      | 链接匹配链是当前匹配链的前缀，且参数一致时附加 |
| `exactActiveClass` | 除 active 外，匹配链长度也一致时附加           |

例如链接到 `/projects`，访问它的子页面时仍可为 active；存在 index 子路由时，父链接不一定为 exact active。只提供 `exactActiveClass` 也能工作。

当前激活状态直接匹配 `to`，目标应使用不带 query 的规范路径；带 query、重定向目标或非规范路径的链接不做额外解析。`RouterHref` 只支持上表属性，不透传任意 `<a>` 属性；需要 `replace`、`target` 等控制时使用 `RouterLink`。

### RouterLink

通过默认插槽自定义链接内容。插槽状态包含 `href`、`active`、`exactActive`；`href` 已处理 mode 和 `baseHref`。

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

| 属性       | 默认值  | 含义                                                |
| ---------- | ------- | --------------------------------------------------- |
| `to`       | 必填    | 目标路由路径                                        |
| `replace`  | `false` | 替换当前 history 记录                               |
| `open`     | `false` | 使用 `window.open()` 打开目标                       |
| `noEvent`  | `false` | 不自动绑定点击事件，由调用方处理                    |
| `noActive` | `false` | 不计算激活状态，两个状态值始终为 false；href 仍更新 |

默认只给插槽渲染的第一个根 DOM 元素添加点击处理。与组件库集成，或需要原生链接行为时，可以关闭自动事件绑定：

```tsx
<RouterLink to="/help" noEvent noActive>
  {(link) => (
    <a href={link.href} target="_blank" rel="noopener noreferrer">
      Help
    </a>
  )}
</RouterLink>
```

`noActive` 的计算开关在组件创建时确定，`noEvent` 的事件绑定开关在挂载时确定。路由 hooks 和插槽写法使用 jinge 的编译与响应式机制，不使用 React 的渲染模型。

## 开发与测试

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test:unit      # Node test runner + jsdom
pnpm test:e2e       # Playwright + Chrome headless
pnpm test          # 以上两组测试
pnpm build         # 声明文件、dev/prod 运行时
```

默认 e2e 使用本机 Google Chrome；CI 使用 `pnpm exec playwright install --with-deps chrome` 安装。也可安装 Playwright Chromium 后设置 `PLAYWRIGHT_CHANNEL=chromium`。测试构建会编译 router 源码及测试 TSX，并加载所安装 jinge 包的源码。需要与相邻仓库联调时，可将开发依赖临时切换为 `link:../jinge`、`link:../jinge-compiler`。

检查使用 oxlint，格式化和导入排序统一使用 oxfmt；`pnpm lint-fix` 可自动修复。VS Code 安装仓库推荐的 Oxc 扩展后，使用相同配置在保存时格式化。

更多运行方式、回归用例和报告位置见 [测试说明](./test/README.md)。

## 发布与版本更新

[发布工作流](./.github/workflows/ci.yml) 在创建 GitHub Release 或手动触发时运行：安装锁定依赖，执行 lint、模块测试和 Chrome headless e2e，构建 JS/类型声明，再发布 npm 包。已发布的同版本自动跳过；浏览器失败时上传 JSON 报告、截图和 trace。

npm 侧需为此工作流配置 trusted publishing，或设置具有发布权限的 `NODE_AUTH_TOKEN` 仓库 secret。

```sh
npm version patch      # 或 pnpm release:patch / pnpm patch-version
npm version minor      # 也支持 major 等 npm version 参数
```

只有一个主包，直接使用 npm version 更新版本、提交并创建 tag，无需额外同步脚本。推送提交和 tag 后创建 GitHub Release 触发发布；版本命令本身不会推送或发布。

## 当前范围

目前支持浏览器端 SPA 和单出口嵌套链，每个路由层级使用一个 `RouterView`。尚未提供导航守卫、命名路由、命名/并行出口、SSR，以及 `..` 父路由相对导航。

## 许可

[许可证文件](./LICENSE)
