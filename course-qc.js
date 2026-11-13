/* ============================================================================
 * course-qc.js — 专病病程质控 · 渲染层（window.DCQ）
 *
 * 单页 3 页签：病程记录 / 模板配置 / 关联索引
 * 隐藏详情页：dcq-case|<病程ID>（菜单不占位）
 *
 * 21 个功能点入口：
 *   页签① 病程记录 D1 完整性校验 / D2 质量评分 / D3 查询详情 / D4 导出待质控 /
 *          D5 并发症合理性 / D6 标记重审
 *   页签② 模板配置 T1 新建癌种模板 / T2 动态字段规则 / T3 默认值规则 /
 *          T4 启用停用 / T5 模板详情 / T6 导出清单 / T7 复制新版本
 *   页签③ 关联索引 R1 关联TNM / R2 关联病理 / R3 关联用药 / R4 一致性校验 /
 *          R5 缺失预警 / R6 查询全部关联 / R7 删除无效关联 / R8 导出映射清单
 * ========================================================================== */
(function () {
  'use strict';

  var D = window.DCQD, U = window.qcUI, E = D.esc;

  /* ==================== 样式（dcq- 前缀，限定 #pageContainer） ==================== */
  var CSS = [
    '#pageContainer .dcq-page{min-width:0}',
    '#pageContainer .dcq-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
    '#pageContainer .dcq-bar .acts{display:flex;gap:8px;flex-wrap:wrap}',
    '#pageContainer .dcq-hint{font-size:11.5px;color:#94a3b8;line-height:1.6}',
    /* 启停开关 */
    '#pageContainer .dcq-switch{position:relative;display:inline-block;width:38px;height:20px;flex:none;vertical-align:middle;cursor:pointer}',
    '#pageContainer .dcq-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:2}',
    '#pageContainer .dcq-switch i{position:absolute;inset:0;background:#cbd5e1;border-radius:20px;transition:.2s;pointer-events:none}',
    '#pageContainer .dcq-switch i:before{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s}',
    '#pageContainer .dcq-switch input:checked+i{background:var(--primary)}',
    '#pageContainer .dcq-switch input:checked+i:before{transform:translateX(18px)}',
    /* 筛选条：按钮组独立一行 */
    '#pageContainer .dcq-page .qc-filter{grid-template-columns:repeat(var(--dcq-fcols,4),minmax(0,1fr));row-gap:10px}',
    '#pageContainer .dcq-page .qc-filter .acts{grid-column:1/-1;justify-content:flex-start;align-self:end;height:34px;width:auto;max-width:100%}',
    /* 评分明细 */
    '#pageContainer .dcq-score-item{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #eef2f7;font-size:12.5px;color:#475569}',
    '#pageContainer .dcq-score-item:last-child{border-bottom:0}',
    '#pageContainer .dcq-score-item b{color:#182230}',
    /* 问题条目 */
    '#pageContainer .dcq-prob{border:1px solid #f1d7db;background:#fffafb;border-radius:6px;padding:9px 11px;margin-bottom:8px}',
    '#pageContainer .dcq-prob .h{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:600;color:#9f2f42}',
    '#pageContainer .dcq-prob .d{font-size:12px;color:#475569;margin-top:4px;line-height:1.6}',
    '#pageContainer .dcq-prob .f{font-size:11.5px;color:#94a3b8;margin-top:5px}',
    '#pageContainer .dcq-prob.warn{border-color:#f5e0be;background:#fffdf7}',
    '#pageContainer .dcq-prob.warn .h{color:#9a6a14}',
    '#pageContainer .dcq-prob.info{border-color:#dbe7f5;background:#f8fbff}',
    '#pageContainer .dcq-prob.info .h{color:#2a5a8f}',
    /* 关联卡 */
    '#pageContainer .dcq-link{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border:1px solid #e8edf3;border-radius:6px;margin-bottom:8px;background:#fff}',
    '#pageContainer .dcq-link .ic{font-size:18px;flex:none;line-height:1.4}',
    '#pageContainer .dcq-link .bd{flex:1;min-width:0}',
    '#pageContainer .dcq-link .t{font-size:12.5px;font-weight:600;color:#1f2937}',
    '#pageContainer .dcq-link .d{font-size:11.5px;color:#64748b;margin-top:3px;line-height:1.7;word-break:break-all}',
    '#pageContainer .dcq-link .ops{flex:none;display:flex;gap:6px;flex-wrap:wrap}',
    '#pageContainer .dcq-link.miss{border-style:dashed;border-color:#f0c9a8;background:#fffbf6}',
    /* 预警条目 */
    '#pageContainer .dcq-warn{border-left:3px solid #d98b2b;background:#fffbf5;padding:9px 11px;margin-bottom:8px;border-radius:0 6px 6px 0;font-size:12.5px;color:#8a6314}',
    /* 弹窗表单 */
    '#pageContainer .dcq-form{display:grid;gap:10px;font-size:13px;color:#334155}',
    '#pageContainer .dcq-form label{display:block;font-size:12px;color:#667085;font-weight:600;margin-bottom:4px}',
    '#pageContainer .dcq-form input[type=text],#pageContainer .dcq-form input[type=date],#pageContainer .dcq-form input[type=number],#pageContainer .dcq-form select,#pageContainer .dcq-form textarea{width:100%;padding:7px 9px;border:1px solid #d1d8e0;border-radius:5px;font-size:13px;color:#1f2937;font-family:inherit;box-sizing:border-box}',
    '#pageContainer .dcq-form textarea{min-height:64px;resize:vertical;font-family:Consolas,monospace;font-size:12px;line-height:1.7}',
    '#pageContainer .dcq-form .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#pageContainer .dcq-form .ck{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#334155;flex-wrap:wrap}',
    '#pageContainer .dcq-form .ck input{width:auto}',
    '#pageContainer .dcq-form .ck label{margin:0;display:inline;font-weight:400;font-size:12.5px;color:#334155}',
    /* 脱敏/说明块 */
    '#pageContainer .dcq-note2{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;padding:9px 11px;font-size:12.5px;color:#475569;line-height:1.9}',
    /* 版本/日志条 */
    '#pageContainer .dcq-logline{border-left:2px solid #e6edf5;padding:2px 0 2px 12px;margin:8px 0;font-size:12px;color:#475569;line-height:1.9}'
  ].join('\n');
  var styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);

  /* ==================== 功能点覆盖对照（21 项 → 实现入口） ==================== */
  var FP_MAP = {
    '病程记录': [
      ['D1', '校验病程记录完整性', '工具栏「完整性校验」'],
      ['D2', '输出病程质量评分', '工具栏「批量质量评分」/ 表格评分列 / 详情页评分卡'],
      ['D3', '查询某病例的病程记录详情', '筛选条（患者ID/病程ID/癌种/状态）+ 行「详情」'],
      ['D4', '批量导出待质控病程数据', '工具栏「导出待质控数据」'],
      ['D5', '验证术后并发症记录合理性', '工具栏「并发症合理性校验」'],
      ['D6', '标记需重新审核的病程记录', '行「标记重审」']
    ],
    '模板配置': [
      ['T1', '配置癌种专属病程模板', '工具栏「+ 新建模板」'],
      ['T2', '设置动态字段规则', '模板表单「动态字段配置」（显示字段/条件字段/操作符/条件值）'],
      ['T3', '定义默认值规则', '模板表单「默认值规则」（字段=默认值）'],
      ['T4', '启用/禁用模板版本', '列表「启用状态」开关'],
      ['T5', '查询某模板的详细配置', '行「详情」'],
      ['T6', '导出病程模板配置清单', '工具栏「导出配置清单」'],
      ['T7', '复制现有模板生成新版本', '行「复制新版本」']
    ],
    '关联索引': [
      ['R1', '关联TNM分期记录', '工具栏「+ 绑定TNM分期」/ 详情页关联卡'],
      ['R2', '关联病理报告', '工具栏「+ 绑定病理报告」/ 详情页关联卡'],
      ['R3', '关联用药记录', '工具栏「+ 绑定用药记录」/ 详情页关联卡'],
      ['R4', '校验关联数据一致性', '工具栏「一致性校验」'],
      ['R5', '输出关联数据缺失预警', '工具栏「缺失预警」/ 页面预警卡'],
      ['R6', '查询某病程的全部关联数据', '行「查看」'],
      ['R7', '删除无效的关联关系', '行「删除」/「标记无效」'],
      ['R8', '导出病程关联数据映射清单', '工具栏「导出映射清单」']
    ]
  };
  function fpListModal() {
    var total = 0, body = '';
    Object.keys(FP_MAP).forEach(function (k) {
      total += FP_MAP[k].length;
      body += '<div style="font-size:13px;font-weight:700;color:#334155;margin:12px 0 6px">页签「' + E(k) + '」</div>' +
        '<div class="table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th>编号</th><th>功能点</th><th>实现入口</th></tr></thead><tbody>' +
        FP_MAP[k].map(function (r) {
          return '<tr><td style="white-space:nowrap"><span class="mrqc-fp">' + E(r[0]) + '</span></td><td>' + E(r[1]) + '</td><td style="color:#0b65c2">' + E(r[2]) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    modal('功能点覆盖对照 · 专病病程质控（' + total + ' 项）',
      '<div class="dcq-note2">本页共 ' + total + ' 个功能点，全部以演示数据小实现，可点击对应入口实际操作。左侧三个页签分别对应病程记录、模板配置、关联数据索引三张信息表。</div>' + body);
  }

  /* ==================== 状态 ==================== */
  var ST = {
    tab: '病程记录',
    page: { course: 1, tpl: 1, link: 1 },
    filter: { cancer: '全部', qc: '全部', kw: '' },
    tplFilter: { cancer: '全部', state: '全部', kw: '' },
    linkFilter: { state: '全部', consist: '全部', kw: '' },
    detailId: ''
  };
  var PER = 10;

  function refresh() { window.renderPage(ST.tab === 'DETAIL' ? 'dcq-case|' + ST.detailId : 'dcq-workbench'); }
  function toast(msg, bad) { try { U.toast(msg, bad ? 'error' : 'success'); } catch (e) {} }
  function closeModal() { if (U.closeModal) U.closeModal(); }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function sel(id, opts, v) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      var vv, l;
      if (Array.isArray(o)) { vv = o[0]; l = o[1]; }
      else if (o && typeof o === 'object') { vv = o.v; l = o.l; }
      else { vv = o; l = o; }
      return '<option value="' + E(vv) + '"' + (String(v) === String(vv) ? ' selected' : '') + '>' + E(l) + '</option>';
    }).join('') + '</select>';
  }
  function formRow(label, inner) { return '<div><label>' + label + '</label>' + inner + '</div>'; }
  function switchHtml(id, on) { return '<label class="dcq-switch"><input type="checkbox" data-dcqtpl="' + E(id) + '"' + (on ? ' checked' : '') + '><i></i></label>'; }

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
        return '<div class="fg"><label>' + E(f.label) + '</label><select data-dcqf="' + E(f.key) + '">' + opts + '</select></div>';
      }
      return '<div class="fg"><label>' + E(f.label) + '</label><input type="text" data-dcqf="' + E(f.key) + '" value="' + E(f.value || '') + '" placeholder="' + E(f.ph || '') + '"></div>';
    }).join('');
    return '<div class="qc-filter" style="--qc-fcols:' + fields.length + ';--dcq-fcols:' + fields.length + '">' + html +
      '<div class="acts"><button class="btn btn-ghost btn-sm" data-qc="dcq:filter:reset:' + key + '">重置</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="dcq:filter:apply:' + key + '">查询</button></div></div>';
  }
  function readFilter() {
    var box = document.getElementById('pageContainer'), o = {};
    if (!box || !box.querySelectorAll) return o;
    var els = box.querySelectorAll('[data-dcqf]');
    for (var i = 0; i < els.length; i++) o[els[i].getAttribute('data-dcqf')] = String(els[i].value || '').trim();
    return o;
  }

  /* ==================== 通用小组件 ==================== */
  function tabs() {
    var list = [['病程记录', '专病病程记录'], ['模板配置', '病程模板配置'], ['关联索引', '病程关联数据索引']];
    return '<div class="qc-tabs">' + list.map(function (t) {
      return '<button class="' + (ST.tab === t[0] ? 'on' : '') + '" data-qc="dcq:tab:' + t[0] + '">' + t[0] + '</button>';
    }).join('') + '</div>';
  }
  function head(sub) {
    return U.head('专病病程质控', sub, '', false,
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:fp">功能点覆盖对照</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:reset">重置演示数据</button>');
  }
  function qcBadge(s) {
    var m = { '待质控': 'caution', '需重新审核': 'danger', '校验通过': 'success' };
    return U.badge(s, m[s] || 'neutral');
  }
  function compBadge(c) {
    var v = D.validateComplication(c);
    var tone = v.level === '正常' ? 'success' : v.level === '警告' ? 'warn' : 'danger';
    var label = v.level === '正常' ? (c.complication || '—') : (c.complication || v.level);
    return '<span class="badge badge-' + (tone === 'warn' ? 'caution' : tone === 'danger' ? 'danger' : 'success') + '" title="' + E(v.reason || '符合常见并发症模式') + '">' + E(label) + (v.level !== '正常' ? ' ⚠' : '') + '</span>';
  }
  function scoreCell(s) {
    var color = s >= 85 ? '#2e7d32' : s >= 70 ? '#b54708' : '#b42335';
    return '<b style="color:' + color + '">' + s + '</b>';
  }
  function linkBadge(l) {
    return U.badge(l.state, l.state === '有效' ? 'success' : 'neutral');
  }
  function consistCell(l) {
    var issues = D.consistencyIssues(l);
    if (!issues.length) return '<span class="badge badge-success">通过</span>';
    var bad = issues.filter(function (x) { return x.level === '矛盾'; }).length;
    var warn = issues.length - bad;
    return (bad ? U.badge(bad + ' 矛盾', 'danger') : '') + (warn ? ' ' + U.badge(warn + ' 警告', 'caution') : '');
  }

  /* ==================== 页签① 病程记录 ==================== */
  function filteredCourses() {
    var f = ST.filter;
    return D.courses().filter(function (c) {
      if (f.cancer !== '全部' && c.cancerType !== f.cancer) return false;
      if (f.qc !== '全部' && c.qcState !== f.qc) return false;
      if (f.kw) {
        var hay = [c.id, c.patientId, c.patientName, c.primaryFeature, c.recorder].join(' ');
        if (hay.indexOf(f.kw) < 0) return false;
      }
      return true;
    });
  }
  function renderCourses() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '待质控病程', v: s.wait, unit: '份', tone: 'warn', m: '等待校验与整改', action: 'dcq:core:qc:待质控' },
      { l: '需重新审核', v: s.reaudit, unit: '份', tone: 'bad', m: '已标记并通知记录人', action: 'dcq:core:qc:需重新审核' },
      { l: '校验通过', v: s.passed, unit: '份', tone: 'up', m: '质控闭环完成', action: 'dcq:core:qc:校验通过' },
      { l: '平均质量评分', v: s.avgScore.toFixed(1), unit: '分', tone: s.avgScore >= 85 ? 'up' : 'warn', m: '完整性+逻辑+及时性' },
      { l: '完整性缺失', v: s.compMiss, unit: '份', tone: s.compMiss ? 'bad' : 'up', m: '关键字段填写不全' },
      { l: '并发症异常', v: s.compBad, unit: '份', tone: s.compBad ? 'warn' : 'up', m: '矛盾/非常见模式' }
    ], 6);

    var acts = '<div class="dcq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="dcq:course:add">+ 新增病程记录</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:check:complete">完整性校验</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:score:all">批量质量评分</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:check:comp">并发症合理性校验</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:export:pending">导出待质控数据</button>' +
      '</div><span class="dcq-hint">共 ' + s.total + ' 份病程 · 评分 = 完整性 40 + 逻辑一致 30 + 及时性 30</span></div>';

    var f = ST.filter;
    var filter = filterBar([
      { key: 'cancer', label: '癌种类型', type: 'select', value: f.cancer, options: ['全部'].concat(D.CANCERS) },
      { key: 'qc', label: '质控状态', type: 'select', value: f.qc, options: ['全部'].concat(D.QC_STATES) },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '病程ID / 患者ID / 姓名 / 原发灶特征' }
    ], 'co');

    var list = filteredCourses(), pg = U.slice(list, ST.page.course, PER);
    var rows = pg.rows.map(function (c) {
      var ops = U.link('详情', 'dcq:detail:' + c.id) + ' ' +
        U.link('标记重审', 'dcq:reaudit:' + c.id);
      return {
        cells: [
          { h: '<code>' + E(c.id) + '</code>', cls: 'txt' },
          { h: E(c.patientId) + '<br><span style="color:#94a3b8;font-size:11px">' + E(c.patientName) + '</span>', cls: 'txt' },
          { h: U.badge(c.cancerType || '—', 'info'), cls: 'center' },
          { h: E(c.primaryFeature || '—'), cls: 'txt' },
          { h: E(c.surgery || '—'), cls: 'txt' },
          { h: E(c.therapy || '—'), cls: 'txt' },
          { h: compBadge(c), cls: 'center' },
          { h: E(c.recordTime || '—'), cls: 'num' },
          { h: c.recorder ? E(c.recorder) : '<span style="color:#b42335">缺失</span>', cls: 'txt' },
          { h: scoreCell(c.score || 0), cls: 'num' },
          { h: qcBadge(c.qcState), cls: 'center' },
          { h: ops, cls: 'act' }
        ],
        cls: c.qcState === '需重新审核' ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['病程ID', '患者ID', '癌种类型', '原发灶特征', '手术方式', '放化疗方案', '术后30天并发症', '#记录时间', '记录人', '#质量评分', '质控状态', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的病程记录' });

    return '<div class="dcq-page">' + head('专病病程记录台账 · 完整性 / 质量评分 / 并发症合理性') + tabs() + kpi + acts + filter +
      U.card('', table + U.pager(list.length, ST.page.course, PER, 'dcqco')) +
      U.note('质量评分 = 字段完整性 40 分（癌种/原发灶/手术/方案/并发症/记录人）+ 逻辑一致性 30 分（并发症合理性、关联矛盾、方案逻辑）+ 记录及时性 30 分（手术日期至记录时间 ≤7 天满分）。') +
      '</div>';
  }

  /* ==================== 页签② 模板配置 ==================== */
  function filteredTemplates() {
    var f = ST.tplFilter;
    return D.templates().filter(function (t) {
      if (f.cancer !== '全部' && (t.cancerTypes || []).indexOf(f.cancer) < 0) return false;
      if (f.state !== '全部' && t.state !== f.state) return false;
      if (f.kw && (t.id + t.name + (t.desc || '')).indexOf(f.kw) < 0) return false;
      return true;
    });
  }
  function dynText(t) {
    if (!t.dynamicFields || !t.dynamicFields.length) return '—';
    return t.dynamicFields.map(function (d) { return d.show + '（' + d.condField + d.op + d.value + '）'; }).join('<br>');
  }
  function defText(t) {
    var ks = Object.keys(t.defaults || {});
    if (!ks.length) return '—';
    return ks.map(function (k) { return (D.FIELD_CN[k] || k) + '=' + t.defaults[k]; }).join('<br>');
  }
  function renderTemplates() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '模板总数', v: s.tplTotal, unit: '个', tone: 'info', m: '覆盖全部癌种' },
      { l: '启用模板', v: s.tplOn, unit: '个', tone: 'up', m: '当前生效版本' },
      { l: '停用模板', v: s.tplOff, unit: '个', tone: 'neutral', m: '历史版本/待启用' },
      { l: '动态字段规则', v: s.dynRules, unit: '条', tone: 'info', m: '条件显示配置' },
      { l: '默认值规则', v: s.defRules, unit: '条', tone: 'info', m: '填写效率配置' },
      { l: '覆盖癌种', v: D.CANCERS.length, unit: '类', tone: 'info', m: '肺/乳腺/结直肠/胃/肝/宫颈' }
    ], 6);

    var acts = '<div class="dcq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="dcq:tpl:add">+ 新建模板</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:export:tpl">导出配置清单</button>' +
      '</div><span class="dcq-hint">模板按癌种配置动态字段与默认值；复制生成新版本，启用后才对新增病程生效</span></div>';

    var f = ST.tplFilter;
    var filter = filterBar([
      { key: 'cancer', label: '癌种适用范围', type: 'select', value: f.cancer, options: ['全部'].concat(D.CANCERS) },
      { key: 'state', label: '启用状态', type: 'select', value: f.state, options: ['全部'].concat(D.TPL_STATES) },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '模板ID / 模板名称 / 说明' }
    ], 'tpl');

    var list = filteredTemplates(), pg = U.slice(list, ST.page.tpl, PER);
    var rows = pg.rows.map(function (t) {
      return {
        cells: [
          { h: '<code>' + E(t.id) + '</code>', cls: 'txt' },
          { h: E(t.name) + (t.fromId ? '<br><span style="color:#94a3b8;font-size:11px">复制自 ' + E(t.fromId) + '</span>' : ''), cls: 'txt' },
          { h: (t.cancerTypes || []).map(function (c) { return U.badge(c, 'info'); }).join(' '), cls: 'txt' },
          { h: 'v' + t.version, cls: 'num' },
          { h: '<span style="font-size:11.5px">' + dynText(t) + '</span>', cls: 'txt' },
          { h: '<span style="font-size:11.5px">' + defText(t) + '</span>', cls: 'txt' },
          { h: switchHtml(t.id, t.state === '启用'), cls: 'center' },
          { h: E(t.updatedAt), cls: 'num' },
          { h: U.link('详情', 'dcq:tpl:detail:' + t.id) + ' ' + U.link('编辑', 'dcq:tpl:edit:' + t.id) + ' ' + U.link('复制新版本', 'dcq:tpl:copy:' + t.id) + ' ' + U.link('删除', 'dcq:tpl:del:' + t.id), cls: 'act' }
        ]
      };
    });
    var table = U.table(
      ['模板ID', '模板名称', '癌种适用范围', '#版本', '动态字段配置', '默认值规则', '启用状态', '#更新时间', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的模板' });

    return '<div class="dcq-page">' + head('病程模板配置 · 癌种专属模板 / 动态字段 / 默认值规则') + tabs() + kpi + acts + filter +
      U.card('模板配置清单', table + U.pager(list.length, ST.page.tpl, PER, 'dcqtpl')) +
      U.note('动态字段规则示例：「若手术方式=根治性切除，则显示切缘状态」；默认值规则示例：「放化疗方案默认未开始」「术后30天并发症默认无」。复制生成的新版本默认停用，核对后手动启用；启用中的模板不可删除。') +
      '</div>';
  }

  /* ==================== 页签③ 关联索引 ==================== */
  function filteredLinks() {
    var f = ST.linkFilter;
    return D.links().filter(function (l) {
      if (f.state !== '全部' && l.state !== f.state) return false;
      if (f.consist !== '全部') {
        var issues = D.consistencyIssues(l);
        var bad = issues.filter(function (x) { return x.level === '矛盾'; }).length;
        var warn = issues.length - bad;
        if (f.consist === '矛盾' && !bad) return false;
        if (f.consist === '警告' && !warn) return false;
        if (f.consist === '正常' && issues.length) return false;
      }
      if (f.kw) {
        var c = D.courseById(l.courseId);
        var hay = [l.id, l.courseId, l.tnmId, l.pathId, l.medId, c ? c.patientId + ' ' + c.patientName : ''].join(' ');
        if (hay.indexOf(f.kw) < 0) return false;
      }
      return true;
    });
  }
  function renderLinks() {
    var s = D.stats();
    var kpi = U.kpis([
      { l: '关联记录总数', v: s.linkTotal, unit: '条', tone: 'info', m: '病程 ⇄ 三类数据映射' },
      { l: '有效关联', v: s.linkValid, unit: '条', tone: 'up', m: '可用于溯源与校验' },
      { l: '无效关联', v: s.linkInvalid, unit: '条', tone: 'warn', m: '待删除/重建' },
      { l: '缺 TNM 分期', v: s.missTnm, unit: '份', tone: s.missTnm ? 'warn' : 'up', m: '实体瘤应有分期', action: 'dcq:lnk:miss:tnm' },
      { l: '缺病理报告', v: s.missPath, unit: '份', tone: s.missPath ? 'bad' : 'up', m: '手术病例应有病理', action: 'dcq:lnk:miss:path' },
      { l: '缺用药记录', v: s.missMed, unit: '份', tone: s.missMed ? 'warn' : 'up', m: '方案已开始应有用药', action: 'dcq:lnk:miss:med' }
    ], 6);

    var acts = '<div class="dcq-bar"><div class="acts">' +
      '<button class="btn btn-primary btn-sm" data-qc="dcq:bind:tnm">+ 绑定TNM分期</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:bind:path">+ 绑定病理报告</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:bind:med">+ 绑定用药记录</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:consistency">一致性校验</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:missing">缺失预警</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:export:links">导出映射清单</button>' +
      '</div><span class="dcq-hint">TNM / 病理 / 用药为模拟外部系统数据，接真实系统时替换 course-qc-data.js 即可</span></div>';

    var f = ST.linkFilter;
    var filter = filterBar([
      { key: 'state', label: '关联状态', type: 'select', value: f.state, options: ['全部'].concat(D.LINK_STATES) },
      { key: 'consist', label: '一致性', type: 'select', value: f.consist, options: ['全部', '矛盾', '警告', '正常'] },
      { key: 'kw', label: '关键字', type: 'text', value: f.kw, ph: '关联ID / 病程ID / 患者 / TNM / 病理 / 用药ID' }
    ], 'lnk');

    var list = filteredLinks(), pg = U.slice(list, ST.page.link, PER);
    var rows = pg.rows.map(function (l) {
      var c = D.courseById(l.courseId);
      return {
        cells: [
          { h: '<code>' + E(l.id) + '</code>', cls: 'txt' },
          { h: '<code>' + E(l.courseId) + '</code>', cls: 'txt' },
          { h: c ? E(c.patientId) + '<br><span style="color:#94a3b8;font-size:11px">' + E(c.patientName) + '</span>' : '—', cls: 'txt' },
          { h: l.tnmId ? '<code>' + E(l.tnmId) + '</code>' : '<span style="color:#b42335">未关联</span>', cls: 'txt' },
          { h: l.pathId ? '<code>' + E(l.pathId) + '</code>' : '<span style="color:#b42335">未关联</span>', cls: 'txt' },
          { h: l.medId ? '<code>' + E(l.medId) + '</code>' : '<span style="color:#b42335">未关联</span>', cls: 'txt' },
          { h: linkBadge(l), cls: 'center' },
          { h: E(l.boundAt), cls: 'num' },
          { h: consistCell(l), cls: 'center' },
          { h: U.link('查看', 'dcq:links:view:' + l.courseId) + ' ' + (l.state === '有效' ? U.link('标记无效', 'dcq:link:invalid:' + l.id) : '') + ' ' + U.link('删除', 'dcq:link:del:' + l.id), cls: 'act' }
        ],
        cls: l.state === '无效' ? 'abn-row' : ''
      };
    });
    var table = U.table(
      ['关联ID', '病程ID', '患者', 'TNM分期ID', '病理ID', '用药记录ID', '关联状态', '#绑定时间', '一致性', '操作'],
      rows, { compact: true, fit: true, empty: '没有符合条件的关联记录' });

    /* 缺失预警清单（R5，页面常驻） */
    var miss = D.missingLinks();
    var mrows = miss.map(function (m) {
      return { cells: [
        { h: '<code>' + E(m.courseId) + '</code>', cls: 'txt' },
        { h: E(m.patientId) + '（' + E(m.patientName) + '）', cls: 'txt' },
        { h: U.badge(m.cancerType || '—', 'info'), cls: 'center' },
        { h: '<span style="color:#b42335">' + E(m.missing.join('、')) + '</span>', cls: 'txt' },
        { h: m.badLinks ? U.badge(m.badLinks + ' 条无效关联', 'caution') : '—', cls: 'center' },
        { h: U.link('去绑定', 'dcq:detail:' + m.courseId), cls: 'act' }
      ] };
    });
    var missCard = U.card('关联数据缺失预警清单（R5）',
      U.table(['病程ID', '患者', '癌种', '缺失的关键关联数据', '无效关联', '操作'], mrows,
        { compact: true, fit: true, empty: '全部病程的关键关联数据齐全' }) +
      U.note('判定口径：实体瘤均应有 TNM 分期；非「未手术」病例应有病理报告；方案已开始的病例应有用药记录。'));

    return '<div class="dcq-page">' + head('病程关联数据索引 · TNM 分期 / 病理报告 / 用药记录映射') + tabs() + kpi + acts + filter +
      U.card('关联索引清单', table + U.pager(list.length, ST.page.link, PER, 'dcqlnk')) + missCard +
      '</div>';
  }

  /* ==================== 详情页 ==================== */
  function renderDetail(c) {
    var sc = D.scoreOf(c);
    var issues = D.checkCourse(c);
    var link = D.linkOf(c.id);
    var anyLink = D.linkByCourseAny(c.id);

    var acts = '<button class="btn btn-ghost btn-sm" data-qc="dcq:back">← 返回病程台账</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:course:edit:' + c.id + '">修正病程记录</button>' +
      '<button class="btn btn-primary btn-sm" data-qc="dcq:reaudit:' + c.id + '">标记需重新审核</button>' +
      '<button class="btn btn-outline btn-sm" data-qc="dcq:resolve:' + c.id + '">完成重新审核</button>' +
      '<button class="btn btn-ghost btn-sm" data-qc="dcq:detail:export:' + c.id + '">导出质控报告</button>';
    var hd = U.head('专病病程记录详情', c.id + ' · ' + c.patientName + ' · ' + c.cancerType + '癌', '', false,
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + acts + '</div>');

    var base = U.card('病程记录（D3 · 查询某病例的病程记录详情）', U.kv([
      ['病程ID', '<code>' + E(c.id) + '</code>'], ['患者ID', E(c.patientId)], ['患者姓名', E(c.patientName)],
      ['癌种类型', U.badge(c.cancerType || '—', 'info')], ['原发灶特征', E(c.primaryFeature || '—')],
      ['手术方式', E(c.surgery || '—')], ['手术日期', c.operDate ? E(c.operDate) : '<span style="color:#b42335">缺失</span>'],
      ['放化疗方案', E(c.therapy || '—')], ['术后30天并发症', compBadge(c)],
      ['记录时间', E(c.recordTime)], ['记录人', c.recorder ? E(c.recorder) : '<span style="color:#b42335">缺失</span>'],
      ['质控状态', qcBadge(c.qcState)], ['质量评分', scoreCell(c.score || 0) + ' 分'], ['重审原因', E(c.reauditNote || '—')]
    ], 3));

    var scoreLines = sc.items.map(function (x) {
      return '<div class="dcq-score-item"><span>' + E(x.name) + (x.note ? '<br><span style="color:#94a3b8;font-size:11px">' + E(x.note) + '</span>' : '') +
        (x.fail.length ? '<br><span style="color:#b42335;font-size:11px">' + E(x.fail.join('；')) + '</span>' : '') + '</span><b>' + x.got + ' / ' + x.full + '</b></div>';
    }).join('');
    var scoreCard = U.grid13(
      U.card('病程质量评分（D2）', U.scoreCard(sc.total, sc.total >= 85 ? '优秀' : sc.total >= 70 ? '合格' : '待整改', [
        '完整性 40 + 逻辑一致 30 + 及时性 30', '关键字段填写率 ' + sc.completeness.pct + '%'
      ])), U.card('评分构成明细', scoreLines));

    /* 问题清单 */
    var probHtml = issues.length ? issues.map(function (x) {
      var cls = x.level === '矛盾' || x.level === '缺失' ? '' : x.level === '警告' ? ' warn' : ' info';
      return '<div class="dcq-prob' + cls + '"><div class="h"><span>' + E(x.type) + ' · ' + E(x.level) + '</span></div>' +
        '<div class="d">' + E(x.detail) + '</div><div class="f">建议：' + E(x.suggest) + '</div></div>';
    }).join('') : '<div class="dcq-prob info" style="border-color:#cfe8d8;background:#f6fcf8"><div class="h" style="color:#15803d"><span>全部通过</span></div><div class="d">完整性、并发症合理性、及时性与关联一致性均未发现问题。</div></div>';
    var probCard = U.card('校验问题清单（D1 / D5 / R4 / R5）', probHtml + U.note('完整性与并发症问题按字段实时计算；关联一致性与缺失预警联动「关联索引」页签。'));

    /* 关联数据卡（R6） */
    function linkCard(field, icon, title, ent, detail) {
      var bound = link && link[field];
      if (bound && ent) {
        return '<div class="dcq-link"><div class="ic">' + icon + '</div><div class="bd">' +
          '<div class="t">' + E(title) + ' ' + U.badge('已关联', 'success') + '</div>' +
          '<div class="d">' + detail + '</div></div>' +
          '<div class="ops">' + U.link('更换', 'dcq:bind:' + field + ':' + c.id) + ' ' + U.link('解除', 'dcq:unbind:' + c.id + ':' + field) + '</div></div>';
      }
      var invalid = anyLink && anyLink[field] && anyLink.state === '无效';
      return '<div class="dcq-link miss"><div class="ic">' + icon + '</div><div class="bd">' +
        '<div class="t">' + E(title) + ' ' + U.badge('未关联', 'caution') + '</div>' +
        '<div class="d">' + (invalid ? '存在一条无效关联（' + E(anyLink.invalidReason || '') + '），请删除后重新绑定。' : '该病程尚未绑定' + E(title) + '，影响诊断依据可追溯性与一致性校验。') + '</div></div>' +
        '<div class="ops">' + U.link('+ 绑定', 'dcq:bind:' + field + ':' + c.id) + '</div></div>';
    }
    var tnmEnt = link && link.tnmId ? D.tnmById(link.tnmId) : null;
    var pathEnt = link && link.pathId ? D.pathById(link.pathId) : null;
    var medEnt = link && link.medId ? D.medById(link.medId) : null;
    var linkCardHtml = U.card('该病程的全部关联数据（R6）',
      linkCard('tnmId', '📊', 'TNM 分期记录', tnmEnt, tnmEnt ? '<code>' + E(tnmEnt.id) + '</code> · ' + E(tnmEnt.tnm) + ' · ' + E(tnmEnt.stage) + ' 期 · v' + tnmEnt.version + ' · 评估于 ' + E(tnmEnt.assessedAt) : '') +
      linkCard('pathId', '🧪', '病理报告', pathEnt, pathEnt ? '<code>' + E(pathEnt.id) + '</code> · ' + E(pathEnt.histoName) + '（' + E(pathEnt.histo) + '）· 切缘' + E(pathEnt.margin) + ' · ' + E(pathEnt.reportAt) : '') +
      linkCard('medId', '💊', '用药记录', medEnt, medEnt ? '<code>' + E(medEnt.id) + '</code> · ' + E(medEnt.regimen) + ' · ' + E(medEnt.drug) + ' · ' + medEnt.cycles + ' 周期 · ' + E(medEnt.status) : '') +
      (link && D.consistencyIssues(link).length ? '<div style="margin-top:8px">' + D.consistencyIssues(link).map(function (x) {
        return '<div class="dcq-warn">' + E(x.detail) + '</div>';
      }).join('') + '</div>' : ''));

    /* 操作日志 */
    var logRows = (c.logs || []).map(function (l) {
      return { cells: [{ h: E(l.at), cls: 'num' }, { h: E(l.actor), cls: 'txt' }, { h: E(l.action), cls: 'txt' }, { h: E(l.note || '—'), cls: 'txt' }] };
    });
    var logCard = U.card('病程操作日志与留痕', U.table(['#时间', '操作人', '动作', '说明'], logRows, { compact: true, fit: true, empty: '暂无日志' }));

    return '<div class="dcq-page">' + hd + base + scoreCard + probCard + linkCardHtml + logCard + '</div>';
  }

  /* ==================== 弹窗 ==================== */
  function modal(title, body, footer) { U.modal(title, body, footer || ''); }

  /* 新增 / 修正病程记录 */
  function courseFormModal(c) {
    var isNew = !c;
    c = c || {};
    var tpls = isNew ? D.templates().filter(function (t) { return t.state === '启用'; }) : [];
    modal((isNew ? '新增' : '修正') + '病程记录（D1/D2 基础数据）' + (isNew ? '' : ' · ' + c.id),
      '<div class="dcq-form">' +
      '<div class="row2">' + formRow('患者ID', '<input type="text" id="dcqf-c-pid" value="' + E(c.patientId || 'P-') + '"' + (isNew ? '' : ' disabled') + '>') +
      formRow('患者姓名', '<input type="text" id="dcqf-c-name" value="' + E(c.patientName || '') + '">') + '</div>' +
      '<div class="row2">' + formRow('癌种类型', sel('dcqf-c-cancer', D.CANCERS, c.cancerType || '肺')) +
      formRow('手术方式', sel('dcqf-c-surgery', D.SURGERY, c.surgery || '根治性切除')) + '</div>' +
      formRow('原发灶特征', '<input type="text" id="dcqf-c-feature" value="' + E(c.primaryFeature || '') + '" placeholder="例如：左肺上叶 2.8cm 毛玻璃结节，胸膜牵拉">') +
      '<div class="row2">' + formRow('放化疗方案', '<input type="text" id="dcqf-c-therapy" value="' + E(c.therapy || '') + '" placeholder="未开始 / 术后辅助化疗（TP 方案×4 周期）…">') +
      formRow('术后30天并发症', '<input type="text" id="dcqf-c-comp" value="' + E(c.complication || '') + '" placeholder="无 / 肺部感染 / 胸腔积液…">') + '</div>' +
      '<div class="row2">' + formRow('手术日期', '<input type="date" id="dcqf-c-oper" value="' + E(c.operDate || '') + '">') +
      formRow('记录人', '<input type="text" id="dcqf-c-recorder" value="' + E(c.recorder || '') + '">') + '</div>' +
      (isNew ? formRow('套用模板（应用默认值规则）', sel('dcqf-c-tpl', [['', '不套用模板']].concat(tpls.map(function (t) { return [t.id, t.name + '（v' + t.version + '）']; })), '')) : '') +
      (isNew ? '<div class="dcq-note2">套用模板后，若「放化疗方案」「并发症」留空，将自动应用模板中配置的默认值规则（T3）。</div>' : '') +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="dcq:course:save:' + (isNew ? 'add' : c.id) + '">' + (isNew ? '创建病程记录' : '保存并重算评分') + '</button>');
  }

  /* 标记重新审核（D6） */
  function reauditModal(c) {
    modal('标记需重新审核（D6） · ' + c.id,
      '<div class="dcq-form">' + formRow('病程信息', '<div style="font-size:12.5px;color:#475569">' + E(c.patientName) + '（' + E(c.patientId) + '）· ' + E(c.cancerType) + ' · 当前评分 <b>' + (c.score || 0) + '</b> 分</div>') +
      formRow('标记原因', sel('dcqf-rr-reason', ['关键字段缺失需补录', '并发症记录与手术方式矛盾', '关联数据不一致', '记录超时需补正', '其它'], '关键字段缺失需补录')) +
      formRow('补充说明', '<input type="text" id="dcqf-rr-note" placeholder="例如：核对手术记录后补录手术方式">') +
      '<div class="dcq-note2">标记后状态变为「需重新审核」，系统记录通知记录人 ' + E(c.recorder || '（未填）') + '，并在详情页保留留痕。完成后可点击「完成重新审核」闭环。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="dcq:reaudit:do:' + c.id + '">确认标记并通知</button>');
  }

  /* 模板表单（T1/T2/T3） */
  function tplFormModal(t) {
    var isNew = !t;
    t = t || { name: '', cancerTypes: ['肺'], version: 1, state: '停用', dynamicFields: [], defaults: {}, desc: '' };
    var dynVal = (t.dynamicFields || []).map(function (d) { return d.show + ' | ' + d.condField + ' | ' + d.op + ' | ' + d.value; }).join('\n');
    var defVal = Object.keys(t.defaults || {}).map(function (k) { return (D.FIELD_CN[k] || k) + '=' + t.defaults[k]; }).join('\n');
    modal((isNew ? '配置' : '编辑') + '癌种专属病程模板（T1/T2/T3）' + (isNew ? '' : ' · ' + t.id),
      '<div class="dcq-form">' +
      formRow('模板名称', '<input type="text" id="dcqf-t-name" value="' + E(t.name) + '" placeholder="例如：肺癌根治术后病程模板">') +
      '<div><label>癌种适用范围（可多选）</label><div class="ck">' +
      D.CANCERS.map(function (c) { return '<label><input type="checkbox" class="dcq-tc" value="' + E(c) + '"' + ((t.cancerTypes || []).indexOf(c) >= 0 ? ' checked' : '') + '> ' + E(c) + '</label>'; }).join('') + '</div></div>' +
      '<div class="row2">' + formRow('版本号', '<input type="number" id="dcqf-t-ver" value="' + (t.version || 1) + '" min="1">') +
      formRow('启用状态', sel('dcqf-t-state', D.TPL_STATES, t.state || '停用')) + '</div>' +
      formRow('动态字段配置（T2，每行：显示字段 | 条件字段 | 操作符 | 条件值）', '<textarea id="dcqf-t-dyn" placeholder="切缘状态 | 手术方式 | 等于 | 根治性切除">' + E(dynVal) + '</textarea>') +
      formRow('默认值规则（T3，每行：字段=默认值）', '<textarea id="dcqf-t-def" placeholder="放化疗方案=未开始&#10;术后30天并发症=无">' + E(defVal) + '</textarea>') +
      formRow('模板说明', '<input type="text" id="dcqf-t-desc" value="' + E(t.desc || '') + '">') +
      '<div class="dcq-note2">动态字段：满足条件时在病程表单中显示该字段，操作符支持「等于 / 包含 / 不等于」；默认值规则支持字段：' + E(D.CORE_FIELDS.map(function (f) { return f[1]; }).join('、')) + '。</div>' +
      '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="dcq:tpl:save:' + (isNew ? 'add' : t.id) + '">保存模板</button>');
  }
  /* 模板详情（T5） */
  function tplDetailModal(t) {
    var dyn = (t.dynamicFields || []).length ? t.dynamicFields.map(function (d) {
      return '<div class="dcq-logline"><b>' + E(d.show) + '</b> · 当「' + E(d.condField) + '」' + E(d.op) + '「' + E(d.value) + '」时显示</div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12.5px;padding:4px 0">未配置动态字段规则</div>';
    var def = Object.keys(t.defaults || {}).length ? Object.keys(t.defaults).map(function (k) {
      return '<div class="dcq-logline"><b>' + E(D.FIELD_CN[k] || k) + '</b> 默认值：' + E(t.defaults[k]) + '</div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12.5px;padding:4px 0">未配置默认值规则</div>';
    modal('模板详细配置（T5） · ' + t.name,
      U.kv([
        ['模板ID', '<code>' + E(t.id) + '</code>'], ['模板名称', E(t.name)],
        ['癌种适用范围', (t.cancerTypes || []).map(function (c) { return U.badge(c, 'info'); }).join(' ')],
        ['版本号', 'v' + t.version], ['启用状态', t.state === '启用' ? U.badge('启用', 'success') : U.badge('停用', 'neutral')],
        ['编辑人 / 时间', E(t.editor) + ' / ' + E(t.updatedAt)], ['复制来源', E(t.fromId || '—')],
        ['说明', E(t.desc || '—')]
      ], 2) +
      '<div style="margin-top:12px;border-top:1px solid #eef2f7;padding-top:10px"><b style="font-size:12.5px">动态字段配置（T2）</b>' + dyn + '</div>' +
      '<div style="margin-top:10px;border-top:1px solid #eef2f7;padding-top:10px"><b style="font-size:12.5px">默认值规则（T3）</b>' + def + '</div>');
  }

  /* 绑定关联弹窗（R1/R2/R3）：先选病程，再选该病程患者名下的记录 */
  var BIND_META = {
    tnmId: { title: 'TNM分期记录', label: 'TNM分期', key: 'tnm' },
    pathId: { title: '病理报告', label: '病理报告', key: 'path' },
    medId: { title: '用药记录', label: '用药记录', key: 'med' }
  };
  function entOptions(courseId, field) {
    var c = D.courseById(courseId);
    if (!c) return '';
    var list = field === 'tnmId' ? D.tnm() : field === 'pathId' ? D.paths() : D.meds();
    var own = list.filter(function (x) { return x.patientId === c.patientId; });
    if (!own.length) return '<option value="">该患者名下暂无' + BIND_META[field].title + '</option>';
    return own.map(function (x) {
      var label = field === 'tnmId' ? (x.id + ' · ' + x.tnm + ' · ' + x.stage + '期 · v' + x.version)
        : field === 'pathId' ? (x.id + ' · ' + x.histoName + '（' + x.histo + '）· ' + x.reportAt)
        : (x.id + ' · ' + x.regimen + ' · ' + x.status);
      return '<option value="' + E(x.id) + '">' + E(label) + '</option>';
    }).join('');
  }
  function bindModal(field, courseId) {
    var meta = BIND_META[field];
    var courses = D.courses();
    var cid = courseId || (courses[0] ? courses[0].id : '');
    modal('绑定' + meta.title + '（' + (field === 'tnmId' ? 'R1' : field === 'pathId' ? 'R2' : 'R3') + '）',
      '<div class="dcq-form">' +
      formRow('选择病程记录', '<select id="dcqf-bind-course" data-dcq-bind-course="' + field + '">' +
        courses.map(function (c) {
          return '<option value="' + E(c.id) + '"' + (c.id === cid ? ' selected' : '') + '>' + E(c.id) + ' · ' + E(c.patientId) + ' ' + E(c.patientName) + ' · ' + E(c.cancerType) + '</option>';
        }).join('') + '</select>') +
      formRow('选择' + meta.title + '（仅显示该患者名下记录）', '<select id="dcqf-bind-ent">' + entOptions(cid, field) + '</select>') +
      '<div class="dcq-note2">绑定前系统校验患者ID一致性：跨患者的记录将被拒绝（防止误绑他人数据）。绑定成功后可在详情页查看该病程的全部关联数据，并参与一致性校验。</div></div>',
      '<button class="btn btn-primary btn-sm" data-qc="dcq:bind:do:' + field + '">确认绑定</button>');
  }

  /* 查看某病程全部关联（R6） */
  function linksViewModal(courseId) {
    var c = D.courseById(courseId);
    if (!c) return;
    var ls = D.links().filter(function (x) { return x.courseId === courseId; });
    var body = ls.length ? ls.map(function (l) {
      var issues = D.consistencyIssues(l);
      return '<div class="dcq-link' + (l.state === '无效' ? ' miss' : '') + '"><div class="ic">🔗</div><div class="bd">' +
        '<div class="t"><code>' + E(l.id) + '</code> ' + linkBadge(l) + (l.invalidReason ? ' <span style="color:#b42335;font-size:11.5px">（' + E(l.invalidReason) + '）</span>' : '') + '</div>' +
        '<div class="d">TNM：' + (l.tnmId ? '<code>' + E(l.tnmId) + '</code>' : '未关联') + '　病理：' + (l.pathId ? '<code>' + E(l.pathId) + '</code>' : '未关联') + '　用药：' + (l.medId ? '<code>' + E(l.medId) + '</code>' : '未关联') + '<br>绑定：' + E(l.boundBy) + ' · ' + E(l.boundAt) +
        (issues.length ? '<br><span style="color:#b42335">' + E(issues.map(function (x) { return x.detail; }).join('；')) + '</span>' : '') + '</div></div>' +
        '<div class="ops">' + (l.state === '有效' ? U.link('标记无效', 'dcq:link:invalid:' + l.id) : '') + ' ' + U.link('删除', 'dcq:link:del:' + l.id) + '</div></div>';
    }).join('') : '<div style="color:#94a3b8;font-size:12.5px">该病程暂无任何关联记录</div>';
    modal('该病程的全部关联数据（R6） · ' + courseId + ' · ' + c.patientName, body);
  }

  /* 一致性校验结果（R4） */
  function consistencyModal() {
    var all = [];
    D.links().forEach(function (l) {
      D.consistencyIssues(l).forEach(function (x) { all.push({ link: l, issue: x }); });
    });
    var body = all.length ? all.map(function (x) {
      var c = D.courseById(x.link.courseId);
      return '<div class="dcq-prob' + (x.issue.level === '矛盾' ? '' : ' warn') + '"><div class="h"><span>' + E(x.link.id) + ' · ' + E(x.link.courseId) + (c ? '（' + E(c.patientName) + '）' : '') + '</span>' +
        U.badge(x.issue.level, x.issue.level === '矛盾' ? 'danger' : 'caution') + '</div>' +
        '<div class="d">' + E(x.issue.detail) + '</div><div class="f">涉及：' + E(x.issue.kind === 'tnm' ? 'TNM分期' : x.issue.kind === 'path' ? '病理报告' : '用药记录') + '</div></div>';
    }).join('') : '<div class="dcq-prob info" style="border-color:#cfe8d8;background:#f6fcf8"><div class="h" style="color:#15803d"><span>全部通过</span></div><div class="d">当前所有有效关联的患者ID、分期版本、用药状态、病理时序均一致。</div></div>';
    modal('关联数据一致性校验（R4）', body);
  }

  /* 缺失预警弹窗（R5） */
  function missingModal() {
    var miss = D.missingLinks();
    var body = miss.length ? miss.map(function (m) {
      return '<div class="dcq-warn"><b>' + E(m.courseId) + '</b> · ' + E(m.patientId) + '（' + E(m.patientName) + '）· ' + E(m.cancerType) + '癌' +
        '：缺少 <b>' + E(m.missing.join('、')) + '</b>' + (m.badLinks ? '；存在 ' + m.badLinks + ' 条无效关联' : '') +
        '　' + U.link('去绑定', 'dcq:detail:' + m.courseId) + '</div>';
    }).join('') : '<div style="color:#15803d;font-size:12.5px">全部病程的关键关联数据齐全</div>';
    modal('关联数据缺失预警清单（R5）', body);
  }

  /* 删除 / 标记无效关联（R7） */
  function linkDelModal(l) {
    modal('删除无效的关联关系（R7） · ' + l.id,
      '<div class="dcq-form">' + formRow('关联信息', '<div style="font-size:12.5px;color:#475569">' + E(l.id) + ' · 病程 ' + E(l.courseId) + ' · TNM ' + E(l.tnmId || '—') + ' · 病理 ' + E(l.pathId || '—') + ' · 用药 ' + E(l.medId || '—') + '</div>') +
      formRow('删除原因', sel('dcqf-ld-reason', ['误操作建立', '患者信息不匹配', '关联对象已作废', '重复关联', '其它'], '误操作建立')) + '</div>',
      '<button class="btn btn-primary btn-sm" data-qc="dcq:link:del:do:' + l.id + '">确认删除</button>');
  }

  /* ==================== 导出 ==================== */
  function exportPending() {
    var list = D.courses().filter(function (c) { return c.qcState === '待质控' || c.qcState === '需重新审核'; });
    D.exportCsv('待质控病程数据', ['病程ID', '患者ID', '患者姓名', '癌种类型', '原发灶特征', '手术方式', '放化疗方案', '术后30天并发症', '手术日期', '记录时间', '记录人', '质量评分', '质控状态', '重审原因'],
      list.map(function (c) { return [c.id, c.patientId, c.patientName, c.cancerType, c.primaryFeature, c.surgery, c.therapy, c.complication, c.operDate, c.recordTime, c.recorder, c.score, c.qcState, c.reauditNote]; }));
    toast('已导出待质控病程 ' + list.length + ' 份（CSV，供线下人工核对或系统补录）');
  }
  function exportTemplates() {
    D.exportCsv('病程模板配置清单', ['模板ID', '模板名称', '癌种适用范围', '版本', '启用状态', '动态字段配置', '默认值规则', '模板说明', '编辑人', '更新时间', '复制来源'],
      D.templates().map(function (t) {
        return [t.id, t.name, (t.cancerTypes || []).join('/'), 'v' + t.version, t.state,
          (t.dynamicFields || []).map(function (d) { return d.show + '|' + d.condField + d.op + d.value; }).join('；'),
          Object.keys(t.defaults || {}).map(function (k) { return (D.FIELD_CN[k] || k) + '=' + t.defaults[k]; }).join('；'),
          t.desc || '', t.editor, t.updatedAt, t.fromId || ''];
      }));
    toast('已导出病程模板配置清单（CSV，含动态字段与默认值规则）');
  }
  function exportLinks() {
    D.exportCsv('病程关联数据映射清单', ['关联ID', '病程ID', '患者ID', 'TNM分期ID', 'TNM分期', '病理ID', '病理类型', '用药记录ID', '用药方案', '关联状态', '一致性结果', '绑定时间', '绑定人'],
      D.links().map(function (l) {
        var c = D.courseById(l.courseId), t = D.tnmById(l.tnmId), p = D.pathById(l.pathId), m = D.medById(l.medId);
        return [l.id, l.courseId, c ? c.patientId : '', l.tnmId, t ? t.tnm + ' ' + t.stage : '', l.pathId, p ? p.histoName : '', l.medId, m ? m.regimen : '',
          l.state, D.consistencyIssues(l).map(function (x) { return x.level + '：' + x.detail; }).join('；') || '通过', l.boundAt, l.boundBy];
      }));
    toast('已导出病程关联数据映射清单（CSV，含一致性校验结果）');
  }
  function exportDetailReport(c) {
    D.exportJson('专病病程质控报告_' + c.id, {
      exportedAt: D.now(), course: c, qualityScore: D.scoreOf(c), issues: D.checkCourse(c),
      links: D.links().filter(function (l) { return l.courseId === c.id; }),
      tnm: D.linkOf(c.id) ? D.tnmById(D.linkOf(c.id).tnmId) : null,
      pathology: D.linkOf(c.id) ? D.pathById(D.linkOf(c.id).pathId) : null,
      medication: D.linkOf(c.id) ? D.medById(D.linkOf(c.id).medId) : null
    });
    toast('已导出该病例质控报告（JSON，含评分、问题清单与关联数据）');
  }

  /* ==================== 页面分发 / 路由 ==================== */
  function renderWorkbench() {
    if (ST.tab === '模板配置') return renderTemplates();
    if (ST.tab === '关联索引') return renderLinks();
    return renderCourses();
  }
  function renderPageId(id) {
    if (id.indexOf('dcq-case|') === 0) {
      var c = D.courseById(id.slice(9));
      if (!c) return U.head('病程记录不存在', '', '', false, '<button class="btn btn-ghost btn-sm" data-qc="dcq:back">← 返回</button>') + U.note('未找到该病程ID对应的记录。', true);
      return renderDetail(c);
    }
    return renderWorkbench();
  }
  function openCase(id) {
    ST.tab = 'DETAIL'; ST.detailId = id;
    try { history.replaceState(null, '', '#dcq-case|' + id); } catch (e) {}
    window.renderPage('dcq-case|' + id);
  }
  function back() {
    ST.tab = '病程记录'; ST.detailId = '';
    try { history.replaceState(null, '', '#dcq-workbench'); } catch (e) {}
    if (typeof window.navigateTo === 'function') window.navigateTo('dcq-workbench');
  }

  /* ==================== 事件代理 ==================== */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-qc]') : null;
    if (!el) return;
    var a = el.getAttribute('data-qc') || '';
    /* 只处理本模块 dcq: 前缀与分页，绝不碰通用 filter:* */
    if (a.indexOf('dcq:') !== 0 && !/^(dcqco|dcqtpl|dcqlnk):page:/.test(a)) return;
    function arg(pre) { return a.slice(pre.length); }
    function has(pre) { return a.indexOf(pre) === 0; }

    if (has('dcq:tab:')) { ST.tab = arg('dcq:tab:'); ST.detailId = ''; try { history.replaceState(null, '', '#dcq-workbench'); } catch (e) {} refresh(); return; }
    if (a === 'dcq:back') { back(); return; }
    if (a === 'dcq:fp') { fpListModal(); return; }
    if (a === 'dcq:reset') {
      if (typeof showConfirm === 'function') showConfirm('重置演示数据', '确认将「专病病程质控」全部演示数据恢复为初始种子吗？当前会话内的病程、模板、关联与操作日志改动都会丢失。', function () {
        D.reset(); ST.tab = '病程记录'; ST.detailId = '';
        ST.filter = { cancer: '全部', qc: '全部', kw: '' };
        ST.tplFilter = { cancer: '全部', state: '全部', kw: '' };
        ST.linkFilter = { state: '全部', consist: '全部', kw: '' };
        toast('演示数据已重置'); refresh();
      });
      return;
    }

    /* 筛选 */
    if (a === 'dcq:filter:apply:co') { var vf = readFilter(); ST.filter = { cancer: vf.cancer || '全部', qc: vf.qc || '全部', kw: vf.kw || '' }; ST.page.course = 1; refresh(); return; }
    if (a === 'dcq:filter:reset:co') { ST.filter = { cancer: '全部', qc: '全部', kw: '' }; ST.page.course = 1; refresh(); return; }
    if (a === 'dcq:filter:apply:tpl') { var vt = readFilter(); ST.tplFilter = { cancer: vt.cancer || '全部', state: vt.state || '全部', kw: vt.kw || '' }; ST.page.tpl = 1; refresh(); return; }
    if (a === 'dcq:filter:reset:tpl') { ST.tplFilter = { cancer: '全部', state: '全部', kw: '' }; ST.page.tpl = 1; refresh(); return; }
    if (a === 'dcq:filter:apply:lnk') { var vl = readFilter(); ST.linkFilter = { state: vl.state || '全部', consist: vl.consist || '全部', kw: vl.kw || '' }; ST.page.link = 1; refresh(); return; }
    if (a === 'dcq:filter:reset:lnk') { ST.linkFilter = { state: '全部', consist: '全部', kw: '' }; ST.page.link = 1; refresh(); return; }

    /* 分页 */
    var pm = /^(dcqco|dcqtpl|dcqlnk):page:(\d+)$/.exec(a);
    if (pm) { var key = { dcqco: 'course', dcqtpl: 'tpl', dcqlnk: 'link' }[pm[1]]; ST.page[key] = parseInt(pm[2], 10) || 1; refresh(); return; }

    /* KPI 快捷筛选 */
    if (has('dcq:core:qc:')) { ST.filter.qc = arg('dcq:core:qc:'); ST.page.course = 1; ST.tab = '病程记录'; refresh(); return; }
    if (has('dcq:lnk:miss:')) {
      ST.tab = '关联索引';
      var kind = arg('dcq:lnk:miss:');
      var label = kind === 'tnm' ? 'TNM分期' : kind === 'path' ? '病理报告' : '用药记录';
      var miss = D.missingLinks().filter(function (m) { return m.missing.indexOf(label) >= 0; });
      modal('缺少' + label + '的病程清单（R5）', miss.length ? miss.map(function (m) {
        return '<div class="dcq-warn"><b>' + E(m.courseId) + '</b> · ' + E(m.patientId) + '（' + E(m.patientName) + '）· ' + E(m.cancerType) + '癌　' + U.link('去绑定', 'dcq:detail:' + m.courseId) + '</div>';
      }).join('') : '<div style="color:#15803d;font-size:12.5px">无缺失' + label + '的病程</div>');
      return;
    }

    /* 页签① 病程记录动作 */
    if (a === 'dcq:check:complete') {
      var missRows = D.courses().filter(function (c) { return D.completeness(c).miss.length; });
      D.runChecks();
      modal('完整性校验结果（D1）', missRows.length ? missRows.map(function (c) {
        var cp = D.completeness(c);
        return '<div class="dcq-prob warn"><div class="h"><span>' + E(c.id) + ' · ' + E(c.patientId) + '（' + E(c.patientName) + '）</span>' + U.badge(cp.filled + '/' + cp.total, 'caution') + '</div>' +
          '<div class="d">缺失字段：<b>' + E(cp.miss.join('、')) + '</b>（填写率 ' + cp.pct + '%）</div><div class="f">' + U.link('去修正', 'dcq:detail:' + c.id) + '</div></div>';
      }).join('') : '<div style="color:#15803d;font-size:12.5px">全部病程关键字段完整</div>');
      refresh(); return;
    }
    if (a === 'dcq:score:all') {
      var res = D.runChecks();
      toast('批量质量评分完成：' + res.courses + ' 份病程，平均 ' + res.avg + ' 分（含完整性/逻辑/及时性）');
      refresh(); return;
    }
    if (a === 'dcq:check:comp') {
      var bad = D.courses().filter(function (c) { var v = D.validateComplication(c); return v.level === '矛盾' || v.level === '警告'; });
      D.runChecks();
      modal('术后并发症合理性校验（D5）', bad.length ? bad.map(function (c) {
        var v = D.validateComplication(c);
        return '<div class="dcq-prob' + (v.level === '警告' ? ' warn' : '') + '"><div class="h"><span>' + E(c.id) + ' · ' + E(c.patientName) + ' · ' + E(c.cancerType) + '癌</span>' + U.badge(v.level, v.level === '矛盾' ? 'danger' : 'caution') + '</div>' +
          '<div class="d">' + E(v.reason) + '</div><div class="f">建议：' + E(v.suggest) + '　' + U.link('去查看', 'dcq:detail:' + c.id) + '</div></div>';
      }).join('') : '<div style="color:#15803d;font-size:12.5px">全部病程并发症记录符合临床常见模式</div>');
      refresh(); return;
    }
    if (a === 'dcq:export:pending') { exportPending(); return; }
    if (has('dcq:detail:export:')) { var cde = D.courseById(arg('dcq:detail:export:')); if (cde) exportDetailReport(cde); return; }
    if (has('dcq:detail:')) { openCase(arg('dcq:detail:')); return; }

    /* 新增 / 修正病程（D1 基础数据维护） */
    if (a === 'dcq:course:add') { courseFormModal(null); return; }
    if (has('dcq:course:edit:')) { var ce = D.courseById(arg('dcq:course:edit:')); if (ce) courseFormModal(ce); return; }
    if (has('dcq:course:save:')) {
      var target2 = arg('dcq:course:save:'), isNew2 = target2 === 'add';
      var data = {
        patientId: val('dcqf-c-pid'), patientName: val('dcqf-c-name'), cancerType: val('dcqf-c-cancer'),
        primaryFeature: val('dcqf-c-feature'), surgery: val('dcqf-c-surgery'), therapy: val('dcqf-c-therapy'),
        complication: val('dcqf-c-comp'), operDate: val('dcqf-c-oper'), recorder: val('dcqf-c-recorder'),
        tplId: isNew2 ? val('dcqf-c-tpl') : ''
      };
      if (!data.patientId || data.patientId === 'P-') { toast('请填写患者ID', true); return; }
      if (!data.recorder) { toast('请填写记录人', true); return; }
      var rsave = D.saveCourse(isNew2 ? data : Object.assign({}, data, { id: target2 }));
      closeModal(); toast(rsave.msg, !rsave.ok); if (rsave.ok) refresh(); return;
    }
    if (has('dcq:reaudit:do:')) {
      var rr = D.markReaudit(arg('dcq:reaudit:do:'), (val('dcqf-rr-reason') || '') + (val('dcqf-rr-note') ? '；' + val('dcqf-rr-note') : ''));
      closeModal(); toast(rr.msg, !rr.ok); if (rr.ok) refresh(); return;
    }
    if (has('dcq:reaudit:')) { var rc = D.courseById(arg('dcq:reaudit:')); if (rc) reauditModal(rc); return; }
    if (has('dcq:resolve:')) {
      var rid2 = arg('dcq:resolve:');
      if (typeof showConfirm === 'function') showConfirm('完成重新审核', '确认该病程的问题已整改完毕并完成重新审核吗？系统将按当前问题清单自动判定状态。', function () {
        var rr2 = D.resolveReaudit(rid2); toast(rr2.msg, !rr2.ok); refresh();
      });
      return;
    }
    /* 页签② 模板动作 */
    if (a === 'dcq:tpl:add') { tplFormModal(null); return; }
    if (has('dcq:tpl:edit:')) { var te = D.templates().filter(function (t) { return t.id === arg('dcq:tpl:edit:'); })[0]; if (te) tplFormModal(te); return; }
    if (has('dcq:tpl:detail:')) { var td = D.templates().filter(function (t) { return t.id === arg('dcq:tpl:detail:'); })[0]; if (td) tplDetailModal(td); return; }
    if (has('dcq:tpl:copy:')) {
      var cp2 = D.copyTemplate(arg('dcq:tpl:copy:')); toast(cp2.msg, !cp2.ok); if (cp2.ok) refresh(); return;
    }
    if (has('dcq:tpl:del:')) {
      var tid = arg('dcq:tpl:del:');
      if (typeof showConfirm === 'function') showConfirm('删除病程模板', '确认删除模板 ' + tid + ' 吗？启用中的模板不可删除，请先停用。', function () {
        var rd2 = D.deleteTemplate(tid); toast(rd2.msg, !rd2.ok); refresh();
      });
      return;
    }
    if (has('dcq:tpl:save:')) {
      var target3 = arg('dcq:tpl:save:'), isNew3 = target3 === 'add';
      var ctypes = [];
      var cks = document.querySelectorAll ? document.querySelectorAll('.dcq-tc:checked') : [];
      for (var ci = 0; ci < cks.length; ci++) ctypes.push(cks[ci].value);
      var dyn = String(val('dcqf-t-dyn')).split(/\n+/).map(function (line) {
        var parts = line.split('|').map(function (x) { return x.trim(); });
        return parts.length >= 4 && parts[0] ? { show: parts[0], condField: parts[1], op: parts[2], value: parts.slice(3).join('|') } : null;
      }).filter(Boolean);
      var defs = {};
      String(val('dcqf-t-def')).split(/\n+/).forEach(function (line) {
        var i2 = line.indexOf('=');
        if (i2 <= 0) return;
        var k = line.slice(0, i2).trim(), v2 = line.slice(i2 + 1).trim();
        var fk = Object.keys(D.FIELD_CN).filter(function (x) { return D.FIELD_CN[x] === k; })[0] || k;
        if (v2) defs[fk] = v2;
      });
      var tpl = {
        name: val('dcqf-t-name'), cancerTypes: ctypes, version: parseInt(val('dcqf-t-ver'), 10) || 1,
        state: val('dcqf-t-state'), dynamicFields: dyn, defaults: defs, desc: val('dcqf-t-desc')
      };
      if (!tpl.name) { toast('请填写模板名称', true); return; }
      if (!tpl.cancerTypes.length) { toast('请至少选择一个癌种适用范围', true); return; }
      var tsave = D.saveTemplate(isNew3 ? tpl : Object.assign({}, tpl, { id: target3 }));
      closeModal(); toast(tsave.msg, !tsave.ok); if (tsave.ok) refresh(); return;
    }
    if (a === 'dcq:export:tpl') { exportTemplates(); return; }

    /* 页签③ 关联动作 */
    if (has('dcq:bind:do:')) {
      var field2 = arg('dcq:bind:do:');
      var cid2 = val('dcqf-bind-course'), eid = val('dcqf-bind-ent');
      var rb = D.bindLink(cid2, field2, eid);
      closeModal(); toast(rb.msg, !rb.ok); if (rb.ok) refresh(); return;
    }
    if (has('dcq:bind:')) {
      var rest = arg('dcq:bind:');
      /* 详情页绑定：dcq:bind:tnmId:DC-xxx（携带指定病程）；工具栏绑定：dcq:bind:tnm */
      if (rest.indexOf('tnmId:') === 0) { bindModal('tnmId', rest.slice(6)); return; }
      if (rest.indexOf('pathId:') === 0) { bindModal('pathId', rest.slice(7)); return; }
      if (rest.indexOf('medId:') === 0) { bindModal('medId', rest.slice(6)); return; }
      if (rest === 'tnm') { bindModal('tnmId', ''); return; }
      if (rest === 'path') { bindModal('pathId', ''); return; }
      if (rest === 'med') { bindModal('medId', ''); return; }
      return;
    }
    if (has('dcq:unbind:')) {
      /* dcq:unbind:<courseId>:<field> */
      var rest2 = arg('dcq:unbind:'), idx2 = rest2.lastIndexOf(':');
      var cuid = rest2.slice(0, idx2), fld = rest2.slice(idx2 + 1);
      var label2 = fld === 'tnmId' ? 'TNM分期记录' : fld === 'pathId' ? '病理报告' : '用药记录';
      if (typeof showConfirm === 'function') showConfirm('解除关联', '确认解除该病程与「' + label2 + '」的关联吗？', function () {
        var ru = D.unbindLink(cuid, fld); toast(ru.msg, !ru.ok); refresh();
      });
      return;
    }
    if (has('dcq:links:view:')) { linksViewModal(arg('dcq:links:view:')); return; }
    if (has('dcq:link:del:do:')) {
      var rl = D.removeLink(arg('dcq:link:del:do:'), val('dcqf-ld-reason'));
      closeModal(); toast(rl.msg, !rl.ok); if (rl.ok) refresh(); return;
    }
    if (has('dcq:link:del:')) {
      var ld = D.links().filter(function (x) { return x.id === arg('dcq:link:del:'); })[0];
      if (ld) linkDelModal(ld); return;
    }
    if (has('dcq:link:invalid:')) {
      var li = arg('dcq:link:invalid:');
      if (typeof showConfirm === 'function') showConfirm('标记无效关联', '确认将关联 ' + li + ' 标记为无效吗？标记后不再参与一致性校验，可随后删除。', function () {
        var rm = D.markLinkInvalid(li, '人工判定无效'); toast(rm.msg, !rm.ok); refresh();
      });
      return;
    }
    if (a === 'dcq:consistency') { consistencyModal(); return; }
    if (a === 'dcq:missing') { missingModal(); return; }
    if (a === 'dcq:export:links') { exportLinks(); return; }
  });

  /* 模板启停开关 + 绑定弹窗病程切换 */
  document.addEventListener('change', function (ev) {
    var el = ev.target; if (!el || !el.getAttribute) return;
    var tid2 = el.getAttribute('data-dcqtpl');
    if (tid2) {
      var st2 = D.toggleTemplate(tid2);
      if (st2) toast('模板 ' + tid2 + (st2 === '启用' ? ' 已启用（对新增病程生效）' : ' 已停用'));
      refresh(); return;
    }
    var field3 = el.getAttribute('data-dcq-bind-course');
    if (field3) {
      var cid3 = String(el.value || '');
      var box = document.getElementById('dcqf-bind-ent');
      if (box) box.innerHTML = entOptions(cid3, field3);
      return;
    }
  });

  /* ==================== 路由接管 ==================== */
  var baseRender = (typeof window.renderPage === 'function') ? window.renderPage : function () {};
  window.renderPage = function (id) {
    if (id === 'dcq-workbench' || (typeof id === 'string' && id.indexOf('dcq-case|') === 0)) {
      if (id === 'dcq-workbench') { ST.tab = ST.tab === 'DETAIL' ? '病程记录' : ST.tab; ST.detailId = ''; }
      else { ST.tab = 'DETAIL'; ST.detailId = id.slice(9); }
      document.getElementById('pageContainer').innerHTML = renderPageId(id);
      if (typeof setActiveMenu === 'function') setActiveMenu('dcq-workbench');
      if (typeof updateBreadcrumb === 'function') updateBreadcrumb('dcq-workbench', id === 'dcq-workbench' ? '' : '病程记录详情');
      if (typeof autoSizeSelects === 'function') { try { autoSizeSelects(); } catch (e) {} }
      var mc = document.getElementById('mainContent'); if (mc && mc.scrollTop !== undefined) mc.scrollTop = 0;
      return;
    }
    return baseRender.apply(this, arguments);
  };
  /* hash 直达详情页兜底（initApp 白名单已放行 dcq-case| 前缀） */
  document.addEventListener('DOMContentLoaded', function () {
    var h = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    if (h.indexOf('dcq-case|') !== 0) return;
    var id = h.slice(9);
    if (ST.tab === 'DETAIL' && ST.detailId === id) return;
    openCase(id);
  });

  window.DCQ = { state: ST, renderPageId: renderPageId, openCase: openCase, back: back, refresh: refresh, FP_MAP: FP_MAP };
})();
