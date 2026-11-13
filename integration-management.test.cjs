/* 集成管理最小可用回归测试（无浏览器：桩替换 DOM / localStorage / 全局交互件）
 * 运行：node integration-management.test.cjs
 * 覆盖：18 个功能点、3 表最小闭环、校验、持久化重载、路由下传、菜单挂载、零冗余边界。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};

const modalLog = [];
let elVals = {};
const elCache = {};
const createdEls = [];
const blobLog = [];
const fallbackLog = [];
const toastLog = [];
let pc;

function el() {
  const e = {
    innerHTML: '', style: {}, className: '', value: '', textContent: '',
    onclick: null, href: '', download: '', disabled: false,
    appendChild() {}, removeChild() {}, click() {}, addEventListener() {},
    setAttribute() {}, insertAdjacentHTML() {},
    remove() { const i = modalLog.indexOf(e); if (i >= 0) modalLog.splice(i, 1); },
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  };
  return e;
}
pc = el();

global.document = {
  createElement: () => { const e = el(); createdEls.push(e); return e; },
  head: { appendChild() {} },
  body: {
    appendChild(o) { if (o.className && String(o.className).indexOf('int-modal') >= 0) modalLog.push(o); },
    removeChild() {}
  },
  getElementById: id => {
    if (id === 'pageContainer') return pc;
    if (!elCache[id]) elCache[id] = el();
    elCache[id].value = elVals[id] !== undefined ? elVals[id] : '';
    return elCache[id];
  },
  querySelectorAll: sel => (sel === '.int-modal' ? modalLog.slice() : []),
  querySelector: () => null,
  addEventListener: () => {}
};
global.window = global;
global.toast = (msg, type) => { toastLog.push({ msg, type: type || 'success' }); };
global.showConfirm = (t, m, fn) => { fn && fn(el()); };
global.setActiveMenu = () => {};
global.updateBreadcrumb = () => {};
global.renderPage = function (id) { fallbackLog.push(id); };
global.navigateTo = () => {};
global.Blob = function (parts) { this.parts = parts; blobLog.push(parts.join('')); };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
global.setTimeout = fn => { fn && fn(); return 0; };

const SRC = fs.readFileSync(path.join(__dirname, 'integration-management.js'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8');
function loadModule() { vm.runInThisContext(SRC, { filename: 'integration-management.js' }); }
loadModule();

function clearVals() { elVals = {}; }
function fill(rec) { clearVals(); Object.keys(rec).forEach(k => { elVals['im_' + k] = String(rec[k]); }); }
function lastModal() { return modalLog.length ? modalLog[modalLog.length - 1].innerHTML : ''; }
function lastBlob() { return blobLog.length ? blobLog[blobLog.length - 1] : ''; }

const CASES = [
  {
    id: 'int-app', name: '第三方集成应用元信息', csv: '第三方集成应用信息表.csv',
    fields: 7, filters: 3, first: 'appId',
    rec: { appId: 'APP001', code: 'CODE001', name: '省平台HIS', type: 'HIS', uriTemplate: 'https://his.example.com/sso?token={token}', passLogin: '是', status: '启用' },
    edit: { appId: 'APP001', code: 'CODE001', name: '省平台HISv2', type: 'HIS', uriTemplate: 'https://his.example.com/v2/{id}', passLogin: '否', status: '停用' },
    changed: 'name', before: '省平台HIS', after: '省平台HISv2',
    query: { imf_keyword: '省平台HIS', imf_type: 'HIS', imf_status: '启用' }
  },
  {
    id: 'int-entry', name: '集成入口展示配置', csv: '集成入口展示配置表.csv',
    fields: 4, filters: 1, first: 'entryName',
    rec: { entryName: '门诊入口', icon: 'clinic', sort: '1', defaultShow: '是' },
    edit: { entryName: '门诊入口', icon: 'clinic', sort: '2', defaultShow: '否' },
    changed: 'sort', before: '1', after: '2',
    query: { imf_keyword: '门诊入口' }
  },
  {
    id: 'int-security', name: '集成安全与参数映射配置', csv: '集成安全与参数映射配置表.csv',
    fields: 6, filters: 1, first: 'ruleName',
    rec: { ruleName: 'HIS签名规则', requestParamMap: 'user_id→uid', signAlgorithm: 'HMAC-SHA256', whitelistDomains: 'his.example.com', signKey: 'sk-001', timeout: '30' },
    edit: { ruleName: 'HIS签名规则', requestParamMap: 'user_id→uid', signAlgorithm: 'HMAC-SHA256', whitelistDomains: 'his.example.com,"pacs.example.com",labs', signKey: 'sk-002', timeout: '60' },
    changed: 'signKey', before: 'sk-001', after: 'sk-002',
    query: { imf_keyword: 'HIS签名规则' }
  }
];

/* ==================== A. 出口、挂载与路由 ==================== */
const IM = window.IM;
ok(!!IM && !!IM.schemas && !!IM.renderPageId && !!IM.submit && !!IM.exportCsv, '注册 window.IM 调试/测试出口');
ok(Object.keys(IM.schemas).length === 3, '仅声明 3 张信息表，无多余页面');

