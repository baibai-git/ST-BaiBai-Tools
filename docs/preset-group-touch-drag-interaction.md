# 预设 Vue 列表的点击、滑动与拖拽交互说明

这份文档记录预设分组标题行上同时支持「整行点击展开/收缩」「手机端正常滑动页面」「手机端长按拖拽分组」「PC 端整行拖拽」时的实现思路。

同时也记录当前 Vue 预设列表对条目拖拽、拖入/拖出分组、点击按钮、范围选择、保存和 token 刷新的处理方式。

目标是以后即使不看当前代码，也能按这份说明重新做出相同手感。

## 交互目标

同一个分组标题行需要同时承担这些行为：

- 点击分组标题行任意非按钮区域：展开或收缩分组。
- 点击右侧功能按钮：执行按钮自己的操作，不触发展开/收缩。
- PC 端按住分组标题行拖动：直接拖拽整个分组。
- 手机端按住分组标题行不动一小段时间：进入「可以拖拽」状态，并给用户反馈。
- 手机端长按就绪后移动：拖拽整个分组。
- 手机端从分组标题行开始上下划动：正常滚动预设面板或页面。
- 拖拽结束、滑动结束、误触取消时：不误触发展开/收缩。

整份 Vue 预设列表还需要同时承担这些行为：

- 顶级条目可以排序，整个分组可以排序，分组内条目可以排序。
- 条目可以从组外拖入分组，也可以从分组内拖回组外。
- 手机端条目左侧把手可以立即拖，条目整行拖拽默认关闭，开启后也必须长按。
- 条目按钮、更多菜单、开关、检查/编辑/删除/复制按钮不能触发拖拽。
- 创建分组的范围选择模式下，点击条目用于选择起点/终点，不能同时触发条目原本的按钮或拖拽。
- 拖拽过程中如果触发 token 刷新，只能先标记 pending，不能在拖动中刷新列表。

这个需求的难点是：点击、滑动、长按准备、实际拖拽都发生在同一个 DOM 区域上，如果只依赖浏览器默认事件或 Sortable 的默认状态，很容易互相干扰。

## 核心原则

### 1. 点击展开不要直接依赖普通 click

普通 `click` 是浏览器在 `pointerdown` / `pointerup` 之后合成的事件。

在拖拽库存在长按 delay、chosen 状态、fallback 拖拽时，普通 `click` 会出现这些问题：

- 点击标题行时，拖拽库可能先进入准备态，导致展开动画感觉卡顿。
- 拖拽释放后，浏览器仍可能合成 click，导致误触发展开/收缩。
- 手机上滑动后松手，也可能触发 click fallback。

因此展开/收缩应该自己用 pointer 手势判断：

1. `pointerdown` 记录起点坐标。
2. `pointerup` 计算移动距离。
3. 只有移动距离很小、没有滚动、没有拖拽、没有刚结束拖拽时，才执行展开/收缩。

普通 `click` 只作为 fallback，用于少数环境没有完整 pointer 行为时兜底，并且必须有抑制逻辑。

### 2. 不要把 Sortable 的 chosenClass 当作「可以拖」

Sortable 的 `chosenClass` 通常表示元素已经被按住并进入候选状态，但它不一定等于：

- 长按时间已经满足。
- 用户现在松开后不会触发展开。
- 元素已经能被移动拖拽。

如果把描边、震动等提示直接绑在 `chosenClass` 上，就可能出现「提示已经出现，但还不能拖」的问题。

正确做法是自己维护一个「drag ready feedback」状态：

- `pointerdown` 时启动一个和 Sortable delay 一致的定时器。
- 定时器到点后，才显示描边、背景、缩放等提示。
- 定时器到点的含义就是：长按时间满足，用户现在开始移动就应该能拖。
- 如果定时器到点前发生滑动、松手或取消，就清掉定时器。

### 3. 手机端标题滑动优先使用原生滚动

分组排序本身就是纵向拖拽。

手机端分组排序本身是纵向拖拽，和页面纵向滚动天然冲突。旧方案曾经让分组标题行使用：

```css
touch-action: none;
```

这样 Sortable 能稳定拿到长按后的纵向移动事件，但浏览器原生滚动和甩动惯性会被关掉，只能靠 JS 手动滚动，手感不如系统原生。

当前方案改为让分组标题行在手机端使用：

```css
touch-action: pan-y;
```

普通上下滑动完全交给浏览器原生滚动。用户按住标题不动达到长按时间后，再由插件进入「自定义分组拖拽」状态，并复用现有的手动落点、插入线、边缘自动滚动和延迟保存逻辑移动整个分组。

### 4. PC 端不要加长按 delay

PC 鼠标拖拽的用户预期是：

- 按下后移动就是拖。
- 单击就是展开/收缩。

如果 PC 端也加长按 delay，点击标题行时会被拖拽库的准备状态拖慢，展开/收缩动画会感觉卡。

PC 端只需要设置一个很小的移动阈值，用来避免鼠标轻微抖动造成误拖。

## 推荐参数

当前实现使用的参数含义如下：

```js
const PRESET_VUE_TOUCH_DRAG_DELAY_MS = 320;
const PRESET_VUE_TOUCH_START_THRESHOLD_PX = 10;
const PRESET_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX = 6;
const PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS = 350;
const PRESET_VUE_POINTER_START_THRESHOLD_PX = 4;
```

说明：

- `PRESET_VUE_TOUCH_DRAG_DELAY_MS = 320`
  - 手机端长按 320ms 后进入「可以拖拽」状态。
  - 这个值太短会误伤滑动，太长会感觉拖拽迟钝。

- `PRESET_VUE_TOUCH_START_THRESHOLD_PX = 10`
  - 手机端长按到点前，如果移动超过 10px，就判定为普通滑动或取消长按，不再准备拖拽。
  - 这个值负责过滤手指自然抖动。

- `PRESET_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX = 6`
  - 点击展开/收缩允许的最大移动距离。
  - 如果按下到抬起超过这个距离，就不认为是点击。

- `PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS = 350`
  - 拖拽结束、滑动取消后，在 350ms 内屏蔽 click fallback。
  - 用来避免释放手指时误触发展开/收缩。

- `PRESET_VUE_POINTER_START_THRESHOLD_PX = 4`
  - PC 鼠标拖拽阈值。
  - 只防轻微抖动，不做长按等待。

## 拖拽库配置

VueDraggable / Sortable 的手势配置需要区分手机和 PC。

推荐结构：

```js
function applyDragGestureOptions(draggableProps) {
    if (isMobile()) {
        Object.assign(draggableProps, {
            delay: TOUCH_DRAG_DELAY_MS,
            delayOnTouchOnly: true,
            touchStartThreshold: TOUCH_START_THRESHOLD_PX,
            fallbackTolerance: TOUCH_START_THRESHOLD_PX,
        });
        return;
    }

    Object.assign(draggableProps, {
        touchStartThreshold: POINTER_START_THRESHOLD_PX,
        fallbackTolerance: POINTER_START_THRESHOLD_PX,
    });
}
```

重点：

