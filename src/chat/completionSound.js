import { event_types, eventSource } from '@sillytavern/script';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { GENERATE_BLACKLIST_SETTLED_EVENT } from '../features/constants.js';
import { BUILTIN_COMPLETION_SOUNDS, MESSAGE_COMPLETION_SOUND_COOLDOWN_MS, MESSAGE_COMPLETION_SOUND_DB_NAME, MESSAGE_COMPLETION_SOUND_DB_VERSION, MESSAGE_COMPLETION_SOUND_KEEP_ALIVE_SRC, MESSAGE_COMPLETION_SOUND_LOCAL_KEY, MESSAGE_COMPLETION_SOUND_MAX_LOCAL_BYTES, MESSAGE_COMPLETION_SOUND_SOURCES, MESSAGE_COMPLETION_SOUND_STORE } from './constants.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';

function initializeMessageCompletionSoundControls(persistSettings) {
    populateMessageCompletionSoundBuiltinOptions();
    normalizeMessageCompletionSoundSettings();
    updateMessageCompletionSoundControls();
    refreshMessageCompletionSoundLocalFileLabel();

    $('#bai_bai_toolkit_message_completion_sound_enabled')
        .prop('checked', settings.messageCompletionSoundEnabled)
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundEnabled = Boolean($(this).prop('checked'));
            persistSettings?.();
            applyMessageCompletionSound();
        });

    $('#bai_bai_toolkit_message_completion_sound_keep_alive_enabled')
        .prop('checked', settings.messageCompletionSoundKeepAliveEnabled !== false)
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundKeepAliveEnabled = Boolean($(this).prop('checked'));
            persistSettings?.();
            syncMessageCompletionSoundKeepAliveHandlers();
            if (!isMessageCompletionSoundKeepAliveEnabled()) {
                stopMessageCompletionSoundKeepAlive();
            }
        });

    $('#bai_bai_toolkit_message_completion_sound_source')
        .val(getMessageCompletionSoundSource())
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', function () {
            const nextSource = String($(this).val() || 'builtin');
            settings.messageCompletionSoundSource = MESSAGE_COMPLETION_SOUND_SOURCES.has(nextSource)
                ? nextSource
                : 'builtin';
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
            updateMessageCompletionSoundControls();
            refreshMessageCompletionSoundLocalFileLabel();
        });

    $('#bai_bai_toolkit_message_completion_sound_builtin_id')
        .val(getMessageCompletionSoundBuiltin().id)
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundBuiltinId = String($(this).val() || BUILTIN_COMPLETION_SOUNDS[0].id);
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
        });

    $('#bai_bai_toolkit_message_completion_sound_url')
        .val(settings.messageCompletionSoundUrl || '')
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundUrl = String($(this).val() || '').trim();
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
        });

    $('#bai_bai_toolkit_message_completion_sound_volume')
        .val(String(clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume)))
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundVolume = clampMessageCompletionSoundVolume($(this).val());
            updateMessageCompletionSoundVolumeLabel();
            const audio = getMessageCompletionSoundState().audio;
            if (audio instanceof HTMLAudioElement) {
                audio.volume = settings.messageCompletionSoundVolume;
            }
            persistSettings?.();
        });

    $('#bai_bai_toolkit_message_completion_sound_preview')
        .off('click.baiBaiToolkitMessageSound')
        .on('click.baiBaiToolkitMessageSound', async function () {
            const button = $(this);
            if (button.hasClass('disabled')) {
                return;
            }

            button.addClass('disabled');
            setMessageCompletionSoundStatus('正在试听...');
            try {
                await playSelectedMessageCompletionSound({ preview: true });
                setMessageCompletionSoundStatus('已播放当前提示音。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to preview message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '提示音播放失败。', true);
            } finally {
                button.removeClass('disabled');
            }
        });

    $('#bai_bai_toolkit_message_completion_sound_local_file')
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', async function () {
            const input = $(this);
            const file = this.files?.[0];
            input.val('');

            if (!file) {
                return;
            }

            try {
                setMessageCompletionSoundStatus('正在保存到本机...');
                const record = await saveMessageCompletionSoundLocalFile(file);
                settings.messageCompletionSoundSource = 'local';
                settings.messageCompletionSoundLocalFileName = record.name;
                resetMessageCompletionSoundAudio();
                persistSettings?.();
                updateMessageCompletionSoundControls();
                await refreshMessageCompletionSoundLocalFileLabel();
                setMessageCompletionSoundStatus('已保存到本机。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save local message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '本地音频保存失败。', true);
            }
        });

    $('#bai_bai_toolkit_message_completion_sound_local_clear')
        .off('click.baiBaiToolkitMessageSound')
        .on('click.baiBaiToolkitMessageSound', async function () {
            const button = $(this);
            if (button.hasClass('disabled')) {
                return;
            }

            button.addClass('disabled');
            try {
                await deleteMessageCompletionSoundLocalFile();
                settings.messageCompletionSoundLocalFileName = '';
                resetMessageCompletionSoundAudio();
                persistSettings?.();
                await refreshMessageCompletionSoundLocalFileLabel();
                setMessageCompletionSoundStatus('已清除本机提示音。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to delete local message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '本地音频清除失败。', true);
            } finally {
                button.removeClass('disabled');
            }
        });
}

