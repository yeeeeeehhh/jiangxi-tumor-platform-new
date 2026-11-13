/* ============================================================================
 * pathology-qc.js — 病理信息质控 · 渲染层（window.PQ）
 *
 * 单页 3 页签：病理核心信息 / 病理附件索引 / 病理质控规则配置
 * 隐藏详情页：pq-case|<病理报告号>（菜单不占位）
 *
 * 23 个功能点入口：
 *   页签① 核心信息 A1 接收 / A2 补分子标志物 / A3 WHO 编码校验 / A4 质量评分(详情) /
 *          A5 查询详情 / A6 导出待质控 / A7 切缘-手术逻辑 / A8 版本更新(详情修正)
 *   页签② 附件索引 B1 关联原文 / B2 关联显微图 / B3 关联染色图谱 / B4 校验URL /
 *          B5 缺失预警清单 / B6 查询全部附件 / B7 删除无效重复 / B8 导出索引清单
 *   页签③ 规则配置 C1 强制填报字段 / C2 逻辑校验规则 / C3 脱敏规则 /
 *          C4 完整性阈值 / C5 执行日志 / C6 导出配置清单 / C7 启用禁用
 * ========================================================================== */
(function () {
  'use strict';

  var D = window.PQD, U = window.qcUI, E = D.esc;

  /* ==================== 样式（pq- 前缀） ==================== */
  var CSS = [
    '#pageContainer .pq-page{min-width:0}',
    '#pageContainer .pq-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '#pageContainer .pq-bar .acts{display:flex;gap:8px;flex-wrap:wrap}',
    '#pageContainer .pq-hint{font-size:11.5px;color:#94a3b8;line-height:1.6}',
    /* 启停开关：input 覆盖轨道保持可点击 */
    '#pageContainer .pq-switch{position:relative;display:inline-block;width:38px;height:20px;flex:none;vertical-align:middle;cursor:pointer}',
    '#pageContainer .pq-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:2}',
    '#pageContainer .pq-switch i{position:absolute;inset:0;background:#cbd5e1;border-radius:20px;transition:.2s;pointer-events:none}',
    '#pageContainer .pq-switch i:before{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s}',
    '#pageContainer .pq-switch input:checked+i{background:var(--primary)}',
    '#pageContainer .pq-switch input:checked+i:before{transform:translateX(18px)}',
    /* 筛选条：按钮组独立一行，避免被 grid 挤到容器右缘 */
    '#pageContainer .pq-page .qc-filter{grid-template-columns:repeat(var(--pq-fcols,4),minmax(0,1fr));row-gap:10px}',
    '#pageContainer .pq-page .qc-filter .acts{grid-column:1/-1;justify-content:flex-start;align-self:end;height:34px;width:auto;max-width:100%}',
    /* 评分明细 */
    '#pageContainer .pq-score-item{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #eef2f7;font-size:12.5px;color:#475569}',
    '#pageContainer .pq-score-item:last-child{border-bottom:0}',
    '#pageContainer .pq-score-item b{color:#182230}',
    /* 异常条目 */
    '#pageContainer .pq-prob{border:1px solid #f1d7db;background:#fffafb;border-radius:6px;padding:9px 11px;margin-bottom:8px}',
    '#pageContainer .pq-prob .h{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:600;color:#9f2f42}',
    '#pageContainer .pq-prob .d{font-size:12px;color:#475569;margin-top:4px;line-height:1.6}',
    '#pageContainer .pq-prob .f{font-size:11.5px;color:#94a3b8;margin-top:5px}',
    /* 附件卡片 */
    '#pageContainer .pq-att{display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid #e8edf3;border-radius:6px;margin-bottom:8px;background:#fff}',
    '#pageContainer .pq-att .ic{font-size:18px;flex:none}',
    '#pageContainer .pq-att .bd{flex:1;min-width:0}',
    '#pageContainer .pq-att .t{font-size:12.5px;font-weight:600;color:#1f2937}',
    '#pageContainer .pq-att .u{font-size:11.5px;color:#64748b;word-break:break-all;margin-top:2px}',
    '#pageContainer .pq-att .u a{color:#244765;text-decoration:none}',
    '#pageContainer .pq-att .u a:hover{text-decoration:underline}',
    /* 预警条目 */
    '#pageContainer .pq-warn{border-left:3px solid #d98b2b;background:#fffbf5;padding:9px 11px;margin-bottom:8px;border-radius:0 6px 6px 0;font-size:12.5px;color:#8a6314}',
    /* 弹窗表单 */
    '#pageContainer .pq-form{display:grid;gap:10px;font-size:13px;color:#334155}',
    '#pageContainer .pq-form label{display:block;font-size:12px;color:#667085;font-weight:600;margin-bottom:4px}',
    '#pageContainer .pq-form input[type=text],#pageContainer .pq-form input[type=date],#pageContainer .pq-form input[type=number],#pageContainer .pq-form select,#pageContainer .pq-form textarea{width:100%;padding:7px 9px;border:1px solid #d1d8e0;border-radius:5px;font-size:13px;color:#1f2937;font-family:inherit;box-sizing:border-box}',
    '#pageContainer .pq-form textarea{min-height:64px;resize:vertical}',
    '#pageContainer .pq-form .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#pageContainer .pq-form .ck{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#334155;flex-wrap:wrap}',
    '#pageContainer .pq-form .ck input{width:auto}',
    '#pageContainer .pq-form .ck label{margin:0;display:inline;font-weight:400;font-size:12.5px;color:#334155}',
    /* 脱敏预览 */
    '#pageContainer .pq-mask{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;padding:9px 11px;font-size:12.5px;color:#475569;line-height:1.9}',
    /* 版本/日志条 */
    '#pageContainer .pq-logline{border-left:2px solid #e6edf5;padding:2px 0 2px 12px;margin:8px 0;font-size:12px;color:#475569;line-height:1.9}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  /* ==================== 状态 ==================== */
  var ST = {
    tab: '核心信息',
    page: { rep: 1, att: 1, rule: 1, miss: 1, exec: 1 },
    filter: { source: '全部', qc: '全部', histo: '全部', kw: '' },
    attFilter: { reportId: '全部', type: '全部', status: '全部' },
    ruleFilter: { enabled: '全部', type: '全部', kw: '' },
    detailId: ''
  };
  var PER = 10;

  function refresh() { window.renderPage(ST.tab === 'DETAIL' ? 'pq-case|' + ST.detailId : 'pq-workbench'); }
  function toast(msg, bad) { U.toast(msg, bad ? 'error' : 'success'); }
  function ok(res) { toast(res.msg || '操作成功', res.ok === false); if (res.ok !== false) refresh(); }
  function closeModal() { if (U.closeModal) U.closeModal(); }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function sel(id, opts, v) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      /* 支持 [value,label] 二元组、{v,l} 对象、纯字符串三种形式 */
      var val, l;
      if (Array.isArray(o)) { val = o[0]; l = o[1]; }
      else if (o && typeof o === 'object') { val = o.v; l = o.l; }
      else { val = o; l = o; }
      return '<option value="' + E(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + E(l) + '</option>';
    }).join('') + '</select>';
  }
  function formRow(label, inner) { return '<div><label>' + label + '</label>' + inner + '</div>'; }
  function switchHtml(id, on) { return '<label class="pq-switch"><input type="checkbox" data-pqrule="' + E(id) + '"' + (on ? ' checked' : '') + '><i></i></label>'; }

  /* 自建筛选条：避开其它 QC 模块对 filter:* 的通用代理 */
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
        return '<div class="fg"><label>' + E(f.label) + '</label><select data-pqf="' + E(f.key) + '">' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + E(f.label) + '</label><input type="text" data-pqf="' + E(f.key) + '" value="' + E(f.value || '') + '" placeholder="' + E(f.ph || '') + '"></div>';
    }).join('');
    return '<div class="qc-filter" style="--qc-fcols:' + fields.length + ';--pq-fcols:' + fields.length + '">' + html +
      '<div class="acts"><button class="btn btn-ghost btn-sm" data-qc="pq:filter:reset:' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="pq:filter:apply:' + key + '">查询</button></div></div>';
  }
  function readFilter() {
    var box = document.getElementById('pageContainer'), o = {};
    if (!box) return o;
    var els = box.querySelectorAll('[data-pqf]');
    for (var i = 0; i < els.length; i++) o[els[i].getAttribute('data-pqf')] = String(els[i].value || '').trim();
    return o;
  }

  /* ==================== 通用小组件 ==================== */
  function tabs() {
    var list = [['核心信息', '病理核心诊断信息'], ['附件索引', '病理附件与佐证'], ['规则配置', '病理质控规则']];
    return '<div class="qc-tabs">' + list.map(function (t) {
      return '<button class="' + (ST.tab === t[0] ? 'on' : '') + '" data-qc="pq:tab:' + t[0] + '">' + t[0] + '</button>';
    }).join('') + '</div>';
  }
  function head(sub) {
    return U.head('病理信息质控', sub, '', false,
      '<button class="btn btn-ghost btn-sm" data-qc="pq:reset">重置演示数据</button>');
  }
  function qcBadge(s) {
    var m = { '待质控': 'caution', '已修正': 'accent', '已归档': 'success' };
    return U.badge(s, m[s] || 'neutral');
  }
  function attStatusBadge(s) { return U.badge(s, s === '有效' ? 'success' : 'danger'); }
  function histoCell(r) {
    var v = D.validateHisto(r.histo);
    return v.ok ? '<span class="badge badge-success" title="' + E(v.reason || 'WHO 标准') + '">' + E(r.histo) + '</span>'
                : '<span class="badge badge-danger" title="' + E(v.reason) + '">' + E(r.histo || '缺失') + '</span>';
  }
  function marginCell(r) {
    var v = D.validateMarginLogic(r);
    return v.ok ? U.badge(r.margin || '—', r.margin === '阴性' ? 'success' : r.margin === '阳性' ? 'danger' : 'neutral')
                : '<span class="badge badge-warning" title="' + E(v.reason) + '">' + E(r.margin) + ' ⚠</span>';
  }
  function maskedName(name) { return D.maskValue(name, D.effectiveMaskMode()); }

  /* ==================== 页签① 病理核心信息 ==================== */
  function filteredReports() {
    var f = ST.filter;
    return D.reports().filter(function (r) {
      if (f.source !== '全部' && r.source !== f.source) return false;
      if (f.qc !== '全部' && r.qcState !== f.qc) return false;
      if (f.histo === '有效' && !D.validateHisto(r.histo).ok) return false;
      if (f.histo === '无效' && D.validateHisto(r.histo).ok) return false;
      if (f.kw) {
        var hay = [r.id, r.patientId, r.patientName, r.histo, r.hospital, r.doctor].join(' ');
        if (hay.indexOf(f.kw) < 0) return false;
      }
      return true;
    });
  }
  function renderCore() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '待质控报告', v: s.wait, unit: '份', tone: 'warn', m: '等待校验与补录', action: 'pq:core:qc:待质控' },
      { l: '已归档', v: s.archived, unit: '份', tone: 'up', m: '质控完成', action: 'pq:core:qc:已归档' },
      { l: '平均质量评分', v: s.avgScore.toFixed(1), unit: '分', tone: s.avgScore >= 85 ? 'up' : 'warn', m: '完整+规范+逻辑' },
      { l: 'WHO 编码异常', v: s.badHisto, unit: '项', tone: 'bad', m: '非标准术语/无效编码', action: 'pq:core:histo:无效' },
      { l: '切缘逻辑矛盾', v: s.marginConflict, unit: '项', tone: 'bad', m: '切缘状态与手术方式不符' },
      { l: '分子标志物缺失', v: s.missingMarkers, unit: '份', tone: 'warn', m: '系统未同步需补录' }
    ], 6);

    var acts = '<div class="pq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="pq:receive">接收病理核心诊断信息</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:check">批量校验（必填+WHO+逻辑）</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:export:wait">导出待质控病理数据</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:export:badhisto">导出非标准术语清单</button>' +
      '</div><span class="pq-hint">共 ' + s.reports + ' 份病理报告 · 完整性合格阈值 ' + s.threshold + '% · 当前脱敏策略：' + E(s.maskMode) + '</span></div>';

    var f = ST.filter;
    var filter = filterBar([
      { key: 'source', label: '数据来源', type: 'select', value: f.source, options: ['全部', '病理科系统', '电子病历', '手工录入'] },
      { key: 'qc', label: '质控状态', type: 'select', value: f.qc, options: ['全部'].concat(D.QC_STATES) },
      { key: 'histo', label: '组织学编码', type: 'select', value: f.histo, options: ['全部', '有效', '无效'] },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '病理报告号 / 患者ID / 姓名 / 编码' }
    ], 'rep');

    var list = filteredReports(), pg = U.slice(list, ST.page.rep, PER);
    var rows = pg.rows.map(function (r) {
      var ops = U.link('详情', 'pq:detail:' + r.id) + ' ' +
        U.link('补分子', 'pq:markers:' + r.id) + ' ' +
        U.link('修正', 'pq:fixfield:' + r.id) + ' ' +
        U.link('附件', 'pq:attachments:' + r.id) + ' ' +
        U.link('状态', 'pq:state:' + r.id);
      return { cells: [
        { h: '<code>' + E(r.id) + '</code>', cls: 'txt' },
        { h: E(r.patientId) + '<br><span style="color:#94a3b8;font-size:11px">' + E(maskedName(r.patientName)) + '</span>', cls: 'txt' },
        { h: histoCell(r), cls: 'txt' },
        { h: E(r.diff || '—'), cls: 'txt' },
        { h: marginCell(r), cls: 'center' },
        { h: E(r.surgery || '—'), cls: 'txt' },
        { h: (r.lnp == null ? '—' : r.lnp) + ' / ' + (r.lnt == null ? '—' : r.lnt), cls: 'num' },
        { h: r.markers.length ? E(r.markers.join('、')) : '<span style="color:#b42335">缺失</span>', cls: 'txt' },
        { h: '<b style="color:' + (r.score >= 85 ? '#2e7d32' : r.score >= 70 ? '#b54708' : '#b42335') + '">' + r.score + '</b>', cls: 'num' },
        { h: qcBadge(r.qcState), cls: 'center' },
        { h: 'v' + r.ver, cls: 'num' },
        { h: ops, cls: 'act' }
      ], cls: r.qcState === '待质控' && r.score < 70 ? 'abn-row' : '' };
    });
    var table = U.table(
      ['病理报告号', '患者ID', '组织学类型(WHO)', '分化程度', '切缘状态', '手术方式', '#转移/总数', '分子标志物', '#质量评分', '质控状态', '#版本', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的病理报告' });

    /* 切缘逻辑矛盾清单（A7） */
    var conflicts = D.reports().filter(function (r) { return !D.validateMarginLogic(r).ok; });
    var conflictRows = conflicts.map(function (r) {
      var v = D.validateMarginLogic(r);
      return { cells: [
        { h: '<code>' + E(r.id) + '</code>', cls: 'txt' }, { h: E(maskedName(r.patientName)), cls: 'txt' },
        { h: U.badge(r.margin, 'danger'), cls: 'center' }, { h: E(r.surgery), cls: 'txt' },
        { h: E(v.reason), cls: 'txt' }, { h: E(v.suggest), cls: 'txt' },
        { h: U.link('修正', 'pq:fixfield:' + r.id), cls: 'act' }
      ] };
    });
    var conflictCard = U.card('切缘状态与手术方式逻辑一致性校验（A7）',
      U.table(['病理报告号', '患者', '切缘状态', '手术方式', '潜在矛盾', '建议', '操作'], conflictRows,
        { compact: true, fit: true, empty: '暂无逻辑矛盾项' }) + U.note('检查切缘状态（阴性/阳性）与手术记录中的切除范围是否匹配，发现矛盾项提示核对。'));

    return '<div class="pq-page">' + head('病理核心诊断信息台账 · 质控任务的基础输入') + tabs() + kpi + acts + filter +
      U.card('', table + U.pager(list.length, ST.page.rep, PER, 'pqrep')) + conflictCard +
      U.note('质量评分 = 必填完整性 40 分（7 字段）+ 编码规范性 25 分（WHO 组织学）+ 逻辑一致性 35 分（切缘/手术、淋巴结论、分子标志物）。患者姓名按当前脱敏规则展示。') +
      '</div>';
  }

  /* ==================== 页签② 病理附件索引 ==================== */
  function renderAttachments() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '附件链接总数', v: s.attachments, unit: '条', tone: 'info', m: '三类附件 URL 映射' },
      { l: '有效链接', v: s.attOk, unit: '条', tone: 'up', m: '校验可访问' },
      { l: '失效链接', v: s.attBad, unit: '条', tone: 'bad', m: '需重新上传', action: 'pq:att:status:失效' },
      { l: '附件缺失报告', v: s.attMissing, unit: '份', tone: 'warn', m: '缺关键佐证材料' },
      { l: '重复链接', v: D.duplicateAttachments().length, unit: '条', tone: 'warn', m: '同报告同类型同 URL' },
      { l: '关联报告数', v: D.reports().length, unit: '份', tone: 'info', m: '可追溯原始诊断内容' }
    ], 6);

    var acts = '<div class="pq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="pq:att:add:report">+ 关联报告原文</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:att:add:micro">+ 关联显微图像</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:att:add:stain">+ 关联染色图谱</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:att:check">校验附件URL有效性</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:export:att">导出附件索引配置清单</button>' +
      '</div></div>';

    var f = ST.attFilter;
    var filter = filterBar([
      { key: 'reportId', label: '病理报告号', type: 'select', value: f.reportId, options: ['全部'].concat(D.reports().map(function (r) { return r.id; })) },
      { key: 'type', label: '附件类型', type: 'select', value: f.type, options: ['全部'].concat(D.ATT_TYPES.map(function (t) { return [t.id, t.name]; })) },
      { key: 'status', label: 'URL 状态', type: 'select', value: f.status, options: ['全部', '有效', '失效'] }
    ], 'att');

    var list = D.attachments().filter(function (a) {
      if (f.reportId !== '全部' && a.reportId !== f.reportId) return false;
      if (f.type !== '全部' && a.type !== f.type) return false;
      if (f.status !== '全部' && a.status !== f.status) return false;
      return true;
    });
    var pg = U.slice(list, ST.page.att, PER);
    var rows = pg.rows.map(function (a) {
      var t = D.ATT_TYPES.filter(function (x) { return x.id === a.type; })[0] || { name: a.type, icon: '📎' };
      var dupe = D.duplicateAttachments().some(function (x) { return x.id === a.id; });
      return { cells: [
        { h: '<code>' + E(a.id) + '</code>', cls: 'txt' },
        { h: '<code>' + E(a.reportId) + '</code>', cls: 'txt' },
        { h: t.icon + ' ' + E(t.name), cls: 'txt' },
        { h: '<a href="' + E(a.url) + '" target="_blank" rel="noopener" style="color:#244765;font-size:11.5px">' + E(a.url) + '</a>', cls: 'txt' },
        { h: attStatusBadge(a.status) + (dupe ? ' ' + U.badge('重复', 'caution') : ''), cls: 'center' },
        { h: E(a.linkedAt), cls: 'num' },
        { h: E(a.checkedAt || '—'), cls: 'num' },
        { h: E(a.checkReason || '—'), cls: 'txt' },
        { h: U.link('查看', 'pq:att:view:' + a.id) + ' ' + U.link('删除', 'pq:att:del:' + a.id), cls: 'act' }
      ], cls: a.status === '失效' ? 'abn-row' : '' };
    });
    var table = U.table(
      ['附件ID', '病理报告号', '附件类型', 'URL', '状态', '#关联时间', '#校验时间', '校验结果', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的附件链接' });

    /* 附件缺失预警清单（B5） */
    var miss = D.missingAttachments(), mpg = U.slice(miss, ST.page.miss, PER);
    var mrows = mpg.rows.map(function (m) {
      return { cells: [
        { h: '<code>' + E(m.reportId) + '</code>', cls: 'txt' },
        { h: E(m.patientId) + '（' + E(maskedName(m.patientName)) + '）', cls: 'txt' },
        { h: '<span style="color:#b42335">' + E(m.missing.join('、')) + '</span>', cls: 'txt' },
        { h: m.badCount ? U.badge(m.badCount + ' 条失效', 'danger') : '—', cls: 'center' },
        { h: U.link('去补传', 'pq:att:add:report') + ' ' + U.link('查看全部附件', 'pq:attachments:' + m.reportId), cls: 'act' }
      ] };
    });
    var missCard = U.card('附件缺失预警清单（B5）',
      U.table(['病理报告号', '患者', '缺失的关键附件', '失效链接', '操作'], mrows,
        { compact: true, fit: true, empty: '全部报告关键附件齐全' }) + U.note('列出缺少病理报告原文、显微图像、染色图谱的病理报告，提示补充佐证材料。')) +
      U.pager(miss.length, ST.page.miss, PER, 'pqmiss');

    return '<div class="pq-page">' + head('病理附件索引 · 原文 / 显微图像 / 染色图谱 URL 映射') + tabs() + kpi + acts + filter +
      U.card('附件索引清单', table + U.pager(list.length, ST.page.att, PER, 'pqatt')) + missCard +
      '</div>';
  }

  /* ==================== 页签③ 病理质控规则配置 ==================== */
  function renderRules() {
    var s = D.stats(), rules = D.rules(), probs = D.problems();
    var fixed = probs.filter(function (p) { return p.status === '已修复'; }).length;
    var kpi = U.kpis([
      { l: '启用规则', v: s.rulesOn, unit: '条', tone: 'info', m: '共 ' + s.rules + ' 条已配置' },
      { l: '累计触发', v: probs.length, unit: '次', tone: 'warn', m: '规则命中异常记录' },
      { l: '待修复', v: s.openProblems, unit: '条', tone: 'bad', m: '异常尚未闭环' },
      { l: '修复率', v: probs.length ? (fixed / probs.length * 100).toFixed(1) : '0.0', unit: '%', tone: 'up', m: fixed + ' / ' + probs.length + ' 已修复' },
      { l: '完整性阈值', v: s.threshold, unit: '%', tone: 'info', m: '低于此值视为无效病例' },
      { l: '脱敏策略', v: s.maskMode, tone: 'info', m: '姓名/患者ID 展示与导出生效' }
    ], 6);

    var chartData = rules.map(function (r) {
      var st2 = D.ruleStats(r.id);
      return { l: r.id.replace('PQR-', 'R'), v: st2.hits, color: r.enabled ? '#3d5a80' : '#cbd5e1' };
    });
    var chartCard = U.card('质控规则执行日志 / 效能分析（C5）', U.barChart(chartData, { unit: '次', height: 170 }) +
      U.table(['规则ID', '规则名称', '类型', '触发次数', '问题数量', '已修复', '修复率', '启用', '更新时间'],
        D.executionLog().map(function (x) { return { cells: [
          { h: '<code>' + E(x.id) + '</code>', cls: 'txt' }, { h: E(x.name), cls: 'txt' }, { h: E(x.type), cls: 'center' },
          { h: x.hits, cls: 'num' }, { h: x.problems, cls: 'num' }, { h: x.fixed, cls: 'num' },
          { h: x.fixRate.toFixed(1) + '%', cls: 'num' }, { h: x.enabled ? U.badge('启用', 'success') : U.badge('停用', 'neutral'), cls: 'center' },
          { h: E(x.updatedAt), cls: 'num' }
        ] }; }), { compact: true, fit: true }) +
      U.note('记录每条规则的触发次数、问题数量、修复率等运行情况，生成规则效能分析报表。'), '',
      '<button class="btn btn-ghost btn-sm" data-qc="pq:export:rules">导出质控规则配置清单</button>');

    var acts = '<div class="pq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="pq:rule:add:强制填报">+ 配置强制填报字段</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:rule:add:逻辑校验">+ 定义逻辑校验规则</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:rule:add:脱敏规则">+ 设置脱敏规则</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:rule:add:完整性阈值">+ 设置完整性阈值</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:export:rules">导出规则配置清单</button>' +
      '</div></div>';

    var f = ST.ruleFilter;
    var filter = filterBar([
      { key: 'enabled', label: '启用状态', type: 'select', value: f.enabled, options: ['全部', '启用', '停用'] },
      { key: 'type', label: '规则类型', type: 'select', value: f.type, options: ['全部'].concat(D.RULE_TYPES) },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '规则名称 / 编号 / 条件' }
    ], 'rule');

    var rlist = rules.filter(function (r) {
      if (f.enabled !== '全部' && (r.enabled ? '启用' : '停用') !== f.enabled) return false;
      if (f.type !== '全部' && r.type !== f.type) return false;
      if (f.kw && (r.name + r.id + r.cond).indexOf(f.kw) < 0) return false;
      return true;
    });
    var pg = U.slice(rlist, ST.page.rule, PER);
    var rows = pg.rows.map(function (r) {
      var st2 = D.ruleStats(r.id);
      var extra = r.type === '强制填报' ? ('字段：' + (r.fields || []).join('、'))
                : r.type === '脱敏规则' ? ('策略：' + (r.maskMode || '掩码') + '；字段：' + (r.fields || []).join('、'))
                : r.type === '完整性阈值' ? ('阈值：' + r.threshold + '%') : '';
      return { cells: [
        { h: '<code>' + E(r.id) + '</code>', cls: 'txt' },
        { h: E(r.name), cls: 'txt' },
        { h: U.badge(r.type, 'info'), cls: 'center' },
        { h: '<span style="font-size:11.5px">' + E(r.cond) + (extra ? '<br><span style="color:#94a3b8">' + E(extra) + '</span>' : '') + '</span>', cls: 'txt' },
        { h: U.badge(r.severity, r.severity === '强拦截' ? 'danger' : r.severity === '提示' ? 'caution' : 'neutral'), cls: 'center' },
        { h: st2.hits + ' / 待修复 ' + st2.open, cls: 'num' },
        { h: st2.fixRate.toFixed(1) + '%', cls: 'num' },
        { h: switchHtml(r.id, r.enabled), cls: 'center' },
        { h: U.link('异常详情', 'pq:rule:detail:' + r.id) + ' ' + U.link('编辑', 'pq:rule:edit:' + r.id) + ' ' + U.link('删除', 'pq:rule:del:' + r.id), cls: 'act' }
      ] };
    });
    var table = U.table(
      ['规则ID', '规则名称', '规则类型', '校验条件 / 配置', '错误等级', '#触发/待修复', '#修复率', '启用状态', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的规则' });

    /* 脱敏预览（C3 直观呈现） */
    var sample = D.reports()[0];
    var maskCard = U.card('脱敏规则预览（C3）',
      '<div class="pq-mask">当前策略：<b>' + E(D.effectiveMaskMode()) + '</b><br>' +
      '原始姓名：' + E(sample ? sample.patientName : '—') + '　→　脱敏展示：<b>' + E(sample ? maskedName(sample.patientName) : '—') + '</b><br>' +
      '原始患者ID：' + E(sample ? sample.patientId : '—') + '　→　脱敏展示：<b>' + E(sample ? D.maskValue(sample.patientId, D.effectiveMaskMode()) : '—') + '</b><br>' +
      '导出 CSV 时姓名/患者ID 列同样按此策略处理。</div>' + U.note('可在「设置脱敏规则」弹窗中切换掩码 / 哈希 / 替换策略，实时生效。'));

    return '<div class="pq-page">' + head('病理质控规则配置 · 强制填报 / 逻辑校验 / 脱敏 / 完整性阈值') + tabs() + kpi + acts + chartCard + filter +
      U.card('规则配置清单', table + U.pager(rlist.length, ST.page.rule, PER, 'pqrule')) + maskCard +
      '</div>';
  }

  /* ==================== 隐藏详情页 ==================== */
  function renderDetail(r) {
    var sc = D.scoreOf(r), hv = D.validateHisto(r.histo), ml = D.validateMarginLogic(r);
    var probs = D.problems().filter(function (p) { return p.reportId === r.id && p.status === '待修复'; });
    var fixedProbs = D.problems().filter(function (p) { return p.reportId === r.id && p.status === '已修复'; });
    var atts = D.attachments(r.id);

    var acts = '<button class="btn btn-ghost btn-sm" data-qc="pq:back">← 返回核心信息台账</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="pq:markers:' + r.id + '">补录分子标志物</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="pq:fixfield:' + r.id + '">修正主数据（升版本）</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="pq:detail:export:' + r.id + '">导出质控报告</button>';
    var hd = U.head('病理核心信息详情', r.id + ' · ' + maskedName(r.patientName) + ' · ' + r.hospital, '', false,
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + acts + '</div>');

    var base = U.card('病理核心诊断信息（A5 · 查询某病例的全部病理核心信息）', U.kv([
      ['病理报告号', '<code>' + E(r.id) + '</code>'], ['患者ID', E(r.patientId)], ['患者姓名（脱敏）', E(maskedName(r.patientName))],
      ['肿瘤组织学类型', histoCell(r)], ['WHO 标准名称/编码', hv.ok ? E(hv.name || hv.code || '—') : '<span style="color:#b42335">' + E(hv.reason) + '</span>'],
      ['分化程度', E(r.diff || '—')], ['切缘状态', marginCell(r)], ['手术方式', E(r.surgery || '—')],
      ['淋巴结转移数', r.lnp == null ? '—' : r.lnp], ['淋巴结总数', r.lnt == null ? '—' : r.lnt],
      ['脉管侵犯', E(r.vascular || '—')], ['神经侵犯', E(r.neural || '—')],
      ['免疫组化结果', E(r.ihc || '—')], ['分子标志物', r.markers.length ? E(r.markers.join('、')) : '<span style="color:#b42335">缺失</span>'],
      ['报告医院', E(r.hospital || '—')], ['报告医师', E(r.doctor || '—')], ['签发时间', E(r.signAt || '—')],
      ['数据来源', U.badge(r.source, 'info')], ['质控状态', qcBadge(r.qcState)], ['数据版本号', '<b>v' + r.ver + '</b>']
    ], 3));

    var scoreLines = sc.items.map(function (x) {
      return '<div class="pq-score-item"><span>' + E(x.name) + (x.note ? '<br><span style="color:#94a3b8;font-size:11px">' + E(x.note) + '</span>' : '') +
        (x.fail.length ? '<br><span style="color:#b42335;font-size:11px">' + E(x.fail.join('；')) + '</span>' : '') + '</span><b>' + x.got + ' / ' + x.full + '</b></div>';
    }).join('');
    var scoreCard = U.grid13(
      U.card('病理核心信息质量评分（A4）', U.scoreCard(sc.total, sc.total >= 85 ? '优秀' : sc.total >= 70 ? '合格' : '待整改', [
        '完整性 40 + 编码规范 25 + 逻辑一致 35', '字段填写率 ' + sc.completeness.pct + '%（阈值 ' + D.stats().threshold + '%）'
      ])), U.card('评分构成明细', scoreLines));

    /* 校验问题 */
    var pRows = probs.map(function (p) {
      var rule = D.ruleById(p.ruleId);
      return { cells: [
        { h: '<code>' + E(p.id) + '</code>', cls: 'txt' }, { h: E(rule ? rule.name : p.ruleId), cls: 'txt' },
        { h: E(p.field) + '：' + E(p.value || '空'), cls: 'txt' }, { h: E(p.detail), cls: 'txt' },
        { h: p.suggest ? '<b style="color:#244765">' + E(p.suggest) + '</b>' : '—', cls: 'txt' },
        { h: U.link('修复', 'pq:fix:' + p.id), cls: 'act' }
      ] };
    });
    var whoNote = !hv.ok ? U.note('WHO 组织学类型编码校验（A3）：' + hv.reason + (hv.suggest ? '，建议值 <b>' + hv.suggest + '</b>' : ''), true) : '';
    var marginNote = !ml.ok ? U.note('切缘状态与手术方式逻辑一致性（A7）：' + ml.reason + '；建议：' + ml.suggest, true) : '';
    var probCard = U.card('校验问题清单（A3 / A7）',
      U.table(['异常ID', '触发规则', '异常字段/值', '异常详情', '建议值', '操作'], pRows,
        { compact: true, fit: true, empty: '当前报告无待修复异常' }) + whoNote + marginNote);

    /* 附件列表（B6） */
    var attRows = atts.map(function (a) {
      var t = D.ATT_TYPES.filter(function (x) { return x.id === a.type; })[0] || { name: a.type, icon: '📎' };
      return { cells: [
        { h: t.icon + ' ' + E(t.name), cls: 'txt' },
        { h: '<a href="' + E(a.url) + '" target="_blank" rel="noopener" style="color:#244765;font-size:11.5px">' + E(a.url) + '</a>', cls: 'txt' },
        { h: attStatusBadge(a.status), cls: 'center' }, { h: E(a.linkedAt), cls: 'num' },
        { h: U.link('删除', 'pq:att:del:' + a.id), cls: 'act' }
      ] };
    });
    var attCard = U.card('该病例关联的全部附件（B6）',
      U.table(['附件类型', 'URL', '状态', '#关联时间', '操作'], attRows, { compact: true, fit: true, empty: '该报告暂无附件，需补充佐证材料' }));

    /* 版本历史（A8） */
    var verRows = (r.verLog || []).map(function (v) { return { cells: [{ h: E(v.at), cls: 'num' }, { h: E(v.who), cls: 'txt' }, { h: E(v.what), cls: 'txt' }] }; });
    var verCard = U.card('数据版本历史（A8 · 版本回溯）',
      U.table(['#变更时间', '操作人', '变更内容'], verRows, { compact: true, fit: true, empty: '暂无版本记录' }) +
      U.note('每次补录分子标志物或修正字段后版本号自动 +1，保留完整历史变更轨迹。'));

    /* 修复记录 */
    var fixCard = fixedProbs.length ? U.card('本病例修复记录',
      fixedProbs.map(function (p) { return '<div class="pq-logline"><b>' + E(p.id) + '</b> · ' + E(p.fixAt) + ' · ' + E(p.fixer) + '<br>' + E(p.fixContent) + '</div>'; }).join('')) : '';

    return '<div class="pq-page">' + hd + base + scoreCard + probCard + U.grid2(attCard, verCard) + fixCard + '</div>';
  }

  /* ==================== 弹窗 ==================== */
  function modal(title, body, footer) { U.modal(title, body, footer || ''); }

  function receiveModal() {
    modal('接收病理核心诊断信息（A1）',
      '<div class="pq-form">' + formRow('数据来源', sel('pqf-src', ['病理科系统', '电子病历', '手工录入'], '病理科系统')) +
      formRow('本次接收条数', '<input type="number" id="pqf-cnt" value="3" min="1" max="10">') +
      '<div class="pq-hint">模拟从病理科信息系统或电子病历系统批量获取病理核心诊断数据（病理报告号、组织学类型、分化程度、切缘状态、淋巴结转移数、脉管/神经侵犯、免疫组化、分子标志物、报告医院/医师、签发时间），接收后自动纳入质控并重跑校验。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:receive:do">确认接收</button>');
  }
  function markersModal(r) {
    modal('补录缺失的分子标志物信息（A2） · ' + r.id,
      '<div class="pq-form">' + formRow('患者 / 当前标志物', '<div style="font-size:12.5px;color:#475569">' + E(maskedName(r.patientName)) + '（' + E(r.patientId) + '）· 当前：<b>' + E(r.markers.join('、') || '缺失') + '</b></div>') +
      formRow('补录标志物（逗号分隔）', '<input type="text" id="pqf-markers" placeholder="例如：EGFR, ALK, ROS1, PD-L1" value="">') +
      formRow('补录依据 / 备注', '<input type="text" id="pqf-mnote" placeholder="例如：系统未同步，依据分子检测报告补录">') +
      '<div class="pq-hint">提交后分子标志物更新、版本号 +1，写入版本留痕与操作日志，并重跑规则校验。可选值：' + E(D.MARKERS.join(' / ')) + '</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:markers:do:' + r.id + '">保存补录</button>');
  }
  function fixfieldModal(r) {
    var fields = [['histo', '肿瘤组织学类型(WHO)'], ['diff', '分化程度'], ['margin', '切缘状态'], ['surgery', '手术方式'],
                  ['lnp', '淋巴结转移数'], ['lnt', '淋巴结总数'], ['vascular', '脉管侵犯'], ['neural', '神经侵犯'],
                  ['ihc', '免疫组化结果'], ['hospital', '报告医院'], ['doctor', '报告医师']];
    modal('修正病理核心信息 / 更新版本号（A8） · ' + r.id,
      '<div class="pq-form">' + formRow('当前版本', '<div>v' + r.ver + ' · 质量评分 <b>' + r.score + '</b> 分</div>') +
      formRow('修正字段', sel('pqf-ff-field', fields.map(function (f) { return [f[0], f[1]]; }), 'histo')) +
      formRow('新值', '<input type="text" id="pqf-ff-value" placeholder="填写修正后的值（组织学类型建议用 WHO 编码如 8140/3）">') +
      '<div class="pq-hint">保存后版本号 +1，保留历史变更轨迹（支持版本回溯）；系统重算质量评分并重跑规则校验。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:fixfield:do:' + r.id + '">保存并重算</button>');
  }
  function stateModal(r) {
    modal('更新质控状态 · ' + r.id,
      '<div class="pq-form">' + formRow('当前状态', '<div>' + qcBadge(r.qcState) + '</div>') +
      formRow('目标状态', sel('pqf-state', D.QC_STATES, r.qcState)) + '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:state:do:' + r.id + '">确认更新</button>');
  }
  function attAddModal(type) {
    var t = D.ATT_TYPES.filter(function (x) { return x.id === type; })[0];
    var opts = D.reports().map(function (r) { return [r.id, r.id + '（' + maskedName(r.patientName) + '）']; });
    modal('关联' + t.name + 'URL（' + (type === 'report' ? 'B1' : type === 'micro' ? 'B2' : 'B3') + '）',
      '<div class="pq-form">' + formRow('病理报告', sel('pqf-att-report', opts, D.reports()[0] ? D.reports()[0].id : '')) +
      formRow(t.name + ' URL', '<input type="text" id="pqf-att-url" placeholder="' + (type === 'report' ? 'https://path.example.cn/report/xxx.pdf' : 'https://path.example.cn/images/xxx.png') + '">') +
      '<div class="pq-hint">接收并存储 PDF / HTML / 图像链接，确保可追溯原始诊断内容。系统自动校验 URL 格式与可访问性，失效链接会标记并提示重新上传。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:att:add:do:' + type + '">确认关联</button>');
  }
  function attViewModal(a) {
    var t = D.ATT_TYPES.filter(function (x) { return x.id === a.type; })[0] || { name: a.type };
    var v = D.validateUrl(a.url);
    modal('附件详情 · ' + a.id, U.kv([
      ['附件ID', '<code>' + E(a.id) + '</code>'], ['病理报告号', '<code>' + E(a.reportId) + '</code>'],
      ['附件类型', E(t.name)], ['URL', '<a href="' + E(a.url) + '" target="_blank" rel="noopener" style="color:#244765">' + E(a.url) + '</a>'],
      ['状态', attStatusBadge(a.status)], ['校验结果', E(a.checkReason || (v.ok ? '可访问' : v.reason))],
      ['关联时间', E(a.linkedAt)], ['校验时间', E(a.checkedAt || '—')], ['操作人', E(a.operator)]
    ], 2), '<button class="btn btn-ghost btn-sm" data-qc="pq:att:del:' + a.id + '">删除该链接</button>');
  }
  function attDelModal(a) {
    modal('删除无效或重复的附件链接（B7） · ' + a.id,
      '<div class="pq-form">' + formRow('附件信息', '<div style="font-size:12.5px;color:#475569">' + E(a.reportId) + ' · ' + E(a.url) + '</div>') +
      formRow('删除原因', sel('pqf-del-reason', ['误操作上传的重复链接', 'URL 失效且无法恢复', '附件与报告不匹配', '其它'], '误操作上传的重复链接')) + '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:att:del:do:' + a.id + '">确认删除</button>');
  }
  function attachmentsModal(r) {
    var atts = D.attachments(r.id);
    var body = atts.length ? atts.map(function (a) {
      var t = D.ATT_TYPES.filter(function (x) { return x.id === a.type; })[0] || { name: a.type, icon: '📎' };
      return '<div class="pq-att"><div class="ic">' + t.icon + '</div><div class="bd"><div class="t">' + E(t.name) + ' ' + attStatusBadge(a.status) + '</div>' +
        '<div class="u"><a href="' + E(a.url) + '" target="_blank" rel="noopener">' + E(a.url) + '</a></div></div>' +
        U.link('查看', 'pq:att:view:' + a.id) + ' ' + U.link('删除', 'pq:att:del:' + a.id) + '</div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12.5px">该报告暂无附件链接</div>';
    modal('该病例的全部附件列表（B6） · ' + r.id, body);
  }

  function ruleFormModal(type, r) {
    var isNew = !r;
    r = r || { name: '', type: type, cond: '', severity: '提示', enabled: true, desc: '', fields: [], maskMode: '掩码', threshold: 80 };
    var extra = '';
    if (type === '强制填报') {
      extra = '<div><label>强制填报字段（可多选）</label><div class="ck">' +
        D.CORE_FIELDS.map(function (f) { return '<label><input type="checkbox" class="pq-rf" value="' + E(f[0]) + '"' + ((r.fields || []).indexOf(f[0]) >= 0 ? ' checked' : '') + '> ' + E(f[1]) + '</label>'; }).join('') +
        '</div></div>';
    } else if (type === '脱敏规则') {
      extra = '<div class="row2">' + formRow('脱敏策略', sel('pqf-r-mask', D.MASK_MODES, r.maskMode)) +
        formRow('适用字段', '<input type="text" id="pqf-r-fields" value="' + E((r.fields && r.fields.length) ? r.fields.join(',') : 'patientName,patientId') + '" placeholder="patientName,patientId">') + '</div>' +
        '<div class="pq-mask">预览：' + E(D.maskValue('王建国', r.maskMode || '掩码')) + '（以「王建国」为例）</div>';
    } else if (type === '完整性阈值') {
      extra = formRow('合格阈值（%）', '<input type="number" id="pqf-r-th" value="' + (r.threshold || 80) + '" min="1" max="100">');
    } else {
      extra = formRow('校验条件表达式', '<textarea id="pqf-r-cond2" placeholder="例如：淋巴结转移数 > 0 时，必须填写淋巴结总数">' + E(r.cond || '') + '</textarea>');
    }
    modal((isNew ? '配置新增' : '编辑') + '「' + type + '」规则（C1/C2/C3/C4）' + (isNew ? '' : ' · ' + r.id),
      '<div class="pq-form">' + formRow('规则名称', '<input type="text" id="pqf-r-name" value="' + E(r.name) + '" placeholder="例如：切缘状态与手术方式一致性">') +
      extra +
      '<div class="row2">' + formRow('错误等级', sel('pqf-r-sev', D.SEVERITIES, r.severity)) +
      formRow('启用状态', sel('pqf-r-en', [['1', '启用'], ['0', '停用']], r.enabled ? '1' : '0')) + '</div>' +
      formRow('规则说明', '<input type="text" id="pqf-r-desc" value="' + E(r.desc || '') + '">') +
      '<div class="pq-hint">创建人/创建时间/更新时间由系统自动维护；停用规则不再参与新校验，但历史异常与修复记录保留。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:rule:save:' + (isNew ? 'add|' + type : r.id) + '">保存规则</button>');
  }
  function ruleDetailModal(r) {
    var ps = D.problems(r.id), st2 = D.ruleStats(r.id);
    var body = U.kv([
      ['规则ID', '<code>' + E(r.id) + '</code>'], ['规则名称', E(r.name)], ['规则类型', E(r.type)],
      ['校验条件', E(r.cond)], ['错误等级', U.badge(r.severity, r.severity === '强拦截' ? 'danger' : 'neutral')],
      ['启用状态', r.enabled ? U.badge('启用', 'success') : U.badge('停用', 'neutral')],
      ['创建人 / 时间', E(r.creator) + ' / ' + E(r.createdAt)], ['更新时间', E(r.updatedAt)],
      ['触发 / 待修复 / 修复率', st2.hits + ' / ' + st2.open + ' / ' + st2.fixRate.toFixed(1) + '%']
    ], 2) + '<div style="margin-top:12px;border-top:1px solid #eef2f7;padding-top:10px"><b style="font-size:12.5px">命中异常详情</b>' +
      (ps.length ? ps.map(function (p) {
        var rep = D.reportById(p.reportId);
        return '<div class="pq-prob"><div class="h"><span>' + E(p.id) + ' · ' + E(p.reportId) + (rep ? '（' + E(maskedName(rep.patientName)) + '）' : '') + '</span>' +
          (p.status === '待修复' ? U.link('修复', 'pq:fix:' + p.id) : U.badge('已修复', 'success')) + '</div>' +
          '<div class="d">字段 <b>' + E(p.field) + '</b>（' + E(p.value || '空') + '）：' + E(p.detail) + (p.suggest ? '<br>建议值：<b>' + E(p.suggest) + '</b>' : '') + '</div>' +
          '<div class="f">校验时间 ' + E(p.foundAt) + (p.status === '已修复' ? ' · 修复人 ' + E(p.fixer) + ' · ' + E(p.fixContent) : '') + '</div></div>';
      }).join('') : '<div style="color:#94a3b8;font-size:12.5px;padding:8px 0">该规则暂无异常记录</div>') + '</div>';
    modal('规则详情 · ' + r.name, body);
  }
  function fixModal(p) {
    var rep = D.reportById(p.reportId);
    modal('修复异常 · ' + p.id,
      '<div class="pq-form">' + formRow('关联报告 / 异常详情', '<div style="font-size:12.5px;color:#475569">' + E(p.reportId) + (rep ? '（' + E(maskedName(rep.patientName)) + '）' : '') + ' · 字段 <b>' + E(p.field) + '</b>（' + E(p.value || '空') + '）<br>' + E(p.detail) + '</div>') +
      formRow('修复人', '<input type="text" id="pqf-fix-who" value="' + E(D.ACTOR) + '">') +
      formRow('修复内容', '<textarea id="pqf-fix-content" placeholder="填写修正内容">' + (p.suggest ? '按建议修正为 ' + E(p.suggest) : '') + '</textarea>') + '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="pq:fix:do:' + p.id + '">确认修复</button>');
  }

  /* ==================== 导出 ==================== */
  function exportWait() {
    var list = D.reports().filter(function (r) { return r.qcState === '待质控'; });
    D.exportCsv('待质控病理数据', ['病理报告号', '患者ID', '患者姓名', '组织学类型', '分化程度', '切缘状态', '手术方式', '转移数', '总数', '脉管侵犯', '神经侵犯', '免疫组化', '分子标志物', '报告医院', '报告医师', '签发时间', '质量评分', '质控状态', '版本', '数据来源'],
      list.map(function (r) { return [r.id, r.patientId, r.patientName, r.histo, r.diff, r.margin, r.surgery, r.lnp, r.lnt, r.vascular, r.neural, r.ihc, r.markers.join('/'), r.hospital, r.doctor, r.signAt, r.score, r.qcState, r.ver, r.source]; }));
    toast('已导出待质控病理数据 ' + list.length + ' 份（CSV，姓名已脱敏）');
  }
  function exportBadHisto() {
    var rows = D.reports().filter(function (r) { return !D.validateHisto(r.histo).ok; }).map(function (r) {
      var v = D.validateHisto(r.histo);
      return [r.id, r.patientId, r.histo, v.reason, v.suggest];
    });
    D.exportCsv('非标准组织学术语清单', ['病理报告号', '患者ID', '原始组织学类型', '异常原因', 'WHO 建议值'], rows);
    toast('已导出非标准术语 ' + rows.length + ' 项（含建议值）');
  }
  function exportAttachments() {
    D.exportCsv('病理附件索引配置清单', ['附件ID', '病理报告号', '附件类型', 'URL', '状态', '关联时间', '校验时间', '校验结果', '操作人'],
      D.attachments().map(function (a) {
        var t = D.ATT_TYPES.filter(function (x) { return x.id === a.type; })[0];
        return [a.id, a.reportId, t ? t.name : a.type, a.url, a.status, a.linkedAt, a.checkedAt, a.checkReason || '', a.operator];
      }));
    toast('已导出附件索引配置清单（CSV）');
  }
  function exportRules() {
    D.exportCsv('病理质控规则配置清单', ['规则ID', '规则名称', '规则类型', '校验条件', '强制字段', '脱敏策略', '完整性阈值', '错误等级', '启用状态', '创建人', '创建时间', '更新时间', '触发次数', '修复率(%)'],
      D.rules().map(function (r) { var s2 = D.ruleStats(r.id); return [r.id, r.name, r.type, r.cond, (r.fields || []).join('/'), r.maskMode || '', r.threshold || '', r.severity, r.enabled ? '启用' : '停用', r.creator, r.createdAt, r.updatedAt, s2.hits, s2.fixRate]; }));
    toast('已导出质控规则配置清单（CSV）');
  }
  function exportDetailReport(r) {
    D.exportJson('病理质控报告_' + r.id, {
      exportedAt: D.now(), report: Object.assign({}, r, { patientName: maskedName(r.patientName) }),
      qualityScore: D.scoreOf(r), whoValidation: D.validateHisto(r.histo), marginValidation: D.validateMarginLogic(r),
      attachments: D.attachments(r.id), problems: D.problems().filter(function (p) { return p.reportId === r.id; }),
      executionLog: D.executionLog()
    });
    toast('已导出该病例质控报告（JSON，含质量评分）');
  }

  /* ==================== 页面分发 / 路由 ==================== */
  function renderWorkbench() {
    if (ST.tab === '附件索引') return renderAttachments();
    if (ST.tab === '规则配置') return renderRules();
    return renderCore();
  }
  function renderPageId(id) {
    if (id.indexOf('pq-case|') === 0) {
      var r = D.reportById(id.slice(8));
      if (!r) return U.head('病理报告不存在', '', '', false, '<button class="btn btn-ghost btn-sm" data-qc="pq:back">← 返回</button>') + U.note('未找到该病理报告号对应的记录。', true);
      return renderDetail(r);
    }
    return renderWorkbench();
  }
  function openCase(id) {
    ST.tab = 'DETAIL'; ST.detailId = id;
    try { history.replaceState(null, '', '#pq-case|' + id); } catch (e) {}
    window.renderPage('pq-case|' + id);
  }
  function back() {
    ST.tab = '核心信息'; ST.detailId = '';
    try { history.replaceState(null, '', '#pq-workbench'); } catch (e) {}
    if (typeof window.navigateTo === 'function') window.navigateTo('pq-workbench');
  }

  /* ==================== 事件代理 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc') || '';
    /* 只处理本模块 pq: 前缀与分页，绝不碰通用 filter:* */
    if (a.indexOf('pq:') !== 0 && !/^(pqrep|pqatt|pqmiss|pqrule|pqexec):page:/.test(a)) return;
    function arg(pre) { return a.slice(pre.length); }
    function has(pre) { return a.indexOf(pre) === 0; }

    if (has('pq:tab:')) { ST.tab = arg('pq:tab:'); ST.detailId = ''; try { history.replaceState(null, '', '#pq-workbench'); } catch (e) {} refresh(); return; }
    if (a === 'pq:back') { back(); return; }
    if (a === 'pq:reset') {
      if (typeof showConfirm === 'function') showConfirm('重置演示数据', '确认将「病理信息质控」全部演示数据恢复为初始种子吗？当前会话内的报告、附件、规则与修复记录改动都会丢失。', function () {
        D.reset(); ST.tab = '核心信息'; ST.filter = { source: '全部', qc: '全部', histo: '全部', kw: '' };
        ST.attFilter = { reportId: '全部', type: '全部', status: '全部' }; toast('演示数据已重置'); refresh();
      });
      return;
    }

    /* 筛选 */
    if (a === 'pq:filter:apply:rep') { var vf = readFilter(); ST.filter = { source: vf.source || '全部', qc: vf.qc || '全部', histo: vf.histo || '全部', kw: vf.kw || '' }; ST.page.rep = 1; refresh(); return; }
    if (a === 'pq:filter:reset:rep') { ST.filter = { source: '全部', qc: '全部', histo: '全部', kw: '' }; ST.page.rep = 1; refresh(); return; }
    if (a === 'pq:filter:apply:att') { var va = readFilter(); ST.attFilter = { reportId: va.reportId || '全部', type: va.type || '全部', status: va.status || '全部' }; ST.page.att = 1; refresh(); return; }
    if (a === 'pq:filter:reset:att') { ST.attFilter = { reportId: '全部', type: '全部', status: '全部' }; ST.page.att = 1; refresh(); return; }
    if (a === 'pq:filter:apply:rule') { var vr = readFilter(); ST.ruleFilter = { enabled: vr.enabled || '全部', type: vr.type || '全部', kw: vr.kw || '' }; ST.page.rule = 1; refresh(); return; }
    if (a === 'pq:filter:reset:rule') { ST.ruleFilter = { enabled: '全部', type: '全部', kw: '' }; ST.page.rule = 1; refresh(); return; }

    /* 分页 */
    var pm = /^(pqrep|pqatt|pqmiss|pqrule|pqexec):page:(\d+)$/.exec(a);
    if (pm) { var key = { pqrep: 'rep', pqatt: 'att', pqmiss: 'miss', pqrule: 'rule', pqexec: 'exec' }[pm[1]]; ST.page[key] = parseInt(pm[2], 10) || 1; refresh(); return; }

    /* KPI 快捷筛选 */
    if (has('pq:core:qc:')) { ST.filter.qc = arg('pq:core:qc:'); ST.page.rep = 1; ST.tab = '核心信息'; refresh(); return; }
    if (has('pq:core:histo:')) { ST.filter.histo = arg('pq:core:histo:'); ST.page.rep = 1; ST.tab = '核心信息'; refresh(); return; }
    if (has('pq:att:status:')) { ST.attFilter.status = arg('pq:att:status:'); ST.page.att = 1; ST.tab = '附件索引'; refresh(); return; }

    /* 核心信息动作 */
    if (a === 'pq:receive') { receiveModal(); return; }
    if (a === 'pq:receive:do') {
      var created = D.receiveBatch(val('pqf-src'), parseInt(val('pqf-cnt'), 10) || 3);
      closeModal(); toast('已从 ' + (val('pqf-src') || '病理科系统') + ' 接收 ' + created.length + ' 份病理报告，并自动完成校验'); refresh(); return;
    }
    if (a === 'pq:check') { var res = D.runChecks(); toast('批量校验完成：' + res.reports + ' 份报告 · 新增异常 ' + res.created + ' 条 · 自动关闭 ' + res.closed + ' 条 · 当前待修复 ' + res.problems + ' 条'); refresh(); return; }
    if (a === 'pq:export:wait') { exportWait(); return; }
    if (a === 'pq:export:badhisto') { exportBadHisto(); return; }
    if (a === 'pq:export:att') { exportAttachments(); return; }
    if (a === 'pq:export:rules') { exportRules(); return; }
    if (has('pq:detail:export:')) { var rde = D.reportById(arg('pq:detail:export:')); if (rde) exportDetailReport(rde); return; }
    if (has('pq:detail:')) { openCase(arg('pq:detail:')); return; }
    if (has('pq:markers:do:')) {
      var okm = D.supplementMarkers(arg('pq:markers:do:'), val('pqf-markers'), val('pqf-mnote'));
      closeModal(); toast(okm ? '分子标志物已补录，版本升级并重算评分/校验' : '报告不存在', !okm); refresh(); return;
    }
    if (has('pq:markers:')) { var rm = D.reportById(arg('pq:markers:')); if (rm) markersModal(rm); return; }
    if (has('pq:fixfield:do:')) {
      var idf = arg('pq:fixfield:do:'), field = val('pqf-ff-field'), nv = val('pqf-ff-value');
      if (!nv) { toast('请填写新值', true); return; }
      var okf = D.fixField(idf, field, nv);
      closeModal(); toast(okf ? '病理信息已修正，版本升级并重算评分/校验' : '报告不存在', !okf); refresh(); return;
    }
    if (has('pq:fixfield:')) { var rf = D.reportById(arg('pq:fixfield:')); if (rf) fixfieldModal(rf); return; }
    if (has('pq:state:do:')) { ok(D.setState(arg('pq:state:do:'), val('pqf-state'))); closeModal(); return; }
    if (has('pq:state:')) { var rs = D.reportById(arg('pq:state:')); if (rs) stateModal(rs); return; }
    if (has('pq:attachments:')) { var ra = D.reportById(arg('pq:attachments:')); if (ra) attachmentsModal(ra); return; }

    /* 附件动作 */
    if (has('pq:att:add:do:')) {
      var type = arg('pq:att:add:do:'), url = val('pqf-att-url'), rid = val('pqf-att-report');
      if (!url) { toast('请填写附件 URL', true); return; }
      var radd = D.addAttachment(rid, type, url);
      closeModal(); toast(radd.msg, !radd.ok); refresh(); return;
    }
    if (has('pq:att:add:')) { attAddModal(arg('pq:att:add:')); return; }
    if (a === 'pq:att:check') { var chk = D.checkUrls(); toast('附件 URL 校验完成：有效 ' + chk.ok + ' 条 · 失效 ' + chk.bad + ' 条'); refresh(); return; }
    if (has('pq:att:del:do:')) { ok(D.deleteAttachment(arg('pq:att:del:do:'), val('pqf-del-reason'))); closeModal(); return; }
    if (has('pq:att:del:')) {
      var aid = arg('pq:att:del:'), ad = D.attachments().filter(function (x) { return x.id === aid; })[0];
      if (ad) attDelModal(ad); return;
    }
    if (has('pq:att:view:')) {
      var av = D.attachments().filter(function (x) { return x.id === arg('pq:att:view:'); })[0];
      if (av) attViewModal(av); return;
    }

    /* 规则动作 */
    if (has('pq:rule:add:')) { ruleFormModal(arg('pq:rule:add:'), null); return; }
    if (has('pq:rule:edit:')) { var re = D.ruleById(arg('pq:rule:edit:')); if (re) ruleFormModal(re.type, re); return; }
    if (has('pq:rule:save:')) {
      var target = arg('pq:rule:save:'), isNew = target.indexOf('add|') === 0;
      var type2 = isNew ? target.slice(4) : (D.ruleById(target) || {}).type;
      var rule = { name: val('pqf-r-name'), type: type2, severity: val('pqf-r-sev'),
                   enabled: val('pqf-r-en') === '1', desc: val('pqf-r-desc'), cond: val('pqf-r-cond2') || val('pqf-r-name') };
      if (type2 === '强制填报') rule.fields = Array.from(document.querySelectorAll('.pq-rf:checked')).map(function (x) { return x.value; });
      if (type2 === '脱敏规则') { rule.maskMode = val('pqf-r-mask'); rule.fields = val('pqf-r-fields').split(/[,，]/).filter(Boolean); rule.cond = '对 ' + (rule.fields.join('、') || '敏感字段') + ' 应用' + rule.maskMode + '脱敏'; }
      if (type2 === '完整性阈值') { rule.threshold = parseInt(val('pqf-r-th'), 10) || 80; rule.cond = '至少 ' + rule.threshold + '% 核心字段填写才视为有效病例'; }
      if (!rule.name) { toast('请填写规则名称', true); return; }
      if (!isNew) rule.id = target;
      var rsave = D.saveRule(rule); closeModal(); toast(rsave.msg, !rsave.ok);
      D.runChecks(); refresh(); return;
    }
    if (has('pq:rule:detail:')) { var rd = D.ruleById(arg('pq:rule:detail:')); if (rd) ruleDetailModal(rd); return; }
    if (has('pq:rule:del:')) {
      var did = arg('pq:rule:del:');
      if (typeof showConfirm === 'function') showConfirm('删除质控规则', '确认删除规则 ' + did + ' 吗？其历史异常与修复记录将保留。', function () { D.deleteRule(did); closeModal(); toast('规则已删除'); refresh(); });
      return;
    }

    /* 异常修复（do 优先） */
    if (has('pq:fix:do:')) {
      var rfix = D.fixProblem(arg('pq:fix:do:'), val('pqf-fix-who'), val('pqf-fix-content'));
      closeModal(); toast(rfix.msg, !rfix.ok); refresh(); return;
    }
    if (has('pq:fix:')) {
      var fp = D.problems().filter(function (x) { return x.id === arg('pq:fix:'); })[0];
      if (fp) fixModal(fp); return;
    }
  });

  /* 启停开关 */
  document.addEventListener('change', function (ev) {
    var el = ev.target; if (!el || !el.getAttribute) return;
    var rid = el.getAttribute('data-pqrule'); if (!rid) return;
    var on = D.toggleRule(rid); toast('规则 ' + rid + (on ? ' 已启用' : ' 已停用'));
    D.runChecks(); refresh();
  });

  /* ==================== 路由接管 ==================== */
  var baseRender = (typeof window.renderPage === 'function') ? window.renderPage : function () {};
  window.renderPage = function (id) {
    if (id === 'pq-workbench' || (typeof id === 'string' && id.indexOf('pq-case|') === 0)) {
      if (id === 'pq-workbench') { ST.tab = ST.tab === 'DETAIL' ? '核心信息' : ST.tab; ST.detailId = ''; }
      else { ST.tab = 'DETAIL'; ST.detailId = id.slice(8); }
      document.getElementById('pageContainer').innerHTML = renderPageId(id);
      if (typeof setActiveMenu === 'function') setActiveMenu(id === 'pq-workbench' ? id : 'pq-workbench');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('pq-workbench', id === 'pq-workbench' ? '' : '病理核心信息详情');
      if (typeof autoSizeSelects === 'function') { try { autoSizeSelects(); } catch (e) {} }
      var mc = document.getElementById('mainContent'); if (mc && mc.scrollTop !== undefined) mc.scrollTop = 0;
      return;
    }
    return baseRender.apply(this, arguments);
  };
  /* hash 直达详情页兜底（initApp 白名单已放行 pq-case| 前缀） */
  document.addEventListener('DOMContentLoaded', function () {
    var h = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    if (h.indexOf('pq-case|') !== 0) return;
    var id = h.slice(8);
    if (ST.tab === 'DETAIL' && ST.detailId === id) return;
    openCase(id);
  });

  window.PQ = { state: ST, renderPageId: renderPageId, openCase: openCase, back: back, refresh: refresh };
})();
