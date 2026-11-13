<script setup lang="ts">
/**
 * 弹窗遮罩外壳:统一承载各弹窗的 .bby-modal-mask 层 + 遮罩点击关闭。
 *
 * Teleport 到 modalHost(.bby-root 直接子级,在页面滚动容器之外):
 * 修复 iOS Safari 的老问题——「可滚动祖先内的 position:fixed 后代」会相对滚动内容、
 * 而非视口定位,导致页面滚动后弹窗整体偏上、顶出屏幕。
 * 宿主仍在 shadow root 内,scoped 样式与 --bby-* 主题变量照常生效,
 * 故 to 的是 shadow 内元素,而非会逃出 shadow 的 Teleport to="body"。
 *
 * 显隐用 open prop(而非调用方在 <ModalMask> 上写 v-if):Transition 容器须常驻、由内部
 * v-if 切换弹窗,离场动画才能播(否则组件随父 v-if 一起卸载,leave 来不及触发)。
 * slot 是惰性函数,open=false 时走不到 <slot/>、不会求值,故 slot 里引用关闭后变 null 的
 * 对象(channelDraft.name 等)也不会报错——无需在各调用点加守卫。
 */
import { modalHost } from '@pen/state/ui';

defineProps<{
  /** 弹窗是否显示 */
  open?: boolean;
  /** 叠加在其它弹窗之上(更高 z-index),如渠道弹窗里再开确认 */
  topLayer?: boolean;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <!-- modalHost 未就绪时就地渲染兜底,绝不丢弹窗 -->
  <Teleport :to="modalHost" :disabled="!modalHost">
    <Transition name="bby-modal">
      <div
        v-if="open"
        class="bby-modal-mask"
        :class="{ 'bby-modal-mask-top': topLayer }"
        @mousedown.self="emit('close')"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 叠加层:盖在普通弹窗之上 */
.bby-modal-mask-top {
  z-index: 10002;
}
</style>
