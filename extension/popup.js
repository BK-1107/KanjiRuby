document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const globalAnnotateBtn = document.getElementById('globalAnnotateBtn');
    const translateToggle = document.getElementById('translateToggle');
    const ttsToggle = document.getElementById('ttsToggle');
    const stopSpeechBtn = document.getElementById('stopSpeechBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');

    function setStatus(text, active) {
        statusMessage.textContent = text;
        statusMessage.className = active ? 'status-active' : 'status-inactive';
    }

    function sendActiveTabMessage(message, sentText) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                setStatus('No active tab', false);
                return;
            }

            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    setStatus('Reload this page', false);
                } else if (response && response.success === false) {
                    setStatus(response.error || 'Action failed', false);
                } else if (sentText) {
                    setStatus(sentText, true);
                }
            });
        });
    }

    function updateStatusUI() {
        if (toggle.checked || translateToggle.checked || ttsToggle.checked) {
            statusMessage.textContent = 'Service Active';
            statusMessage.className = 'status-active';
        } else {
            statusMessage.textContent = 'Service Inactive';
            statusMessage.className = 'status-inactive';
        }
    }

    chrome.storage.sync.get([
        'enabled',
        'globalEnabled',
        'translateEnabled',
        'doubleTapEnabled',
        'ttsEnabled'
    ], (result) => {
        toggle.checked = result.enabled !== false;
        translateToggle.checked = result.translateEnabled === true;
        ttsToggle.checked = result.ttsEnabled !== false;

        chrome.storage.sync.set({
            doubleTapEnabled: true,
            globalEnabled: false
        });
        updateStatusUI();
    });

    toggle.addEventListener('change', () => {
        chrome.storage.sync.set({
            enabled: toggle.checked,
            globalEnabled: false
        }, updateStatusUI);
    });

    globalAnnotateBtn.addEventListener('click', () => {
        chrome.storage.sync.set({ enabled: true, globalEnabled: false }, () => {
            toggle.checked = true;
            updateStatusUI();
            sendActiveTabMessage({ action: 'startGlobalAnnotation' }, 'Page annotation sent');
        });
    });

    translateToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ translateEnabled: translateToggle.checked }, updateStatusUI);
    });

    ttsToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ ttsEnabled: ttsToggle.checked }, updateStatusUI);
    });

    stopSpeechBtn.addEventListener('click', () => {
        sendActiveTabMessage({ action: 'stopSpeech' }, 'Reading stopped');
    });

    clearBtn.addEventListener('click', () => {
        sendActiveTabMessage({ action: 'clearAllAnnotations' }, 'Annotations cleared');
    });
});
