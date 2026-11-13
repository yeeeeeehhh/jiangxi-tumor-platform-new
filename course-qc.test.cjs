/* 专病病程质控模块冒烟测试（无浏览器，桩替换 DOM/localStorage/qcUI）
 * 运行：node course-qc.test.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

function el() {
  return { innerHTML: '', style: {}, className: '', appendChild() {}, removeChild() {}, click() {},
    addEventListener() {}, remove() {}, closest() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, textContent: '', value: '', disabled: false, insertAdjacentHTML() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
}
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const pc = el();
let elVals = {};
const elCache = {};
const handlers = {};
global.document = {
  createElement: () => { const e = el(); createdEls.push(e); return e; }, head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} },
  getElementById: id => {
    if (id === 'pageContainer') return pc;
    if (!elCache[id]) elCache[id] = el();
    elCache[id].value = elVals[id] !== undefined ? elVals[id] : '';
    return elCache[id];
  },
  querySelectorAll: sel => (sel === '.dcq-tc:checked' ? [{ value: '肺' }] : []),
  querySelector: () => null,
  addEventListener: (type, fn) => { handlers[type] = fn; }
};
global.window = global;
global.toast = () => {};
global.showConfirm = (t, m, fn) => { fn && fn(el()); };
global.setActiveMenu = () => {};
global.updateBreadcrumb = () => {};
const fallbackLog = [];
global.renderPage = function (id) { fallbackLog.push(id); };
global.navigateTo = () => {};
let blobLog = [];
let createdEls = [];
global.Blob = function (parts) { this.parts = parts; blobLog.push(parts.join('')); };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
global.setTimeout = (fn) => { fn && fn(); return 0; };

/* mini qcUI 桩：真实 qc-ui.js 依赖 window.qcSpine，测试环境只保留结构输出 */
let lastModal = null;
global.qcUI = {
  badge: (t, tone) => '<span class="badge badge-' + (tone || 'neutral') + '">' + t + '</span>',
  link: (t, action) => '<button class="qc-link" data-qc="' + action + '">' + t + '</button>',
  btn: (t, action, cls) => '<button class="btn ' + (cls || '') + '" data-qc="' + action + '">' + t + '</button>',
  head: (title, sub, layer, layerName, acts) => '<div class="qc-head">' + title + (sub ? '|' + sub : '') + (acts || '') + '</div>',
  kpis: (items, cols) => '<div class="qc-kpis">' + items.map(x => '<div class="qc-kpi">' + x.l + ':' + x.v + (x.unit || '') + (x.m || '') + '</div>').join('') + '</div>',
  card: (title, body) => '<div class="qc-card">' + (title ? '<div class="hd">' + title + '</div>' : '') + '<div class="bd">' + body + '</div></div>',
  table: (headers, rows, opt) => {
    opt = opt || {};
    const head = '<tr>' + headers.map(h => '<th>' + String(h).replace(/^#/, '') + '</th>').join('') + '</tr>';
    let body = (rows || []).map(r => '<tr>' + (r.cells || r).map(c => '<td>' + ((c && c.h) || (c == null ? '' : c)) + '</td>').join('') + '</tr>').join('');
    if (!(rows || []).length && opt.empty) body = '<tr><td colspan="' + headers.length + '">' + opt.empty + '</td></tr>';
    return '<table>' + head + body + '</table>';
  },
  pager: (total, page, per) => '<div class="qc-foot">共 ' + total + ' 条</div>',
  slice: (list, page, per) => {
    const max = Math.max(1, Math.ceil(list.length / per));
    if (page > max) page = max;
    if (page < 1) page = 1;
    return { rows: list.slice((page - 1) * per, page * per), page, max, total: list.length };
  },
  kv: (pairs) => '<div class="qc-kv">' + pairs.map(p => '<div><span>' + p[0] + '</span><span>' + (p[1] == null ? '—' : p[1]) + '</span></div>').join('') + '</div>',
  scoreCard: (score, title, lines) => '<div class="qc-score">' + score + '|' + title + '|' + (lines || []).join('|') + '</div>',
  grid13: (a, b) => a + b,
  grid2: (a, b) => a + b,
  note: (html) => '<div class="qc-note">' + html + '</div>',
  barChart: () => '<div class="qc-bar"></div>',
  modal: (title, body, footer) => { lastModal = { title, body, footer }; },
  closeModal: () => { lastModal = null; },
  toast: msg => { lastModal = lastModal; }
};

vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'course-qc-data.js'), 'utf8'), { filename: 'course-qc-data.js' });
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'course-qc.js'), 'utf8'), { filename: 'course-qc.js' });

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }
function click(action) {
  if (handlers.click) handlers.click({ target: { closest: s => (s === '[data-qc]' ? { getAttribute: () => action } : null) } });
}
function change(attrs, value) {
  if (handlers.change) handlers.change({ target: Object.assign({ getAttribute: k => attrs[k] || null, value: value || '' }, attrs) });
}

