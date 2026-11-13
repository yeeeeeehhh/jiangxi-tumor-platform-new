/* ============================================================================
 * diagnosis-qc.js — 确诊病例质控 · 渲染层（window.CQ）
 *
 * 单页 4 页签：主数据 / 审核流程 / 规则与修复 / 生命周期分析
 * 隐藏详情页：cq-case|<主数据ID>（菜单不占位，参照 qc-pf-case 模式）
 *
 * 32 个功能点入口：
 *   页签① 主数据 A1 接收 / A2 补随访 / A3 批量校验 / A4 质量评分(详情页) /
 *          A5 查询详情 / A6 导出待质控 / A7 ICD 有效性校验 / A8 版本更新(详情页修正)
 *   页签② 审核 B1 启动 / B2 提交意见 / B3 历史轨迹(详情页+弹窗) /
 *          B4 进度图 / B5 查询当前状态 / B6 查询历史记录 / B7 导出快照 / B8 终止
 *   页签③ 规则 C1 新增 / C2 修改 / C3 启停 / C4 执行结果统计 / C5 异常详情 /
 *          C6 修复记录明细 / C7 导出配置清单 / C8 标记需重新审核
 *   页签④ 生命周期 D1 更新状态 / D2 归档 / D3 删除 / D4 趋势图 /
 *          D5 生命周期快照(详情页) / D6 问题来源分布 / D7 导出日志 / D8 标记需整改
 * ========================================================================== */