function normalizeMessageCompletionSoundSettings() {
    if (!MESSAGE_COMPLETION_SOUND_SOURCES.has(settings.messageCompletionSoundSource)) {
        settings.messageCompletionSoundSource = 'builtin';
    }

    settings.messageCompletionSoundBuiltinId = getMessageCompletionSoundBuiltin().id;
    settings.messageCompletionSoundVolume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);
    settings.messageCompletionSoundUrl = typeof settings.messageCompletionSoundUrl === 'string'
        ? settings.messageCompletionSoundUrl.trim()
        : '';
    settings.messageCompletionSoundLocalFileName = typeof settings.messageCompletionSoundLocalFileName === 'string'
        ? settings.messageCompletionSoundLocalFileName
        : '';
    settings.messageCompletionSoundKeepAliveEnabled = settings.messageCompletionSoundKeepAliveEnabled !== false;
}

function populateMessageCompletionSoundBuiltinOptions() {
    const select = $('#bai_bai_toolkit_message_completion_sound_builtin_id');
    if (!select.length || select.children().length) {
        return;
    }

    for (const sound of BUILTIN_COMPLETION_SOUNDS) {
        select.append($('<option></option>').val(sound.id).text(sound.label));
    }
}

function updateMessageCompletionSoundControls() {
    const source = getMessageCompletionSoundSource();
    $('#bai_bai_toolkit_message_completion_sound_enabled')
        .prop('checked', Boolean(settings.messageCompletionSoundEnabled));
    $('#bai_bai_toolkit_message_completion_sound_keep_alive_enabled')
        .prop('checked', settings.messageCompletionSoundKeepAliveEnabled !== false);
    $('#bai_bai_toolkit_message_completion_sound_source').val(source);
    $('#bai_bai_toolkit_message_completion_sound_builtin_id').val(getMessageCompletionSoundBuiltin().id);
    $('#bai_bai_toolkit_message_completion_sound_url').val(settings.messageCompletionSoundUrl || '');
    $('#bai_bai_toolkit_message_completion_sound_builtin_row').toggle(source === 'builtin');
    $('#bai_bai_toolkit_message_completion_sound_url_row').toggle(source === 'url');
    $('#bai_bai_toolkit_message_completion_sound_local_row').toggle(source === 'local');
    $('#bai_bai_toolkit_message_completion_sound_volume')
        .val(String(clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume)));
    updateMessageCompletionSoundVolumeLabel();
}

function updateMessageCompletionSoundVolumeLabel() {
    const volume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);
    $('#bai_bai_toolkit_message_completion_sound_volume_value').text(`${Math.round(volume * 100)}%`);
}

function setMessageCompletionSoundStatus(message, isError = false) {
    const status = $('#bai_bai_toolkit_message_completion_sound_status');
    if (!status.length) {
        return;
    }

    status.text(message || '').css('color', isError ? 'var(--SmartThemeQuoteColor)' : '');
}

function getMessageCompletionSoundSource() {
    const source = String(settings.messageCompletionSoundSource || 'builtin');
    return MESSAGE_COMPLETION_SOUND_SOURCES.has(source) ? source : 'builtin';
}

