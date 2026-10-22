// 楼层管理器 (Floor Directory)
// 在酒馆 #extensionsMenu 注入一个按钮，点开后弹出"楼栋目录"窗口：
//   - 命令栏输入纯数字 → 定位到该楼层
//   - 输入其它文字 → 关键词搜索楼层
//   - 点击结果行 → 就地展开该楼完整格式化内容（仅窗口内查看，不跳转真实聊天）
//
// 本模块刻意不静态 import 任何酒馆模块，所有数据/函数都在运行时从
// globalThis.SillyTavern.getContext() 取，以规避版本兼容问题。

import { captureFloorShot, configureFloorShot, downloadBlob } from './floorShot.js';

let settings = {};
let extensionState = {};
let LOG_PREFIX = '[FloorDirectory]';

const MENU_BUTTON_ID = 'bai_bai_toolkit_floor_directory_button';
const MENU_CONTAINER_ID = 'bai_bai_toolkit_floor_directory_wand_container';
const STYLE_ID = 'bai_bai_toolkit_floor_directory_style';
const OVERLAY_CLASS = 'bai-bai-floor-overlay';
const INSTALL_GUARD_KEY = '__baiBaiToolkitFloorDirectoryInstalled';

const SNIPPET_RADIUS = 48; // 关键词命中处前后保留的字符数
const MAX_PREVIEW_LENGTH = 140; // 行内片段预览最大长度
const PAGE_SIZE = 30; // 每页楼层数

export function configureFloorDirectory(context = {}) {
    settings = context.settings ?? settings;
    extensionState = context.extensionState ?? extensionState;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    configureFloorShot({ logPrefix: LOG_PREFIX });
}

// ---------------------------------------------------------------------------
// 自写小工具（不从 utils.js 引入）
// ---------------------------------------------------------------------------

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 只给列表预览用：从楼层原始文本隐藏思维块，保留其它原始文本/标签。
function stripThinkingBlocks(value) {
    // return String(value ?? '')
    //     .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gmi, '')
    //     .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gmi, '')
    //     .trim();

    return String(value ?? '')
        .replace(/<think[ing]*>[\s\S]*?<\/think[ing]*>/gmi, '')
        .trim();
}

function buildPreviewText(message) {
    return stripThinkingBlocks(typeof message?.mes === 'string' ? message.mes : '');
}

function renderPreviewTextHtml(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

// 在转义后的纯文本上高亮命中词。先把 keyword 同样转义，确保与转义文本匹配。
function highlightHtml(plainText, keyword) {
    const safeText = escapeHtml(plainText);
    if (!keyword) {
        return safeText;
    }
    const safeKeyword = escapeHtml(keyword);
    const pattern = new RegExp(escapeRegExp(safeKeyword), 'gi');
    return safeText.replace(pattern, match => `<mark class="bai-bai-floor-hit">${match}</mark>`);
}

function toastSuccess(message) {
    if (globalThis.toastr?.success) {
        globalThis.toastr.success(message);
    } else {
        console.info(`${LOG_PREFIX} ${message}`);
    }
}

function toastInfo(message, options) {
    if (globalThis.toastr?.info) {
        globalThis.toastr.info(message, '', options);
    } else {
        console.info(`${LOG_PREFIX} ${message}`);
    }
}

/** 等下一帧真正画出来：rAF 回调跑在本帧绘制之前，在里面再排的宏任务要等本帧提交之后才执行 */
function waitForNextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function toastWarning(message) {
    if (globalThis.toastr?.warning) {
        globalThis.toastr.warning(message);
    } else {
        console.warn(`${LOG_PREFIX} ${message}`);
    }
}

function toastError(message) {
    if (globalThis.toastr?.error) {
        globalThis.toastr.error(message);
    } else {
        console.error(`${LOG_PREFIX} ${message}`);
    }
}

function debounce(fn, delayMs) {
    let timer = null;
    return function debounced(...args) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, delayMs);
    };
}

// 截取以关键词为中心的片段，便于在窄行里看到命中上下文。
function buildSnippet(plainText, keyword) {
    if (!plainText) {
        return '';
    }
    if (!keyword) {
        return plainText.length > MAX_PREVIEW_LENGTH
            ? `${plainText.slice(0, MAX_PREVIEW_LENGTH)}…`
            : plainText;
    }
    const lower = plainText.toLowerCase();
    const index = lower.indexOf(keyword.toLowerCase());
    if (index < 0) {
        return plainText.length > MAX_PREVIEW_LENGTH
            ? `${plainText.slice(0, MAX_PREVIEW_LENGTH)}…`
            : plainText;
    }
    const start = Math.max(0, index - SNIPPET_RADIUS);
    const end = Math.min(plainText.length, index + keyword.length + SNIPPET_RADIUS);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < plainText.length ? '…' : '';
    return `${prefix}${plainText.slice(start, end)}${suffix}`;
}

// 是否处于移动端窄屏布局：与样式里的 @media (max-width: 600px) 断点保持一致，
// 用于决定楼层排序方向（移动端正序：旧楼在上、最新在底）与默认翻到的页。
function isMobileViewport() {
    return Boolean(window.matchMedia?.('(max-width: 600px)')?.matches);
}

// ---------------------------------------------------------------------------
// 运行时取酒馆上下文
// ---------------------------------------------------------------------------

function getStContext() {
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch (error) {
        console.debug(`${LOG_PREFIX} getContext failed`, error);
        return null;
    }
}

function getChatArray(ctx) {
    return Array.isArray(ctx?.chat) ? ctx.chat : [];
}

function getSpeakerName(ctx, message) {
    if (message?.name) {
        return String(message.name);
    }
    if (message?.is_user) {
        return String(ctx?.name1 ?? '我');
    }
    return String(ctx?.name2 ?? '角色');
}

