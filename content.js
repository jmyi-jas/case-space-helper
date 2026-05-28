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

let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        parseFromUrl();
        updateStatus();
    }
}, 1000);

window.addEventListener('__cd_tokens', (e) => {
    const { type, token } = e.detail;
    if (type === 'portal' && !STATE.portalToken) { STATE.portalToken = token; updateStatus(); }
    if (type === 'auth'   && !STATE.authToken)   { STATE.authToken   = token; updateStatus(); }
    if (type === 'fyid'   && !STATE.fyId)        { STATE.fyId        = token; updateStatus(); }
    if (type === 'ajbh'   && !STATE.ajbh)        { STATE.ajbh        = token; updateStatus(); }
});

// ============================================
// 注入全局样式
// ============================================
const styleEl = document.createElement('style');
styleEl.textContent = `
  /* 滚动条美化 */
  #__court_dl_panel ::-webkit-scrollbar {
    width: 4px;
  }
  #__court_dl_panel ::-webkit-scrollbar-track {
    background: #fff0f5;
    border-radius: 4px;
  }
  #__court_dl_panel ::-webkit-scrollbar-thumb {
    background: #ffb3c6;
    border-radius: 4px;
  }
  #__court_dl_panel ::-webkit-scrollbar-thumb:hover {
    background: #ff7f9e;
  }

  /* 主按钮动画 */
  @keyframes cdPulse {
    0%   { box-shadow: 0 0 0 0 rgba(255,127,158,0.5); }
    70%  { box-shadow: 0 0 0 8px rgba(255,127,158,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,127,158,0); }
  }

  /* 面板入场动画 */
  @keyframes cdSlideIn {
    from { opacity:0; transform: translateY(20px) scale(0.95); }
    to   { opacity:1; transform: translateY(0)    scale(1);    }
  }

  /* 加载旋转 */
  @keyframes cdSpin {
    from { transform: rotate(0deg);   }
    to   { transform: rotate(360deg); }
  }

  /* checkbox 美化 */
  #__court_dl_panel .__cd_chk {
    appearance: none;
    -webkit-appearance: none;
    width: 15px;
    height: 15px;
    border: 2px solid #ffb3c6;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  #__court_dl_panel .__cd_chk:checked {
    background: linear-gradient(135deg, #ff7f9e, #ffb3c6);
    border-color: #ff7f9e;
  }
  #__court_dl_panel .__cd_chk:checked::after {
    content: '✓';
    position: absolute;
    top: -2px;
    left: 1px;
    color: #fff;
    font-size: 11px;
    font-weight: bold;
  }
  #__court_dl_panel .__cd_chk:hover {
    border-color: #ff7f9e;
    transform: scale(1.1);
  }

  /* 文件项悬停 */
  #__court_dl_panel .__cd_file_item:hover {
    background: #fff0f5 !important;
    border-radius: 8px;
  }

  /* 小按钮悬停 */
  #__court_dl_panel .__cd_mini_btn:hover {
    background: #ff7f9e !important;
    color: #fff !important;
    border-color: #ff7f9e !important;
  }

  /* 标签徽章动画 */
  @keyframes cdBadgePop {
    0%   { transform: scale(0.8); }
    50%  { transform: scale(1.1); }
    100% { transform: scale(1);   }
  }
`;
document.head.appendChild(styleEl);

// ============================================
// 创建悬浮面板
// ============================================
const panel = document.createElement('div');
panel.id = '__court_dl_panel';

