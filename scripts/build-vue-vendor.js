import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vuePackagePath = resolve(root, 'node_modules/vue/package.json');
const sourcePath = resolve(root, 'node_modules/vue/dist/vue.esm-browser.prod.js');
const outputPath = resolve(root, 'vendor/vue.esm-browser.prod.js');
const metaPath = resolve(root, 'vendor/vue.vendor.json');

const vuePackage = JSON.parse(readFileSync(vuePackagePath, 'utf8'));

mkdirSync(dirname(outputPath), { recursive: true });
copyFileSync(sourcePath, outputPath);
writeFileSync(
    metaPath,
    `${JSON.stringify({
        package: 'vue',
        version: vuePackage.version,
        source: 'node_modules/vue/dist/vue.esm-browser.prod.js',
        output: 'vendor/vue.esm-browser.prod.js',
    }, null, 2)}\n`,
);

console.log(`Vendored Vue ${vuePackage.version} to ${outputPath}`);