- 手机端使用 `delay`。
- `delayOnTouchOnly` 必须为 `true`，避免鼠标也被 delay。
- 手机端 `touchStartThreshold` 和 `fallbackTolerance` 建议保持一致。
- PC 端不要设置 `delay`。
- PC 端只保留较小的 `touchStartThreshold` / `fallbackTolerance`。

## 不要让 ST 原生 sortable 和 VueDraggable 并存

预设分组开启后，原生 PromptManager 的 jQuery sortable 不能继续接管同一个列表。

原因是 Vue 列表里同时存在：

- 顶级 VueDraggable。
- 每个分组内部的 VueDraggable。
- 插件自己的手动落点和插入线。
- Vue 根据 `model.items` / `group.children` 做的渲染同步。

如果 ST 原生 sortable 还在，它会在 VueDraggable 之外继续移动 DOM，导致 DOM 顺序、Vue model 顺序、PromptManager 的 prompt_order 三者短时间不一致。表现通常是放下瞬间卡顿、条目回弹、拖入/拖出分组后索引错乱。

当前实现的处理方式是：

1. patch `promptManager.makeDraggable`。
2. Vue 分组列表启用时，调用 `disablePromptManagerStockSortable(list)` 销毁原生 jQuery sortable。
3. 只保留拖拽所需的样式 class 和 `.drag-handle.ui-sortable-handle` 兼容标记。
4. 非分组模式下才使用插件自己的单层 custom drag 优化。

这一步是拖拽流畅性的前提。否则后面即使修了 VueDraggable 参数，仍然会被原生 sortable 的 DOM 修改打断。

## 分组标题行事件模型

分组标题行不要只绑定 `click`，而应该绑定这些事件：

```js
onPointerdown
onPointermoveCapture
onPointerup
onPointercancel
onClick
```

各事件职责：

### pointerdown

负责建立一次手势上下文。

需要记录：

- 当前分组 ID。
- `pointerId`。
- 起点坐标 `x` / `y`。
- 当前时间 `startedAt`。
- 上一次坐标 `lastX` / `lastY`。
- 是否已经判定为滚动 `scrolling`。
- 是否已经进入自定义拖拽 `dragging`。
- 长按 timer `readyTimer`。

同时：

- 清理旧的 ready feedback。
- 手机端启动新的长按 timer；timer 到点后进入自定义分组拖拽。
- 如果点的是右侧按钮、展开按钮、输入框等交互元素，直接忽略。

伪代码：

```js
function onPointerDown(event, groupId) {
    if (isInteractiveTarget(event.target)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.isPrimary === false) return;

    const point = getPoint(event);
    if (!point) return;

    const manager = getManager();
    const feedbackElement = getGroupLi(event.currentTarget);

    clearDragReadyFeedback(manager);

    manager.groupHeaderGesture = {
        groupId,
        pointerId: event.pointerId,
        startedAt: Date.now(),
        x: point.clientX,
        y: point.clientY,
        lastX: point.clientX,
        lastY: point.clientY,
        scrolling: false,
        dragging: false,
        readyTimer: null,
    };

    if (isMobile()) {
        manager.dragReadyFeedbackElement = feedbackElement;
        manager.groupHeaderGesture.readyTimer = setTimeout(() => {
            beginCustomGroupHeaderDrag(manager, manager.groupHeaderGesture);
        }, TOUCH_DRAG_DELAY_MS);
    }
}
```

### pointermoveCapture

只在手机端处理，用来区分「原生滚动」和「已经进入的自定义分组拖拽」。

判断逻辑：

- 如果已经进入自定义分组拖拽，更新手动落点，并阻止浏览器继续滚动。
- 如果还没进入自定义分组拖拽，并且移动超过阈值，判定为普通滑动。
- 一旦判定为普通滑动：
  - 清理 ready feedback。
  - 设置 `gesture.scrolling = true`。
  - 记录 `lastGroupHeaderGestureCanceledAt`。
  - 清掉长按 timer。
  - 不调用 `preventDefault()`，让浏览器继续原生滚动和惯性。

伪代码：

```js
function onPointerMoveCapture(event, groupId) {
    if (!isMobile()) return;

    const manager = getManager();
    const gesture = manager.groupHeaderGesture;

    if (!gesture) return;
    if (gesture.groupId !== groupId) return;
    if (gesture.pointerId !== event.pointerId) return;
    if (manager.state?.dragging) return;

    const point = getPoint(event);
    if (!point) return;

    const deltaX = point.clientX - gesture.x;
    const deltaY = point.clientY - gesture.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gesture.dragging) {
        updateManualDragPlacement(event);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    if (Math.max(absX, absY) <= TOUCH_START_THRESHOLD_PX) return;

    gesture.scrolling = true;
    manager.lastGroupHeaderGestureCanceledAt = Date.now();
    clearLongPressTimer(gesture);
    clearDragReadyFeedback(manager);
}
```

这个函数的重点是：普通滑动不再由 JS 模拟，而是交还给浏览器；只有长按成功后的拖拽阶段才阻止默认滚动。

### pointerup

负责判断这次手势是否应该展开/收缩。

只有满足这些条件才展开/收缩：

- 手势存在。
- groupId 和 pointerId 匹配。
- 目标不是按钮等交互元素。
- 没有判定为滚动。
- 当前没有拖拽。
- 不是刚刚拖拽结束。
- 按下到抬起的移动距离小于点击阈值。

伪代码：

```js
function onPointerUp(event, groupId) {
    const manager = getManager();
    const gesture = manager.groupHeaderGesture;

    if (!gestureMatches(gesture, event, groupId)) return;

    manager.groupHeaderGesture = null;
    clearDragReadyFeedback(manager);

    if (isInteractiveTarget(event.target)) return;
    if (shouldSuppressToggle(manager)) return;

    const point = getPoint(event);
    if (!point) return;

    if (gesture.scrolling) {
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
        return;
    }

    if (distance(gesture, point) > TOGGLE_DISTANCE_PX) {
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    manager.lastGroupHeaderToggleAt = Date.now();
    toggleGroupCollapsed(groupId);
}
```

### pointercancel

负责清理手势。

任何取消都应该：

- 清掉 `manager.groupHeaderGesture`。
- 清掉 ready feedback。
- 记录一次 `lastGroupHeaderGestureCanceledAt`。

### click fallback

`click` 只做兜底，不作为主要展开逻辑。

需要检查：

- 是否点在交互元素上。
- 距离上次 pointerup 展开是否很近。
- 距离上次滑动取消是否很近。
- 距离上次拖拽结束是否很近。
- 当前是否正在拖拽。

如果这些条件触发，就 `preventDefault()` / `stopPropagation()`，不要展开。

## 标题长按自定义分组拖拽

分组标题行在手机端使用 `touch-action: pan-y` 后，普通滑动可以恢复浏览器原生滚动。但 Sortable 不应该再从标题行启动拖拽，否则它会再次和原生滚动抢同一条手势。

因此手机端的标题长按拖拽由插件自己启动：

