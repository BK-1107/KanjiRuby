// content.js - Robust Implementation with Background Proxy

let isEnabled = true;
let translateEnabled = false;
let globalEnabled = false; 
let doubleTapEnabled = false; 
let ttsEnabled = false;

let lastCtrlPressTime = 0;
let lastShiftPressTime = 0;
let lastReadableSelectionText = "";

// 初始化获取状态
chrome.storage.sync.get(['enabled', 'translateEnabled', 'globalEnabled', 'doubleTapEnabled', 'ttsEnabled'], (result) => {
    isEnabled = result.enabled !== false;
    translateEnabled = result.translateEnabled === true; // 修改默认值为 false，尊重用户习惯
    globalEnabled = result.globalEnabled === true;
    doubleTapEnabled = result.doubleTapEnabled === true;
    ttsEnabled = result.ttsEnabled !== false;
});

// 监听状态变化
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) isEnabled = changes.enabled.newValue !== false;
    if (changes.translateEnabled) translateEnabled = changes.translateEnabled.newValue === true;
    if (changes.globalEnabled) globalEnabled = changes.globalEnabled.newValue === true;
    if (changes.doubleTapEnabled) doubleTapEnabled = changes.doubleTapEnabled.newValue === true;
    if (changes.ttsEnabled) ttsEnabled = changes.ttsEnabled.newValue !== false;
});

// 辅助函数：显示通知弹窗
function showToast(message, isEnabled) {
    let toast = document.getElementById('kanjiruby-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'kanjiruby-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 30px;
            padding: 12px 24px;
            border-radius: 12px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 2147483647;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            pointer-events: none;
            opacity: 0;
            transform: translateY(10px);
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    // 使用冷色调（深灰蓝/深灰红），并增加透明度
    toast.style.backgroundColor = isEnabled ? 'rgba(45, 100, 150, 0.85)' : 'rgba(100, 60, 60, 0.85)';
    toast.style.backdropFilter = 'blur(8px)'; // 增加毛玻璃效果，更高级
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    if (window._kanjiToastTimer) clearTimeout(window._kanjiToastTimer);
    window._kanjiToastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 1000);
}

// 封装 API 请求函数，通过后台脚本中转
function callAnalyzeAPI(text, needTranslation) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'fetchAnalyze',
            data: { text: text, need_translation: needTranslation }
        }, (response) => {
            if (response && response.success) resolve(response.data);
            else reject(new Error(response ? response.error : 'Unknown error'));
        });
    });
}

function speakText(text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'speakText',
            text: text
        }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            if (response && response.success) resolve(response);
            else reject(new Error(response ? response.error : 'Unknown error'));
        });
    });
}

function getBrowserSpeechVoice() {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return voices.find((voice) => voice.lang === 'ja-JP')
        || voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith('ja'))
        || null;
}

function speakWithBrowserSpeech(text) {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            reject(new Error('Browser speech API is unavailable'));
            return;
        }

        const speak = () => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.voice = getBrowserSpeechVoice();
            utterance.onstart = () => resolve({ success: true, engine: 'browser' });
            utterance.onerror = (event) => reject(new Error(event.error || 'Browser speech failed'));

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
            speak();
            return;
        }

        let handled = false;
        const timer = setTimeout(() => {
            if (handled) return;
            handled = true;
            window.speechSynthesis.onvoiceschanged = null;
            speak();
        }, 500);

        window.speechSynthesis.onvoiceschanged = () => {
            if (handled) return;
            handled = true;
            clearTimeout(timer);
            window.speechSynthesis.onvoiceschanged = null;
            speak();
        };
    });
}

function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    chrome.runtime.sendMessage({ action: 'stopSpeech' }, () => {
        const error = chrome.runtime.lastError;
        if (error) console.warn('Stop speech failed:', error.message);
    });
}