const D = window.DCQD, Q = window.DCQ;

/* ==================== A. 出口与种子 ==================== */
ok(!!D, '注册 window.DCQD 数据层出口');
ok(!!Q && !!Q.renderPageId && !!Q.openCase && !!Q.refresh, '注册 window.DCQ 渲染层出口');
ok(D.courses().length === 12, '专病病程记录种子 12 条');
ok(D.templates().length === 5, '病程模板种子 5 条（含同癌种两版本）');
ok(D.links().length === 11, '关联索引种子 11 条（含无效关联与各类矛盾）');
ok(D.tnm().length === 14 && D.paths().length === 10 && D.meds().length === 10, '关联实体种子齐全（TNM14 / 病理10 / 用药10）');
ok(D.courses().every(c => c.score > 0), '启动即为全部病程计算质量评分');

/* 功能点覆盖：21 项分布 3 页签 */
const fpKeys = Object.keys(Q.FP_MAP);
const fpCount = fpKeys.reduce((s, k) => s + Q.FP_MAP[k].length, 0);
ok(fpKeys.join(',') === '病程记录,模板配置,关联索引' && fpCount === 21, '功能点覆盖对照共 21 项，分布 3 页签（6+7+8）');
ok(Q.FP_MAP['病程记录'].length === 6 && Q.FP_MAP['模板配置'].length === 7 && Q.FP_MAP['关联索引'].length === 8, '三张信息表功能点数量与需求一致（6/7/8）');

/* ==================== B. 完整性 / 并发症 / 评分 ==================== */
const c4 = D.courseById('DC-20260915-0004');
const cp4 = D.completeness(c4);
ok(cp4.miss.indexOf('原发灶特征') >= 0 && cp4.miss.indexOf('放化疗方案') >= 0 && cp4.miss.length === 2, '功能点D1 完整性校验：DC-0004 检出原发灶特征与放化疗方案缺失');
ok(D.scoreOf(c4).total < D.scoreOf(D.courseById('DC-20260812-0001')).total, '功能点D2 质量评分：字段缺失病程得分低于完整病程');
ok(D.scoreOf(D.courseById('DC-20260812-0001')).total >= 85, '功能点D2 完整病程（DC-0001）评分达到优秀区间');

const comp5 = D.validateComplication(D.courseById('DC-20260928-0005'));
ok(comp5.level === '矛盾' && /未手术/.test(comp5.reason), '功能点D5 并发症合理性：未手术却记录吻合口瘘判定为矛盾');
ok(D.validateComplication(D.courseById('DC-20260812-0001')).level === '正常', '功能点D5 并发症「无」判定正常');
ok(D.validateComplication(D.courseById('DC-20261012-0008')).level === '警告', '功能点D5 非常见并发症「不明原因发热」给出警告');

const tl1 = D.timeliness(D.courseById('DC-20260812-0001'));
const tl7 = D.timeliness(D.courseById('DC-20261008-0007'));
const tl12 = D.timeliness(D.courseById('DC-20261028-0012'));
ok(tl1.days === 2 && tl1.got === 30, '及时性：DC-0001 术后 2 天记录得满分 30');
ok(tl7.days === 20 && tl7.got === 8, '及时性：DC-0007 术后 20 天记录明显滞后');
ok(tl12.days === null && tl12.got === 15, '及时性：DC-0012 手术日期缺失按半分计');

