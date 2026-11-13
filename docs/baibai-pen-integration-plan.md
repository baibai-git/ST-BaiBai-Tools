# 柏宝砚内置柏宝箱：实施与共存方案（交接稿）

> 状态：2026-11-13 已在分支 `feat/builtin-pen` 实施（砚源码取自 ST-BaiBai-Pen `c13d48d`），待真机测。
>
> **以下决定覆盖正文中的旧说法：**
>
> 1. **旧楼层管理器保留**（第 1 节第 3 条、第 5 节、第 11 节第 8 条、第 12 节第 1 条作废）。设置「聊天优化」里新增默认开启的「新版楼层管理器」开关：开＝内置砚，关＝旧版弹窗，切换即时生效不用刷新。魔法棒只有一个「楼层管理器」入口，由 `floorDirectory.js` 注入，点击时 `src/floorManager.js` 按开关分派。
> 2. **独立版检测**不另发 discover：用 ST 导出的 `extensionNames` + `extension_settings.disabledExtensions`，匹配 `third-party/ST-BaiBai-Pen` 或 `ST-BaiBai-Inkwell`（仓库地址安装的目录名），只认“装了且启用”。第 6 节“检测失败兜底”不再需要（酒馆自己的 discover 失败时第三方扩展都不会加载）。检测到独立版时内置砚不启动、入口打开旧版，设置里显示一行说明。
> 3. **以后只在柏宝箱 `src/pen/` 开发**，独立仓库不再加功能。
> 4. 截图只留 `src/pen/st/floorShot.ts`（已合入长聊天兼容），旧版管理器也改用它；`src/floorShot.js` 已删。两份 snapdom 只差一行注释，只留 `src/vendor/snapdom.js`。
> 5. 样式仍由 Shadow Root `<link>` 加载 `dist/index.css`（组件里有 scoped 样式，打进 JS 不划算）；Vue App 第一次打开时才挂载。
> 6. 楼层筛选：`showUserFloors` 换成 `floorFilter`（全部/角色/用户/隐藏）。老用户按原开关迁移（关→角色，开→全部），新用户默认全部。
>
> 本文供后续 agent 评审、实施。实施前应先阅读本文列出的源码，不要只根据文件名下结论。

## 1. 已确认的产品决定

1. 将独立插件 **柏宝砚** 完整内置到 **柏宝箱**，替换柏宝箱现有楼层管理器。
2. 柏宝箱魔法棒菜单的入口文案仍然叫 **“楼层管理器”**，不叫“柏宝砚”，保持简单明确。
   - 这里只约束入口文案。
   - 窗口内部品牌、AI 工作台、设置项等仍可沿用“柏宝砚”名称，除非后续另有决定。
3. 以柏宝砚现有 Vue 界面和功能为主体，不把旧楼层管理器的原生 DOM 弹窗也保留下来。
4. 旧楼层管理器已有、柏宝砚较弱的楼层筛选能力应补齐，至少考虑：**全部 / 角色 / 用户 / 隐藏**。
5. 保留不经过 AI 的整楼手动修改能力；不能让用户误以为选中楼层后只能调用 AI。
6. 两个插件同时安装时，采用 **独立版柏宝砚优先** 的兼容策略，详见第 6 节。
7. 不自动卸载独立插件，不删除独立插件目录，不清空任何用户设置。

## 2. 两个项目的位置

### 柏宝箱（本仓库）

```text
D:/1/SillyTavern/public/scripts/extensions/third-party/SillyTavern-Mobile-Resize-Guard
```

本文中未特别说明的相对路径，均相对于此目录。

### 独立柏宝砚（相邻仓库）

```text
D:/1/SillyTavern/public/scripts/extensions/third-party/ST-BaiBai-Pen
```

本文写作 `../ST-BaiBai-Pen/...` 时，均相对于柏宝箱根目录。

### 记录时的工作区状态

