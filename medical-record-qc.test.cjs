/* 肿瘤病案首页质控模块冒烟测试（无浏览器，桩替换 DOM/localStorage）
 * 运行：node medical-record-qc.test.cjs */
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
global.document = { createElement: () => el(), head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} },
  getElementById: id => { if (id === 'pageContainer') return pc; if (!elCache[id]) elCache[id] = el(); elCache[id].value = elVals[id] !== undefined ? elVals[id] : ''; return elCache[id]; },
  querySelectorAll: () => [],
  querySelector: () => null, addEventListener() {} };
global.window = global;
global.toast = () => {};
global.showConfirm = (t, m, fn) => { fn && fn(el()); };
global.setActiveMenu = () => {};
global.updateBreadcrumb = () => {};
global.renderPage = function () {};
global.navigateTo = () => {};
global.Blob = function (parts) { this.parts = parts; };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
global.setTimeout = (fn, ms) => { fn && fn(); return 0; };

vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'medical-record-qc.js'), 'utf8'), { filename: 'medical-record-qc.js' });

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

const M = window.MRQC;
ok(!!M, '注册 window.MRQC 调试出口');
const { cases, reports, results, storages, policyStore } = M;
ok(cases.all().length === 12 && reports.all().length === 12 && results.all().length === 8 && storages.all().length === 8,
  '四张信息表种子齐全（病案12 / 报告索引12 / 质控结果8 / 存储对象8）');

/* 功能点覆盖：30 项全部登记且分布 4 页 */
const fpCount = Object.keys(M.FP_MAP).reduce((s, k) => s + M.FP_MAP[k].length, 0);
ok(Object.keys(M.FP_MAP).length === 4 && fpCount === 30, '功能点覆盖对照共 30 项，分布 4 页（8+7+7+8）');
ok(M.TABS && M.TABS.map(t => t[0]).join(',') === 'mrqc-base,mrqc-report,mrqc-result,mrqc-storage',
  '单页工作台 4 个页签（基础临床信息/报告索引/质控结果/存储脱敏，参照确诊病例质控结构）');

/* 单页工作台 4 页签渲染：包含各页签功能点入口 */
M.state.tab = 'mrqc-base'; window.renderPage('mrqc-workbench');
ok(/从 HIS\/EMR 加载/.test(pc.innerHTML) && /生成质控报告/.test(pc.innerHTML) && /导出待修正数据包/.test(pc.innerHTML) &&
   /详情/.test(pc.innerHTML) && /查看随访/.test(pc.innerHTML) && /标记高风险/.test(pc.innerHTML) && /解除标记/.test(pc.innerHTML) &&
   /机构来源/.test(pc.innerHTML) && /360102-001/.test(pc.innerHTML) &&
   /问题项（校验明细）/.test(pc.innerHTML) && /采纳/.test(pc.innerHTML) && /搜索（住院号 \/ 患者ID \/ 姓名）/.test(pc.innerHTML) && /搜索<\/button>/.test(pc.innerHTML),
  '页签① 病案首页基础临床信息：功能点 1-1~1-8 入口齐全（校验融入表格；机构来源列；操作列「查看随访 / 标记高风险」；搜索框+搜索按钮）');

/* 标记 / 解除病案高风险（操作列，可逆） */
window.mrqcCaseRisk('CJ-2026-0002');
ok(cases.find('CJ-2026-0002').highRisk === true, '操作列「标记高风险」写入病案记录');
window.mrqcCaseRisk('CJ-2026-0002');
ok(cases.find('CJ-2026-0002').highRisk === false, '操作列「解除标记」可逆恢复');

/* 搜索（功能点1-6/1-7：按住院号 / 患者ID / 患者姓名模糊检索） */
elVals = { 'mrqcKw': 'ZY20260101' };
window.mrqcSearch('mrqc-base');
ok(pc.innerHTML.indexOf('CJ-2026-0001') >= 0 && pc.innerHTML.indexOf('CJ-2026-0002') < 0,
  '功能点1-7 搜索按钮按住院号过滤列表（仅命中病案1）');
