# 柏宝库桥接脚本的 `SyntaxError`（128 次/天）问题说明

> 目的：记录现象、已核实的证据、根因判断和两档可选修复方案，供评审后再决定是否动手。
> 状态：**仅调查，尚未改任何代码。**

## 1. 反馈原文与含义

> “以及柏宝库那条 SyntaxError：128 次/天，按小时 10–26 次，比之前认定的‘一天一条’频繁得多——它无害，但每 2–6 分钟注入一次失败脚本，不算干净。”

即某份前端控制台统计里，有一类 `SyntaxError` 来源指向柏宝库注入的桥接脚本，频率约每 2–6 分钟一次。报错本身不影响使用，但控制台噪音大。

## 2. 已核实的事实

### 2.1 柏宝库往前端注入什么

| 位置 | 内容 | 触发时机 |
| --- | --- | --- |
| `public/index.html:49-51` | `<script src="/api/plugins/baibaoku/v1/early/bridge.js">` | 插件启动时由 `plugins/baibaoku/src/early-bridge-installer.js` 写入磁盘（marker 块 + `write-file-atomic`，幂等） |
| 前端扩展 `src/preset/globalLibrary.js:651` | 动态创建 `<script src="/api/plugins/baibaoku/v1/client.js">` | `ensureBaiBaoKuBridge()`，在 `loadPresetGlobalPromptLibrary()` 时调用 |

两处都是**普通（classic）script**，没有 `type=module`，也没有任何响应类型校验。

### 2.2 这条报错的产生条件

普通 `<script src>` 不检查 HTTP 状态码，拿到响应体就当 JS 解析。若服务端返回 HTML（401 未授权页、404 兜底页、登录页），浏览器报：

```
Uncaught SyntaxError: Unexpected token '<'
```

本机实测（未登录请求 early bridge）：

```
HTTP/1.1 401 Unauthorized
Content-Type: text/html; charset=utf-8
<body><h1>Unauthorized</h1>...
```

酒馆 404 兜底页同样是 HTML（`src/server-main.js:455` `apply404Middleware`）。即：**只要这两个 URL 没返回 JS，就必然报这个 SyntaxError。**

### 2.3 后端这两条路由本身的实现没问题

- `src/api.js:45`：`GET /v1/client.js` 设为 `application/javascript` 并返回固定脚本文本；
- `src/st-endpoints.js:4886`：`GET /v1/early/bridge.js` 正常与异常分支都设了 `application/javascript`（异常时返回 `console.error(...)` 片段）。

所以它返回 HTML 只可能是**请求没进到插件路由**（插件未装/未启用/启动失败 → 404）或**被酒馆鉴权拦在前面**（会话失效/反代 → 401）。

### 2.4 频率来自重试，不是定时器

- 后端没有周期性注入逻辑（只有启动时的自更新与一次性写入）。
- 前端 `ensureBaiBaoKuBridge()` 失败后**不记忆**：`.finally` 清空 promise，`globalLibraryLoaded` 仍为 `false`，于是每次提示词管理器重绘（切预设、切角色、开面板，见 `src/preset/vueList.js:175`）都会重新插一次脚本 → 一次 SyntaxError。
- `index.html` 那行则是每个页面加载一次。
- 因此“每 2–6 分钟一次”≈ 用户的操作/刷新频率，而非插件频率。报告里“每 2–6 分钟注入一次”的措辞就是这么来的。

### 2.5 为什么说“无害”

脚本没加载成功 ⇒ `window.BaiBaoKu` 为 `undefined` ⇒ 前端走降级分支（全局提示词库不可用，`console.debug` 一句）。不写坏数据、不影响聊天。真正被掩盖的信息是：**该用户环境下柏宝库后端其实不可用**（没装/没启用/启动失败/掉登录）。

### 2.6 另一个隐患：残留标签

`index.html` 里的 marker 块由插件写入，**卸载或插件启动失败时不会清理**。此后每次打开页面都会请求一个不存在的路由 → 404 HTML → 一次 SyntaxError，长期存在。

## 3. 修复方案

### 方案 A（推荐先做）：加载 `client.js` 前先探活，并缓存失败

改动点：`src/preset/globalLibrary.js` 的 `ensureBaiBaoKuBridge()`。

1. 插 `<script>` 前先 `fetch('/api/plugins/baibaoku/v1/status')`（`no-store`，3s 超时），要求 `response.ok === true`、能解析 JSON、`data.installed === true`；不满足直接 reject，**不创建 script 标签**。
   → HTML 再也不会被当 JS 解析，SyntaxError 从源头消失。
2. 失败结果加冷却：参考现有 `SAVE_GENERATE_BACKEND_MISSING_RECHECK_MS`（缺后端 10s 复查）的做法；建议改后**本次页面会话内不再重试**（安装/启用插件本就需要重启酒馆），或 5 分钟冷却。
   → 从“每次重绘都试”降到“每次会话一次”。
3. 失败日志保持 `console.debug`，不升级为 error。

代价：成功路径多一次几十毫秒的请求（`window.BaiBaoKu` 就绪后不再请求）。
风险：低，纯前端。

### 方案 B（治残留标签）：early bridge 改为静态文件

改动点：`plugins/baibaoku/src/early-bridge-installer.js`。

插件启动时把生成的桥接内容写成静态文件（如 `public/baibaoku-early-bridge.js`，安装器已在用 `write-file-atomic`），`index.html` 只引用该静态文件。

- 插件被删除/启动失败 → 文件仍在，404 变 200，不再报错；
- 桥接脚本内加一句“探测不到后端就整体空转”，避免残留脚本去调不存在的 API；
- 401（鉴权拦截）服务端无法解决，由方案 A 的预检兜住。

代价：卸载插件后页面会执行一份“过期但空转”的脚本。
备选（不推荐）：放弃 `index.html` 注入，改为普通扩展加载——会失去“抢在酒馆脚本之前打补丁”的性能设计。

### 方案 C（可选）：加观测点

桥接加载失败时记录 `window.__baiBaoKuBridgeLoadError = { status, contentType, at }`，下次同类反馈可一眼定位（401/404/MIME）。

## 4. 待评审的问题

1. 方案 A 的失败缓存用“整页会话”还是“5 分钟冷却”？前者更省事，后者能在不刷新的情况下感知后端恢复。
2. 方案 A 的预检请求是否也要覆盖 `early/bridge.js`（它由 `index.html` 触发，前端无法预检）？若不覆盖，只能靠方案 B。
3. 方案 B 是否值得为“一天一条”的残留场景改动安装器（涉及自更新、卸载路径的回归测试）？
4. 是否顺带在 `early bridge` 内部对 404/非 JSON 响应做静默降级，防止未来其他注入点重蹈覆辙。

## 5. 不改的部分

- 后端的 `/v1/client.js`、`/v1/early/bridge.js` 路由逻辑；
- 前端各处“加速”补丁与降级路径；
- 酒馆自身的鉴权/404 兜底行为。
