<script setup lang="ts">
/**
 * 快捷语句选择器:收起态只列已选(可点 × 移除)+ 一颗「添加要求」入口;
 * 点入口弹出带搜索的全量列表挑选。面板高度只随「已选」增长,不随短语库规模膨胀。
 *
 * 两处复用:整体要求(v-model 一个共享数组)、段落标注(每段一个数组)。
 * 组件只管「怎么选」,选中结果如何发给 AI 仍由 App.vue 负责。
 */
import type { QuickPhrase } from '@pen/api/settings';
import Icon from '@pen/components/Icon.vue';
import ModalMask from '@pen/components/ModalMask.vue';
import { computed, nextTick, ref } from 'vue';

const props = defineProps<{
  /** 已选短语 id */
  modelValue: number[];
  /** 全量短语(已按 favorite 置顶排序) */
  phrases: QuickPhrase[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: number[]): void }>();

const pickerOpen = ref(false);
const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

// 按传入顺序保留已选(即 favorite 优先),而非按点选先后,列表观感稳定
const selectedPhrases = computed(() =>
  props.phrases.filter(phrase => props.modelValue.includes(phrase.id)),
);

const filteredPhrases = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.phrases;
  return props.phrases.filter(
    phrase =>
      phrase.name.toLowerCase().includes(q) ||
      phrase.instruction.toLowerCase().includes(q),
  );
});

function isSelected(id: number): boolean {
  return props.modelValue.includes(id);
}

function toggle(id: number): void {
  emit(
    'update:modelValue',
    isSelected(id) ? props.modelValue.filter(item => item !== id) : [...props.modelValue, id],
  );
}

function remove(id: number): void {
  emit('update:modelValue', props.modelValue.filter(item => item !== id));
}

async function openPicker(): Promise<void> {
  query.value = '';
  pickerOpen.value = true;
  await nextTick();
  searchInput.value?.focus();
}

function closePicker(): void {
  pickerOpen.value = false;
  query.value = '';
}
</script>

<template>
  <div class="bby-phrase-chosen">
    <button
      v-for="phrase in selectedPhrases"
      :key="phrase.id"
      type="button"
      class="bby-chip-picked"
      :title="`${phrase.instruction}（点击移除）`"
      @click="remove(phrase.id)"
    >
      <span>{{ phrase.name }}</span>
      <Icon name="close" class="bby-chip-x" />
    </button>
    <button type="button" class="bby-chip-add" @click="openPicker">
      <Icon name="plus" /> 添加要求
    </button>
  </div>

  <ModalMask :open="pickerOpen" @close="closePicker">
    <div class="bby-modal bby-phrase-sheet" role="dialog" aria-modal="true" aria-label="选择快捷语句">
      <header class="bby-modal-head">
        <span class="bby-modal-title">选择快捷语句</span>
        <button class="bby-icon-mini" type="button" title="关闭" @click="closePicker">
          <Icon name="close" />
        </button>
      </header>
      <div class="bby-phrase-search">
        <Icon name="search" />
        <input
          ref="searchInput"
          v-model="query"
          class="bby-input"
          type="text"
          placeholder="搜索名称或指令"
          @keydown.esc.stop="closePicker"
        />
      </div>
      <div class="bby-phrase-pick-list">
        <button
          v-for="phrase in filteredPhrases"
          :key="phrase.id"
          type="button"
          class="bby-phrase-pick"
          :class="{ 'is-selected': isSelected(phrase.id) }"
          @click="toggle(phrase.id)"
        >
          <span class="bby-phrase-favorite" :class="{ 'is-on': phrase.favorite }">★</span>
          <span class="bby-phrase-pick-body">
            <strong>{{ phrase.name }}</strong>
            <small>{{ phrase.instruction }}</small>
          </span>
          <Icon name="check" class="bby-phrase-pick-check" />
        </button>
        <p v-if="!filteredPhrases.length" class="bby-field-hint">没有匹配的短语。</p>
      </div>
      <footer class="bby-modal-foot">
        <span class="bby-phrase-pick-count">已选 {{ modelValue.length }} 条</span>
        <span class="bby-modal-foot-spacer"></span>
        <button class="bby-button bby-primary" type="button" @click="closePicker">完成</button>
      </footer>
    </div>
  </ModalMask>
</template>