(function () {
  'use strict';

  var D = window.CQD, U = window.qcUI, E = D.esc;

  /* ==================== 样式（cq- 前缀） ==================== */
  var CSS = [
    '#pageContainer .cq-page{min-width:0}',
    '#pageContainer .cq-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '#pageContainer .cq-bar .acts{display:flex;gap:8px;flex-wrap:wrap}',
    /* 启停开关 */
    /* 启停开关：input 覆盖在轨道上保持原生可点击（不能用 opacity:0;width:0 藏掉，
       Playwright/辅助技术都定位不到；label 包住整块，点轨道任意位置都能切换）。 */
    '#pageContainer .cq-switch{position:relative;display:inline-block;width:38px;height:20px;flex:none;vertical-align:middle;cursor:pointer}',
    '#pageContainer .cq-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:2}',
    '#pageContainer .cq-switch i{position:absolute;inset:0;background:#cbd5e1;border-radius:20px;transition:.2s;pointer-events:none}',
    '#pageContainer .cq-switch i:before{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s}',
    '#pageContainer .cq-switch input:checked+i{background:var(--primary)}',
    '#pageContainer .cq-switch input:checked+i:before{transform:translateX(18px)}',
    /* 审核进度 steps */
    '#pageContainer .cq-steps{display:flex;gap:0;align-items:flex-start;margin:4px 0 6px}',
    '#pageContainer .cq-step{flex:1;position:relative;text-align:center;min-width:0}',
    '#pageContainer .cq-step .dot{width:30px;height:30px;line-height:30px;margin:0 auto 8px;border-radius:50%;background:#eef2f7;color:#94a3b8;font-size:13px;font-weight:700;position:relative;z-index:2}',
    '#pageContainer .cq-step:not(:last-child):after{content:"";position:absolute;top:15px;left:50%;width:100%;height:2px;background:#e6edf5;z-index:1}',
    '#pageContainer .cq-step.ok:not(:last-child):after{background:#3f8f4a}',
    '#pageContainer .cq-step.ok .dot{background:#eaf7ec;color:#2b6b34}',
    '#pageContainer .cq-step.cur .dot{background:#e8f2ff;color:#244765;box-shadow:0 0 0 3px rgba(36,71,101,.1)}',
    '#pageContainer .cq-step.bad .dot{background:#fdecef;color:#b42335}',
    '#pageContainer .cq-step .t{font-size:13px;font-weight:600;color:#334155}',
    '#pageContainer .cq-step .s{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.5}',
    /* 评分明细 */
    '#pageContainer .cq-score-item{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #eef2f7;font-size:12.5px;color:#475569}',
    '#pageContainer .cq-score-item:last-child{border-bottom:0}',
    '#pageContainer .cq-score-item b{color:#182230}',
    /* 异常/问题条目 */
    '#pageContainer .cq-prob{border:1px solid #f1d7db;background:#fffafb;border-radius:6px;padding:9px 11px;margin-bottom:8px}',
    '#pageContainer .cq-prob .h{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:600;color:#9f2f42}',
    '#pageContainer .cq-prob .d{font-size:12px;color:#475569;margin-top:4px;line-height:1.6}',
    '#pageContainer .cq-prob .f{font-size:11.5px;color:#94a3b8;margin-top:5px}',
    /* 弹窗表单 */
    '#pageContainer .cq-form{display:grid;gap:10px;font-size:13px;color:#334155}',
    '#pageContainer .cq-form label{display:block;font-size:12px;color:#667085;font-weight:600;margin-bottom:4px}',
    '#pageContainer .cq-form input[type=text],#pageContainer .cq-form input[type=date],#pageContainer .cq-form input[type=number],#pageContainer .cq-form select,#pageContainer .cq-form textarea{width:100%;padding:7px 9px;border:1px solid #d1d8e0;border-radius:5px;font-size:13px;color:#1f2937;font-family:inherit;box-sizing:border-box}',
    '#pageContainer .cq-form textarea{min-height:64px;resize:vertical}',
    '#pageContainer .cq-form .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#pageContainer .cq-form .ck{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#334155}',
    '#pageContainer .cq-form .ck input{width:auto}',
    '#pageContainer .cq-hint{font-size:11.5px;color:#94a3b8;line-height:1.6;margin-top:2px}',
    /* 详情小工具条 */
    '#pageContainer .cq-detail-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
    /* 修复记录条 */
    '#pageContainer .cq-fixlog{border-left:2px solid #e6edf5;padding:2px 0 2px 12px;margin:8px 0;font-size:12px;color:#475569;line-height:1.9}',
    '#pageContainer .cq-fixlog b{color:#1f2937}',
    /* 筛选条：5 个字段时按钮组容易被 grid 挤到容器右缘之外（视口 1280 边界
       尤其明显）。把按钮组固定为独立一行并右对齐，任何字段数下都稳定可见可点。 */
    '#pageContainer .cq-page .qc-filter{grid-template-columns:repeat(var(--qc-fcols,4),minmax(0,1fr));row-gap:10px}',
    '#pageContainer .cq-page .qc-filter .acts{grid-column:1/-1;justify-content:flex-start;align-self:end;height:34px;width:auto;max-width:100%}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ==================== 状态 ==================== */
  var ST = {
    tab: '主数据',
    page: { main: 1, queue: 1, rule: 1, prob: 1, log: 1 },
    filter: { source: '全部', follow: '全部', audit: '全部', state: '全部', kw: '' },
    queueState: '全部',
    ruleFilter: { enabled: '全部', type: '全部', kw: '' },
    detailId: ''
  };
  var PER = 10;

  function refresh() { window.renderPage(ST.tab === 'DETAIL' ? 'cq-case|' + ST.detailId : 'cq-workbench'); }
  function ok(res) { U.toast(res.msg || '操作成功', res.ok ? 'success' : 'error'); if (res.ok) refresh(); }
  function toast(msg, bad) { U.toast(msg, bad ? 'error' : 'success'); }

  /* ==================== 通用小组件 ==================== */
  function tabs() {
    var list = [['主数据', '主数据台账'], ['审核流程', '确诊审核流程'], ['规则与修复', '质控规则与修复跟踪'], ['生命周期分析', '病例生命周期']];
    return '<div class="qc-tabs">' + list.map(function (t) {
      return '<button class="' + (ST.tab === t[0] ? 'on' : '') + '" data-qc="cq:tab:' + t[0] + '">' + t[0] + '</button>';
    }).join('') + '</div>';
  }
  function head(sub) {
    return U.head('确诊病例质控', sub, '', false,
      '<button class="btn btn-ghost btn-sm" data-qc="cq:reset">重置演示数据</button>');
  }
  function qcStateBadge(s) {
    var m = { '待质控': 'caution', '质控中': 'info', '已修正': 'accent', '已归档': 'success', '已删除': 'neutral' };
    return U.badge(s, m[s] || 'neutral');
  }
  function auditBadge(s) {
    var m = { '未启动': 'neutral', '待初审': 'caution', '待复审': 'accent', '已退回': 'danger', '已通过': 'success', '已终止': 'neutral' };
    return U.badge(s, m[s] || 'neutral');
  }
  function followBadge(s) {
    if (!s) return U.badge('缺失', 'danger');
    var m = { '在访(存活)': 'success', '失访': 'caution', '死亡': 'danger', '移居迁出': 'info', '未知': 'neutral' };
    return U.badge(s, m[s] || 'neutral');
  }
  function switchHtml(id, on) {
    return '<label class="cq-switch"><input type="checkbox" data-cqrule="' + E(id) + '"' + (on ? ' checked' : '') + '><i></i></label>';
  }
  function formRow(label, inner) { return '<div><label>' + label + '</label>' + inner + '</div>'; }
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      /* 支持 [value,label] 二元组、{v,l} 对象、纯字符串三种形式 */
      var v, l;
      if (Array.isArray(o)) { v = o[0]; l = o[1]; }
      else if (o && typeof o === 'object') { v = o.v; l = o.l; }
      else { v = o; l = o; }
      return '<option value="' + E(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>';
    }).join('') + '</select>';
  }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function closeModal() { if (U.closeModal) U.closeModal(); }

  /* ==================== 页签① 主数据 ==================== */
  function filteredCases() {
    var f = ST.filter;
    return D.activeCases().filter(function (c) {
      if (f.source !== '全部' && c.source !== f.source) return false;
      if (f.follow !== '全部' && (c.followStatus || '缺失') !== f.follow) return false;
      if (f.audit !== '全部' && c.audit.state !== f.audit) return false;
      if (f.state !== '全部' && c.qcState !== f.state) return false;
      if (f.kw) {
        var hay = [c.id, c.patientId, c.name, c.siteName, c.pathName, c.icd10, c.icdO3, c.orgName].join(' ');
        if (hay.indexOf(f.kw) < 0) return false;
      }
      return true;
    });
  }
  /* 自建筛选条：不用 U.filterBar 的 filter:apply:<key> 动作名——
     qc-performance.js / qc-l1.js / qc-mdt.js 都有「filter: 开头一律接管」的
     全局代理，会把本页筛选抢走并重绘成它们的页面。沿用 .qc-filter 样式类名，
     动作改用模块私有的 cq:filter:* 前缀，彻底避开命名空间冲突。 */
  function filterBar(fields, key) {
    var html = fields.map(function (f) {
      if (f.type === 'select') {
        var opts = (f.options || []).map(function (o) {
          var v, l;
          if (Array.isArray(o)) { v = o[0]; l = o[1]; }
          else if (o && typeof o === 'object') { v = o.v; l = o.l; }
          else { v = o; l = o; }
          return '<option value="' + E(v) + '"' + (String(f.value) === String(v) ? ' selected' : '') + '>' + E(l) + '</option>';
        }).join('');
        return '<div class="fg"><label>' + E(f.label) + '</label><select data-qcf="' + E(f.key) + '">' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + E(f.label) + '</label><input type="text" data-qcf="' + E(f.key) +
        '" value="' + E(f.value || '') + '" placeholder="' + E(f.ph || '') + '"></div>';
    }).join('');
    return '<div class="qc-filter" style="--qc-fcols:' + Math.max(1, fields.length) + '">' + html +
      '<div class="acts">' +
      '<button class="btn btn-ghost btn-sm" data-qc="cq:filter:reset:' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="cq:filter:apply:' + key + '">查询</button>' +
      '</div></div>';
  }
  function readFilter() {
    var box = document.getElementById('pageContainer');
    if (!box) return {};
    var o = {};
    var els = box.querySelectorAll('[data-qcf]');
    for (var i = 0; i < els.length; i++) o[els[i].getAttribute('data-qcf')] = String(els[i].value || '').trim();
    return o;
  }
  function applyFilter() {
    var v = readFilter();
    ST.filter = { source: v.source || '全部', follow: v.follow || '全部', audit: v.audit || '全部', state: v.state || '全部', kw: v.kw || '' };
    ST.page.main = 1; refresh();
  }
  function resetFilter() { ST.filter = { source: '全部', follow: '全部', audit: '全部', state: '全部', kw: '' }; ST.page.main = 1; refresh(); }

  function renderMain() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '待质控', v: s.wait, unit: '条', tone: 'warn', m: '等待校验与审核', action: 'cq:main:state:待质控' },
      { l: '质控中', v: s.doing, unit: '条', tone: 'info', m: '审核流程在途', action: 'cq:main:state:质控中' },
      { l: '已归档', v: s.archived, unit: '条', tone: 'up', m: '审核通过并归档', action: 'cq:main:state:已归档' },
      { l: '平均质量评分', v: s.avgScore.toFixed(1), unit: '分', tone: s.avgScore >= 85 ? 'up' : 'warn', m: '完整性+规范+逻辑' },
      { l: 'ICD 编码异常', v: s.badIcd, unit: '项', tone: 'bad', m: '部位/形态学编码无效或缺失', action: 'cq:tab:规则与修复' },
      { l: '待修复异常', v: s.openProblems, unit: '条', tone: 'bad', m: '规则命中未闭环', action: 'cq:tab:规则与修复' }
    ], 6);

    var f = ST.filter;
    var filter = filterBar([
      { key: 'source', label: '数据来源', type: 'select', value: f.source, options: ['全部'].concat(D.SOURCES) },
      { key: 'follow', label: '随访状态', type: 'select', value: f.follow, options: ['全部', '缺失'].concat(D.FOLLOW) },
      { key: 'audit', label: '审核状态', type: 'select', value: f.audit, options: ['全部'].concat(D.AUDIT_STATES) },
      { key: 'state', label: '处理状态', type: 'select', value: f.state, options: ['全部'].concat(D.QC_STATES.filter(function (x) { return x !== '已删除'; })) },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '主数据ID / 患者ID / 姓名 / 编码' }
    ], 'cq');

    var acts = '<div class="cq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="cq:receive">接收主数据</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="cq:check">批量校验（必填+ICD+逻辑）</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="cq:export:wait">导出待质控列表</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="cq:export:badicd">导出无效编码清单</button>' +
      '</div><span class="cq-hint">共 ' + D.activeCases().length + ' 条在库主数据 · 已逻辑删除 ' + s.deleted + ' 条不参与日常质控</span></div>';

    var list = filteredCases();
    var pg = U.slice(list, ST.page.main, PER);
    var rows = pg.rows.map(function (c) {
      var v10 = D.validateIcd10(c.icd10, c.siteName), v3 = D.validateIcdO3(c.icdO3, c.pathName);
      var icdCell = (v10.ok ? '<span class="badge badge-success">' + E(c.icd10) + '</span>' : '<span class="badge badge-danger" title="' + E(v10.reason) + '">' + E(c.icd10 || '缺失') + '</span>') +
        ' / ' + (v3.ok ? '<span class="badge badge-success">' + E(c.icdO3) + '</span>' : '<span class="badge badge-danger" title="' + E(v3.reason) + '">' + E(c.icdO3 || '缺失') + '</span>');
      var ops = U.link('详情', 'cq:detail:' + c.id) + ' ' +
        U.link('补随访', 'cq:follow:' + c.id) + ' ' +
        U.link('状态', 'cq:state:' + c.id) + ' ' +
        (c.audit.state === '未启动' || c.audit.state === '已退回' ? U.link(c.audit.state === '已退回' ? '重新提交' : '启动审核', c.audit.state === '已退回' ? 'cq:resubmit:' + c.id : 'cq:audit:start:' + c.id) : '') + ' ' +
        (c.qcState !== '已归档' && c.audit.state === '已通过' ? U.link('归档', 'cq:archive:' + c.id) : '') + ' ' +
        U.link('整改', 'cq:rectify:' + c.id) + ' ' +
        U.link('删除', 'cq:delete:' + c.id);
      return {
        cells: [
          { h: '<code>' + E(c.id) + '</code>' + (c.reaudit ? ' <span class="badge badge-warning">待重新审核</span>' : ''), cls: 'txt' },
          { h: E(c.patientId) + '<br><span style="color:#94a3b8;font-size:11px">' + E(c.name) + '</span>', cls: 'txt' },
          { h: E(c.diagDate), cls: 'num' },
          { h: E(c.siteName) + '<br><span style="color:#94a3b8;font-size:11px">' + E(c.pathName) + '</span>', cls: 'txt' },
          { h: icdCell, cls: 'txt' },
          { h: E(c.sex) + ' / ' + E(c.age) + '岁', cls: 'txt' },
          { h: followBadge(c.followStatus), cls: 'center' },
          { h: '<b style="color:' + (c.score >= 85 ? '#2e7d32' : c.score >= 70 ? '#b54708' : '#b42335') + '">' + c.score + '</b>', cls: 'num' },
          { h: auditBadge(c.audit.state), cls: 'center' },
          { h: qcStateBadge(c.qcState), cls: 'center' },
          { h: 'v' + c.ver, cls: 'num' },
          { h: ops, cls: 'act' }
        ],
        cls: c.rectify && c.rectify.flag ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['主数据ID', '患者ID', '#诊断日期', '部位/病理', 'ICD-10 / ICD-O-3', '性别/年龄', '随访状态', '#质量评分', '审核状态', '处理状态', '#版本', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的主数据' });

    return '<div class="cq-page">' + head('病例主数据台账 · 质控任务的基础输入') + tabs() + kpi + acts + filter +
      U.card('', table + U.pager(list.length, ST.page.main, PER, 'cqcase')) +
      U.note('质量评分 = 完整性 40 分（8 个关键字段）+ 编码规范性 30 分（ICD-10 / ICD-O-3）+ 逻辑一致性 30 分（年龄、死亡日期、随访状态互证）。评分随主数据修正实时重算，版本历史在病例详情页查看。') +
      '</div>';
  }

  /* ==================== 页签② 审核流程 ==================== */
  function renderQueue() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '待初审', v: s.first, unit: '例', tone: 'warn', m: '登记站初审员待办', action: 'cq:queue:state:待初审' },
      { l: '待复审', v: s.second, unit: '例', tone: 'info', m: '质控中心复审待办', action: 'cq:queue:state:待复审' },
      { l: '已通过', v: s.passed, unit: '例', tone: 'up', m: '两级审核完成', action: 'cq:queue:state:已通过' },
      { l: '已退回', v: s.rejected, unit: '例', tone: 'bad', m: '退回整改可重新提交', action: 'cq:queue:state:已退回' },
      { l: '已终止', v: s.terminated, unit: '例', tone: 'info', m: '异常流程强制终止', action: 'cq:queue:state:已终止' },
      { l: '审核超时', v: s.overdue, unit: '例', tone: 'bad', m: '已超过审核截止时间' }
    ], 6);

    var q = D.auditQueue();
    if (ST.queueState !== '全部') q = q.filter(function (c) { return c.audit.state === ST.queueState; });
    var tabs2 = ['全部'].concat(D.AUDIT_STATES.filter(function (x) { return x !== '未启动'; }));
    var stateTabs = '<div class="qc-tabs">' + tabs2.map(function (x) {
      var n = x === '全部' ? D.auditQueue().length : D.auditQueue().filter(function (c) { return c.audit.state === x; }).length;
      return '<button class="' + (ST.queueState === x ? 'on' : '') + '" data-qc="cq:queue:state:' + x + '">' + x + '（' + n + '）</button>';
    }).join('') + '</div>';

    var pg = U.slice(q, ST.page.queue, PER);
    var rows = pg.rows.map(function (c) {
      var a = c.audit, over = D.isOverdue(c);
      var ops = (a.state === '待初审' || a.state === '待复审' ? U.link('提交意见', 'cq:opinion:' + c.id) + ' ' + U.link('终止', 'cq:terminate:' + c.id) : '') +
        (a.state === '已退回' ? U.link('重新提交', 'cq:resubmit:' + c.id) : '') + ' ' +
        U.link('进度图', 'cq:progress:' + c.id) + ' ' + U.link('历史', 'cq:history:' + c.id) + ' ' +
        U.link('导出快照', 'cq:snapshot:' + c.id) + ' ' + U.link('病例详情', 'cq:detail:' + c.id);
      return {
        cells: [
          { h: '<code>' + E(c.id) + '</code><br><span style="color:#94a3b8;font-size:11px">' + E(c.name) + ' · ' + E(c.patientId) + '</span>', cls: 'txt' },
          { h: auditBadge(a.state), cls: 'center' },
          { h: E(a.level || '—'), cls: 'center' },
          { h: E(a.role || '—'), cls: 'txt' },
          { h: E(a.assignee || '—'), cls: 'txt' },
          { h: E(a.assignAt || '—'), cls: 'num' },
          { h: over ? '<span style="color:#b42335;font-weight:600">' + E(a.deadline) + '</span>' : E(a.deadline || '—'), cls: 'num' },
          { h: (a.opinions || []).length + ' 条', cls: 'num' },
          { h: ops, cls: 'act' }
        ],
        cls: over ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['病例', '当前审核状态', '当前层级', '审核角色', '当前审核人', '#分配时间', '#审核截止时间', '#历史记录', '操作'],
      rows, { compact: true, fit: true, empty: '该状态下暂无审核流程' });

    return '<div class="cq-page">' + head('确诊审核流程 · 两级审核（初审 → 复审）') + tabs() + kpi +
      '<div class="cq-bar"><span class="cq-hint">流程：待初审 →（通过）待复审 →（通过）已通过；任一级可退回整改，已退回可重新提交；管理员可强制终止异常流程。每次操作均写入审核轨迹与生命周期日志。</span></div>' +
      U.card('', stateTabs + table + U.pager(q.length, ST.page.queue, PER, 'cqqueue')) +
      '</div>';
  }

  /* ==================== 页签③ 规则与修复 ==================== */
  function renderRules() {
    var rules = D.rules();
    var s = D.stats();
    var allProbs = D.problems();
    var fixed = allProbs.filter(function (p) { return p.status === '已修复'; }).length;
    var kpi = U.kpis([
      { l: '启用规则', v: rules.filter(function (r) { return r.enabled; }).length, unit: '条', tone: 'info', m: '共 ' + rules.length + ' 条已配置' },
      { l: '累计触发', v: allProbs.length, unit: '次', tone: 'warn', m: '规则命中异常记录' },
      { l: '待修复', v: s.openProblems, unit: '条', tone: 'bad', m: '异常尚未闭环' },
      { l: '修复率', v: allProbs.length ? (fixed / allProbs.length * 100).toFixed(1) : '0.0', unit: '%', tone: 'up', m: fixed + ' / ' + allProbs.length + ' 已修复' },
      { l: '需重新审核', v: s.reaudit, unit: '例', tone: 'warn', m: '修复后自动标记' },
      { l: 'ICD 编码异常', v: s.badIcd, unit: '项', tone: 'bad', m: '编码规范类规则命中' }
    ], 6);

    var chartData = rules.map(function (r) {
      var st2 = D.ruleStats(r.id);
      return { l: r.id.replace('CQR-', 'R'), v: st2.hits, color: r.enabled ? '#3d5a80' : '#cbd5e1' };
    });
    var chartCard = U.card('规则执行结果统计（C4）', U.barChart(chartData, { unit: '次', height: 170 }) +
      U.note('按规则 ID 统计累计触发次数、待修复数与修复率；停用规则以灰色显示，不再参与新校验。'), '', '<button class="btn btn-ghost btn-sm" data-qc="cq:rule:export">导出规则配置清单</button>');

    var rf = ST.ruleFilter;
    var rlist = rules.filter(function (r) {
      if (rf.enabled !== '全部' && (r.enabled ? '启用' : '停用') !== rf.enabled) return false;
      if (rf.type !== '全部' && r.type !== rf.type) return false;
      if (rf.kw && (r.name + r.id + r.cond).indexOf(rf.kw) < 0) return false;
      return true;
    });
    var filter = filterBar([
      { key: 'renabled', label: '启用状态', type: 'select', value: rf.enabled, options: ['全部', '启用', '停用'] },
      { key: 'rtype', label: '规则类型', type: 'select', value: rf.type, options: ['全部'].concat(D.RULE_TYPES) },
      { key: 'rkw', label: '关键字', type: 'text', value: rf.kw, ph: '规则名称 / 编号 / 校验条件' }
    ], 'cqr');

    var pg = U.slice(rlist, ST.page.rule, PER);
    var rows = pg.rows.map(function (r) {
      var st2 = D.ruleStats(r.id);
      var ops = U.link('异常详情', 'cq:rule:detail:' + r.id) + ' ' + U.link('编辑', 'cq:rule:edit:' + r.id) + ' ' +
        U.link('修复记录', 'cq:rule:fixlog:' + r.id) + ' ' + U.link('删除', 'cq:rule:delete:' + r.id);
      return {
        cells: [
          { h: '<code>' + E(r.id) + '</code>', cls: 'txt' },
          { h: E(r.name), cls: 'txt' },
          { h: E(r.type), cls: 'center' },
          { h: E(r.scope), cls: 'txt' },
          { h: '<span style="font-size:11.5px">' + E(r.cond) + '</span>', cls: 'txt' },
          { h: U.badge(r.severity, r.severity === '强拦截' ? 'danger' : r.severity === '提示' ? 'caution' : 'neutral'), cls: 'center' },
          { h: st2.hits + ' / 待修复 ' + st2.open, cls: 'num' },
          { h: st2.fixRate.toFixed(1) + '%', cls: 'num' },
          { h: switchHtml(r.id, r.enabled), cls: 'center' },
          { h: ops, cls: 'act' }
        ]
      };
    });
    var table = U.table(
      ['规则ID', '规则名称', '规则类型', '适用数据类型', '校验条件', '错误等级', '#触发/待修复', '#修复率', '启用状态', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的规则' });

    /* 修复记录明细（C6）：全量已修复异常 */
    var fixedList = allProbs.filter(function (p) { return p.status === '已修复'; });
    var fpg = U.slice(fixedList, ST.page.prob, PER);
    var frows = fpg.rows.map(function (p) {
      var c = D.caseById(p.caseId);
      var r = D.ruleById(p.ruleId);
      return { cells: [
        { h: '<code>' + E(p.id) + '</code>', cls: 'txt' },
        { h: E(r ? r.name : p.ruleId), cls: 'txt' },
        { h: E(p.caseId) + (c ? '（' + E(c.name) + '）' : ''), cls: 'txt' },
        { h: E(p.field) + '：' + E(p.value || '空'), cls: 'txt' },
        { h: E(p.fixContent), cls: 'txt' },
        { h: E(p.fixer), cls: 'txt' },
        { h: E(p.fixAt), cls: 'num' },
        { h: p.reaudit ? '<span class="badge badge-warning">是</span>' : '<span class="badge badge-muted">否</span>', cls: 'center' },
        { h: U.badge('已修复', 'success'), cls: 'center' }
      ] };
    });
    var ftable = U.table(
      ['异常ID', '触发规则', '关联病例', '异常字段/值', '修复内容', '修复人', '#修复时间', '重新审核', '状态'],
      frows, { compact: true, fit: true, empty: '暂无修复记录' });

    return '<div class="cq-page">' + head('质控规则与修复跟踪 · 判（规则）→ 看（异常）→ 改（修复）') + tabs() + kpi +
      '<div class="cq-bar"><div class="acts"><button class="btn btn-primary btn-sm" data-qc="cq:rule:add">+ 配置新增质控规则</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="cq:check">重跑全部校验</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="cq:rule:export">导出规则配置清单</button></div></div>' +
      chartCard + filter +
      U.card('规则配置清单（C1/C2/C3）', table + U.pager(rlist.length, ST.page.rule, PER, 'cqrule')) +
      U.card('修复记录明细（C6）', ftable + U.pager(fixedList.length, ST.page.prob, PER, 'cqprob')) +
      '</div>';
  }

  /* ==================== 页签④ 生命周期分析 ==================== */
  function renderLifecycle() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '在库病例', v: s.total, unit: '例', tone: 'info', m: '不含逻辑删除' },
      { l: '已归档', v: s.archived, unit: '例', tone: 'up', m: '通过审核且无问题' },
      { l: '已修正', v: s.fixed, unit: '例', tone: 'accent', m: '待重新审核/归档' },
      { l: '需整改', v: D.activeCases().filter(function (c) { return c.rectify && c.rectify.flag; }).length, unit: '例', tone: 'bad', m: '指派责任人限期处理' },
      { l: '已删除', v: s.deleted, unit: '例', tone: 'warn', m: '逻辑删除，保留留痕' },
      { l: '待重新审核', v: s.reaudit, unit: '例', tone: 'warn', m: '异常修复后标记' }
    ], 6);

    var tr = D.trendByMonth();
    var trendCard = U.card('病例生命周期状态趋势图（D4）',
      U.lineChart(null, { series: tr.series, w: 660, h: 220 }) +
      U.note('按月统计「待质控 / 质控中 / 已修正 / 已归档」四类状态的存量变化，用于质控效率分析。'), '',
      '<button class="btn btn-ghost btn-sm" data-qc="cq:log:export">导出生命周期日志</button>');

    var sd = D.sourceDist();
    var distCard = U.card('问题来源分布（D6）',
      U.barChart(sd.map(function (x) { return { l: x.source, v: x.problems, color: x.problems > 2 ? '#d98b2b' : '#3d5a80' }; }), { unit: '条', height: 170 }) +
      U.table(['问题来源', '在库病例数', '待修复异常数', '异常率'], sd.map(function (x) {
        return { cells: [
          { h: E(x.source), cls: 'txt' }, { h: x.cases, cls: 'num' }, { h: x.problems, cls: 'num' },
          { h: x.cases ? (x.problems / x.cases * 100).toFixed(1) + '%' : '—', cls: 'num' }
        ] };
      }), { compact: true, fit: true }) +
      U.note('按数据来源（HIS / 电子病历 / 登记系统 / 手工录入）统计各类问题的发生频率，辅助优化数据采集流程。'));

    var logs = D.logs();
    var pg = U.slice(logs, ST.page.log, PER);
    var lrows = pg.rows.map(function (l) {
      return { cells: [
        { h: E(l.at), cls: 'num' },
        { h: '<code>' + E(l.caseId) + '</code>', cls: 'txt' },
        { h: E(l.patientId), cls: 'txt' },
        { h: E(l.actor), cls: 'txt' },
        { h: U.badge(l.action, l.action.indexOf('删除') >= 0 || l.action.indexOf('终止') >= 0 || l.action.indexOf('退回') >= 0 || l.action.indexOf('整改') >= 0 ? 'danger' : 'info'), cls: 'center' },
        { h: E(l.note), cls: 'txt' }
      ] };
    });
    var logTable = U.table(
      ['#操作时间', '主数据ID', '患者ID', '操作人', '状态变更', '问题来源 / 问题描述 / 修正内容'],
      lrows, { compact: true, fit: true, empty: '暂无生命周期日志' });

    return '<div class="cq-page">' + head('病例生命周期管理 · 创建 → 审核 → 修正 → 归档 / 删除') + tabs() + kpi +
      '<div class="cq-bar"><div class="acts">' +
      '<button class="btn btn-outline btn-sm" data-qc="cq:export:lifecycle">导出生命周期管理日志（CSV）</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="cq:log:export">导出全部变更日志（CSV）</button>' +
      '</div><span class="cq-hint">归档 / 删除 / 整改 / 状态更新等行操作在「主数据」页签执行，此处汇总留痕</span></div>' +
      U.grid2(trendCard, distCard) +
      U.card('生命周期管理日志（D7）', logTable + U.pager(logs.length, ST.page.log, PER, 'cqlog')) +
      '</div>';
  }

  /* ==================== 详情页 ==================== */
  function stepsHtml(c) {
    var a = c.audit;
    var order = ['初审', '复审'];
    var doneMap = { '待初审': -1, '待复审': 0, '已通过': 2, '已退回': 0, '已终止': 0, '未启动': -1 };
    var done = doneMap[a.state] == null ? -1 : doneMap[a.state];
    var rejected = a.state === '已退回', terminated = a.state === '已终止';
    return '<div class="cq-steps">' + order.map(function (lv, i) {
      var op = (a.opinions || []).filter(function (x) { return x.level === lv; });
      var cls = '', sub = '';
      if (a.state === '未启动') { cls = ''; sub = '流程未启动'; }
      else if (i < done || a.state === '已通过') { cls = 'ok'; sub = op.length ? op[op.length - 1].result + ' · ' + op[op.length - 1].actor : '已完成'; }
      else if (a.state === '待初审' && i === 0 || a.state === '待复审' && i === 1) { cls = 'cur'; sub = '进行中 · ' + (a.assignee || ''); }
      else if (rejected && i === 0) { cls = 'bad'; sub = '已退回整改'; }
      else if (terminated && i === 0) { cls = 'bad'; sub = '流程已终止'; }
      else sub = '待处理';
      return '<div class="cq-step ' + cls + '"><div class="dot">' + (cls === 'ok' ? '✓' : cls === 'bad' ? '!' : i + 1) + '</div>' +
        '<div class="t">' + lv + '</div><div class="s">' + E(sub) + '</div></div>';
    }).join('') + '</div>';
  }

  function caseProblems(c) {
    return D.problems().filter(function (p) { return p.caseId === c.id && p.status === '待修复'; });
  }

  function renderDetail(c) {
    var sc = D.scoreOf(c);
    var probs = caseProblems(c);
    var fixedProbs = D.problems().filter(function (p) { return p.caseId === c.id && p.status === '已修复'; });
    var v10 = D.validateIcd10(c.icd10, c.siteName), v3 = D.validateIcdO3(c.icdO3, c.pathName);

    var acts = '<button class="btn btn-ghost btn-sm" data-qc="cq:back">← 返回主数据台账</button>' +
      (c.audit.state === '待初审' || c.audit.state === '待复审' ? '<button class="btn btn-primary btn-sm" data-qc="cq:opinion:' + c.id + '">提交审核意见</button>' : '') +
      '<button class="btn btn-outline btn-sm" data-qc="cq:snapshot:' + c.id + '">导出审核流程快照</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="cq:fixfield:' + c.id + '">修正主数据（升版本）</button>';
    var hd = U.head('病例质控详情', c.id + ' · ' + c.name + ' · ' + c.patientId + ' · ' + c.orgName, '', false, '<div class="cq-detail-acts">' + acts + '</div>');

    /* 基本信息 + 评分 */
    var base = U.kv([
      ['主数据ID', '<code>' + E(c.id) + '</code>'], ['患者ID', E(c.patientId)], ['姓名', E(c.name)],
      ['性别 / 年龄', E(c.sex) + ' / ' + E(c.age) + ' 岁'], ['出生日期', E(c.birthDate)], ['诊断日期', E(c.diagDate)],
      ['肿瘤部位', E(c.siteName)], ['病理类型', E(c.pathName)],
      ['部位 ICD-10', (v10.ok ? E(c.icd10) : '<span style="color:#b42335">' + E(c.icd10 || '缺失') + '（无效）</span>')],
      ['形态学 ICD-O-3', (v3.ok ? E(c.icdO3) : '<span style="color:#b42335">' + E(c.icdO3 || '缺失') + '（无效）</span>')],
      ['死亡日期', E(c.deathDate || '—')], ['随访状态', followBadge(c.followStatus)],
      ['数据来源', U.badge(c.source, 'info')], ['数据类型', '确诊病例主数据'],
      ['数据版本号', '<b>v' + c.ver + '</b>'], ['处理状态', qcStateBadge(c.qcState)]
    ], 3);
    var scoreLines = sc.items.map(function (x) {
      return '<div class="cq-score-item"><span>' + E(x.name) + (x.fail.length ? '<br><span style="color:#b42335;font-size:11px">' + E(x.fail.join('；')) + '</span>' : '') + '</span><b>' + x.got + ' / ' + x.full + '</b></div>';
    }).join('');
    var baseCard = U.card('主数据详情（A5 · 查询某病例的主数据详情）', base);
    var scoreCard = U.grid13(
      U.card('主数据质量评分（A4）', U.scoreCard(sc.total, sc.total >= 85 ? '优秀' : sc.total >= 70 ? '合格' : '待整改', [
        '完整性（40）+ 编码规范（30）+ 逻辑一致（30）', '评分随主数据修正实时重算'
      ])),
      U.card('评分构成明细', scoreLines)
    );

    /* 校验问题清单 */
    var pRows = probs.map(function (p) {
      var r = D.ruleById(p.ruleId);
      return { cells: [
        { h: '<code>' + E(p.id) + '</code>', cls: 'txt' },
        { h: E(r ? r.name : p.ruleId), cls: 'txt' },
        { h: E(p.field) + '：' + E(p.value || '空'), cls: 'txt' },
        { h: E(p.detail), cls: 'txt' },
        { h: p.suggest ? '<b style="color:#244765">' + E(p.suggest) + '</b>' : '—', cls: 'txt' },
        { h: U.link('修复', 'cq:fix:' + p.id), cls: 'act' }
      ] };
    });
    var icdNote = (!v10.ok || !v3.ok) ?
      U.note('编码有效性校验（A7）：' + [v10.ok ? '' : 'ICD-10 ' + v10.reason + (v10.suggest ? '，建议 ' + v10.suggest : ''), v3.ok ? '' : 'ICD-O-3 ' + v3.reason + (v3.suggest ? '，建议 ' + v3.suggest : '')].filter(Boolean).join('；'), true) : '';
    var probCard = U.card('校验问题清单（A3 / A7 / C5）',
      U.table(['异常ID', '触发规则', '异常字段/值', '异常详情', '建议值', '操作'], pRows, { compact: true, fit: true, empty: '当前病例无待修复异常' }) + icdNote);

    /* 审核流程 */
    var a = c.audit;
    var auditCard = U.card('确诊审核流程（B4 / B5）', stepsHtml(c) +
      U.kv([
        ['当前审核状态', auditBadge(a.state)], ['审核流程ID', '<code>AF-' + E(c.id) + '</code>'],
        ['当前审核层级', E(a.level || '—')], ['审核角色', E(a.role || '—')],
        ['当前审核人', E(a.assignee || '—')], ['分配时间', E(a.assignAt || '—')],
        ['审核截止时间', D.isOverdue(c) ? '<span style="color:#b42335">' + E(a.deadline) + '（超时）</span>' : E(a.deadline || '—')],
        ['审核意见（最近）', (a.opinions.length ? E(a.opinions[a.opinions.length - 1].opinion) : '—')],
        ['终止原因', E(a.terminateReason || '—')],
        ['历史审核记录', (a.opinions || []).length + ' 条 · ' + U.link('查看轨迹', 'cq:history:' + c.id)]
      ], 3));

    var timelineItems = (a.opinions || []).map(function (o) {
      return { title: o.level + ' · ' + o.result, date: o.at, state: o.result === '退回' ? 'bad' : 'ok',
        desc: E(o.role) + ' / ' + E(o.actor) + '<br>' + E(o.opinion) };
    });
    if (a.terminateReason) timelineItems.push({ title: '流程终止', date: '', state: 'bad', desc: E(a.terminateReason) });
    var histCard = U.card('历史审核轨迹（B3 / B6）', timelineItems.length ? U.timeline(timelineItems) : '<div style="color:#94a3b8;font-size:12.5px">暂无审核记录</div>');

    /* 版本历史 */
    var verRows = (c.verLog || []).map(function (v) {
      return { cells: [{ h: E(v.at), cls: 'num' }, { h: E(v.who), cls: 'txt' }, { h: E(v.what), cls: 'txt' }] };
    });
    var verCard = U.card('数据版本历史（A8 · 版本回溯）',
      U.table(['#变更时间', '操作人', '变更内容'], verRows, { compact: true, fit: true, empty: '暂无版本记录' }) +
      U.note('每次修正主数据或补充随访状态后版本号自动 +1，保留完整历史变更轨迹。'));

    /* 生命周期快照 */
    var lcItems = (c.lifecycle || []).map(function (l) {
      return { title: l.action, date: l.at, state: l.action.indexOf('删除') >= 0 || l.action.indexOf('终止') >= 0 || l.action.indexOf('退回') >= 0 ? 'bad' : 'ok',
        desc: E(l.actor) + (l.note ? ' · ' + E(l.note) : '') };
    });
    var lcCard = U.card('病例生命周期快照（D5）', lcItems.length ? U.timeline(lcItems) : '<div style="color:#94a3b8;font-size:12.5px">暂无记录</div>');

    /* 整改标记 */
    var rectCard = c.rectify && c.rectify.flag ?
      U.card('整改标记（D8）', U.kv([
        ['问题描述', E(c.rectify.note)], ['责任人', E(c.rectify.owner)], ['处理期限', E(c.rectify.due)], ['标记时间', E(c.rectify.at)]
      ], 2)) : '';

    /* 修复记录 */
    var fixCard = fixedProbs.length ? U.card('本病例修复记录（C6）',
      fixedProbs.map(function (p) {
        return '<div class="cq-fixlog"><b>' + E(p.id) + '</b> · ' + E(p.fixAt) + ' · ' + E(p.fixer) + '<br>' +
          E(p.fixContent) + (p.reaudit ? ' <span class="badge badge-warning">已标记需重新审核</span>' : '') + '</div>';
      }).join('')) : '';

    return '<div class="cq-page">' + hd + baseCard + scoreCard + probCard +
      U.grid2(auditCard, histCard) + U.grid2(verCard, lcCard) + rectCard + fixCard + '</div>';
  }

  /* ==================== 弹窗 ==================== */
  function modal(title, body, footer) { U.modal(title, body, footer || ''); }

  function receiveModal() {
    modal('接收确诊病例主数据（A1）',
      '<div class="cq-form">' +
      formRow('数据来源', sel('cqf-src', D.SOURCES, 'HIS')) +
      formRow('本次接收条数', '<input type="number" id="cqf-cnt" value="3" min="1" max="10">') +
      '<div class="cq-hint">模拟从 HIS / 电子病历 / 肿瘤登记系统批量获取主数据（患者ID、诊断日期、部位 ICD-10、形态学 ICD-O-3、性别、年龄、出生日期、死亡日期、随访状态），接收后自动纳入质控台账并重跑校验。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:receive:do">确认接收</button>');
  }
  function followModal(c) {
    modal('补充 / 修正随访状态（A2） · ' + c.id,
      '<div class="cq-form">' +
      formRow('患者', '<div style="font-size:13px;color:#334155">' + E(c.name) + '（' + E(c.patientId) + '）· 当前：<b>' + E(c.followStatus || '缺失') + '</b></div>') +
      formRow('随访状态', sel('cqf-follow', D.FOLLOW, c.followStatus || '在访(存活)')) +
      formRow('备注 / 死亡日期（选填，形如 2026-10-01）', '<input type="text" id="cqf-note" placeholder="补录依据说明；若状态为死亡，可在此填写死亡日期">') +
      '<div class="cq-hint">提交后随访状态更新、数据版本号 +1，并写入版本留痕与生命周期日志；系统自动重跑规则校验。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:follow:do:' + c.id + '">保存</button>');
  }
  function opinionModal(c) {
    var a = c.audit;
    modal('提交审核意见（B2） · ' + c.id,
      '<div class="cq-form">' +
      formRow('当前审核状态', '<div>' + auditBadge(a.state) + ' · ' + E(a.level) + ' / ' + E(a.role) + ' / ' + E(a.assignee) + '（截止 ' + E(a.deadline) + '）</div>') +
      formRow('审核意见', '<textarea id="cqf-opinion" placeholder="填写审核意见（必填）"></textarea>') +
      '<div class="cq-hint">「通过」在初审后自动流转复审、复审后流程完成；「退回」记录意见并退回整改，可在台账重新提交。所有操作写入历史审核轨迹。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:opinion:do:' + c.id + ':通过">通过</button> ' +
      '<button class="btn btn-outline btn-sm" data-qc="cq:opinion:do:' + c.id + ':退回" style="color:#b42335">退回整改</button>');
  }
  function terminateModal(c) {
    modal('终止异常审核流程（B8） · ' + c.id,
      '<div class="cq-form">' +
      formRow('终止原因', '<textarea id="cqf-term" placeholder="例如：重复病例合并、测试数据清理"></textarea>') +
      '<div class="cq-hint">终止后流程不再流转，原因写入审核记录与生命周期日志并归档留痕。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:terminate:do:' + c.id + '">确认终止</button>');
  }
  function deleteModal(c) {
    modal('删除测试或无效病例（D3） · ' + c.id,
      '<div class="cq-form">' +
      formRow('删除原因', '<input type="text" id="cqf-del" value="测试数据，非真实病例">') +
      '<div class="cq-hint">逻辑删除（非物理删除）：保留主数据与全部留痕，记录删除人和删除时间，不再参与日常质控流程。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:delete:do:' + c.id + '">确认删除</button>');
  }
  function stateModal(c) {
    modal('更新病例处理状态（D1） · ' + c.id,
      '<div class="cq-form">' +
      formRow('当前状态', '<div>' + qcStateBadge(c.qcState) + ' · 审核状态 ' + auditBadge(c.audit.state) + '</div>') +
      formRow('目标状态', sel('cqf-state', ['待质控', '质控中', '已修正', '已归档', '已删除'], c.qcState)) +
      formRow('变更说明', '<input type="text" id="cqf-state-note" placeholder="选填，例如：退回修正 / 复核完成">') +
      '<div class="cq-hint">状态变更写入生命周期日志（操作人、时间、最新操作）。归档建议走「归档」动作（要求审核已通过）；删除建议走「删除」动作（保留删除原因留痕）。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:state:do:' + c.id + '">确认更新</button>');
  }
  function rectifyModal(c) {
    modal('标记需要整改的问题案例（D8） · ' + c.id,
      '<div class="cq-form">' +
      formRow('问题描述', '<textarea id="cqf-rec-note" placeholder="描述存在的严重质量问题">' + E(c.rectify && c.rectify.note || '') + '</textarea>') +
      '<div class="row2">' + formRow('责任人', '<input type="text" id="cqf-rec-owner" value="' + E(c.rectify && c.rectify.owner || '责任机构质控员') + '">') +
      formRow('整改期限', '<input type="date" id="cqf-rec-due" value="' + E(c.rectify && c.rectify.due || D.addDays(D.today(), 7)) + '">') + '</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:rectify:do:' + c.id + '">确认标记</button>');
  }
  function ruleFormModal(r) {
    var isNew = !r;
    r = r || { name: '', type: '必填完整', scope: '确诊病例主数据', tpl: 'required', cond: '', severity: '提示', enabled: true, desc: '' };
    var tplOpts = D.RULE_TPLS.map(function (t) { return [t.id, t.name]; });
    modal((isNew ? '配置新增质控规则（C1）' : '修改现有质控规则（C2） · ' + r.id),
      '<div class="cq-form">' +
      formRow('规则名称', '<input type="text" id="cqf-r-name" value="' + E(r.name) + '" placeholder="例如：诊断日期不得晚于报告日期">') +
      '<div class="row2">' +
      formRow('规则类型', sel('cqf-r-type', D.RULE_TYPES, r.type)) +
      formRow('适用数据类型', sel('cqf-r-scope', ['确诊病例主数据', '确诊审核流程', '病例生命周期'], r.scope)) + '</div>' +
      formRow('校验模板', sel('cqf-r-tpl', tplOpts, r.tpl)) +
      formRow('校验条件', '<textarea id="cqf-r-cond" placeholder="描述校验条件">' + E(r.cond) + '</textarea>') +
      '<div class="row2">' +
      formRow('错误等级', sel('cqf-r-sev', D.SEVERITIES, r.severity)) +
      formRow('启用状态', sel('cqf-r-en', [['1', '启用'], ['0', '停用']], r.enabled ? '1' : '0')) + '</div>' +
      formRow('规则说明', '<input type="text" id="cqf-r-desc" value="' + E(r.desc || '') + '">') +
      '<div class="cq-hint">模板决定规则执行引擎的判定逻辑；停用规则不再参与新校验，但历史异常与修复记录保留。创建人/创建时间/更新时间由系统自动维护。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:rule:save:' + (isNew ? 'add' : r.id) + '">保存规则</button>');
  }
  function ruleDetailModal(r) {
    var ps = D.problems(r.id);
    var st2 = D.ruleStats(r.id);
    var body = U.kv([
      ['规则ID', '<code>' + E(r.id) + '</code>'], ['规则名称', E(r.name)], ['规则类型', E(r.type)],
      ['适用数据类型', E(r.scope)], ['校验条件', E(r.cond)], ['错误等级', U.badge(r.severity, r.severity === '强拦截' ? 'danger' : 'neutral')],
      ['启用状态', r.enabled ? U.badge('启用', 'success') : U.badge('停用', 'neutral')], ['创建人 / 时间', E(r.creator) + ' / ' + E(r.createdAt)],
      ['更新时间', E(r.updatedAt)], ['累计触发 / 待修复 / 修复率', st2.hits + ' / ' + st2.open + ' / ' + st2.fixRate.toFixed(1) + '%']
    ], 2) + '<div style="margin-top:12px;border-top:1px solid #eef2f7;padding-top:10px"><b style="font-size:12.5px">异常详情（C5）</b>' +
      (ps.length ? ps.map(function (p) {
        var c = D.caseById(p.caseId);
        return '<div class="cq-prob"><div class="h"><span>' + E(p.id) + ' · ' + E(p.caseId) + (c ? '（' + E(c.name) + '）' : '') + '</span>' +
          (p.status === '待修复' ? U.link('修复', 'cq:fix:' + p.id) : U.badge('已修复', 'success')) + '</div>' +
          '<div class="d">字段 <b>' + E(p.field) + '</b>（' + E(p.value || '空') + '）：' + E(p.detail) +
          (p.suggest ? '<br>建议值：<b>' + E(p.suggest) + '</b>' : '') + '</div>' +
          '<div class="f">校验时间 ' + E(p.foundAt) + (p.status === '已修复' ? ' · 修复人 ' + E(p.fixer) + ' · ' + E(p.fixContent) : '') + '</div></div>';
      }).join('') : '<div style="color:#94a3b8;font-size:12.5px;padding:8px 0">该规则暂无异常记录</div>') + '</div>';
    modal('规则异常详情（C5） · ' + r.name, body);
  }
  function fixlogModal(r) {
    var ps = D.problems(r.id).filter(function (p) { return p.status === '已修复'; });
    var body = ps.length ? ps.map(function (p) {
      return '<div class="cq-fixlog"><b>' + E(p.id) + '</b> · ' + E(p.fixAt) + ' · 修复人 <b>' + E(p.fixer) + '</b><br>' +
        '异常字段：' + E(p.field) + '（' + E(p.value || '空') + '）<br>修复内容：' + E(p.fixContent) +
        (p.reaudit ? '<br><span class="badge badge-warning">已标记需重新审核</span> ' + E(p.reauditAt) : '') + '</div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12.5px">该规则暂无修复记录</div>';
    modal('修复记录明细（C6） · ' + r.name, body);
  }
  function fixModal(p) {
    var c = D.caseById(p.caseId);
    modal('修复异常（C6 / C8） · ' + p.id,
      '<div class="cq-form">' +
      formRow('关联病例 / 异常详情', '<div style="font-size:12.5px;color:#475569">' + E(p.caseId) + (c ? '（' + E(c.name) + '）' : '') + ' · 字段 <b>' + E(p.field) + '</b>（' + E(p.value || '空') + '）<br>' + E(p.detail) + '</div>') +
      formRow('修复人', '<input type="text" id="cqf-fix-who" value="' + E(D.ACTOR) + '">') +
      formRow('修复内容', '<textarea id="cqf-fix-content" placeholder="填写修正内容">' + (p.suggest ? '按建议值修正为 ' + E(p.suggest) : '') + '</textarea>') +
      '<div class="ck"><input type="checkbox" id="cqf-fix-reaudit" checked><label for="cqf-fix-reaudit" style="margin:0">标记需重新审核（C8，修复后自动通知责任人启动新一轮审核）</label></div>' +
      '<div class="cq-hint">勾选后系统将病例标记为「待重新审核」；若该病例已审核通过/终止，审核流程将重置为待初审，并写入生命周期日志。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:fix:do:' + p.id + '">确认修复</button>');
  }
  function progressModal(c) {
    modal('审核流程进度图（B4） · ' + c.id,
      stepsHtml(c) + '<div style="margin-top:14px">' + U.kv([
        ['当前审核状态', auditBadge(c.audit.state)], ['当前层级', E(c.audit.level || '—')],
        ['审核角色', E(c.audit.role || '—')], ['当前审核人', E(c.audit.assignee || '—')],
        ['分配时间', E(c.audit.assignAt || '—')], ['审核截止时间', E(c.audit.deadline || '—')],
        ['是否超时', D.isOverdue(c) ? U.badge('已超时', 'danger') : U.badge('未超时', 'success')],
        ['已完成的审核记录', (c.audit.opinions || []).length + ' 条']
      ], 2) + '</div>' +
      (c.audit.terminateReason ? U.note('终止原因：' + E(c.audit.terminateReason), true) : ''));
  }
  function historyModal(c) {
    var items = (c.audit.opinions || []).map(function (o) {
      return { title: o.level + ' · ' + o.result, date: o.at, state: o.result === '退回' ? 'bad' : 'ok',
        desc: E(o.role) + ' / ' + E(o.actor) + '<br>' + E(o.opinion) };
    });
    modal('历史审核记录（B3 / B6） · ' + c.id,
      (items.length ? U.timeline(items) : '<div style="color:#94a3b8;font-size:12.5px">暂无审核记录</div>') +
      '<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-qc="cq:snapshot:' + c.id + '">导出审核流程快照数据</button></div>');
  }
  function fixfieldModal(c) {
    var fields = [['followStatus', '随访状态'], ['icd10', '肿瘤部位 ICD-10'], ['icdO3', '形态学 ICD-O-3'], ['deathDate', '死亡日期'], ['age', '年龄'], ['birthDate', '出生日期'], ['diagDate', '诊断日期']];
    modal('修正主数据 / 更新版本号（A8） · ' + c.id,
      '<div class="cq-form">' +
      formRow('当前版本', '<div>v' + c.ver + ' · 质量评分 <b>' + c.score + '</b> 分</div>') +
      formRow('修正字段', sel('cqf-ff-field', fields.map(function (f) { return [f[0], f[1]]; }), 'icd10')) +
      formRow('新值', '<input type="text" id="cqf-ff-value" placeholder="填写修正后的值">') +
      '<div class="cq-hint">保存后数据版本号自动 +1，保留历史变更轨迹（支持版本回溯）；系统重算质量评分并重跑规则校验。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="cq:fixfield:do:' + c.id + '">保存并重算</button>');
  }

  /* ==================== 导出 ==================== */
  function exportWait() {
    var list = D.activeCases().filter(function (c) { return c.qcState === '待质控' || c.qcState === '质控中'; });
    D.exportCsv('待质控主数据列表', ['主数据ID', '患者ID', '姓名', '性别', '年龄', '出生日期', '诊断日期', '肿瘤部位', '病理类型', '部位ICD-10', '形态学ICD-O-3', '死亡日期', '随访状态', '数据来源', '机构', '质量评分', '审核状态', '处理状态', '数据版本号'],
      list.map(function (c) { return [c.id, c.patientId, c.name, c.sex, c.age, c.birthDate, c.diagDate, c.siteName, c.pathName, c.icd10, c.icdO3, c.deathDate, c.followStatus, c.source, c.orgName, c.score, c.audit.state, c.qcState, c.ver]; }));
    toast('已导出待质控主数据 ' + list.length + ' 条（CSV）');
  }
  function exportBadIcd() {
    var rows = [];
    D.activeCases().forEach(function (c) {
      var v10 = D.validateIcd10(c.icd10, c.siteName), v3 = D.validateIcdO3(c.icdO3, c.pathName);
      if (!v10.ok) rows.push([c.id, c.patientId, '肿瘤部位ICD-10', c.icd10, v10.reason, v10.suggest, c.siteName]);
      if (!v3.ok) rows.push([c.id, c.patientId, '形态学ICD-O-3', c.icdO3, v3.reason, v3.suggest, c.pathName]);
    });
    D.exportCsv('无效ICD编码清单', ['主数据ID', '患者ID', '异常字段', '异常编码值', '异常原因', '建议值', '原始部位/病理名称'], rows);
    toast('已导出无效编码 ' + rows.length + ' 项（含建议值）');
  }
  function exportRules() {
    D.exportCsv('质控规则配置清单', ['规则ID', '规则名称', '规则类型', '适用数据类型', '校验模板', '校验条件', '错误等级', '启用状态', '创建人', '创建时间', '更新时间', '累计触发', '待修复', '修复率(%)'],
      D.rules().map(function (r) { var s2 = D.ruleStats(r.id); return [r.id, r.name, r.type, r.scope, r.tpl, r.cond, r.severity, r.enabled ? '启用' : '停用', r.creator, r.createdAt, r.updatedAt, s2.hits, s2.open, s2.fixRate]; }));
    toast('已导出规则配置清单（CSV）');
  }
  function exportLogs() {
    D.exportCsv('生命周期管理日志', ['操作时间', '主数据ID', '患者ID', '操作人', '状态变更', '问题来源/问题描述/修正内容'],
      D.logs().map(function (l) { return [l.at, l.caseId, l.patientId, l.actor, l.action, l.note]; }));
    toast('已导出生命周期管理日志 ' + D.logs().length + ' 条（CSV）');
  }
  function exportSnapshot(c) {
    D.exportJson('审核流程快照_' + c.id, {
      exportedAt: D.now(), caseId: c.id, patientId: c.patientId,
      masterData: { dataType: '确诊病例主数据', diagDate: c.diagDate, icd10: c.icd10, icdO3: c.icdO3, sex: c.sex, age: c.age, birthDate: c.birthDate, deathDate: c.deathDate, followStatus: c.followStatus, version: c.ver },
      audit: cloneOf(c.audit), qualityScore: D.scoreOf(c), problems: D.problems().filter(function (p) { return p.caseId === c.id; }),
      lifecycle: cloneOf(c.lifecycle || []), versionLog: cloneOf(c.verLog || [])
    });
    toast('已导出审核流程快照（JSON）');
  }
  function cloneOf(o) { return JSON.parse(JSON.stringify(o)); }

  /* ==================== 页面分发 / 路由 ==================== */
  function renderWorkbench() {
    if (ST.tab === '审核流程') return renderQueue();
    if (ST.tab === '规则与修复') return renderRules();
    if (ST.tab === '生命周期分析') return renderLifecycle();
    return renderMain();
  }
  function renderPageId(id) {
    if (id.indexOf('cq-case|') === 0) {
      var c = D.caseById(id.slice(8));
      if (!c) return U.head('病例不存在', '', '', false, '<button class="btn btn-ghost btn-sm" data-qc="cq:back">← 返回</button>') + U.note('未找到该主数据ID对应的病例。', true);
      return renderDetail(c);
    }
    return renderWorkbench();
  }

  function openCase(id) {
    ST.tab = 'DETAIL'; ST.detailId = id;
    try { history.replaceState(null, '', '#cq-case|' + id); } catch (e) {}
    /* 必须走包装后的 renderPage：原始 renderPage 不认识 cq-case| 前缀会落到占位页。
       包装内已统一处理菜单高亮回落、面包屑与滚动复位。 */
    window.renderPage('cq-case|' + id);
  }
  function back() {
    ST.tab = '主数据'; ST.detailId = '';
    try { history.replaceState(null, '', '#cq-workbench'); } catch (e) {}
    if (typeof window.navigateTo === 'function') window.navigateTo('cq-workbench');
  }

  /* ==================== 事件代理 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc') || '';
    /* qcUI 自带动作（弹窗关闭）不拦截；只处理本模块 cq: 前缀与分页动作。
       注意：绝不能放行通用 filter:* 动作——其它 QC 模块有「filter: 开头一律接管」
       的全局代理，会抢走本页筛选。本页筛选动作全部收在 cq:filter:* 下。 */
    if (a.indexOf('cq:') !== 0 && !/^(cqcase|cqqueue|cqrule|cqprob|cqlog):page:/.test(a)) return;

    /* 统一按前缀取参数，避免逐处手数字符串长度导致切片错位 */
    function arg(pre) { return a.slice(pre.length); }
    function has(pre) { return a.indexOf(pre) === 0; }

    /* 页签 */
    if (has('cq:tab:')) { ST.tab = arg('cq:tab:'); ST.detailId = ''; try { history.replaceState(null, '', '#cq-workbench'); } catch (e) {} refresh(); return; }
    if (a === 'cq:back') { back(); return; }
    if (a === 'cq:reset') {
      if (typeof showConfirm === 'function') showConfirm('重置演示数据', '确认将「确诊病例质控」全部演示数据恢复为初始种子吗？当前会话内的病例、规则、审核与修复记录改动都会丢失。', function () { D.reset(); ST.tab = '主数据'; ST.filter = { source: '全部', follow: '全部', audit: '全部', state: '全部', kw: '' }; toast('演示数据已重置'); refresh(); });
      return;
    }

    /* 筛选（模块私有动作名，避开其它 QC 模块的通用 filter:* 代理） */
    if (a === 'cq:filter:apply:cq') { applyFilter(); return; }
    if (a === 'cq:filter:reset:cq') { resetFilter(); return; }
    if (a === 'cq:filter:apply:cqr') {
      var v = readFilter();
      ST.ruleFilter = { enabled: v.renabled || '全部', type: v.rtype || '全部', kw: v.rkw || '' };
      ST.page.rule = 1; refresh(); return;
    }
    if (a === 'cq:filter:reset:cqr') { ST.ruleFilter = { enabled: '全部', type: '全部', kw: '' }; ST.page.rule = 1; refresh(); return; }

    /* 分页 */
    var pm = /^(cqcase|cqqueue|cqrule|cqprob|cqlog):page:(\d+)$/.exec(a);
    if (pm) {
      var key = { cqcase: 'main', cqqueue: 'queue', cqrule: 'rule', cqprob: 'prob', cqlog: 'log' }[pm[1]];
      ST.page[key] = parseInt(pm[2], 10) || 1; refresh(); return;
    }

    /* KPI 点击 → 主数据筛选 / 审核状态筛选 */
    if (has('cq:main:state:')) { ST.filter.state = arg('cq:main:state:'); ST.page.main = 1; ST.tab = '主数据'; refresh(); return; }
    if (has('cq:queue:state:')) { ST.queueState = arg('cq:queue:state:'); ST.page.queue = 1; ST.tab = '审核流程'; refresh(); return; }

    /* 主数据动作 */
    if (a === 'cq:receive') { receiveModal(); return; }
    if (a === 'cq:receive:do') {
      var created = D.receiveBatch(val('cqf-src'), parseInt(val('cqf-cnt'), 10) || 3);
      closeModal(); toast('已从 ' + (val('cqf-src') || 'HIS') + ' 接收 ' + created.length + ' 条主数据，并自动完成校验'); refresh(); return;
    }
    if (a === 'cq:check') {
      var res = D.runChecks();
      toast('批量校验完成：' + res.cases + ' 条病例 · 新增异常 ' + res.created + ' 条 · 自动关闭 ' + res.closed + ' 条 · 当前待修复 ' + res.problems + ' 条'); refresh(); return;
    }
    if (a === 'cq:export:wait') { exportWait(); return; }
    if (a === 'cq:export:badicd') { exportBadIcd(); return; }
    if (a === 'cq:export:lifecycle' || a === 'cq:log:export') { exportLogs(); return; }
    if (has('cq:detail:')) { openCase(arg('cq:detail:')); return; }
    /* 「保存」是 do 后缀，必须先于「打开弹窗」前缀判断，否则会被当成打开动作吞掉 */
    if (has('cq:follow:do:')) {
      var r1 = D.updateFollow(arg('cq:follow:do:'), val('cqf-follow'), val('cqf-note'));
      closeModal(); toast(r1 ? '随访状态已更新，数据版本已升级并重跑校验' : '病例不存在', !r1); refresh(); return;
    }
    if (has('cq:follow:')) { var c1 = D.caseById(arg('cq:follow:')); if (c1) followModal(c1); return; }
    if (has('cq:audit:start:')) { ok(D.startAudit(arg('cq:audit:start:'))); return; }
    if (has('cq:resubmit:')) { ok(D.resubmitAudit(arg('cq:resubmit:'))); return; }
    if (has('cq:state:do:')) { ok(D.setState(arg('cq:state:do:'), val('cqf-state'), val('cqf-state-note'))); closeModal(); return; }
    if (has('cq:state:')) { var cs = D.caseById(arg('cq:state:')); if (cs) stateModal(cs); return; }
    if (has('cq:archive:')) { ok(D.archive(arg('cq:archive:'))); return; }
    if (has('cq:delete:do:')) { ok(D.softDelete(arg('cq:delete:do:'), val('cqf-del'))); closeModal(); return; }
    if (has('cq:delete:')) { var c2 = D.caseById(arg('cq:delete:')); if (c2) deleteModal(c2); return; }
    if (has('cq:rectify:do:')) { ok(D.markRectify(arg('cq:rectify:do:'), val('cqf-rec-note'), val('cqf-rec-owner'), val('cqf-rec-due'))); closeModal(); return; }
    if (has('cq:rectify:')) { var c3 = D.caseById(arg('cq:rectify:')); if (c3) rectifyModal(c3); return; }

    /* 审核动作（do 后缀必须先判断） */
    if (has('cq:opinion:do:')) {
      var seg = arg('cq:opinion:do:').split(':'), id2 = seg[0], result = seg[1];
      var r2 = D.submitOpinion(id2, result, val('cqf-opinion'));
      closeModal(); toast(r2.msg, !r2.ok); if (r2.ok) refresh(); return;
    }
    if (has('cq:opinion:')) { var c4 = D.caseById(arg('cq:opinion:')); if (c4) opinionModal(c4); return; }
    if (has('cq:terminate:do:')) { ok(D.terminateAudit(arg('cq:terminate:do:'), val('cqf-term') || '管理员终止')); closeModal(); return; }
    if (has('cq:terminate:')) { var c5 = D.caseById(arg('cq:terminate:')); if (c5) terminateModal(c5); return; }
    if (has('cq:progress:')) { var c6 = D.caseById(arg('cq:progress:')); if (c6) progressModal(c6); return; }
    if (has('cq:history:')) { var c7 = D.caseById(arg('cq:history:')); if (c7) historyModal(c7); return; }
    if (has('cq:snapshot:')) { var c8 = D.caseById(arg('cq:snapshot:')); if (c8) exportSnapshot(c8); return; }

    /* 规则动作 */
    if (a === 'cq:rule:add') { ruleFormModal(null); return; }
    if (has('cq:rule:edit:')) { var r3 = D.ruleById(arg('cq:rule:edit:')); if (r3) ruleFormModal(r3); return; }
    if (has('cq:rule:save:')) {
      var rid = arg('cq:rule:save:');
      var r4 = {
        name: val('cqf-r-name'), type: val('cqf-r-type'), scope: val('cqf-r-scope'),
        tpl: val('cqf-r-tpl'), cond: val('cqf-r-cond'), severity: val('cqf-r-sev'),
        enabled: val('cqf-r-en') === '1', desc: val('cqf-r-desc')
      };
      if (!r4.name) { toast('请填写规则名称', true); return; }
      if (!r4.cond) { toast('请填写校验条件', true); return; }
      if (rid !== 'add') r4.id = rid;
      var r5 = D.saveRule(r4); closeModal(); toast(r5.msg, !r5.ok);
      D.runRules(D.activeCases()); refresh(); return;
    }
    if (has('cq:rule:delete:')) {
      var did = arg('cq:rule:delete:');
      if (typeof showConfirm === 'function') showConfirm('删除质控规则', '确认删除规则 ' + did + ' 吗？其历史异常与修复记录将保留。', function () { D.deleteRule(did); closeModal(); toast('规则已删除'); refresh(); });
      return;
    }
    if (has('cq:rule:detail:')) { var r6 = D.ruleById(arg('cq:rule:detail:')); if (r6) ruleDetailModal(r6); return; }
    if (has('cq:rule:fixlog:')) { var r7 = D.ruleById(arg('cq:rule:fixlog:')); if (r7) fixlogModal(r7); return; }
    if (a === 'cq:rule:export') { exportRules(); return; }

    /* 异常修复（do 后缀必须先判断；cq:fixfield: 是另一个动作，用 has 前缀不冲突） */
    if (has('cq:fix:do:')) {
      var pid2 = arg('cq:fix:do:'), ck = document.getElementById('cqf-fix-reaudit');
      var r8 = D.fixProblem(pid2, val('cqf-fix-who'), val('cqf-fix-content'), !!(ck && ck.checked));
      closeModal(); toast(r8.msg, !r8.ok); refresh(); return;
    }
    if (has('cq:fix:')) {
      var pid = arg('cq:fix:'), p1 = D.problems().filter(function (x) { return x.id === pid; })[0];
      if (p1) fixModal(p1); return;
    }

    /* 详情页修正字段 */
    if (has('cq:fixfield:do:')) {
      var id3 = arg('cq:fixfield:do:'), field = val('cqf-ff-field'), nv = val('cqf-ff-value');
      if (!nv) { toast('请填写新值', true); return; }
      var okFix = D.fixCaseField(id3, field, nv);
      if (okFix) D.runRules(D.activeCases());
      closeModal(); toast(okFix ? '主数据已修正，版本升级并重算评分/校验' : '病例不存在', !okFix); refresh(); return;
    }
    if (has('cq:fixfield:')) { var c9 = D.caseById(arg('cq:fixfield:')); if (c9) fixfieldModal(c9); return; }
  });

  /* 启停开关（change 事件） */
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var rid = el.getAttribute('data-cqrule');
    if (!rid) return;
    var on = D.toggleRule(rid);
    toast('规则 ' + rid + (on ? ' 已启用' : ' 已停用'));
    D.runRules(D.activeCases());
    refresh();
  });

  /* ==================== 路由接管 ==================== */
  var baseRender = (typeof window.renderPage === 'function') ? window.renderPage : function () {};
  window.renderPage = function (id) {
    if (id === 'cq-workbench' || (typeof id === 'string' && id.indexOf('cq-case|') === 0)) {
      /* 同步模块状态：initApp 用 hash 直达 / 详情页弹窗操作后 refresh() 都依赖这两个字段 */
      if (id === 'cq-workbench') {
        ST.tab = ST.tab === 'DETAIL' ? '主数据' : ST.tab;
        ST.detailId = '';
      } else {
        ST.tab = 'DETAIL'; ST.detailId = id.slice(8);
      }
      document.getElementById('pageContainer').innerHTML = renderPageId(id);
      if (typeof setActiveMenu === 'function') setActiveMenu(id === 'cq-workbench' ? id : 'cq-workbench');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('cq-workbench', id === 'cq-workbench' ? '' : '病例质控详情');
      if (typeof autoSizeSelects === 'function') { try { autoSizeSelects(); } catch (e) {} }
      var mc = document.getElementById('mainContent'); if (mc && mc.scrollTop !== undefined) mc.scrollTop = 0;
      return;
    }
    return baseRender.apply(this, arguments);
  };

  /* hash 直达详情页兜底：initApp 白名单已放行 cq-case| 前缀，正常路径由 navigateTo →
     包装 renderPage 处理；此处仅防御外部直接改 hash 后手动触发的极端场景，且幂等。 */
  document.addEventListener('DOMContentLoaded', function () {
    var h = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    if (h.indexOf('cq-case|') !== 0) return;
    var id = h.slice(8);
    if (ST.tab === 'DETAIL' && ST.detailId === id) return;
    openCase(id);
  });

  /* 对外出口（调试 / 深链） */
  window.CQ = {
    state: ST, renderPageId: renderPageId,
    openCase: openCase, back: back,
    refresh: refresh
  };
})();