panel.innerHTML = `
  <!-- 顶部标题栏 -->
  <div id="__cd_header">
    <div style="display:flex; align-items:center; gap:8px;">
      <div id="__cd_logo_wrap">
        <img id="__cd_logo" src="${chrome.runtime.getURL('download.png')}"
             style="width:26px; height:26px; border-radius:50%;
                    border:2px solid rgba(255,255,255,0.6);
                    object-fit:cover; display:block;">
      </div>
      <div>
        <div style="font-size:13px; font-weight:700; letter-spacing:0.5px;">案件小助手</div>
        <div style="font-size:10px; opacity:0.85; margin-top:1px;">一键下载全部附件 🎀</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:6px;">
      <div id="__cd_ready_dot" title="就绪状态"
           style="width:8px; height:8px; border-radius:50%;
                  background:#ffcdd2; transition:background 0.3s ease;"></div>
      <span id="__cd_close"
            style="cursor:pointer; font-size:16px; opacity:0.8;
                   transition:opacity 0.2s; line-height:1;"
            title="关闭">✕</span>
    </div>
  </div>

  <!-- 主体内容 -->
  <div id="__cd_body">

    <!-- 状态卡片 -->
    <div id="__cd_status_card">
      <div id="__cd_status_text">⏳ 等待页面加载...</div>
      <div id="__cd_info"></div>
    </div>

    <!-- 主操作按钮 -->
    <button id="__cd_btn" disabled>请先浏览案件页面</button>

    <!-- 文件列表区域 -->
    <div id="__cd_file_area" style="display:none; margin-top:10px;">

      <!-- 文件列表头部 -->
      <div style="display:flex; justify-content:space-between;
                  align-items:center; margin-bottom:6px;">
        <div id="__cd_file_count_badge">
          <span id="__cd_file_count">共 0 个</span>
        </div>
        <div style="display:flex; gap:4px;">
          <button id="__cd_select_all"  class="__cd_mini_btn">全选</button>
          <button id="__cd_select_none" class="__cd_mini_btn">全不选</button>
        </div>
      </div>

      <!-- 文件列表 -->
      <div id="__cd_file_list"></div>

      <!-- 下载按钮 -->
      <button id="__cd_download_selected">
        <span id="__cd_dl_icon">⬇️</span>
        <span id="__cd_dl_text">下载已选文件</span>
      </button>
    </div>

    <!-- 日志区域 -->
    <div id="__cd_log_wrap" style="display:none;">
      <div id="__cd_log_title">
        <span>📋 运行日志</span>
        <span id="__cd_log_clear" style="cursor:pointer; opacity:0.6; font-size:10px;">清空</span>
      </div>
      <div id="__cd_log"></div>
    </div>

  </div>
`;

// ============================================
// 面板样式
// ============================================
panel.style.cssText = `
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 300px;
  background: #fff8fa;
  border: none;
  border-radius: 18px;
  box-shadow:
    0 8px 32px rgba(255,127,158,0.25),
    0 2px 8px  rgba(255,127,158,0.15),
    0 0 0 1px rgba(255,180,200,0.3);
  z-index: 999999;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  overflow: hidden;
  animation: cdSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
  transition: box-shadow 0.3s ease;
`;

// 标题栏
panel.querySelector('#__cd_header').style.cssText = `
  background: linear-gradient(135deg, #ff7f9e 0%, #ffb3c6 100%);
  color: #fff;
  padding: 12px 14px;
  font-weight: bold;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
`;

// 主体
panel.querySelector('#__cd_body').style.cssText = `
  padding: 12px 14px 14px;
`;

// 状态卡片
panel.querySelector('#__cd_status_card').style.cssText = `
  background: linear-gradient(135deg, #fff0f5, #ffe4ef);
  border: 1px solid #ffc8d8;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
`;

panel.querySelector('#__cd_status_text').style.cssText = `
  font-size: 12px;
  color: #d63468;
  font-weight: 600;
  margin-bottom: 6px;
`;

panel.querySelector('#__cd_info').style.cssText = `
  line-height: 1.9;
  font-size: 11px;
  color: #b05070;
`;

// 主按钮
panel.querySelector('#__cd_btn').style.cssText = `
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #ff7f9e, #ffb3c6);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  box-shadow: 0 4px 12px rgba(255,127,158,0.4);
`;

// 文件数量徽章
panel.querySelector('#__cd_file_count_badge').style.cssText = `
  background: linear-gradient(135deg, #ffb3c6, #ff7f9e);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  animation: cdBadgePop 0.3s ease;
`;

// 小按钮（全选/全不选）
['#__cd_select_all','#__cd_select_none'].forEach(id => {
    panel.querySelector(id).style.cssText = `
      font-size: 11px;
      padding: 3px 8px;
      cursor: pointer;
      border: 1.5px solid #ffb3c6;
      border-radius: 8px;
      background: #fff;
      color: #ff7f9e;
      font-weight: 600;
      transition: all 0.2s ease;
    `;
    panel.querySelector(id).className = '__cd_mini_btn';
});

// 文件列表容器
panel.querySelector('#__cd_file_list').style.cssText = `
  max-height: 180px;
  overflow-y: auto;
  border: 1.5px solid #ffc8d8;
  border-radius: 12px;
  padding: 4px 6px;
  background: #fff;
`;

