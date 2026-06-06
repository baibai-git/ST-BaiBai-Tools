# 柏宝箱

This extension packages a small set of SillyTavern responsiveness fixes as a third-party extension.

Current version: `0.22.0`

What it does:

- Guards `AutoComplete` reposition work so inactive instances do not recompute layout on every mobile `resize`
- Replaces the stock `power-user` window `resize` handler with a version that exits early on mobile before expensive autocomplete and hotswap refresh work runs
- Speeds up opening the chat file manager for normal character chats by rendering a lightweight file-name list first, then using one full metadata request to fill in file size, message count, date, and preview text
- Opens normal character recent chats from the welcome page directly to the clicked chat file, avoiding an intermediate render of the character's previously active chat
- Skips unnecessary translation extension work on message update events when automatic translation is disabled and the message has no translated display cache, avoiding repeated full-chat saves in long chats
- Optimizes long-chat DOM rendering by auto-scrolling to the bottom after chat load, applying `content-visibility` to visible message floors when the current DOM text volume is high, caching placeholder heights, and using a temporary bottom anchor while the initial bottom scroll settles
- Speeds up opening and closing World Info entry editors by skipping the expensive height animation for top-level entry drawers, keeping initialized editors alive while collapsed, and lazily initializing heavier Select2 controls and character filter options
- Speeds up OpenAI preset switching by letting the mobile preset select close first, rendering the prompt list immediately, suppressing the stock one-second delayed rebuild for that switch, and refreshing token counts afterward
- Replaces prompt preset dragging with a non-reflow drag preview that moves a floating clone, shows an insertion line, and only reorders the list when dropped
- Speeds up prompt preset toggles and saves by updating only the affected prompt row immediately, then refreshing token counts after a short debounce instead of rebuilding the whole prompt list on every click
- Speeds up existing regex script toggles, edits, deletes, and drag sorting by updating the affected regex row or order without rebuilding all regex lists
- Adds a `预设内容 CodeMirror 编辑器` switch that replaces the OpenAI prompt entry content textarea, including SillyTavern's expanded editor, while keeping the original form fields synchronized for saves
- Optionally saves the current OpenAI preset after a prompt entry edit is saved; this switch is off by default
- Allows double or triple clicking on a message text bubble to quickly open the message editor for that message floor
- Allows the message editor to open immediately after deleting messages with SillyTavern's delete-message mode, and submits that fast-opened edit before replaying common generation actions
- Prevents mobile auto-focus from opening the keyboard when entering message edit mode, opening the chat file manager, entering a character chat, or when SillyTavern automatically refocuses the chat input while preserving manual input focus
- Suppresses chat scroll compensation caused by mobile keyboard layout resize while editing messages
- Adds a separate `切换美化优化` (Custom CSS Shadow Property) switch that completely intercepts native `#customCSS` writes and redirects them to a virtual JavaScript memory property, physically preventing browser reflow and repaint freezes caused by large CSS string assignments during theme switches
- Adds a separate `自定义CSS CodeMirror 编辑器` switch that replaces the visible `#customCSS` textarea and SillyTavern's expanded custom-CSS editor with CodeMirror, applies the stylesheet after editing, avoids native textarea and stylesheet work during IME composition, and gives CSS punctuation theme-aware highlighting
- Adds an experimental CodeMirror 6 role-description editor mode that replaces the visible long textarea with a lightweight editor and restores SillyTavern's original textarea if CodeMirror cannot be loaded
- Adds a SillyTavern extension settings panel with separate switches for the responsiveness, chat file manager, and prompt preset features

The chat file manager optimization only applies when:

- the request is for `/api/chats/search`
- the search query is empty
- the current target is a normal character chat, not a group chat

Keyword searches and group chats fall back to SillyTavern's original `/api/chats/search` behavior.

The prompt preset switch optimization only applies to the OpenAI/chat-completion prompt manager. It applies prompt list fields before the rest of the preset switch finishes so the list can repaint earlier. Its fast renderer uses indexed prompt lookups and delegated row actions to avoid repeated per-row searches and listener binding. When deleting the selected OpenAI preset, it selects the next preset in the list, or the first preset when deleting the last one. It preserves SillyTavern's original behavior when disabled.

The prompt preset drag optimization only applies to the OpenAI/chat-completion prompt manager list. It is enabled by default. When enabled, it bypasses the stock jQuery UI sortable behavior so nearby prompt rows do not move out of the way while dragging. The original row keeps its layout slot, a floating clone follows the pointer, an insertion line previews the drop target, and the prompt order is saved only after dropping. On mobile, prompt rows use long press to start dragging, while normal scrolling cancels the pending drag. A separate mobile switch controls whether the whole row can start a drag; this mobile whole-row switch is disabled by default, so only the left drag handle starts mobile dragging unless enabled. The feature switch restores SillyTavern's original sortable behavior when disabled.

The prompt preset quick-operation optimization only applies to existing rows in the OpenAI/chat-completion prompt manager list. New prompt creation still falls back to SillyTavern's original behavior because it changes the available prompt list. The feature switch preserves SillyTavern's original behavior when disabled.

The regex quick-operation optimization only applies to existing regex rows. It intercepts single-row enable/disable, edit, and delete clicks, then updates the affected row directly. It also replaces the regex list sortable stop handler so drag sorting saves the new order without immediately rebuilding the global, preset, and scoped regex lists. Regex creation, bulk operations, imports, and preset application still use SillyTavern's original full refresh behavior.

The prompt preset content CodeMirror editor is enabled by default. It replaces the prompt entry content textarea and its expanded editor with a plain CodeMirror editor, flushes content back to SillyTavern before saving, supports read-only marker prompts, and falls back to the original textarea if CodeMirror cannot be loaded.

The prompt entry auto-save feature is disabled by default. When enabled, saving an OpenAI prompt entry also triggers the current OpenAI preset save action after the prompt edit has been written.

The delete-message edit flow optimization only applies shortly after confirming SillyTavern's delete-message dialog. It opens the requested message editor directly during that cleanup window, then delays common send, regenerate, continue, and impersonate clicks until the fast-opened edit has been submitted. The feature switch preserves SillyTavern's original behavior when disabled.

The translation update-event save optimization is enabled by default. It only skips the translation extension's `MESSAGE_UPDATED` listener when automatic translation is off and the updated message does not already have translated display text. When translation automation or cached translation output is present, the original listener still runs.

The long-chat DOM render optimization is enabled by default. It activates only when the currently rendered chat floor text is large enough, then applies `content-visibility` and intrinsic height hints to message floors to reduce off-screen layout and paint work. During initial chat load it uses a temporary bottom anchor so late height changes keep the bottom pinned; the anchor is removed after the initial bottom scroll settles.

For local testing inside this repository, the extension can live under:

- `public/scripts/extensions/third-party/SillyTavern-Mobile-Resize-Guard`

For end-user Git installation through SillyTavern's third-party extension installer, publish the contents of this folder at the root of a separate repository so that `manifest.json` is at the repository root.
