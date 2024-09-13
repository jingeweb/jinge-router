# jinge-router

[jinge-router](https://github.com/jinge-design/jinge-router) 为 [jinge](https://github.com/jinge-design/jinge) 框架实现了一个基础的路由能力。其功能和使用方式的设计主要参考自 [vue-router](https://router.vuejs.org) ，而实现的代码逻辑主要参考自 [jinge-ui-router](https://github.com/jinge-design/jinge-ui-router) 以及 [ui-router-react](https://github.com/ui-router/react)。

切换路由的时候，由于加载 resolves 和 component 可以是异步的，这个过程会产生等待，也可能会出现错误。`jinge-router` 允许指定如何渲染加载状态，以及如何提示错误。

```html
<router-view>
  <div slot-pass:default>loading</div>
  <_slot slot-pass:error vm-use:error>
    <h4>Error occur!</4>
    <p>${error}</p>
  </_slot>
</router-view>
```
