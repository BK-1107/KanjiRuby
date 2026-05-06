document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const globalToggle = document.getElementById('globalToggle');
    const translateToggle = document.getElementById('translateToggle');
    const doubleTapToggle = document.getElementById('doubleTapToggle');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');

    // 清除标注按钮逻辑
    clearBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'clearAllAnnotations' });
            }
        });
    });

    function updateStatusUI() {
        if (toggle.checked || translateToggle.checked) {
            statusMessage.textContent = 'Service Active';
            statusMessage.className = 'status-active';
        } else {
            statusMessage.textContent = 'Service Inactive';
            statusMessage.className = 'status-inactive';
        }
    }

    // Load current state
    chrome.storage.sync.get(['enabled', 'globalEnabled', 'translateEnabled', 'doubleTapEnabled'], (result) => {
        // Default values
        const isEnabled = result.enabled !== false;
        const isGlobalEnabled = result.globalEnabled === true;
        const isTranslateEnabled = result.translateEnabled !== false; // Default true
        const isDoubleTapEnabled = result.doubleTapEnabled === true;
        
        toggle.checked = isEnabled;
        globalToggle.checked = isGlobalEnabled;
        translateToggle.checked = isTranslateEnabled;
        doubleTapToggle.checked = isDoubleTapEnabled;
        
        updateStatusUI();
    });

    // Save state on change
    toggle.addEventListener('change', () => {
        chrome.storage.sync.set({ enabled: toggle.checked }, () => {
            updateStatusUI();
        });
    });

    // Global toggle logic
    globalToggle.addEventListener('change', () => {
        const isGlobalEnabled = globalToggle.checked;
        chrome.storage.sync.set({ globalEnabled: isGlobalEnabled }, () => {
            if (isGlobalEnabled) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'startGlobalAnnotation' });
                    }
                });
            }
        });
    });

    // Translation toggle logic
    translateToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ translateEnabled: translateToggle.checked }, () => {
            updateStatusUI();
        });
    });

    // Double Tap Translate logic
    doubleTapToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ doubleTapEnabled: doubleTapToggle.checked });
    });
});