const menuMatch = HTML.match(/const menuData=(\[[\s\S]*?\]);\s*const hisRecords=/);
let menu = null;
try { menu = menuMatch ? vm.runInNewContext(menuMatch[1]) : null; } catch (e) { menu = null; }
ok(!!menu && Array.isArray(menu) && menu.length > 0, 'app.html menuData 语法可解析（改动未破坏主脚本）');
const intMenu = menu && menu.find(x => x.id === 'integration');
ok(!!intMenu && Array.isArray(intMenu.children) && intMenu.children.length === 3, 'app.html 注册「集成管理」一级菜单及 3 个子页');
ok(!!intMenu && intMenu.children.map(x => x.id).join(',') === 'int-app,int-entry,int-security', '3 个子页 id 与模块接管 id 一致');
ok((HTML.match(/<script src="integration-management\.js"><\/script>/g) || []).length === 1, 'app.html 唯一引用 integration-management.js');
ok(HTML.indexOf('<script src="integration-management.js"></script>') > HTML.indexOf('ocr-assist.js'),
  '脚本置于现有模块之后（renderPage 包装链最外层）');

window.renderPage('dashboard');
ok(fallbackLog.indexOf('dashboard') >= 0, '非集成页 id 原样下传给原 renderPage');
fallbackLog.length = 0;
window.renderPage('int-app');
ok(pc.innerHTML.indexOf('第三方集成应用元信息') >= 0 && pc.innerHTML.indexOf('暂无匹配数据') >= 0,
  '集成页 id 由模块接管并渲染空列表');
ok(fallbackLog.length === 0, '集成页 id 未落入原 renderPage 兜底');