function getMessageCompletionSoundBuiltin() {
    return BUILTIN_COMPLETION_SOUNDS.find(sound => sound.id === settings.messageCompletionSoundBuiltinId)
        || BUILTIN_COMPLETION_SOUNDS[0];
}

function clampMessageCompletionSoundVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 0.8;
    }

    return Math.max(0, Math.min(1, number));
}

function getMessageCompletionSoundState() {
    if (!extensionState.messageCompletionSound || typeof extensionState.messageCompletionSound !== 'object') {
        extensionState.messageCompletionSound = {};
    }

    const state = extensionState.messageCompletionSound;
    if (!Array.isArray(state.eventHandlers)) {
        state.eventHandlers = [];
    }

    return state;
}

function applyMessageCompletionSound() {
    if (settings.messageCompletionSoundEnabled) {
        installMessageCompletionSoundHandlers();
        syncMessageCompletionSoundKeepAliveHandlers();
    } else {
        removeMessageCompletionSoundHandlers();
    }
}

function installMessageCompletionSoundHandlers() {
    const state = getMessageCompletionSoundState();
    if (state.installed || typeof eventSource?.on !== 'function') {
        return;
    }

    const generationStartedHandler = (_type, _options, dryRun) => {
        if (dryRun) return;
        state.waitingForBlacklist = false;
        state.generationActive = true;
        state.generationStopped = false;
        startMessageCompletionSoundKeepAlive().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to start message completion sound keep-alive`, error);
        });
    };
    const generationStoppedHandler = () => {
        if (state.generationActive) {
            state.generationStopped = true;
        }
        stopMessageCompletionSoundKeepAlive();
    };
    const finishGeneration = completed => {
        const shouldPlay = completed && state.generationActive && !state.generationStopped;
        state.waitingForBlacklist = false;
        state.generationActive = false;
        state.generationStopped = false;

        if (!shouldPlay) {
            stopMessageCompletionSoundKeepAlive();
            return;
        }

        playSelectedMessageCompletionSound().catch(error => {
            console.warn(`${LOG_PREFIX} Failed to play message completion sound`, error);
        }).finally(() => {
            stopMessageCompletionSoundKeepAlive();
        });
    };

    const generationEndedHandler = () => {
        // ponytail: use the retry module's final verdict; never scan the reply twice or block ST's end event.
        if (state.generationActive && !state.generationStopped && extensionState.generateBlacklistRetry?.run) {
            state.waitingForBlacklist = true;
            return;
        }
        finishGeneration(true);
    };
    const blacklistSettledHandler = completed => {
        if (!state.waitingForBlacklist) return;
        finishGeneration(completed);
    };

    addMessageCompletionSoundEventHandler(event_types.GENERATION_STARTED, generationStartedHandler);
    addMessageCompletionSoundEventHandler(event_types.GENERATION_STOPPED, generationStoppedHandler);
    addMessageCompletionSoundEventHandler(event_types.GENERATION_ENDED, generationEndedHandler);
    addMessageCompletionSoundEventHandler(GENERATE_BLACKLIST_SETTLED_EVENT, blacklistSettledHandler);
    addMessageCompletionSoundEventHandler(event_types.CHAT_CHANGED, () => finishGeneration(false));
    state.installed = true;
    syncMessageCompletionSoundKeepAliveHandlers();
}

function addMessageCompletionSoundEventHandler(event, handler) {
    if (!event || typeof eventSource?.on !== 'function') {
        return;
    }

    const state = getMessageCompletionSoundState();
    eventSource.on(event, handler);
    state.eventHandlers.push({ event, handler });
}

function removeMessageCompletionSoundHandlers() {
    const state = getMessageCompletionSoundState();
    for (const entry of state.eventHandlers || []) {
        eventSource.removeListener?.(entry.event, entry.handler);
    }

    state.eventHandlers = [];
    state.installed = false;
    state.waitingForBlacklist = false;
    state.generationActive = false;
    state.generationStopped = false;
    removeMessageCompletionSoundKeepAliveHandlers();
    stopMessageCompletionSoundKeepAlive();
    resetMessageCompletionSoundAudio();
}

function isMessageCompletionSoundKeepAliveEnabled() {
    return Boolean(
        settings.messageCompletionSoundEnabled
        && settings.messageCompletionSoundKeepAliveEnabled !== false
        && isMobile()
    );
}

function syncMessageCompletionSoundKeepAliveHandlers() {
    if (isMessageCompletionSoundKeepAliveEnabled()) {
        installMessageCompletionSoundKeepAliveHandlers();
        const state = getMessageCompletionSoundState();
        if (state.generationActive && !state.generationStopped) {
            startMessageCompletionSoundKeepAlive().catch(error => {
                console.debug(`${LOG_PREFIX} Failed to start message completion sound keep-alive`, error);
            });
        }
    } else {
        removeMessageCompletionSoundKeepAliveHandlers();
        stopMessageCompletionSoundKeepAlive();
    }
}

function installMessageCompletionSoundKeepAliveHandlers() {
    const state = getMessageCompletionSoundState();
    if (state.keepAliveInteractionHandlersInstalled) {
        return;
    }

    const unlockHandler = () => {
        unlockMessageCompletionSoundKeepAlive().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to unlock message completion sound keep-alive`, error);
        });
    };
    const passiveCaptureOptions = { capture: true, passive: true };
    const keydownOptions = { capture: true };
    state.keepAliveInteractionHandlers = [
        { target: document, event: 'pointerdown', handler: unlockHandler, options: passiveCaptureOptions },
        { target: document, event: 'touchstart', handler: unlockHandler, options: passiveCaptureOptions },
        { target: document, event: 'click', handler: unlockHandler, options: passiveCaptureOptions },
        { target: document, event: 'keydown', handler: unlockHandler, options: keydownOptions },
    ];

    for (const entry of state.keepAliveInteractionHandlers) {
        entry.target.addEventListener(entry.event, entry.handler, entry.options);
    }

    state.keepAliveInteractionHandlersInstalled = true;
}

