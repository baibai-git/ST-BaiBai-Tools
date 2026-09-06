import { event_types } from '@sillytavern/script';

const CURRENT_VERSION = __BBT_VERSION__;

const LOG_PREFIX = '[柏宝箱]';
const SETTINGS_KEY = 'baiBaiToolkit';
const EXTENSION_KEY = '__baiBaiToolkitExtensionInstalled';
const FAST_SETTINGS_BOOTSTRAP_FETCH_KEY = '__baiBaiToolkitFastSettingsBootstrapFetchPatched';
const FAST_CHARACTER_LIST_FETCH_KEY = '__baiBaiToolkitFastCharacterListFetchPatched';
const BAIBAOKU_EARLY_BRIDGE_KEY = '__baibaokuEarlyBridge';
const LAZY_THEME_CHANGE_GUARD_KEY = '__baiBaiToolkitLazyThemeChangeGuard';
const RELOAD_GREETING_GUARD_KEY = '__baiBaiToolkitReloadGuard';
const BAIBAOKU_STATUS_URL = '/api/plugins/baibaoku/v1/status';
const BAIBAOKU_FAST_CONFIG_URL = '/api/plugins/baibaoku/v1/fast-config';
const BAIBAOKU_FAST_CHAT_GET_URL = '/api/plugins/baibaoku/v1/chats/fast-get';
const BAIBAOKU_THEME_GET_URL = '/api/plugins/baibaoku/v1/themes/get';
const BAIBAOKU_REQUIRED_BACKEND_VERSION = '0.4.3';
const BAIBAOKU_PRESET_AUTO_BACKUP_MIN_VERSION = '0.4.4';
const BAIBAOKU_THEME_LOADING_STYLE_ID = 'bai_bai_toolkit_theme_loading_style';
const BAIBAOKU_THEME_LOADING_HOST_CLASS = 'bai-bai-toolkit-theme-loading-host';
const BAIBAOKU_THEME_LOADING_OVERLAY_CLASS = 'bai-bai-toolkit-theme-loading-overlay';
const BAIBAOKU_THEME_LOADING_FIXED_CLASS = 'bai-bai-toolkit-theme-loading-overlay-fixed';
const BAIBAOKU_THEME_LOADING_SPINNER_CLASS = 'bai-bai-toolkit-theme-loading-spinner';
const THEME_CACHE_SYNC_FETCH_KEY = '__baiBaiToolkitThemeCacheSyncFetchPatched';
const THEME_SAVE_PATH = '/api/themes/save';
const THEME_DELETE_PATH = '/api/themes/delete';
const THEME_MANAGER_PANEL_SELECTOR = '#theme-manager-panel';
const THEME_MANAGER_BACKGROUND_BINDINGS_KEY = 'themeManager_backgroundBindings';
const THEME_MANAGER_THEME_ITEM_SELECTOR = `${THEME_MANAGER_PANEL_SELECTOR} .theme-item[data-value]`;
const THEME_MANAGER_BACKGROUND_SELECTOR = '#bg_menu_content .bg_example, #bg_custom_content .bg_example';
const BAIBAOKU_SAVE_GENERATE_URL = '/api/plugins/baibaoku/v1/chats/save-generate';
const BAIBAOKU_SAVE_GENERATE_DISCARD_URL = `${BAIBAOKU_SAVE_GENERATE_URL}/discard`;
const BAIBAOKU_STATUS_TIMEOUT_MS = 3000;
const BAIBAOKU_PANEL_STATUS_CACHE_MS = 5 * 60_000;
const SAVE_GENERATE_FETCH_KEY = '__baiBaiToolkitSaveGenerateFetchPatched';
const SAVE_GENERATE_PATH = '/api/backends/chat-completions/generate';
const SAVE_GENERATE_SAVE_PATH = '/api/chats/save';
const SAVE_GENERATE_STATUS_HEADER = 'x-baibaoku-save-generate-status';
const SAVE_GENERATE_JOB_ID_HEADER = 'x-baibaoku-save-generate-job-id';
const SAVE_GENERATE_POLL_INTERVAL_MS = 1000;
const SAVE_GENERATE_POLL_TIMEOUT_MS = 30 * 60_000;
const SAVE_GENERATE_RESUME_CHECK_DELAY_MS = 250;
const SAVE_GENERATE_RESUME_CHECK_COOLDOWN_MS = 1500;
const SAVE_GENERATE_INTENT_TTL_MS = 120_000;
const SAVE_GENERATE_MAX_INTENTS = 8;
const SAVE_GENERATE_SEEN_STORAGE_PREFIX = 'bai_bai_toolkit_save_generate_seen';
const SAVE_GENERATE_DISPLAY_STYLE_ID = 'bai_bai_toolkit_save_generate_display_style';
const SAVE_GENERATE_DISPLAY_CLASS = 'bai-bai-save-generate-display';
const SAVE_GENERATE_RECOVERY_BLOCK_SELECTOR = '#send_but, #option_regenerate';
const SAVE_GENERATE_RECOVERY_BLOCK_TOAST_INTERVAL_MS = 1500;
const SAVE_GENERATE_RECOVERY_CHAT_READY_TIMEOUT_MS = 3000;
const SAVE_GENERATE_RECOVERY_CHAT_READY_INTERVAL_MS = 100;
const SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY = 'saveGenerateDefaultEnabledMigrated';
const SAVE_GENERATE_BACKEND_CHECK_TTL_MS = 60_000;
const SAVE_GENERATE_BACKEND_MISSING_RECHECK_MS = 10_000;
const SAVE_GENERATE_BACKEND_CHECK_TIMEOUT_MS = 1500;
const SAVE_GENERATE_LOCAL_REQUEST_GUARD_RELEASE_DELAY_MS = 1000;
const GENERATE_RETRY_FETCH_KEY = '__baiBaiToolkitGenerateRetryFetchPatched';
// 酒馆本体消息生成会打到的后端路径;柏宝库 save-generate 走自己的地址,不在其中。
const GENERATE_RETRY_PATHS = new Set([
    '/api/backends/chat-completions/generate',
    '/api/backends/text-completions/generate',
    '/api/backends/kobold/generate',
    '/api/novelai/generate',
]);
// Generate() 里会产出消息的类型;quiet 属于后台工具生成,不重试。
const GENERATE_RETRY_MESSAGE_TYPES = new Set([
    'normal',
    'regenerate',
    'swipe',
    'continue',
    'impersonate',
]);
const GENERATE_RETRY_MIN_RETRIES = 1;
const GENERATE_RETRY_MAX_RETRIES = 10;
const GENERATE_RETRY_DEFAULT_RETRIES = 3;
const GENERATE_RETRY_WINDOW_TTL_MS = 60_000;
const GENERATE_RETRY_BODY_TTL_MS = 60_000;
const GENERATE_RETRY_MAX_PENDING_BODIES = 4;
const GENERATE_RETRY_BASE_DELAY_MS = 1500;
const GENERATE_RETRY_MAX_DELAY_MS = 15_000;
const GENERATE_RETRY_REASON_MAX_LENGTH = 60;
// 配置或提示词本身的问题重发多少次都一样,直接交回酒馆报错;499 是柏宝库的「已取消」。
const GENERATE_RETRY_PERMANENT_STATUSES = new Set([400, 401, 403, 404, 413, 422, 499]);
const SAVE_REQUEST_GZIP_FETCH_KEY = '__baiBaiToolkitSaveRequestGzipFetchPatched';
const FAST_CHAT_GET_FETCH_KEY = '__baiBaiToolkitFastChatGetFetchPatched';
const FAST_CHAT_GET_JQUERY_TRIGGER_GUARD_KEY = '__baiBaiToolkitFastChatGetJQueryTriggerGuardPatched';
const PERFORMANCE_TRACE_FETCH_KEY = '__baiBaiToolkitPerformanceTraceFetchPatched';
const TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY = '__baiBaiToolkitTranslateMessageUpdatedOptimized';
const CUSTOM_CSS_INPUT_OPTIMIZATION_KEY = '__baiBaiToolkitCustomCssInputOptimized';
const CUSTOM_CSS_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitCustomCssCodeMirrorEditor';
const PAGE_RESTORE_SELECTION_GUARD_KEY = '__baiBaiToolkitPageRestoreSelectionGuard';
const DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_description_codemirror_editor_style';
const CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_custom_css_codemirror_editor_style';
const DESCRIPTION_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitDescriptionCodeMirrorEditor';
const DESCRIPTION_CODEMIRROR_MODULES_KEY = '__baiBaiToolkitDescriptionCodeMirrorModules';
const BAIBAOKU_THEME_POWER_USER_KEYS = [
    'main_text_color',
    'italics_text_color',
    'underline_text_color',
    'quote_text_color',
    'blur_tint_color',
    'chat_tint_color',
    'user_mes_blur_tint_color',
    'bot_mes_blur_tint_color',
    'shadow_color',
    'border_color',
    'blur_strength',
    'custom_css',
    'shadow_width',
    'font_scale',
    'fast_ui_mode',
    'waifuMode',
    'chat_display',
    'toastr_position',
    'avatar_style',
    'noShadows',
    'chat_width',
    'timer_enabled',
    'timestamps_enabled',
    'timestamp_model_icon',
    'message_token_count_enabled',
    'mesIDDisplay_enabled',
    'hideChatAvatars_enabled',
    'expand_message_actions',
    'enableZenSliders',
    'enableLabMode',
    'hotswap_enabled',
    'bogus_folders',
    'zoomed_avatar_magnification',
    'reduced_motion',
    'compact_input_area',
    'show_swipe_num_all_messages',
    'click_to_edit',
    'media_display',
];
const BAIBAOKU_THEME_COLOR_BINDINGS = [
    { key: 'main_text_color', selector: '#main-text-color-picker', variable: '--SmartThemeBodyColor' },
    { key: 'italics_text_color', selector: '#italics-color-picker', variable: '--SmartThemeEmColor' },
    { key: 'underline_text_color', selector: '#underline-color-picker', variable: '--SmartThemeUnderlineColor' },
    { key: 'quote_text_color', selector: '#quote-color-picker', variable: '--SmartThemeQuoteColor' },
    { key: 'blur_tint_color', selector: '#blur-tint-color-picker', variable: '--SmartThemeBlurTintColor', metaTheme: true },
    { key: 'chat_tint_color', selector: '#chat-tint-color-picker', variable: '--SmartThemeChatTintColor' },
    { key: 'user_mes_blur_tint_color', selector: '#user-mes-blur-tint-color-picker', variable: '--SmartThemeUserMesBlurTintColor' },
    { key: 'bot_mes_blur_tint_color', selector: '#bot-mes-blur-tint-color-picker', variable: '--SmartThemeBotMesBlurTintColor' },
    { key: 'shadow_color', selector: '#shadow-color-picker', variable: '--SmartThemeShadowColor' },
    { key: 'border_color', selector: '#border-color-picker', variable: '--SmartThemeBorderColor' },
];
const REGEX_QUICK_OPERATION_HANDLER_KEY = '__baiBaiToolkitRegexQuickOperationHandler';
const REGEX_QUICK_OPERATION_OBSERVER_KEY = '__baiBaiToolkitRegexQuickOperationObserver';
const REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY = '__baiBaiToolkitRegexQuickOperationImportHandler';
const REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY = '__baiBaiToolkitRegexPendingChangesLifecycleHandler';
const REGEX_VUE_MANAGER_CLICK_HANDLER_KEY = '__baiBaiToolkitRegexVueManagerClickHandler';
const REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY = '__baiBaiToolkitRegexVueScopedContextHandler';
const REGEX_VUE_PRESET_RENAME_HANDLER_KEY = '__baiBaiToolkitRegexVuePresetRenameHandler';
const REGEX_PRESET_GROUP_PORTABILITY_HANDLER_KEY = '__baiBaiToolkitRegexPresetGroupPortabilityHandler';
const REGEX_VUE_NATIVE_RENDER_GUARD_KEY = '__baiBaiToolkitRegexVueNativeRenderGuard';
const REGEX_VUE_MANAGER_ROOT_ID = 'bai_bai_toolkit_regex_vue_manager_root';
const REGEX_VUE_MANAGER_STYLE_ID = 'bai_bai_toolkit_regex_vue_manager_style';
const CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY = '__baiBaiToolkitCharacterListAvatarLazyLoad';
const CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID = 'bai_bai_toolkit_character_list_avatar_lazy_load_style';
const REGEX_UNGROUPED_GROUP_ID = '__ungrouped';
const REGEX_PENDING_ASSIGNMENT_GROUP_ID = '__pending_assignment';
const REGEX_PRESET_GROUP_EXTENSION_PATH = 'baibaiToolkit.regexGroups';
const REGEX_PRESET_GROUP_EXTENSION_VERSION = 1;
const REGEX_VUE_DROP_TARGET_CLASS = 'bai-bai-regex-drop-target';
const REGEX_VUE_DRAG_INDICATOR_CLASS = 'bai-bai-regex-drag-indicator';
const REGEX_VUE_DRAGGING_BODY_CLASS = 'bai-bai-regex-vue-dragging';
const REGEX_VUE_GROUP_EXPAND_ANIMATION_MS = 180;
const REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS = 260;
const REGEX_VUE_POINTER_START_THRESHOLD_PX = 4;
const REGEX_VUE_TOUCH_START_THRESHOLD_PX = 10;
const REGEX_VUE_EMPTY_INSERT_THRESHOLD_PX = 40;
const REGEX_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX = 6;
const REGEX_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS = 350;
const DESCRIPTION_EDITOR_SOURCE_SELECTOR = '#description_textarea';
const DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS = 'bai-bai-toolkit-description-source-hidden';
const DESCRIPTION_CODEMIRROR_EDITOR_ID = 'bai_bai_description_codemirror_editor';
const DESCRIPTION_CODEMIRROR_EDITOR_CLASS = 'bai-bai-toolkit-description-codemirror-editor';
const DESCRIPTION_CODEMIRROR_BLUR_SAVE_DELAY_MS = 250;
const DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH = 12000;
const CUSTOM_CSS_INPUT_ID = 'customCSS';
const CUSTOM_CSS_MAXIMIZED_SOURCE_SELECTOR = 'textarea.maximized_textarea[data-for="customCSS"]';
const CUSTOM_CSS_STYLE_ID = 'custom-style';
const CUSTOM_CSS_HOST_SELECTOR = '#CustomCSS-textAreaBlock';
const CUSTOM_CSS_SETTINGS_PANEL_SELECTOR = '#UI-Customization';
const CUSTOM_CSS_CODEMIRROR_EDITOR_ID = 'bai_bai_custom_css_codemirror_editor';
const CUSTOM_CSS_CODEMIRROR_EDITOR_CLASS = 'bai-bai-toolkit-custom-css-codemirror-editor';
const CUSTOM_CSS_SOURCE_HIDDEN_CLASS = 'bai-bai-toolkit-custom-css-source-hidden';
const CUSTOM_CSS_HOST_CLASS = 'bai-bai-toolkit-custom-css-host';
const CUSTOM_CSS_LAYOUT_CLASS = 'bai-bai-toolkit-custom-css-layout';
const CUSTOM_CSS_LIGHT_THEME_CLASS = 'bai-bai-toolkit-custom-css-theme-light';
const CUSTOM_CSS_DARK_THEME_CLASS = 'bai-bai-toolkit-custom-css-theme-dark';
const CUSTOM_CSS_MAXIMIZED_CLASS = 'bai-bai-toolkit-custom-css-maximized';
const CUSTOM_CSS_CODEMIRROR_EXTERNAL_READ_SELECTOR = [
    '#vce-btn-refresh-new',
    '#vce-btn-save-new',
    '#native-btn-save-new',
    '#native-btn-scroll-new',
    '#native-css-search-new',
    '#native-search-dropdown-new .vce-search-item-new',
].join(', ');
const CUSTOM_CSS_DARK_BACKGROUND_LUMINANCE_THRESHOLD = 0.45;
// 指数退避:首个 microtask + rAF 已覆盖立即同步,settle 只兜底晚到的原生写入。
const CUSTOM_CSS_THEME_SYNC_SETTLE_DELAYS_MS = [80, 320, 1000];
const THEME_APPLY_REFLOW_GUARD_WINDOW_MS = 1500;
const THEME_APPLY_REFLOW_GUARD_PATCH_KEY = '__baiBaiToolkitThemeApplyReflowGuardPatched';
const THEME_APPLY_REFLOW_GUARD_METRICS = ['scrollHeight', 'clientHeight'];
const CUSTOM_CSS_RESTORE_SYNC_SETTLE_DELAYS_MS = [0, 80, 200, 500];