elVals = { 'mrqcKw': '刘某某' };
window.mrqcSearch('mrqc-base');
ok(pc.innerHTML.indexOf('CJ-2026-0002') >= 0 && pc.innerHTML.indexOf('CJ-2026-0001') < 0,
  '功能点1-6/1-7 搜索支持患者姓名检索');
window.mrqcResetFilter('mrqc-base');
M.state.tab = 'mrqc-report'; window.renderPage('mrqc-workbench');
ok(/格式校验/.test(pc.innerHTML) && /缺失预警清单/.test(pc.innerHTML) && /LIS\/PACS 核对/.test(pc.innerHTML) &&
   /关联报告/.test(pc.innerHTML) && /补录/.test(pc.innerHTML) && /清除/.test(pc.innerHTML) && /缺失（关键）/.test(pc.innerHTML),
  '页签② 关联报告编号索引：功能点 3-1~3-7 入口齐全（病理缺失行有预警标识与补录入口）');
M.state.tab = 'mrqc-result'; window.renderPage('mrqc-workbench');
ok(/执行质控引擎/.test(pc.innerHTML) && /问题分类统计/.test(pc.innerHTML) && /阻断上报清单/.test(pc.innerHTML) &&
   /导出明细/.test(pc.innerHTML) && /复核/.test(pc.innerHTML) && /日志/.test(pc.innerHTML) && /MRQ-B02/.test(pc.innerHTML),
  '页签③ 质控执行结果明细：功能点 4-1~4-7 入口齐全（含规则ID筛选维度）');
M.state.tab = 'mrqc-storage'; window.renderPage('mrqc-workbench');
ok(/脱敏策略配置/.test(pc.innerHTML) && /上传 JSON 数据/.test(pc.innerHTML) && /未脱敏高风险/.test(pc.innerHTML) &&
   /导出配置清单/.test(pc.innerHTML) && /样本\/验证/.test(pc.innerHTML) && /版本/.test(pc.innerHTML) && /归档/.test(pc.innerHTML),
  '页签④ 数据存储与脱敏配置：功能点 5-1~5-8 入口齐全（5-4/5-6 合并为「样本/验证」弹窗）');

/* 隐藏详情页 mrqc-case|<采集ID>（参照 cq-case 模式，五表联动呈现） */
window.renderPage('mrqc-case|CJ-2026-0004');
ok(/病案首页质控详情/.test(pc.innerHTML) && /返回工作台/.test(pc.innerHTML) &&
   /机构ID/.test(pc.innerHTML) && /关联报告编号索引/.test(pc.innerHTML) && /质控执行结果/.test(pc.innerHTML) && /问题项与修正建议/.test(pc.innerHTML) && /补充随访标识/.test(pc.innerHTML),
  '隐藏详情页 mrqc-case|：基础信息（含机构ID）/关联报告/问题项/质控结果联动呈现（1-2 补充随访标识入口），可返回工作台');

/* 详情页报告号解绑 / 快捷补录（3-7 / 3-1：解绑变未关联 → 行内补录重新添加） */
window.renderPage('mrqc-case|CJ-2026-0004');
ok(/解绑/.test(pc.innerHTML), '详情页已关联报告号行内显示「解绑」入口');
window.mrqcRpUnbind('ZY20260104', 'labNo');
ok(reports.find('ZY20260104').labNo === '', '功能点3-7 详情页解绑报告号（变为未关联空状态，可重新补录）');
window.renderPage('mrqc-case|CJ-2026-0003');
ok(/未关联/.test(pc.innerHTML) && /补录/.test(pc.innerHTML),
  '详情页未关联报告号行内显示「未关联」徽章与「补录」入口');
elVals = { 'mrqcRpQv': 'BL-20260115-0040' };
window.mrqcRpQuickSave('ZY20260103', 'pathNo');
ok(reports.find('ZY20260103').pathNo === 'BL-20260115-0040',
  '功能点3-1 详情页快捷补录病理报告号（弹输入框保存后回写索引）');