function removeMessageCompletionSoundKeepAliveHandlers() {
    const state = getMessageCompletionSoundState();
    for (const entry of state.keepAliveInteractionHandlers || []) {
        entry.target.removeEventListener(entry.event, entry.handler, entry.options);
    }

    state.keepAliveInteractionHandlers = [];
    state.keepAliveInteractionHandlersInstalled = false;
    state.keepAliveUnlocking = false;
}

async function unlockMessageCompletionSoundKeepAlive() {
    const state = getMessageCompletionSoundState();
    if (!isMessageCompletionSoundKeepAliveEnabled() || state.keepAliveUnlocked || state.keepAliveUnlocking || state.keepAlivePlaying) {
        return false;
    }

    state.keepAliveUnlocking = true;
    try {
        const audio = getMessageCompletionSoundKeepAliveAudio();
        resetMessageCompletionSoundKeepAliveTime(audio);
        await audio.play();
        audio.pause();
        resetMessageCompletionSoundKeepAliveTime(audio);
        state.keepAliveUnlocked = true;
        return true;
    } finally {
        state.keepAliveUnlocking = false;
    }
}

async function startMessageCompletionSoundKeepAlive() {
    const state = getMessageCompletionSoundState();
    if (!isMessageCompletionSoundKeepAliveEnabled()) {
        return false;
    }

    const audio = getMessageCompletionSoundKeepAliveAudio();
    if (state.keepAlivePlaying && !audio.paused) {
        return true;
    }

    state.keepAliveRequested = true;

    try {
        resetMessageCompletionSoundKeepAliveTime(audio);
        await audio.play();
        state.keepAlivePlaying = true;
        state.keepAliveUnlocked = true;
        return true;
    } catch (error) {
        state.keepAlivePlaying = false;
        state.keepAliveLastErrorAt = Date.now();
        setMessageCompletionSoundStatus('静音保活启动失败，浏览器可能限制了自动播放。', true);
        throw error;
    }
}

function stopMessageCompletionSoundKeepAlive() {
    const state = getMessageCompletionSoundState();
    const audio = state.keepAliveAudio;
    if (audio instanceof HTMLAudioElement) {
        audio.pause();
        resetMessageCompletionSoundKeepAliveTime(audio);
    }

    state.keepAliveRequested = false;
    state.keepAlivePlaying = false;
}