// 下载按钮
panel.querySelector('#__cd_download_selected').style.cssText = `
  width: 100%;
  padding: 11px;
  margin-top: 10px;
  background: linear-gradient(135deg, #ff7f9e, #ff4d79);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  box-shadow: 0 4px 14px rgba(255,77,121,0.4);
  animation: cdPulse 2s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
`;

// 日志区域外框
panel.querySelector('#__cd_log_wrap').style.cssText = `
  margin-top: 10px;
  border: 1.5px solid #ffc8d8;
  border-radius: 12px;
  overflow: hidden;
`;

// 日志标题栏
panel.querySelector('#__cd_log_title').style.cssText = `
  background: linear-gradient(135deg, #fff0f5, #ffe4ef);
  padding: 5px 10px;
  font-size: 11px;
  color: #d63468;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ffc8d8;
`;

// 日志内容
panel.querySelector('#__cd_log').style.cssText = `
  max-height: 110px;
  overflow-y: auto;
  padding: 6px 10px;
  font-size: 11px;
  color: #b05070;
  line-height: 1.7;
  background: #fff;
`;

document.body.appendChild(panel);

// ============================================
// 按钮交互特效
// ============================================
const mainBtn = panel.querySelector('#__cd_btn');
mainBtn.addEventListener('mouseenter', () => {
    if (!mainBtn.disabled) {
        mainBtn.style.transform = 'translateY(-2px) scale(1.02)';
        mainBtn.style.boxShadow = '0 6px 18px rgba(255,127,158,0.55)';
    }
});
mainBtn.addEventListener('mouseleave', () => {
    mainBtn.style.transform = '';
    mainBtn.style.boxShadow = '0 4px 12px rgba(255,127,158,0.4)';
});

const dlBtn = panel.querySelector('#__cd_download_selected');
dlBtn.addEventListener('mouseenter', () => {
    dlBtn.style.transform = 'translateY(-2px) scale(1.02)';
    dlBtn.style.boxShadow = '0 6px 20px rgba(255,77,121,0.55)';
});
dlBtn.addEventListener('mouseleave', () => {
    dlBtn.style.transform = '';
    dlBtn.style.boxShadow = '0 4px 14px rgba(255,77,121,0.4)';
});

// 关闭按钮
const closeBtn = panel.querySelector('#__cd_close');
closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.8');
closeBtn.onclick = () => {
    panel.style.animation = 'none';
    panel.style.opacity   = '0';
    panel.style.transform = 'translateY(10px) scale(0.95)';
    panel.style.transition = 'all 0.25s ease';
    setTimeout(() => panel.style.display = 'none', 250);
};

// 日志清空
panel.querySelector('#__cd_log_clear').onclick = clearLog;

// ============================================
// 拖拽
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
    panel.style.left   = origLeft + 'px';
    panel.style.top    = origTop  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transition = 'none';
    e.preventDefault();
});

document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const newLeft = origLeft + (e.clientX - startX);
    const newTop  = origTop  + (e.clientY - startY);
    const maxLeft = window.innerWidth  - panel.offsetWidth;
    const maxTop  = window.innerHeight - panel.offsetHeight;
    panel.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
    panel.style.top  = Math.max(0, Math.min(newTop,  maxTop))  + 'px';
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    panel.style.transition = 'box-shadow 0.3s ease';
});

// ============================================
// 状态更新
// ============================================
function updateStatus() {
    parseFromUrl();
    const ready    = STATE.portalToken && STATE.authToken && STATE.ajbh;
    const statusEl = panel.querySelector('#__cd_status_text');
    const infoEl   = panel.querySelector('#__cd_info');
    const btn      = panel.querySelector('#__cd_btn');
    const dot      = panel.querySelector('#__cd_ready_dot');

    const items = [
        STATE.portalToken ? '✅ Portal-Token 已捕获'           : '⏳ Portal-Token（滚动消息列表）',
        STATE.authToken   ? '✅ Auth-Token 已捕获'             : '⏳ Auth-Token（点击任意案件）',
        STATE.ajbh        ? `✅ 案件：${STATE.ajbh.slice(0,8)}…` : '⏳ AJBH（打开案件页）',
        STATE.fyId        ? `✅ 法院ID：${STATE.fyId}`         : '⚠️ FyId（下载时手动填）',
    ];

    infoEl.innerHTML = items.map(i => `
        <div style="display:flex; align-items:center; gap:4px;">${i}</div>
    `).join('');

    if (ready) {
        statusEl.textContent = '🌸 就绪！点击获取文件列表';
        statusEl.style.color = '#c0306a';
        dot.style.background = '#ff7f9e';
        dot.style.boxShadow  = '0 0 6px rgba(255,127,158,0.8)';
        btn.textContent      = '📋 获取文件列表';
        btn.disabled         = false;
        btn.style.opacity    = '1';
        btn.onclick          = fetchFileList;
    } else {
        statusEl.textContent = '⏳ 等待捕获参数...';
        statusEl.style.color = '#d63468';
        dot.style.background = '#ffcdd2';
        dot.style.boxShadow  = 'none';
        btn.textContent      = '请先浏览案件页面';
        btn.disabled         = true;
        btn.style.opacity    = '0.6';
    }
}