/* ==================== C. 关联一致性 / 缺失预警 ==================== */
const ci5 = D.consistencyIssues(D.links().find(l => l.id === 'DCL-005'));
ok(ci5.some(x => x.level === '矛盾' && /患者ID/.test(x.detail)), '功能点R4 一致性校验：DCL-005 检出患者ID不一致');
const ci6 = D.consistencyIssues(D.links().find(l => l.id === 'DCL-006'));
ok(ci6.some(x => /v1/.test(x.detail) && /更新版本/.test(x.detail)) && ci6.some(x => /用药记录/.test(x.detail) && /未开始/.test(x.detail)),
  '功能点R4 一致性校验：DCL-006 检出 TNM 分期版本过期 + 用药状态矛盾');
const ci10 = D.consistencyIssues(D.links().find(l => l.id === 'DCL-010'));
ok(ci10.some(x => /晚于病程记录时间/.test(x.detail)), '功能点R4 一致性校验：DCL-010 检出病理报告晚于病程记录');
ok(D.consistencyIssues(D.links().find(l => l.id === 'DCL-001')).length === 0, '功能点R4 全关联病程（DCL-001）一致性通过');

const miss = D.missingLinks();
ok(miss.some(m => m.courseId === 'DC-20260902-0003' && m.missing.indexOf('TNM分期') >= 0), '功能点R5 缺失预警：DC-0003 缺 TNM 分期');
ok(miss.some(m => m.courseId === 'DC-20261015-0009' && m.missing.indexOf('用药记录') >= 0), '功能点R5 缺失预警：DC-0009 方案已开始但缺用药记录');
const miss10 = miss.find(m => m.courseId === 'DC-20261021-0010');
ok(miss10 && miss10.missing.length === 3, '功能点R5 缺失预警：DC-0010 三类关联全部缺失');
ok(miss.some(m => m.courseId === 'DC-20261012-0008' && m.missing.indexOf('病理报告') >= 0), '功能点R5 缺失预警：DC-0008 无效关联导致缺病理报告');

/* ==================== D. 业务闭环 ==================== */
const rc = D.runChecks();
ok(rc.courses === 12 && rc.avg > 0 && rc.compMiss >= 1 && rc.compConflict >= 1, '功能点D1/D2/D5 批量校验引擎统计完整（12 份，含缺失与并发症异常）');

const r1 = D.markReaudit('DC-20260812-0001', '关键字段缺失需补录');
ok(r1.ok && D.courseById('DC-20260812-0001').qcState === '需重新审核' && D.courseById('DC-20260812-0001').reauditNote, '功能点D6 标记需重新审核并记录原因');
const rr1 = D.resolveReaudit('DC-20260812-0001');
ok(rr1.ok && D.courseById('DC-20260812-0001').qcState === '校验通过', '功能点D6 完成重新审核：无阻断问题自动回到校验通过');

/* 模板：新建 / 启停 / 复制 / 删除 */
const tsave = D.saveTemplate({ name: '肝癌术后病程模板', cancerTypes: ['肝'], version: 1, state: '停用', dynamicFields: [{ show: '肝功能分级', condField: '手术方式', op: '等于', value: '局部切除' }], defaults: { therapy: '未开始' }, desc: '测试模板' });
ok(tsave.ok && D.templates().some(t => t.name === '肝癌术后病程模板' && t.id === 'DCT-06'), '功能点T1 新建癌种专属模板（自动编号 DCT-06）');
ok(D.saveTemplate({ name: '', cancerTypes: [] }).ok === false, '功能点T1 模板名称/癌种范围为空时拒绝保存');

const st1 = D.toggleTemplate('DCT-06');
ok(st1 === '启用' && D.templates().find(t => t.id === 'DCT-06').state === '启用', '功能点T4 启用模板');
const delOn = D.deleteTemplate('DCT-06');
ok(delOn.ok === false, '功能点T4 启用中的模板拒绝删除');
D.toggleTemplate('DCT-06');
ok(D.deleteTemplate('DCT-06').ok === true, '功能点T4 停用后可删除模板');