柏宝砚工作区存在未提交修改，至少包括：

```text
M  src/App.vue
M  src/st/floorShot.ts
M  src/vendor/snapdom.js
M  dist/index.js
M  dist/index.js.map
D  dist/snapdom.Ca7IazGN.chunk.js
D  dist/snapdom.Ca7IazGN.chunk.js.map
?? dist/snapdom.CYg61G4P.chunk.js
?? dist/snapdom.CYg61G4P.chunk.js.map
```

**合并必须以当前工作区源码为准，不要用 Git HEAD 或旧 dist 覆盖这些改动。** 实施前仍应重新运行 `git status`，因为状态可能已变化。

## 3. 当前旧楼层管理器的位置与职责

### 入口接线

文件：`src/index.js`

当前相关逻辑：

```js
import * as floorDirectory from './floorDirectory.js';

floorDirectory.configureFloorDirectory({
    settings,
    extensionState,
    logPrefix: LOG_PREFIX,
});

jQuery(() => floorDirectory.installFloorDirectory());
```

内置完成后，上述 import、configure、install 应由柏宝砚模块的统一入口替代。

### 旧界面与楼层操作

文件：`src/floorDirectory.js`

主要职责：

- 向 `#extensionsMenu` 注入“楼层管理器”入口。
- 创建旧式原生 DOM 弹窗。
- 楼层号定位、正文关键词搜索、分页。
- All / Char / User / Hide 筛选。
- 展开楼层、直接编辑原文。
- 隐藏 / 显示、从指定楼层删除到末尾。
- 调用截图模块。

旧菜单相关标识：

```text
bai_bai_toolkit_floor_directory_button
bai_bai_toolkit_floor_directory_wand_container
bai_bai_toolkit_floor_directory_style
bai-bai-floor-overlay
__baiBaiToolkitFloorDirectoryInstalled
```

这些属于旧实现；若确认删除旧模块，不应再额外注入一份相同入口。

### 柏宝箱侧截图实现

文件：`src/floorShot.js`

它最初移植自柏宝砚，但不能简单删除后当作没有差异。当前实现包含柏宝箱长聊天优化的专门兼容：

```text
bai-bai-toolkit-long-chat-render-optimized
bai-bai-toolkit-long-chat-contained
bai-bai-toolkit-long-chat-bottom-anchored
--bai-bai-toolkit-long-chat-mes-height
```

截图克隆需要清理长聊天 `content-visibility` / 高度占位状态，否则可能截出空白或错误高度。

### 共享截图依赖

文件：`src/vendor/snapdom.js`

柏宝箱与柏宝砚各自有一份 snapdom，记录时两份文件大小相同但 SHA-256 不同，不能假设完全一致。

内置后只保留一份运行时代码，并保留双方已经做过的字体、截图性能等补丁。

## 4. 柏宝砚源码地图

### 启动入口

文件：`../ST-BaiBai-Pen/src/index.ts`

当前启动时做了四组事情：

1. `mount()`：创建 Shadow DOM 并挂载 Vue App。
2. `injectMenuButton()`：注入魔法棒入口。
3. `bindEditButtons()`：在 ST 消息编辑区注入 AI 改写按钮。
4. 初始化共享渠道、砚设置和独立更新检查。

内置后建议封装为一个明确的 `initializePen()` / `installPen()`，由柏宝箱 `src/index.js` 调用。**只有获得运行权的实例才能执行这些启动动作。**

Shadow DOM 相关标识：

```text
bby-app-host
```

注意：旧独立版也使用这个 host。若两个版本同时 mount，后启动者会清空同一个 Shadow Root，而先启动者的事件监听、MutationObserver 等不一定随之销毁，因此不能只靠相同 DOM id 判断“不会重复”。

### 主界面

文件：`../ST-BaiBai-Pen/src/App.vue`

这是大文件，包含：

