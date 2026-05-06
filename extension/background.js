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
});
