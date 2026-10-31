// Key mapping from keyboard events to uiohook key names
const keyToUiohook = {
    // Function keys
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5', 'F6': 'F6',
    'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
    'F13': 'F13', 'F14': 'F14', 'F15': 'F15', 'F16': 'F16', 'F17': 'F17',
    'F18': 'F18', 'F19': 'F19', 'F20': 'F20', 'F21': 'F21', 'F22': 'F22',
    'F23': 'F23', 'F24': 'F24',

    // Modifier keys
    'ControlLeft': 'Ctrl', 'ControlRight': 'CtrlRight',
    'AltLeft': 'Alt', 'AltRight': 'AltRight',
    'ShiftLeft': 'Shift', 'ShiftRight': 'ShiftRight',
    'MetaLeft': 'Meta', 'MetaRight': 'MetaRight',

    // Letters
    'KeyA': 'A', 'KeyB': 'B', 'KeyC': 'C', 'KeyD': 'D', 'KeyE': 'E',
    'KeyF': 'F', 'KeyG': 'G', 'KeyH': 'H', 'KeyI': 'I', 'KeyJ': 'J',
    'KeyK': 'K', 'KeyL': 'L', 'KeyM': 'M', 'KeyN': 'N', 'KeyO': 'O',
    'KeyP': 'P', 'KeyQ': 'Q', 'KeyR': 'R', 'KeyS': 'S', 'KeyT': 'T',
    'KeyU': 'U', 'KeyV': 'V', 'KeyW': 'W', 'KeyX': 'X', 'KeyY': 'Y',
    'KeyZ': 'Z',

    // Numbers
    'Digit0': '0', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4',
    'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9',

    // Symbols and punctuation
    'Space': 'Space', 'Enter': 'Enter', 'Escape': 'Escape',
    'Tab': 'Tab', 'CapsLock': 'CapsLock',
    'Backspace': 'Backspace', 'Delete': 'Delete',
    'Insert': 'Insert', 'Home': 'Home', 'End': 'End',
    'PageUp': 'PageUp', 'PageDown': 'PageDown',
    'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
    'Backquote': 'Backquote', 'Minus': 'Minus', 'Equal': 'Equal',
    'BracketLeft': 'BracketLeft', 'BracketRight': 'BracketRight',
    'Backslash': 'Backslash', 'Semicolon': 'Semicolon',
    'Quote': 'Quote', 'Comma': 'Comma', 'Period': 'Period',
    'Slash': 'Slash', 'PrintScreen': 'PrintScreen',
    'ScrollLock': 'ScrollLock', 'NumLock': 'NumLock',

    // Numpad
    'Numpad0': 'Numpad0', 'Numpad1': 'Numpad1', 'Numpad2': 'Numpad2',
    'Numpad3': 'Numpad3', 'Numpad4': 'Numpad4', 'Numpad5': 'Numpad5',
    'Numpad6': 'Numpad6', 'Numpad7': 'Numpad7', 'Numpad8': 'Numpad8',
    'Numpad9': 'Numpad9', 'NumpadAdd': 'NumpadAdd', 'NumpadSubtract': 'NumpadSubtract',
    'NumpadMultiply': 'NumpadMultiply', 'NumpadDivide': 'NumpadDivide',
    'NumpadDecimal': 'NumpadDecimal', 'NumpadEnter': 'NumpadEnter',
    'NumpadArrowUp': 'NumpadArrowUp', 'NumpadArrowDown': 'NumpadArrowDown',
    'NumpadArrowLeft': 'NumpadArrowLeft', 'NumpadArrowRight': 'NumpadArrowRight',
    'NumpadHome': 'NumpadHome', 'NumpadEnd': 'NumpadEnd',
    'NumpadPageUp': 'NumpadPageUp', 'NumpadPageDown': 'NumpadPageDown',
    'NumpadInsert': 'NumpadInsert', 'NumpadDelete': 'NumpadDelete'
};

// Display friendly names for keys
const keyDisplayNames = {
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5', 'F6': 'F6',
    'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
    'Ctrl': 'Ctrl', 'CtrlRight': 'Right Ctrl',
    'Alt': 'Alt', 'AltRight': 'Right Alt',
    'Shift': 'Shift', 'ShiftRight': 'Right Shift',
    'Meta': 'Left Cmd', 'MetaRight': 'Right Cmd',
    'Space': 'Space', 'Enter': 'Enter', 'Escape': 'Esc'
};