function resetMessageCompletionSoundKeepAliveTime(audio) {
    try {
        audio.currentTime = 0;
    } catch {
        // Some mobile browsers reject currentTime writes while media is not ready.
    }
}

function getMessageCompletionSoundKeepAliveAudio() {
    const state = getMessageCompletionSoundState();
    if (!(state.keepAliveAudio instanceof HTMLAudioElement)) {
        const audio = new Audio(MESSAGE_COMPLETION_SOUND_KEEP_ALIVE_SRC);
        audio.loop = true;
        audio.muted = false;
        audio.volume = 1;
        audio.preload = 'auto';
        audio.setAttribute('playsinline', '');
        state.keepAliveAudio = audio;
    }

    return state.keepAliveAudio;
}

async function playSelectedMessageCompletionSound({ preview = false } = {}) {
    if (!preview && !settings.messageCompletionSoundEnabled) {
        return false;
    }

    const state = getMessageCompletionSoundState();
    const now = Date.now();
    if (!preview && now - Number(state.lastPlayedAt || 0) < MESSAGE_COMPLETION_SOUND_COOLDOWN_MS) {
        return false;
    }

    const audio = getMessageCompletionSoundAudio();
    const src = await getMessageCompletionSoundPlaybackSrc();
    // Loading a local sound is asynchronous; the user may have disabled it meanwhile.
    if (!preview && !settings.messageCompletionSoundEnabled) return false;
    audio.volume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);

    if (audio.src !== src) {
        audio.pause();
        audio.src = src;
        audio.load();
    } else {
        audio.pause();
    }

    audio.currentTime = 0;
    await audio.play();
    state.lastPlayedAt = now;
    return true;
}

function getMessageCompletionSoundAudio() {
    const state = getMessageCompletionSoundState();
    if (!(state.audio instanceof HTMLAudioElement)) {
        state.audio = new Audio();
        state.audio.preload = 'none';
    }

    return state.audio;
}

async function getMessageCompletionSoundPlaybackSrc() {
    const source = getMessageCompletionSoundSource();
    revokeMessageCompletionSoundObjectUrl();

    if (source === 'builtin') {
        const builtin = getMessageCompletionSoundBuiltin();
        // 音频文件保留在插件根目录 video/,构建产物在 dist/ 下运行,需要回退一级。
        // 用变量拼接路径,避免 Vite 对 new URL(字面量, import.meta.url) 的静态资源分析。
        const videoBase = '../video/';
        return new URL(videoBase + builtin.file, import.meta.url).href;
    }

    if (source === 'url') {
        const url = String(settings.messageCompletionSoundUrl || '').trim();
        if (!url) {
            throw new Error('请先填写音频 URL。');
        }

        return url;
    }

    const record = await getMessageCompletionSoundLocalFile();
    if (!record?.blob) {
        throw new Error('本机还没有上传提示音文件。');
    }

    const state = getMessageCompletionSoundState();
    state.objectUrl = URL.createObjectURL(record.blob);
    return state.objectUrl;
}

function resetMessageCompletionSoundAudio() {
    const state = getMessageCompletionSoundState();
    if (state.audio instanceof HTMLAudioElement) {
        state.audio.pause();
        state.audio.removeAttribute('src');
        state.audio.load();
    }

    revokeMessageCompletionSoundObjectUrl();
}

function revokeMessageCompletionSoundObjectUrl() {
    const state = getMessageCompletionSoundState();
    if (state.objectUrl) {
        URL.revokeObjectURL(state.objectUrl);
        state.objectUrl = null;
    }
}

async function refreshMessageCompletionSoundLocalFileLabel() {
    const label = $('#bai_bai_toolkit_message_completion_sound_local_name');
    if (!label.length) {
        return;
    }

    try {
        const record = await getMessageCompletionSoundLocalFile();
        if (record?.name) {
            label.text(record.name);
        } else if (settings.messageCompletionSoundLocalFileName) {
            label.text(`${settings.messageCompletionSoundLocalFileName}（本机未上传）`);
        } else {
            label.text('未上传');
        }
    } catch {
        label.text('本机存储不可用');
    }
}

