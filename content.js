// ============================================
// 常量定义（必须在最顶部）
// ============================================
const CHAT_API = 'https://zxfw.court.gov.cn/portal-chat/api/v1/chat';
const DL_API   = 'https://zxfw.court.gov.cn/yzw/yzw-zxfw-ajfw/api/v1/gtjl/cl';

// ============================================
// 状态
// ============================================
let STATE = {
    portalToken: null,
    authToken: null,
    fyId: null,
    ajbh: null
};

function parseFromUrl() {
    const url    = location.href;
    const search = url.includes('?') ? url.split('?')[1] : '';
    const hash   = url.includes('#') ? url.split('#')[1] : '';
    const merged = new URLSearchParams(search + '&' + (hash.includes('?') ? hash.split('?')[1] : hash));
    STATE.ajbh = merged.get('ajbh') || STATE.ajbh;
    STATE.fyId = merged.get('fyId') || merged.get('fydm') || merged.get('fyid') || STATE.fyId;
}
parseFromUrl();

// SPA路由变化时重新解析
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        parseFromUrl();
        updateStatus();
    }
}, 1000);

// 监听inject.js传来的token
window.addEventListener('__cd_tokens', (e) => {
    const { type, token } = e.detail;
    if (type === 'portal' && !STATE.portalToken) { STATE.portalToken = token; updateStatus(); }
    if (type === 'auth'   && !STATE.authToken)   { STATE.authToken   = token; updateStatus(); }
    if (type === 'fyid'   && !STATE.fyId)        { STATE.fyId        = token; updateStatus(); }
    if (type === 'ajbh'   && !STATE.ajbh)        { STATE.ajbh        = token; updateStatus(); }
});

// ============================================
// 创建悬浮面板
// ============================================
const panel = document.createElement('div');
panel.id = '__court_dl_panel';
panel.innerHTML = `
<div id="__cd_header">
  ⚖️ 文件下载助手
  <span id="__cd_close" style="cursor:pointer">✕</span>
</div>
<div id="__cd_body">
  <div id="__cd_status">⏳ 等待页面加载...</div>
  <div id="__cd_info"></div>
  <button id="__cd_btn" disabled>请先浏览案件页面</button>

  <div id="__cd_file_area" style="display:none; margin-top:8px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span id="__cd_file_count" style="font-size:12px; color:#555;"></span>
      <span>
        <button id="__cd_select_all"  style="font-size:11px; padding:2px 6px; cursor:pointer; margin-right:4px;">全选</button>
        <button id="__cd_select_none" style="font-size:11px; padding:2px 6px; cursor:pointer;">全不选</button>
      </span>
    </div>
    <div id="__cd_file_list" style="
      max-height:200px; overflow-y:auto; border:1px solid #ddd;
      border-radius:6px; padding:4px;
    "></div>
    <button id="__cd_download_selected" style="
      width:100%; padding:8px; margin-top:8px;
      background:#34a853; color:#fff; border:none;
      border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold;
    ">⬇️ 下载已选文件</button>
  </div>

  <div id="__cd_log" style="
    max-height:120px; overflow-y:auto; margin-top:8px;
    font-size:11px; color:#555; line-height:1.6;
  "></div>
</div>`;

panel.style.cssText = `
  position:fixed; bottom:20px; right:20px; width:300px;
  background:#fff; border:2px solid #1a73e8; border-radius:10px;
  box-shadow:0 4px 20px rgba(0,0,0,0.2); z-index:999999;
  font-family:sans-serif; font-size:13px; overflow:hidden;`;

panel.querySelector('#__cd_header').style.cssText = `
  background:#1a73e8; color:#fff; padding:8px 12px;
  font-weight:bold; cursor:move; display:flex;
  justify-content:space-between; align-items:center;`;

panel.querySelector('#__cd_body').style.cssText = `padding:12px;`;

panel.querySelector('#__cd_btn').style.cssText = `
  width:100%; padding:8px; margin-top:8px;
  background:#1a73e8; color:#fff; border:none;
  border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold;`;

document.body.appendChild(panel);

// 关闭按钮
panel.querySelector('#__cd_close').onclick = () => panel.style.display = 'none';

// ============================================
// 拖拽（使用 top/left 定位，方向正确）
// ============================================
const header = panel.querySelector('#__cd_header');
let isDragging = false, startX, startY, origLeft, origTop;