1. `pointerdown` 记录 groupId、pointerId、起点坐标，并启动长按 timer。
2. timer 到点前只要移动超过阈值，就取消 timer，判定为普通原生滚动。
3. timer 到点时，如果手势仍然停留在标题上，就进入自定义分组拖拽。
4. 自定义拖拽复用 `beginPresetVuePromptManualDragWithItem(model, { type: 'group', id: groupId }, point)`。
5. 进入拖拽后开启已有的 `touchmove` scroll guard，阻止浏览器继续滚动。
6. 拖拽中的落点、插入线、边缘自动滚动、放下后的模型移动和 pending 保存，全部复用现有 manual drag 逻辑。

手机端 Sortable handle 也要配合调整：

- 关闭「手机预设条目整条拖拽」时，handle 只允许 `.drag-handle`。
- 开启「手机预设条目整条拖拽」时，handle 只匹配 `li.completion_prompt_manager_prompt_draggable`，让 prompt 行整行可拖。
- `.bai-bai-preset-group-drag-surface` 不再作为 Sortable handle，避免分组标题滑动被拖拽库拦截。

## 实际拖拽中的滚动保护和边缘自动滚动

上面的「标题长按自定义分组拖拽」只处理启动方式。进入真实拖拽后需要另一套处理：

进入真实拖拽后需要另一套处理：

- 手机端开启 `touchmove` 捕获监听。
- 当 `model.dragging` 为 true 时，对文档级 `touchmove` 调用 `preventDefault()`。
- 这样可以避免浏览器原生滚动和 fallback ghost 拖拽同时移动，减少拖拽漂移。

但阻止原生滚动以后，用户把条目拖到列表顶部或底部时仍然应该能继续滚动列表，所以需要边缘自动滚动：

1. `onStart` 时记录拖拽滚动容器，优先使用 PromptManager 外层滚动容器，最后兜底 `document.scrollingElement`。
2. 拖拽中记录最新指针坐标 `lastDragPoint`。
3. 每帧检查指针是否靠近滚动容器顶部或底部。
4. 靠近边缘时按距离计算滚动步长。
5. 如果发生滚动，清掉拖拽布局缓存，并在下一帧重新计算落点和插入线。

伪代码：

```js
function onDragFrame(manager) {
    updateManualPlacement(manager.lastDragPoint);

    if (autoScrollDragContainer(manager.dragScrollContainer, manager.lastDragPoint)) {
        manager.dragLayoutCache = null;
        requestAnimationFrame(() => onDragFrame(manager));
    }
}
```

注意不要在每个 `pointermove` 里同步读所有 DOM rect。当前实现是 `pointermove` 只记录坐标，再用 `requestAnimationFrame` 批量计算落点、插入线和自动滚动。

## ready feedback 设计

ready feedback 表示：

> 长按时间已经满足，用户现在移动就应该可以开始拖拽。

它不等于正在拖拽，也不等于 Sortable chosen。

推荐单独维护一个类：

```js
const DRAG_READY_FEEDBACK_CLASS = 'drag-ready-feedback';
```

流程：

1. `pointerdown` 时启动定时器。
2. 定时器时间和 Sortable 的 `delay` 一致。
3. 如果定时器到点前发生滚动、松手、取消，就清掉。
4. 到点后进入自定义分组拖拽，并给当前分组 `li` 加 ready class。
5. 同时触发一次短震动。
6. 如果是 Sortable 路径进入 `onStart`，而 ready 已经提示过，不重复震动。
7. 拖拽结束、pointerup、pointercancel、列表卸载时清理 ready class。

伪代码：

```js
function armGroupHeaderLongPress(manager, gesture, element) {
    manager.dragReadyFeedbackElement = element;
    gesture.readyTimer = setTimeout(() => {
        if (manager.groupHeaderGesture?.scrolling) {
            clearDragReadyFeedback(manager);
            return;
        }

        beginCustomGroupHeaderDrag(manager, gesture);
    }, TOUCH_DRAG_DELAY_MS);
}

function showDragReadyFeedback(manager, { notify = true } = {}) {
    clearTimeout(manager.dragReadyFeedbackTimer);
    manager.dragReadyFeedbackTimer = null;

    manager.dragReadyFeedbackElement?.classList.add(DRAG_READY_FEEDBACK_CLASS);

    if (notify && !manager.dragReadyFeedbackNotified) {
        manager.dragReadyFeedbackNotified = true;
        vibrate();
    }
}

function clearDragReadyFeedback(manager) {
    clearTimeout(manager.dragReadyFeedbackTimer);
    manager.dragReadyFeedbackTimer = null;

    manager.dragReadyFeedbackElement?.classList.remove(DRAG_READY_FEEDBACK_CLASS);
    manager.dragReadyFeedbackElement = null;
    manager.dragReadyFeedbackNotified = false;
}
```

## 实际拖拽状态

Sortable 的 `onStart` 和 `onEnd` 仍然负责实际拖拽状态。

`onStart` 应该：

- 清掉当前 header gesture。
- 记录 `lastDragStartedAt`。
- 如果 ready feedback 还没显示，兜底显示一次，但不一定震动。
- 设置 `model.dragging = true`。
- 给 body 加拖拽 class。
- 开启手机端滚动保护。
- 捕获拖拽前列表快照。

`onEnd` 应该：

- 记录 `lastDragEndedAt`。
- 设置 `model.dragging = false`。
- 清理 ready feedback。
- 关闭手机端滚动保护。
- 如果顺序真的变化，再安排保存。

注意：

- ready feedback 代表「可以拖」。
- `model.dragging` 代表「已经进入实际拖拽」。
- 这两个状态不能混为一谈。

## 手动落点、插入线和模型移动

当前 Vue 预设列表不要依赖 Sortable 自己的占位排序。

外层和内层 VueDraggable 都配置成：

- `sort: false`
- `animation: 0`
- `forceFallback: true`
- `fallbackOnBody: true`
- `move` 里只更新手动落点，然后返回 `false`

这样做的目的不是放弃 VueDraggable，而是把职责拆开：

- VueDraggable / Sortable 负责启动拖拽、生成 fallback ghost、发出 `onStart` / `onEnd`。
- 插件自己负责按指针坐标计算落点、显示插入线、移动 Vue model。
- Vue 负责把最终 model 渲染回 DOM。

拖拽开始时需要缓存一次布局：

```js
{
    topLevel: {
        containerRect,
        children: [{ element, rect }],
    },
    groups: [{
        groupId,
        groupElement,
        hitRect,
        containerRect,
        children: [{ element, rect }],
    }],
    scrollSignature,
}
```

缓存时要排除这些临时元素：

- Sortable fallback / ghost / chosen / drag 元素。
- 正在被拖拽的原始 DOM。

否则插入位置会被 ghost 或 fallback 自己影响，表现为插入线跳动。

拖拽中只按坐标算两类落点：

1. 如果拖的是 prompt，先判断是否命中展开分组的 body/list 隐形投放区。
2. 如果没有命中分组，再判断是否落在顶级列表。

顶级列表的插入 index 必须做下限保护：

```js
index = Math.max(2, index);
```

因为顶级列表前两个元素是 header 和 separator，条目不能插到它们前面。

插入线使用固定定位元素挂到 `document.body`，不要把插入线作为列表子节点插入 VueDraggable 容器。这样不会改变 Vue list 的 DOM child index，也不会制造额外布局高度。

放下时只做一次模型移动：

