export const PLUGIN_VERSION = __BBY_VERSION__;

export function versionedAssetUrl(assetPath: string, baseUrl: string): string {
  const url = new URL(assetPath, baseUrl);
  url.searchParams.set('ver', PLUGIN_VERSION);
  return url.href;
}
