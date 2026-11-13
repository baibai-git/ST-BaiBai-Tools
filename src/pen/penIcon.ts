/**
 * 注入 ST 原生区域(魔棒菜单、消息编辑按钮)用的内联 SVG 图标。
 * 与 Icon.vue 的 leaf 同形 —— 流畅双曲线,兼具羽笔意象;这些区域在 Vue 应用之外,只能用字符串注入。
 */
export function penIconSvg(size = 18, marginTop = 0): string {
  const offset = marginTop ? `margin-top:${marginTop}px;` : '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="${offset}width:${size}px;height:${size}px;vertical-align:-0.15em"><path d="M19.5 4.5C12 4.7 6 8.2 5 14.5c3.8 1.1 7.2.2 9.3-2.5"/><path d="M5 19.5c1.7-5 5.5-8.5 11-10.5"/></svg>`;
}