- 拖整个分组：移动 `model.items` 里的 group。
- prompt 放入分组：从原位置移除，插入 `group.children[index]`，并写入 `groupId`。
- prompt 放回组外：从原分组移除，插入 `model.items[index]`，并清空 `groupId`。

然后通过拖拽前快照和当前快照比较顺序、分组归属是否变化。只有真的变化才进入 pending 保存。

## 展开/收缩动画

分组内部条目的展开/收缩动画推荐使用 CSS grid，不推荐用 JS 实时计算高度。

推荐结构是：

```html
<li class="group">
    <div class="group-header">...</div>
    <div class="group-body">
        <div class="group-body-inner">
            <ul class="group-list">...</ul>
        </div>
    </div>
</li>
```

其中：

- `group` 是整个分组容器。
- `group-header` 是固定显示的标题行。
- `group-body` 是负责高度动画的外壳。
- `group-body-inner` 是真正包住内部列表内容的容器。
- `group-list` 是 VueDraggable 挂载的内部条目列表。

核心 CSS：

```css
.group-body {
    display: grid;
    grid-template-rows: 1fr;
    overflow: hidden;
    transition: grid-template-rows 260ms ease, opacity 260ms ease;
}

.group-collapsed .group-body {
    grid-template-rows: 0fr;
    opacity: 0;
}

.group-body-inner {
    min-height: 0;
    overflow: hidden;
}
```

关键点是 `grid-template-rows: 1fr -> 0fr`。

这可以让浏览器自己根据内容高度做插值动画，不需要代码读取 `scrollHeight`，也不会在每次展开/收缩时强制同步布局。

`group-body-inner` 必须有：

```css
min-height: 0;
overflow: hidden;
```

否则 grid item 可能因为默认 `min-height: auto` 撑开父容器，导致 `0fr` 收不起来，表现为动画失效或内容仍然可见。

### 为什么不推荐 JS 计算高度

JS 高度动画常见做法是：

1. 展开前读取 `scrollHeight`。
2. 设置 `height: 0px`。
3. 下一帧设置 `height: ${scrollHeight}px`。
4. 动画结束后再改成 `height: auto`。
5. 收缩时再反向计算。

这种方式在静态内容里可用，但在这个预设分组列表里问题很多：

- 内部是 VueDraggable，拖拽时 DOM 会插入 ghost、chosen、fallback 元素。
- 条目启用状态、token 数、按钮显示、主题 CSS 都可能改变内容高度。
- 展开/收缩过程中如果 Vue 重新渲染，之前计算的高度会过期。
- 读取 `scrollHeight` 会触发布局计算，列表较长时容易造成卡顿。
- 如果在动画中移动条目进出分组，JS 计算高度很容易错。
- 需要监听 `transitionend` 清理内联样式，异常中断时容易留下脏状态。

所以这里推荐 grid 动画。

### grid 动画和 VueDraggable 的配合

VueDraggable 应该挂在内部真实列表上，而不是直接挂在动画外壳上。

推荐：

```html
<div class="group-body">
    <div class="group-body-inner">
        <VueDraggable tag="ul" class="group-list">
            ...
        </VueDraggable>
    </div>
</div>
```

不要让 `group-body` 同时负责：

- grid 高度动画
- Sortable 容器
- 列表 gap
- 拖拽 ghost / fallback 样式

这些职责混在一起时，拖拽库插入占位元素会影响动画容器高度，展开/收缩时也更容易闪烁。

更稳的职责划分是：

- `group-body`：只负责展开/收缩高度。
- `group-body-inner`：只负责裁剪内容。
- `group-list`：只负责内部列表布局和拖拽。

### gap 的处理

分组外层列表和分组内部列表的 gap 要分开处理。

推荐：

- 外层 `#completion_prompt_manager_list` 保持原生主题能控制的 gap。
- 分组容器 `.group` 自己不要继承 `text_pole` 这类原生列表类。
- 分组内部 `.group-list` 用 CSS 变量或从外层读取到的值，确保内部条目 gap 和外部条目一致。

如果直接给 `group-body` 或额外包装层加 gap，很容易出现：

- 收缩时还残留间距。
- 分组内部条目间距和外部不一致。
- 第一个或最后一个条目和标题行之间距离不自然。

比较稳的做法是：

```css
.group {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
}

.group-list {
    display: flex;
    flex-direction: column;
    gap: var(--preset-list-gap);
}
```

如果收缩时希望标题行和 body 之间没有残留空隙，不要把 gap 放在 `.group` 上，而应该放在真正的条目列表上。

## 条目拖拽与拖入/拖出分组

预设分组列表不是一个单层列表，而是两层 VueDraggable：

- 外层列表：负责顶级预设条目和整个分组的排序。
- 分组内列表：负责分组内部预设条目的排序。

VueDraggableNext 是 Vue 封装层，底层仍然由 SortableJS 负责基础手势、ghost/fallback 元素、拖拽生命周期和 `onMove` 回调。但当前实现不依赖 Sortable 的默认占位和自动排序来决定最终落点，最终位置由插件按坐标手动计算并移动 Vue model。

也就是说，实现时仍然要按 Sortable 的规则设计 DOM、selector、filter 和 handle，但不要把“放到哪里”完全交给 Sortable 自己决定。

### 手机端把手和整行拖拽策略

手机端不能把所有区域都做成“秒拖”。预设条目本身有点击、滑动、按钮、菜单等交互，如果整行触摸立即进入拖拽，会非常容易误触，也会破坏页面滚动。

推荐区分三个触摸区域：

- 条目左侧拖拽把手 `.drag-handle`：这是明确的拖拽入口，可以接近秒拖。
- 条目非按钮区域：只有开启“手机预设条目整条拖拽”后才允许拖，并且应该长按后再拖。
- 分组标题行：因为还承担展开/收缩和页面滚动，必须长按后再拖，不能秒拖。

也就是说：

```text
手机端条目把手      -> delay 0，小移动阈值，直接拖。
手机端条目整行      -> delay 320ms，大一点的 touch threshold，滑动会取消。
手机端分组标题整行  -> delay 320ms，并配合 pointer 手势判断点击/滚动。
PC 端              -> 不加 delay，只用小移动阈值。
```

实现时不要为“把手秒拖”和“整行长按”创建两套列表。更稳的做法是：

1. VueDraggable 的默认移动端参数仍然是长按：

```js
{
    delay: TOUCH_DRAG_DELAY_MS,
    delayOnTouchOnly: true,
    touchStartThreshold: TOUCH_START_THRESHOLD_PX,
    fallbackTolerance: TOUCH_START_THRESHOLD_PX,
}
```

2. 在捕获阶段监听 `pointerdown` / `touchstart`，要早于 Sortable 自己处理事件。
3. 根据本次按下的目标动态改当前 Sortable 实例的选项：

```js
function configureDragDelayForEvent(event) {
    const target = event.target;
    const sortable = findSortableForClosestList(target);
    const immediateHandle = Boolean(target.closest('.drag-handle'));

    sortable.option('delay', immediateHandle ? 0 : TOUCH_DRAG_DELAY_MS);
    sortable.option('touchStartThreshold', immediateHandle ? POINTER_THRESHOLD_PX : TOUCH_THRESHOLD_PX);
    sortable.option('fallbackTolerance', immediateHandle ? POINTER_THRESHOLD_PX : TOUCH_THRESHOLD_PX);
}
```

