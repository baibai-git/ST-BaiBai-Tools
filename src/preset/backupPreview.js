import { getRequestHeaders } from '@sillytavern/script';
import { getPresetManager } from '@sillytavern/scripts/preset-manager';
import { skipNextPresetAutoBackup } from './autoBackup.js';
import { deletePresetBackupFile, fetchPresetBackupItems, PRESET_BACKUPS_CLEANED_EVENT, runPresetBackupMutation } from './backupRetention.js';
import { OPENAI_SETTINGS_SELECTOR, PRESET_BACKUP_PREVIEW_APP_KEY, PRESET_BACKUP_PREVIEW_BATCH_DELETE_CONCURRENCY, PRESET_BACKUP_PREVIEW_CLOSING_CLASS, PRESET_BACKUP_PREVIEW_DOWNLOAD_URL, PRESET_BACKUP_PREVIEW_EXPAND_ANIMATION_MS, PRESET_BACKUP_PREVIEW_NOTE_MAX_LENGTH, PRESET_BACKUP_PREVIEW_NOTE_URL, PRESET_BACKUP_PREVIEW_PAGE_SIZE, PRESET_BACKUP_PREVIEW_RENAME_URL, PRESET_BACKUP_PREVIEW_UI_ID, PRESET_BACKUP_PREVIEW_UI_KEY, PRESET_BACKUP_PREVIEW_UI_STYLE_ID } from './constants.js';
import { LOG_PREFIX, extensionState } from './state.js';
import { loadPresetVueModule } from './vueList.js';

function applyPresetBackupPreviewUi() {
    applyPresetBackupPreviewUiStyle();
    insertPresetBackupPreviewUi();
    installPresetBackupPreviewUiObserver();
}

function insertPresetBackupPreviewUi() {
    const target = document.querySelector(OPENAI_SETTINGS_SELECTOR);

    if (!(target instanceof HTMLElement) || !target.parentElement) {
        return false;
    }

    let host = document.getElementById(PRESET_BACKUP_PREVIEW_UI_ID);

    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.id = PRESET_BACKUP_PREVIEW_UI_ID;
        host.className = 'bai-bai-preset-backup-preview';
    }

    void mountPresetBackupPreviewVueApp(host);

    if (host.nextElementSibling !== target || host.parentElement !== target.parentElement) {
        target.parentElement.insertBefore(host, target);
    }

    return true;
}

function installPresetBackupPreviewUiObserver() {
    if (extensionState[PRESET_BACKUP_PREVIEW_UI_KEY] || typeof MutationObserver !== 'function' || !document.body) {
        return;
    }

    const state = { observer: null, pending: false };
    const sync = () => {
        state.pending = false;
        insertPresetBackupPreviewUi();
    };
    const scheduleSync = () => {
        if (state.pending) {
            return;
        }

        state.pending = true;

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(sync);
        } else {
            setTimeout(sync, 0);
        }
    };
    const observer = new MutationObserver(scheduleSync);

    state.observer = observer;

    observer.observe(document.body, { childList: true, subtree: true });
    extensionState[PRESET_BACKUP_PREVIEW_UI_KEY] = state;
}

async function mountPresetBackupPreviewVueApp(host) {
    if (!(host instanceof HTMLElement) || extensionState[PRESET_BACKUP_PREVIEW_APP_KEY]?.host === host) {
        return;
    }

    const existing = extensionState[PRESET_BACKUP_PREVIEW_APP_KEY];

    if (existing?.app) {
        try {
            existing.app.unmount();
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to unmount preset backup preview app`, error);
        }
    }

    try {
        const vue = await loadPresetVueModule();

        if (!document.documentElement.contains(host)) {
            return;
        }

        const state = createPresetBackupPreviewModel();
        const app = vue.createApp(createPresetBackupPreviewRootComponent(vue, state));
        app.mount(host);
        extensionState[PRESET_BACKUP_PREVIEW_APP_KEY] = { host, app, state };
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to mount preset backup preview Vue app`, error);
    }
}

function createPresetBackupPreviewModel() {
    return {
        items: [],
        query: '',
        page: 1,
        hasLoaded: false,
        loading: false,
        refreshAgain: false,
        status: '',
        composing: false,
        renameDialogOpen: false,
        renameTarget: null,
        renameValue: '',
        renameComposing: false,
        renaming: false,
        noteDialogOpen: false,
        noteTarget: null,
        noteValue: '',
        noteComposing: false,
        savingNote: false,
        deleteDialogOpen: false,
        deleteTarget: null,
        deleting: false,
        selectionMode: false,
        selectedFileNames: [],
        batchDeleting: false,
        importingFileName: '',
        closing: false,
        animating: false,
    };
}