M.state.tab = 'mrqc-base'; window.renderPage('mrqc-workbench');

/* 完整性 + ICD 校验逻辑（computeIssues） */
ok(M.computeIssues(cases.find('CJ-2026-0004')).some(i => i.sugg.indexOf('C50.9') >= 0), '功能点1-4 ICD-10 缺小数点（C509）建议修正为 C50.9');
ok(M.computeIssues(cases.find('CJ-2026-0005')).some(i => i.type === '字段缺失' && i.field.indexOf('随访') >= 0) &&
   M.computeIssues(cases.find('CJ-2026-0005')).some(i => i.sugg.indexOf('M-8140/3') >= 0),
  '功能点1-3/1-4 病案5 检出随访标识缺失 + ICD-O-3 缺 /3 建议修正值');
ok(M.computeIssues(cases.find('CJ-2026-0008')).some(i => i.type === '逻辑冲突' && i.ruleId === 'MRQ-L02'),
  '功能点4-1 规则 MRQ-L02 检出动态编码 /2 与病理浸润性逻辑冲突');
ok(M.computeIssues(cases.find('CJ-2026-0010')).some(i => i.sugg.indexOf('C85.9') >= 0), '功能点1-4 恶性淋巴瘤误用 D50.9 建议修正为 C85.9');
ok(M.computeIssues(cases.find('CJ-2026-0001')).length === 0, '病案1（校验通过种子）无缺陷检出');

/* 完整性 + 编码校验结果融入表格（功能点1-3/1-4：问题项列逐条明细 + ICD 列内建议值与采纳） */
M.state.tab = 'mrqc-base'; window.renderPage('mrqc-workbench');
ok(/\[字段缺失·重要\]/.test(pc.innerHTML) && /发病\/死亡\/随访标识/.test(pc.innerHTML) &&
   /\[编码错误·重要\]/.test(pc.innerHTML) && /C50\.9/.test(pc.innerHTML) && /采纳/.test(pc.innerHTML) && /查看随访/.test(pc.innerHTML),
  '功能点1-3/1-4 校验结果融入表格：「问题项」列逐条明细（类型·等级/字段/建议值），ICD 列内嵌建议值与「采纳」，操作列「查看随访」');

/* ICD 建议行内采纳（功能点1-4：校验结果融入表格列，按建议修正编码） */
window.mrqcIcdFixCell('CJ-2026-0004', 'icd10', 'C50.9');
window.mrqcIcdFixCell('CJ-2026-0005', 'icdo3', 'M-8140/3');
window.mrqcIcdFixCell('CJ-2026-0010', 'icd10', 'C85.9');
ok(cases.find('CJ-2026-0004').icd10 === 'C50.9' && cases.find('CJ-2026-0005').icdo3 === 'M-8140/3' && cases.find('CJ-2026-0010').icd10 === 'C85.9',
  '功能点1-4 全部采纳建议值后编码已修正');

/* 补充随访标识（功能点1-2） */
elVals = { 'mrqcVitVal': '死亡', 'mrqcVitNote': '2026-02 死亡随访确认' };
window.mrqcVitSave('CJ-2026-0005');
ok(cases.find('CJ-2026-0005').vitStatus === '死亡' &&
   !M.computeIssues(cases.find('CJ-2026-0005')).some(i => i.field.indexOf('随访') >= 0),
  '功能点1-2 补充随访状态标识后问题清单消除该缺失项');

/* 质控引擎执行（功能点4-1：点击即执行，规则ID/错误类型/严重等级/阻断标识留痕） */
const engBefore = results.all().length;
window.mrqcRunEngine();
ok(results.all().length > engBefore, '功能点4-1 引擎执行生成新质控结果记录（记录数增加）');
ok(cases.find('CJ-2026-0003').qcState === '校验通过', '功能点4-1 引擎执行后待质控病案（病案3 无缺陷）状态更新为校验通过');
ok(cases.find('CJ-2026-0008').qcState === '已阻断' && results.all().some(r => r.ipNo === 'ZY20260108' && r.blocked === true && r.sevLevel === '严重'),
  '功能点4-1 病案8 严重逻辑冲突被阻断上报（严重等级/阻断标识留痕）');