这样把手触摸时可以立刻拖，整行触摸时仍然需要长按。注意这个动态配置必须发生在捕获阶段，否则 Sortable 已经读取了旧 delay，本次手势不会生效。

### 手机端 handle selector

手机端默认不应该允许预设条目整行拖拽，因为用户更常见的动作是滚动列表或点开按钮。默认 selector 可以是：

```js
handle: '.drag-handle'
```

含义是：

- 预设条目只能从 `.drag-handle` 开始拖。
- 分组标题行不交给 Sortable，从标题长按拖分组由自定义分组拖拽接管。
- 按钮、输入框、菜单等交互区域继续由 `filter` 排除。

当用户开启“手机预设条目整条拖拽”时，handle 只匹配 prompt 行：

```js
handle: 'li.completion_prompt_manager_prompt_draggable'
```

这样条目非按钮区域也能作为拖拽起点，但分组标题仍不会被 Sortable 接管。这时仍要保留动态 delay：

- 点 `.drag-handle`：delay 0。
- 点条目其他非按钮区域：长按 delay。
- 点按钮/菜单/输入框：被 `filter` 排除，不进入拖拽。

不要把移动端所有触摸都改成 delay 0。这样虽然看起来“灵敏”，但会带来三个问题：

- 轻微滑动列表就可能误拖。
- 点击条目按钮时更容易被拖拽库抢事件。
- 分组标题行的展开/收缩和长按拖拽会再次互相干扰。

### 点击、按钮菜单和拖拽 filter

Vue 预设列表里有很多点击入口，这些入口必须从拖拽起点里排除。

当前实现统一用一个 interactive selector 做过滤，范围包括：

- 条目控制区 `.prompt_manager_prompt_controls`。
- 更多菜单按钮 `.bai-bai-preset-prompt-actions-hint`。
- 更多菜单面板 `.bai-bai-preset-prompt-actions`。
- 删除/复制/编辑按钮 `[data-preset-prompt-action]`。
- 检查、编辑、开关等 ST 原生 action class。
- 分组右侧按钮和展开按钮。
- `a`、`button`、`input`、`select`、`textarea`、`[contenteditable]`。

VueDraggable 里要同时配置：

```js
filter: INTERACTIVE_SELECTOR,
preventOnFilter: false,
```

含义是：

- 点这些区域时不进入拖拽。
- 点击事件仍然可以继续走按钮自己的处理逻辑。

操作菜单也要和拖拽状态互斥：

- 点击更多按钮时打开/关闭当前条目的操作菜单。
- 点击列表里非菜单区域时关闭已打开菜单。
- `onChoose` / `onStart` 时关闭菜单，避免菜单跟着 ghost/fallback 被复制。
- fallback / ghost / drag 样式里强制隐藏菜单面板，避免拖拽影子里出现可点击按钮。

条目按钮的点击不直接依赖 Vue 组件内部事件。外层还有文档级捕获 click 委托，用来兼容原生 ST 的 inspect/edit/detach 行为、复制按钮、删除确认，以及 Vue 渲染和非 Vue 渲染之间的差异。

### 范围选择创建分组时要接管点击

点击列表头的“创建预设分组”后，列表进入范围选择模式。

这个模式下：

1. 第一次点击 prompt 条目，设置 `startId`。
2. 鼠标经过其他条目时更新 `hoverId`，用于显示选中范围。
3. 第二次点击 prompt 条目，设置 `endId` 并确认创建分组。
4. 再次点击起点可以取消起点，重新选择。

范围选择模式必须阻止条目原本点击行为：

```js
event.preventDefault();
event.stopPropagation();
event.stopImmediatePropagation();
```

同时还要：

- 给可选条目加 crosshair 光标和范围 outline。
- 降低条目控制区透明度，并让控制区不接收 pointer 事件。
- 在外层和内层 VueDraggable 的 `move` 判断里直接返回 `false`，禁止范围选择期间拖拽。

否则用户想选范围时，可能误触发检查/编辑/开关按钮，或者进入拖拽状态。

### 外层和内层的 draggable 要分开

外层列表应该只接管自己的直接子项，不能让外层 Sortable 扫到分组内部的嵌套 `li`。

推荐：

```js
const TOP_LEVEL_DRAGGABLE = '>li:is(.top-level-draggable,.prompt-draggable)';

outerProps.draggable = TOP_LEVEL_DRAGGABLE;
innerProps.draggable = 'li.prompt-draggable';
```

重点是外层 selector 前面的 `>`：

- 没有 `>` 时，外层可能把分组内条目也当作自己的候选拖拽项，索引会混乱。
- 有 `>` 时，组内条目只有拖到组外时，外层才把它当成顶级落点候选。
- 分组容器本身仍然是外层可拖项，所以拖拽分组和拖拽条目不会互相抢同一个索引空间。

### 不要用假的 draggable 节点扩大分组命中区

为了让组外条目更容易拖入分组，直觉上可能会在分组列表底部加一个透明的假 `li`，例如：

```html
<li class="prompt-draggable drop-pad"></li>
```

这不推荐。VueDraggableNext 会把 DOM 子节点和 `list` 数据按位置对应，假 `li` 如果没有对应的数据项，就会让 DOM index 和 Vue list index 不一致。表现可能包括：

- 拖入分组后插入位置不稳定。
- 组内条目拖出分组时，原分组更容易“吸住”拖拽。
- 拖拽结束时 VueDraggable 需要修正 DOM，放下瞬间出现卡顿。
- 分组内非空时也出现一块可见空白区，视觉上很突兀。

更稳的做法是：

- 空分组可以用可见的最小高度，方便用户知道这里可以投放。
- 非空分组不要增加可见空白。
- 用 JS 命中函数把分组真实 body/list 的矩形向外扩展一点，作为“隐形判定区”。

伪代码：

```js
function getExpandedGroupDropTargetAtPoint(point) {
    const margin = 40;

    for (const group of document.querySelectorAll('.group:not(.collapsed)')) {
        const surface = group.querySelector('.group-list, .group-body');
        const rect = surface.getBoundingClientRect();

        if (
            point.x >= rect.left - margin &&
            point.x <= rect.right + margin &&
            point.y >= rect.top - margin / 2 &&
            point.y <= rect.bottom + margin
        ) {
            return group;
        }
    }

    return null;
}
```

也就是说，命中区可以变大，但布局不要变大。

### 拖入分组需要手动落点兜底

从组外条目拖入分组时，外层列表正在处理拖拽，内层列表未必能及时接管。尤其当用户把条目拖到分组 body 附近但没有压到具体条目之间时，Sortable 可能不会产生稳定的 inner-list add 事件。

推荐做法：

1. 外层 `move` 判断里根据当前指针更新手动落点，然后返回 `false`，不让 Sortable 自己改顺序。
2. 手动落点优先检查展开分组的 body/list 命中区，包括向外扩展的隐形判定区。
3. 命中分组时记录 `targetType: 'group'`、`groupId` 和组内插入 index，同时高亮目标分组并移动插入线。
4. `onEnd` 时按落点从模型中移除该条目，再插入 `group.children[index]`。
5. 手动移动后仍然走统一的快照对比和 pending 保存逻辑。