// ─── Toast notification ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (showToast._timer) {
        clearTimeout(showToast._timer);
    }

    toast.textContent = message;
    toast.classList.remove('toast--success', 'toast--error');
    toast.classList.add(`toast--${type}`, 'show');

    showToast._timer = setTimeout(() => {
        toast.classList.remove('show');
        showToast._timer = null;
    }, type === 'error' ? 4000 : 1800);
}

// ─── Password toggle buttons ────────────────────────────────────────────────
function setupPasswordToggles() {
    const toggles = document.querySelectorAll('.toggle-visibility');
    toggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            const eyeIcon = btn.querySelector('.eye-icon');
            const eyeOffIcon = btn.querySelector('.eye-off-icon');

            if (input.type === 'password') {
                input.type = 'text';
                if (eyeIcon) eyeIcon.style.display = 'none';
                if (eyeOffIcon) eyeOffIcon.style.display = 'block';
            } else {
                input.type = 'password';
                if (eyeIcon) eyeIcon.style.display = 'block';
                if (eyeOffIcon) eyeOffIcon.style.display = 'none';
            }
        });
    });
}

// ─── Load & Sync Settings ───────────────────────────────────────────────────
let currentSettings = null;

async function loadSettings() {
    try {
        currentSettings = await window.electronAPI.getAllSettings();
        const hotkey = await window.electronAPI.getHotkey();

        const hotkeyInput = document.getElementById('hotkey');
        const dashHotkey = document.getElementById('dashboardHotkeyDisplay');
        const providerSelect = document.getElementById('transcriptionProvider');

        // Hotkey display
        if (hotkey) {
            const displayName = hotkey.split('+')
                .map(part => keyDisplayNames[part] || part)
                .join(' + ');

            if (hotkeyInput) hotkeyInput.value = displayName;
            if (dashHotkey) dashHotkey.textContent = displayName;

            const presetBtns = document.querySelectorAll('.preset-btn');
            presetBtns.forEach(b => b.classList.toggle('active', b.dataset.hotkey === hotkey));
        }

        // Fill BYOK Inputs
        const openaiKey = document.getElementById('openaiApiKey');
        const openaiModel = document.getElementById('openaiModel');
        if (openaiKey) openaiKey.value = currentSettings.openai?.apiKey || '';
        if (openaiModel && currentSettings.openai?.model) openaiModel.value = currentSettings.openai.model;

        const groqKey = document.getElementById('groqApiKey');
        const groqModel = document.getElementById('groqModel');
        if (groqKey) groqKey.value = currentSettings.groq?.apiKey || '';
        if (groqModel && currentSettings.groq?.model) groqModel.value = currentSettings.groq.model;

        const customEndpoint = document.getElementById('customEndpoint');
        const customApiKey = document.getElementById('customApiKey');
        const customModel = document.getElementById('customModel');
        if (customEndpoint) customEndpoint.value = currentSettings.custom?.endpoint || '';
        if (customApiKey) customApiKey.value = currentSettings.custom?.apiKey || '';
        if (customModel) customModel.value = currentSettings.custom?.model || 'whisper-1';

        // Determine active provider selector value
        let activeVal = 'openai';
        if (currentSettings.transcriptionMode === 'offline') {
            activeVal = 'offline';
        } else {
            activeVal = currentSettings.cloudProvider || 'openai';
        }

        if (providerSelect) {
            providerSelect.value = activeVal;
            updateProviderUI(activeVal, false);
        }

        // Load local models
        await refreshLocalModels();

        // Update dashboard snippet
        await loadLatestDictationSnippet();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ─── Update UI on Provider Change ────────────────────────────────────────────
async function updateProviderUI(selectedProvider, saveToMain = true) {
    const cards = {
        openai: document.getElementById('providerCardOpenAI'),
        groq: document.getElementById('providerCardGroq'),
        custom: document.getElementById('providerCardCustom'),
        offline: document.getElementById('providerCardOffline')
    };

    Object.entries(cards).forEach(([key, card]) => {
        if (card) card.style.display = key === selectedProvider ? 'flex' : 'none';
    });

    // Update Dashboard Engine display
    updateDashboardEngineText(selectedProvider);

    if (saveToMain) {
        try {
            if (selectedProvider === 'offline') {
                await window.electronAPI.setTranscriptionMode('offline');
            } else {
                await window.electronAPI.setTranscriptionMode('cloud');
                await window.electronAPI.setCloudProvider(selectedProvider);
            }
            showToast(`Engine set to ${getProviderLabel(selectedProvider)}`);
        } catch (e) {
            console.error('Failed to update provider:', e);
        }
    }
}

function getProviderLabel(provider) {
    if (provider === 'groq') return 'Groq Whisper';
    if (provider === 'custom') return 'Custom Endpoint';
    if (provider === 'offline') return 'Local Whisper';
    return 'OpenAI Whisper';
}

function updateDashboardEngineText(provider) {
    const dashEngine = document.getElementById('dashEngineMode');
    if (!dashEngine) return;

    if (provider === 'offline') {
        const localSelect = document.getElementById('localModelSelect');
        const modelName = localSelect ? localSelect.value : 'base.en';
        dashEngine.textContent = `Local (${modelName})`;
    } else if (provider === 'groq') {
        const groqModel = document.getElementById('groqModel');
        const name = (groqModel && groqModel.value.includes('turbo')) ? 'Turbo' : 'Large-v3';
        dashEngine.textContent = `Groq (${name})`;
    } else if (provider === 'custom') {
        const customModel = document.getElementById('customModel');
        dashEngine.textContent = `Custom (${customModel?.value || 'whisper-1'})`;
    } else {
        dashEngine.textContent = 'OpenAI (whisper-1)';
    }
}

// ─── Local Model Management & Import ─────────────────────────────────────────
let cachedLocalModels = [];

async function refreshLocalModels() {
    const select = document.getElementById('localModelSelect');
    if (!select) return;

    try {
        cachedLocalModels = await window.electronAPI.getLocalModels();
        select.innerHTML = '';

        const standardGroup = document.createElement('optgroup');
        standardGroup.label = 'Standard Models';

        const customGroup = document.createElement('optgroup');
        customGroup.label = 'Imported Custom Models';

        let activeModel = null;

        cachedLocalModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            const statusTag = m.isDownloaded ? `[Ready • ${m.sizeMB}]` : `[Available • ${m.sizeApprox}]`;
            opt.textContent = `${m.name} ${statusTag}`;

            if (m.isCustom) {
                customGroup.appendChild(opt);
            } else {
                standardGroup.appendChild(opt);
            }

            if (m.isActive) {
                activeModel = m;
            }
        });

        select.appendChild(standardGroup);
        if (customGroup.children.length > 0) {
            select.appendChild(customGroup);
        }

        if (activeModel) {
            select.value = activeModel.name;
        } else if (cachedLocalModels.length > 0) {
            select.value = cachedLocalModels[0].name;
            activeModel = cachedLocalModels[0];
        }

        updateLocalModelCard(activeModel || cachedLocalModels[0]);
    } catch (e) {
        console.error('Error refreshing local models:', e);
    }
}

