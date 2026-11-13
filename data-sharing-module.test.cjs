/* 数据共享模块（v2）冒烟测试（无浏览器，桩替换 DOM/localStorage）
 * 运行：node data-sharing-module.test.cjs */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

function el() {
  return { innerHTML: '', style: {}, className: '', appendChild() {}, removeChild() {}, click() {},
    addEventListener() {}, remove() {}, closest() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, textContent: '', value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
}
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const pc = el();
let elVals = {}, chkMap = {};
global.document = { createElement: () => el(), head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} },
  getElementById: id => id === 'pageContainer' ? pc : Object.assign(el(), { value: elVals[id] !== undefined ? elVals[id] : '' }),
  querySelectorAll: sel => { const m = /^input\[name="([^"]+)"\]:checked$/.exec(sel); return m && chkMap[m[1]] ? chkMap[m[1]].map(v => ({ value: v })) : []; },
  querySelector: () => null, addEventListener() {} };
global.window = global;
global.toast = () => {};
global.showConfirm = (t, m, fn) => { fn(el()); };
global.setActiveMenu = () => {};
global.updateBreadcrumb = () => {};
global.renderPage = function () {};
global.navigateTo = () => {};
global.Blob = function (parts) { this.parts = parts; };
global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
global.setTimeout = (fn, ms) => { fn && fn(); return 0; };
/* 系统账户体系（app.html userData 的桩）：审批设置从中选择审核人 */
global.userData = [
  { account: 'admin', name: '超级管理员', org: '江西省肿瘤防治办公室', status: 'enabled' },
  { account: 'zhangsan', name: '张三', org: '南昌市疾控中心', status: 'enabled' },
  { account: 'lisi', name: '李四', org: '赣州市疾控中心', status: 'enabled' },
  { account: 'zhaoliu', name: '赵六', org: '上饶市中心医院', status: 'disabled' }
];

vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'data-sharing-module.js'), 'utf8'), { filename: 'data-sharing-module.js' });

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }

ok(!!window.SH, '注册 window.SH 数据表集（含 trails 审计与 tokenState）');
const { platforms, platformVer, applies, policies, policyVer, deliveries, monitors, lineages, trails, genToken, tokenState } = window.SH;

/* 功能点18 外部平台对接与数据接入配置：接口协议定义 / 同步频率 / 字段映射 /
   启用停用 / 版本管理与回滚 / 状态监控 / 配置导出，全部在 sh-platform 单页完成 */
const p1 = platforms.all()[0];
ok(platforms.all().length >= 4 && !!('accessId' in p1) && !!('platformName' in p1) && !!('accessType' in p1) &&
   !!('protocol' in p1) && !!('authType' in p1) && !!('syncFreq' in p1) && !!('lastSyncTime' in p1) &&
   !!('syncStatus' in p1) && !!('fieldMapJson' in p1) && !!('enabled' in p1) && !!('creator' in p1) && !!('createTime' in p1),
  '功能点18 平台主数据保留功能点标准字段（接入ID/平台名称/对接类型/协议/认证/频率/最后同步/状态/字段映射JSON/启用/创建人/时间）');
ok((() => { try { return !!JSON.parse(p1.fieldMapJson); } catch (e) { return false; } })(), '功能点18 字段映射规则为合法 JSON');
ok(typeof window.shPlatformDocDownload === 'undefined',
  '功能点18 接入流程 / 接入要点 / 附件下载区块已移除（仅保留接口配置列表）');
/* 协议定义 / 同步频率 / 监控扩展字段 */
ok(['endpoint', 'method', 'syncMode', 'syncTime', 'timeout', 'retry', 'fieldMap', 'version',
  'connStatus', 'respTime', 'lastCheckTime', 'availability', 'respHistory'].every(k => k in p1),
  '功能点18 接口协议定义 / 同步频率 / 状态监控扩展字段齐全');
ok(platforms.all().some(p => p.protocol === 'FTP 文件') && platforms.all().some(p => /^HTTP/.test(p.protocol)),
  '功能点18 接口协议支持 HTTP 与 FTP 两类传输协议');
ok(platforms.all().every(p => Array.isArray(p.fieldMap) && p.fieldMap.every(m => m.src && m.dst)) &&
   platforms.all().every(p => { const j = JSON.parse(p.fieldMapJson); return p.fieldMap.every(m => j[m.src] === m.dst); }),
  '功能点18 字段映射为 源字段→目标字段 结构且与 fieldMapJson 一致');
ok(platforms.all().every(p => ['实时', '每日', '每周', '每月'].indexOf(p.syncFreq) >= 0) &&
   platforms.all().every(p => p.syncMode === '增量' || p.syncMode === '全量'),
  '功能点18 同步频率取值规范（实时/每日/每周/每月 + 增量/全量）');
/* 新建接口配置：协议 + 地址 + 同步频率 */
elVals = { 'sh-pl-name': '测试医保接口', 'sh-pl-type': '数据订阅', 'sh-pl-proto': 'FTP 文件', 'sh-pl-method': '文件传输',
  'sh-pl-ep': 'ftp://10.0.0.9:21/test/', 'sh-pl-auth': '国密数字证书', 'sh-pl-cred': 'SM2-****088',
  'sh-pl-freq': '每日', 'sh-pl-smode': '增量', 'sh-pl-stime': '每日 04:00', 'sh-pl-to': '20', 'sh-pl-retry': '2', 'sh-pl-en': '是' };
window.shPlatSubmit('');
const np = platforms.all()[platforms.all().length - 1];
ok(np && np.platformName === '测试医保接口' && np.protocol === 'FTP 文件' && np.endpoint === 'ftp://10.0.0.9:21/test/' &&
   np.syncFreq === '每日' && np.syncMode === '增量' && np.syncTime === '每日 04:00' && np.timeout === 20 && np.retry === 2,
  '功能点18 新建接口配置（接口协议定义 + 同步频率 + 超时重试）');
ok(np.version === 'v1.0' && platformVer.all().some(v => v.accessId === np.accessId && v.version === 'v1.0'),
  '功能点18 新建接口自动生成初始版本 v1.0');