const CHARACTER_SEARCH_OPTIMIZATION_KEY = 'baiBaiToolkitCharacterSearchOptimization';
const REGEX_CONTAINER_SELECTOR = '#regex_container';
const REGEX_EXTENSIONS_PANEL_SELECTOR = '#rm_extensions_block';
const REGEX_SCRIPT_ROW_SELECTOR = '.regex-script-label';
const REGEX_SCRIPT_LIST_SELECTOR = '#saved_regex_scripts, #saved_scoped_scripts, #saved_preset_scripts';
const REGEX_CHAT_RELOAD_VISIBILITY_CHECK_DELAY_MS = 120;
const REGEX_CHAT_RELOAD_VISIBILITY_FALLBACK_DELAY_MS = 1000;
const CHARACTER_LIST_SELECTOR = '#rm_print_characters_block';
const CHARACTER_LIST_AVATAR_SELECTOR = `${CHARACTER_LIST_SELECTOR} .character_select .avatar img`;
const PERSONA_LIST_SELECTOR = '#user_avatar_block';
const PERSONA_LIST_AVATAR_SELECTOR = `${PERSONA_LIST_SELECTOR} .avatar-container .avatar img`;
const WELCOME_RECENT_CHAT_SELECTOR = '.welcomePanel .recentChat';
const WELCOME_RECENT_CHAT_AVATAR_SELECTOR = `${WELCOME_RECENT_CHAT_SELECTOR} .avatar img`;
const AVATAR_LAZY_LOAD_APPEND_TARGET_SELECTOR = `${CHARACTER_LIST_SELECTOR}, ${PERSONA_LIST_SELECTOR}`;
const AVATAR_LAZY_LOAD_NATIVE_APPEND_TARGET_SELECTOR = '#chat';
const AVATAR_LAZY_LOAD_SELECTOR = [
    CHARACTER_LIST_AVATAR_SELECTOR,
    PERSONA_LIST_AVATAR_SELECTOR,
    WELCOME_RECENT_CHAT_AVATAR_SELECTOR,
].join(', ');
const AVATAR_LAZY_LOAD_RELATIVE_SELECTOR = [
    '.character_select .avatar img',
    '.avatar-container .avatar img',
    `${WELCOME_RECENT_CHAT_SELECTOR} .avatar img`,
].join(', ');
const CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY = 'baiBaiToolkitLazyAvatarSrc';
const CHARACTER_LIST_LAZY_AVATAR_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS = 'bai-bai-toolkit-lazy-avatar-pending';
const CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS = 'bai-bai-toolkit-lazy-avatar-loaded';
const CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS = 'bai-bai-toolkit-lazy-avatar-shell';
const CHARACTER_LIST_LAZY_AVATAR_ROOT_MARGIN = '800px 0px 1200px 0px';
const SAVE_REQUEST_GZIP_PATHS = new Set([
    '/api/chats/save',
    '/api/chats/group/save',
]);
const FAST_CHAT_GET_PATHS = new Set([
    '/api/chats/get',
    '/api/chats/group/get',
]);
const FAST_CHAT_GET_SAVE_PATHS = new Set([
    '/api/chats/save',
    '/api/chats/group/save',
]);
const FAST_CHAT_GET_DEFAULT_THRESHOLD_BYTES = 2 * 1024 * 1024;
const FAST_CHAT_GET_DEFAULT_INITIAL_MESSAGES = 5;
const FAST_CHAT_GET_ACTION_SELECTOR = [
    '#send_but',
    '#option_regenerate',
    '#option_continue',
    '#option_impersonate',
    '#option_delete_mes',
    '#mes_continue',
    '#mes_impersonate',
    '#dialogue_del_mes_ok',
    '#chat .mes_edit',
    '#chat .mes_edit_done',
    '#chat .mes_delete',
    '#chat .del_mes',
    '#chat .swipe_left',
    '#chat .swipe_right',
    '#show_more_messages',
].join(', ');
const FAST_SETTINGS_BOOTSTRAP_CACHE_MS = 15_000;
const PERFORMANCE_TRACE_FETCH_PATHS = new Set([
    '/api/chats/get',
    '/api/chats/group/get',
    '/api/chats/save',
    '/api/chats/group/save',
    '/api/chats/search',
    '/api/characters/chats',
]);
const PERFORMANCE_TRACE_MAX_LINES = 2000;
const PERFORMANCE_TRACE_MAX_LINE_LENGTH = 700;
const PERFORMANCE_TRACE_SLOW_MS = 16;
const PERFORMANCE_TRACE_LISTENER_LOG_MS = 8;
const PERFORMANCE_TRACE_DEDUPE_MS = 250;
const PERFORMANCE_TRACE_EVENTS = new Set([
    event_types.CHAT_LOADED,
    event_types.CHAT_CHANGED,
    event_types.MORE_MESSAGES_LOADED,
    event_types.MESSAGE_SENT,
    event_types.USER_MESSAGE_RENDERED,
    event_types.MESSAGE_RECEIVED,
    event_types.CHARACTER_MESSAGE_RENDERED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_UPDATED,
    event_types.MESSAGE_DELETED,
    event_types.MESSAGE_SWIPED,
    event_types.MESSAGE_SWIPE_DELETED,
    event_types.MESSAGE_FILE_EMBEDDED,
    event_types.MESSAGE_REASONING_EDITED,
    event_types.MESSAGE_REASONING_DELETED,
    event_types.GENERATION_STARTED,
    event_types.GENERATION_AFTER_COMMANDS,
    event_types.GENERATE_BEFORE_COMBINE_PROMPTS,
    event_types.GENERATE_AFTER_COMBINE_PROMPTS,
    event_types.GENERATE_AFTER_DATA,
    event_types.CHAT_COMPLETION_PROMPT_READY,
    event_types.GENERATION_STOPPED,
    event_types.GENERATION_ENDED,
    event_types.IMPERSONATE_READY,
].filter(Boolean));
const PERFORMANCE_TRACE_INTERACTION_SELECTOR = [
    '#send_but',
    '#option_regenerate',
    '#option_continue',
    '#option_impersonate',
    '#mes_continue',
    '#mes_impersonate',
    '#chat .mes_edit',
    '#chat .mes_edit_done',
    '#chat .mes_edit_cancel',
    '#chat .swipe_left',
    '#chat .swipe_right',
    '#chat .mes_translate',
    '#show_more_messages',
].join(', ');