const cp = D.copyTemplate('DCT-01');
ok(cp.ok && cp.tpl.version === 4 && cp.tpl.state === '停用' && cp.tpl.fromId === 'DCT-01' && D.templates().length === 6,
  '功能点T7 复制现有模板生成新版本（v3→v4，默认停用，记录复制来源）');
const t1 = D.templates().find(t => t.id === 'DCT-01');
ok(t1.dynamicFields.length === 2 && t1.dynamicFields[0].show === '切缘状态' && t1.defaults.therapy === '未开始',
  '功能点T2/T3 模板动态字段与默认值规则完整');

/* 病程：新增（模板默认值）/ 修正 */
const addRes = D.saveCourse({ patientId: 'P-31100', patientName: '测试患者', cancerType: '肺', primaryFeature: '右肺上叶 1.8cm 结节', surgery: '根治性切除', therapy: '', complication: '', operDate: '2026-11-10', recorder: '测试医生', tplId: 'DCT-01' });
ok(addRes.ok && addRes.course.therapy === '未开始' && addRes.course.complication === '无', '功能点T3 新增病程时应用模板默认值规则（方案未开始/并发症无）');
const newId = addRes.course.id;
const editRes = D.saveCourse({ id: newId, patientId: 'P-31100', patientName: '测试患者', cancerType: '肺', primaryFeature: '右肺上叶 1.8cm 结节', surgery: '根治性切除', therapy: '术后辅助化疗', complication: '无', operDate: '2026-11-10', recorder: '测试医生' });
ok(editRes.ok && D.courseById(newId).logs[0].action === '修正病程记录', '功能点D1 修正病程记录并写入留痕');

/* 关联：绑定 / 跨患者拒绝 / 解绑 / 删除 / 标记无效 */
const bindBad = D.bindLink('DC-20260812-0001', 'tnmId', 'TNM-20260911-01');
ok(bindBad.ok === false && /患者ID不一致/.test(bindBad.msg), '功能点R1 跨患者绑定被拒绝（患者ID一致性前置校验）');
const bindOk = D.bindLink('DC-20261021-0010', 'tnmId', 'TNM-20261017-01');
ok(bindOk.ok && D.linkOf('DC-20261021-0010').tnmId === 'TNM-20261017-01', '功能点R1 绑定 TNM 分期记录');
D.bindLink('DC-20261021-0010', 'pathId', '');
ok(D.linkOf('DC-20261021-0010').pathId === '', '功能点R2 未选记录时拒绝绑定病理报告');
const bindPath = D.bindLink('DC-20261015-0009', 'pathId', 'BL-20261013-0067');
ok(bindPath.ok && D.linkOf('DC-20261015-0009').pathId === 'BL-20261013-0067', '功能点R2 绑定病理报告（同患者记录）');
const bindMed = D.bindLink('DC-20261015-0009', 'medId', 'MED-20261018-06');
ok(bindMed.ok && D.linkOf('DC-20261015-0009').medId === 'MED-20261018-06', '功能点R3 绑定用药记录');

const ub = D.unbindLink('DC-20261015-0009', 'medId');
ok(ub.ok && !D.linkOf('DC-20261015-0009').medId, '功能点R6/R7 解除用药记录关联');
const markInv = D.markLinkInvalid('DCL-011', '人工判定无效');
ok(markInv.ok && D.links().find(l => l.id === 'DCL-011').state === '无效', '功能点R7 标记关联为无效');
const delLink = D.removeLink('DCL-011', '重复关联');
ok(delLink.ok && !D.links().some(l => l.id === 'DCL-011') && D.links().length === 11, '功能点R7 删除无效关联关系并留痕');

