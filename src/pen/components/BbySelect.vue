<script setup lang="ts">
import Icon from '@pen/components/Icon.vue';
import { modalHost } from '@pen/state/ui';
import { computed, onBeforeUnmount, ref } from 'vue';

/**
 * 自绘下拉选择（替代原生 <select>）：触发器与弹出菜单都跟随 --bby-* 主题，
 * 选项可带图标。原生 select 的弹出层由系统渲染，主题变量管不到，故自绘。
 * （与柏宝绘 BbiSelect.vue 同源，类名换 bby- 前缀。）
 *
 * 菜单为什么 Teleport 到 modalHost 而不是就地绝对定位：
 * 设置项都在 Collapsible（overflow:hidden）与滚动容器里，就地定位会被裁剪。
 * modalHost 是 .bby-root 直接子级，菜单用视口级 fixed 定位，
 * 由触发器的 getBoundingClientRect 推算，下方空间不足时向上翻。
 *
 * 交互：点外部 / Esc / 滚动 / 缩放关闭；↑↓ 移动高亮，Enter/Space 选中，Home/End 跳首尾。
 */
const props = defineProps<{
  modelValue: string;
  options: { value: string; label: string; icon?: string }[];
  /** 无障碍名称（行标题是纯文本 span，与控件无 label 关联，靠它补上） */
  ariaLabel?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});
/** 键盘/悬停高亮项索引 */
const activeIndex = ref(0);

const current = computed(() => props.options.find(o => o.value === props.modelValue) ?? null);

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