/* ==================== B. 18 个功能点 + 3 表最小闭环 ==================== */
let point = 0;
CASES.forEach(function (c) {
  const s = IM.schemas[c.id];
  const labels = s.fields.map(f => f.label);
  let chain = true;

  /* 1 新增 */
  clearVals();
  ok(window.IM.data(c.id).length === 0, c.name + '：初始态为空列表（无预置数据）');
  window.IM.add(c.id);
  const addHtml = lastModal();
  const addFormOk = labels.every(l => addHtml.indexOf(l) >= 0) && addHtml.indexOf('保存') >= 0;
  fill(c.rec);
  const added = window.IM.submit();
  const stored = window.IM.data(c.id);
  const addOk = added && stored.length === 1 && labels.length === c.fields &&
    s.fields.every(f => String(stored[0][f.k]) === String(c.rec[f.k]));
  ok(addFormOk && addOk, '功能点 ' + (++point) + '/18 · ' + c.name + '：新增（表单含全部字段，落库可查）');
  chain = chain && addFormOk && addOk;

  /* 2 查询 */
  clearVals();
  Object.keys(c.query).forEach(k => { elVals[k] = c.query[k]; });
  window.IM.query(c.id);
  const hit = window.IM.renderPageId(c.id).indexOf(c.rec[c.first]) >= 0;
  clearVals();
  elVals['imf_keyword'] = '__不存在的记录__';
  window.IM.query(c.id);
  const miss = window.IM.renderPageId(c.id).indexOf('暂无匹配数据') >= 0;
  let extra = true;
  if (c.id === 'int-app') {
    clearVals(); elVals['imf_type'] = 'EMR'; window.IM.query(c.id);
    extra = window.IM.renderPageId(c.id).indexOf('暂无匹配数据') >= 0;
    clearVals(); elVals['imf_status'] = '停用'; window.IM.query(c.id);
    extra = extra && window.IM.renderPageId(c.id).indexOf('暂无匹配数据') >= 0;
  }
  window.IM.reset(c.id);
  const qOk = hit && miss && extra;
  ok(qOk, '功能点 ' + (++point) + '/18 · ' + c.name + '：查询（名称/类型/状态筛选命中与不匹配为空）');
  chain = chain && qOk;

  /* 3 详情 */
  window.IM.detail(c.id, 0);
  const detailHtml = lastModal();
  const detailOk = s.fields.every(f => detailHtml.indexOf(f.label) >= 0 && detailHtml.indexOf(String(c.rec[f.k])) >= 0);
  ok(detailOk, '功能点 ' + (++point) + '/18 · ' + c.name + '：详情查看（全字段完整可见）');
  chain = chain && detailOk;
  window.IM.close();

  /* 4 修改 */
  window.IM.edit(c.id, 0);
  const editHtml = lastModal();
  const editFormOk = s.fields.every(f => editHtml.indexOf(String(c.rec[f.k])) >= 0);
  fill(c.edit);
  const edited = window.IM.submit();
  const afterEdit = window.IM.data(c.id);
  const editOk = editFormOk && edited && afterEdit.length === 1 &&
    String(afterEdit[0][c.changed]) === c.after && String(afterEdit[0][c.changed]) !== c.before;
  ok(editOk, '功能点 ' + (++point) + '/18 · ' + c.name + '：修改（复用表单回填，字段变更生效）');
  chain = chain && editFormOk && edited && editOk;

  /* 持久化重载恢复 */
  loadModule();
  const restored = window.IM.data(c.id);
  const restoreOk = restored.length === 1 && String(restored[0][c.changed]) === c.after;
  ok(restoreOk, '持久化 · ' + c.name + '：重新载入模块后数据从 localStorage 恢复');
  chain = chain && restoreOk;

  /* 5 导出 */
  blobLog.length = 0;
  const expOk = window.IM.exportCsv(c.id) === true && blobLog.length === 1;
  const csvText = lastBlob();
  const a = createdEls[createdEls.length - 1];
  const csvOk = expOk && csvText.charAt(0) === '\ufeff' &&
    labels.every(l => csvText.indexOf('"' + l + '"') >= 0) &&
    csvText.indexOf(c.after) >= 0 &&
    csvText.split('\r\n').length === 2 &&
    a.download === c.csv;
  ok(csvOk, '功能点 ' + (++point) + '/18 · ' + c.name + '：导出（CSV 含 BOM/表头/全字段，文件名正确）');
  chain = chain && csvOk;
  if (c.id === 'int-security') {
    ok(csvText.indexOf('""pacs.example.com""') >= 0, 'CSV 转义 · 字段含逗号与引号时正确双写引号');
  }

  /* 6 删除 */
  window.IM.reset(c.id);
  window.IM.del(c.id, 0);
  const gone = window.IM.data(c.id).length === 0 &&
    window.IM.renderPageId(c.id).indexOf('暂无匹配数据') >= 0;
  ok(gone, '功能点 ' + (++point) + '/18 · ' + c.name + '：删除（二次确认后硬删，查询不到）');
  chain = chain && gone;

  ok(chain, '最小闭环 · ' + c.name + '：增→查→详情→改→导出→删→查不到→重载不丢');
});

ok(point === 18, '18 个功能点全部逐项验证（3 表 × 6 操作）');