这样做的含义是：拖拽过程中的视觉反馈由高亮分组和固定插入线承担，最终数据只在 `onEnd` 按当前落点改一次模型。

### 拖出分组也需要镜像手动落点

从分组内拖到组外时，源拖拽发生在内层 VueDraggable，但目标是外层列表。这个方向和“组外拖入分组”不是同一条路径，不能只修一个方向。

需要做两件事：

- 外层列表允许被拖出来的 prompt 成为顶级落点候选。
- 如果指针没有命中分组投放区，就按释放点坐标计算顶级插入位置，手动从原分组移除并插入到 `model.items`。

判断时要注意：

- 如果释放点仍然命中分组 drop surface，分组落点优先，不要把它当成拖出。
- 插入位置不能小于列表头和分隔线之后的位置。
- 顶级 prompt 的 `groupId` 应该清空，组内 prompt 的 `groupId` 应该对齐到所在分组。

拖出时“附近条目腾位置”的反馈不要靠 Sortable DOM placeholder，而是靠顶级列表里的固定插入线表示。因为当前实现禁止 Sortable 默认排序，列表项本身不会在拖拽过程中真实移动；这样可以避免 VueDraggable、原生 sortable 和手动 fallback 同时改 DOM。

### 拖拽流畅性的关键

拖拽卡顿通常不是移动过程本身，而是放下瞬间做了太多同步工作。

放下时应该避免：

- 立刻保存预设文件。
- 立刻刷新 token 统计。
- 立刻重建整份 Vue 列表。
- 立刻读取大量布局信息。
- 同时让 ST 原生 sortable、VueDraggable 默认排序、插件手动落点都修改 DOM。

推荐顺序是：

1. `onStart`：只进入 dragging 状态、关闭操作菜单、记录拖拽前快照。
2. `move`：只做轻量命中判断和高亮，不写设置、不刷新 token。
3. `onEnd`：先清理 dragging/ready/highlight 状态，再做必要的模型移动。
4. 对比拖拽前后快照，如果顺序或分组变了，只标记 pending。
5. 不在放下瞬间保存；等预设界面关闭、页面隐藏或用户明确需要导出时再 flush。
6. 保存成功后不要立刻重建 Vue 列表；当前 Vue 模型已经是最新状态。只有保存失败或外部状态变化时再同步重建。

这能避免“松手后卡一下”的主要来源：保存、重建、token 刷新和布局回流撞在同一帧。

当前保存和刷新时机要分开看：

- 拖拽放下只设置 `pendingOrderSave`，并安装 pending lifecycle guard。
- 预设面板关闭或隐藏时，通过可见性检查 flush pending。
- `pagehide`、`visibilitychange: hidden`、`beforeunload` 会尝试 flush，避免离开页面丢更改。
- 切换预设前会先 flush pending，再重置当前预设的分组运行态。
- 用户保存/更新预设时也会先 flush pending，再触发 OpenAI 预设更新。
- 用户导出预设时如果有 pending，会先弹确认框，确认后 flush 再导出。

token 刷新也不能在拖拽中直接执行。当前实现里如果 `refreshPromptManagerTokens()` 发现正在 Vue 拖拽或 custom drag，会先设置 `promptManagerTokenRefreshPendingAfterDrag` 并返回；等拖拽结束、`model.dragging` 变回 false 后，再执行 debounced token 刷新。

这样拖拽放下那一帧只承担状态清理和模型移动，不同时承担保存、token 计算和整表渲染。

### 导出预设时要处理未保存拖拽

OpenAI 预设导出读取的是当前预设对象，而不是 Vue 列表里的临时模型。如果拖拽后只标记 pending，没有在导出前 flush，那么导出的仍可能是旧顺序或旧分组。

因此导出按钮应该在捕获阶段检查 pending 变更：

1. 没有 pending：放行原生导出。
2. 有 pending：阻止原生导出，提示用户“当前预设有未保存的更改，是否保存后再导出”。
3. 用户确认：先 flush pending，再重新触发导出按钮。
4. 用户取消：不导出，避免导出旧数据。

这个逻辑只应该拦截导出按钮，不应该改变普通关闭预设界面时的保存流程。

### 动画时间

展开和收缩可以使用不同时间。

一般建议：

- 展开稍短，例如 `180ms`。
- 收缩稍长，例如 `260ms`。

原因是展开时用户是在主动打开内容，反馈应该快；收缩时内容消失，如果太快会显得突兀。

但不要差距过大，否则会让用户感觉展开/收缩不是同一种动画。

### 点击标题行时动画不流畅的原因

如果点击展开按钮很流畅，但点击标题行其他位置不流畅，通常不是 grid 动画本身的问题，而是事件路径不同。

常见原因：

- 展开按钮的 click 直接 `stopPropagation()` 后执行 toggle。
- 标题行其他位置先被 Sortable 的 pointerdown / delay 处理。
- 浏览器合成 click 的时间较晚。
- 拖拽库 chosen 状态或 delay 状态影响了 class 切换时机。

解决方式不是换动画方案，而是让标题行点击也走 pointerup 手势判断：

- `pointerdown` 记录坐标。
- `pointerup` 判断移动距离。
- 判断通过后立即 toggle。
- 普通 click 只作为 fallback。

这样标题行点击和按钮点击触发 toggle 的时机更接近，动画手感也会一致。

## CSS 要点

分组标题行：

```css
.group-header {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
}

@media (pointer: coarse) {
    .group-drag-surface {
        touch-action: pan-y !important;
    }
}
```

ready 和实际拖拽反馈可以共用视觉样式：

```css
.drag-ready-feedback,
body.dragging .sortable-chosen {
    outline: 2px solid color-mix(in srgb, var(--SmartThemeQuoteColor) 75%, transparent);
    outline-offset: -2px;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--SmartThemeQuoteColor) 35%, transparent);
}

.drag-ready-feedback.group .group-header,
body.dragging .sortable-chosen.group .group-header {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 18%, transparent);
}

@media (pointer: coarse) {
    .drag-ready-feedback,
    body.dragging .sortable-chosen {
        transform: scale(0.995);
        transition: transform 120ms ease, outline-color 120ms ease, box-shadow 120ms ease;
    }
}
```

注意：

- 不要只给 `.sortable-chosen` 加 ready 提示。
- ready class 应该由自己的长按定时器控制。
- actual dragging class 可以继续依赖 Sortable `onStart`。

## 震动反馈

震动只作为增强，不应该影响主流程。

推荐：

```js
function vibrateDragFeedback() {
    if (!isMobile()) return;
    if (typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate !== 'function') return;

    try {
        navigator.vibrate(12);
    } catch {
        // 部分 WebView 会暴露 vibrate 但拒绝执行，忽略即可。
    }
}
```

触发时机：

- ready feedback 出现时触发一次。
- 如果没有 ready feedback，但已经进入真实拖拽，可以在 `onStart` 兜底触发一次。
- 如果 ready 时已经震动过，`onStart` 不要重复震动。

## 状态字段建议

一个 manager 里建议维护这些字段：

