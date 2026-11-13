<script setup lang="ts">
import { penSettings } from '@pen/api/settings';
import Icon from '@pen/components/Icon.vue';
import { openPenFromMenu } from '@pen/menu';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

/**
 * 悬浮球,移植自柏宝书/柏宝绘(外观与手感保持一致):
 * 自由拖动,拖近左/右边缘才吸附贴边并半隐;hover/聚焦/拖动时整条滑出。点击等同魔法棒入口。
 *
 * 位置存本机 localStorage(各设备屏幕尺寸不同,同步反而会跑到屏幕外);
 * 开关与外观存 baibai_pen,跨设备同步。
 */

// 书签按 0.78 宽高比(竖长方),圆/方等边
const orbW = computed(() =>
  penSettings.orbShape === 'bookmark' ? Math.round(penSettings.orbSize * 0.78) : penSettings.orbSize,
);
const orbH = computed(() => penSettings.orbSize);
const SNAP_ZONE = 56; // 松手时距左/右边缘 ≤ 此值即吸附贴边
const CLICK_SLOP = 6; // 位移 < 此值视为点击而非拖动
const POS_KEY = 'bby.orb.pos.v1';

type Dock = 'left' | 'right' | 'none';
interface OrbPos {
  dock: Dock;
  /** 贴边时无意义;free 时为左上角 x(px) */
  x: number;
  /** 左上角 y(px) */
  y: number;
}

function loadPos(): OrbPos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<OrbPos>;
      if (p && (p.dock === 'left' || p.dock === 'right' || p.dock === 'none')) {
        return { dock: p.dock, x: Number(p.x) || 0, y: Number(p.y) || 0 };
      }
    }
  } catch {
    /* ignore */
  }
  // 默认右侧贴边;柏宝书/柏宝绘默认在 0.6,错开一点免得三个叠在一起
  return { dock: 'right', x: 0, y: Math.round(window.innerHeight * 0.45) };
}

const pos = reactive<OrbPos>(loadPos());
const dragging = ref(false);
const awake = ref(false);
let activePointer: number | null = null;
let startX = 0;
let startY = 0;
let moved = 0;
let grabDX = 0;
let grabDY = 0;

function clampToViewport(): void {
  const maxY = Math.max(0, window.innerHeight - orbH.value);
  pos.y = Math.min(Math.max(0, pos.y), maxY);
  if (pos.dock === 'none') {
    const maxX = Math.max(0, window.innerWidth - orbW.value);
    pos.x = Math.min(Math.max(0, pos.x), maxX);
  }
}

function savePos(): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

const orbStyle = computed(() => {
  const base: Record<string, string> = {
    top: `${pos.y}px`,
    width: `${orbW.value}px`,
    height: `${orbH.value}px`,
    '--orb-rest-opacity': String(penSettings.orbOpacity / 100),
    '--orb-icon-size': `${Math.round(penSettings.orbSize * 0.46)}px`,
  };
  const shown = dragging.value || awake.value;
  if (pos.dock === 'left') {
    base.left = '0px';
    base.transform = shown ? 'translateX(0)' : 'translateX(-58%)';
  } else if (pos.dock === 'right') {
    base.right = '0px';
    base.transform = shown ? 'translateX(0)' : 'translateX(58%)';
  } else {
    base.left = `${pos.x}px`;
    base.transform = 'translateX(0)';
  }
  return base;
});

const orbImage = computed(() => penSettings.orbImage.trim());

/** 当前左上角的实际 x(贴边态折算成绝对像素,供拖动起步用) */
function currentLeft(): number {
  if (pos.dock === 'right') return window.innerWidth - orbW.value;
  if (pos.dock === 'left') return 0;
  return pos.x;
}

function onDown(e: PointerEvent) {
  activePointer = e.pointerId;
  dragging.value = true;
  moved = 0;
  startX = e.clientX;
  startY = e.clientY;
  grabDX = e.clientX - currentLeft();
  grabDY = e.clientY - pos.y;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== activePointer) return;
  moved = Math.max(moved, Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY));
  if (moved < CLICK_SLOP) return;
  pos.dock = 'none';
  pos.x = e.clientX - grabDX;
  pos.y = e.clientY - grabDY;
  clampToViewport();
}

function onUp(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== activePointer) return;
  dragging.value = false;
  activePointer = null;

  if (moved < CLICK_SLOP) {
    if (e.type === 'pointerup') openPenFromMenu();
    return;
  }

  const left = pos.x;
  const right = window.innerWidth - (pos.x + orbW.value);
  if (left <= SNAP_ZONE) pos.dock = 'left';
  else if (right <= SNAP_ZONE) pos.dock = 'right';
  else pos.dock = 'none';
  clampToViewport();
  savePos();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openPenFromMenu();
  }
}

const onResize = () => {
  clampToViewport();
  savePos();
};
onMounted(() => {
  clampToViewport();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => window.removeEventListener('resize', onResize));
</script>

<template>
  <div
    class="bby-orb"
    :class="[`shape-${penSettings.orbShape}`, { 'is-dragging': dragging }]"
    :style="orbStyle"
    role="button"
    tabindex="0"
    aria-label="打开楼层管理器"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerenter="awake = true"
    @pointerleave="awake = false"
    @focus="awake = true"
    @blur="awake = false"
    @keydown="onKey"
  >
    <img v-if="orbImage" :src="orbImage" class="bby-orb-img" alt="" draggable="false" />
    <Icon v-else name="pen" class="bby-orb-icon" />
  </div>
</template>

<style scoped>
.bby-orb {
  position: fixed;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bby-surface);
  color: var(--bby-accent);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* drop-shadow 跟随 clip-path(书签)和 border-radius(圆/方)的轮廓 */
  filter: drop-shadow(0 6px 14px oklch(0 0 0 / 0.28));
  opacity: var(--orb-rest-opacity, 0.62);
  transition:
    transform var(--bby-duration) var(--bby-ease),
    opacity var(--bby-duration) var(--bby-ease);
}

/* 书签:缎带轮廓 + 底部燕尾缺口,clip-path 顺带裁切自定义图 */
.bby-orb.shape-bookmark {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%);
}
.bby-orb.shape-circle {
  border-radius: 999px;
  overflow: hidden;
}
.bby-orb.shape-square {
  border-radius: 12px;
  overflow: hidden;
}

.bby-orb:hover,
.bby-orb:focus-visible,
.bby-orb.is-dragging {
  opacity: 1;
}
.bby-orb:focus-visible {
  outline: none;
}
.bby-orb:active {
  cursor: grabbing;
}

.bby-orb-icon {
  font-size: var(--orb-icon-size, 22px);
  pointer-events: none;
}
/* 书签:图标上移,避开底部燕尾缺口 */
.bby-orb.shape-bookmark .bby-orb-icon {
  margin-bottom: 6px;
}

.bby-orb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .bby-orb {
    transition: none;
  }
}
</style>
