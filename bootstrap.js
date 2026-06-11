const BOOTSTRAP_FALLBACK_VERSION = 'dev';

async function readManifestVersion() {
    try {
        const manifestUrl = new URL('./manifest.json', import.meta.url);
        const response = await fetch(manifestUrl.href, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Failed to read manifest.json: ${response.status} ${response.statusText}`);
        }

        const manifest = await response.json();
        return String(manifest?.version || BOOTSTRAP_FALLBACK_VERSION);
    } catch (error) {
        console.warn('[SillyTavern-Mobile-Resize-Guard] Failed to read manifest version; using dev cache key.', error);
        return BOOTSTRAP_FALLBACK_VERSION;
    }
}

const entryUrl = new URL('./index.js', import.meta.url);
entryUrl.searchParams.set('v', await readManifestVersion());

await import(entryUrl.href);