```js
{
    dragging: false,
    groupHeaderGesture: null,
    groupHeaderCustomDrag: null,
    lastGroupHeaderToggleAt: 0,
    lastGroupHeaderGestureCanceledAt: 0,
    lastDragStartedAt: 0,
    lastDragEndedAt: 0,
    dragReadyFeedbackTimer: null,
    dragReadyFeedbackElement: null,
    dragReadyFeedbackNotified: false,
}
```

其中：

- `groupHeaderGesture` 保存当前 pointer 手势。
- `groupHeaderCustomDrag` 保存已经进入自定义分组拖拽的标题手势。
- `lastGroupHeaderToggleAt` 防止 click fallback 重复展开。
- `lastGroupHeaderGestureCanceledAt` 防止滑动后松手误触发 click。
- `lastDragEndedAt` 防止拖拽释放后误触发 click。
- `dragReadyFeedbackTimer` 控制长按 ready。
- `dragReadyFeedbackElement` 记录当前应该加描边的元素。
- `dragReadyFeedbackNotified` 防止 ready 和 onStart 重复震动。

## 必须清理的时机

这些状态不清理会导致残留描边、误触发展开、下一次拖拽异常。

必须清理 ready feedback 的时机：

- pointerup。
- pointercancel。
- 长按前判定为滚动。
- Sortable onEnd。
- Vue 列表卸载。
- 拖拽异常结束并调用 `setDragging(false)`。

必须清理 gesture 的时机：

- pointerup。
- pointercancel。
- Sortable onStart。
- Vue 列表卸载。

必须清理自定义分组拖拽结束监听的时机：

- 自定义分组拖拽 pointerup / touchend。
- 自定义分组拖拽 pointercancel / touchcancel。
- Vue 列表卸载。

必须记录 suppress 时间的时机：

- 滑动判定成立时。
- pointerup 发现移动距离超过点击阈值时。
- pointercancel 时。
- Sortable onEnd 时。

## 推荐事件状态机

```text
Idle
  |
  | pointerdown on group header
  v
Pressed
  | start ready timer
  |
  | move before delay > threshold
  v
Scrolling
  | native browser scroll
  | clear ready timer
  | pointerup/cancel
  v
Idle

Pressed
  |
  | delay reached
  v
ReadyToDrag
  | show outline/background/scale
  | vibrate once
  |
  | move
  v
Dragging
  | custom group drag or Sortable onStart
  |
  | custom pointerup/touchend or Sortable onEnd
  v
Idle

Pressed
  |
  | pointerup with tiny movement
  v
ToggleCollapsed
  |
  v
Idle
```

## 常见错误与对应现象

### 错误：手机端标题使用 pan-y 但仍交给 Sortable 启动拖拽

现象：

- 页面滑动正常。
- 但分组拖不动，尤其纵向拖拽完全不稳定。

原因：

- 浏览器把纵向手势交给原生滚动后，Sortable 拿不到完整移动事件。
- 标题行如果要保留 `pan-y`，长按分组拖拽就必须由插件自定义启动，而不是继续依赖 Sortable 从标题行开始。

### 错误：手机端标题使用 touch-action: none 追求拖拽稳定

现象：

- 分组可以拖。
- 但从分组标题行开始的滑动没有浏览器原生惯性，甩动会很生硬。

原因：

- 浏览器默认滚动被禁止了，即使用 JS 补偿滚动，也很难还原系统原生滚动手感。

### 错误：用 click 直接展开/收缩

现象：

- 点击动画发卡。
- 拖拽释放后误展开/收缩。
- 滑动释放后误展开/收缩。

原因：

- click 是合成事件，时机太晚，且不区分之前发生的是点击、滑动还是拖拽。

### 错误：用 chosenClass 显示「可以拖」提示

现象：

- 描边出现了，但还不能立刻拖。

原因：

- chosenClass 出现早于真正 ready 或真正 onStart。

### 错误：PC 端也设置拖拽 delay

现象：

- PC 点击分组标题展开/收缩感觉卡。

原因：

- 鼠标点击也进入了拖拽准备流程。

### 错误：拖拽结束不屏蔽 click fallback

现象：

- 拖完分组后，分组突然展开或收缩。

原因：

- 浏览器在释放后合成了 click。

### 错误：用 JS 计算 height 做分组展开/收缩动画

现象：

- 展开/收缩过程中条目按钮、开关、拖拽把手闪烁。
- 分组内部条目较多时动画卡顿。
- 拖拽后再展开/收缩，动画高度不准。
- 某些主题下收缩不彻底，内部内容还露出一点。

原因：

- JS 读取 `scrollHeight` 会强制布局。
- VueDraggable 会动态插入 ghost、chosen、fallback 元素，导致计算出的高度不稳定。
- Vue 重新渲染、token 刷新、主题样式变化都会让之前计算的高度过期。
- 内联 `height` 需要在 `transitionend` 后清理，动画中断时容易留下脏状态。

推荐：

- 使用 CSS grid 的 `grid-template-rows: 1fr -> 0fr`。
- 动画外壳只负责高度动画。
- 内部再放一个 `min-height: 0; overflow: hidden` 的裁剪容器。
- VueDraggable 挂在最里面的真实 `ul` 上。

## 当前实现对照

| 行为 | 当前实现做法 | 文档对应 |
| --- | --- | --- |
| 分组标题整行点击展开/收缩 | `pointerdown` / `pointerup` 自己判断点击，普通 `click` 只兜底 | 分组标题行事件模型 |
| 分组标题按钮点击 | 分组按钮 `stopPropagation`，并被 interactive selector 排除出拖拽 | 点击、按钮菜单和拖拽 filter |
| 手机端从标题行滑动 | 标题行 `touch-action: pan-y`，移动超过阈值后取消长按准备并交给浏览器原生滚动 | 标题长按自定义分组拖拽 |
| 手机端标题行长按拖分组 | 320ms 后进入自定义分组拖拽，复用 manual drag 落点、插入线和保存逻辑 | 标题长按自定义分组拖拽 |
| 手机端条目把手拖拽 | 捕获阶段把当前 Sortable delay 改成 0 | 手机端把手和整行拖拽策略 |
| 手机端条目整行拖拽 | 默认关闭；开启后非按钮区域仍走长按 delay | 手机端 handle selector |
| 条目按钮/菜单点击 | 文档级捕获 click 委托，按钮区域用 `filter` 排除拖拽 | 点击、按钮菜单和拖拽 filter |
| 范围选择创建分组 | 范围模式接管条目 click / hover，禁用按钮点击和拖拽 | 范围选择创建分组时要接管点击 |
| 顶级/组内拖拽 | 外层和内层 VueDraggable 分离，外层 selector 使用直接子项 | 外层和内层的 draggable 要分开 |
| 组外拖入分组 | 手动落点优先命中展开分组，`onEnd` 移动到 `group.children[index]` | 拖入分组需要手动落点兜底 |
| 组内拖出组外 | 手动落点计算顶级 index，`onEnd` 移动到 `model.items[index]` 并清空 `groupId` | 拖出分组也需要镜像手动落点 |
| 拖拽时附近位置反馈 | 不移动真实条目，使用固定插入线显示目标位置 | 手动落点、插入线和模型移动 |
| 拖拽到列表边缘 | 手动 auto-scroll，滚动后清布局缓存并重新算落点 | 实际拖拽中的滚动保护和边缘自动滚动 |
| 拖拽放下卡顿控制 | 放下只清状态、移动模型、标记 pending，不立即保存/token 刷新/整表重建 | 拖拽流畅性的关键 |
| 未保存时导出 | 拦截导出 click，提示保存后再导出 | 导出预设时要处理未保存拖拽 |