/* 人工复核（功能点4-2） */
const blk = results.all().find(r => r.blocked && r.state === '待复核');
elVals = { 'mrqcRvRes': '确认问题，退回修正', 'mrqcRvOp': '退回病案室修正编码' };
window.mrqcReviewSave(blk.qcId);
ok(blk.state === '已复核' && blk.opinion === '退回病案室修正编码' && blk.logs[blk.logs.length - 1].actor.indexOf('质控员') >= 0,
  '功能点4-2 人工复核意见提交并写入全流程日志');

/* 报告编号：绑定 + 补录影像 + 清除（功能点3-1/3-2/3-7） */
elVals = { 'mrqcRP': 'BL-20260115-0040', 'mrqcRL': 'LIS-20260116-0127', 'mrqcRI': '' };
window.mrqcRpSave('ZY20260103');
ok(reports.find('ZY20260103').pathNo === 'BL-20260115-0040', '功能点3-1 绑定病理报告编号');
elVals = { 'mrqcImgV': 'IMG-20260115-0219' };
window.mrqcRpImgSave('ZY20260105');
ok(reports.find('ZY20260105').imgNo === 'IMG-20260115-0219', '功能点3-2 补录影像报告编号');
elVals = { 'mrqcClr_labNo': 'on' };
document.getElementById('mrqcClr_labNo').checked = true;
window.mrqcRpClearGo('ZY20260104');
ok(reports.find('ZY20260104').labNo === '' , '功能点3-7 清除无效报告关联（勾选项）');

/* 与 LIS/PACS 批量核对（功能点3-6：点击即执行，结果回写一致性状态） */
window.mrqcRpMatch();
ok(reports.all().some(r => r.matchState === '不一致') && reports.all().every(r => r.checkedTime),
  '功能点3-6 批量核对输出不一致记录并回写核对状态');

/* 存储与脱敏（功能点5-1 策略 / 5-4 样本 / 5-2 上传） */
elVals = { 'mrqcPl_name': '替换', 'mrqcPl_idNo': '掩码', 'mrqcPl_tel': '哈希', 'mrqcPl_addr': '掩码' };
window.mrqcMaskPolicySave();
const p = policyStore.get();
ok(p.idNo === '掩码' && p.tel === '哈希' && p.name === '替换', '功能点5-1 脱敏策略保存（掩码/哈希/替换）');
const masked = M.maskJson(storages.find('CT-2026-0003').jsonStr, p);
const idVal = masked.o['身份证号'], telVal = masked.o['联系电话'], nameVal = masked.o['患者姓名'];
ok(idVal === '360102********1234' && /^[0-9a-f]{8}$/.test(telVal) && /^PT-/.test(nameVal),
  '功能点5-4 脱敏样本输出：掩码 / 哈希 / 替换三类方式均生效');
elVals = { 'mrqcUpIp': 'ZY20260103', 'mrqcUpJson': '{"住院号":"ZY20260103","患者姓名":"王某某","身份证号":"360102196503121234"}' };
window.mrqcUploadSave();
ok(storages.all().some(s => s.ipNo === 'ZY20260103' && s.note === '手工上传'), '功能点5-2 JSON 原始数据上传入库（保留原始结构）');

/* 版本历史（功能点5-5）与删除/归档（功能点5-3） */
window.mrqcStState('CT-2026-0001', '已归档');
const st1 = storages.find('CT-2026-0001');
ok(st1.state === '已归档' && st1.versions[st1.versions.length - 1].state.indexOf('归档') >= 0, '功能点5-3 标记归档并登记版本');
window.mrqcStRollback('CT-2026-0002', 1);
ok(storages.find('CT-2026-0002').ver === 3 && storages.find('CT-2026-0002').versions[2].state.indexOf('回滚') >= 0, '功能点5-5 版本历史支持回滚登记');

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
process.exit(fail ? 1 : 0);