function updateLocalModelCard(model) {
    const badge = document.getElementById('localModelStatusBadge');
    const downloadBtn = document.getElementById('btnDownloadStandardModel');
    const deleteBtn = document.getElementById('btnDeleteCurrentModel');

    if (!model) return;

    if (badge) {
        if (model.isDownloaded) {
            badge.className = 'status-badge ready';
            badge.textContent = `✓ Ready • ${model.sizeMB}`;
        } else {
            badge.className = 'status-badge pending';
            badge.textContent = 'Not downloaded';
        }
    }

    if (downloadBtn) {
        if (!model.isDownloaded && !model.isCustom) {
            downloadBtn.style.display = 'flex';
            const btnText = document.getElementById('downloadBtnText');
            if (btnText) btnText.textContent = `Download (${model.sizeApprox || ''})`;
        } else {
            downloadBtn.style.display = 'none';
        }
    }

    if (deleteBtn) {
        // Allow deleting downloaded or custom models
        deleteBtn.style.display = model.isDownloaded ? 'flex' : 'none';
    }
}

// ─── Setup Model Actions ─────────────────────────────────────────────────────
function setupModelActions() {
    const select = document.getElementById('localModelSelect');
    const importBtn = document.getElementById('btnImportLocalModel');
    const downloadBtn = document.getElementById('btnDownloadStandardModel');
    const deleteBtn = document.getElementById('btnDeleteCurrentModel');

    // On Model Dropdown change
    if (select) {
        select.addEventListener('change', async () => {
            const selectedName = select.value;
            const model = cachedLocalModels.find(m => m.name === selectedName);
            if (model) {
                await window.electronAPI.setLocalModel(model.path || model.name);
                updateLocalModelCard(model);
                updateDashboardEngineText('offline');
                showToast(`Local model set to ${model.name}`);
            }
        });
    }

    // Import Model Button (Native File Dialog)
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            try {
                showToast('Select a .bin Whisper model file...');
                const result = await window.electronAPI.importLocalModel();

                if (result.canceled) {
                    return;
                }

                if (result.success && result.model) {
                    showToast(`Imported model: ${result.model.name} (${result.model.sizeMB})`);
                    await refreshLocalModels();
                    updateDashboardEngineText('offline');
                } else {
                    showToast(`Import failed: ${result.error || 'Unknown error'}`, 'error');
                }
            } catch (err) {
                console.error('Import error:', err);
                showToast(`Import failed: ${err.message}`, 'error');
            }
        });
    }

    // Download Standard Model Button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const selectedName = select.value;
            const progressContainer = document.getElementById('downloadProgressContainer');
            const progressFill = document.getElementById('downloadProgressFill');
            const progressPercent = document.getElementById('downloadProgressPercent');
            const progressLabel = document.getElementById('downloadProgressLabel');

            try {
                downloadBtn.disabled = true;
                if (progressContainer) progressContainer.style.display = 'block';
                if (progressFill) progressFill.style.width = '0%';
                if (progressPercent) progressPercent.textContent = '0%';
                if (progressLabel) progressLabel.textContent = `Downloading ${selectedName}...`;

                showToast(`Starting download for ${selectedName}...`);

                const res = await window.electronAPI.downloadModel(selectedName);

                if (res.success) {
                    showToast(`${selectedName} downloaded successfully!`);
                    if (progressContainer) progressContainer.style.display = 'none';
                    await refreshLocalModels();
                    updateDashboardEngineText('offline');
                } else {
                    throw new Error(res.error || 'Download failed');
                }
            } catch (err) {
                console.error('Download error:', err);
                showToast(`Download failed: ${err.message}`, 'error');
                if (progressContainer) progressContainer.style.display = 'none';
            } finally {
                downloadBtn.disabled = false;
            }
        });
    }

    // Listen for progress events from main
    if (window.electronAPI.onDownloadProgress) {
        window.electronAPI.onDownloadProgress(p => {
            const progressFill = document.getElementById('downloadProgressFill');
            const progressPercent = document.getElementById('downloadProgressPercent');
            const progressLabel = document.getElementById('downloadProgressLabel');

            if (progressFill) progressFill.style.width = p.percent + '%';
            if (progressPercent) progressPercent.textContent = p.percent + '%';
            if (progressLabel) progressLabel.textContent = `Downloading (${p.downloadedMB} / ${p.totalMB} MB)...`;
        });
    }

    // Delete Model Button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const selectedName = select.value;
            const model = cachedLocalModels.find(m => m.name === selectedName);
            if (!model || !model.path) return;

            if (confirm(`Are you sure you want to delete ${model.name} to free disk space?`)) {
                try {
                    await window.electronAPI.deleteLocalModel(model.path);
                    showToast(`Deleted ${model.name}`);
                    await refreshLocalModels();
                    updateDashboardEngineText('offline');
                } catch (e) {
                    showToast(`Failed to delete: ${e.message}`, 'error');
                }
            }
        });
    }
}