/* ==================== E. 渲染：三页签 + 详情页 + 路由 ==================== */
window.renderPage('dcq-workbench');
ok(pc.innerHTML.indexOf('专病病程质控') >= 0 && pc.innerHTML.indexOf('病程记录') >= 0 && pc.innerHTML.indexOf('模板配置') >= 0 && pc.innerHTML.indexOf('关联索引') >= 0, '页面渲染：标题与三页签齐全');
ok(/完整性校验/.test(pc.innerHTML) && /批量质量评分/.test(pc.innerHTML) && /并发症合理性校验/.test(pc.innerHTML) &&
   /导出待质控数据/.test(pc.innerHTML) && /详情/.test(pc.innerHTML) && /标记重审/.test(pc.innerHTML) && /新增病程记录/.test(pc.innerHTML),
  '页签① 病程记录：功能点 D1~D6 入口齐全');
ok(/待质控病程/.test(pc.innerHTML) && /平均质量评分/.test(pc.innerHTML) && /完整性缺失/.test(pc.innerHTML), '页签① KPI 卡齐全');

click('dcq:tab:模板配置');
ok(pc.innerHTML.indexOf('病程模板配置') >= 0 && /新建模板/.test(pc.innerHTML) && /导出配置清单/.test(pc.innerHTML) &&
   /复制新版本/.test(pc.innerHTML) && /动态字段配置/.test(pc.innerHTML) && /默认值规则/.test(pc.innerHTML) && /data-dcqtpl=/.test(pc.innerHTML),
  '页签② 模板配置：功能点 T1~T7 入口齐全（含启停开关）');

click('dcq:tab:关联索引');
ok(pc.innerHTML.indexOf('病程关联数据索引') >= 0 && /绑定TNM分期/.test(pc.innerHTML) && /绑定病理报告/.test(pc.innerHTML) && /绑定用药记录/.test(pc.innerHTML) &&
   /一致性校验/.test(pc.innerHTML) && /缺失预警/.test(pc.innerHTML) && /导出映射清单/.test(pc.innerHTML) && /查看/.test(pc.innerHTML) && /删除/.test(pc.innerHTML),
  '页签③ 关联索引：功能点 R1~R8 入口齐全');
ok(/关联数据缺失预警清单/.test(pc.innerHTML), '页签③ 页面常驻缺失预警清单卡');

window.renderPage('dcq-case|DC-20260812-0001');
ok(pc.innerHTML.indexOf('专病病程记录详情') >= 0 && /病程质量评分/.test(pc.innerHTML) && /评分构成明细/.test(pc.innerHTML) &&
   /校验问题清单/.test(pc.innerHTML) && /该病程的全部关联数据/.test(pc.innerHTML) && /病程操作日志与留痕/.test(pc.innerHTML),
  '详情页 dcq-case|：基本信息 + 评分卡 + 问题清单 + 关联卡 + 日志');

window.renderPage('dcq-case|DC-NOT-EXIST');
ok(/病程记录不存在/.test(pc.innerHTML), '详情页：不存在的病程ID给出空态提示');

/* 事件：弹窗与动作 */
click('dcq:tab:病程记录');
click('dcq:reaudit:DC-20260928-0005');
ok(lastModal && /标记需重新审核/.test(lastModal.title), '功能点D6 打开标记重审弹窗');
elVals = { 'dcqf-rr-reason': '并发症记录与手术方式矛盾', 'dcqf-rr-note': '核实手术记录' };
click('dcq:reaudit:do:DC-20260928-0005');
ok(D.courseById('DC-20260928-0005').qcState === '需重新审核' && /核实手术记录/.test(D.courseById('DC-20260928-0005').reauditNote),
  '功能点D6 弹窗提交后写入重审原因与通知留痕');
click('dcq:resolve:DC-20260928-0005');
ok(D.courseById('DC-20260928-0005').qcState === '待质控', '功能点D6 完成审核：仍有矛盾问题则退回待质控');