/* 协议与接口地址不匹配拦截 */
const platCnt = platforms.all().length;
elVals = { 'sh-pl-name': '非法接口', 'sh-pl-proto': 'FTP 文件', 'sh-pl-ep': 'https://a.b/c' };
window.shPlatSubmit('');
ok(platforms.all().length === platCnt, '功能点18 接口协议与地址前缀不匹配时拦截保存');
/* 编辑接口配置 → 自动生成新版本 */
elVals = { 'sh-pl-name': '测试医保接口', 'sh-pl-proto': 'FTP 文件', 'sh-pl-method': '文件传输',
  'sh-pl-ep': 'ftp://10.0.0.9:21/test2/', 'sh-pl-auth': '国密数字证书', 'sh-pl-cred': 'SM2-****088',
  'sh-pl-freq': '每周', 'sh-pl-smode': '全量', 'sh-pl-stime': '每周一 04:00', 'sh-pl-to': '20', 'sh-pl-retry': '2', 'sh-pl-en': '是' };
window.shPlatSubmit(np.accessId);
ok(np.endpoint === 'ftp://10.0.0.9:21/test2/' && np.syncFreq === '每周' && np.syncMode === '全量' && np.version !== 'v1.0',
  '功能点18 编辑接口配置（协议 / 同步频率变更）并生成新版本');
/* 字段映射规则配置：病历号 → case_id */
window.shPlatMap(np.accessId);
window.shMapSet(0, 'src', '病历号'); window.shMapSet(0, 'dst', 'case_id'); window.shMapSet(0, 'type', 'STRING');
window.shMapAddRow();
window.shMapSet(1, 'src', '诊断编码'); window.shMapSet(1, 'dst', 'diag_code');
window.shPlatMapSubmit();
ok(np.fieldMap.length === 2 && np.fieldMap[0].src === '病历号' && np.fieldMap[0].dst === 'case_id' &&
   JSON.parse(np.fieldMapJson)['病历号'] === 'case_id', '功能点18 字段映射保存（病历号 → case_id）并同步 fieldMapJson');
ok(platformVer.all().some(v => v.accessId === np.accessId && v.note.indexOf('字段映射') >= 0),
  '功能点18 字段映射保存自动生成版本');
window.shPlatMap(np.accessId);
window.shMapAddRow();
window.shMapSet(2, 'src', '其他字段'); window.shMapSet(2, 'dst', 'case_id');
window.shPlatMapSubmit();
ok(np.fieldMap.length === 2, '功能点18 目标字段重复时拦截保存');
/* 启用 / 停用 */
window.shPlatToggle(np.accessId);
ok(np.enabled === '否' && np.connStatus === '未连接', '功能点18 停用接口（连接状态置为未连接）');
window.shPlatToggle(np.accessId);
ok(np.enabled === '是', '功能点18 启用接口');
/* 连接状态监控：检测 / 响应时间 / 可用率 / 检测记录 */
const histLen = (np.respHistory || []).length;
window.shPlatCheck(np.accessId);
ok(['正常', '异常'].indexOf(np.connStatus) >= 0 && np.respTime > 0 && np.lastCheckTime !== '—' &&
   np.respHistory.length === histLen + 1, '功能点18 接口检测写入连接状态 / 响应时间 / 检测记录');
ok(/^\d+(\.\d+)?%$/.test(String(np.availability)), '功能点18 检测后按检测记录计算可用率');
window.shPlatToggle(np.accessId);
const respKeep = np.respTime;
window.shPlatCheck(np.accessId);
ok(np.respTime === respKeep, '功能点18 停用接口检测跳过');
window.shPlatToggle(np.accessId);
window.shPlatCheckAll();
ok(platforms.all().filter(p => p.enabled === '是').every(p => !!p.lastCheckTime && p.lastCheckTime !== '—'),
  '功能点18 批量检测全部已启用接口');
/* 版本管理与回滚 */
const verCnt = platformVer.all().filter(v => v.accessId === np.accessId).length;
elVals = { 'sh-ver-note': '手动快照测试' };
window.shVerSave(np.accessId);
ok(platformVer.all().filter(v => v.accessId === np.accessId).length === verCnt + 1 &&
   platformVer.all().some(v => v.note === '手动快照测试'), '功能点18 手动保存接口版本');
const oldVer = platformVer.all().filter(v => v.accessId === np.accessId).find(v => v.version === 'v1.0');
window.shPlatRollback(oldVer.verId);
ok(np.version === 'v1.0' && np.endpoint === 'ftp://10.0.0.9:21/test/' &&
   platformVer.all().some(v => v.accessId === np.accessId && v.note.indexOf('回滚前自动备份') >= 0),
  '功能点18 版本回滚恢复历史配置并自动备份当前配置');
/* 配置导出：JSON / 表格 */
ok(window.shPlatExport('json') === true, '功能点18 接口配置导出 JSON');
ok(window.shPlatExport('csv') === true, '功能点18 接口配置导出表格（CSV）');
/* 删除接口：无血缘引用可删，有引用拦截 */
window.shPlatDel(np.accessId);
ok(!platforms.find(np.accessId) && !platformVer.all().some(v => v.accessId === np.accessId),
  '功能点18 删除接口并清理其历史版本');
window.shPlatDel('ACC-001');
ok(!!platforms.find('ACC-001'), '功能点18 存在字段元数据引用时禁止删除接口');
/* 单页承载全部配置能力 */
window.renderPage('sh-platform');
ok(pc.innerHTML.indexOf('外部平台对接与数据接入配置') >= 0 && pc.innerHTML.indexOf('shPlatExportDlg') >= 0 &&
   pc.innerHTML.indexOf('检测全部接口') >= 0 && pc.innerHTML.indexOf('shPlatMenu(') >= 0,
  '功能点18 单页承载协议定义/同步/映射/启停/版本/监控/导出入口');
ok(pc.innerHTML.indexOf('接入要点') < 0 && pc.innerHTML.indexOf('附件下载') < 0 &&
   (pc.innerHTML.match(/class="panel"/g) || []).length === 1,
  '功能点18 页面仅保留接口配置列表，无接入流程 / 说明 / 附件区块');