// ─── Auto-Save BYOK Providers on Change ──────────────────────────────────────
function setupBYOKAutoSave() {
    const saveAll = async () => {
        const payload = {
            openai: {
                apiKey: document.getElementById('openaiApiKey')?.value.trim() || '',
                model: document.getElementById('openaiModel')?.value || 'whisper-1'
            },
            groq: {
                apiKey: document.getElementById('groqApiKey')?.value.trim() || '',
                model: document.getElementById('groqModel')?.value || 'whisper-large-v3-turbo'
            },
            custom: {
                endpoint: document.getElementById('customEndpoint')?.value.trim() || '',
                apiKey: document.getElementById('customApiKey')?.value.trim() || '',
                model: document.getElementById('customModel')?.value.trim() || 'whisper-1'
            }
        };

        try {
            await window.electronAPI.saveProviderSettings(payload);
            const provider = document.getElementById('transcriptionProvider')?.value;
            updateDashboardEngineText(provider);
            showToast('Changes saved');
        } catch (e) {
            console.error('Failed to save BYOK settings:', e);
        }
    };

    // Attach listeners
    const inputs = [
        'openaiApiKey', 'openaiModel',
        'groqApiKey', 'groqModel',
        'customEndpoint', 'customApiKey', 'customModel'
    ];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveAll);
            if (el.tagName === 'INPUT') {
                el.addEventListener('blur', saveAll);
            }
        }
    });

    // Provider dropdown listener
    const providerSelect = document.getElementById('transcriptionProvider');
    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            updateProviderUI(providerSelect.value, true);
        });
    }
}

