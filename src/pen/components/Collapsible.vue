<script setup lang="ts">
import Icon from '@pen/components/Icon.vue';
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    open?: boolean;
  }>(),
  { open: false },
);

const expanded = ref(props.open);
const scheduledFrames = new WeakMap<HTMLElement, number>();

function scheduleHeight(panel: HTMLElement, height: number): void {
  const previousFrame = scheduledFrames.get(panel);
  if (previousFrame !== undefined) window.cancelAnimationFrame(previousFrame);
  const frame = window.requestAnimationFrame(() => {
    scheduledFrames.delete(panel);
    panel.style.height = `${height}px`;
  });
  scheduledFrames.set(panel, frame);
}

function clearScheduledFrame(panel: HTMLElement): void {
  const frame = scheduledFrames.get(panel);
  if (frame !== undefined) window.cancelAnimationFrame(frame);
  scheduledFrames.delete(panel);
}

function beforeEnter(element: Element): void {
  const panel = element as HTMLElement;
  if (!panel.style.height) panel.style.height = '0px';
}

function enter(element: Element): void {
  const panel = element as HTMLElement;
  void panel.offsetHeight;
  scheduleHeight(panel, panel.scrollHeight);
}

function afterEnter(element: Element): void {
  const panel = element as HTMLElement;
  clearScheduledFrame(panel);
  panel.style.height = '';
}

function beforeLeave(element: Element): void {
  const panel = element as HTMLElement;
  panel.style.height = `${panel.getBoundingClientRect().height}px`;
}

function leave(element: Element): void {
  const panel = element as HTMLElement;
  void panel.offsetHeight;
  scheduleHeight(panel, 0);
}

function afterLeave(element: Element): void {
  const panel = element as HTMLElement;
  clearScheduledFrame(panel);
  panel.style.height = '';
}
</script>

<template>
  <section class="bby-collapsible" :class="{ 'is-open': expanded }">
    <button class="bby-collapsible-head" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="bby-collapsible-title">{{ title }}</span>
      <slot name="badge" />
      <Icon name="chevron" class="bby-collapsible-chevron" />
    </button>
    <Transition
      name="bby-collapse"
      @before-enter="beforeEnter"
      @enter="enter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="leave"
      @after-leave="afterLeave"
    >
      <div v-show="expanded" class="bby-collapsible-outer">
        <div class="bby-collapsible-body">
          <slot />
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.bby-collapsible {
  overflow: hidden;
  border: 1px solid var(--bby-line);
  border-radius: var(--bby-radius);
  background: var(--bby-surface);
}

.bby-collapsible-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: var(--bby-ink);
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  transition: background var(--bby-duration) var(--bby-ease);
}

/* 标题占满剩余宽度,把徽标与箭头挤到最右 */
.bby-collapsible-title {
  flex: 1 1 auto;
  min-width: 0;
}

.bby-collapsible-head:hover {
  background: var(--bby-surface-2);
}

.bby-collapsible-chevron {
  color: var(--bby-ink-muted);
  font-size: 18px;
  transition: transform var(--bby-duration) var(--bby-ease);
}

.bby-collapsible.is-open > .bby-collapsible-head .bby-collapsible-chevron {
  transform: rotate(180deg);
}

.bby-collapse-enter-active,
.bby-collapse-leave-active {
  overflow: hidden;
  transition:
    height var(--bby-duration) var(--bby-ease),
    opacity 0.2s var(--bby-ease);
  will-change: height, opacity;
}

.bby-collapse-enter-active .bby-collapsible-body,
.bby-collapse-leave-active .bby-collapsible-body {
  transition:
    transform var(--bby-duration) var(--bby-ease),
    opacity 0.2s var(--bby-ease);
  will-change: transform, opacity;
}

.bby-collapse-enter-from,
.bby-collapse-leave-to,
.bby-collapse-enter-from .bby-collapsible-body,
.bby-collapse-leave-to .bby-collapsible-body {
  opacity: 0;
}

.bby-collapse-enter-from .bby-collapsible-body,
.bby-collapse-leave-to .bby-collapsible-body {
  transform: translateY(-6px);
}

.bby-collapsible-body {
  padding: 14px 16px;
  border-top: 1px solid var(--bby-line);
}

@media (prefers-reduced-motion: reduce) {
  .bby-collapse-enter-active,
  .bby-collapse-leave-active,
  .bby-collapse-enter-active .bby-collapsible-body,
  .bby-collapse-leave-active .bby-collapsible-body {
    transition-duration: 0.01ms;
  }
}

@media (max-width: 640px) {
  .bby-collapsible-head {
    font-size: 13px;
  }
}
</style>