export {
    AVATAR_LAZY_LOAD_APPEND_TARGET_SELECTOR,
    AVATAR_LAZY_LOAD_NATIVE_APPEND_TARGET_SELECTOR,
    AVATAR_LAZY_LOAD_RELATIVE_SELECTOR,
    AVATAR_LAZY_LOAD_SELECTOR,
    BAIBAOKU_EARLY_BRIDGE_KEY,
    BAIBAOKU_FAST_CHAT_GET_URL,
    BAIBAOKU_FAST_CONFIG_URL,
    BAIBAOKU_PANEL_STATUS_CACHE_MS,
    BAIBAOKU_PRESET_AUTO_BACKUP_MIN_VERSION,
    BAIBAOKU_REQUIRED_BACKEND_VERSION,
    BAIBAOKU_SAVE_GENERATE_DISCARD_URL,
    BAIBAOKU_SAVE_GENERATE_URL,
    BAIBAOKU_STATUS_TIMEOUT_MS,
    BAIBAOKU_STATUS_URL,
    BAIBAOKU_THEME_COLOR_BINDINGS,
    BAIBAOKU_THEME_GET_URL,
    BAIBAOKU_THEME_LOADING_FIXED_CLASS,
    BAIBAOKU_THEME_LOADING_HOST_CLASS,
    BAIBAOKU_THEME_LOADING_OVERLAY_CLASS,
    BAIBAOKU_THEME_LOADING_SPINNER_CLASS,
    BAIBAOKU_THEME_LOADING_STYLE_ID,
    BAIBAOKU_THEME_POWER_USER_KEYS,
    CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY,
    CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID,
    CHARACTER_LIST_AVATAR_SELECTOR,
    CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS,
    CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS,
    CHARACTER_LIST_LAZY_AVATAR_PLACEHOLDER_SRC,
    CHARACTER_LIST_LAZY_AVATAR_ROOT_MARGIN,
    CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS,
    CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY,
    CHARACTER_LIST_SELECTOR,
    CHARACTER_SEARCH_OPTIMIZATION_KEY,
    CURRENT_VERSION,
    CUSTOM_CSS_CODEMIRROR_EDITOR_CLASS,
    CUSTOM_CSS_CODEMIRROR_EDITOR_ID,
    CUSTOM_CSS_CODEMIRROR_EDITOR_KEY,
    CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID,
    CUSTOM_CSS_CODEMIRROR_EXTERNAL_READ_SELECTOR,
    CUSTOM_CSS_DARK_BACKGROUND_LUMINANCE_THRESHOLD,
    CUSTOM_CSS_DARK_THEME_CLASS,
    CUSTOM_CSS_HOST_CLASS,
    CUSTOM_CSS_HOST_SELECTOR,
    CUSTOM_CSS_INPUT_ID,
    CUSTOM_CSS_INPUT_OPTIMIZATION_KEY,
    CUSTOM_CSS_LAYOUT_CLASS,
    CUSTOM_CSS_LIGHT_THEME_CLASS,
    CUSTOM_CSS_MAXIMIZED_CLASS,
    CUSTOM_CSS_MAXIMIZED_SOURCE_SELECTOR,
    CUSTOM_CSS_RESTORE_SYNC_SETTLE_DELAYS_MS,
    CUSTOM_CSS_SETTINGS_PANEL_SELECTOR,
    CUSTOM_CSS_SOURCE_HIDDEN_CLASS,
    CUSTOM_CSS_STYLE_ID,
    CUSTOM_CSS_THEME_SYNC_SETTLE_DELAYS_MS,
    DESCRIPTION_CODEMIRROR_BLUR_SAVE_DELAY_MS,
    DESCRIPTION_CODEMIRROR_EDITOR_CLASS,
    DESCRIPTION_CODEMIRROR_EDITOR_ID,
    DESCRIPTION_CODEMIRROR_EDITOR_KEY,
    DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID,
    DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH,
    DESCRIPTION_CODEMIRROR_MODULES_KEY,
    DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS,
    DESCRIPTION_EDITOR_SOURCE_SELECTOR,
    EXTENSION_KEY,
    FAST_CHARACTER_LIST_FETCH_KEY,
    FAST_CHAT_GET_ACTION_SELECTOR,
    FAST_CHAT_GET_DEFAULT_INITIAL_MESSAGES,
    FAST_CHAT_GET_DEFAULT_THRESHOLD_BYTES,
    FAST_CHAT_GET_FETCH_KEY,
    FAST_CHAT_GET_JQUERY_TRIGGER_GUARD_KEY,
    FAST_CHAT_GET_PATHS,
    FAST_CHAT_GET_SAVE_PATHS,
    FAST_SETTINGS_BOOTSTRAP_CACHE_MS,
    FAST_SETTINGS_BOOTSTRAP_FETCH_KEY,
    GENERATE_RETRY_BASE_DELAY_MS,
    GENERATE_RETRY_BODY_TTL_MS,
    GENERATE_RETRY_DEFAULT_RETRIES,
    GENERATE_RETRY_FETCH_KEY,
    GENERATE_RETRY_MAX_DELAY_MS,
    GENERATE_RETRY_MAX_PENDING_BODIES,
    GENERATE_RETRY_MAX_RETRIES,
    GENERATE_RETRY_MESSAGE_TYPES,
    GENERATE_RETRY_MIN_RETRIES,
    GENERATE_RETRY_PATHS,
    GENERATE_RETRY_PERMANENT_STATUSES,
    GENERATE_RETRY_REASON_MAX_LENGTH,
    GENERATE_RETRY_WINDOW_TTL_MS,
    LAZY_THEME_CHANGE_GUARD_KEY,
    LOG_PREFIX,
    PAGE_RESTORE_SELECTION_GUARD_KEY,
    PERFORMANCE_TRACE_DEDUPE_MS,
    PERFORMANCE_TRACE_EVENTS,
    PERFORMANCE_TRACE_FETCH_KEY,
    PERFORMANCE_TRACE_FETCH_PATHS,
    PERFORMANCE_TRACE_INTERACTION_SELECTOR,
    PERFORMANCE_TRACE_LISTENER_LOG_MS,
    PERFORMANCE_TRACE_MAX_LINES,
    PERFORMANCE_TRACE_MAX_LINE_LENGTH,
    PERFORMANCE_TRACE_SLOW_MS,
    PERSONA_LIST_AVATAR_SELECTOR,
    PERSONA_LIST_SELECTOR,
    REGEX_CHAT_RELOAD_VISIBILITY_CHECK_DELAY_MS,
    REGEX_CHAT_RELOAD_VISIBILITY_FALLBACK_DELAY_MS,
    REGEX_CONTAINER_SELECTOR,
    REGEX_EXTENSIONS_PANEL_SELECTOR,
    REGEX_PENDING_ASSIGNMENT_GROUP_ID,
    REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY,
    REGEX_PRESET_GROUP_EXTENSION_PATH,
    REGEX_PRESET_GROUP_EXTENSION_VERSION,
    REGEX_PRESET_GROUP_PORTABILITY_HANDLER_KEY,
    REGEX_QUICK_OPERATION_HANDLER_KEY,
    REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY,
    REGEX_QUICK_OPERATION_OBSERVER_KEY,
    REGEX_SCRIPT_LIST_SELECTOR,
    REGEX_SCRIPT_ROW_SELECTOR,
    REGEX_UNGROUPED_GROUP_ID,
    REGEX_VUE_DRAGGING_BODY_CLASS,
    REGEX_VUE_DRAG_INDICATOR_CLASS,
    REGEX_VUE_DROP_TARGET_CLASS,
    REGEX_VUE_EMPTY_INSERT_THRESHOLD_PX,
    REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS,
    REGEX_VUE_GROUP_EXPAND_ANIMATION_MS,
    REGEX_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS,
    REGEX_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX,
    REGEX_VUE_MANAGER_CLICK_HANDLER_KEY,
    REGEX_VUE_MANAGER_ROOT_ID,
    REGEX_VUE_MANAGER_STYLE_ID,
    REGEX_VUE_NATIVE_RENDER_GUARD_KEY,
    REGEX_VUE_POINTER_START_THRESHOLD_PX,
    REGEX_VUE_PRESET_RENAME_HANDLER_KEY,
    REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY,
    REGEX_VUE_TOUCH_START_THRESHOLD_PX,
    RELOAD_GREETING_GUARD_KEY,
    SAVE_GENERATE_BACKEND_CHECK_TIMEOUT_MS,
    SAVE_GENERATE_BACKEND_CHECK_TTL_MS,
    SAVE_GENERATE_BACKEND_MISSING_RECHECK_MS,
    SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY,
    SAVE_GENERATE_DISPLAY_CLASS,
    SAVE_GENERATE_DISPLAY_STYLE_ID,
    SAVE_GENERATE_FETCH_KEY,
    SAVE_GENERATE_INTENT_TTL_MS,
    SAVE_GENERATE_JOB_ID_HEADER,
    SAVE_GENERATE_LOCAL_REQUEST_GUARD_RELEASE_DELAY_MS,
    SAVE_GENERATE_MAX_INTENTS,
    SAVE_GENERATE_PATH,
    SAVE_GENERATE_POLL_INTERVAL_MS,
    SAVE_GENERATE_POLL_TIMEOUT_MS,
    SAVE_GENERATE_RECOVERY_BLOCK_SELECTOR,
    SAVE_GENERATE_RECOVERY_BLOCK_TOAST_INTERVAL_MS,
    SAVE_GENERATE_RECOVERY_CHAT_READY_INTERVAL_MS,
    SAVE_GENERATE_RECOVERY_CHAT_READY_TIMEOUT_MS,
    SAVE_GENERATE_RESUME_CHECK_COOLDOWN_MS,
    SAVE_GENERATE_RESUME_CHECK_DELAY_MS,
    SAVE_GENERATE_SAVE_PATH,
    SAVE_GENERATE_SEEN_STORAGE_PREFIX,
    SAVE_GENERATE_STATUS_HEADER,
    SAVE_REQUEST_GZIP_FETCH_KEY,
    SAVE_REQUEST_GZIP_PATHS,
    SETTINGS_KEY,
    THEME_APPLY_REFLOW_GUARD_METRICS,
    THEME_APPLY_REFLOW_GUARD_PATCH_KEY,
    THEME_APPLY_REFLOW_GUARD_WINDOW_MS,
    THEME_CACHE_SYNC_FETCH_KEY,
    THEME_DELETE_PATH,
    THEME_MANAGER_BACKGROUND_BINDINGS_KEY,
    THEME_MANAGER_BACKGROUND_SELECTOR,
    THEME_MANAGER_PANEL_SELECTOR,
    THEME_MANAGER_THEME_ITEM_SELECTOR,
    THEME_SAVE_PATH,
    TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY,
    WELCOME_RECENT_CHAT_AVATAR_SELECTOR,
    WELCOME_RECENT_CHAT_SELECTOR,
};