// ─── Window Controls ─────────────────────────────────────────────────────────
function setupWindowControls() {
    const minimizeBtn = document.getElementById('minimize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.electronAPI.closeSettings();
        });
    }
}

// ─── Dashboard & Tab navigation ──────────────────────────────────────────────
async function loadLatestDictationSnippet() {
    const textEl = document.getElementById('dashLatestText');
    if (!textEl) return;
    try {
        const history = await window.electronAPI.getHistory();
        if (history && history.length > 0) {
            textEl.textContent = `"${history[0].text}"`;
            textEl.style.color = '#e4e4e7';
        } else {
            textEl.textContent = 'No transcriptions yet. Press your hotkey or click the microphone button above to speak!';
            textEl.style.color = '#71717a';
        }
    } catch (e) {
        console.error('Failed to load latest dictation:', e);
    }
}

function updateRecordingState(status) {
    const micBtn = document.getElementById('heroMicBtn');
    const prompt = document.getElementById('heroPromptText');
    const pill = document.getElementById('appStatusPill');
    const statusText = document.getElementById('appStatusText');

    if (!micBtn || !prompt || !pill || !statusText) return;

    if (status === 'recording') {
        micBtn.className = 'hero-mic-btn recording';
        prompt.textContent = 'Listening... Click or release hotkey to finish';
        pill.className = 'status-indicator-pill recording';
        statusText.textContent = 'Recording...';
    } else if (status === 'processing') {
        micBtn.className = 'hero-mic-btn processing';
        prompt.textContent = 'Transcribing audio...';
        pill.className = 'status-indicator-pill processing';
        statusText.textContent = 'Transcribing...';
    } else {
        micBtn.className = 'hero-mic-btn';
        prompt.textContent = 'Click to start dictation';
        pill.className = 'status-indicator-pill';
        statusText.textContent = 'Ready';
        loadLatestDictationSnippet();
    }
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panels = {
        app: document.getElementById('panel-app'),
        settings: document.getElementById('panel-settings'),
        history: document.getElementById('panel-history')
    };

    function switchTab(target) {
        tabBtns.forEach(b => {
            if (b.dataset.tab === target) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        Object.entries(panels).forEach(([key, panel]) => {
            if (panel) {
                panel.style.display = key === target ? 'flex' : 'none';
            }
        });

        if (target === 'history') {
            loadAndRenderHistory();
        } else if (target === 'app') {
            loadLatestDictationSnippet();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Wire shortcuts to settings
    const btnOpenSettings = document.getElementById('btnOpenSettingsPage');
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => switchTab('settings'));
    }

    const btnGoToEngine = document.getElementById('btnGoToSettingsEngine');
    if (btnGoToEngine) {
        btnGoToEngine.addEventListener('click', () => switchTab('settings'));
    }

    const btnGoToMic = document.getElementById('btnGoToSettingsMic');
    if (btnGoToMic) {
        btnGoToMic.addEventListener('click', () => switchTab('settings'));
    }

    // Back to App buttons
    const backSettings = document.getElementById('backToAppFromSettings');
    if (backSettings) {
        backSettings.addEventListener('click', () => switchTab('app'));
    }

    const backHistory = document.getElementById('backToAppFromHistory');
    if (backHistory) {
        backHistory.addEventListener('click', () => switchTab('app'));
    }

    const linkHistory = document.getElementById('dashViewHistoryLink');
    if (linkHistory) {
        linkHistory.addEventListener('click', () => switchTab('history'));
    }

    // Hero mic button click to toggle recording
    const heroMicBtn = document.getElementById('heroMicBtn');
    if (heroMicBtn) {
        heroMicBtn.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.toggleRecording) {
                window.electronAPI.toggleRecording();
            }
        });
    }

    // Copy latest snippet button
    const copyLatestBtn = document.getElementById('dashCopyLatestBtn');
    if (copyLatestBtn) {
        copyLatestBtn.addEventListener('click', () => {
            const textEl = document.getElementById('dashLatestText');
            if (!textEl) return;
            const textToCopy = textEl.textContent.replace(/^"|"$/g, '').trim();
            if (textToCopy && !textToCopy.startsWith('No transcriptions yet')) {
                navigator.clipboard.writeText(textToCopy);
                const label = document.getElementById('copyLatestLabel');
                if (label) label.textContent = 'Copied!';
                showToast('Copied to clipboard');
                setTimeout(() => {
                    if (label) label.textContent = 'Copy';
                }, 1500);
            }
        });
    }

    // Listen for tab navigation from main process
    if (window.electronAPI && window.electronAPI.onNavigateTab) {
        window.electronAPI.onNavigateTab(tab => {
            switchTab(tab);
        });
    }

    // Listen for live recording status changes
    if (window.electronAPI && window.electronAPI.onRecordingStatusChanged) {
        window.electronAPI.onRecordingStatusChanged(status => {
            updateRecordingState(status);
        });
    }
}

