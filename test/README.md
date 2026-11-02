# Router 测试

测试默认使用 package.json 中安装的 jinge 和 jinge-compiler。
`test/build.mjs` 通过所安装的 jinge-compiler 编译 router 和测试 TSX，再由 esbuild 打包；
jinge 从所安装包的 `src/index.ts` 加载。需要与相邻仓库联调时，可将开发依赖临时改为
`link:../jinge`、`link:../jinge-compiler`，此时三个仓库需要保持相邻。
不 mock 路由匹配、响应式系统、编译器或组件生命周期。

## 运行

需要 Node.js 22.12+、pnpm。默认依赖可直接通过 `pnpm install --frozen-lockfile` 安装。
仅在使用相邻仓库的 link 依赖时，需要先安装/构建这些仓库：

```sh
cd ../jinge
pnpm install
pnpm build
cd ../jinge-compiler
pnpm install
pnpm build-cargo-debug
pnpm build-ts
cd ../jinge-router
pnpm install
```

```sh
pnpm test                                      # 模块测试 + Chrome headless e2e
pnpm test:unit                                 # Node test runner + jsdom
pnpm test:unit test/route.test.mjs              # 单个模块
pnpm test:unit test/regressions.test.mjs        # 评审问题回归
pnpm test:e2e                                  # Playwright + 本机 Google Chrome
pnpm test:e2e regressions.spec.mjs              # 浏览器回归
pnpm test:e2e --grep 'R3'                       # 单个浏览器场景
pnpm lint
pnpm build
```

默认使用 Playwright 的 `chrome` channel，必须已安装 Google Chrome。
CI 也可安装 Playwright Chromium 并显式切换（本次验证使用实际 Chrome）：

```sh
pnpm exec playwright install chromium
PLAYWRIGHT_CHANNEL=chromium pnpm test:e2e
```

`ROUTER_TEST_PORT` 可覆盖测试服务器默认端口 5198。
编译产物、e2e JSON 报告、失败截图和 trace 均位于忽略的
`test/.compiled/`、`test/.results/` 下。测试服务器仅监听 `127.0.0.1`，没有复用外部服务。

## 用例分布

| 文件                       | 内容                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `path.test.mjs`            | 路径标准化、各类路径段、非法 wildcard                                                   |
| `route.test.mjs`           | 路由分类、index 校验、优先级、数字/字符串参数、嵌套匹配及回溯                           |
| `core.test.mjs`            | core 隔离、query 通知、参数继承、订阅、redirect、history 和 navigate                    |
| `components.test.mjs`      | Router/RouterView/RouterLink/RouterHref、hooks、DOM 身份、生命周期、注销及视图替换      |
| `regressions.test.mjs`     | 本次评审 8 项问题的 12 个独立回归用例                                                   |
| `e2e/modules.spec.mjs`     | Chrome 中的入口加载、前进/后退、刷新、替换历史、query、params、嵌套视图、原生链接及销毁 |
| `e2e/regressions.spec.mjs` | 同一组评审问题的 9 个浏览器回归用例，包括真实 popup 和新标签页                          |

浏览器测试同时检查断言、未捕获异常和 `console.error`，避免 Router 吞掉异常后误判通过。
测试中的 `R1`–`R8` 对应：嵌套分支误销毁、退回父路由越界、hash query、baseHref、
旧 params 残留、noActive 下 href 冻结、原生 URL 错误、单独 exactActiveClass 不生效。
回归用例始终断言正确行为，没有 `skip`、`todo` 或预期失败标记。

## 修复前后记录

基线源码：`c20902590d99527d0ede08893cb6de7e1e43c9c7`。
在修改 router 实现之前运行测试，确认普通用例全部通过，评审回归全部失败。
2026-11-02 使用 Node.js 26.4.0、Google Chrome 156.0.8078.48 验证：

| 测试组              | 修复前  | 修复后  |
| ------------------- | ------- | ------- |
| 普通模块测试        | 37 通过 | 37 通过 |
| 评审回归模块测试    | 12 失败 | 12 通过 |
| 普通 Chrome e2e     | 12 通过 | 12 通过 |
| 评审回归 Chrome e2e | 9 失败  | 9 通过  |

修复限制在 router 的出口内容清理、参数键清理、URL 解析/生成和链接绑定中，
没有修改 jinge 或 compiler。为配合链接 compiler 的 Vite 类型，开发依赖对齐到 Vite 8。
