const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const guardedRoots = new WeakSet<ShadowRoot>();

function pathContainsEditable(event: KeyboardEvent): boolean {
  return event.composedPath().some(node =>
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement ||
    (node instanceof HTMLElement && node.isContentEditable),
  );
}

/**
 * 防止 Shadow DOM 内编辑控件的方向键继续冒泡到 ST 全局快捷键。
 * 只截断传播,不 preventDefault,故光标移动、选项切换和数字增减仍由控件正常处理。
 */
export function guardEditableArrowKeys(root: ShadowRoot): void {
  if (guardedRoots.has(root)) return;
  guardedRoots.add(root);
  root.addEventListener('keydown', event => {
    if (!(event instanceof KeyboardEvent) || !ARROW_KEYS.has(event.key)) return;
    // ST 本身会忽略带修饰键的方向键;继续放行可避免影响其它全局组合快捷键。
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
    if (pathContainsEditable(event)) event.stopPropagation();
  });
}