header.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    origLeft = rect.left;
    origTop  = rect.top;

    // 切换到 top/left 定位
    panel.style.left   = origLeft + 'px';
    panel.style.top    = origTop  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';

    e.preventDefault();
});

document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const newLeft = origLeft + (e.clientX - startX);
    const newTop  = origTop  + (e.clientY - startY);

    // 限制不超出屏幕
    const maxLeft = window.innerWidth  - panel.offsetWidth;
    const maxTop  = window.innerHeight - panel.offsetHeight;

    panel.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
    panel.style.top  = Math.max(0, Math.min(newTop,  maxTop))  + 'px';
});

document.addEventListener('mouseup', () => isDragging = false);

// ============================================
// 状态更新
// ============================================
function updateStatus() {
    parseFromUrl();
    const ready    = STATE.portalToken && STATE.authToken && STATE.ajbh;
    const statusEl = panel.querySelector('#__cd_status');
    const infoEl   = panel.querySelector('#__cd_info');
    const btn      = panel.querySelector('#__cd_btn');

    const items = [
        STATE.portalToken ? '✅ Portal-Token'              : '⏳ Portal-Token（滚动消息列表）',
        STATE.authToken   ? '✅ Auth-Token'                : '⏳ Auth-Token（点击任意案件）',
        STATE.ajbh        ? `✅ 案件: ${STATE.ajbh.slice(0,8)}...` : '⏳ AJBH（打开案件页）',
        STATE.fyId        ? `✅ 法院ID: ${STATE.fyId}`    : '⚠️ FyId（下载时手动填）',
    ];
    infoEl.innerHTML = items.map(i => `<div>${i}</div>`).join('');
    infoEl.style.cssText = 'line-height:1.8; margin-top:6px; font-size:12px;';

    if (ready) {
        statusEl.textContent = '✅ 就绪，点击获取文件列表';
        btn.textContent = '📋 获取文件列表';
        btn.disabled = false;
        btn.onclick = fetchFileList;
    } else {
        statusEl.textContent = '⏳ 等待捕获参数...';
        btn.textContent = '请先浏览案件页面';
        btn.disabled = true;
    }
}

function log(msg) {
    const el = panel.querySelector('#__cd_log');
    el.innerHTML += `<div>${msg}</div>`;
    el.scrollTop = el.scrollHeight;
}

function clearLog() {
    panel.querySelector('#__cd_log').innerHTML = '';
}

// ============================================
// 文件列表渲染
// ============================================
let fileCache = [];

function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map  = {
        pdf:'📄', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️',
        doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', mp4:'🎬', mp3:'🎵'
    };
    return map[ext] || '📎';
}

function refreshSelectedCount() {
    const total    = fileCache.length;
    const selected = panel.querySelectorAll('.__cd_chk:checked').length;
    panel.querySelector('#__cd_file_count').textContent =
        `共 ${total} 个，已选 ${selected} 个`;
}

function renderFileList(files) {
    fileCache = files;
    const area    = panel.querySelector('#__cd_file_area');
    const listEl  = panel.querySelector('#__cd_file_list');
    const btn     = panel.querySelector('#__cd_btn');

    area.style.display  = 'block';
    btn.textContent     = '🔄 重新获取列表';
    btn.onclick         = fetchFileList;

    listEl.innerHTML = files.map((f, i) => `
        <label style="display:flex; align-items:center; padding:4px 2px;
               cursor:pointer; border-bottom:1px solid #f0f0f0; gap:6px;"
               title="${f.name}">
          <input type="checkbox" class="__cd_chk" data-i="${i}" checked
                 style="flex-shrink:0; cursor:pointer; width:14px; height:14px;">
          <span style="font-size:12px; overflow:hidden; text-overflow:ellipsis;
                       white-space:nowrap; flex:1;">
            ${getFileIcon(f.name)} ${f.name}
          </span>
        </label>`).join('');

    panel.querySelector('#__cd_select_all').onclick = () => {
        listEl.querySelectorAll('.__cd_chk').forEach(c => c.checked = true);
        refreshSelectedCount();
    };
    panel.querySelector('#__cd_select_none').onclick = () => {
        listEl.querySelectorAll('.__cd_chk').forEach(c => c.checked = false);
        refreshSelectedCount();
    };

    listEl.addEventListener('change', refreshSelectedCount);
    refreshSelectedCount();

    panel.querySelector('#__cd_download_selected').onclick = startDownload;
}