## 复刻 checklist

实现同类交互时按这个顺序做：

1. 分清 PC 和手机端拖拽参数。
2. PC 不设置 delay，只设置小移动阈值。
3. 手机设置 delay、touch threshold、fallback tolerance。
4. 分组标题行使用 pointerdown / pointermoveCapture / pointerup / pointercancel。
5. 不把展开/收缩主逻辑绑在普通 click 上。
6. 手机分组标题面使用 `touch-action: pan-y`，普通滑动交给浏览器原生滚动。
7. 手机端不要把 `.bai-bai-preset-group-drag-surface` 作为 Sortable handle。
8. 长按时间到达时进入自定义分组拖拽并显示 ready feedback。
9. ready feedback 不依赖 Sortable chosenClass。
10. 自定义分组拖拽或 Sortable onStart 设置真实 dragging 状态。
11. 自定义分组拖拽结束或 Sortable onEnd 清理 dragging 和 ready 状态。
12. 滑动、取消、拖拽结束后短时间屏蔽 click fallback。
13. 启用 Vue 分组列表时，先禁用 ST 原生 jQuery sortable。
14. 外层 VueDraggable 只匹配直接子项，内层 VueDraggable 只管理分组内部条目。
15. 手机端条目把手允许 delay 0；条目整行使用长按 delay；分组标题行由自定义长按拖拽接管。
16. 动态修改 Sortable delay 必须在 `pointerdown` / `touchstart` 捕获阶段完成。
17. 手机端默认只允许条目把手拖拽；开启整条拖拽后，非按钮区域长按拖拽。
18. 按钮、菜单、输入框、分组操作按钮必须通过 `filter` 排除出拖拽。
19. 范围选择模式下，条目点击只做起止选择，并禁止拖拽和按钮点击。
20. 不用假的 draggable DOM 节点扩大投放区；非空分组的投放扩大用 JS 矩形命中完成。
21. VueDraggable 的 `move` 只更新手动落点并返回 `false`，不要让 Sortable 默认占位改 DOM。
22. 手动落点用 `requestAnimationFrame` 批量计算，插入线挂到 `document.body`，不要插进列表 DOM。
23. 组外拖入分组和组内拖出分组都要按坐标落点在 `onEnd` 手动移动模型。
24. 拖拽边缘自动滚动后要清掉布局缓存并重新计算落点。
25. 拖拽放下后只更新 Vue 模型并标记 pending，不立刻保存或重建整份列表。
26. 拖拽期间触发 token 刷新时只标记 pending，拖拽结束后再刷新。
27. 导出预设前如果存在 pending 变更，先提示用户保存后再导出。
28. 所有 timer、class、gesture、drop target、manual placement 和 pending 状态都要在卸载时清理。

## 当前代码中的对应实现

当前仓库里的实现主要位于：

- `presetOptimizations.js`

关键函数：

- `patchPromptManagerDraggable`
- `disablePromptManagerStockSortable`
- `renderPresetVuePromptDraggable`
- `renderPresetVuePromptGroup`
- `renderPresetVuePromptRow`
- `applyPresetVueDragGestureOptions`
- `beginPresetVuePromptGroupHeaderGesture`
- `movePresetVuePromptGroupHeaderGesture`
- `finishPresetVuePromptGroupHeaderGesture`
- `cancelPresetVuePromptGroupHeaderGesture`
- `handlePresetVuePromptGroupHeaderClickFallback`
- `beginPresetVuePromptGroupHeaderCustomDrag`
- `finishPresetVuePromptGroupHeaderCustomDrag`
- `cancelPresetVuePromptGroupHeaderCustomDrag`
- `beginPresetVuePromptManualDragWithItem`
- `showPresetVuePromptDragReadyFeedback`
- `clearPresetVuePromptDragReadyFeedback`
- `notifyPresetVuePromptDragStarted`
- `setPresetVuePromptDragging`
- `setPresetVuePromptDragScrollGuardEnabled`
- `installPresetVueDynamicDragDelayHandlers`
- `configurePresetVueSortableDragDelayForEvent`
- `getPresetVuePromptDragHandleSelector`
- `isPresetVuePromptTopLevelDragMoveAllowed`
- `isPresetVuePromptGroupDragMoveAllowed`
- `beginPresetVuePromptManualDrag`
- `finishPresetVuePromptManualDrag`
- `updatePresetVuePromptManualDragPlacementFromEvent`
- `updatePresetVuePromptManualDragPlacement`
- `createPresetVuePromptManualDragLayoutCache`
- `getPresetVuePromptManualDragPlacementAtPoint`
- `getPresetVuePromptManualGroupDropPlacementAtPoint`
- `getPresetVuePromptManualTopLevelDropPlacementAtPoint`
- `updatePresetVuePromptManualDragIndicator`
- `schedulePresetVuePromptManualDragAutoScroll`
- `autoScrollPresetVuePromptManualDragContainer`
- `applyPresetVuePromptManualDrop`
- `movePresetVuePromptToGroupIndex`
- `movePresetVuePromptToTopLevelIndex`
- `movePresetVuePromptGroupToTopLevelIndex`
- `getPresetVuePromptGroupDropTargetAtPoint`
- `getPresetVuePromptExpandedGroupDropTargetAtPoint`
- `sanitizePresetVuePromptListModel`
- `capturePresetVuePromptDragSnapshot`
- `consumePresetVuePromptDragChange`
- `schedulePresetVuePromptOrderSaveAfterDrop`
- `flushScheduledPresetVuePromptOrderSave`
- `flushPendingPresetPromptChanges`
- `installPresetExportPendingChangesGuard`
- `handlePresetListActionClick`
- `togglePresetPromptActionMenu`
- `closePresetPromptActionMenus`
- `startPresetVuePromptGroupRangeSelection`
- `handlePresetVuePromptRangeSelectionClick`
- `handlePresetVuePromptRangeSelectionDelegatedClick`
- `updatePresetVuePromptRangeSelectionHover`
- `finishPresetVuePromptGroupRangeSelection`
- `refreshPromptManagerTokens`

关键 CSS 类：

- `bai-bai-preset-group-drag-surface`
- `bai-bai-preset-vue-drag-ready-feedback`
- `bai-bai-preset-vue-dragging`
- `bai-bai-preset-drop-target`
- `bai-bai-preset-vue-sortable-chosen`
- `bai-bai-preset-vue-sortable-fallback`
- `bai-bai-toolkit-preset-drag-indicator`
- `bai-bai-preset-range-selectable`
- `bai-bai-preset-range-start`
- `bai-bai-preset-range-end`
- `bai-bai-preset-range-inside`

如果以后要迁移到其他列表或其他插件，建议优先复制这套状态机，而不是只复制 CSS 或 Sortable 参数。