function openMenu() {
  const el = trigger.value;
  if (!el || open.value) return;
  const rect = el.getBoundingClientRect();
  // 估算菜单高度决定朝向：下方不够且上方更宽裕就向上翻
  const estimated = Math.min(MENU_MAX_HEIGHT, props.options.length * 34 + 10);
  const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const upward = below < estimated && rect.top - VIEWPORT_MARGIN > below;
  const space = upward ? rect.top - MENU_GAP - VIEWPORT_MARGIN : below;
  menuStyle.value = {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(96, Math.min(MENU_MAX_HEIGHT, space))}px`,
    ...(upward
      ? { top: 'auto', bottom: `${window.innerHeight - rect.top + MENU_GAP}px` }
      : { top: `${rect.bottom + MENU_GAP}px`, bottom: 'auto' }),
  };
  activeIndex.value = Math.max(
    0,
    props.options.findIndex(o => o.value === props.modelValue),
  );
  open.value = true;
  document.addEventListener('mousedown', onDocMousedown, true);
  document.addEventListener('keydown', onDocKeydown, true);
  // 菜单是视口级 fixed，不随内容滚动；滚动/缩放时直接关掉，比重算位置干净。
  document.addEventListener('scroll', closeOnViewportChange, true);
  window.addEventListener('resize', closeOnViewportChange);
}

function closeMenu(restoreFocus = false) {
  if (!open.value) return;
  open.value = false;
  document.removeEventListener('mousedown', onDocMousedown, true);
  document.removeEventListener('keydown', onDocKeydown, true);
  document.removeEventListener('scroll', closeOnViewportChange, true);
  window.removeEventListener('resize', closeOnViewportChange);
  if (restoreFocus) trigger.value?.focus();
}

function closeOnViewportChange() {
  closeMenu();
}

function toggle() {
  if (open.value) closeMenu(true);
  else openMenu();
}

function pick(option: { value: string }) {
  emit('update:modelValue', option.value);
  closeMenu(true);
}

function onDocMousedown(event: MouseEvent) {
  // composedPath 穿透 shadow root；点到触发器或菜单内部都不算外部
  const path = event.composedPath();
  if (trigger.value && path.includes(trigger.value)) return;
  if (menu.value && path.includes(menu.value)) return;
  closeMenu();
}

function scrollActiveIntoView() {
  menu.value
    ?.querySelectorAll('.bby-select-option')
    [activeIndex.value]?.scrollIntoView({ block: 'nearest' });
}

function onDocKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  const count = props.options.length;
  if (event.key === 'Escape') {
    // 捕获阶段拦截，只关菜单，别触发窗口级 Esc（关整个面板）
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    activeIndex.value = (activeIndex.value + delta + count) % count;
    scrollActiveIntoView();
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    activeIndex.value = event.key === 'Home' ? 0 : count - 1;
    scrollActiveIntoView();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const option = props.options[activeIndex.value];
    if (option) pick(option);
  }
}

/** 原生 select 习惯：收起态按 ↑/↓ 直接展开 */
function onTriggerKeydown(event: KeyboardEvent) {
  if (open.value) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    openMenu();
  }
}

onBeforeUnmount(() => closeMenu());
</script>

<template>
  <!-- 根类名不能叫 bby-select：base.css 里那个类是给美化原生 <select> 用的，
       带背景图三角 + padding-right，撞上会在触发器右边多画一个三角 -->
  <div class="bby-select-box">
    <button
      ref="trigger"
      class="bby-select-trigger"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="bby-select-current">
        <Icon v-if="current?.icon" :name="current.icon" :size="14" />
        <span class="bby-select-label">{{ current?.label ?? modelValue }}</span>
      </span>
      <Icon name="chevron" class="bby-select-caret" :class="{ 'is-open': open }" :size="12" />
    </button>

    <Teleport :to="modalHost" :disabled="!modalHost">
      <ul v-if="open" ref="menu" class="bby-select-menu" role="listbox" :style="menuStyle">
        <li
          v-for="(option, i) in options"
          :key="option.value"
          class="bby-select-option"
          :class="{ 'is-active': i === activeIndex, 'is-selected': option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue"
          @mouseenter="activeIndex = i"
          @click="pick(option)"
        >
          <Icon v-if="option.icon" :name="option.icon" :size="14" />
          <span class="bby-select-option-label">{{ option.label }}</span>
          <Icon
            v-if="option.value === modelValue"
            name="check"
            class="bby-select-check"
            :size="13"
          />
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.bby-select-box {
  width: 100%;
  min-width: 0;
}
.bby-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--bby-line-strong);
  border-radius: var(--bby-radius-sm);
  background: var(--bby-surface);
  color: var(--bby-ink);
  font-family: var(--bby-font-sans);
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    border-color var(--bby-duration) var(--bby-ease),
    background var(--bby-duration) var(--bby-ease);
}
.bby-select-trigger:hover {
  background: var(--bby-surface-2);
}
.bby-select-trigger:focus-visible {
  outline: 2px solid var(--bby-accent);
  outline-offset: 1px;
}
.bby-select-current {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bby-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bby-select-caret {
  flex: none;
  color: var(--bby-ink-soft);
  transition: transform var(--bby-duration) var(--bby-ease);
}
.bby-select-caret.is-open {
  transform: rotate(180deg);
}

/* 菜单 Teleport 到 modalHost（scoped 样式在同 shadow root 内照常生效） */
.bby-select-menu {
  position: fixed;
  /* 10003：高于普通弹窗遮罩（10001）与叠加层遮罩（10002）。
     本组件也用在弹窗内部（渠道弹窗的「思考强度」），菜单与遮罩会同时存在；
     同级时靠「后插入者胜出」能侥幸盖住，但 -top 那类遮罩（10002）会反压菜单，
     故显式抬高，不依赖插入顺序。 */
  z-index: 10003;
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
  background: var(--bby-surface);
  border: 1px solid var(--bby-line);
  border-radius: var(--bby-radius);
  box-shadow: var(--bby-shadow);
}
.bby-select-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--bby-radius-sm);
  font-size: 13px;
  color: var(--bby-ink);
  cursor: pointer;
}
.bby-select-option.is-active {
  background: var(--bby-surface-2);
}
.bby-select-option.is-selected {
  color: var(--bby-accent);
  font-weight: 600;
}
.bby-select-option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bby-select-check {
  flex: none;
  color: var(--bby-accent);
}
</style>
