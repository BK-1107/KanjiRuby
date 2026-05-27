// background.js - 代理网络请求以绕过 HTTPS 限制

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchAnalyze') {
        fetch('http://127.0.0.1:18000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data)
        })
        .then(response => response.json())
        .then(data => sendResponse({ success: true, data: data }))
        .catch(error => {
            console.error('Fetch error:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // 保持通道开启以进行异步响应
    }

    if (request.action === 'speakText') {
        const text = (request.text || '').trim();
        if (!text) {
            sendResponse({ success: false, error: 'No text to read' });
            return false;
        }
        if (!chrome.tts) {
            sendResponse({ success: false, error: 'Chrome TTS API is unavailable' });
            return false;
        }

        chrome.tts.stop();
        chrome.tts.speak(text, {
            lang: 'ja-JP',
            rate: request.rate || 0.9,
            pitch: request.pitch || 1.0,
            enqueue: false
        }, () => {
            const error = chrome.runtime.lastError;
            if (error) sendResponse({ success: false, error: error.message });
            else sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'stopSpeech') {
        if (!chrome.tts) {
            sendResponse({ success: false, error: 'Chrome TTS API is unavailable' });
            return false;
        }
        chrome.tts.stop();
        sendResponse({ success: true });
        return false;
    }
});
