import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 浏览器从 /scripts/extensions/third-party/<插件>/dist/index.js 加载,
// import 宿主 ST 模块时需要算出从 dist/ 回到 ST public/ 根的相对路径。
// `@sillytavern/scripts/xxx` -> `../../../../../scripts/xxx.js`,并标为 external,
// ST 自身的代码不会被打进包里,运行时浏览器直接走相对路径。
const relative_sillytavern_path = path.relative(
  path.join(__dirname, 'dist'),
  __dirname.substring(0, __dirname.lastIndexOf('public') + 'public'.length),
);

// ST 已在全局挂载的第三方库,避免重复打包(本插件目前直接用全局 $/toastr,不 import)。
const globals = {
  jquery: '$',
  lodash: '_',
  toastr: 'toastr',
};

const package_json = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const package_version = String(package_json.version ?? '');

export default defineConfig(({ mode }) => ({
  define: {
    __BBT_VERSION__: JSON.stringify(package_version),
    // 内置柏宝砚(src/pen)沿用的版本常量,随柏宝箱版本走
    __BBY_VERSION__: JSON.stringify(package_version),
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },

  plugins: [
    vue(),
    {
      name: 'sillytavern-resolver',
      enforce: 'pre',
      resolveId(id) {
        if (id.startsWith('@sillytavern/')) {
          return {
            id:
              path
                .join(relative_sillytavern_path, id.replace('@sillytavern/', ''))
                .replaceAll('\\', '/') + '.js',
            external: true,
          };
        }
        if (id in globals) {
          return { id, external: true };
        }
      },
    },
  ],

  resolve: {
    alias: {
      // 内置柏宝砚的源码根;刻意不用宽泛的 `@`,免得和柏宝箱其他模块混淆
      '@pen': path.resolve(__dirname, 'src/pen'),
    },
  },

  test: {
    include: ['src/pen/**/*.test.ts'],
  },

  build: {
    rollupOptions: {
      input: 'src/index.js',
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].[hash].chunk.js',
        assetFileNames: '[name].[ext]',
        globals,
        // 全部打进单个 index.js:云端/高延迟环境下,一个大文件(gzip 后一次
        // 请求)比十来个懒加载 chunk 的多次往返加载得更快;Vue/CodeMirror 等
        // 动态 import 会被内联,import() 调用点原样保留、立即 resolve。
        inlineDynamicImports: true,
      },
      external: id => id in globals,
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'production' ? true : 'inline',
    minify: mode === 'production',
    target: 'esnext',
  },
}));