/* ==================== C. 校验（每次提交前先打开表单，模拟真实交互序列） ==================== */
window.IM.add('int-app');
fill({ appId: 'A2', code: 'C2', name: '', type: 'HIS', uriTemplate: 'https://x', passLogin: '是', status: '启用' });
toastLog.length = 0;
let v = window.IM.submit();
ok(v === false && window.IM.data('int-app').length === 0 && toastLog.some(t => t.type === 'error' && t.msg.indexOf('请填写') === 0),
  '必填校验 · 名称为空时拒绝提交并提示');

window.IM.add('int-app');
fill({ appId: 'A2', code: 'C2', name: '应用二', type: 'HIS', uriTemplate: 'https://x', passLogin: '是', status: '启用' });
ok(window.IM.submit() === true && window.IM.data('int-app').length === 1, '校验前置 · 合法记录可正常保存');

window.IM.add('int-app');
fill({ appId: 'A2', code: 'C3', name: '应用三', type: 'HIS', uriTemplate: 'https://y', passLogin: '是', status: '启用' });
toastLog.length = 0;
v = window.IM.submit();
ok(v === false && window.IM.data('int-app').length === 1 && toastLog.some(t => t.msg.indexOf('应用ID已存在') >= 0),
  '唯一校验 · 应用ID 重复时拒绝提交');

window.IM.add('int-app');
fill({ appId: 'A3', code: 'C2', name: '应用四', type: 'HIS', uriTemplate: 'https://z', passLogin: '是', status: '启用' });
toastLog.length = 0;
v = window.IM.submit();
ok(v === false && window.IM.data('int-app').length === 1 && toastLog.some(t => t.msg.indexOf('编码已存在') >= 0),
  '唯一校验 · 编码 重复时拒绝提交');

window.IM.add('int-entry');
fill({ entryName: '入口B', icon: 'b', sort: '1.5', defaultShow: '是' });
toastLog.length = 0;
v = window.IM.submit();
ok(v === false && window.IM.data('int-entry').length === 0 && toastLog.some(t => t.msg.indexOf('非负整数') >= 0),
  '数字校验 · 排序为小数时拒绝提交');

window.IM.add('int-entry');
fill({ entryName: '入口B', icon: 'b', sort: '-1', defaultShow: '是' });
v = window.IM.submit();
ok(v === false && window.IM.data('int-entry').length === 0, '数字校验 · 排序为负数时拒绝提交');

window.IM.add('int-entry');
fill({ entryName: '入口B', icon: 'b', sort: '3', defaultShow: '是' });
ok(window.IM.submit() === true && window.IM.data('int-entry')[0].sort === 3,
  '数字校验 · 合法值归一化为数字类型（无隐式字符串）');

/* ==================== D. 零冗余边界 ==================== */
CASES.forEach(function (c) {
  const s = window.IM.schemas[c.id];
  ok(s.fields.length === c.fields && s.filters.length === c.filters,
    '零冗余 · ' + c.name + '：字段 ' + c.fields + ' 个 / 筛选项 ' + c.filters + ' 个，严格按方案未扩字段');
});

const BANNED = ['导入', '批量', '分页', '版本', '审计', '软删', '回收站', '连通性测试', '图标上传', '状态机', '审批', '操作日志', 'PDF', 'Excel', '拖拽', '打印'];
const bannedInSrc = BANNED.filter(w => SRC.indexOf(w) >= 0);
ok(bannedInSrc.length === 0, '零冗余 · 模块源码不含任何被明确排除的功能关键词' + (bannedInSrc.length ? '（发现：' + bannedInSrc.join('/') + '）' : ''));
const rendered = ['int-app', 'int-entry', 'int-security'].map(id => window.IM.renderPageId(id)).join('');
const bannedInUi = BANNED.filter(w => rendered.indexOf(w) >= 0);
ok(bannedInUi.length === 0, '零冗余 · 三页渲染结果不含任何冗余功能入口' + (bannedInUi.length ? '（发现：' + bannedInUi.join('/') + '）' : ''));
ok(Object.keys(mem).every(k => /^jx\.int\.(app|entry|security)\.v1$/.test(k)) && Object.keys(mem).length === 3,
  '零冗余 · 仅使用方案约定的 3 个 localStorage 键，无种子/元数据键');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
