import { messageFormatting } from '../../../../script.js';

const CLASS_ROOT = 'bai-bai-save-generate-display';
const CLASS_VISIBLE = 'bai-bai-save-generate-display-visible';
const CLASS_COMPLETE = 'bai-bai-save-generate-display-complete';
const CLASS_STOPPED = 'bai-bai-save-generate-display-stopped';
const CLASS_MINIMIZED = 'bai-bai-save-generate-display-minimized';
const CLASS_LABEL = 'bai-bai-save-generate-display-label';
const CLASS_LABEL_TEXT = 'bai-bai-save-generate-display-label-text';
const CLASS_LED = 'bai-bai-save-generate-display-led';
const CLASS_CONTROLS = 'bai-bai-save-generate-display-controls';
const CLASS_BUTTON = 'bai-bai-save-generate-display-btn';
const CLASS_CONTENT = 'bai-bai-save-generate-display-content';
const CLASS_REASONING = 'bai-bai-save-generate-display-reasoning';
const CLASS_REASONING_LABEL = 'bai-bai-save-generate-display-reasoning-label';
const CLASS_REASONING_CONTENT = 'bai-bai-save-generate-display-reasoning-content';
const CLASS_TEXT = 'bai-bai-save-generate-display-text';
const CLASS_TEXT_CONTENT = 'bai-bai-save-generate-display-text-content';
const HIDE_ANIMATION_MS = 220;

export class SaveGenerateDisplay {
    constructor() {
        this.element = null;
        this.labelText = null;
        this.reasoningSection = null;
        this.reasoningContent = null;
        this.textSection = null;
        this.textContent = null;
        this.stopButton = null;
        this.minimizeButton = null;
        this.closeButton = null;
        this.onStop = null;
        this.hideTimeoutId = null;
        this.hasContent = false;
        this.isMinimized = false;
        this.isComplete = false;
        this.isStopped = false;
    }

    show({ label = '', onStop = null } = {}) {
        if (this.element) {
            this.hide({ instant: true });
        }

        this.isMinimized = false;
        this.isComplete = false;
        this.isStopped = false;
        this.hasContent = false;
        this.onStop = onStop;
        this.clearHideTimeout();

        this.element = document.createElement('div');
        this.element.classList.add(CLASS_ROOT);

        const labelElement = document.createElement('div');
        labelElement.classList.add(CLASS_LABEL);

        const led = document.createElement('span');
        led.classList.add(CLASS_LED);
        labelElement.appendChild(led);

        this.labelText = document.createElement('span');
        this.labelText.classList.add(CLASS_LABEL_TEXT);
        this.labelText.textContent = label;
        labelElement.appendChild(this.labelText);

        const controls = document.createElement('div');
        controls.classList.add(CLASS_CONTROLS);

        if (typeof onStop === 'function') {
            this.stopButton = this.createButton('Stop generation', '&#9632;');
            this.stopButton.addEventListener('click', async () => {
                if (this.stopButton) {
                    this.stopButton.disabled = true;
                }
                try {
                    await this.onStop?.();
                } catch (error) {
                    console.error('[SaveGenerateDisplay] stop handler failed', error);
                }
            });
            controls.appendChild(this.stopButton);
        }

        this.minimizeButton = this.createButton('Minimize', '&#8211;');
        this.minimizeButton.addEventListener('click', () => this.toggleMinimize());
        controls.appendChild(this.minimizeButton);

        this.closeButton = this.createButton('Close', '&#215;');
        this.closeButton.addEventListener('click', () => this.hide());
        controls.appendChild(this.closeButton);

        labelElement.appendChild(controls);
        this.element.appendChild(labelElement);

        const contentContainer = document.createElement('div');
        contentContainer.classList.add(CLASS_CONTENT);

        this.reasoningSection = document.createElement('div');
        this.reasoningSection.classList.add(CLASS_REASONING);
        this.reasoningSection.style.display = 'none';

        const reasoningLabel = document.createElement('div');
        reasoningLabel.classList.add(CLASS_REASONING_LABEL);
        reasoningLabel.textContent = 'Thinking...';
        this.reasoningSection.appendChild(reasoningLabel);

        this.reasoningContent = document.createElement('div');
        this.reasoningContent.classList.add(CLASS_REASONING_CONTENT);
        this.reasoningSection.appendChild(this.reasoningContent);
        contentContainer.appendChild(this.reasoningSection);

        this.textSection = document.createElement('div');
        this.textSection.classList.add(CLASS_TEXT);
        this.textSection.style.display = 'none';

        this.textContent = document.createElement('div');
        this.textContent.classList.add(CLASS_TEXT_CONTENT, 'mes_text');
        this.textSection.appendChild(this.textContent);
        contentContainer.appendChild(this.textSection);

        this.element.appendChild(contentContainer);

        const target = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop() ?? document.body;
        target.appendChild(this.element);

        requestAnimationFrame(() => {
            this.element?.classList.add(CLASS_VISIBLE);
        });

        return this;
    }