async function saveMessageCompletionSoundLocalFile(file) {
    if (!(file instanceof File)) {
        throw new Error('请选择一个音频文件。');
    }

    if (!file.type.startsWith('audio/') && !isMessageCompletionSoundAudioFileName(file.name)) {
        throw new Error('请选择浏览器可播放的音频文件。');
    }

    if (file.size > MESSAGE_COMPLETION_SOUND_MAX_LOCAL_BYTES) {
        throw new Error('本地提示音不能超过 5MB。');
    }

    const record = {
        key: MESSAGE_COMPLETION_SOUND_LOCAL_KEY,
        name: file.name,
        type: file.type || 'audio/mpeg',
        size: file.size,
        updatedAt: Date.now(),
        blob: file,
    };
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readwrite');
    const done = idbTransactionDone(transaction);
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    await Promise.all([idbRequest(store.put(record)), done]);
    return record;
}

async function getMessageCompletionSoundLocalFile() {
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readonly');
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    return await idbRequest(store.get(MESSAGE_COMPLETION_SOUND_LOCAL_KEY));
}

async function deleteMessageCompletionSoundLocalFile() {
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readwrite');
    const done = idbTransactionDone(transaction);
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    await Promise.all([idbRequest(store.delete(MESSAGE_COMPLETION_SOUND_LOCAL_KEY)), done]);
}

function getMessageCompletionSoundDb() {
    const state = getMessageCompletionSoundState();
    if (!state.dbPromise) {
        state.dbPromise = openMessageCompletionSoundDb();
    }

    return state.dbPromise;
}

function isMessageCompletionSoundAudioFileName(fileName) {
    return /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(String(fileName || ''));
}

function openMessageCompletionSoundDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('当前浏览器不支持 IndexedDB。'));
            return;
        }

        const request = indexedDB.open(MESSAGE_COMPLETION_SOUND_DB_NAME, MESSAGE_COMPLETION_SOUND_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MESSAGE_COMPLETION_SOUND_STORE)) {
                db.createObjectStore(MESSAGE_COMPLETION_SOUND_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败。'));
        request.onblocked = () => reject(new Error('IndexedDB 正被其他页面占用。'));
    });
}

function idbRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败。'));
    });
}

function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 事务失败。'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已取消。'));
    });
}

export {
    addMessageCompletionSoundEventHandler,
    applyMessageCompletionSound,
    clampMessageCompletionSoundVolume,
    deleteMessageCompletionSoundLocalFile,
    getMessageCompletionSoundAudio,
    getMessageCompletionSoundBuiltin,
    getMessageCompletionSoundDb,
    getMessageCompletionSoundKeepAliveAudio,
    getMessageCompletionSoundLocalFile,
    getMessageCompletionSoundPlaybackSrc,
    getMessageCompletionSoundSource,
    getMessageCompletionSoundState,
    idbRequest,
    idbTransactionDone,
    initializeMessageCompletionSoundControls,
    installMessageCompletionSoundHandlers,
    installMessageCompletionSoundKeepAliveHandlers,
    isMessageCompletionSoundAudioFileName,
    isMessageCompletionSoundKeepAliveEnabled,
    normalizeMessageCompletionSoundSettings,
    openMessageCompletionSoundDb,
    playSelectedMessageCompletionSound,
    populateMessageCompletionSoundBuiltinOptions,
    refreshMessageCompletionSoundLocalFileLabel,
    removeMessageCompletionSoundHandlers,
    removeMessageCompletionSoundKeepAliveHandlers,
    resetMessageCompletionSoundAudio,
    resetMessageCompletionSoundKeepAliveTime,
    revokeMessageCompletionSoundObjectUrl,
    saveMessageCompletionSoundLocalFile,
    setMessageCompletionSoundStatus,
    startMessageCompletionSoundKeepAlive,
    stopMessageCompletionSoundKeepAlive,
    syncMessageCompletionSoundKeepAliveHandlers,
    unlockMessageCompletionSoundKeepAlive,
    updateMessageCompletionSoundControls,
    updateMessageCompletionSoundVolumeLabel,
};
