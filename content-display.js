/* content-display.js - 公共展示配置（资讯与问卷 › 展示配置）
   定位：公共信息内容（newsData）与展示位之间的投放关系表。
   一条资讯可投放到多个展示位，一个展示位也可承载多条资讯；
   本模块只管「投到哪、怎么排、怎么显示」，内容本身仍在「资讯管理」维护。 */

/* ==================== 常量：展示端 / 展示位置 ==================== */
const DISPLAY_CLIENTS = ['门户网站', '管理后台', '移动端', '大屏'];

const DISPLAY_POSITIONS = {
  '门户网站': ['首页轮播', '首页公告栏', '资讯列表页'],
  '管理后台': ['工作台资讯栏', '通知提醒条'],
  '移动端': ['首页Banner', '消息中心'],
  '大屏': ['数据大屏侧栏']
};

const DISPLAY_STYLE_SIZES = [{ v: 'sm', l: '小' }, { v: 'md', l: '中' }, { v: 'lg', l: '大' }];
const DISPLAY_STYLE_TONES = [
  { v: 'default', l: '默认（深灰）' },
  { v: 'primary', l: '主题蓝' },
  { v: 'warning', l: '警示橙' },
  { v: 'danger', l: '重要红' }
];
const DISPLAY_STYLE_ICONS = [
  { v: 'dot', l: '圆点 ●' },
  { v: 'star', l: '星标 ★' },
  { v: 'diamond', l: '菱形 ◆' },
  { v: 'triangle', l: '三角 ▲' }
];

