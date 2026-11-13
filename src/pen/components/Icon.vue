<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string; size?: number | string }>();

const paths: Record<string, string> = {
  pen: '<path d="M4.5 19.5h4L19 9 15 5 4.5 15.5z"/><path d="M13 7 17 11"/><path d="M4.5 19.5 8 16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  settings: '<path d="M5 8h9M18 8h1"/><path d="M5 16h1M10 16h9"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/>',
  workspace: '<path d="M4.5 19.5h4L19 9 15 5 4.5 15.5z"/><path d="M13 7 17 11"/><path d="M12.5 19.5h7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  sparkles: '<path d="M12 4c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z"/><path d="M18.5 14c.3 1.5.7 1.9 2.2 2.2-1.5.3-1.9.7-2.2 2.2-.3-1.5-.7-1.9-2.2-2.2 1.5-.3 1.9-.7 2.2-2.2z"/>',
  leaf: '<path d="M19.5 4.5C12 4.7 6 8.2 5 14.5c3.8 1.1 7.2.2 9.3-2.5"/><path d="M5 19.5c1.7-5 5.5-8.5 11-10.5"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0z M12 16v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M6 9.5 12 15.5 18 9.5"/>',
  chevronLeft: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  chevronsLeft: '<path d="M12 6 6 12l6 6"/><path d="M18 6l-6 6 6 6"/>',
  chevronsRight: '<path d="M6 6l6 6-6 6"/><path d="M12 6l6 6-6 6"/>',
  sortDesc: '<path d="M4 6h9M4 12h6M4 18h3"/><path d="M17 5v14M14 16l3 3 3-3"/>',
  sortAsc: '<path d="M4 6h3M4 12h6M4 18h9"/><path d="M17 19V5M14 8l3-3 3 3"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h8a6 6 0 0 1 6 6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16M20 20v-4h-4"/>',
  trash: '<path d="M5 7.5h14M10 7.5V6h4v1.5M7 7.5l.8 11h8.4l.8-11"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M6.3 8.1A15.9 15.9 0 0 0 2.5 12S6 18.5 12 18.5a8.5 8.5 0 0 0 3.2-.6"/><path d="M9.6 5.8A8.6 8.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.8 15.8 0 0 1-3.3 3.9"/>',
  bolt: '<path d="M13 4 5 13h6l-1 7 8-9h-6z"/>',
  replace: '<path d="M4 7h13"/><path d="m13 3 4 4-4 4"/><path d="M20 17H7"/><path d="m11 21-4-4 4-4"/>',
  ghost: '<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-1.8-2.3 1.8-2.2-1.8-2.3 1.8L5 21z"/><circle cx="9.5" cy="10.5" r="1"/><circle cx="14.5" cy="10.5" r="1"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="14" r="3.4"/>',
};

const markup = computed(() => paths[props.name] ?? '');
const dimension = computed(() =>
  props.size ? (typeof props.size === 'number' ? `${props.size}px` : props.size) : '1em',
);
</script>

<template>
  <svg
    class="bby-icon"
    :style="{ width: dimension, height: dimension }"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>

<style scoped>
.bby-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: -0.15em;
}
</style>