- 楼层列表、搜索、分页、显示 User 开关。
- 隐藏、删除、截图。
- 楼层工作台：标注、多选、手动编辑。
- AI 生成、取消、跨聊天任务恢复、逐段审核。
- 查找替换、快捷语句、自定义提示词。
- 副 API 渠道管理与主题设置。
- 独立插件更新 UI。

内置时应做必要拆分或局部调整，不建议顺手重写整个 App，避免把迁移和功能重构混成一次高风险改动。

楼层页当前默认只显示 AI 楼层；`penSettings.showUserFloors` 打开后才显示 User。旧管理器则默认显示全部，并有单独隐藏筛选，这是需要补齐的主要体验差异。

### 菜单与编辑区按钮

```text
../ST-BaiBai-Pen/src/menu.ts
../ST-BaiBai-Pen/src/editButton.ts
../ST-BaiBai-Pen/src/penIcon.ts
```

`menu.ts` 当前入口文字为“柏宝砚”，内置版应改为 **“楼层管理器”**。

`editButton.ts` 已识别柏宝箱的底部编辑操作容器：

```text
.bai-bai-toolkit-message-edit-bottom-actions
```

柏宝箱对应实现位于：

```text
src/chat/editBottomActions.js
```

这部分已有对接基础，应保留；双插件共存时只能由获得运行权的一方绑定观察器和按钮。

### 楼层操作与保存

```text
../ST-BaiBai-Pen/src/st/floorActions.ts
../ST-BaiBai-Pen/src/st/openFloor.ts
../ST-BaiBai-Pen/src/st/context.ts
../ST-BaiBai-Pen/src/st/floorPreview.ts
../ST-BaiBai-Pen/src/st/floorShot.ts
../ST-BaiBai-Pen/src/st/keyboard.ts
```

重要行为：

- 隐藏 / 显示使用 ST 的 `/hide`、`/unhide`。
- 删除使用 `/del N`，语义为从指定楼层删到末尾，并有确认。
- `applyFloorText()` 会校验聊天是否切换、目标楼层原文是否变化，避免异步生成结果覆盖新内容。
- 保存时同步当前 swipe，并处理正在 ST 原生编辑区中的楼层。
- 截图支持深度 0 重渲染及酒馆助手 iframe 合成。

这些逻辑比旧管理器直接写文更完整，不应在迁移时退化成简单 `message.mes = ...`。

### UI 状态与段落处理

```text
../ST-BaiBai-Pen/src/state/ui.ts
../ST-BaiBai-Pen/src/state/generationTask.ts
../ST-BaiBai-Pen/src/state/review.ts
```

`ui.ts` 同时包含弹窗状态、段落拆分和段落替换逻辑。AI 审阅结果与手动编辑都依赖这些函数，相关测试应一并迁移。

### API、渠道和剧情上下文

```text
../ST-BaiBai-Pen/src/api/client.ts
../ST-BaiBai-Pen/src/api/rewrite.ts
../ST-BaiBai-Pen/src/api/prompts.ts
../ST-BaiBai-Pen/src/api/settings.ts
../ST-BaiBai-Pen/src/api/sharedChannels.ts
../ST-BaiBai-Pen/src/api/storyContext.ts
../ST-BaiBai-Pen/src/api/update.ts
../ST-BaiBai-Pen/src/replacement.ts
```

其中 `update.ts` 是独立插件更新逻辑，内置时不能原样保留，见第 8 节。

### 组件、样式与截图依赖

```text
../ST-BaiBai-Pen/src/components/
../ST-BaiBai-Pen/src/styles/base.css
../ST-BaiBai-Pen/src/styles/theme.css
../ST-BaiBai-Pen/src/vendor/snapdom.js
../ST-BaiBai-Pen/src/vendor/snapdom.d.ts
```

样式通过 Shadow Root 内的 `<link>` 加载构建后的 `index.css`，并与外部 ST 页面样式隔离。内置后应保留这一隔离方式。