async function readSelectionAloud() {
    const selection = window.getSelection();
    let text = "";

    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        text = getCleanTextFromRange(selection.getRangeAt(0));
        if (text) lastReadableSelectionText = text;
    }

    if (!text) text = lastReadableSelectionText;

    if (!text) {
        showToast('No text selected', false);
        return;
    }

    try {
        await speakText(text);
        showToast('Reading: ON', true);
    } catch (error) {
        console.warn('Chrome TTS failed, trying browser speech:', error);
        try {
            await speakWithBrowserSpeech(text);
            showToast('Reading: ON', true);
        } catch (fallbackError) {
            console.error('TTS failed:', fallbackError);
            showToast(fallbackError.message || 'Reading failed', false);
        }
    }
}

/**
 * 全网页注音逻辑
 */
async function annotateAllKanji() {
    console.log("🚀 开始全网页分析...");
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tagName = parent.tagName.toLowerCase();
            const ignoredTags = ['script', 'style', 'textarea', 'ruby', 'rt', 'rp', 'input', 'code', 'pre'];
            if (ignoredTags.includes(tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.closest('ruby')) return NodeFilter.FILTER_REJECT;
            if (/[\u4e00-\u9fa5]/.test(node.textContent)) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
        }
    });

    let node;
    while (node = walker.nextNode()) textNodes.push(node);
    console.log(`[Global] 找到 ${textNodes.length} 个文本节点`);

    const BATCH_SIZE = 5; // 减小批大小，提高稳定性
    for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
        const batch = textNodes.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (textNode) => {
            const originalText = textNode.textContent.trim();
            if (!originalText) return;
            try {
                const data = await callAnalyzeAPI(originalText, false);
                const tokens = data.tokens || data;
                if (!Array.isArray(tokens)) return;

                const fragment = document.createDocumentFragment();
                tokens.forEach(token => {
                    if (token.ruby) {
                        const rubyEl = document.createElement('ruby');
                        rubyEl.className = 'kanjiruby-annotation';
                        rubyEl.appendChild(document.createTextNode(token.surface));
                        const rtEl = document.createElement('rt');
                        rtEl.style.cssText = "user-select:none; -webkit-user-select:none; pointer-events:none;";
                        rtEl.textContent = token.reading;
                        rubyEl.appendChild(rtEl);
                        fragment.appendChild(rubyEl);
                    } else {
                        fragment.appendChild(document.createTextNode(token.surface));
                    }
                });
                if (textNode.parentNode) textNode.parentNode.replaceChild(fragment, textNode);
            } catch (err) { console.warn("[Global] 节点处理跳过:", err); }
        }));
    }
    console.log("✅ 全网页标注完成");
}

function clearAllAnnotations() {
    const rubies = Array.from(document.querySelectorAll('ruby.kanjiruby-annotation, ruby.kanjiruby-translation'));
    rubies.forEach(ruby => {
        const clone = ruby.cloneNode(true);
        clone.querySelectorAll('rt').forEach(rt => rt.remove());
        ruby.replaceWith(document.createTextNode(clone.textContent));
    });
}

function getCleanTextFromRange(range) {
    const clone = range.cloneContents();
    clone.querySelectorAll('rt').forEach(rt => rt.remove());
    
    function extractText(node) {
        if (node.nodeType === 3) return node.textContent;
        let text = "";
        const blockTags = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'ARTICLE', 'SECTION']);
        if (node.nodeName === 'BR') return "\n";
        for (const child of node.childNodes) text += extractText(child);
        if (node.nodeType === 1 && blockTags.has(node.nodeName)) text += "\n\n";
        return text;
    }
    return extractText(clone).trim().replace(/\n{3,}/g, '\n\n');
}