/* ==================== 数据 ==================== */
let displayConfigData = [
  {
    id: 1, code: 'DC20260620001', newsId: 1, client: '门户网站', position: '首页轮播',
    priority: 1, enabled: true,
    style: { size: 'lg', tone: 'primary', bold: true, showSummary: true, showDate: false, maxItems: 3, icon: 'star' },
    startTime: '2026-06-20', endTime: '2026-12-31', remark: '年度工作会议置顶轮播',
    creator: '管理员', createTime: '2026-06-20', updateTime: '2026-06-20'
  },
  {
    id: 2, code: 'DC20260620002', newsId: 1, client: '门户网站', position: '首页公告栏',
    priority: 1, enabled: true,
    style: { size: 'md', tone: 'danger', bold: true, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' },
    startTime: '2026-06-20', endTime: '2026-12-31', remark: '',
    creator: '管理员', createTime: '2026-06-20', updateTime: '2026-06-20'
  },
  {
    id: 3, code: 'DC20260618001', newsId: 2, client: '门户网站', position: '首页公告栏',
    priority: 2, enabled: true,
    style: { size: 'md', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' },
    startTime: '2026-06-18', endTime: '', remark: '',
    creator: '管理员', createTime: '2026-06-18', updateTime: '2026-06-18'
  },
  {
    id: 4, code: 'DC20260615001', newsId: 3, client: '门户网站', position: '资讯列表页',
    priority: 1, enabled: true,
    style: { size: 'md', tone: 'default', bold: false, showSummary: true, showDate: true, maxItems: 10, icon: 'dot' },
    startTime: '2026-06-15', endTime: '', remark: '列表页推荐位',
    creator: '管理员', createTime: '2026-06-15', updateTime: '2026-06-15'
  },
  {
    id: 5, code: 'DC20260620003', newsId: 1, client: '管理后台', position: '工作台资讯栏',
    priority: 1, enabled: true,
    style: { size: 'sm', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' },
    startTime: '2026-06-20', endTime: '2026-12-31', remark: '工作台资讯栏「公告通知」Tab',
    creator: '管理员', createTime: '2026-06-20', updateTime: '2026-06-20'
  },
  {
    id: 6, code: 'DC20260615002', newsId: 3, client: '管理后台', position: '工作台资讯栏',
    priority: 2, enabled: true,
    style: { size: 'sm', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' },
    startTime: '2026-06-15', endTime: '', remark: '',
    creator: '管理员', createTime: '2026-06-15', updateTime: '2026-06-15'
  },
  {
    id: 7, code: 'DC20260620004', newsId: 4, client: '管理后台', position: '通知提醒条',
    priority: 1, enabled: false,
    style: { size: 'md', tone: 'warning', bold: true, showSummary: false, showDate: false, maxItems: 1, icon: 'triangle' },
    startTime: '2026-06-10', endTime: '2026-07-10', remark: '已过投放期，暂停启用',
    creator: '管理员', createTime: '2026-06-10', updateTime: '2026-07-11'
  },
  {
    id: 8, code: 'DC20260610001', newsId: 4, client: '移动端', position: '首页Banner',
    priority: 1, enabled: true,
    style: { size: 'lg', tone: 'primary', bold: true, showSummary: true, showDate: false, maxItems: 2, icon: 'star' },
    startTime: '2026-06-10', endTime: '', remark: '健康科普专题',
    creator: '管理员', createTime: '2026-06-10', updateTime: '2026-06-10'
  },
  {
    id: 9, code: 'DC20260608001', newsId: 5, client: '大屏', position: '数据大屏侧栏',
    priority: 1, enabled: false,
    style: { size: 'md', tone: 'warning', bold: false, showSummary: false, showDate: true, maxItems: 3, icon: 'dot' },
    startTime: '2026-06-08', endTime: '2026-06-30', remark: '维护通知，已下线',
    creator: '管理员', createTime: '2026-06-08', updateTime: '2026-07-01'
  },
  {
    id: 10, code: 'DC20260610002', newsId: 4, client: '门户网站', position: '首页公告栏',
    priority: 3, enabled: true,
    style: { size: 'md', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' },
    startTime: '2026-06-10', endTime: '', remark: '健康科普专题推荐',
    creator: '管理员', createTime: '2026-06-10', updateTime: '2026-06-10'
  },
  {
    id: 11, code: 'DC20260618002', newsId: 2, client: '门户网站', position: '首页轮播',
    priority: 2, enabled: true,
    style: { size: 'lg', tone: 'default', bold: true, showSummary: true, showDate: false, maxItems: 3, icon: 'diamond' },
    startTime: '2026-06-18', endTime: '', remark: '',
    creator: '管理员', createTime: '2026-06-18', updateTime: '2026-06-18'
  },
  {
    id: 12, code: 'DC20260615003', newsId: 3, client: '移动端', position: '消息中心',
    priority: 1, enabled: true,
    style: { size: 'sm', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 10, icon: 'dot' },
    startTime: '2026-06-15', endTime: '', remark: '质控通报推送',
    creator: '管理员', createTime: '2026-06-15', updateTime: '2026-06-15'
  }
];

let displayConfigState = {
  mode: 'list',
  editingId: null,
  page: 1,
  pageSize: 10,
  filters: { client: '全部', position: '全部', enabled: '全部', keyword: '' }
};

/* ==================== 工具 ==================== */
function dispCfgToday() { return new Date().toISOString().slice(0, 10); }

function dispCfgAllPositions() {
  const out = [];
  DISPLAY_CLIENTS.forEach(function (c) {
    (DISPLAY_POSITIONS[c] || []).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
  });
  return out;
}

function dispCfgBtn(label, onclick, variant) {
  let cls = 'btn btn-sm btn-primary';
  if (variant === 'ghost') cls = 'btn btn-sm btn-ghost';
  if (variant === 'danger') cls = 'btn btn-sm btn-danger';
  if (variant === 'export') cls = 'btn btn-sm btn-export';
  if (variant === 'link') cls = 'btn-link';
  if (variant === 'link-danger') cls = 'btn-link danger';
  return '<button class="' + cls + '" onclick="' + onclick + '">' + label + '</button>';
}

function dispCfgClientTag(client) {
  const tone = { '门户网站': '#0369a1|#f0f9ff', '管理后台': '#6d28d9|#f5f3ff', '移动端': '#047857|#ecfdf5', '大屏': '#b45309|#fffbeb' }[client] || '#475569|#f8fafc';
  const parts = tone.split('|');
  return '<span style="display:inline-block;padding:2px 8px;background:' + parts[1] + ';color:' + parts[0] + ';border-radius:4px;font-size:12px">' + client + '</span>';
}

function dispCfgStatusBadge(enabled) {
  return enabled
    ? '<span class="badge badge-success">启用</span>'
    : '<span class="badge badge-muted">停用</span>';
}

function dispCfgNewsTitle(newsId) {
  const n = newsData.find(function (r) { return r.id === newsId; });
  return n ? n.title : '<span style="color:#cbd5e1">内容已删除</span>';
}

function dispCfgNewsCategory(newsId) {
  const n = newsData.find(function (r) { return r.id === newsId; });
  return n ? n.category : '-';
}

function dispCfgNextId() {
  return Math.max(0, ...displayConfigData.map(function (r) { return r.id; })) + 1;
}

function dispCfgNextCode() {
  const d = dispCfgToday().replace(/-/g, '');
  const prefix = 'DC' + d;
  const seq = displayConfigData.filter(function (r) { return String(r.code || '').indexOf(prefix) === 0; }).length + 1;
  return prefix + String(seq).padStart(3, '0');
}

/* 投放是否在有效期内（与启用状态是两个独立门禁） */
function dispCfgInPeriod(cfg) {
  const today = dispCfgToday();
  if (cfg.startTime && cfg.startTime > today) return false;
  if (cfg.endTime && cfg.endTime < today) return false;
  return true;
}

/* ==================== 展示端消费接口 ====================
   前端各展示位统一走这里取数：
   - 配置启用
   - 投放期有效
   - 关联资讯存在且自身为启用状态
   - 按优先级升序（数字小的靠前），同优先级按 id 兜底保证顺序稳定 */
function getDisplayItems(client, position, limit) {
  const out = [];
  displayConfigData.forEach(function (cfg) {
    if (client && cfg.client !== client) return;
    if (position && cfg.position !== position) return;
    if (!cfg.enabled) return;
    if (!dispCfgInPeriod(cfg)) return;
    const news = newsData.find(function (r) { return r.id === cfg.newsId; });
    if (!news || news.status !== 'enabled') return;
    out.push({ cfg: cfg, news: news });
  });
  out.sort(function (a, b) {
    return (a.cfg.priority - b.cfg.priority) || (a.cfg.id - b.cfg.id);
  });
  return limit ? out.slice(0, limit) : out;
}

/* 某展示位当前生效的条数上限（取该位置所有启用配置里的最小值） */
function getDisplayMaxItems(client, position, fallback) {
  const nums = displayConfigData
    .filter(function (c) { return c.client === client && c.position === position && c.enabled && dispCfgInPeriod(c); })
    .map(function (c) { return parseInt((c.style || {}).maxItems, 10) || 0; })
    .filter(function (n) { return n > 0; });
  return nums.length ? Math.min.apply(null, nums) : (fallback || 99);
}

/* 删除资讯前的级联提示文案（供资讯管理删除确认弹窗调用） */
function dispCfgCascadeHint(newsId) {
  const n = displayConfigData.filter(function (c) { return c.newsId === newsId; }).length;
  if (!n) return '';
  return '<br><span style="color:#b45309">该资讯当前有 ' + n + ' 条展示配置，删除后将一并移除。</span>';
}

/* 资讯删除后的级联清理，返回被清理的配置条数 */
function dispCfgPurgeByNews(newsId) {
  const before = displayConfigData.length;
  displayConfigData = displayConfigData.filter(function (c) { return c.newsId !== newsId; });
  return before - displayConfigData.length;
}

/* ==================== 列表页 ==================== */
function getDisplayConfigFiltered() {
  const f = displayConfigState.filters;
  const kw = (f.keyword || '').toLowerCase();
  const rows = displayConfigData.filter(function (c) {
    if (f.client !== '全部' && c.client !== f.client) return false;
    if (f.position !== '全部' && c.position !== f.position) return false;
    if (f.enabled !== '全部' && String(c.enabled) !== f.enabled) return false;
    if (kw) {
      const title = String(dispCfgNewsTitle(c.newsId)).toLowerCase();
      const code = String(c.code || '').toLowerCase();
      if (title.indexOf(kw) < 0 && code.indexOf(kw) < 0) return false;
    }
    return true;
  });
  const clientOrder = function (c) { const i = DISPLAY_CLIENTS.indexOf(c); return i < 0 ? 99 : i; };
  const posOrder = function (c) { const i = dispCfgAllPositions().indexOf(c); return i < 0 ? 99 : i; };
  return rows.sort(function (a, b) {
    return (clientOrder(a.client) - clientOrder(b.client)) ||
      (posOrder(a.position) - posOrder(b.position)) ||
      ((a.priority || 0) - (b.priority || 0)) ||
      (a.id - b.id);
  });
}

function renderDisplayConfigList() {
  const filtered = getDisplayConfigFiltered();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / displayConfigState.pageSize));
  if (displayConfigState.page > totalPages) displayConfigState.page = totalPages;
  const start = (displayConfigState.page - 1) * displayConfigState.pageSize;
  const pageRows = filtered.slice(start, start + displayConfigState.pageSize);

  const rows = pageRows.map(function (c) {
    const period = (c.startTime || '不限') + ' ~ ' + (c.endTime || '不限');
    const ops = [
      dispCfgBtn('编辑', 'dispCfgEdit(' + c.id + ')', 'link'),
      dispCfgBtn(c.enabled ? '停用' : '启用', 'dispCfgToggle(' + c.id + ')', 'link'),
      dispCfgBtn('删除', 'dispCfgDelete(' + c.id + ')', 'link-danger')
    ];
    return '<tr>' +
      '<td class="code"><a href="javascript:void(0)" onclick="dispCfgView(' + c.id + ')" style="color:#2563eb;font-weight:600">' + c.code + '</a></td>' +
      '<td class="txt" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + dispCfgNewsTitle(c.newsId) + '">' + dispCfgNewsTitle(c.newsId) + '</td>' +
      '<td class="txt">' + dispCfgNewsCategory(c.newsId) + '</td>' +
      '<td class="txt">' + dispCfgClientTag(c.client) + '</td>' +
      '<td class="txt">' + c.position + '</td>' +
      '<td class="num">' + c.priority + '</td>' +
      '<td class="code">' + period + '</td>' +
      '<td class="code">' + dispCfgStatusBadge(c.enabled) + '</td>' +
      '<td class="code">' + (c.updateTime || c.createTime || '-') + '</td>' +
      '<td><div class="row-actions">' + ops.join('') + '</div></td>' +
      '</tr>';
  }).join('');

  const clientOpts = ['全部'].concat(DISPLAY_CLIENTS).map(function (c) {
    return '<option value="' + c + '"' + (displayConfigState.filters.client === c ? ' selected' : '') + '>' + c + '</option>';
  }).join('');
  const posOpts = ['全部'].concat(dispCfgAllPositions()).map(function (p) {
    return '<option value="' + p + '"' + (displayConfigState.filters.position === p ? ' selected' : '') + '>' + p + '</option>';
  }).join('');

  return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>公共展示配置</div>' +
    '<div class="toolbar-actions">' +
    dispCfgBtn('位置预览', 'dispCfgPreviewOpen()', 'ghost') +
    dispCfgBtn('导出Excel', 'dispCfgExport()', 'export') +
    dispCfgBtn('+ 新增配置', 'dispCfgAdd()') +
    '</div></div>' +
    '<div class="panel"><div class="panel-body">' +
    '<div class="filter-toolbar">' +
    '<div class="form-group"><label>展示端</label><select onchange="displayConfigState.filters.client=this.value;displayConfigState.page=1;dispCfgQuery()">' + clientOpts + '</select></div>' +
    '<div class="form-group"><label>展示位置</label><select onchange="displayConfigState.filters.position=this.value;displayConfigState.page=1;dispCfgQuery()">' + posOpts + '</select></div>' +
    '<div class="form-group"><label>状态</label><select onchange="displayConfigState.filters.enabled=this.value;displayConfigState.page=1;dispCfgQuery()">' +
    '<option value="全部"' + (displayConfigState.filters.enabled === '全部' ? ' selected' : '') + '>全部</option>' +
    '<option value="true"' + (displayConfigState.filters.enabled === 'true' ? ' selected' : '') + '>启用</option>' +
    '<option value="false"' + (displayConfigState.filters.enabled === 'false' ? ' selected' : '') + '>停用</option>' +
    '</select></div>' +
    '<div class="form-group search-group"><label>检索内容</label><input type="text" id="dispCfgKeyword" placeholder="配置编号 / 资讯标题" value="' + displayConfigState.filters.keyword + '" oninput="autoQuery(dispCfgQuery)"></div>' +
    '<div class="filter-actions">' + dispCfgBtn('查询', 'dispCfgQuery()') + dispCfgBtn('重置', 'dispCfgResetFilter()', 'ghost') + '</div>' +
    '</div>' +
    '<div class="data-table-wrapper"><table class="data-table" style="min-width:1180px"><thead><tr>' +
    '<th class="code">配置编号</th><th class="txt">关联公共信息</th><th class="txt">信息类型</th>' +
    '<th class="txt">展示端</th><th class="txt">展示位置</th><th class="num">优先级</th>' +
    '<th class="code">投放有效期</th><th class="code">状态</th><th class="code">更新时间</th><th style="width:200px">操作</th>' +
    '</tr></thead><tbody>' +
    (pageRows.length ? rows : '<tr><td colspan="10" class="empty-row">暂无展示配置，点击右上角「+ 新增配置」创建</td></tr>') +
    '</tbody></table></div>' +
    '<div class="void-pagination"><span class="void-pagination-info">共 ' + total + ' 条配置，第 ' + displayConfigState.page + '/' + totalPages + ' 页</span>' +
    '<div class="void-pagination-controls">' +
    '<button onclick="dispCfgGoPage(1)" ' + (displayConfigState.page === 1 ? 'disabled' : '') + '>首页</button>' +
    '<button onclick="dispCfgGoPage(' + (displayConfigState.page - 1) + ')" ' + (displayConfigState.page === 1 ? 'disabled' : '') + '>\u2039</button>' +
    '<input type="text" value="' + displayConfigState.page + '" readonly>' +
    '<button onclick="dispCfgGoPage(' + (displayConfigState.page + 1) + ')" ' + (displayConfigState.page >= totalPages ? 'disabled' : '') + '>\u203A</button>' +
    '<button onclick="dispCfgGoPage(' + totalPages + ')" ' + (displayConfigState.page >= totalPages ? 'disabled' : '') + '>尾页</button>' +
    '</div></div>' +
    '</div></div>';
}

function dispCfgQuery() {
  const el = document.getElementById('dispCfgKeyword');
  if (el) displayConfigState.filters.keyword = (el.value || '').trim();
  displayConfigState.page = 1;
  renderPage('content-display');
}

function dispCfgResetFilter() {
  displayConfigState.filters = { client: '全部', position: '全部', enabled: '全部', keyword: '' };
  displayConfigState.page = 1;
  renderPage('content-display');
  toast('筛选条件已重置');
}

function dispCfgGoPage(page) {
  const totalPages = Math.max(1, Math.ceil(getDisplayConfigFiltered().length / displayConfigState.pageSize));
  if (page < 1 || page > totalPages) return;
  displayConfigState.page = page;
  renderPage('content-display');
}

function dispCfgAdd() {
  displayConfigState.mode = 'form';
  displayConfigState.editingId = null;
  renderPage('content-display');
}

function dispCfgEdit(id) {
  displayConfigState.mode = 'form';
  displayConfigState.editingId = id;
  renderPage('content-display');
}

function dispCfgCancelForm() {
  displayConfigState.mode = 'list';
  displayConfigState.editingId = null;
  renderPage('content-display');
}

function dispCfgToggle(id) {
  const cfg = displayConfigData.find(function (c) { return c.id === id; });
  if (!cfg) return;
  cfg.enabled = !cfg.enabled;
  cfg.updateTime = dispCfgToday();
  renderPage('content-display');
  toast('配置「' + cfg.code + '」已' + (cfg.enabled ? '启用' : '停用'));
}

function dispCfgDelete(id) {
  const cfg = displayConfigData.find(function (c) { return c.id === id; });
  if (!cfg) return;
  showConfirm('确认删除',
    '确定要删除展示配置「<strong>' + cfg.code + '</strong>」吗？<br>关联信息：' + dispCfgNewsTitle(cfg.newsId) +
    '<br>删除后该展示位将不再展示此内容，配置不可恢复。',
    function () { dispCfgConfirmDelete(id); });
}

function dispCfgConfirmDelete(id) {
  displayConfigData = displayConfigData.filter(function (c) { return c.id !== id; });
  document.querySelectorAll('.news-confirm-modal').forEach(function (m) { m.remove(); });
  renderPage('content-display');
  toast('展示配置已删除');
}

/* ==================== 详情 ==================== */
function dispCfgView(id) {
  const cfg = displayConfigData.find(function (c) { return c.id === id; });
  if (!cfg) return;
  const news = newsData.find(function (r) { return r.id === cfg.newsId; });
  const st = cfg.style || {};
  const sizeLabel = (DISPLAY_STYLE_SIZES.find(function (s) { return s.v === st.size; }) || {}).l || '-';
  const toneLabel = (DISPLAY_STYLE_TONES.find(function (s) { return s.v === st.tone; }) || {}).l || '-';
  const iconLabel = (DISPLAY_STYLE_ICONS.find(function (s) { return s.v === st.icon; }) || {}).l || '-';
  const modal = document.createElement('div');
  modal.className = 'news-confirm-modal';
  modal.style.zIndex = '10001';
  modal.innerHTML = '<div class="news-confirm-box" style="max-width:720px;max-height:88vh;overflow-y:auto">' +
    '<div class="news-confirm-title">展示配置详情 - ' + cfg.code + '</div>' +
    '<div style="padding:20px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:13px;margin-bottom:16px">' +
    '<div><strong>配置编号：</strong>' + cfg.code + '</div>' +
    '<div><strong>配置ID：</strong>' + cfg.id + '</div>' +
    '<div><strong>展示端：</strong>' + cfg.client + '</div>' +
    '<div><strong>展示位置：</strong>' + cfg.position + '</div>' +
    '<div><strong>优先级：</strong>' + cfg.priority + '（数字越小越靠前）</div>' +
    '<div><strong>状态：</strong>' + dispCfgStatusBadge(cfg.enabled) + '</div>' +
    '<div><strong>投放开始：</strong>' + (cfg.startTime || '不限') + '</div>' +
    '<div><strong>投放结束：</strong>' + (cfg.endTime || '不限') + '</div>' +
    '<div><strong>创建人：</strong>' + (cfg.creator || '-') + '</div>' +
    '<div><strong>更新时间：</strong>' + (cfg.updateTime || '-') + '</div>' +
    '</div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px">' +
    '<div style="font-weight:600;margin-bottom:6px">关联公共信息</div>' +
    '<div>标题：' + (news ? news.title : '<span style="color:#ef4444">内容已删除</span>') + '</div>' +
    '<div>类型：' + (news ? news.category : '-') + '　发布状态：' + (news ? (news.status === 'enabled' ? '启用' : '禁用') : '-') + '</div>' +
    '<div>发布时间：' + (news ? news.publishDate : '-') + '</div>' +
    '</div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px">' +
    '<div style="font-weight:600;margin-bottom:6px">样式设置</div>' +
    '<div>字号：' + sizeLabel + '　主题色：' + toneLabel + '　图标：' + iconLabel + '</div>' +
    '<div>加粗：' + (st.bold ? '是' : '否') + '　显示摘要：' + (st.showSummary ? '是' : '否') + '　显示日期：' + (st.showDate ? '是' : '否') + '　同位置条数：' + (st.maxItems || '-') + '</div>' +
    '</div>' +
    (cfg.remark ? '<div style="font-size:13px;color:#475569;margin-bottom:16px"><strong>备注：</strong>' + cfg.remark + '</div>' : '') +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px">' +
    '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px">展示效果预览</div>' +
    dispCfgRenderPreviewItem(cfg, news || { title: '（内容已删除）', publishDate: '', content: '' }) +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    dispCfgBtn('关闭', 'this.closest(\'.news-confirm-modal\').remove()', 'ghost') +
    dispCfgBtn('编辑', 'this.closest(\'.news-confirm-modal\').remove();dispCfgEdit(' + cfg.id + ')') +
    '</div></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
}

/* ==================== 表单页 ==================== */
function dispCfgPositionOptions(client, selected) {
  const list = DISPLAY_POSITIONS[client] || [];
  return list.map(function (p) {
    return '<option value="' + p + '"' + (selected === p ? ' selected' : '') + '>' + p + '</option>';
  }).join('');
}

function renderDisplayConfigForm() {
  const editing = displayConfigState.editingId
    ? displayConfigData.find(function (c) { return c.id === displayConfigState.editingId; })
    : null;
  const st = (editing && editing.style) || { size: 'md', tone: 'default', bold: false, showSummary: false, showDate: true, maxItems: 5, icon: 'dot' };
  const client = editing ? editing.client : DISPLAY_CLIENTS[0];
  const position = editing ? editing.position : (DISPLAY_POSITIONS[client] || [])[0] || '';

  const newsOpts = newsData.map(function (n) {
    const sel = editing && editing.newsId === n.id ? ' selected' : '';
    const flag = n.status === 'enabled' ? '' : '（已禁用）';
    return '<option value="' + n.id + '"' + sel + '>[' + n.category + '] ' + n.title + flag + '</option>';
  }).join('');

  const clientOpts = DISPLAY_CLIENTS.map(function (c) {
    return '<option value="' + c + '"' + (client === c ? ' selected' : '') + '>' + c + '</option>';
  }).join('');

  const sizeOpts = DISPLAY_STYLE_SIZES.map(function (s) {
    return '<option value="' + s.v + '"' + (st.size === s.v ? ' selected' : '') + '>' + s.l + '</option>';
  }).join('');
  const toneOpts = DISPLAY_STYLE_TONES.map(function (s) {
    return '<option value="' + s.v + '"' + (st.tone === s.v ? ' selected' : '') + '>' + s.l + '</option>';
  }).join('');
  const iconOpts = DISPLAY_STYLE_ICONS.map(function (s) {
    return '<option value="' + s.v + '"' + (st.icon === s.v ? ' selected' : '') + '>' + s.l + '</option>';
  }).join('');

  return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">\u25CF</span>' + (editing ? '编辑展示配置' : '新增展示配置') + '</div>' +
    '<div class="toolbar-actions">' + dispCfgBtn('\u2190 返回列表', 'dispCfgCancelForm()', 'ghost') + '</div></div>' +
    '<div class="panel"><div class="panel-body">' +
    '<div class="entry-alert" style="margin-bottom:16px"><div class="entry-alert-title">配置说明</div>' +
    '<ol><li>展示配置决定「哪条公共信息、投到哪个展示端和位置、以什么顺序和样式展示」。</li>' +
    '<li>优先级数字越小越靠前；同一展示端 + 展示位置下同一信息只能配置一次。</li>' +
    '<li>实际展示需同时满足：配置启用 + 在投放期内 + 关联资讯自身为启用状态。</li></ol></div>' +
    '<div class="pop-form-grid">' +
    '<div class="address-form-group"><label>关联公共信息 <span class="required">*</span></label>' +
    '<select id="dispCfgInputNews" onchange="dispCfgRefreshPreview()"><option value="">请选择公共信息</option>' + newsOpts + '</select></div>' +
    '<div class="address-form-group"><label>展示端 <span class="required">*</span></label>' +
    '<select id="dispCfgInputClient" onchange="dispCfgClientChange()">' + clientOpts + '</select></div>' +
    '<div class="address-form-group"><label>展示位置 <span class="required">*</span></label>' +
    '<select id="dispCfgInputPosition" onchange="dispCfgRefreshPreview()">' + dispCfgPositionOptions(client, position) + '</select></div>' +
    '<div class="address-form-group"><label>优先级 <span class="required">*</span></label>' +
    '<input type="number" id="dispCfgInputPriority" min="1" max="99" value="' + (editing ? editing.priority : 1) + '"></div>' +
    '<div class="address-form-group"><label>投放开始日期</label>' +
    '<input type="date" id="dispCfgInputStart" value="' + (editing && editing.startTime ? editing.startTime : '') + '"></div>' +
    '<div class="address-form-group"><label>投放结束日期</label>' +
    '<input type="date" id="dispCfgInputEnd" value="' + (editing && editing.endTime ? editing.endTime : '') + '"></div>' +
    '</div>' +
    '<div class="address-form-group"><label>是否启用</label>' +
    '<div class="news-status-row" style="margin-bottom:0">' +
    '<label class="radio-item"><input type="radio" name="dispCfgEnabled" value="true"' + (!editing || editing.enabled ? ' checked' : '') + ' onchange="dispCfgRefreshPreview()"> 启用</label>' +
    '<label class="radio-item"><input type="radio" name="dispCfgEnabled" value="false"' + (editing && !editing.enabled ? ' checked' : '') + ' onchange="dispCfgRefreshPreview()"> 停用</label>' +
    '</div></div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">' +
    '<div style="font-size:14px;font-weight:600;margin-bottom:12px">样式设置</div>' +
    '<div class="pop-form-grid">' +
    '<div class="address-form-group"><label>字号</label><select id="dispCfgInputSize" onchange="dispCfgRefreshPreview()">' + sizeOpts + '</select></div>' +
    '<div class="address-form-group"><label>主题色</label><select id="dispCfgInputTone" onchange="dispCfgRefreshPreview()">' + toneOpts + '</select></div>' +
    '<div class="address-form-group"><label>图标</label><select id="dispCfgInputIcon" onchange="dispCfgRefreshPreview()">' + iconOpts + '</select></div>' +
    '<div class="address-form-group"><label>同位置展示条数</label><input type="number" id="dispCfgInputMax" min="1" max="20" value="' + (st.maxItems || 5) + '" onchange="dispCfgRefreshPreview()"></div>' +
    '</div>' +
    '<div class="news-status-row" style="margin-bottom:0">' +
    '<label class="radio-item"><input type="checkbox" id="dispCfgInputBold"' + (st.bold ? ' checked' : '') + ' onchange="dispCfgRefreshPreview()" style="width:14px;height:14px"> 文字加粗</label>' +
    '<label class="radio-item"><input type="checkbox" id="dispCfgInputSummary"' + (st.showSummary ? ' checked' : '') + ' onchange="dispCfgRefreshPreview()" style="width:14px;height:14px"> 显示摘要</label>' +
    '<label class="radio-item"><input type="checkbox" id="dispCfgInputDate"' + (st.showDate ? ' checked' : '') + ' onchange="dispCfgRefreshPreview()" style="width:14px;height:14px"> 显示日期</label>' +
    '</div></div>' +
    '<div class="address-form-group"><label>备注说明</label>' +
    '<textarea id="dispCfgInputRemark" placeholder="填写投放用途、责任人等备注">' + (editing ? (editing.remark || '') : '') + '</textarea></div>' +
    '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:16px">' +
    '<div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:10px">实时预览</div>' +
    '<div id="dispCfgFormPreview"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    dispCfgBtn('取消', 'dispCfgCancelForm()', 'ghost') +
    dispCfgBtn('保存', 'dispCfgSave()') +
    '</div>' +
    '</div></div>';
}

/* 展示端切换后重建位置下拉 */
function dispCfgClientChange() {
  const clientEl = document.getElementById('dispCfgInputClient');
  const posEl = document.getElementById('dispCfgInputPosition');
  if (!clientEl || !posEl) return;
  const client = clientEl.value;
  const list = DISPLAY_POSITIONS[client] || [];
  posEl.innerHTML = list.map(function (p) {
    return '<option value="' + p + '">' + p + '</option>';
  }).join('');
  dispCfgRefreshPreview();
}

/* 读取表单当前值（用于预览与保存） */
function dispCfgReadForm() {
  const g = function (id) { const el = document.getElementById(id); return el ? el.value : ''; };
  const ck = function (id) { const el = document.getElementById(id); return !!(el && el.checked); };
  const enabledEl = document.querySelector('input[name="dispCfgEnabled"]:checked');
  return {
    newsId: parseInt(g('dispCfgInputNews'), 10) || 0,
    client: g('dispCfgInputClient'),
    position: g('dispCfgInputPosition'),
    priority: parseInt(g('dispCfgInputPriority'), 10) || 0,
    startTime: g('dispCfgInputStart'),
    endTime: g('dispCfgInputEnd'),
    enabled: enabledEl ? enabledEl.value === 'true' : true,
    remark: (g('dispCfgInputRemark') || '').trim(),
    style: {
      size: g('dispCfgInputSize') || 'md',
      tone: g('dispCfgInputTone') || 'default',
      icon: g('dispCfgInputIcon') || 'dot',
      maxItems: parseInt(g('dispCfgInputMax'), 10) || 5,
      bold: ck('dispCfgInputBold'),
      showSummary: ck('dispCfgInputSummary'),
      showDate: ck('dispCfgInputDate')
    }
  };
}

/* 单条展示效果渲染（列表预览 / 详情 / 表单实时预览共用） */
function dispCfgRenderPreviewItem(cfg, news) {
  const st = cfg.style || {};
  const sizeMap = { sm: '13px', md: '14px', lg: '16px' };
  const toneMap = { default: '#1e293b', primary: '#2563eb', warning: '#b45309', danger: '#b91c1c' };
  const iconMap = { dot: '\u25CF', star: '\u2605', diamond: '\u25C6', triangle: '\u25B2' };
  const size = sizeMap[st.size] || '14px';
  const tone = toneMap[st.tone] || '#1e293b';
  const icon = iconMap[st.icon] || '\u25CF';
  const summary = String(news.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 60);
  let html = '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px dashed #e2e8f0">' +
    '<span style="color:' + tone + ';font-size:12px">' + icon + '</span>' +
    '<span style="flex:1;font-size:' + size + ';font-weight:' + (st.bold ? '700' : '400') + ';color:' + tone + '">' + (news.title || '（未选择信息）') + '</span>' +
    (st.showDate ? '<span style="font-size:12px;color:#94a3b8">' + (news.publishDate || '') + '</span>' : '') +
    '</div>';
  if (st.showSummary) {
    html += '<div style="font-size:12px;color:#64748b;padding:0 0 8px 26px">' + (summary || '（无摘要）') + '…</div>';
  }
  return html;
}

function dispCfgRefreshPreview() {
  const box = document.getElementById('dispCfgFormPreview');
  if (!box) return;
  const form = dispCfgReadForm();
  const news = newsData.find(function (r) { return r.id === form.newsId; }) || { title: '（请选择关联公共信息）', publishDate: '', content: '' };
  let html = dispCfgRenderPreviewItem({ style: form.style }, news);
  if (!form.enabled) html = '<div style="font-size:12px;color:#b45309;margin-bottom:6px">当前为停用状态，保存后不会在前台展示</div>' + html;
  if (news.status && news.status !== 'enabled') html = '<div style="font-size:12px;color:#b45309;margin-bottom:6px">关联资讯自身为禁用状态，即使配置启用也不会展示</div>' + html;
  box.innerHTML = html;
}

function dispCfgSave() {
  const form = dispCfgReadForm();
  if (!form.newsId) { toast('请选择关联公共信息', 'error'); return; }
  if (!newsData.some(function (r) { return r.id === form.newsId; })) { toast('关联的公共信息不存在', 'error'); return; }
  if (!form.client) { toast('请选择展示端', 'error'); return; }
  if (!form.position) { toast('请选择展示位置', 'error'); return; }
  if (!form.priority || form.priority < 1) { toast('优先级需为大于 0 的整数', 'error'); return; }
  if (form.startTime && form.endTime && form.startTime > form.endTime) { toast('投放开始日期不能晚于结束日期', 'error'); return; }
  if (!form.style.maxItems || form.style.maxItems < 1) { toast('同位置展示条数需大于 0', 'error'); return; }

  const dup = displayConfigData.find(function (c) {
    return c.client === form.client && c.position === form.position &&
      c.newsId === form.newsId && c.id !== (displayConfigState.editingId || 0);
  });
  if (dup) { toast('该展示端 + 位置下已存在此信息的配置（' + dup.code + '）', 'error'); return; }

  const today = dispCfgToday();
  if (displayConfigState.editingId) {
    const cfg = displayConfigData.find(function (c) { return c.id === displayConfigState.editingId; });
    if (cfg) {
      Object.assign(cfg, {
        newsId: form.newsId, client: form.client, position: form.position,
        priority: form.priority, enabled: form.enabled, style: form.style,
        startTime: form.startTime, endTime: form.endTime, remark: form.remark, updateTime: today
      });
    }
    toast('展示配置修改成功');
  } else {
    displayConfigData.push({
      id: dispCfgNextId(), code: dispCfgNextCode(), newsId: form.newsId,
      client: form.client, position: form.position, priority: form.priority,
      enabled: form.enabled, style: form.style, startTime: form.startTime,
      endTime: form.endTime, remark: form.remark, creator: '管理员',
      createTime: today, updateTime: today
    });
    toast('展示配置新增成功');
  }
  displayConfigState.mode = 'list';
  displayConfigState.editingId = null;
  renderPage('content-display');
}

/* ==================== 位置预览 ==================== */
function dispCfgPreviewOpen() {
  const client = displayConfigState.filters.client !== '全部' ? displayConfigState.filters.client : DISPLAY_CLIENTS[0];
  const position = displayConfigState.filters.position !== '全部' ? displayConfigState.filters.position : (DISPLAY_POSITIONS[client] || [])[0] || '';
  const modal = document.createElement('div');
  modal.className = 'news-confirm-modal';
  modal.style.zIndex = '10001';
  modal.innerHTML = '<div class="news-confirm-box" style="max-width:760px;max-height:88vh;overflow-y:auto">' +
    '<div class="news-confirm-title">展示位预览</div>' +
    '<div style="padding:20px">' +
    '<div class="filter-toolbar" style="margin-bottom:12px">' +
    '<div class="form-group"><label>展示端</label><select id="dispCfgPrevClient" onchange="dispCfgPreviewClientChange()">' +
    DISPLAY_CLIENTS.map(function (c) { return '<option value="' + c + '"' + (c === client ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>展示位置</label><select id="dispCfgPrevPosition" onchange="dispCfgPreviewRefresh()">' +
    dispCfgPositionOptions(client, position) + '</select></div>' +
    '</div>' +
    '<div id="dispCfgPreviewBox" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;min-height:120px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
    dispCfgBtn('关闭', 'this.closest(\'.news-confirm-modal\').remove()', 'ghost') +
    '</div></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
  dispCfgPreviewRefresh();
}

function dispCfgPreviewClientChange() {
  const cEl = document.getElementById('dispCfgPrevClient');
  const pEl = document.getElementById('dispCfgPrevPosition');
  if (!cEl || !pEl) return;
  const list = DISPLAY_POSITIONS[cEl.value] || [];
  pEl.innerHTML = list.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
  dispCfgPreviewRefresh();
}

function dispCfgPreviewRefresh() {
  const box = document.getElementById('dispCfgPreviewBox');
  const cEl = document.getElementById('dispCfgPrevClient');
  const pEl = document.getElementById('dispCfgPrevPosition');
  if (!box || !cEl || !pEl) return;
  const client = cEl.value, position = pEl.value;
  const limit = getDisplayMaxItems(client, position, 99);
  const items = getDisplayItems(client, position, limit);
  if (!items.length) {
    box.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8">该展示位当前没有生效的配置</div>';
    return;
  }
  let html = '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px">' + client + ' / ' + position +
    '　生效 ' + items.length + ' 条（上限 ' + limit + ' 条）</div>';
  html += items.map(function (it) {
    return '<div style="display:flex;align-items:flex-start;gap:8px">' +
      '<span style="font-size:11px;color:#94a3b8;width:28px;flex:none;padding-top:9px">#' + it.cfg.priority + '</span>' +
      '<div style="flex:1">' + dispCfgRenderPreviewItem(it.cfg, it.news) + '</div></div>';
  }).join('');
  box.innerHTML = html;
}

/* ==================== 导出 ==================== */
function dispCfgExport() {
  const rows = getDisplayConfigFiltered();
  if (!rows.length) { toast('当前筛选条件下没有可导出的数据', 'error'); return; }
  const headers = ['配置编号', '配置ID', '关联信息ID', '关联信息标题', '信息类型', '展示端', '展示位置', '优先级', '是否启用', '投放开始', '投放结束', '字号', '主题色', '加粗', '显示摘要', '显示日期', '同位置条数', '图标', '备注', '创建人', '更新时间'];
  const sizeLabel = function (v) { return (DISPLAY_STYLE_SIZES.find(function (s) { return s.v === v; }) || {}).l || v || ''; };
  const toneLabel = function (v) { return (DISPLAY_STYLE_TONES.find(function (s) { return s.v === v; }) || {}).l || v || ''; };
  const iconLabel = function (v) { return (DISPLAY_STYLE_ICONS.find(function (s) { return s.v === v; }) || {}).l || v || ''; };
  const body = rows.map(function (c) {
    const st = c.style || {};
    return [
      c.code, c.id, c.newsId, dispCfgNewsTitle(c.newsId), dispCfgNewsCategory(c.newsId),
      c.client, c.position, c.priority, c.enabled ? '启用' : '停用',
      c.startTime || '', c.endTime || '',
      sizeLabel(st.size), toneLabel(st.tone), st.bold ? '是' : '否',
      st.showSummary ? '是' : '否', st.showDate ? '是' : '否', st.maxItems || '',
      iconLabel(st.icon), c.remark || '', c.creator || '', c.updateTime || ''
    ];
  });
  dispCfgDownloadCsv('公共展示配置_' + dispCfgToday() + '.csv', headers, body);
  toast('已导出 ' + rows.length + ' 条展示配置');
}

function dispCfgDownloadCsv(filename, headers, rows) {
  const esc = function (v) {
    const s = v === null || v === undefined ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [headers.map(esc).join(',')].concat(rows.map(function (r) { return r.map(esc).join(','); }));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