## 5. 推荐的代码落点

建议在柏宝箱内集中放入 `src/pen/`，避免把砚的几十个文件散落到现有 `features/`：

```text
src/
  index.js                    柏宝箱总入口，仅负责调用砚的安装入口
  pen/
    index.ts                  砚统一启动、运行权判断、挂载与清理
    App.vue
    menu.ts                   内置入口文案改为“楼层管理器”
    editButton.ts
    penIcon.ts
    replacement.ts
    version.ts                改用柏宝箱版本，或不再负责独立版本号
    api/
    components/
    state/
    st/
    styles/
    vendor/
```

旧的以下文件在功能合并和验证完成后删除：

```text
src/floorDirectory.js
src/floorShot.js
```

如果 `src/floorShot.js` 的柏宝箱兼容补丁先合入 `src/pen/st/floorShot.ts`，最终只保留后者。

import 别名建议使用作用域明确的 `@pen` 指向 `src/pen`，不要直接复用含义过宽的 `@`，以免影响柏宝箱后续模块。

## 6. 双插件共存：独立版优先

### 为什么这样选

现有已发布的旧独立版没有“检测柏宝箱内置砚后主动退出”的逻辑。若新内置版一律抢先运行，旧独立版随后仍会 mount、注入按钮和绑定观察器，造成双开。

因此，为兼容**没有升级过的任何旧独立版**，采用：

```text
检测到 ST-BaiBai-Pen 独立目录
    → 内置版完全不启动
    → 独立版照常运行

未检测到独立目录
    → 柏宝箱内置版运行
```

这不要求用户先更新独立插件，也不会出现“两个实例互相清空 Shadow Root”。

### 内置版检测到独立版后不得执行的动作

- 不创建 / 挂载 `bby-app-host`。
- 不注入内置“楼层管理器”菜单。
- 不绑定消息编辑区 AI 按钮和 MutationObserver。
- 不初始化第二份响应式设置和共享渠道监听。
- 不运行砚自己的更新检查。
- 不显示内置砚窗口。

柏宝箱其他优化功能不受影响，仍正常运行。

### 用户提示

检测到独立版时，可做一次性轻提示，例如：

> 检测到独立版柏宝砚，目前由独立版运行。卸载独立版并刷新后，会自动改用柏宝箱内置楼层管理器，原有设置保留。

可用 localStorage 记录提示是否已经展示，避免每次刷新打扰。提示只解释现状，不自动操作用户插件。

### 检测方式与兜底

柏宝砚现有代码已经调用：

```text
GET /api/extensions/discover
```

并识别：

```text
third-party/ST-BaiBai-Pen
```

可参考 `../ST-BaiBai-Pen/src/api/sharedChannels.ts` 中的 `discoverBook()` 实现。

可以增加全局 owner 标记防止自身重复安装，但**不能只增加全局标记**：旧独立版不会读取它。目录检测才是兼容旧版的关键。

检测请求失败时必须谨慎处理，不能让两边“误以为只有自己”而双开；实施时应明确延迟重试或保守退出的兜底行为。

### 独立插件仓库后续

- 不必为了基本共存立刻修改旧独立版。
- 可在独立仓库 README 标注“已并入柏宝箱”。
- 稳定过渡后再停更 / 归档。
- 不自动卸载、不自动更新、不删除独立版。

## 7. 用户设置与数据继承

### 柏宝砚自身设置

文件：`../ST-BaiBai-Pen/src/api/settings.ts`

当前键：

```text
extensionSettings.baibai_pen
```

包括主题、默认渠道、默认上下文轮数、是否显示 User、快捷语句、自定义提示词和替换规则等。

**内置后继续使用 `baibai_pen`，不要改成柏宝箱自己的设置键。** 这样旧独立版用户卸载独立插件后，内置版可以直接读取原配置，无需迁移。

### 共享副 API 渠道

文件：`../ST-BaiBai-Pen/src/api/sharedChannels.ts`