// ============================================
// 日志
// ============================================
function log(msg) {
    const wrap = panel.querySelector('#__cd_log_wrap');
    const el   = panel.querySelector('#__cd_log');
    wrap.style.display = 'block';

    // 根据消息类型设置颜色
    let color = '#b05070';
    if (msg.includes('✅') || msg.includes('🎉')) color = '#d63468';
    if (msg.includes('❌'))                        color = '#e53935';
    if (msg.includes('⚠️'))                        color = '#f57c00';

    el.innerHTML += `
        <div style="color:${color}; padding:1px 0;
                    border-bottom:1px solid #fff0f5;">${msg}</div>`;
    el.scrollTop = el.scrollHeight;
}

function clearLog() {
    panel.querySelector('#__cd_log').innerHTML = '';
    panel.querySelector('#__cd_log_wrap').style.display = 'none';
}

// ============================================
// 文件列表渲染
// ============================================
let fileCache = [];

function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map = {
        pdf:'📄', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️',
        doc:'📝', docx:'📝', xls:'📊', xlsx:'📊',
        mp4:'🎬', mp3:'🎵', zip:'🗜️', rar:'🗜️'
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
    const area   = panel.querySelector('#__cd_file_area');
    const listEl = panel.querySelector('#__cd_file_list');
    const btn    = panel.querySelector('#__cd_btn');

    area.style.display = 'block';
    btn.textContent    = '🔄 重新获取列表';
    btn.onclick        = fetchFileList;

    listEl.innerHTML = files.map((f, i) => `
        <label class="__cd_file_item"
               style="display:flex; align-items:center; padding:5px 4px;
                      cursor:pointer; gap:6px; transition:background 0.15s ease;
                      border-bottom:1px solid #fff0f5;"
               title="${f.name}">
          <input type="checkbox" class="__cd_chk" data-i="${i}" checked>
          <span style="font-size:12px; overflow:hidden; text-overflow:ellipsis;
                       white-space:nowrap; flex:1; color:#c0306a;">
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
    btn.disabled    = true;
    btn.textContent = '⏳ 获取中...';
    btn.style.opacity = '0.7';
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
            log(`📄 第 ${page} 页：${msgs.length} 条消息`);
            allMsgs = allMsgs.concat(msgs);

            if (msgs.length < 100) break;
            const newId = msgs[0]?.msgId || msgs[0]?.id;
            if (!newId || newId === endMsgId) break;
            endMsgId = newId;
            await new Promise(r => setTimeout(r, 300));
        }

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
            btn.disabled  = false;
            btn.style.opacity = '1';
            btn.textContent = '📋 重新获取';
            return;
        }

        log(`✅ 找到 ${files.length} 个文件 🎀`);
        renderFileList(files);
        btn.style.opacity = '1';

    } catch(e) {
        log(`❌ 出错：${e.message}`);
        btn.disabled  = false;
        btn.style.opacity = '1';
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

    if (!STATE.fyId) {
        STATE.fyId = prompt('请输入法院ID（URL 中 fyId= 后面的数字）:') || '';
        if (!STATE.fyId) { log('❌ 未输入法院ID'); return; }
        updateStatus();
    }

    const dlBtn  = panel.querySelector('#__cd_download_selected');
    const dlText = panel.querySelector('#__cd_dl_text');
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
        dlText.textContent = `下载中 ${i+1}/${checked.length}`;
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
            log(`  ❌ 失败：${e.message}`);
        }
    }

    log(`🎉 完成！${ok}/${checked.length} 个文件已保存 🎀`);
    dlText.textContent = `✅ 完成 ${ok}/${checked.length}`;
    dlBtn.disabled = false;
}

// 初始化
updateStatus();