// ============================================
// 获取文件列表
// ============================================
async function fetchFileList() {
    const btn = panel.querySelector('#__cd_btn');
    btn.disabled = true;
    btn.textContent = '⏳ 获取中...';
    panel.querySelector('#__cd_file_area').style.display = 'none';
    clearLog();

    try {
        let allMsgs = [], endMsgId = null, page = 0;

        while (true) {
            page++;
            let url = `${CHAT_API}/msgs?limit=100`;
            if (endMsgId) url += `&endMsgId=${endMsgId}`;

            const res  = await fetch(url, {
                credentials: 'include',
                headers: { 'Portal-Token': STATE.portalToken }
            });
            const data = await res.json();
            const msgs = data.msgs || data.data?.msgs || data.data || [];

            if (!Array.isArray(msgs) || msgs.length === 0) break;
            log(`📄 第${page}页: ${msgs.length} 条`);
            allMsgs = allMsgs.concat(msgs);

            if (msgs.length < 100) break;
            const newId = msgs[0]?.msgId || msgs[0]?.id;
            if (!newId || newId === endMsgId) break;
            endMsgId = newId;
            await new Promise(r => setTimeout(r, 300));
        }

        // 筛选文件消息
        const seen  = new Set();
        const files = allMsgs
            .filter(m => m.data?.fileId || m.data?.bh || m.mType === 2)
            .map(m => ({
                name:   m.data?.name || m.data?.wjmc || m.data?.fileName || m.data?.fileId,
                fileId: m.data?.fileId || m.data?.bh
            }))
            .filter(f => f.fileId && !seen.has(f.fileId) && seen.add(f.fileId));

        if (files.length === 0) {
            log('⚠️ 没有找到文件');
            btn.disabled = false;
            btn.textContent = '📋 重新获取';
            return;
        }

        log(`✅ 找到 ${files.length} 个文件`);
        renderFileList(files);

    } catch(e) {
        log(`❌ 出错: ${e.message}`);
        btn.disabled = false;
        btn.textContent = '📋 重试';
    }
}

// ============================================
// 下载已选文件
// ============================================
async function startDownload() {
    const checked = [...panel.querySelectorAll('.__cd_chk:checked')]
        .map(c => fileCache[parseInt(c.dataset.i)])
        .filter(Boolean);

    if (checked.length === 0) {
        log('⚠️ 请至少勾选一个文件');
        return;
    }

    // FyId 没捕获到时弹窗让用户输入
    if (!STATE.fyId) {
        STATE.fyId = prompt('请输入法院ID（URL中fyId=后面的数字）:') || '';
        if (!STATE.fyId) { log('❌ 未输入法院ID'); return; }
        updateStatus();
    }

    const dlBtn = panel.querySelector('#__cd_download_selected');
    dlBtn.disabled = true;
    clearLog();

    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch(e) {
        log('❌ 未选择文件夹');
        dlBtn.disabled = false;
        return;
    }

    log(`⬇️ 开始下载 ${checked.length} 个文件...`);
    let ok = 0;

    for (let i = 0; i < checked.length; i++) {
        const { name, fileId } = checked[i];
        dlBtn.textContent = `下载中 ${i+1}/${checked.length}...`;
        log(`[${i+1}/${checked.length}] ${name}`);
        try {
            const res = await fetch(
                `${DL_API}?bh=${fileId}&fyId=${STATE.fyId}&ajbh=${STATE.ajbh}&wjmc=${encodeURIComponent(name)}`,
                { credentials: 'include', headers: { 'authorization': STATE.authToken } }
            );
            const data   = await res.json();
            const ossUrl = data.data?.url || data.data?.fileUrl || data.data?.downloadUrl;
            if (!ossUrl) throw new Error('无OSS链接: ' + JSON.stringify(data));

            const blob = await (await fetch(ossUrl)).blob();
            const fh   = await dirHandle.getFileHandle(name, { create: true });
            const wr   = await fh.createWritable();
            await wr.write(blob);
            await wr.close();

            log(`  ✅ 已保存`);
            ok++;
            await new Promise(r => setTimeout(r, 800));
        } catch(e) {
            log(`  ❌ 失败: ${e.message}`);
        }
    }

    log(`🎉 完成！${ok}/${checked.length} 已保存`);
    dlBtn.textContent = `✅ 完成 ${ok}/${checked.length}`;
    dlBtn.disabled = false;
}

// 初始化
updateStatus();