click('dcq:check:complete');
ok(lastModal && /完整性校验结果/.test(lastModal.title) && /原发灶特征/.test(lastModal.body), '功能点D1 完整性校验弹窗输出缺失字段清单');
click('dcq:check:comp');
ok(lastModal && /并发症合理性校验/.test(lastModal.title) && /未手术/.test(lastModal.body), '功能点D5 并发症校验弹窗输出矛盾清单');
click('dcq:consistency');
ok(lastModal && /一致性校验/.test(lastModal.title) && /患者ID/.test(lastModal.body), '功能点R4 一致性校验弹窗输出矛盾详情');
click('dcq:missing');
ok(lastModal && /缺失预警清单/.test(lastModal.title), '功能点R5 缺失预警弹窗');
click('dcq:tpl:add');
ok(lastModal && /癌种专属病程模板/.test(lastModal.title), '功能点T1 新建模板弹窗');
click('dcq:bind:tnmId:DC-20260812-0001');
ok(lastModal && /绑定TNM分期记录/.test(lastModal.title) && /data-dcq-bind-course/.test(lastModal.body), '功能点R1 详情页绑定期望弹窗（病程切换联动）');
click('dcq:links:view:DC-20260812-0001');
ok(lastModal && /该病程的全部关联数据/.test(lastModal.title), '功能点R6 查询某病程的全部关联数据');
click('dcq:link:del:DCL-001');
ok(lastModal && /删除无效的关联关系/.test(lastModal.title), '功能点R7 删除关联弹窗');
click('dcq:tpl:detail:DCT-01');
ok(lastModal && /模板详细配置/.test(lastModal.title) && /切缘状态/.test(lastModal.body), '功能点T5 查询模板详细配置');
click('dcq:fp');
ok(lastModal && /功能点覆盖对照/.test(lastModal.title) && /21/.test(lastModal.title), '功能点覆盖对照弹窗（21 项）');

/* 模板启停开关 change 事件 */
const beforeState = D.templates().find(t => t.id === 'DCT-02').state;
change({ 'data-dcqtpl': 'DCT-02' }, '');
ok(D.templates().find(t => t.id === 'DCT-02').state !== beforeState, '功能点T4 列表开关切换模板启用状态');

/* 导出：Blob 桩捕获 CSV 内容，createElement 桩捕获下载文件名 */
blobLog = []; createdEls = [];
click('dcq:tab:病程记录');
click('dcq:export:pending');
const dl1 = createdEls.length ? createdEls[createdEls.length - 1].download : '';
ok(dl1 === '待质控病程数据.csv' && blobLog.length > 0 && blobLog[blobLog.length - 1].indexOf('\ufeff') === 0 &&
   blobLog[blobLog.length - 1].indexOf('病程ID') >= 0 && blobLog[blobLog.length - 1].indexOf('DC-') >= 0,
  '功能点D4 批量导出待质控病程数据（CSV，含 BOM 与病程数据）');
blobLog = []; createdEls = [];
click('dcq:tab:模板配置');
click('dcq:export:tpl');
const dl2 = createdEls.length ? createdEls[createdEls.length - 1].download : '';
ok(dl2 === '病程模板配置清单.csv' && blobLog.length > 0 && blobLog[blobLog.length - 1].indexOf('模板名称') >= 0 && blobLog[blobLog.length - 1].indexOf('DCT-01') >= 0,
  '功能点T6 导出病程模板配置清单（CSV）');
blobLog = []; createdEls = [];
click('dcq:tab:关联索引');
click('dcq:export:links');
const dl3 = createdEls.length ? createdEls[createdEls.length - 1].download : '';
ok(dl3 === '病程关联数据映射清单.csv' && blobLog.length > 0 && blobLog[blobLog.length - 1].indexOf('TNM分期ID') >= 0 && blobLog[blobLog.length - 1].indexOf('DCL-001') >= 0,
  '功能点R8 导出病程关联数据映射清单（CSV）');

/* 路由回退 */
fallbackLog.length = 0;
window.renderPage('dashboard');
ok(fallbackLog.length === 1 && fallbackLog[0] === 'dashboard', '非本模块页面 id 回退给原 renderPage（链式接管）');

/* 重置演示数据 */
D.reset();
ok(D.courses().length === 12 && D.templates().length === 5 && D.links().length === 11, '重置演示数据恢复初始种子');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