当前共享键：

```text
extensionSettings.baibai_api_channels
```

事件：

```text
st-baibai-api-channels:changed
```

还涉及：

```text
extensionSettings.baibai_book       旧柏宝书渠道 / 剧情设置兼容
globalThis.STBaiBaiBook             柏宝书共享能力
ST-BaiBai-Book                      柏宝书目录
```

这些键和协议原样保留，避免破坏与柏宝书、柏宝绘的共享。双装时通过“只运行一方”避免重复监听和重复写入。

### 不需要搬迁的数据

旧 `src/floorDirectory.js` 没有需要继承的重要用户配置，因此不存在旧楼层管理器设置迁移问题。

## 8. 更新检查必须合并

### 柏宝砚现有独立更新逻辑

```text
../ST-BaiBai-Pen/src/api/update.ts
../ST-BaiBai-Pen/src/App.vue
../ST-BaiBai-Pen/src/version.ts
```

远程 manifest：

```text
https://raw.githubusercontent.com/baibai-git/ST-BaiBai-Inkwell/main/manifest.json
```

默认更新目录：

```text
ST-BaiBai-Pen
```

如果原样搬进柏宝箱，内置界面里的“更新”可能去更新独立插件仓库，这是错误行为。

### 柏宝箱统一更新入口

```text
src/features/updateCheck.js
src/features/updateDiagnostics.js
src/features/extensionOps.js
src/features/constants.js
manifest.json
scripts/sync-version.mjs
```

内置后：

1. 删除或停用砚的独立远程检查和 `performUpdate()`。
2. 删除砚设置页的独立更新确认弹窗、更新按钮和导航更新红点，或明确改接柏宝箱状态。
3. 推荐在砚设置页显示“随柏宝箱更新”及柏宝箱版本，不再提供第二个更新入口。
4. CSS 等资源缓存参数应使用柏宝箱版本，而不是柏宝砚原 `0.4.x` 版本。
5. 发版仍由柏宝箱 `scripts/sync-version.mjs` 同步 `package.json`、`manifest.json` 和 `dist/index.js?ver=...`。

## 9. 构建与依赖改造

### 当前柏宝箱构建

```text
package.json
vite.config.mjs
scripts/sync-version.mjs
```

特点：

- 入口为 `src/index.js`。
- 输出 `dist/index.js`。
- `inlineDynamicImports: true`，动态 import 也会内联到主包。
- `emptyOutDir: true`。
- 已使用 Vue，但尚未配置 `@vitejs/plugin-vue` 来处理柏宝砚的 `.vue` SFC。
- 当前规范是单 JS 包，减少云端高延迟下多 chunk 请求。

### 柏宝砚原构建

```text
../ST-BaiBai-Pen/package.json
../ST-BaiBai-Pen/vite.config.ts
../ST-BaiBai-Pen/tsconfig.json
```

额外涉及：

```text
@vitejs/plugin-vue
typescript
vue-tsc
vitest
jsonrepair
```

### 实施注意

1. 给柏宝箱 Vite 增加 Vue SFC 插件及 TS / Vue 类型检查配置。
2. 合并依赖，不重复安装两套 Vue；统一版本后验证柏宝箱现有 Vue 正则、预设和世界书功能。
3. 将 Vitest 配置和砚现有测试一并迁移，建议增加 `test:pen`，不要覆盖现有专项测试脚本。
4. 当前 ESLint 主要面向 JS；不要未配置 TS / Vue parser 就直接对所有 `src/pen/**/*.{ts,vue}` 强行 lint。
5. 柏宝砚原构建会生成独立 snapdom chunk；柏宝箱当前 `inlineDynamicImports` 会把它内联。应保持柏宝箱既定单包策略，除非另行评审改变加载策略。
6. 砚的 `base.css` / `theme.css` 会形成 `dist/index.css`，运行时 Shadow Root 链接路径和 `?ver=` 必须验证。
7. 构建后检查 `dist/`，避免残留旧 hash chunk 或引用不存在的资源。