async function processSelection(range, forceTranslate = false) {
    const text = getCleanTextFromRange(range);
    if (!text) return;
    if (!isEnabled && !translateEnabled && !forceTranslate) return;

    try {
        const data = await callAnalyzeAPI(text, forceTranslate || translateEnabled);
        const tokens = data.tokens || [];
        const translation = data.full_translation;

        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';

        tokens.forEach(token => {
            if ((isEnabled || globalEnabled) && token.ruby) {
                const rubyEl = document.createElement('ruby');
                rubyEl.className = 'kanjiruby-annotation';
                rubyEl.style.rubyPosition = 'over';
                rubyEl.style.webkitRubyPosition = 'over';
                rubyEl.appendChild(document.createTextNode(token.surface));
                const rtEl = document.createElement('rt');
                rtEl.style.cssText = "user-select:none; -webkit-user-select:none; pointer-events:none;";
                rtEl.textContent = token.reading;
                rubyEl.appendChild(rtEl);
                wrapper.appendChild(rubyEl);
            } else {
                const parts = (token.surface || "").split('\n');
                parts.forEach((part, index) => {
                    if (part) wrapper.appendChild(document.createTextNode(part));
                    if (index < parts.length - 1) wrapper.appendChild(document.createElement('br'));
                });
            }
        });

        if ((forceTranslate || translateEnabled) && translation) {
            const outerRuby = document.createElement('ruby');
            outerRuby.className = 'kanjiruby-translation';
            outerRuby.style.rubyPosition = 'under';
            outerRuby.style.webkitRubyPosition = 'under'; 
            outerRuby.appendChild(wrapper);
            const rtTrans = document.createElement('rt');
            rtTrans.style.cssText = "user-select:none; -webkit-user-select:none; pointer-events:none; font-size:0.75em; font-style:normal; display:ruby-text; color: inherit; opacity: 0.8;";
            rtTrans.textContent = translation;
            outerRuby.appendChild(rtTrans);
            fragment.appendChild(outerRuby);
        } else {
            fragment.appendChild(wrapper);
        }

        range.deleteContents();
        range.insertNode(fragment);
        window.getSelection().removeAllRanges();
    } catch (error) { console.error("❌ 处理失败:", error); }
}

document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    const selectedText = getCleanTextFromRange(range);
    if (selectedText) lastReadableSelectionText = selectedText;

    const getTopRuby = (node) => {
        let el = node.nodeType === 3 ? node.parentElement : node;
        let ruby = el ? el.closest('ruby') : null;
        if (ruby) while (ruby.parentElement && ruby.parentElement.closest('ruby')) ruby = ruby.parentElement.closest('ruby');
        return ruby;
    };
    let sr = getTopRuby(range.startContainer); if (sr) range.setStartBefore(sr);
    let er = getTopRuby(range.endContainer); if (er) range.setEndAfter(er);

    processSelection(range);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startGlobalAnnotation') {
        annotateAllKanji()
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'clearAllAnnotations') {
        clearAllAnnotations();
        sendResponse({ success: true });
    } else if (request.action === 'readSelectionAloud') {
        readSelectionAloud()
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'stopSpeech') {
        stopSpeech();
        showToast('Reading: OFF', false);
        sendResponse({ success: true });
    }
});

document.addEventListener('keydown', (e) => {
    if (ttsEnabled && e.key === 'Shift' && !e.repeat) {
        const now = Date.now();
        if (now - lastShiftPressTime < 500) {
            lastShiftPressTime = 0;
            e.preventDefault();
            readSelectionAloud();
            return;
        }
        lastShiftPressTime = now;
    }

    if (!doubleTapEnabled) return;
    if (e.key === 'Control') {
        const now = Date.now();
        if (now - lastCtrlPressTime < 500) {
            lastCtrlPressTime = 0;
            const newState = !translateEnabled;
            chrome.storage.sync.set({ translateEnabled: newState }, () => {
                // 显示提示弹窗
                showToast(newState ? "Translation: ON" : "Translation: OFF", newState);
                
                if (newState) {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0 && sel.toString().trim()) {
                        processSelection(sel.getRangeAt(0), true);
                    }
                }
            });
        } else { lastCtrlPressTime = now; }
    }
});