// 把一条消息渲染成展示用 HTML；messageFormatting 缺失时回退为转义纯文本。
function renderMessageHtml(ctx, message, messageId) {
    const raw = typeof message?.mes === 'string' ? message.mes : '';
    const fn = ctx?.messageFormatting;
    if (typeof fn === 'function') {
        try {
            const name = getSpeakerName(ctx, message);
            const html = fn(raw, name, Boolean(message?.is_system), Boolean(message?.is_user), messageId);
            if (typeof html === 'string' && html.trim()) {
                return html;
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} messageFormatting failed`, error);
        }
    }
    return escapeHtml(raw).replace(/\n/g, '<br>');
}

// 把编辑后的文本写回指定楼层并持久化。
// 复刻酒馆 messageEditDone 的关键步骤：写 mes + 同步当前 swipe → 标记 tainted →
// 触发 MESSAGE_EDITED/MESSAGE_UPDATED → 刷新在屏 DOM → saveChat。
// 刻意按"所见即所存"保存原始文本，不跑酒馆内联编辑器的正则/宏/bias 后处理
// （那条管线无法经 getContext() 干净复用，且会让用户的宏被意外展开）。
async function saveFloorEdit(ctx, index, newText) {
    const chat = getChatArray(ctx);
    const message = chat[index];
    if (!message) {
        throw new Error('楼层不存在');
    }

    const text = String(newText ?? '');
    message.mes = text;
    // 与当前 swipe 同步，否则切换 swipe 会覆盖刚保存的内容。
    if (message.swipe_id !== undefined && Array.isArray(message.swipes) && message.swipes[message.swipe_id] !== undefined) {
        message.swipes[message.swipe_id] = text;
    }

    if (ctx?.chatMetadata && typeof ctx.chatMetadata === 'object') {
        ctx.chatMetadata.tainted = true;
    }

    const eventTypes = ctx?.eventTypes ?? ctx?.event_types;
    const emit = ctx?.eventSource?.emit;
    if (typeof emit === 'function' && eventTypes) {
        try {
            if (eventTypes.MESSAGE_EDITED) {
                await emit.call(ctx.eventSource, eventTypes.MESSAGE_EDITED, index);
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} MESSAGE_EDITED emit failed`, error);
        }
    }

    // 若该楼层正显示在聊天里，刷新它的 DOM。
    if (typeof ctx?.updateMessageBlock === 'function'
        && document.querySelector(`#chat .mes[mesid="${index}"]`)) {
        try {
            ctx.updateMessageBlock(index, message);
        } catch (error) {
            console.debug(`${LOG_PREFIX} updateMessageBlock failed`, error);
        }
    }

    if (typeof emit === 'function' && eventTypes) {
        try {
            if (eventTypes.MESSAGE_UPDATED) {
                await emit.call(ctx.eventSource, eventTypes.MESSAGE_UPDATED, index);
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} MESSAGE_UPDATED emit failed`, error);
        }
    }

    const saveChat = ctx?.saveChat;
    if (typeof saveChat !== 'function') {
        throw new Error('无法保存：当前酒馆版本未暴露保存接口');
    }
    await saveChat();
}

async function confirmFloorDelete(ctx, index, deleteCount) {
    const message = `将删除第 ${index} 层及之后的楼层，删除后无法撤销。确定继续吗？`;
    if (typeof ctx?.callGenericPopup === 'function' && ctx?.POPUP_TYPE && 'CONFIRM' in ctx.POPUP_TYPE) {
        return Boolean(await ctx.callGenericPopup(message, ctx.POPUP_TYPE.CONFIRM));
    }
    return Boolean(globalThis.confirm?.(message));
}

async function deleteFloorRangeWithSlashCommand(ctx, index, options = {}) {
    const chat = getChatArray(ctx);
    if (!chat[index]) {
        throw new Error('楼层不存在');
    }

    const deleteCount = chat.length - index;
    if (deleteCount < 1) {
        return 0;
    }

    const executeSlashCommandsWithOptions = ctx?.executeSlashCommandsWithOptions;
    if (typeof executeSlashCommandsWithOptions !== 'function') {
        throw new Error('无法删除：当前酒馆版本未暴露斜杠命令执行接口');
    }

    const confirmed = await confirmFloorDelete(ctx, index, deleteCount);
    if (!confirmed) {
        return 0;
    }

    if (typeof options.onConfirmed === 'function') {
        options.onConfirmed(deleteCount);
    }

    const result = await executeSlashCommandsWithOptions(`/del ${deleteCount}`, {
        handleExecutionErrors: true,
        source: 'floor-directory',
    });

    if (result?.isError) {
        throw new Error(result.errorMessage || '斜杠删除命令执行失败');
    }

    return deleteCount;
}

// 用 ST 的 /hide、/unhide 斜杠命令切换单层的隐藏状态（is_system）。
async function toggleFloorHiddenWithSlashCommand(ctx, index) {
    const chat = getChatArray(ctx);
    const message = chat[index];
    if (!message) {
        throw new Error('楼层不存在');
    }

    const executeSlashCommandsWithOptions = ctx?.executeSlashCommandsWithOptions;
    if (typeof executeSlashCommandsWithOptions !== 'function') {
        throw new Error('当前酒馆版本未暴露斜杠命令执行接口');
    }

    const willHide = !message.is_system;
    const command = willHide ? `/hide ${index}` : `/unhide ${index}`;
    const result = await executeSlashCommandsWithOptions(command, {
        handleExecutionErrors: true,
        source: 'floor-directory',
    });

    if (result?.isError) {
        throw new Error(result.errorMessage || '斜杠命令执行失败');
    }

    return willHide;
}

// ---------------------------------------------------------------------------
// 菜单按钮注入
// ---------------------------------------------------------------------------

export function installFloorDirectory() {
    if (window[INSTALL_GUARD_KEY]) {
        return;
    }

    ensureStyle();

    let attempts = 0;
    const tryInject = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) {
            attempts += 1;
            if (attempts <= 40) {
                setTimeout(tryInject, 500);
            }
            return;
        }

        if (document.getElementById(MENU_BUTTON_ID)) {
            window[INSTALL_GUARD_KEY] = true;
            return;
        }

        const container = document.createElement('div');
        container.id = MENU_CONTAINER_ID;
        container.className = 'extension_container';

        const button = document.createElement('div');
        button.id = MENU_BUTTON_ID;
        button.className = 'list-group-item flex-container flexGap5';
        button.tabIndex = 0;
        button.setAttribute('role', 'button');

        const icon = document.createElement('div');
        icon.className = 'fa-solid fa-building extensionsMenuExtensionButton';

        const label = document.createElement('span');
        label.textContent = '楼层管理器';

        button.append(icon, label);
        container.appendChild(button);
        menu.appendChild(container);

        // 点击会冒泡到酒馆绑定在 html 上的处理器，魔棒菜单会自动收起，无需手动隐藏。
        const open = () => openFloorDirectoryDialog();
        button.addEventListener('click', open);
        button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });

        window[INSTALL_GUARD_KEY] = true;
        console.debug(`${LOG_PREFIX} Floor directory button installed`);
    };

    tryInject();
}

// ---------------------------------------------------------------------------
// 弹窗
// ---------------------------------------------------------------------------

function openFloorDirectoryDialog() {
    // 同一时刻只允许一个弹窗。
    document.querySelector(`.${OVERLAY_CLASS}`)?.remove();

    const ctx = getStContext();
    let chat = getChatArray(ctx);

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;

    const dialog = document.createElement('div');
    dialog.className = 'bai-bai-floor-dialog';
    dialog.tabIndex = -1;

    // ---- 头部 ----
    const head = document.createElement('div');
    head.className = 'bai-bai-floor-head';

    const title = document.createElement('div');
    title.className = 'bai-bai-floor-title';
    title.textContent = '楼层管理器';

    const count = document.createElement('div');
    count.className = 'bai-bai-floor-count';
    count.textContent = chat.length ? `共 ${chat.length} 层` : '暂无楼层';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'bai-bai-floor-close';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    head.append(title, count, closeButton);

    // ---- 命令栏 ----
    const bar = document.createElement('div');
    bar.className = 'bai-bai-floor-bar';

    const barIcon = document.createElement('i');
    barIcon.className = 'fa-solid fa-magnifying-glass bai-bai-floor-bar-icon';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bai-bai-floor-input';
    input.placeholder = '输入楼层号 / 关键词…';
    input.setAttribute('aria-label', '输入楼层号或关键词');

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'bai-bai-floor-clear';
    clearButton.setAttribute('aria-label', '清空');
    clearButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    clearButton.disabled = true;

    // ---- 控制行：提示 + 筛选 ----
    const controls = document.createElement('div');
    controls.className = 'bai-bai-floor-controls';

    const filterBar = document.createElement('div');
    filterBar.className = 'bai-bai-floor-filter';
    filterBar.setAttribute('role', 'group');
    filterBar.setAttribute('aria-label', '按发言者筛选');

    const FILTERS = [
        { key: 'all', label: 'All' },
        { key: 'bot', label: 'Char' },
        { key: 'user', label: 'User' },
        { key: 'hidden', label: 'Hide' },
    ];
    const filterButtons = new Map();
    for (const def of FILTERS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bai-bai-floor-filter-btn';
        btn.textContent = def.label;
        if (def.key === 'all') {
            btn.classList.add('bai-bai-floor-filter-active');
        }
        btn.addEventListener('click', () => {
            if (renderState.filter === def.key) {
                return;
            }
            renderState.filter = def.key;
            for (const [key, button] of filterButtons) {
                button.classList.toggle('bai-bai-floor-filter-active', key === def.key);
            }
            apply(input.value);
        });
        filterButtons.set(def.key, btn);
        filterBar.appendChild(btn);
    }

    // 移动端专用关闭按钮：与顶部那颗共用 close()，仅在窄屏显示（见样式 .bai-bai-floor-mobile-only）。
    // 作为 dialog 的独立移动端按钮，移动端排在搜索框右侧；桌面端隐藏。
    const mobileClose = document.createElement('button');
    mobileClose.type = 'button';
    mobileClose.className = 'bai-bai-floor-close bai-bai-floor-mobile-only';
    mobileClose.setAttribute('aria-label', '关闭');
    mobileClose.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    bar.append(barIcon, input, clearButton);
    controls.append(filterBar);

    // ---- 列表 ----
    const list = document.createElement('div');
    list.className = 'bai-bai-floor-list';

    // ---- 分页条 ----
    const pager = document.createElement('div');
    pager.className = 'bai-bai-floor-pager';

    const mobileTopRow = document.createElement('div');
    mobileTopRow.className = 'bai-bai-floor-mobile-top-row';
    mobileTopRow.append(controls, pager);

    const mobileBottomRow = document.createElement('div');
    mobileBottomRow.className = 'bai-bai-floor-mobile-bottom-row';
    mobileBottomRow.append(bar, mobileClose);

    dialog.append(head, mobileBottomRow, mobileTopRow, list);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // ---- 关闭逻辑 ----
    const close = () => {
        document.removeEventListener('keydown', handleKeydown, true);
        overlay.remove();
    };
    const handleKeydown = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
        }
    };
    closeButton.addEventListener('click', close);
    mobileClose.addEventListener('click', close);
    overlay.addEventListener('mousedown', event => {
        if (event.target === overlay) {
            close();
        }
    });
    document.addEventListener('keydown', handleKeydown, true);

    // ---- 渲染逻辑 ----
    // totalItems + loadPageEntries：当前结果集的轻量分页源；page：1 起显示页码；keyword：高亮词；filter：all/bot/user。
    // reversePageOrder 只用于移动端浏览/关键词模式：显示第 1 页时实际切到结果集末尾。
    const renderState = {
        expanded: new Set(),
        entries: [],
        totalItems: 0,
        loadPageEntries: null,
        keyword: '',
        page: 1,
        filter: 'all',
        reversePageOrder: false,
    };

    const renderEmpty = message => {
        list.innerHTML = '';
        pager.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'bai-bai-floor-empty';
        empty.textContent = message;
        list.appendChild(empty);
    };

    // 渲染当前页：每次都整块重建列表 DOM，避免翻页时元素越堆越多。
    const renderPage = () => {
        const { keyword, totalItems } = renderState;

        if (!totalItems) {
            const scope = renderState.filter === 'user' ? 'User '
                : renderState.filter === 'bot' ? 'Char '
                : renderState.filter === 'hidden' ? '隐藏'
                : '';
            const message = keyword
                ? `没有${scope}楼层匹配「${keyword}」`
                : scope ? `当前没有${scope}楼层` : '当前没有可显示的楼层';
            renderEmpty(message);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        renderState.page = Math.min(Math.max(1, renderState.page), totalPages);
        const slicePage = renderState.reversePageOrder
            ? totalPages - renderState.page + 1
            : renderState.page;
        const start = (slicePage - 1) * PAGE_SIZE;
        const pageEntries = typeof renderState.loadPageEntries === 'function'
            ? renderState.loadPageEntries(start, PAGE_SIZE)
            : renderState.entries.slice(start, start + PAGE_SIZE);

        // 整块替换：旧行（含已展开的编辑器、事件监听）随 innerHTML 清空被回收。
        list.innerHTML = '';
        list.scrollTop = 0;
        const fragment = document.createDocumentFragment();
        for (const entry of pageEntries) {
            // 分节标题行（数字模式下分隔「定位楼层」与「关键词命中」），其余为普通楼层行。
            fragment.appendChild(entry?.type === 'header' ? buildHeader(entry) : buildRow(entry, keyword));
        }
        list.appendChild(fragment);

        renderPager(totalPages);
    };

    const goToPage = page => {
        if (page === renderState.page) {
            return;
        }
        renderState.page = page;
        renderPage();
    };

    const renderPager = totalPages => {
        pager.innerHTML = '';
        if (totalPages <= 1) {
            return;
        }

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'bai-bai-floor-page-btn';
        prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prev.setAttribute('aria-label', '上一页');
        prev.disabled = renderState.page <= 1;
        prev.addEventListener('click', () => goToPage(renderState.page - 1));

        const info = document.createElement('span');
        info.className = 'bai-bai-floor-page-info';
        info.textContent = `${renderState.page} / ${totalPages}`;

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'bai-bai-floor-page-btn';
        next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        next.setAttribute('aria-label', '下一页');
        next.disabled = renderState.page >= totalPages;
        next.addEventListener('click', () => goToPage(renderState.page + 1));

        pager.append(prev, info, next);
    };

    // 设置结果集并从指定页开始渲染。
    const showEntries = (entries, keyword, page = 1, options = {}) => {
        renderState.entries = entries;
        renderState.totalItems = entries.length;
        renderState.loadPageEntries = (start, count) => entries.slice(start, start + count);
        renderState.keyword = keyword;
        renderState.page = page;
        renderState.reversePageOrder = Boolean(options.reversePageOrder);
        renderPage();
    };

    // 设置分页结果源。调用方只提供总数和当前页加载器，避免预先处理所有楼层文本。
    const showPagedEntries = (totalItems, loadPageEntries, keyword, page = 1, options = {}) => {
        renderState.entries = [];
        renderState.totalItems = Math.max(0, Number(totalItems) || 0);
        renderState.loadPageEntries = loadPageEntries;
        renderState.keyword = keyword;
        renderState.page = page;
        renderState.reversePageOrder = Boolean(options.reversePageOrder);
        renderPage();
    };

    // 分节标题行：用于数字模式下分隔「定位到的楼层」与「文本里含该数字的楼层」两段结果。
    const buildHeader = entry => {
        const header = document.createElement('div');
        header.className = 'bai-bai-floor-section';
        header.textContent = entry.label;
        return header;
    };

    const buildRow = (entry, keyword) => {
        const { index } = entry;
        let message = chat[index] ?? entry.message;
        let previewText = buildPreviewText(message);
        const isUser = Boolean(message?.is_user);

        const row = document.createElement('div');
        row.className = 'bai-bai-floor-row';
        row.classList.add(isUser ? 'bai-bai-floor-row-user' : 'bai-bai-floor-row-bot');
        if (renderState.expanded.has(index)) {
            row.classList.add('bai-bai-floor-row-open');
        }

        // 楼层轨：竖直强调条 + 表格数字
        const rail = document.createElement('div');
        rail.className = 'bai-bai-floor-rail';
        const num = document.createElement('div');
        num.className = 'bai-bai-floor-num';
        num.textContent = String(index);
        rail.appendChild(num);

        const main = document.createElement('div');
        main.className = 'bai-bai-floor-main';

        const meta = document.createElement('div');
        meta.className = 'bai-bai-floor-meta';
        const speaker = document.createElement('span');
        speaker.className = 'bai-bai-floor-speaker';
        speaker.textContent = getSpeakerName(ctx, message);
        const tag = document.createElement('span');
        tag.className = 'bai-bai-floor-tag';
        tag.textContent = isUser ? 'User' : 'Char';
        // 隐藏楼层（is_system）：沿用 ST 的小幽灵标识，放在身份标签右边。
        const ghost = document.createElement('span');
        ghost.className = 'bai-bai-floor-ghost';
        ghost.title = '已隐藏楼层（不参与上下文）';
        ghost.setAttribute('aria-label', '已隐藏楼层');
        ghost.innerHTML = '<i class="fa-solid fa-ghost"></i>';
        meta.append(speaker, tag, ghost);

        const snippet = document.createElement('div');
        snippet.className = 'bai-bai-floor-snippet';
        snippet.innerHTML = highlightHtml(buildSnippet(previewText, keyword), keyword);

        const updatePreview = nextMessage => {
            message = nextMessage ?? message;
            previewText = buildPreviewText(message);
            snippet.innerHTML = highlightHtml(buildSnippet(previewText, keyword), keyword);
        };

        // 展开区：正文预览(.bai-bai-floor-detail) + 操作栏(.bai-bai-floor-actions)，
        // 进入编辑后正文换成 textarea + 保存/取消。
        const body = document.createElement('div');
        body.className = 'bai-bai-floor-body';

        const detail = document.createElement('div');
        detail.className = 'bai-bai-floor-detail mes_text';

        const actions = document.createElement('div');
        actions.className = 'bai-bai-floor-actions';
        // 按钮自己的处理器会同步改 innerHTML（回收被点的图标节点），轮到本监听器时
        // event.target 已脱离文档，closest 认不出按钮；用派发时固化的 composedPath 判断。
        // 在冒泡阶段拦在行前面，操作栏空白处的点击仍可正常收起。
        actions.addEventListener('click', event => {
            const clickedAction = event.composedPath().some(
                node => node instanceof Element && node.classList.contains('bai-bai-floor-action'),
            );
            if (clickedAction) {
                event.stopPropagation();
            }
        });
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'bai-bai-floor-action';
        editButton.innerHTML = '<i class="fa-solid fa-pen-to-square"></i><span>编辑</span>';
        const hideButton = document.createElement('button');
        hideButton.type = 'button';
        hideButton.className = 'bai-bai-floor-action';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'bai-bai-floor-action bai-bai-floor-action-danger';
        deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i><span>删除</span>';
        // 截图按钮放在最左边:截取该楼层的完整渲染(含酒馆助手前端界面)并下载图片。
        const shotButton = document.createElement('button');
        shotButton.type = 'button';
        shotButton.className = 'bai-bai-floor-action';
        shotButton.title = '截图并下载该楼层';
        shotButton.innerHTML = '<i class="fa-solid fa-camera"></i><span>截图</span>';

        body.append(detail, actions);

        // 统一刷新「隐藏」相关的视觉：整行淡化、幽灵图标、隐藏/显示按钮的标题。
        const applyHiddenState = () => {
            const hidden = Boolean(message?.is_system);
            row.classList.toggle('bai-bai-floor-row-hidden', hidden);
            ghost.style.display = hidden ? '' : 'none';
            hideButton.innerHTML = hidden
                ? '<i class="fa-solid fa-eye"></i><span>显示</span>'
                : '<i class="fa-solid fa-eye-slash"></i><span>隐藏</span>';
        };
        applyHiddenState();

        const renderView = () => {
            detail.classList.remove('bai-bai-floor-detail-editing');
            detail.style.height = '';
            detail.innerHTML = renderPreviewTextHtml(previewText);
            actions.innerHTML = '';
            actions.append(shotButton, hideButton, deleteButton, editButton);
        };

        const enterEdit = () => {
            const detailRect = detail.getBoundingClientRect();
            const detailStyle = getComputedStyle(detail);
            const verticalInset = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
                .reduce((sum, key) => sum + (parseFloat(detailStyle[key]) || 0), 0);
            const editorHeight = Math.max(0, Math.floor(detailRect.height - verticalInset));

            detail.classList.add('bai-bai-floor-detail-editing');
            detail.style.height = `${Math.ceil(detailRect.height)}px`;
            const textarea = document.createElement('textarea');
            textarea.className = 'bai-bai-floor-editor';
            textarea.value = typeof message?.mes === 'string' ? message.mes : '';
            textarea.spellcheck = false;
            textarea.style.minHeight = '0';
            textarea.style.height = `${editorHeight}px`;
            textarea.style.maxHeight = `${editorHeight}px`;

            const save = document.createElement('button');
            save.type = 'button';
            save.className = 'bai-bai-floor-action bai-bai-floor-action-primary';
            save.innerHTML = '<i class="fa-solid fa-check"></i><span>保存</span>';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'bai-bai-floor-action';
            cancel.innerHTML = '<i class="fa-solid fa-xmark"></i><span>取消</span>';

            detail.innerHTML = '';
            detail.appendChild(textarea);
            actions.innerHTML = '';
            actions.append(cancel, save);

            requestAnimationFrame(() => {
                // 移动端不自动聚焦：否则进入编辑就弹软键盘。需要时用户自己点输入框。
                const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
                if (!isCoarsePointer) {
                    textarea.focus({ preventScroll: true });
                }
            });

            cancel.addEventListener('click', renderView);

            const doSave = async () => {
                const freshCtx = getStContext();
                if (!freshCtx) {
                    toastError('无法读取聊天上下文，保存失败');
                    return;
                }
                save.disabled = true;
                cancel.disabled = true;
                const previousHtml = save.innerHTML;
                save.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>保存中</span>';
                const previousMessage = message;
                const previousPreviewText = previewText;
                const draftMessage = { ...(message ?? {}), mes: textarea.value };
                updatePreview(draftMessage);
                try {
                    await saveFloorEdit(freshCtx, index, textarea.value);
                    const latestChat = getChatArray(freshCtx);
                    if (latestChat.length) {
                        chat = latestChat;
                    }
                    if (chat[index]) {
                        updatePreview(chat[index]);
                    } else {
                        message = { ...(message ?? {}), mes: textarea.value };
                        updatePreview(message);
                    }
                    toastSuccess(`已保存第 ${index} 层`);
                    renderView();
                } catch (error) {
                    message = previousMessage;
                    previewText = previousPreviewText;
                    snippet.innerHTML = highlightHtml(buildSnippet(previewText, keyword), keyword);
                    console.error(`${LOG_PREFIX} save floor edit failed`, error);
                    save.disabled = false;
                    cancel.disabled = false;
                    save.innerHTML = previousHtml;
                    toastError(`保存失败：${error?.message ?? error}`);
                }
            };
            save.addEventListener('click', doSave);
            // Ctrl/Cmd+Enter 保存。
            textarea.addEventListener('keydown', event => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void doSave();
                }
            });
        };

        editButton.addEventListener('click', enterEdit);
        hideButton.addEventListener('click', async () => {
            const freshCtx = getStContext();
            if (!freshCtx) {
                toastError('无法读取聊天上下文，操作失败');
                return;
            }

            hideButton.disabled = true;
            const previousHtml = hideButton.innerHTML;
            hideButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>处理中</span>';
            try {
                const nowHidden = await toggleFloorHiddenWithSlashCommand(freshCtx, index);
                const latestChat = getChatArray(freshCtx);
                if (latestChat.length) {
                    chat = latestChat;
                }
                if (chat[index]) {
                    updatePreview(chat[index]);
                }
                applyHiddenState();
                toastSuccess(nowHidden ? `已隐藏第 ${index} 层` : `已显示第 ${index} 层`);
            } catch (error) {
                console.error(`${LOG_PREFIX} toggle floor hidden failed`, error);
                hideButton.innerHTML = previousHtml;
                toastError(`操作失败：${error?.message ?? error}`);
            } finally {
                hideButton.disabled = false;
            }
        });
        shotButton.addEventListener('click', async () => {
            const freshCtx = getStContext();
            if (!freshCtx) {
                toastError('无法读取聊天上下文，截图失败');
                return;
            }
            if (shotButton.disabled) {
                return;
            }

            shotButton.disabled = true;
            const previousHtml = shotButton.innerHTML;
            shotButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>截图中</span>';
            // 截图要等字体/图片/iframe 就绪，可能好几秒，先给个即时反馈。
            // 提示框不要淡入：淡入靠后续每一帧推进，截图一开始就占住主线程，提示框会一直透明；
            // 再让出一帧，把提示框和按钮转圈先画出来，然后才开始截图
            toastInfo(`正在截取第 ${index} 层…`, { showDuration: 0 });
            try {
                await waitForNextPaint();
                const { blob, outcome } = await captureFloorShot(index, freshCtx);
                downloadBlob(blob, outcome.suggestedName);
                if (outcome.frontendBlocks > outcome.iframesCaptured) {
                    const missed = outcome.frontendBlocks - outcome.iframesCaptured;
                    toastWarning(outcome.floorInDom
                        ? `截图已保存，但有 ${missed} 个前端界面未渲染，以代码块显示`
                        : `截图已保存，但楼层未加载到聊天区，${missed} 个前端界面以代码块显示`);
                } else {
                    toastSuccess(`第 ${index} 层截图已保存`);
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} capture floor shot failed`, error);
                toastError(`截图失败：${error?.message ?? error}`);
            } finally {
                shotButton.disabled = false;
                shotButton.innerHTML = previousHtml;
            }
        });

        deleteButton.addEventListener('click', async () => {
            const freshCtx = getStContext();
            if (!freshCtx) {
                toastError('无法读取聊天上下文，删除失败');
                return;
            }

            editButton.disabled = true;
            deleteButton.disabled = true;
            const previousHtml = deleteButton.innerHTML;
            deleteButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>删除中</span>';
            const previousChat = chat;
            const previousExpanded = new Set(renderState.expanded);
            let didOptimisticDelete = false;
            try {
                const deletedCount = await deleteFloorRangeWithSlashCommand(freshCtx, index, {
                    onConfirmed: () => {
                        didOptimisticDelete = true;
                        chat = chat.slice(0, index);
                        renderState.expanded = new Set([...renderState.expanded].filter(id => id < index));
                        apply(input.value);
                    },
                });
                if (deletedCount > 0) {
                    const latestChat = getChatArray(freshCtx);
                    if (latestChat.length <= index) {
                        chat = latestChat;
                    }
                    toastSuccess(`已删除第 ${index} 层及之后 ${deletedCount} 层`);
                }
            } catch (error) {
                if (didOptimisticDelete) {
                    chat = previousChat;
                    renderState.expanded = previousExpanded;
                    apply(input.value);
                }
                console.error(`${LOG_PREFIX} delete floor range failed`, error);
                toastError(`删除失败：${error?.message ?? error}`);
            } finally {
                editButton.disabled = false;
                deleteButton.disabled = false;
                deleteButton.innerHTML = previousHtml;
            }
        });

        if (renderState.expanded.has(index)) {
            row.classList.add('bai-bai-floor-row-open');
            renderView();
        }

        main.append(meta, snippet, body);
        row.append(rail, main);

        const toggle = () => {
            const opening = !renderState.expanded.has(index);
            if (opening) {
                renderState.expanded.add(index);
                row.classList.add('bai-bai-floor-row-open');
                renderView();
            } else {
                renderState.expanded.delete(index);
                detail.innerHTML = '';
                actions.innerHTML = '';
                row.classList.remove('bai-bai-floor-row-open');
            }
        };

        row.addEventListener('click', event => {
            // 只在点到正文内容或按钮时不收起；操作栏的空白处仍可点击收起。
            // 用 closest（元素也会匹配自身）即使按钮在切换编辑态被移除也能命中。
            if (event.target instanceof Element
                && event.target.closest('.bai-bai-floor-detail, .bai-bai-floor-action, .bai-bai-floor-action *')) {
                return;
            }
            toggle();
        });

        return row;
    };

    // 按当前筛选判断消息是否保留：all 全要；user 仅用户；bot 仅非用户；hidden 仅隐藏楼层。
    const passesFilter = message => {
        if (renderState.filter === 'user') {
            return Boolean(message?.is_user);
        }
        if (renderState.filter === 'bot') {
            return !message?.is_user;
        }
        if (renderState.filter === 'hidden') {
            return Boolean(message?.is_system);
        }
        return true;
    };

    const buildMessageEntry = (chat, index) => {
        const message = chat[index];
        return {
            index,
            message,
        };
    };

    const collectMessageIndexes = chat => {
        const indexes = [];
        for (let index = 0; index < chat.length; index += 1) {
            const message = chat[index];
            if (passesFilter(message)) {
                indexes.push(index);
            }
        }
        return indexes;
    };

    const messageMatchesKeyword = (message, lowerKeyword) => {
        const raw = typeof message?.mes === 'string' ? message.mes : '';
        return raw.toLowerCase().includes(lowerKeyword);
    };

    const apply = rawValue => {
        const value = String(rawValue ?? '').trim();
        const openedCtx = ctx;
        const openedChat = chat;

        if (!openedCtx || !openedChat.length) {
            count.textContent = '暂无楼层';
            renderEmpty('当前没有打开的聊天');
            return;
        }
        count.textContent = `共 ${openedChat.length} 层`;

        // 列表展示了一组（已按筛选收集、index 升序）楼层时，决定最终方向并落到合适的页：
        //   移动端正序（旧在上、最新在底，贴合聊天滚动方向）→ 显示第 1 页，实际切到末尾并滚到底；
        //   桌面端倒序（最新在上）→ 停在第 1 页。
        const showBrowse = (messageIndexes, keyword) => {
            const mobile = isMobileViewport();
            const totalItems = messageIndexes.length;
            const loadPageEntries = (start, count) => {
                const end = Math.min(totalItems, start + count);
                const pageEntries = [];
                for (let offset = start; offset < end; offset += 1) {
                    const sourceOffset = mobile ? offset : totalItems - 1 - offset;
                    const index = messageIndexes[sourceOffset];
                    pageEntries.push(buildMessageEntry(openedChat, index));
                }
                return pageEntries;
            };

            showPagedEntries(totalItems, loadPageEntries, keyword, 1, { reversePageOrder: mobile });
            if (mobile && totalItems) {
                requestAnimationFrame(() => {
                    list.scrollTop = list.scrollHeight;
                });
            }
        };

        // 数字模式：既定位到该楼层号（置顶展开），又把「文本里含该数字」的楼层作为搜索结果接在下面。
        if (/^\d+$/.test(value)) {
            const target = Number(value);
            const inRange = target >= 0 && target < openedChat.length;

            // 收集文本命中该数字的楼层（叠加筛选；排除已定位的目标楼，避免重复）。
            const lowerKeyword = value.toLowerCase();
            const matches = [];
            for (let index = 0; index < openedChat.length; index += 1) {
                if (inRange && index === target) {
                    continue;
                }
                const message = openedChat[index];
                if (!passesFilter(message)) {
                    continue;
                }
                if (messageMatchesKeyword(message, lowerKeyword)) {
                    matches.push(index);
                }
            }
            const orderedMatches = isMobileViewport() ? matches : matches.slice().reverse();

            // 复合视图始终顶部锚定（定位楼层在最上），与端无关。
            const entries = [];
            if (inRange) {
                renderState.expanded = new Set([target]);
                entries.push({ type: 'header', label: `定位 · 楼层 #${target}` });
                entries.push(buildMessageEntry(openedChat, target));
            } else {
                renderState.expanded = new Set();
            }
            if (orderedMatches.length) {
                entries.push({ type: 'header', label: `文本包含「${value}」的楼层（${orderedMatches.length}）` });
                for (const index of orderedMatches) {
                    entries.push(buildMessageEntry(openedChat, index));
                }
            }

            if (!entries.length) {
                renderEmpty(`楼层号 ${value} 超出范围（共 ${openedChat.length} 层，0 ~ ${openedChat.length - 1}），且没有楼层文本包含「${value}」`);
                return;
            }

            showEntries(entries, value, 1);
            requestAnimationFrame(() => {
                list.querySelector('.bai-bai-floor-row-open')?.scrollIntoView({ block: 'nearest' });
            });
            return;
        }

        const keyword = value;

        // 默认（空输入）：展示（按筛选）全部楼层。
        if (!keyword) {
            showBrowse(collectMessageIndexes(openedChat), '');
            return;
        }

        // 关键词搜索模式（叠加筛选）
        const lowerKeyword = keyword.toLowerCase();
        const matchedIndexes = [];
        for (let index = 0; index < openedChat.length; index += 1) {
            const message = openedChat[index];
            if (!passesFilter(message)) {
                continue;
            }
            if (messageMatchesKeyword(message, lowerKeyword)) {
                matchedIndexes.push(index);
            }
        }
        showBrowse(matchedIndexes, keyword);
    };

    const syncClearButton = () => {
        clearButton.disabled = input.value.length === 0;
    };

    const debouncedApply = debounce(apply, 180);
    input.addEventListener('input', () => {
        syncClearButton();
        debouncedApply(input.value);
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            apply(input.value);
        }
    });
    clearButton.addEventListener('click', () => {
        input.value = '';
        syncClearButton();
        apply('');
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
        if (!isCoarsePointer) {
            input.focus({ preventScroll: true });
        }
    });

    // 初始：展示全部楼层
    apply('');
    syncClearButton();

    // 桌面端：初次渲染后把当前高度锁成 min-height，避免之后筛选导致楼层变少、
    // 弹窗高度回缩，因垂直居中而让顶部搜索/筛选栏整体下移。锁底后弹窗只增不减，
    // 既保持初次居中，也不会在筛选时位移。移动端是全屏定高，无需处理。
    requestAnimationFrame(() => {
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
        const isNarrow = window.matchMedia?.('(max-width: 600px)')?.matches;
        if (isCoarsePointer || isNarrow) {
            return;
        }
        const height = dialog.getBoundingClientRect().height;
        if (height > 0) {
            dialog.style.minHeight = `${Math.ceil(height)}px`;
        }
    });

    // 移动端不自动聚焦输入框：否则会立刻弹出软键盘，缩小可视视口把
    // position:fixed 的弹窗挤出屏幕（看起来像被关掉）。桌面端才自动聚焦。
    requestAnimationFrame(() => {
        dialog.focus({ preventScroll: true });
        const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
        if (!isCoarsePointer) {
            input.focus({ preventScroll: true });
        }
    });
}