    createButton(title, html) {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add(CLASS_BUTTON);
        button.setAttribute('aria-label', title);
        button.setAttribute('title', title);
        button.innerHTML = html;
        return button;
    }

    toggleMinimize() {
        if (!this.element) {
            return this;
        }

        this.isMinimized = !this.isMinimized;
        this.element.classList.toggle(CLASS_MINIMIZED, this.isMinimized);

        if (this.minimizeButton) {
            this.minimizeButton.innerHTML = this.isMinimized ? '&#9633;' : '&#8211;';
            this.minimizeButton.setAttribute('title', this.isMinimized ? 'Restore' : 'Minimize');
            this.minimizeButton.setAttribute('aria-label', this.isMinimized ? 'Restore' : 'Minimize');
        }

        return this;
    }

    setLabel(label) {
        if (this.labelText) {
            this.labelText.textContent = label;
        }
        return this;
    }

    updateReasoning(text) {
        if (!this.reasoningSection || !this.reasoningContent || !text) {
            return this;
        }

        this.reasoningSection.style.display = '';
        this.reasoningContent.innerHTML = this.formatText(text, true);
        this.reasoningContent.scrollTop = this.reasoningContent.scrollHeight;
        return this;
    }

    updateContent(text) {
        if (!this.textSection || !this.textContent || !text) {
            return this;
        }

        this.hasContent = true;
        this.textSection.style.display = '';
        this.textContent.innerHTML = this.formatText(text, false);
        this.textContent.scrollTop = this.textContent.scrollHeight;
        return this;
    }

    markStopped({ label = null } = {}) {
        if (!this.element || this.isStopped || this.isComplete) {
            return this;
        }

        this.isStopped = true;
        this.clearHideTimeout();
        this.element.classList.add(CLASS_STOPPED);
        this.removeStopButton();

        if (label !== null) {
            this.setLabel(label);
        }

        return this;
    }

    complete({ label = null, delay = 3000 } = {}) {
        if (!this.element || this.isComplete) {
            return this;
        }

        this.isComplete = true;
        this.clearHideTimeout();
        this.element.classList.add(CLASS_COMPLETE);
        this.removeStopButton();

        if (label !== null) {
            this.setLabel(label);
        }

        if (typeof delay === 'number' && delay >= 0) {
            this.hideTimeoutId = setTimeout(() => this.performHide(), delay);
        }

        return this;
    }

    hide({ instant = false } = {}) {
        this.clearHideTimeout();
        this.performHide({ instant });
        return this;
    }

    removeStopButton() {
        if (this.stopButton) {
            this.stopButton.remove();
            this.stopButton = null;
        }
    }

    clearHideTimeout() {
        if (this.hideTimeoutId !== null) {
            clearTimeout(this.hideTimeoutId);
            this.hideTimeoutId = null;
        }
    }

    performHide({ instant = false } = {}) {
        const element = this.element;
        if (!element) {
            return;
        }

        const remove = () => {
            if (this.element !== element) {
                return;
            }
            element.remove();
            this.element = null;
            this.labelText = null;
            this.reasoningSection = null;
            this.reasoningContent = null;
            this.textSection = null;
            this.textContent = null;
            this.stopButton = null;
            this.minimizeButton = null;
            this.closeButton = null;
        };

        element.classList.remove(CLASS_VISIBLE);
        if (instant) {
            remove();
            return;
        }

        setTimeout(remove, HIDE_ANIMATION_MS);
    }

    formatText(text, isReasoning) {
        try {
            return messageFormatting(String(text), '', false, false, -1, {}, isReasoning);
        } catch {
            return this.escapeHtml(text).replace(/\r?\n/g, '<br>');
        }
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character]));
    }
}