/* 操作栏：单符号按钮展开菜单，6 项操作不在列表里铺开 */
ok((pc.innerHTML.match(/shPlatMenu\(/g) || []).length === platforms.all().length &&
   pc.innerHTML.indexOf("shPlatEdit('ACC") < 0 && pc.innerHTML.indexOf('⋯') >= 0,
  '功能点18 操作栏收敛为符号按钮（点击展开操作菜单）');
ok(window.shPlatMenu({}, platforms.all()[0].accessId) === true &&
   typeof window.shPlatAct === 'function',
  '功能点18 符号按钮可展开操作菜单');
window.shPlatAct('ver', platforms.all()[0].accessId);
ok(pc.innerHTML.indexOf('ms') >= 0 && pc.innerHTML.indexOf('同步频率') >= 0,
  '功能点18 列表展示连接状态 / 响应时间 / 同步频率');
elVals = {}; chkMap = {};

/* 功能点19 数据共享申请审批：标准字段（v3 精简模型） + 三级审批流转 + 驳回 */
const a1 = applies.all()[0];
ok(applies.all().length >= 5 && !!('applyId' in a1) && !!('applicant' in a1) && !!('applyOrg' in a1) &&
   !!('purpose' in a1) && !!('dataScope' in a1) && !!('validUntil' in a1) && !!('accessMode' in a1) && !!('applyNote' in a1) &&
   !!('submitTime' in a1) && !!('currentNode' in a1) && !!('applyStatus' in a1) &&
   !!('approveComments' in a1) && !!('finishTime' in a1), '功能点19 申请标准字段齐全（申请ID/人/机构/用途/范围/有效期/对接方式/申请说明/提交时间/节点/状态/意见/完成时间）');
ok(applies.all().every(a => a.accessMode === '查看权限' || a.accessMode === '接口对接' || a.accessMode === '文件下载'),
  '功能点19 交付方式取值规范（查看权限 / 接口对接 / 文件下载）');
ok(Array.isArray(a1.approveComments) && a1.approveComments.every(c => 'approver' in c && 'node' in c),
  '功能点19 审批意见含审批人列表');
elVals = { 'sh-f-app': '测试申请人', 'sh-f-org': '测试机构', 'sh-f-purpose': '测试用途', 'sh-f-scope': '江西省 / 2023 / 全部癌种',
  'sh-f-note': '测试申请说明：仅使用汇总数据' };
window.shApplySubmit();
const newApply = applies.all()[applies.all().length - 1];
ok(newApply && newApply.applyStatus === '审批中' && newApply.currentNode === '数据管理科审核', '功能点19 新建申请进入首审节点');
elVals = { 'sh-f-comment': '同意' };
window.shApplySubmitReview(newApply.applyId, '通过');
ok(newApply.currentNode === '数据安全小组审核', '功能点19 首级通过后流转至数据安全小组');
window.shApplySubmitReview(newApply.applyId, '通过');
ok(newApply.currentNode === '分管领导审批', '功能点19 二级通过后流转至分管领导');
window.shApplySubmitReview(newApply.applyId, '通过');
ok(newApply.applyStatus === '已批准' && newApply.currentNode === '已完结' && newApply.finishTime !== '—' &&
   newApply.approveComments.length === 3, '功能点19 三级审批全部通过后批准并记录完成时间');
const rejTarget = applies.all().find(a => a.applyStatus === '审批中' && a.currentNode === '数据管理科审核');
elVals = { 'sh-f-comment': '不予批准' };
window.shApplySubmitReview(rejTarget.applyId, '驳回');
ok(rejTarget.applyStatus === '已驳回' && rejTarget.approveComments.some(c => c.result === '驳回'),
  '功能点19 驳回路径正常终止流程');
/* 交付 = 上传附件：批准后上传附件留痕 */
window.shApplyAttachDone(newApply.applyId, '测试附件.csv');
const attached = applies.find(newApply.applyId);
ok(attached.attachment === '测试附件.csv' && !!attached.attachTime,
  '功能点19 批准申请上传交付附件（附件名与时间留痕）');
window.shApplyAttachDone(rejTarget.applyId, '不应成功.csv');
ok(!applies.find(rejTarget.applyId).attachment, '功能点19 已驳回申请不可上传交付附件');
/* 我的申请 / 我的审核：审核入口按登录身份权限显示 */
window.renderPage('sh-apply');
ok(pc.innerHTML.indexOf('shApplyAttach') >= 0 && pc.innerHTML.indexOf('审批设置') >= 0,
  '功能点19 我的申请可上传附件，标题栏含审批设置入口');
window.shApplyTab('audit');
const admRev = (pc.innerHTML.match(/shApplyReview\(/g) || []).length;
const admDet = (pc.innerHTML.match(/shApplyDetail\(/g) || []).length;
ok(admRev === 1 && admDet === 1,
  '功能点19 当前账户为第三级审核人出现待办审批入口（review=' + admRev + ' detail=' + admDet + '）');
window.shApplyTab('mine');
window.shApplyUser('数据安全小组·李组长');
window.shApplyTab('audit');
const ljMine = applies.all().filter(a => a.approveComments.some(c => c.approver === '数据安全小组·李组长' && (c.result === '通过' || c.result === '驳回')));
const ljRows = applies.all().filter(a => a.applyStatus === '审批中' || ljMine.includes(a)).length;
ok((pc.innerHTML.match(/shApplyReview\(/g) || []).length === 0 &&
   (pc.innerHTML.match(/shApplyDetail\(/g) || []).length === ljRows,
  '功能点19 非当前配置审核人进入我的审核为只读（在途 + 历史已办 ' + ljRows + ' 条）');
window.shSetFilter('sh-apply', 'audit', 'pending');
ok((pc.innerHTML.match(/shApplyReview\(/g) || []).length === 0, '功能点19 处理状态筛选-未审批（只读）');
window.shSetFilter('sh-apply', 'audit', 'done');
ok((pc.innerHTML.match(/shApplyDetail\(/g) || []).length === ljMine.length && pc.innerHTML.indexOf('shApplyReview(') < 0,
  '功能点19 处理状态筛选-我已审批');
window.shSetFilter('sh-apply', 'ares', '驳回');
const ljRej = ljMine.filter(a => a.approveComments.some(c => c.approver === '数据安全小组·李组长' && c.result === '驳回')).length;
ok((pc.innerHTML.match(/shApplyDetail\(/g) || []).length === ljRej, '功能点19 审批结果筛选-驳回');
window.shSetFilter('sh-apply', 'ares', '通过');
ok((pc.innerHTML.match(/shApplyDetail\(/g) || []).length === ljMine.length - ljRej, '功能点19 审批结果筛选-通过');
window.shResetFilter('sh-apply');
window.shApplyUser('分管领导·赵主任');
window.shApplyTab('audit');
const zrRev = (pc.innerHTML.match(/shApplyReview\(/g) || []).length;
const zrDet = (pc.innerHTML.match(/shApplyDetail\(/g) || []).length;
ok(zrRev === 0 && zrDet === 3,
  '功能点19 我的审核按账户历史只读展示（review=' + zrRev + ' detail=' + zrDet + '）');
window.shApplyUser('管理员');
/* 审批设置：层级可增减，审核人来自账户体系（userData 启用账号） */
window.shApplyCfg();
window.shApplyCfgSet(0, 'label', '测试一级审核'); window.shApplyCfgSet(0, 'user', '张三');
window.shApplyCfgSet(1, 'label', '测试二级审核'); window.shApplyCfgSet(1, 'user', '李四');
window.shApplyCfgSet(2, 'label', '测试三级审核'); window.shApplyCfgSet(2, 'user', '超级管理员');
window.shApplyCfgAdd();
window.shApplyCfgSet(3, 'label', '测试四级审核'); window.shApplyCfgSet(3, 'user', '张三');
window.shApplyCfgSubmit();
const { NODES } = window.SH;
ok(NODES.length === 4 && NODES[0].label === '测试一级审核' && NODES[3].user === '张三',
  '功能点19 审批层级可增加（4 级）且审核人来自账户体系');
ok(mem['jx.sh.nodes.v1'] && JSON.parse(mem['jx.sh.nodes.v1']).length === 4,
  '功能点19 审批层级配置持久化（jx.sh.nodes.v1）');
/* 层级删除：回到 3 级 */
window.shApplyCfg();
NODES.forEach((n, i) => { window.shApplyCfgSet(i, 'label', n.label); window.shApplyCfgSet(i, 'user', n.user); });
window.shApplyCfgDel(3);
window.shApplyCfgSubmit();
ok(window.SH.NODES.length === 3, '功能点19 审批层级可删除（回到 3 级）');
/* 撤销申请：审批中可撤，撤后流程终止 */
const wdTarget = applies.all().find(a => a.applyStatus === '审批中');
window.shApplyWithdraw(wdTarget.applyId);
ok(applies.find(wdTarget.applyId).applyStatus === '已撤销', '功能点19 撤销申请后流程终止（已撤销）');
window.shApplyWithdraw(wdTarget.applyId);
ok(applies.all().filter(a => a.applyStatus === '审批中').length === 0, '功能点19 已撤销申请不可重复撤销且无待审');

/* 功能点20 数据共享策略配置（页面访问授权模型）：标准字段 + 页面白名单 + 脱敏导出 */
const pl1 = policies.all()[0];
const PAGE_IDS = window.SH.ACCESS_PAGES.map(p => p.id);
ok(policies.all().length >= 3 && ['policyId', 'policyName', 'applicant', 'applyOrg', 'pages', 'validUntil', 'enabled', 'creator', 'effectTime']
   .every(k => k in pl1),
  '功能点20 访问授权标准字段齐全（策略ID/名称/被授权人/机构/可访问页面/有效期/状态/创建人/生效时间）');
ok(pl1.pages.length > 0 && pl1.pages.every(id => PAGE_IDS.indexOf(id) >= 0),
  '功能点20 可访问页面白名单均有效（来自授权页面清单）');
/* 未勾选页面时拦截 */
elVals = { 'sh-p-app': '测试被授权人', 'sh-p-org': '测试机构', 'sh-p-vu': '2027-06-30', 'sh-p-name': '' };
chkMap = { 'sh-c-page': [] };
const pcnt = policies.all().length;
window.shPolicySubmit('');
ok(policies.all().length === pcnt, '功能点20 未勾选可访问页面时拦截保存');
/* 正常新建授权 */
chkMap = { 'sh-c-page': ['datamgmt-card', 'ar-tasks'] };
window.shPolicySubmit('');
const newPolicy = policies.all().find(p => p.applicant === '测试被授权人');
ok(!!newPolicy && newPolicy.enabled === '是' && newPolicy.pages.length === 2 &&
   /^P-\d{4}-\d{3,4}$/.test(newPolicy.policyId) && /访问授权/.test(newPolicy.policyName),
  '功能点20 新建页面访问授权（默认生效，名称自动生成）');
/* 页面数据脱敏导出 */
ok(window.shPolicyExport(newPolicy.policyId, 'datamgmt-card') === true, '功能点20 授权页面数据脱敏导出成功');
/* 停用授权后导出拦截 */
window.shPolicyToggle(newPolicy.policyId);
ok(policies.find(newPolicy.policyId).enabled === false, '功能点20 授权启停切换');
ok(window.shPolicyExport(newPolicy.policyId, 'datamgmt-card') === false, '功能点20 停用授权后页面导出被拦截');
/* 编辑授权 */
elVals = { 'sh-p-app': '测试被授权人', 'sh-p-org': '测试机构', 'sh-p-vu': '2027-10-31', 'sh-p-name': '测试授权（修订）' };
chkMap = { 'sh-c-page': ['ar-tasks'] };
window.shPolicySubmit(newPolicy.policyId);
const plEdited = policies.find(newPolicy.policyId);
ok(plEdited.policyName === '测试授权（修订）' && plEdited.pages.length === 1 && plEdited.validUntil === '2027-10-31',
  '功能点20 编辑访问授权保存并更新页面白名单');

/* 功能点20 扩展：脱敏级别 / 字段白黑名单 / 最小颗粒度 / 授权机制 / 版本管理 */
ok(policies.all().every(p => ['不脱敏','去标识化','匿名化'].indexOf(p.maskLevel) >= 0),
  '功能点20 脱敏级别配置（匿名化 / 去标识化 / 不脱敏）字段齐全');
ok(policies.all().every(p => Array.isArray(p.allowFields) && Array.isArray(p.denyFields)),
  '功能点20 字段白名单 / 黑名单为数组字段');
ok(policies.all().every(p => ['省级','市级','区县级'].indexOf(p.granularity) >= 0),
  '功能点20 最小颗粒度配置（省级 / 市级 / 区县级）字段齐全');
ok(policies.all().every(p => ['API Key','OAuth 2.0','国密数字证书','IP 白名单'].indexOf(p.authType) >= 0),
  '功能点20 授权机制配置（API Key / OAuth 2.0 / 国密数字证书 / IP 白名单）字段齐全');
/* 种子策略含版本历史 */
ok(policyVer.all().filter(v => v.policyId === 'P-2026-001').length >= 1 &&
   policyVer.all().some(v => v.policyId === 'P-2026-002' && v.version === 'v1.0'),
  '功能点20 种子策略已生成版本历史（含 P-2026-002 的 v1.0 演进版本）');
/* 新建授权自动生成初始版本 v1.0（检查版本历史含 v1.0） */
ok(policyVer.all().some(v => v.policyId === newPolicy.policyId && v.version === 'v1.0'),
  '功能点20 新建授权自动生成初始版本 v1.0');
/* 编辑授权自动生成新版本 */
const verBefore = policyVer.all().filter(v => v.policyId === newPolicy.policyId).length;
elVals = { 'sh-p-app': '测试被授权人', 'sh-p-org': '测试机构', 'sh-p-vu': '2028-01-31', 'sh-p-name': '测试授权（再修订）',
  'sh-p-mask': '匿名化', 'sh-p-gran': '区县级', 'sh-p-auth': 'OAuth 2.0' };
chkMap = { 'sh-c-page': ['ar-tasks'], 'sh-c-allow': ['登记编号','性别','年龄组','ICD-10'], 'sh-c-deny': ['姓名','身份证号'] };
window.shPolicySubmit(newPolicy.policyId);
const plV2 = policies.find(newPolicy.policyId);
ok(plV2.maskLevel === '匿名化' && plV2.granularity === '区县级' && plV2.authType === 'OAuth 2.0' &&
   plV2.allowFields.indexOf('登记编号') >= 0 && plV2.denyFields.indexOf('姓名') >= 0 &&
   plV2.version !== 'v1.0' &&
   policyVer.all().filter(v => v.policyId === newPolicy.policyId).length === verBefore + 1,
  '功能点20 编辑授权更新脱敏级别/颗粒度/授权机制/字段白黑名单并生成新版本');
/* 手动保存版本 */
const verCnt2 = policyVer.all().filter(v => v.policyId === newPolicy.policyId).length;
elVals = { 'sh-p-vernote': '手动快照测试' };
window.shPolicyVerSave(newPolicy.policyId);
ok(policyVer.all().filter(v => v.policyId === newPolicy.policyId).length === verCnt2 + 1 &&
   policyVer.all().some(v => v.policyId === newPolicy.policyId && v.note === '手动快照测试'),
  '功能点20 手动保存策略版本');
/* 版本回滚恢复历史配置并自动备份 */
const oldV = policyVer.all().filter(v => v.policyId === newPolicy.policyId).find(v => v.version === 'v1.0');
window.shPolicyRollback(oldV.verId);
ok(policies.find(newPolicy.policyId).version === 'v1.0' &&
   policyVer.all().some(v => v.policyId === newPolicy.policyId && v.note.indexOf('回滚前自动备份') >= 0),
  '功能点20 版本回滚恢复初始配置并自动备份当前配置');
/* 字段白黑名单导出：白名单∩页面列剔除黑名单 */
elVals = {}; chkMap = {};
const expRet = window.shPolicyExport('P-2026-001', 'datamgmt-card');
const p001 = policies.find('P-2026-001');
ok(expRet === true && p001.allowFields.indexOf('姓名') < 0 && p001.denyFields.indexOf('姓名') >= 0,
  '功能点20 字段白黑名单生效（黑名单字段姓名不参与导出）');
/* 策略启用/停用（查询口径） */
ok(policies.all().some(p => p.enabled === '是') && policies.all().some(p => p.enabled === '否'),
  '功能点20 策略启用/停用状态并存（查询条件可用）');

/* 功能点21 共享交付与令牌：批准申请生成交付 + 令牌状态机 + 拦截 */
elVals = { 'sh-d-apply': 'SHA-2026-0022', 'sh-d-policy': 'P-2026-001', 'sh-d-type': '文件下载', 'sh-d-fmt': 'CSV', 'sh-d-days': '30 天' };
window.shDeliverySubmit();
const nd = deliveries.all()[deliveries.all().length - 1];
ok(!!nd && nd.applyId === 'SHA-2026-0022' && nd.policyId === 'P-2026-001' && tokenState(nd) === '有效',
  '功能点21 从已批准申请按生效授权生成交付（令牌初始有效）');
ok(/^[0-9a-f]{32}$/.test(nd.token) && nd.tokenExpire && nd.recordCount > 0 && nd.sizeKb > 0 &&
   /^https:\/\//.test(nd.apiEndpoint) && /^SBX-/.test(nd.sandboxId) && /\/download$/.test(nd.downloadUrl),
  '功能点21 交付含 32 位访问令牌 / 有效期 / 记录数 / 大小KB / API端点 / 沙箱ID / 下载链接');
elVals = { 'sh-d-apply': 'SHA-2026-0031', 'sh-d-policy': 'P-2026-001', 'sh-d-type': '文件下载', 'sh-d-fmt': 'CSV', 'sh-d-days': '7 天' };
const dcnt = deliveries.all().length;
window.shDeliverySubmit();
ok(deliveries.all().length === dcnt, '功能点21 未批准申请无法生成交付（状态校验拦截）');
/* 过期令牌下载：拦截 + 自动写入高风险监控日志（种子 SHD-2026-0017 已过期） */
ok(tokenState(deliveries.find('SHD-2026-0017')) === '已过期', '功能点21 过期令牌实时判定为已过期');
const mcnt = monitors.all().length;
window.shDeliveryDownload('SHD-2026-0017');
ok(monitors.all().length === mcnt + 1 && monitors.all()[0].abnormal === '是' && monitors.all()[0].riskLevel === '高' &&
   monitors.all()[0].opType === '令牌验证失败' && (monitors.all()[0].handleStatus || '未处置') === '未处置',
  '功能点21 过期令牌下载被拦截并自动写入高风险未处置监控日志');
/* 有效令牌下载：真实生成脱敏 CSV 并写正常监控日志 */
elVals = { 'sh-d-apply': 'SHA-2026-0028', 'sh-d-policy': 'P-2026-002', 'sh-d-type': '文件下载', 'sh-d-fmt': 'CSV', 'sh-d-days': '7 天' };
window.shDeliverySubmit();
const nd2 = deliveries.all()[deliveries.all().length - 1];
const mcnt2 = monitors.all().length;
const dlRet = window.shDeliveryDownload(nd2.deliveryId);
ok(dlRet !== false && monitors.all().length === mcnt2 + 1 && monitors.all()[0].abnormal === '否' &&
   monitors.all()[0].opType === '下载' && monitors.all()[0].rowCount > 0,
  '功能点21 有效令牌下载脱敏数据并写入正常监控日志');

/* 功能点21 扩展：交付方式/接口地址配置/下载链接展示 + 凭证状态管理（吊销/筛选）+ 凭证查询 */
/* 自定义接口地址配置：数据接收方接口地址可配置，下载链接由接口地址派生 */
elVals = { 'sh-d-apply': 'SHA-2026-0022', 'sh-d-policy': 'P-2026-001', 'sh-d-type': '接口推送', 'sh-d-fmt': 'JSON',
  'sh-d-days': '7 天', 'sh-d-ep': 'https://recv.example-hosp.org/api/v1/receive' };
window.shDeliverySubmit();
const nd3 = deliveries.all()[deliveries.all().length - 1];
ok(nd3.apiEndpoint === 'https://recv.example-hosp.org/api/v1/receive' &&
   nd3.deliveryType === '接口推送' && /\/download$/.test(nd3.downloadUrl) && !!nd3.genTime,
  '功能点21 接口地址可配置（自定义接收方地址），下载链接由接口地址派生');
/* 交付列表展示：交付方式 / 接口地址 / 下载链接 / 凭证状态 / 吊销按钮 */
window.renderPage('sh-delivery');
ok(pc.innerHTML.indexOf('交付方式') >= 0 && pc.innerHTML.indexOf('接口地址 / 下载链接') >= 0 &&
   pc.innerHTML.indexOf('凭证状态') >= 0 && pc.innerHTML.indexOf(nd3.apiEndpoint) >= 0 &&
   pc.innerHTML.indexOf('/download') >= 0 && pc.innerHTML.indexOf('shDeliveryRevoke(') >= 0,
  '功能点21 交付列表展示交付方式/接口地址/下载链接/凭证状态并含吊销入口');
/* 凭证状态筛选：有效 / 已过期 / 已吊销 */
const totalD = deliveries.all().length;
window.shSetFilter('sh-delivery', 'st', '有效');
const effCnt = (pc.innerHTML.match(/shDeliveryDownload\(/g) || []).length;
ok(effCnt === deliveries.all().filter(d => tokenState(d) === '有效').length,
  '功能点21 凭证状态筛选-有效（' + effCnt + '/' + totalD + '）');
window.shSetFilter('sh-delivery', 'st', '已过期');
ok((pc.innerHTML.match(/shDeliveryDownload\(/g) || []).length === deliveries.all().filter(d => tokenState(d) === '已过期').length,
  '功能点21 凭证状态筛选-已过期');
window.shSetFilter('sh-delivery', 'st', '');
/* 主动吊销：有效令牌 → 已吊销（凭证失效），吊销后下载拦截并写高风险日志 */
const rvkTarget = nd2;
window.shDeliveryRevoke(rvkTarget.deliveryId);
const rvkAfter = deliveries.find(rvkTarget.deliveryId);
ok(tokenState(rvkAfter) === '已吊销' && rvkAfter.revokedTime !== '—',
  '功能点21 主动吊销访问令牌（凭证状态置为已吊销并记录吊销时间）');
const mcnt3 = monitors.all().length;
window.shDeliveryDownload(rvkTarget.deliveryId);
ok(monitors.all().length === mcnt3 + 1 && monitors.all()[0].opType === '令牌验证失败' && monitors.all()[0].riskLevel === '高',
  '功能点21 吊销后下载被拦截并写高风险监控日志');
/* 重复吊销拦截 */
const rvkCnt = deliveries.all().length;
window.shDeliveryRevoke(rvkTarget.deliveryId);
ok(tokenState(deliveries.find(rvkTarget.deliveryId)) === '已吊销' && rvkCnt === deliveries.all().length,
  '功能点21 已吊销令牌不可重复吊销');
/* 凭证查询：关键词命中接口地址 */
window.shSetFilter('sh-delivery', 'kw', 'recv.example-hosp.org');
ok((pc.innerHTML.match(/shDeliveryDownload\(/g) || []).length === 1,
  '功能点21 凭证查询按接口地址关键词检索');
window.shResetFilter('sh-delivery');

/* 功能点22 使用行为监控：标准字段（含处置闭环） + 模拟接入 + 处置/忽略 */
const m1 = monitors.all()[0];
ok(monitors.all().length >= 8 && !!('monitorId' in m1) && !!('deliveryId' in m1) && !!('userId' in m1) &&
   !!('ip' in m1) && !!('accessTime' in m1) && !!('opType' in m1) && !!('accessParams' in m1) &&
   !!('rowCount' in m1) && !!('abnormal' in m1) && !!('riskLevel' in m1) && !!('approvalId' in m1) && !!('remark' in m1) &&
   !!('handleStatus' in m1) && !!('handleBy' in m1) && !!('handleTime' in m1) && !!('handleNote' in m1),
  '功能点22 监控日志标准字段齐全（日志ID/交付ID/使用者/IP/时间/操作类型/参数/记录数/异常/风险/审批ID/备注/处置状态/处置人/处置时间/处置说明）');
ok(monitors.all().some(m => m.abnormal === '是' && m.riskLevel === '高') &&
   monitors.all().some(m => m.abnormal === '否') &&
   monitors.all().some(m => m.abnormal === '是' && m.handleStatus === '已处置' && m.handleBy !== '—'),
  '功能点22 含异常分级与种子处置留痕');
/* 模拟接入请求：异常时必须为未处置 */
window.shMonitorSim();
const sim = monitors.all()[0];
ok(!!sim.opType && (sim.abnormal === '是' ? (sim.handleStatus === '未处置') : (sim.handleStatus === '')),
  '功能点22 模拟接入请求生成访问日志（异常自动置未处置）');
/* 处置闭环 */
const pend = monitors.all().find(m => m.abnormal === '是' && (m.handleStatus || '未处置') === '未处置' && m.monitorId !== sim.monitorId);
elVals = { 'sh-f-hnote': '已封禁来源 IP 并函告机构核查' };
window.shMonitorHandleSubmit(pend.monitorId, 'handle');
const pendAfter = monitors.find(pend.monitorId);
ok(pendAfter.handleStatus === '已处置' && pendAfter.handleBy === '管理员' && pendAfter.handleTime !== '—' &&
   pendAfter.handleNote === '已封禁来源 IP 并函告机构核查', '功能点22 异常处置闭环（状态/处置人/时间/说明留痕）');
/* 忽略闭环 */
const pend2 = monitors.all().find(m => m.abnormal === '是' && (m.handleStatus || '未处置') === '未处置');
if (pend2) {
  elVals = { 'sh-f-hnote': '确认属策略口径内行为' };
  window.shMonitorHandleSubmit(pend2.monitorId, 'ignore');
  ok(monitors.find(pend2.monitorId).handleStatus === '已忽略', '功能点22 异常忽略闭环');
} else ok(true, '功能点22 异常忽略闭环（无可忽略样本时跳过）');
/* 时间查询：按起止日期过滤日志 */
window.shSetFilter('sh-monitor', 'd1', '2100-01-01');
window.renderPage('sh-monitor');
ok(pc.innerHTML.indexOf('MON-0032') < 0, '功能点22 支持按时间范围查询日志（开始日期过滤生效）');
window.shSetFilter('sh-monitor', 'd1', '2000-01-01');
window.renderPage('sh-monitor');
ok(pc.innerHTML.indexOf('MON-0032') >= 0, '功能点22 时间范围内的日志正常展示');
window.shResetFilter('sh-monitor');
/* 异常预警：未处置异常自动触发预警横幅，全部处置后解除 */
monitors.all().unshift({ monitorId: 'MON-9998', deliveryId: 'SHD-2026-0018', userId: '测试机构·预警用户', ip: '10.0.0.8',
  accessTime: '2026-01-01 08:00', opType: '批量拉取', accessParams: '{"pages":9}', rowCount: 9000,
  abnormal: '是', riskLevel: '高', approvalId: 'SHA-2026-0028', remark: '超出单次上限',
  handleStatus: '未处置', handleBy: '—', handleTime: '—', handleNote: '' });
monitors.save();
window.renderPage('sh-monitor');
ok(pc.innerHTML.indexOf('异常预警') >= 0 && pc.innerHTML.indexOf('MON-9998') >= 0,
  '功能点22 检测到未处置异常自动触发预警（页面预警横幅 + 预警详情可见）');
elVals = { 'sh-f-hnote': '已封禁来源 IP' };
window.shMonitorHandleSubmit('MON-9998', 'handle');
monitors.all().forEach(function (m) {
  if (m.abnormal === '是' && (m.handleStatus || '未处置') === '未处置') window.shMonitorHandleSubmit(m.monitorId, 'handle');
});
window.renderPage('sh-monitor');
ok(pc.innerHTML.indexOf('异常预警') < 0, '功能点22 异常全部处置后预警解除');
/* 导出使用行为监控日志（CSV） */
ok(typeof window.shMonExportDlg === 'function' && typeof window.shMonExport === 'function' &&
   pc.innerHTML.indexOf('shMonExportDlg') >= 0, '功能点22 提供监控日志导出入口（CSV）');
window.shMonExportDlg();
elVals = { 'sh-mex-scope': 'all' };
const monExpRet = window.shMonExport();
ok(monExpRet !== false, '功能点22 导出使用行为监控日志成功（CSV 真实下载并写审计）');

/* 功能点23 共享数据元数据血缘：标准字段 + 外键 + 补录 + 刷新 */
const l1 = lineages.all()[0];
ok(lineages.all().length >= 10 && !!('metaId' in l1) && !!('sourcePlatformId' in l1) && !!('sourcePlatform' in l1) &&
   !!('srcTable' in l1) && !!('fieldCn' in l1) && !!('fieldEn' in l1) && !!('fieldDesc' in l1) && !!('dataType' in l1) && !!('sensLevel' in l1) &&
   !!('isPii' in l1) && !!('maskRule' in l1) && !!('updateFreq' in l1) && !!('lineagePath' in l1) && !!('lastUpdate' in l1),
  '功能点23 血缘标准字段齐全（元数据ID/来源平台外键/原始表/中英文名/字段含义/类型/敏感等级/PII/脱敏规则/频率/血缘路径/最后更新）');
ok(lineages.all().every(l => !!platforms.find(l.sourcePlatformId)),
  '功能点23 血缘来源平台外键全部有效（sourcePlatformId → platform.accessId）');
ok(l1.lineagePath.indexOf('ODS') >= 0 && l1.lineagePath.indexOf('DWD') >= 0 && l1.lineagePath.indexOf('共享交付层') >= 0,
  '功能点23 血缘路径覆盖 来源平台 → ODS → DWD → DWS → 共享交付层');
/* 报告卡登记字段全覆盖（发病人口信息 20 + 肿瘤报告信息 19 + 随访报告信息 8） */
const rcFields = lineages.all().filter(l => l.srcTable === 'report_card');
ok(rcFields.length >= 45 &&
   ['姓名', '身份证号码', '联系电话', '户籍详细地址', '常住详细地址', 'TNM分期', '住院号', '门诊号', '报告医师', '死亡报告医师', '最后接触状态']
     .every(cn => rcFields.some(l => l.fieldCn === cn)),
  '功能点23 报告卡登记字段全部列入血缘元数据（发病人口/肿瘤报告/随访报告）');
ok(rcFields.every(l => l.isPii !== '是' || l.maskRule !== '不适用'),
  '功能点23 报告卡 PII 字段均配置脱敏规则');
/* 字段含义记录：全部种子元数据均带字段定义 */
ok(lineages.all().every(l => l.fieldDesc && l.fieldDesc !== '—'),
  '功能点23 全部种子元数据含字段含义（fieldDesc，如「临床分期」= 临床分期Ⅰ~Ⅳ期）');
ok(rcFields.find(l => l.fieldCn === '临床分期').fieldDesc.indexOf('临床分期') >= 0 &&
   rcFields.find(l => l.fieldCn === '身份证号码').fieldDesc.indexOf('身份证') >= 0,
  '功能点23 字段含义与字段业务定义一致（临床分期 / 身份证号码）');
/* 补录字段元数据（字段含义 + 路径留空自动生成） */
elVals = { 'sh-l-pid': 'ACC-001', 'sh-l-table': 'lab_result', 'sh-l-cn': '病理结论', 'sh-l-en': 'pathology_conclusion',
  'sh-l-desc': '病理组织学确诊结论', 'sh-l-dt': 'STRING', 'sh-l-sev': 'L3 敏感', 'sh-l-pii': '否', 'sh-l-rule': '不适用', 'sh-l-freq': '每日', 'sh-l-path': '' };
window.shLineageSubmit('');
const nl = lineages.all().find(l => l.fieldCn === '病理结论');
ok(!!nl && nl.sourcePlatformId === 'ACC-001' && nl.sourcePlatform === '国家癌症中心肿瘤登记平台' &&
   nl.fieldDesc === '病理组织学确诊结论' && /ODS\.ods_lab_result/.test(nl.lineagePath),
  '功能点23 补录字段元数据（外键选择平台 + 字段定义，血缘路径自动生成）');
/* 编辑字段元数据：更新字段含义 */
elVals = { 'sh-l-pid': 'ACC-001', 'sh-l-table': 'lab_result', 'sh-l-cn': '病理结论',
  'sh-l-desc': '病理检查组织学确诊结论（含分级）', 'sh-l-dt': 'STRING', 'sh-l-sev': 'L3 敏感',
  'sh-l-pii': '否', 'sh-l-rule': '不适用', 'sh-l-freq': '每日', 'sh-l-path': nl.lineagePath };
window.shLineageSubmit(nl.metaId);
ok(lineages.find(nl.metaId).fieldDesc === '病理检查组织学确诊结论（含分级）',
  '功能点23 编辑字段元数据可更新字段含义');
/* 元数据详情查询：字段定义 / 来源 / 完整血缘路径 */
(function () {
  const created = []; const origCreate = document.createElement;
  document.createElement = function (tag) { const e = origCreate(tag); created.push(e); return e; };
  window.shLineageDetail(nl.metaId);
  document.createElement = origCreate;
  const box = created[created.length - 1];
  ok(!!box && box.innerHTML.indexOf('字段含义') >= 0 && box.innerHTML.indexOf('病理检查组织学确诊结论') >= 0 &&
     box.innerHTML.indexOf('国家癌症中心肿瘤登记平台') >= 0 && box.innerHTML.indexOf('ODS.ods_lab_result') >= 0 &&
     box.innerHTML.indexOf('数据血缘路径') >= 0,
    '功能点23 元数据详情查询（弹窗展示字段定义 / 来源平台 / 完整血缘路径）');
})();
/* 元数据导出：表格（CSV）与 JSON */
(function () {
  const created = []; const blobs = [];
  const origCreate = document.createElement; const origBlob = global.Blob;
  document.createElement = function (tag) { const e = origCreate(tag); created.push(e); return e; };
  global.Blob = function (parts) { blobs.push(parts); this.parts = parts; };
  window.shLineageExport('csv');
  window.shLineageExport('json');
  document.createElement = origCreate; global.Blob = origBlob;
  const a = created.filter(x => x.download).pop();
  ok(!!a && /^共享数据元数据目录_\d{8}\.(csv|json)$/.test(a.download),
    '功能点23 元数据目录导出（下载文件名：共享数据元数据目录_日期.扩展名）');
  const csvText = String(blobs[blobs.length - 2][0] || '');
  const csvLines = csvText.replace(/^\ufeff/, '').split('\r\n');
  ok(csvText.indexOf('\ufeff') === 0 && csvLines[0].indexOf('元数据ID,字段名,英文标识,字段含义') === 0 &&
     csvLines.length === lineages.all().length + 1,
    '功能点23 导出 CSV（Excel 兼容 BOM + 含字段含义表头 + 行数=元数据数+表头）');
  let jsonOk = false;
  try {
    const j = JSON.parse(String(blobs[blobs.length - 1][0]));
    jsonOk = j.exportType === '共享数据内容元数据目录' && j.total === lineages.all().length &&
      Array.isArray(j.records) && j.records.length === j.total && 'fieldDesc' in j.records[0] &&
      'sourcePlatformId' in j.records[0] && 'lineagePath' in j.records[0];
  } catch (e) {}
  ok(jsonOk, '功能点23 导出 JSON（exportType/total/records，字段定义与血缘路径完整）');
})();
/* 血缘路径最短展示 + 详情 / 导出操作入口 */
window.renderPage('sh-lineage');
ok(pc.innerHTML.indexOf('ODS → DWD → DWS → 共享交付层') >= 0 && pc.innerHTML.indexOf('shLineageRefresh') < 0,
  '功能点23 血缘路径以最短形式展示');
ok(pc.innerHTML.indexOf('shLineageDetail') >= 0 && pc.innerHTML.indexOf('导出 CSV') >= 0 &&
   pc.innerHTML.indexOf('导出 JSON') >= 0 && pc.innerHTML.indexOf('shLineageExport') >= 0,
  '功能点23 元数据列表提供详情查询与 CSV/JSON 导出入口');

/* 共享操作审计：全部写操作留痕 */
ok(trails.all().length >= 15, '共享操作审计已记录全部写操作（种子 + 运行期）');
const auditOps = trails.all().map(l => l.opType);
ok(['审批', '交付', '下载', '导出', '撤销', '处置', '编辑', '新增', '启停', '设置'].every(t => auditOps.indexOf(t) >= 0),
  '审计覆盖 审批/交付/下载/导出/撤销/处置/编辑/新增/启停/设置 操作类型');
ok(trails.all().every(l => l.logId && l.relatedId && l.operator && l.time && l.terminal),
  '审计记录含 日志ID/关联对象/操作人/时间/终端 基础字段');

/* 页面渲染 + 全页面开发话术扫描 */
const pages = ['sh-platform', 'sh-apply', 'sh-policy', 'sh-delivery', 'sh-monitor', 'sh-lineage', 'sh-trail'];
let allHtml = '';
pages.forEach(id => { window.renderPage(id); allHtml += pc.innerHTML; ok(pc.innerHTML.indexOf('panel-header') >= 0 && pc.innerHTML.length > 500, '页面渲染 ' + id); });
ok(allHtml.indexOf('本次新建') < 0 && allHtml.indexOf('本次补齐') < 0 && allHtml.indexOf('对照结论') < 0 && allHtml.indexOf('（功能点') < 0, '全部页面无开发话术残留（sh）');

/* 数据持久化 */
ok(mem['jx.sh.apply.v1'] && JSON.parse(mem['jx.sh.apply.v1']).some(a => a.applyId === newApply.applyId), '模块数据 localStorage 持久化（jx.sh.*.v1）');
ok(mem['jx.sh.trail.v1'] && JSON.parse(mem['jx.sh.trail.v1']).length > 0, '审计数据 localStorage 持久化（jx.sh.trail.v1）');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
