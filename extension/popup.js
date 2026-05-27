document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const globalToggle = document.getElementById('globalToggle');
    const translateToggle = document.getElementById('translateToggle');
    const doubleTapToggle = document.getElementById('doubleTapToggle');
    const ttsToggle = document.getElementById('ttsToggle');
    const readSelectionBtn = document.getElementById('readSelectionBtn');
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
        globalToggle.checked = result.globalEnabled === true;
        translateToggle.checked = result.translateEnabled === true;
        doubleTapToggle.checked = result.doubleTapEnabled === true;
        ttsToggle.checked = result.ttsEnabled !== false;

        updateStatusUI();
    });

    toggle.addEventListener('change', () => {
        chrome.storage.sync.set({ enabled: toggle.checked }, updateStatusUI);
    });

    globalToggle.addEventListener('change', () => {
        const isGlobalEnabled = globalToggle.checked;
        chrome.storage.sync.set({ globalEnabled: isGlobalEnabled }, () => {
            if (isGlobalEnabled) {
                sendActiveTabMessage({ action: 'startGlobalAnnotation' });
            }
        });
    });

    translateToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ translateEnabled: translateToggle.checked }, updateStatusUI);
    });

    doubleTapToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ doubleTapEnabled: doubleTapToggle.checked });
    });

    ttsToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ ttsEnabled: ttsToggle.checked }, updateStatusUI);
    });

    readSelectionBtn.addEventListener('click', () => {
        sendActiveTabMessage({ action: 'readSelectionAloud' }, 'Reading request sent');
    });

    stopSpeechBtn.addEventListener('click', () => {
        sendActiveTabMessage({ action: 'stopSpeech' }, 'Reading stopped');
    });

    clearBtn.addEventListener('click', () => {
        sendActiveTabMessage({ action: 'clearAllAnnotations' }, 'Annotations cleared');
    });
});
