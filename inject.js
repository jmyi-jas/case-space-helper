(function() {
    // ① 拦截 fetch
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const headers = args[1]?.headers || {};

        // 从任意请求的URL参数里提取 fyId
        tryExtractFyId(url);

        if (url.includes('portal-chat')) {
            const pt = headers['Portal-Token'] || headers['portal-token'];
            if (pt) emit('portal', pt);
        }
        if (url.includes('yzw-zxfw-ajfw') || url.includes('yzw-zxfw-yhfw')) {
            const auth = headers['authorization'] || headers['Authorization'];
            if (auth) emit('auth', auth);
        }
        return origFetch.apply(this, args);
    };

    // ② 拦截 XHR
    const origOpen      = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__url = url;
        tryExtractFyId(url);  // XHR的URL也抓
        return origOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const lname = name.toLowerCase();
        if (lname === 'portal-token')  emit('portal', value);
        if (lname === 'authorization') emit('auth',   value);
        return origSetHeader.apply(this, arguments);
    };

    // ③ 从URL提取fyId和ajbh（核心新增）
    function tryExtractFyId(url) {
        if (!url) return;
        try {
            // 处理相对路径
            const fullUrl = url.startsWith('http') ? url : location.origin + url;
            const u = new URL(fullUrl);

            const fyId = u.searchParams.get('fyId')  ||
                         u.searchParams.get('fydm')  ||
                         u.searchParams.get('fyid');

            // 路径里直接是fyId数字的情况（如请求名就叫"1355"）
            // 匹配 /yzw/ 后面跟纯数字的路径段
            const pathMatch = u.pathname.match(/\/(\d{3,6})(\/|$)/);

            if (fyId)                    emit('fyid', fyId);
            if (pathMatch?.[1])          emit('fyid', pathMatch[1]);

            const ajbh = u.searchParams.get('ajbh');
            if (ajbh)                    emit('ajbh', ajbh);

        } catch(e) {}
    }

    // ④ 扫描storage
    function scanStorage() {
        try {
            for (const storage of [localStorage, sessionStorage]) {
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    const val = storage.getItem(key);
                    if (!val) continue;
                    if (key.toLowerCase().includes('portal') ||
                        (typeof val === 'string' && val.startsWith('cocall'))) {
                        emit('portal', val);
                    }
                    if (key.toLowerCase().includes('token') &&
                        typeof val === 'string' && val.startsWith('eyJ')) {
                        emit('auth', val);
                    }
                }
            }
        } catch(e) {}
    }
    setTimeout(scanStorage, 2000);
    setTimeout(scanStorage, 5000);

    function emit(type, token) {
        if (!token) return;
        window.dispatchEvent(new CustomEvent('__cd_tokens', {
            detail: { type, token }
        }));
    }

    console.log('[下载助手] 拦截器已启动');
})();