// ─── History feature ──────────────────────────────────────────────────────────
function formatHistoryDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    }) + ` at ${timeStr}`;
}

async function loadAndRenderHistory() {
    const list = document.getElementById('historyList');
    const countEl = document.getElementById('historyCount');
    if (!list) return;

    let history = [];
    try {
        history = await window.electronAPI.getHistory();
    } catch (e) {
        console.error('Failed to load history:', e);
    }

    if (countEl) {
        const n = history.length;
        countEl.textContent = n === 1 ? '1 transcription' : `${n} transcriptions`;
    }

    Array.from(list.querySelectorAll('.history-entry, .history-empty-card')).forEach(el => el.remove());

    if (history.length === 0) {
        const card = document.createElement('div');
        card.className = 'history-entry history-empty-card';
        card.innerHTML = `<span class="history-entry-date">No transcriptions yet</span>`;
        list.appendChild(card);
        return;
    }

    history.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'history-entry';
        el.dataset.id = entry.id;
        el.innerHTML = `
            <div class="history-entry-meta">
                <span class="history-entry-date">${formatHistoryDate(entry.timestamp)}</span>
                <span class="history-copy-hint">Copy</span>
            </div>
            <div class="history-entry-text">${escapeHtml(entry.text)}</div>
        `;

        el.addEventListener('click', () => copyHistoryEntry(el, entry.text));
        list.appendChild(el);
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function copyHistoryEntry(el, text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard');
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

function setupClearHistory() {
    const btn = document.getElementById('clearHistoryBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        try {
            await window.electronAPI.clearHistory();
            await loadAndRenderHistory();
            showToast('History cleared');
        } catch (e) {
            showToast('Failed to clear history', 'error');
        }
    });
}