function createPresetBackupPreviewRootComponent(vue, model) {
    const h = vue.h;

    return {
        name: 'PresetBackupPreview',
        data() {
            return model;
        },
        mounted() {
            document.addEventListener(PRESET_BACKUPS_CLEANED_EVENT, this.onBackupsCleaned);
        },
        beforeUnmount() {
            document.removeEventListener(PRESET_BACKUPS_CLEANED_EVENT, this.onBackupsCleaned);
        },
        computed: {
            protectedCount() {
                return this.items.filter(item => item.note).length;
            },
            normalizedQuery() {
                return this.query.trim().toLowerCase();
            },
            filteredItems() {
                if (!this.normalizedQuery) {
                    return this.items;
                }

                return this.items.filter(item => item.searchText.includes(this.normalizedQuery));
            },
            pageCount() {
                return Math.max(1, Math.ceil(this.filteredItems.length / PRESET_BACKUP_PREVIEW_PAGE_SIZE));
            },
            safePage() {
                return Math.min(Math.max(1, this.page), this.pageCount);
            },
            pagedItems() {
                const page = this.safePage;
                const start = (page - 1) * PRESET_BACKUP_PREVIEW_PAGE_SIZE;
                return this.filteredItems.slice(start, start + PRESET_BACKUP_PREVIEW_PAGE_SIZE);
            },
            selectedCount() {
                return this.selectedFileNames.length;
            },
            pageAllSelected() {
                const pageItems = this.pagedItems;

                return pageItems.length > 0 && pageItems.every(item => this.selectedFileNames.includes(item.fileName));
            },
            displayStatus() {
                if (this.status) {
                    return this.status;
                }

                const total = this.items.length;
                const visibleCount = this.filteredItems.length;

                if (total <= 0) {
                    return '';
                }

                const firstVisible = visibleCount > 0 ? (this.safePage - 1) * PRESET_BACKUP_PREVIEW_PAGE_SIZE + 1 : 0;
                const lastVisible = visibleCount > 0 ? Math.min(this.safePage * PRESET_BACKUP_PREVIEW_PAGE_SIZE, visibleCount) : 0;

                return this.normalizedQuery
                    ? `\u663e\u793a ${firstVisible}-${lastVisible} / ${visibleCount} \u4e2a\u5339\u914d\u5907\u4efd\uff0c\u5171 ${total} \u4e2a\u5907\u4efd`
                    : `\u663e\u793a ${firstVisible}-${lastVisible} / ${total} \u4e2a\u5907\u4efd`;
            },
        },
        watch: {
            page() {
                this.clampPage();
            },
            filteredItems() {
                this.clampPage();
            },
        },
        methods: {
            onBackupsCleaned(event) {
                const deleted = new Set(event.detail.deletedFileNames);
                this.items = this.items.filter(item => !deleted.has(item.fileName));
                this.selectedFileNames = this.selectedFileNames.filter(fileName => !deleted.has(fileName));
                if (this.hasLoaded || this.loading) void this.refresh();
            },
            clampPage() {
                const nextPage = Math.min(Math.max(1, this.page), this.pageCount);

                if (nextPage !== this.page) {
                    this.page = nextPage;
                }
            },
            setQuery(value) {
                this.query = String(value ?? '');
                this.page = 1;
            },
            onSearchInput(event) {
                if (event?.isComposing || this.composing) {
                    return;
                }

                this.setQuery(event?.target?.value ?? '');
            },
            onSearchCompositionStart() {
                this.composing = true;
            },
            onSearchCompositionEnd(event) {
                this.composing = false;
                this.setQuery(event?.target?.value ?? '');
            },
            async refresh() {
                if (this.loading) {
                    this.refreshAgain = true;
                    return;
                }

                this.loading = true;
                this.status = '\u6b63\u5728\u5237\u65b0\u5907\u4efd\u5217\u8868...';

                try {
                    this.items = await fetchPresetBackupPreviewItems();
                    this.page = 1;
                    this.hasLoaded = true;
                    this.status = '';
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to refresh preset backups`, error);
                    this.status = `\u5237\u65b0\u5931\u8d25\uff1a${error?.message || '\u672a\u77e5\u9519\u8bef'}`;
                    this.hasLoaded = true;
                } finally {
                    this.loading = false;
                    if (this.refreshAgain) {
                        this.refreshAgain = false;
                        void this.refresh();
                    }
                }
            },
            prevPage() {
                this.page = Math.max(1, this.safePage - 1);
            },
            nextPage() {
                this.page = Math.min(this.pageCount, this.safePage + 1);
            },
            openRenameDialog(item) {
                if (!item || this.renaming || this.deleting || this.importingFileName) {
                    return;
                }

                this.deleteDialogOpen = false;
                this.deleteTarget = null;
                this.renameTarget = item;
                this.renameValue = item.name || '';
                this.renameComposing = false;
                this.renameDialogOpen = true;
                this.status = '';

                vue.nextTick(() => {
                    const input = this.$refs.renameInput;

                    if (input instanceof HTMLInputElement) {
                        input.focus();
                        input.select();
                    }
                });
            },
            closeRenameDialog(force = false) {
                if (this.renaming && !force) {
                    return;
                }

                this.renameDialogOpen = false;
                this.renameTarget = null;
                this.renameValue = '';
                this.renameComposing = false;
            },
            openDeleteDialog(item) {
                if (!item || this.deleting || this.renaming || this.importingFileName) {
                    return;
                }

                this.renameDialogOpen = false;
                this.renameTarget = null;
                this.deleteTarget = item;
                this.deleteDialogOpen = true;
                this.status = '';
            },
            closeDeleteDialog(force = false) {
                if ((this.deleting || this.batchDeleting) && !force) {
                    return;
                }

                this.deleteDialogOpen = false;
                this.deleteTarget = null;
            },
            openNoteDialog(item) {
                if (!item || this.savingNote || this.renaming || this.deleting || this.batchDeleting || this.importingFileName) {
                    return;
                }

                this.renameDialogOpen = false;
                this.renameTarget = null;
                this.deleteDialogOpen = false;
                this.deleteTarget = null;
                this.noteTarget = item;
                this.noteValue = item.note || '';
                this.noteComposing = false;
                this.noteDialogOpen = true;
                this.status = '';

                vue.nextTick(() => {
                    const input = this.$refs.noteInput;

                    if (input instanceof HTMLTextAreaElement) {
                        input.focus();
                        const length = input.value.length;
                        input.setSelectionRange(length, length);
                    }
                });
            },
            closeNoteDialog(force = false) {
                if (this.savingNote && !force) {
                    return;
                }

                this.noteDialogOpen = false;
                this.noteTarget = null;
                this.noteValue = '';
                this.noteComposing = false;
            },
            onNoteInput(event) {
                this.noteValue = String(event?.target?.value ?? '').slice(0, PRESET_BACKUP_PREVIEW_NOTE_MAX_LENGTH);
            },
            onNoteCompositionStart() {
                this.noteComposing = true;
            },
            onNoteCompositionEnd(event) {
                this.noteComposing = false;
                this.onNoteInput(event);
            },
            async confirmNote() {
                const target = this.noteTarget;

                if (!target || this.savingNote) {
                    return;
                }

                const note = this.noteValue.trim();
                this.savingNote = true;
                this.status = note ? '正在保存备注...' : '正在清除备注...';

                try {
                    const updated = normalizePresetBackupPreviewItem(await updatePresetBackupPreviewNote(target.fileName, note));

                    this.items = this.items.map(item => item.fileName === target.fileName
                        ? (updated || {
                            ...item,
                            note,
                            searchText: `${item.name} ${note} ${item.createdAt}`.toLowerCase(),
                        })
                        : item);
                    this.status = note ? '已保存备注' : '已清除备注';
                    this.closeNoteDialog(true);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to update preset backup note`, error);
                    this.status = `备注保存失败：${error?.message || '未知错误'}`;
                } finally {
                    this.savingNote = false;
                }
            },
            onRenameInput(event) {
                this.renameValue = String(event?.target?.value ?? '');
            },
            onRenameCompositionStart() {
                this.renameComposing = true;
            },
            onRenameCompositionEnd(event) {
                this.renameComposing = false;
                this.onRenameInput(event);
            },
            onRenameKeydown(event) {
                if (event?.key !== 'Enter' || event.isComposing || this.renameComposing) {
                    return;
                }

                event.preventDefault();
                void this.confirmRename();
            },
            async confirmRename() {
                const target = this.renameTarget;
                const showName = this.renameValue.trim();

                if (!target || this.renaming) {
                    return;
                }

                if (!showName) {
                    this.status = '\u5907\u4efd\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a';
                    return;
                }

                this.renaming = true;
                this.status = '\u6b63\u5728\u91cd\u547d\u540d\u5907\u4efd...';

                try {
                    const updated = normalizePresetBackupPreviewItem(await renamePresetBackupPreviewItem(target.fileName, showName));

                    this.items = this.items.map(item => item.fileName === target.fileName
                        ? (updated || {
                            ...item,
                            name: formatPresetBackupPreviewDisplayName(showName),
                            searchText: `${formatPresetBackupPreviewDisplayName(showName)} ${item.note || ''} ${item.createdAt}`.toLowerCase(),
                        })
                        : item);
                    this.status = `\u5df2\u91cd\u547d\u540d\uff1a${formatPresetBackupPreviewDisplayName(showName)}`;
                    this.closeRenameDialog(true);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to rename preset backup`, error);
                    this.status = `\u91cd\u547d\u540d\u5931\u8d25\uff1a${error?.message || '\u672a\u77e5\u9519\u8bef'}`;
                } finally {
                    this.renaming = false;
                }
            },
            async confirmDelete() {
                const target = this.deleteTarget;

                if (!target || this.deleting) {
                    return;
                }

                this.deleting = true;
                this.status = '\u6b63\u5728\u5220\u9664\u5907\u4efd...';

                try {
                    await deletePresetBackupPreviewItem(target.fileName);
                    this.items = this.items.filter(item => item.fileName !== target.fileName);
                    this.status = `\u5df2\u5220\u9664\uff1a${target.name || target.fileName}`;
                    this.closeDeleteDialog(true);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to delete preset backup`, error);
                    this.status = `\u5220\u9664\u5931\u8d25\uff1a${error?.message || '\u672a\u77e5\u9519\u8bef'}`;
                } finally {
                    this.deleting = false;
                }
            },
            toggleSelectionMode() {
                if (this.deleting || this.batchDeleting || this.renaming || this.savingNote || this.importingFileName) {
                    return;
                }

                this.selectionMode = !this.selectionMode;
                this.selectedFileNames = [];
                this.status = '';

                if (this.selectionMode) {
                    this.renameDialogOpen = false;
                    this.noteDialogOpen = false;
                    this.deleteDialogOpen = false;
                }
            },
            exitSelectionMode() {
                if (this.batchDeleting) {
                    return;
                }

                this.selectionMode = false;
                this.selectedFileNames = [];
            },
            toggleSelect(item) {
                if (!item || this.batchDeleting) {
                    return;
                }

                this.selectedFileNames = this.selectedFileNames.includes(item.fileName)
                    ? this.selectedFileNames.filter(fileName => fileName !== item.fileName)
                    : [...this.selectedFileNames, item.fileName];
            },
            toggleSelectPage() {
                if (this.batchDeleting) {
                    return;
                }

                const pageFileNames = this.pagedItems.map(item => item.fileName);

                if (this.pageAllSelected) {
                    this.selectedFileNames = this.selectedFileNames.filter(fileName => !pageFileNames.includes(fileName));
                } else {
                    const merged = new Set(this.selectedFileNames);
                    pageFileNames.forEach(fileName => merged.add(fileName));
                    this.selectedFileNames = Array.from(merged);
                }
            },
            openBatchDeleteDialog() {
                if (this.batchDeleting || this.selectedFileNames.length <= 0) {
                    return;
                }

                this.deleteTarget = null;
                this.deleteDialogOpen = true;
                this.status = '';
            },
            async confirmBatchDelete() {
                if (this.batchDeleting || this.selectedFileNames.length <= 0) {
                    return;
                }

                // \u6279\u91cf\u5220\u9664\u590d\u7528\u5355\u6761\u5220\u9664\u63a5\u53e3\uff0c\u5bf9\u6ca1\u6709\u6279\u91cf\u63a5\u53e3\u7684\u65e7\u540e\u7aef\u5929\u7136\u517c\u5bb9\uff1b
                // \u8fd9\u91cc\u7528\u6709\u4e0a\u9650\u7684\u5e76\u53d1\u6c60\u5e76\u53d1\u5220\u9664\uff0c\u907f\u514d\u4e00\u6b21\u9009\u5f88\u591a\u65f6\u7529\u51fa\u8fc7\u591a\u5e76\u53d1\u8bf7\u6c42\u3002
                const targets = this.items.filter(item => this.selectedFileNames.includes(item.fileName));
                const total = targets.length;
                this.batchDeleting = true;
                this.status = `\u6b63\u5728\u5220\u9664\uff1a0 / ${total}`;

                let done = 0;
                let failed = 0;
                const failedFileNames = [];
                const queue = targets.slice();

                const worker = async () => {
                    while (queue.length > 0) {
                        const target = queue.shift();

                        if (!target) {
                            continue;
                        }

                        try {
                            await deletePresetBackupPreviewItem(target.fileName);
                            this.items = this.items.filter(item => item.fileName !== target.fileName);
                            this.selectedFileNames = this.selectedFileNames.filter(fileName => fileName !== target.fileName);
                            done += 1;
                        } catch (error) {
                            console.warn(`${LOG_PREFIX} Failed to delete preset backup in batch`, error);
                            failed += 1;
                            failedFileNames.push(target.fileName);
                        }

                        this.status = `\u6b63\u5728\u5220\u9664\uff1a${done + failed} / ${total}`;
                    }
                };

                const workerCount = Math.min(PRESET_BACKUP_PREVIEW_BATCH_DELETE_CONCURRENCY, total);
                await Promise.all(Array.from({ length: workerCount }, () => worker()));

                this.batchDeleting = false;
                this.deleteDialogOpen = false;
                this.deleteTarget = null;
                // \u5931\u8d25\u7684\u9879\u4fdd\u6301\u9009\u4e2d\uff0c\u65b9\u4fbf\u7528\u6237\u91cd\u8bd5\uff1b\u5168\u90e8\u6210\u529f\u624d\u9000\u51fa\u9009\u62e9\u6a21\u5f0f\u3002
                this.selectedFileNames = failedFileNames;
                this.status = failed > 0
                    ? `\u5df2\u5220\u9664 ${done} \u4e2a\uff0c${failed} \u4e2a\u5931\u8d25`
                    : `\u5df2\u5220\u9664 ${done} \u4e2a\u5907\u4efd`;

                if (this.selectedFileNames.length <= 0) {
                    this.selectionMode = false;
                }
            },
            async importBackup(item) {
                if (!item || this.importingFileName) {
                    return;
                }

                this.importingFileName = item.fileName;
                this.status = `\u6b63\u5728\u5bfc\u5165\uff1a${item.name || item.fileName}`;

                try {
                    const result = await downloadPresetBackupPreviewItem(item.fileName);
                    const { apiId, name, preset } = normalizePresetBackupImportPayload(result, item);
                    const manager = getPresetManager(apiId);

                    if (!manager || typeof manager.savePreset !== 'function') {
                        throw new Error(`Preset manager not found: ${apiId}`);
                    }

                    const importName = getUniquePresetBackupImportName(manager, name);
                    const skipState = skipNextPresetAutoBackup();
                    const skipCountBeforeSave = skipState?.skipCount ?? 0;

                    try {
                        await manager.savePreset(importName, preset);
                    } finally {
                        if (skipState && skipState.skipCount >= skipCountBeforeSave) {
                            skipState.skipCount = Math.max(0, skipCountBeforeSave - 1);
                        }
                    }

                    this.status = `\u5df2\u5bfc\u5165\u5e76\u5207\u6362\uff1a${importName}`;
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to import preset backup`, error);
                    this.status = `\u5bfc\u5165\u5931\u8d25\uff1a${error?.message || '\u672a\u77e5\u9519\u8bef'}`;
                } finally {
                    this.importingFileName = '';
                }
            },
            setActionStatus(action, item) {
                const name = item?.name || '\u8fd9\u4e2a\u5907\u4efd';
                const labels = {
                    delete: '\u5220\u9664\u63a5\u53e3\u5f85\u63a5\u5165\uff1a',
                    download: '\u4e0b\u8f7d\u63a5\u53e3\u5f85\u63a5\u5165\uff1a',
                };

                this.status = `${labels[action] || ''}${name}`;
            },
            toggleDetails(event) {
                event?.preventDefault();
                togglePresetBackupPreviewDetails(this.$refs.details, this);
            },
        },
        render() {
            return h('details', {
                ref: 'details',
                class: {
                    'bai-bai-preset-backup-details': true,
                    [PRESET_BACKUP_PREVIEW_CLOSING_CLASS]: this.closing,
                },
            }, [
                h('summary', {
                    class: 'bai-bai-preset-backup-summary',
                    onClick: this.toggleDetails,
                }, [
                    h('span', { class: 'bai-bai-preset-backup-title' }, [
                        h('i', { class: 'fa-solid fa-clock-rotate-left' }),
                        h('span', '\u81ea\u52a8\u5907\u4efd\u9884\u8bbe'),
                    ]),
                    h('span', { class: 'bai-bai-preset-backup-summary-meta' }, [
                        h('small', '\u5907\u4efd\u5217\u8868'),
                        h('i', { class: 'fa-solid fa-chevron-right bai-bai-preset-backup-chevron' }),
                    ]),
                ]),
                h('div', { class: 'bai-bai-preset-backup-body' }, [
                    h('div', { class: 'bai-bai-preset-backup-toolbar' }, [
                        h('label', { class: 'bai-bai-preset-backup-search' }, [
                            h('i', { class: 'fa-solid fa-magnifying-glass' }),
                            h('input', {
                                class: 'text_pole',
                                type: 'search',
                                autocomplete: 'off',
                                style: 'padding-left: 36px !important; background: transparent !important;',
                                placeholder: '\u641c\u7d22\u5907\u4efd\u9884\u8bbe',
                                value: this.query,
                                onInput: this.onSearchInput,
                                onCompositionstart: this.onSearchCompositionStart,
                                onCompositionend: this.onSearchCompositionEnd,
                            }),
                        ]),
                        h('button', {
                            class: {
                                menu_button: true,
                                menu_button_icon: true,
                                'bai-bai-preset-backup-batch-toggle': true,
                                'bai-bai-preset-backup-batch-active': this.selectionMode,
                            },
                            type: 'button',
                            title: this.selectionMode ? '\u9000\u51fa\u6279\u91cf\u7ba1\u7406' : '\u6279\u91cf\u7ba1\u7406',
                            disabled: this.loading || this.batchDeleting,
                            onClick: this.toggleSelectionMode,
                        }, [h('i', { class: 'fa-solid fa-list-check' })]),
                        h('button', {
                            class: {
                                menu_button: true,
                                menu_button_icon: true,
                                'bai-bai-preset-backup-refresh': true,
                                'bai-bai-preset-backup-refreshing': this.loading,
                            },
                            type: 'button',
                            title: '\u5237\u65b0\u5907\u4efd\u5217\u8868',
                            disabled: this.loading,
                            onClick: this.refresh,
                        }, [h('i', { class: 'fa-solid fa-rotate-right' })]),
                    ]),
                    this.hasLoaded ? h('div', {
                        class: 'bai-bai-preset-backup-counts',
                        'aria-live': 'polite',
                    }, [
                        h('span', `普通 ${this.items.length - this.protectedCount} 份`),
                        h('span', { title: '有备注的备份免自动清理，不占普通备份名额' }, [
                            h('i', { class: 'fa-solid fa-lock', 'aria-hidden': 'true' }),
                            ` 已保护 ${this.protectedCount} 份`,
                        ]),
                    ]) : null,
                    this.selectionMode ? renderPresetBackupSelectionBar(h, this) : null,
                    h('div', { class: 'bai-bai-preset-backup-list', role: 'list' }, this.pagedItems.length
                        ? this.pagedItems.map(item => renderPresetBackupPreviewItem(h, this, item))
                        : [h('div', { class: 'bai-bai-preset-backup-empty' }, this.hasLoaded
                            ? '\u6682\u65e0\u5907\u4efd\u6570\u636e'
                            : [
                                h('span', '\u5237\u65b0\u83b7\u53d6\u5907\u4efd\u6570\u636e'),
                                h('span', '\u4fdd\u5b58\u9884\u8bbe\u65f6\u81ea\u52a8\u521b\u5efa\u5907\u4efd'),
                            ])]),
                    h('div', { class: 'bai-bai-preset-backup-footer' }, [
                        h('div', { class: 'bai-bai-preset-backup-status' }, this.displayStatus),
                        h('div', { class: 'bai-bai-preset-backup-pagination', 'aria-label': '\u5907\u4efd\u5206\u9875' }, [
                            h('button', {
                                class: 'menu_button menu_button_icon',
                                type: 'button',
                                title: '\u4e0a\u4e00\u9875',
                                disabled: this.safePage <= 1 || this.filteredItems.length <= 0,
                                onClick: this.prevPage,
                            }, [h('i', { class: 'fa-solid fa-chevron-left' })]),
                            h('span', { class: 'bai-bai-preset-backup-page-label' }, `${this.safePage} / ${this.pageCount}`),
                            h('button', {
                                class: 'menu_button menu_button_icon',
                                type: 'button',
                                title: '\u4e0b\u4e00\u9875',
                                disabled: this.safePage >= this.pageCount || this.filteredItems.length <= 0,
                                onClick: this.nextPage,
                            }, [h('i', { class: 'fa-solid fa-chevron-right' })]),
                        ]),
                    ]),
                    this.renameDialogOpen ? renderPresetBackupRenameDialog(h, this) : null,
                    this.noteDialogOpen ? renderPresetBackupNoteDialog(h, this) : null,
                    this.deleteDialogOpen ? renderPresetBackupDeleteDialog(h, this) : null,
                ]),
            ]);
        },
    };
}

function renderPresetBackupPreviewItem(h, view, item) {
    const selectionMode = view.selectionMode;
    const selected = selectionMode && view.selectedFileNames.includes(item.fileName);

    return h('div', {
        key: item.id,
        class: {
            'bai-bai-preset-backup-item': true,
            'bai-bai-preset-backup-item-selectable': selectionMode,
            'bai-bai-preset-backup-item-selected': selected,
        },
        role: 'listitem',
        onClick: selectionMode ? () => view.toggleSelect(item) : undefined,
    }, [
        selectionMode
            ? h('span', {
                class: {
                    'bai-bai-preset-backup-item-check': true,
                    'bai-bai-preset-backup-item-check-on': selected,
                },
            }, [h('i', { class: selected ? 'fa-solid fa-square-check' : 'fa-regular fa-square' })])
            : null,
        h('div', { class: 'bai-bai-preset-backup-item-main' }, [
            h('div', { class: 'bai-bai-preset-backup-item-row bai-bai-preset-backup-item-row-top' }, [
                h('strong', {
                    class: 'bai-bai-preset-backup-item-name',
                    title: item.name,
                }, item.name),
                selectionMode ? null : h('div', { class: 'bai-bai-preset-backup-item-actions' }, [
                    renderPresetBackupPreviewActionButton(h, {
                        className: 'bai-bai-preset-backup-delete',
                        icon: 'fa-solid fa-trash',
                        title: '\u5220\u9664\u5907\u4efd',
                        onClick: () => view.openDeleteDialog(item),
                    }),
                    renderPresetBackupPreviewActionButton(h, {
                        icon: 'fa-solid fa-pen-to-square',
                        title: '\u91cd\u547d\u540d\u5907\u4efd',
                        onClick: () => view.openRenameDialog(item),
                    }),
                    renderPresetBackupPreviewActionButton(h, {
                        className: view.importingFileName === item.fileName ? 'bai-bai-preset-backup-importing' : '',
                        icon: view.importingFileName === item.fileName ? 'fa-solid fa-spinner' : 'fa-solid fa-download',
                        title: '\u5bfc\u5165\u5907\u4efd\u5e76\u5207\u6362',
                        disabled: Boolean(view.importingFileName),
                        onClick: () => view.importBackup(item),
                    }),
                ]),
            ]),
            h('div', { class: 'bai-bai-preset-backup-item-row bai-bai-preset-backup-item-meta' }, [
                h('small', { class: 'bai-bai-preset-backup-item-time' }, [
                    h('i', { class: 'fa-regular fa-clock' }),
                    h('span', item.createdAt),
                ]),
                renderPresetBackupPreviewNote(h, view, item),
            ]),
        ]),
    ]);
}

function renderPresetBackupSelectionBar(h, view) {
    return h('div', { class: 'bai-bai-preset-backup-selection-bar' }, [
        h('button', {
            class: 'bai-bai-preset-backup-select-all',
            type: 'button',
            disabled: view.batchDeleting || view.pagedItems.length <= 0,
            onClick: () => view.toggleSelectPage(),
        }, [
            h('i', { class: view.pageAllSelected ? 'fa-solid fa-square-check' : 'fa-regular fa-square' }),
            h('span', view.pageAllSelected ? '\u53d6\u6d88\u672c\u9875' : '\u5168\u9009\u672c\u9875'),
        ]),
        h('span', { class: 'bai-bai-preset-backup-selection-count' }, `\u5df2\u9009 ${view.selectedCount} \u9879`),
        h('div', { class: 'bai-bai-preset-backup-selection-actions' }, [
            h('button', {
                class: 'menu_button bai-bai-preset-backup-dialog-button',
                type: 'button',
                disabled: view.batchDeleting,
                onClick: () => view.exitSelectionMode(),
            }, '\u9000\u51fa'),
            h('button', {
                class: 'menu_button bai-bai-preset-backup-dialog-button bai-bai-preset-backup-dialog-danger',
                type: 'button',
                disabled: view.batchDeleting || view.selectedCount <= 0,
                onClick: () => view.openBatchDeleteDialog(),
            }, [
                h('i', { class: 'fa-solid fa-trash' }),
                h('span', view.batchDeleting ? '\u5220\u9664\u4e2d...' : `\u5220\u9664\u6240\u9009 (${view.selectedCount})`),
            ]),
        ]),
    ]);
}

function renderPresetBackupPreviewNote(h, view, item) {
    const hasNote = Boolean(item.note);
    const onClick = event => {
        if (view.selectionMode) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        view.openNoteDialog(item);
    };

    if (hasNote) {
        return h('button', {
            type: 'button',
            class: 'bai-bai-preset-backup-item-note',
            title: `${item.note}\n已保护，免自动清理（点击编辑备注）`,
            onClick,
        }, [
            h('i', { class: 'fa-solid fa-lock' }),
            h('span', { class: 'bai-bai-preset-backup-item-note-text' }, item.note),
        ]);
    }

    return h('button', {
        type: 'button',
        class: 'bai-bai-preset-backup-item-note bai-bai-preset-backup-item-note-empty',
        title: '添加备注并保护备份，免自动清理',
        onClick,
    }, [
        h('i', { class: 'fa-solid fa-plus' }),
        h('span', '备注'),
    ]);
}

function renderPresetBackupNoteDialog(h, view) {
    const targetName = view.noteTarget?.name || '这个备份';
    const length = view.noteValue.length;

    return h('div', {
        class: 'bai-bai-preset-backup-dialog-layer',
        onClick: event => {
            if (event.target === event.currentTarget) {
                view.closeNoteDialog();
            }
        },
    }, [
        h('div', {
            class: 'bai-bai-preset-backup-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': '编辑备注',
            onClick: event => event.stopPropagation(),
        }, [
            h('div', { class: 'bai-bai-preset-backup-dialog-head' }, [
                h('strong', '编辑备注'),
                h('button', {
                    class: 'menu_button menu_button_icon',
                    type: 'button',
                    title: '关闭',
                    disabled: view.savingNote,
                    onClick: () => view.closeNoteDialog(),
                }, [h('i', { class: 'fa-solid fa-xmark' })]),
            ]),
            h('div', { class: 'bai-bai-preset-backup-dialog-message' }, [
                h('span', '为'),
                h('strong', { title: targetName }, targetName),
                h('span', '记录这次改动'),
            ]),
            h('textarea', {
                ref: 'noteInput',
                class: 'text_pole bai-bai-preset-backup-dialog-input bai-bai-preset-backup-note-textarea',
                rows: 4,
                maxlength: PRESET_BACKUP_PREVIEW_NOTE_MAX_LENGTH,
                placeholder: '例如：改了正则和开场白，删了两条无用条目…',
                autocomplete: 'off',
                value: view.noteValue,
                disabled: view.savingNote,
                onInput: view.onNoteInput,
                onCompositionstart: view.onNoteCompositionStart,
                onCompositionend: view.onNoteCompositionEnd,
            }),
            h('div', { class: 'bai-bai-preset-backup-note-counter' }, `${length} / ${PRESET_BACKUP_PREVIEW_NOTE_MAX_LENGTH}`),
            h('div', { class: 'bai-bai-preset-backup-dialog-actions' }, [
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button',
                    type: 'button',
                    disabled: view.savingNote,
                    onClick: () => view.closeNoteDialog(),
                }, '取消'),
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button',
                    type: 'button',
                    disabled: view.savingNote,
                    onClick: () => view.confirmNote(),
                }, view.savingNote ? '保存中...' : '保存'),
            ]),
        ]),
    ]);
}

function renderPresetBackupDeleteDialog(h, view) {
    const isBatch = !view.deleteTarget && view.selectionMode;
    const targetName = view.deleteTarget?.name || '\u8fd9\u4e2a\u5907\u4efd';
    const busy = isBatch ? view.batchDeleting : view.deleting;

    return h('div', {
        class: 'bai-bai-preset-backup-dialog-layer',
        onClick: event => {
            if (event.target === event.currentTarget) {
                view.closeDeleteDialog();
            }
        },
    }, [
        h('div', {
            class: 'bai-bai-preset-backup-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': '\u5220\u9664\u5907\u4efd',
            onClick: event => event.stopPropagation(),
        }, [
            h('div', { class: 'bai-bai-preset-backup-dialog-head' }, [
                h('strong', isBatch ? '\u6279\u91cf\u5220\u9664\u5907\u4efd' : '\u5220\u9664\u5907\u4efd'),
                h('button', {
                    class: 'menu_button menu_button_icon',
                    type: 'button',
                    title: '\u5173\u95ed',
                    disabled: busy,
                    onClick: () => view.closeDeleteDialog(),
                }, [h('i', { class: 'fa-solid fa-xmark' })]),
            ]),
            isBatch
                ? h('div', { class: 'bai-bai-preset-backup-dialog-message' }, [
                    h('span', `\u786e\u5b9a\u8981\u5220\u9664\u9009\u4e2d\u7684 ${view.selectedCount} \u4e2a\u5907\u4efd\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u6062\u590d\u3002`),
                ])
                : h('div', { class: 'bai-bai-preset-backup-dialog-message' }, [
                    h('span', '\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u5907\u4efd\u5417\uff1f'),
                    h('strong', { title: targetName }, targetName),
                ]),
            h('div', { class: 'bai-bai-preset-backup-dialog-actions' }, [
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button',
                    type: 'button',
                    disabled: busy,
                    onClick: () => view.closeDeleteDialog(),
                }, '\u53d6\u6d88'),
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button bai-bai-preset-backup-dialog-danger',
                    type: 'button',
                    disabled: busy,
                    onClick: () => (isBatch ? view.confirmBatchDelete() : view.confirmDelete()),
                }, busy ? '\u5220\u9664\u4e2d...' : '\u5220\u9664'),
            ]),
        ]),
    ]);
}

function renderPresetBackupRenameDialog(h, view) {
    return h('div', {
        class: 'bai-bai-preset-backup-dialog-layer',
        onClick: event => {
            if (event.target === event.currentTarget) {
                view.closeRenameDialog();
            }
        },
    }, [
        h('div', {
            class: 'bai-bai-preset-backup-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': '\u91cd\u547d\u540d\u5907\u4efd',
            onClick: event => event.stopPropagation(),
        }, [
            h('div', { class: 'bai-bai-preset-backup-dialog-head' }, [
                h('strong', '\u91cd\u547d\u540d\u5907\u4efd'),
                h('button', {
                    class: 'menu_button menu_button_icon',
                    type: 'button',
                    title: '\u5173\u95ed',
                    disabled: view.renaming,
                    onClick: () => view.closeRenameDialog(),
                }, [h('i', { class: 'fa-solid fa-xmark' })]),
            ]),
            h('input', {
                ref: 'renameInput',
                class: 'text_pole bai-bai-preset-backup-dialog-input',
                type: 'text',
                autocomplete: 'off',
                value: view.renameValue,
                disabled: view.renaming,
                onInput: view.onRenameInput,
                onCompositionstart: view.onRenameCompositionStart,
                onCompositionend: view.onRenameCompositionEnd,
                onKeydown: view.onRenameKeydown,
            }),
            h('div', { class: 'bai-bai-preset-backup-dialog-actions' }, [
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button',
                    type: 'button',
                    disabled: view.renaming,
                    onClick: () => view.closeRenameDialog(),
                }, '\u53d6\u6d88'),
                h('button', {
                    class: 'menu_button bai-bai-preset-backup-dialog-button',
                    type: 'button',
                    disabled: view.renaming || !view.renameValue.trim(),
                    onClick: () => view.confirmRename(),
                }, view.renaming ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'),
            ]),
        ]),
    ]);
}

function renderPresetBackupPreviewActionButton(h, { className = '', icon, title, disabled = false, onClick }) {
    return h('button', {
        class: ['menu_button', 'menu_button_icon', className],
        type: 'button',
        title,
        disabled,
        onClick,
    }, [h('i', { class: icon })]);
}

async function fetchPresetBackupPreviewItems() {
    const rawItems = await fetchPresetBackupItems();
    return rawItems
        .map(normalizePresetBackupPreviewItem)
        .filter(Boolean);
}

async function renamePresetBackupPreviewItem(fileName, showName) {
    const response = await fetch(PRESET_BACKUP_PREVIEW_RENAME_URL, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ fileName, showName }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload?.data ?? payload;
}

async function updatePresetBackupPreviewNote(fileName, note) {
    return runPresetBackupMutation(async () => {
        const response = await fetch(PRESET_BACKUP_PREVIEW_NOTE_URL, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ fileName, note }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (payload?.ok === false || payload?.error) throw new Error('Backup note was not saved');
        return payload?.data ?? payload;
    });
}

async function deletePresetBackupPreviewItem(fileName) {
    // Wait for the active automatic pass without serializing manual batch workers.
    await runPresetBackupMutation(() => {});
    return deletePresetBackupFile(fileName);
}

async function downloadPresetBackupPreviewItem(fileName) {
    const response = await fetch(PRESET_BACKUP_PREVIEW_DOWNLOAD_URL, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ fileName }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload?.data ?? payload;
}

function normalizePresetBackupImportPayload(result, item) {
    const body = result?.body && typeof result.body === 'object' ? result.body : result;
    const apiId = typeof body?.apiId === 'string' && body.apiId.trim() ? body.apiId.trim() : 'openai';
    const preset = body?.preset && typeof body.preset === 'object' ? body.preset : body;
    const resultShowName = typeof result?.showName === 'string' && result.showName !== result?.fileName
        ? result.showName
        : '';
    const name = String(
        resultShowName
        || body?.name
        || item?.name
        || formatPresetBackupPreviewDisplayName(item?.fileName || ''),
    ).trim();

    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
        throw new Error('Invalid preset backup data');
    }

    return {
        apiId,
        name: name || '\u5907\u4efd\u9884\u8bbe',
        preset: clonePresetBackupImportPreset(preset),
    };
}

function clonePresetBackupImportPreset(preset) {
    if (typeof structuredClone === 'function') {
        return structuredClone(preset);
    }

    return JSON.parse(JSON.stringify(preset));
}

function getUniquePresetBackupImportName(manager, name) {
    const baseName = String(name || '\u5907\u4efd\u9884\u8bbe').trim() || '\u5907\u4efd\u9884\u8bbe';
    const existingNames = typeof manager.getAllPresets === 'function'
        ? manager.getAllPresets().map(value => String(value))
        : [];
    const existing = new Set(existingNames);

    if (!existing.has(baseName)) {
        return baseName;
    }

    for (let index = 1; index <= 999; index += 1) {
        const nextName = `${baseName} ${index}`;

        if (!existing.has(nextName)) {
            return nextName;
        }
    }

    return `${baseName} ${Date.now()}`;
}

function normalizePresetBackupPreviewItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const fileName = String(item.fileName || item.name || '').trim();

    if (!fileName) {
        return null;
    }

    const rawName = String(item.showName || item.displayName || item.presetName || '').trim();
    const name = rawName && rawName !== fileName
        ? rawName
        : formatPresetBackupPreviewDisplayName(fileName);
    const createdAt = formatPresetBackupPreviewTime(item.createdAt ?? item.createdAtMs);
    const note = typeof item.note === 'string' ? item.note.trim() : '';

    return {
        id: fileName,
        name,
        fileName,
        note,
        createdAt,
        searchText: `${name} ${note} ${createdAt}`.toLowerCase(),
    };
}

function formatPresetBackupPreviewDisplayName(fileName) {
    const withoutExtension = String(fileName || '').replace(/\.json$/i, '');
    const timestampNameMatch = /^\d{8}_\d{6}__(.+)$/.exec(withoutExtension);

    if (timestampNameMatch?.[1]) {
        return timestampNameMatch[1];
    }

    return withoutExtension || String(fileName || '');
}

function formatPresetBackupPreviewTime(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toLocaleString();
    }

    if (typeof value === 'string' && value.trim()) {
        const date = new Date(value);

        if (Number.isFinite(date.getTime())) {
            return date.toLocaleString();
        }

        return value.trim();
    }

    return '\u65f6\u95f4\u672a\u77e5';
}

function togglePresetBackupPreviewDetails(details, model = null) {
    const summary = details?.querySelector?.('.bai-bai-preset-backup-summary');

    if (!(details instanceof HTMLDetailsElement) || !(summary instanceof HTMLElement)) {
        if (details instanceof HTMLDetailsElement) {
            details.open = !details.open;
        }
        return;
    }

    const shouldReduceMotion = typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (shouldReduceMotion || typeof details.animate !== 'function') {
        details.open = !details.open;
        return;
    }

    if (model?.animating) {
        return;
    }

    const isClosing = details.open;

    if (model) {
        model.animating = true;
        model.closing = isClosing;
    }

    details.style.overflow = 'hidden';

    const startHeight = details.offsetHeight;
    const endHeight = isClosing ? summary.offsetHeight : (() => {
        details.style.height = `${startHeight}px`;
        details.open = true;
        return details.scrollHeight;
    })();

    details.style.height = `${startHeight}px`;

    const animation = details.animate(
        { height: [`${startHeight}px`, `${endHeight}px`] },
        {
            duration: PRESET_BACKUP_PREVIEW_EXPAND_ANIMATION_MS,
            easing: 'ease',
        },
    );

    const cleanup = () => {
        details.style.height = '';
        details.style.overflow = '';

        if (model) {
            model.animating = false;
            model.closing = false;
        }
    };

    animation.onfinish = () => {
        if (startHeight > endHeight) {
            details.open = false;
        }

        cleanup();
    };

    animation.oncancel = cleanup;
}
function applyPresetBackupPreviewUiStyle() {
    let style = document.getElementById(PRESET_BACKUP_PREVIEW_UI_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = PRESET_BACKUP_PREVIEW_UI_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#${PRESET_BACKUP_PREVIEW_UI_ID} {
    box-sizing: border-box;
    margin: 0 0 8px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} *,
#${PRESET_BACKUP_PREVIEW_UI_ID} *::before,
#${PRESET_BACKUP_PREVIEW_UI_ID} *::after {
    box-sizing: border-box;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-details {
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 40%, transparent);
    overflow: hidden;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 38px;
    padding: 8px 10px;
    cursor: pointer;
    list-style: none;
    user-select: none;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-summary::-webkit-details-marker {
    display: none;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-title,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-summary-meta {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 6px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-title {
    font-weight: 700;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-title i {
    color: var(--SmartThemeQuoteColor);
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-summary-meta {
    flex: 0 0 auto;
    opacity: 0.72;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-chevron {
    transition: transform 0.16s ease;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} details[open]:not(.${PRESET_BACKUP_PREVIEW_CLOSING_CLASS}) .bai-bai-preset-backup-chevron {
    transform: rotate(90deg);
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 10px 10px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-search {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-search i {
    position: absolute;
    left: 12px;
    z-index: 1;
    opacity: 0.62;
    pointer-events: none;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-search input.text_pole[type="search"] {
    width: 100%;
    min-width: 0;
    padding-left: 36px !important;
    background: transparent !important;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-refresh {
    flex: 0 0 auto;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-refreshing i {
    animation: bai-bai-preset-backup-spin 0.45s linear infinite;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-importing i {
    animation: bai-bai-preset-backup-spin 0.55s linear infinite;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 2px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    min-width: 0;
    font-size: 0.86em;
    opacity: 0.8;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 7px 8px;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 6px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item[hidden],
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-empty[hidden] {
    display: none !important;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 auto;
    min-width: 0;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-row-top {
    justify-content: space-between;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-name {
    display: block;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.25;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-meta {
    gap: 8px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
    opacity: 0.72;
    line-height: 1.2;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1 1 auto;
    margin: 0;
    padding: 1px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    color: inherit;
    font-size: 0.86em;
    line-height: 1.2;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note:hover {
    background: var(--white20a, rgba(255, 255, 255, 0.08));
    border-color: var(--SmartThemeBorderColor);
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note i {
    flex: 0 0 auto;
    opacity: 0.75;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note-empty {
    opacity: 0.5;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-note-empty:hover {
    opacity: 0.85;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-note-textarea {
    width: 100%;
    resize: vertical;
    min-height: calc(var(--mainFontSize) * 4.5);
    line-height: 1.4;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-note-counter {
    margin-top: -2px;
    font-size: 0.8em;
    text-align: right;
    opacity: 0.6;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-batch-active {
    color: var(--SmartThemeQuoteColor, #6c9eff);
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-selection-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px;
    margin-bottom: 2px;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 6px;
    background: var(--black30a, rgba(0, 0, 0, 0.12));
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-select-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    margin: 0;
    background: transparent;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 5px;
    color: inherit;
    cursor: pointer;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-select-all:disabled {
    opacity: 0.5;
    cursor: default;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-selection-count {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.86em;
    opacity: 0.8;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-selection-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-selection-actions .menu_button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-selectable {
    cursor: pointer;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-selected {
    border-color: var(--SmartThemeQuoteColor, #6c9eff);
    background: var(--white20a, rgba(255, 255, 255, 0.06));
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    font-size: 1.1em;
    opacity: 0.7;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-check-on {
    color: var(--SmartThemeQuoteColor, #6c9eff);
    opacity: 1;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-actions {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 4px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-item-actions .menu_button,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-refresh,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-batch-toggle,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-pagination .menu_button,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-head .menu_button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    inline-size: calc(var(--mainFontSize) * 1.8) !important;
    block-size: calc(var(--mainFontSize) * 1.8) !important;
    min-inline-size: calc(var(--mainFontSize) * 1.8) !important;
    min-block-size: calc(var(--mainFontSize) * 1.8) !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-delete {
    color: #d86666;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 64px;
    padding: 10px;
    border: 1px dashed var(--SmartThemeBorderColor);
    border-radius: 6px;
    text-align: center;
    opacity: 0.72;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: calc(var(--mainFontSize) * 1.8);
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-status {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.86em;
    opacity: 0.72;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    gap: 8px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-page-label {
    min-width: 4.6em;
    text-align: center;
    font-size: 0.9em;
    opacity: 0.78;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-layer {
    position: absolute;
    inset: 0;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 10px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 46%, transparent);
    backdrop-filter: blur(2px);
    animation: bai-bai-preset-backup-layer-in 0.14s ease both;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(100%, 360px);
    padding: 12px;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: var(--SmartThemeBlurTintColor);
    box-shadow: 0 12px 32px color-mix(in srgb, #000 28%, transparent);
    animation: bai-bai-preset-backup-dialog-in 0.18s ease both;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-head,
#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-input {
    width: 100%;
    min-width: 0;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-message {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    line-height: 1.35;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-message strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-actions {
    justify-content: flex-end;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 auto !important;
    min-width: 4.8em !important;
    width: auto !important;
    max-width: none !important;
    min-height: calc(var(--mainFontSize) * 2) !important;
    padding: 0 12px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    writing-mode: horizontal-tb !important;
}

#${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-danger {
    color: #d86666 !important;
}

@keyframes bai-bai-preset-backup-spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

@keyframes bai-bai-preset-backup-layer-in {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes bai-bai-preset-backup-dialog-in {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@media (max-width: 600px) {
    #${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog-layer {
        position: fixed;
        inset: 0;
        min-height: 100dvh;
        padding: 18px;
        background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 60%, transparent);
    }

    #${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-dialog {
        width: min(100%, 420px);
    }

    #${PRESET_BACKUP_PREVIEW_UI_ID} .bai-bai-preset-backup-footer {
        gap: 6px;
    }
}
`;
}

export {
    applyPresetBackupPreviewUi,
    applyPresetBackupPreviewUiStyle,
    clonePresetBackupImportPreset,
    createPresetBackupPreviewModel,
    createPresetBackupPreviewRootComponent,
    deletePresetBackupPreviewItem,
    downloadPresetBackupPreviewItem,
    fetchPresetBackupPreviewItems,
    formatPresetBackupPreviewDisplayName,
    formatPresetBackupPreviewTime,
    getUniquePresetBackupImportName,
    insertPresetBackupPreviewUi,
    installPresetBackupPreviewUiObserver,
    mountPresetBackupPreviewVueApp,
    normalizePresetBackupImportPayload,
    normalizePresetBackupPreviewItem,
    renamePresetBackupPreviewItem,
    renderPresetBackupDeleteDialog,
    renderPresetBackupNoteDialog,
    renderPresetBackupPreviewActionButton,
    renderPresetBackupPreviewItem,
    renderPresetBackupPreviewNote,
    renderPresetBackupRenameDialog,
    renderPresetBackupSelectionBar,
    togglePresetBackupPreviewDetails,
    updatePresetBackupPreviewNote,
};