// ---------------------------------------------------------------------------
// 样式（全部继承 --SmartTheme* 主题变量）
// ---------------------------------------------------------------------------

function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = getStyleCss();
}

function getStyleCss() {
    return `
.${OVERLAY_CLASS} {
    position: fixed;
    inset: 0;
    /* 显式视口尺寸兜底：若某祖先建立了包含块（transform/filter/contain 等），
       inset:0 会相对该块解析而可能塌成 0；用 vw/vh 强制占满视口。 */
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    z-index: 10010;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
    animation: baiBaiFloorFade 0.16s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-dialog {
    display: flex;
    flex-direction: column;
    width: min(560px, 100%);
    max-height: min(82vh, 760px);
    overflow: hidden;
    color: var(--SmartThemeBodyColor);
    background: var(--SmartThemeBlurTintColor);
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 12px;
    box-shadow: 0 18px 50px var(--SmartThemeShadowColor, rgba(0, 0, 0, 0.4));
    backdrop-filter: blur(calc(var(--SmartThemeBlurStrength, 10px)));
    -webkit-backdrop-filter: blur(calc(var(--SmartThemeBlurStrength, 10px)));
    outline: none;
    animation: baiBaiFloorRise 0.18s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--SmartThemeBorderColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-title {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.${OVERLAY_CLASS} .bai-bai-floor-count {
    margin-left: auto;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: var(--SmartThemeEmColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-close {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--SmartThemeBodyColor);
    background: transparent;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.12s ease, background 0.12s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-close:hover {
    opacity: 1;
    background: rgba(127, 127, 127, 0.12);
}

/* 仅移动端可见的元素（如底部操作行里的关闭键），桌面端隐藏。 */
.${OVERLAY_CLASS} .bai-bai-floor-mobile-only {
    display: none;
}

.${OVERLAY_CLASS} .bai-bai-floor-mobile-top-row,
.${OVERLAY_CLASS} .bai-bai-floor-mobile-bottom-row {
    display: contents;
}

.${OVERLAY_CLASS} .bai-bai-floor-head { order: 0; }
.${OVERLAY_CLASS} .bai-bai-floor-bar { order: 1; }
.${OVERLAY_CLASS} .bai-bai-floor-controls { order: 2; }
.${OVERLAY_CLASS} .bai-bai-floor-list { order: 3; }
.${OVERLAY_CLASS} .bai-bai-floor-pager { order: 4; }
.${OVERLAY_CLASS} .bai-bai-floor-mobile-bottom-row > .bai-bai-floor-mobile-only { order: 5; }

.${OVERLAY_CLASS} .bai-bai-floor-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 16px 0;
    padding: 0 12px;
    /* 固定高度，子元素（含继承主题样式的按钮）不得撑高命令栏。
       命令栏处在列向 flex 容器里，必须 flex:0 0 auto 锁死：否则默认
       flex-shrink:1 会在空间紧张时把它压扁（高度过低），而清空按钮出现后
       其内容最小高度又顶回 42px（被“拉高”）——两个现象同源。 */
    flex: 0 0 auto;
    height: 42px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 10px;
    background: var(--SmartThemeChatTintColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-bar:focus-within {
    border-color: var(--SmartThemeQuoteColor);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--SmartThemeQuoteColor) 35%, transparent);
}

.${OVERLAY_CLASS} .bai-bai-floor-bar-icon {
    flex: 0 0 auto;
    color: var(--SmartThemeQuoteColor);
    opacity: 0.85;
}

.${OVERLAY_CLASS} .bai-bai-floor-input {
    flex: 1 1 auto;
    min-width: 0;
    /* 不再用 height:100%，避免被子元素的撑高反向带高；按内容单行居中即可 */
    height: auto;
    margin: 0;
    padding: 0;
    color: var(--SmartThemeBodyColor);
    /* 强制透明 + !important：部分主题给所有 input/text_pole 加了带 !important
       的底色，会在命令栏里显出一块异色矩形，必须用 !important 才能压过。
       透明后始终透出命令栏的背景，二者同色。 */
    background: transparent none !important;
    border: none !important;
    box-shadow: none !important;
    outline: none;
    font-size: 0.95rem;
    font-family: inherit;
    line-height: normal;
}

.${OVERLAY_CLASS} .bai-bai-floor-input::placeholder {
    color: var(--SmartThemeEmColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-clear {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* 锁死尺寸并清掉主题给 button 的 min-height/line-height，否则会撑高命令栏 */
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    line-height: 1;
    color: var(--SmartThemeEmColor);
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.75;
    transition: opacity 0.12s ease, background 0.12s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-clear:hover {
    opacity: 1;
    background: rgba(127, 127, 127, 0.18);
}

.${OVERLAY_CLASS} .bai-bai-floor-clear:disabled,
.${OVERLAY_CLASS} .bai-bai-floor-clear:disabled:hover {
    opacity: 0.35;
    cursor: default;
    background: transparent;
}

.${OVERLAY_CLASS} .bai-bai-floor-controls {
    display: flex;
    /* 显式锁定方向：部分主题会在通用选择器上设 direction:rtl 或
       flex-direction:row-reverse，导致筛选跑到左边。这里强制 LTR + 正向。 */
    direction: ltr;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 16px 10px;
}

/* 分段控件：一条浅色轨道，内嵌可滑动的圆角分段，激活段浮起为强调色胶囊 */
.${OVERLAY_CLASS} .bai-bai-floor-filter {
    flex: 0 0 auto;
    /* 桌面端把筛选钉在最右侧；移动端会在媒体查询里改成左对齐。 */
    margin-left: auto;
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--SmartThemeBorderColor) 22%, transparent);
}

.${OVERLAY_CLASS} .bai-bai-floor-filter-btn {
    padding: 4px 14px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    font-family: inherit;
    color: var(--SmartThemeEmColor);
    background: transparent;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-filter-btn:hover {
    color: var(--SmartThemeBodyColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-filter-active,
.${OVERLAY_CLASS} .bai-bai-floor-filter-active:hover {
    color: var(--SmartThemeBlurTintColor);
    background: var(--SmartThemeQuoteColor);
    box-shadow: 0 1px 3px var(--SmartThemeShadowColor, rgba(0, 0, 0, 0.25));
}

.${OVERLAY_CLASS} .bai-bai-floor-list {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 4px 12px 14px;
    -webkit-overflow-scrolling: touch;
}

.${OVERLAY_CLASS} .bai-bai-floor-empty {
    padding: 36px 16px;
    text-align: center;
    color: var(--SmartThemeEmColor);
    font-size: 0.88rem;
    line-height: 1.6;
}

/* 分节标题行：数字模式下分隔「定位楼层」与「文本命中」两段结果。 */
.${OVERLAY_CLASS} .bai-bai-floor-section {
    padding: 10px 6px 4px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--SmartThemeQuoteColor);
}
.${OVERLAY_CLASS} .bai-bai-floor-section + .bai-bai-floor-row {
    border-top: none;
}

.${OVERLAY_CLASS} .bai-bai-floor-row {
    display: flex;
    gap: 12px;
    padding: 10px 6px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.12s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-row + .bai-bai-floor-row {
    border-top: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 60%, transparent);
}

.${OVERLAY_CLASS} .bai-bai-floor-row:hover {
    background: rgba(127, 127, 127, 0.08);
}

.${OVERLAY_CLASS} .bai-bai-floor-row-open {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 10%, transparent);
}

/* 楼层轨：竖直强调条 + 表格数字（电梯楼层指示器）。
   Char / User 仅用消息的 tint 色给竖线着色，不再填充浅色背景块。 */
.${OVERLAY_CLASS} .bai-bai-floor-rail {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-width: 46px;
    padding: 4px 6px 4px 10px;
}

/* 竖线用伪元素画：细一点（2px）并留出上下内缩，是一根直的小竖条。 */
.${OVERLAY_CLASS} .bai-bai-floor-rail::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: var(--SmartThemeBotMesBlurTintColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-row-user .bai-bai-floor-rail::before {
    background: var(--SmartThemeUserMesBlurTintColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-num {
    font-family: "SF Mono", "Roboto Mono", "DejaVu Sans Mono", Consolas, ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--SmartThemeBodyColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-main {
    flex: 1 1 auto;
    min-width: 0;
}

.${OVERLAY_CLASS} .bai-bai-floor-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
}

.${OVERLAY_CLASS} .bai-bai-floor-speaker {
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.${OVERLAY_CLASS} .bai-bai-floor-tag {
    flex: 0 0 auto;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: capitalize;
    padding: 1px 8px;
    border-radius: 999px;
    color: var(--SmartThemeBodyColor);
    background: color-mix(in srgb, var(--SmartThemeBotMesBlurTintColor) 50%, transparent);
}

.${OVERLAY_CLASS} .bai-bai-floor-row-user .bai-bai-floor-tag {
    background: color-mix(in srgb, var(--SmartThemeUserMesBlurTintColor) 50%, transparent);
}

/* 隐藏楼层标识：身份标签右边的小幽灵。 */
.${OVERLAY_CLASS} .bai-bai-floor-ghost {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    font-size: 0.8rem;
    line-height: 1;
    color: var(--SmartThemeEmColor);
    opacity: 0.75;
}

/* 隐藏楼层整行淡化，扫一眼即可区分。 */
.${OVERLAY_CLASS} .bai-bai-floor-row-hidden .bai-bai-floor-num,
.${OVERLAY_CLASS} .bai-bai-floor-row-hidden .bai-bai-floor-speaker,
.${OVERLAY_CLASS} .bai-bai-floor-row-hidden .bai-bai-floor-snippet {
    opacity: 0.55;
}

.${OVERLAY_CLASS} .bai-bai-floor-row-hidden .bai-bai-floor-rail::before {
    background: var(--SmartThemeEmColor);
    opacity: 0.5;
}

.${OVERLAY_CLASS} .bai-bai-floor-snippet {
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--SmartThemeEmColor);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.${OVERLAY_CLASS} .bai-bai-floor-row-open .bai-bai-floor-snippet {
    display: none;
}

.${OVERLAY_CLASS} .bai-bai-floor-hit {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 32%, transparent);
    color: var(--SmartThemeBodyColor);
    border-radius: 3px;
    padding: 0 1px;
}

.${OVERLAY_CLASS} .bai-bai-floor-body {
    display: none;
    cursor: auto;
}

.${OVERLAY_CLASS} .bai-bai-floor-row-open .bai-bai-floor-body {
    display: block;
}

.${OVERLAY_CLASS} .bai-bai-floor-detail {
    box-sizing: border-box;
    margin-top: 8px;
    padding: 10px 12px;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--SmartThemeBodyColor);
    background: var(--SmartThemeChatTintColor);
    border: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
    border-radius: 8px;
    max-height: 46vh;
    overflow-y: auto;
    overflow-wrap: anywhere;
}

.${OVERLAY_CLASS} .bai-bai-floor-detail-editing {
    max-height: none;
    overflow: hidden;
}

.${OVERLAY_CLASS} .bai-bai-floor-detail img {
    max-width: 100%;
    height: auto;
}

.${OVERLAY_CLASS} .bai-bai-floor-editor {
    width: 100%;
    min-height: 96px;
    box-sizing: border-box;
    padding: 4px 2px;
    color: var(--SmartThemeBodyColor);
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.6;
    overflow-y: auto;
}

.${OVERLAY_CLASS} .bai-bai-floor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
}

.${OVERLAY_CLASS} .bai-bai-floor-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--SmartThemeBodyColor);
    background: transparent;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s ease, opacity 0.12s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-action:hover {
    background: rgba(127, 127, 127, 0.12);
}

.${OVERLAY_CLASS} .bai-bai-floor-action:disabled {
    opacity: 0.6;
    cursor: default;
}

.${OVERLAY_CLASS} .bai-bai-floor-action-primary {
    color: var(--SmartThemeQuoteColor);
    border-color: var(--SmartThemeQuoteColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-action-primary:hover {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 14%, transparent);
}

.${OVERLAY_CLASS} .bai-bai-floor-action-danger {
    color: #d85c5c;
    border-color: #d85c5c;
}

.${OVERLAY_CLASS} .bai-bai-floor-action-danger:hover {
    background: rgba(216, 92, 92, 0.14);
}

.${OVERLAY_CLASS} .bai-bai-floor-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 0 16px;
}

.${OVERLAY_CLASS} .bai-bai-floor-pager:not(:empty) {
    padding: 10px 16px 14px;
    border-top: 1px solid var(--SmartThemeBorderColor);
}

.${OVERLAY_CLASS} .bai-bai-floor-page-btn {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--SmartThemeBodyColor);
    background: transparent;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s ease, opacity 0.12s ease;
}

.${OVERLAY_CLASS} .bai-bai-floor-page-btn:hover:not(:disabled) {
    background: rgba(127, 127, 127, 0.12);
}

.${OVERLAY_CLASS} .bai-bai-floor-page-btn:disabled {
    opacity: 0.4;
    cursor: default;
}

.${OVERLAY_CLASS} .bai-bai-floor-page-info {
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--SmartThemeEmColor);
    min-width: 56px;
    text-align: center;
}

.${OVERLAY_CLASS} .bai-bai-floor-close:focus-visible,
.${OVERLAY_CLASS} .bai-bai-floor-clear:focus-visible,
.${OVERLAY_CLASS} .bai-bai-floor-action:focus-visible,
.${OVERLAY_CLASS} .bai-bai-floor-page-btn:focus-visible,
.${OVERLAY_CLASS} .bai-bai-floor-filter-btn:focus-visible,
.${OVERLAY_CLASS} .bai-bai-floor-row:focus-visible {
    outline: 2px solid var(--SmartThemeQuoteColor);
    outline-offset: 2px;
}

@keyframes baiBaiFloorFade {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes baiBaiFloorRise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
    .${OVERLAY_CLASS} {
        padding: 0;
        align-items: flex-end;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-dialog {
        width: 100%;
        /* 移动端占满视口高度。用视口单位而非 height:100%，后者依赖祖先链有确定高度，
           在部分移动布局下会塌成 0（表现为窗口看不见）。 */
        height: 100vh;
        height: 100dvh;
        max-height: 100vh;
        max-height: 100dvh;
        border-radius: 0;
        border: none;
    }

    /* 移动端贴底显示，操作区下移到底部更易单手触达：
       标题 → 列表 → 搜索/关闭 → 筛选/分页。 */
    .${OVERLAY_CLASS} .bai-bai-floor-head {
        order: 0;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-list {
        order: 1;
        min-height: 0;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-mobile-top-row {
        order: 3;
        flex: 0 0 auto;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-mobile-bottom-row {
        order: 2;
        flex: 0 0 auto;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px 0;
        border-top: 1px solid var(--SmartThemeBorderColor);
    }

    /* 顶部关闭键移动端隐藏，由底部操作行的关闭键代替。 */
    .${OVERLAY_CLASS} .bai-bai-floor-head .bai-bai-floor-close {
        display: none;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-mobile-only {
        display: inline-flex;
    }

    /* 底部最后一行：左侧身份筛选，右侧分页。 */
    .${OVERLAY_CLASS} .bai-bai-floor-controls {
        margin: 0;
        padding: 10px 0 10px 16px;
        flex-wrap: nowrap;
        justify-content: flex-start;
        min-width: 0;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-filter {
        margin-left: 0;
    }

    .${OVERLAY_CLASS} .bai-bai-floor-pager {
        flex: 0 0 auto;
        justify-content: flex-end;
        gap: 8px;
        padding: 0;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-pager:not(:empty) {
        padding: 8px 16px 8px 0;
        border-top: none;
    }

    /* 底部上一行：搜索框占满剩余宽度，关闭按钮固定在右侧。 */
    .${OVERLAY_CLASS} .bai-bai-floor-bar {
        flex: 1 1 auto;
        min-width: 0;
        height: 36px;
        margin: 0;
        padding: 0 10px;
        border-radius: 8px;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-input {
        font-size: 0.9rem;
    }
    .${OVERLAY_CLASS} .bai-bai-floor-mobile-bottom-row > .bai-bai-floor-mobile-only {
        flex: 0 0 auto;
        width: 36px;
        height: 36px;
        margin: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .${OVERLAY_CLASS},
    .${OVERLAY_CLASS} .bai-bai-floor-dialog {
        animation: none;
    }
}
`;
}