// ─── Hotkey Capture ──────────────────────────────────────────────────────────
function setupHotkeyCapture() {
    const hotkeyInput = document.getElementById('hotkey');
    if (!hotkeyInput) return;

    let isCapturing = false;
    let pressedKeys = new Set();
    let maxCombo = new Set();

    hotkeyInput.addEventListener('click', () => {
        if (!isCapturing) {
            isCapturing = true;
            pressedKeys.clear();
            maxCombo.clear();
            window.electronAPI.pauseHotkey();
            hotkeyInput.classList.add('capturing');
            hotkeyInput.value = 'Press key combination...';
        }
    });

    hotkeyInput.addEventListener('keydown', (e) => {
        if (!isCapturing) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.code === 'Escape') {
            isCapturing = false;
            hotkeyInput.classList.remove('capturing');
            window.electronAPI.resumeHotkey();
            loadSettings();
            return;
        }

        const uiohookName = keyToUiohook[e.code];
        if (uiohookName) {
            pressedKeys.add(uiohookName);
            if (pressedKeys.size > maxCombo.size) {
                maxCombo = new Set(pressedKeys);
            }

            const displayName = Array.from(maxCombo)
                .map(part => keyDisplayNames[part] || part)
                .join(' + ');

            hotkeyInput.value = displayName;
        }
    });

    hotkeyInput.addEventListener('keyup', async (e) => {
        if (!isCapturing) return;
        e.preventDefault();
        e.stopPropagation();

        const uiohookName = keyToUiohook[e.code];
        if (uiohookName) pressedKeys.delete(uiohookName);

        if (pressedKeys.size === 0 && maxCombo.size > 0) {
            const finalKeys = Array.from(maxCombo);
            isCapturing = false;
            hotkeyInput.classList.remove('capturing');

            const combo = finalKeys.join('+');
            try {
                await window.electronAPI.setHotkey(combo);
                window.electronAPI.resumeHotkey();

                const displayName = finalKeys
                    .map(part => keyDisplayNames[part] || part)
                    .join(' + ');

                hotkeyInput.value = displayName;
                const dashHotkey = document.getElementById('dashboardHotkeyDisplay');
                if (dashHotkey) dashHotkey.textContent = displayName;
                showToast('Hotkey saved');
            } catch (err) {
                console.error('Error saving hotkey:', err);
                window.electronAPI.resumeHotkey();
            }
        }
    });

    hotkeyInput.addEventListener('blur', () => {
        if (isCapturing) {
            isCapturing = false;
            hotkeyInput.classList.remove('capturing');
            window.electronAPI.resumeHotkey();
            loadSettings();
        }
    });

    // Preset buttons click
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const hotkey = btn.dataset.hotkey;
            try {
                await window.electronAPI.setHotkey(hotkey);
                if (hotkeyInput) hotkeyInput.value = hotkey;
                const dashHotkey = document.getElementById('dashboardHotkeyDisplay');
                if (dashHotkey) dashHotkey.textContent = hotkey;
                presetBtns.forEach(b => b.classList.toggle('active', b.dataset.hotkey === hotkey));
                showToast(`Hotkey set to ${hotkey}`);
            } catch (e) {
                showToast(`Failed to set hotkey: ${e.message}`, 'error');
            }
        });
    });
}

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupWindowControls();
    setupTabs();
    setupPasswordToggles();
    setupBYOKAutoSave();
    setupModelActions();
    setupClearHistory();
    setupHotkeyCapture();

    // Live history update
    if (window.electronAPI.onHistoryUpdated) {
        window.electronAPI.onHistoryUpdated(() => {
            loadLatestDictationSnippet();
            const historyPanel = document.getElementById('panel-history');
            if (historyPanel && historyPanel.style.display !== 'none') {
                loadAndRenderHistory();
            }
        });
    }

    // Live dictation streaming text on dashboard
    if (window.electronAPI.onLiveTranscriptionUpdate) {
        window.electronAPI.onLiveTranscriptionUpdate(text => {
            const textEl = document.getElementById('dashLatestText');
            if (textEl) {
                textEl.textContent = `"${text}"`;
                textEl.style.color = '#e4e4e7';
            }
        });
    }

    // Surface errors as toasts
    if (window.electronAPI.onError) {
        window.electronAPI.onError(msg => {
            showToast(msg, 'error');
        });
    }

    // Microphone change listener
    const micSelect = document.getElementById('microphone');
    if (micSelect) {
        micSelect.addEventListener('change', async () => {
            try {
                await window.electronAPI.setMicrophone(micSelect.value);
                const dashMic = document.getElementById('dashMicName');
                if (dashMic && micSelect.selectedIndex >= 0) {
                    dashMic.textContent = micSelect.options[micSelect.selectedIndex].text;
                }
                showToast('Changes saved');
            } catch (e) {
                console.error('Error saving microphone:', e);
            }
        });
    }

    // ESC to hide window
    document.addEventListener('keydown', e => {
        const hotkeyInput = document.getElementById('hotkey');
        if (e.key === 'Escape' && document.activeElement !== hotkeyInput) {
            window.electronAPI.closeSettings();
        }
    });

    // External links
    document.addEventListener('click', e => {
        if (e.target.tagName === 'A' && e.target.href) {
            e.preventDefault();
            window.electronAPI.openExternal(e.target.href);
        }
    });
});