## 10. 功能兼容与验收重点

### 旧楼层管理器替换

- 柏宝箱魔法棒只出现一个“楼层管理器”入口。
- 默认进入砚的楼层页。
- 楼层号、角色名、正文关键词搜索正常。
- 全部 / 角色 / 用户 / 隐藏筛选按最终设计可用。
- 分页、长聊天、未渲染到 DOM 的楼层仍能打开。
- 手动修改不依赖 AI；AI 不可用时仍可编辑、隐藏、删除和截图。
- 删除确认仍明确提示“删除该层及之后楼层”。

### 柏宝砚原有能力

- 跟随主 API 和副 API 都能生成。
- 标注、多选、手动编辑、查找替换、逐段审核正常。
- 生成中关闭窗口、切换聊天、返回目标聊天的任务恢复正常。
- 原文变化或聊天切换后不会错误覆盖楼层。
- 快捷语句、提示词、替换规则、主题和渠道设置刷新后保留。
- 与柏宝书共享渠道能力不回归。

### 截图与柏宝箱优化兼容

- 已加载和未加载到 DOM 的楼层都可截图。
- 长聊天优化开启时不会出现空白图或占位高度错误。
- 酒馆助手 iframe、字体、美化正则和移动端截图按现有能力工作。
- snapdom 只加载 / 打包一份。

### 双插件场景必须逐一验证

1. 仅安装柏宝箱：内置楼层管理器运行。
2. 仅安装旧独立柏宝砚：保持原行为。
3. 新版柏宝箱 + 任意旧独立柏宝砚：仅独立版运行，无双菜单、双按钮、双 Shadow App。
4. 在场景 3 中卸载独立版并刷新：内置版接管，`baibai_pen` 和共享渠道仍在。
5. 重新装回独立版并刷新：重新由独立版接管，内置版退出。
6. 独立目录检测失败：不会双开，并有可诊断日志或提示。

### 构建与自动测试

至少执行：

```text
柏宝砚原有 Vitest 测试
Vue / TypeScript 类型检查
柏宝箱现有专项 Node 测试
柏宝箱生产构建
```

再补浏览器端手工测试，尤其是移动端、长聊天、双插件和真实 AI 请求。

## 11. 推荐实施顺序

1. 以当前工作区柏宝砚源码建立 `src/pen/`，接通 Vue / TS 构建和测试。
2. 实现统一 `initializePen()` 与“独立版优先”运行权判断。
3. 将内置菜单文案设为“楼层管理器”。
4. 合并截图与 snapdom，保留长聊天兼容补丁。
5. 保留 `baibai_pen` / `baibai_api_channels` 数据协议。
6. 移除砚独立更新逻辑，接入柏宝箱版本和发布体系。
7. 补齐楼层筛选及必要的手动编辑体验。
8. 删除 `src/floorDirectory.js`、旧 `src/floorShot.js` 及 `src/index.js` 的旧接线。
9. 更新 `README.md` 的功能说明、源码结构、迁移说明和双插件规则。
10. 完成自动测试、四种安装组合及移动端验收后再发版。

## 12. 不建议的做法

- 不建议同时保留旧楼层管理器弹窗和完整柏宝砚两个内置入口。
- 不建议只用一个新全局变量处理双装；旧独立版不会遵守新协议。
- 不建议让内置版和独立版同时挂载后再靠 DOM id 去重。
- 不建议更换 `baibai_pen` 设置键或复制成另一份配置。
- 不建议自动卸载、更新或删除独立插件。
- 不建议保留砚原来的独立“更新”按钮。
- 不建议直接覆盖当前未提交的柏宝砚源码和 snapdom 修改。
- 不建议在迁移同时大规模重写 `App.vue` 或 AI 请求流程；先保持行为，再单独重构。
