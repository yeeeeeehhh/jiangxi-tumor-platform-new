/* ============================================================================
 * course-qc-data.js — 专病病程质控 · 数据层（window.DCQD）
 *
 * 对照《专病病程质控》3 张信息表 / 21 个功能点：
 *   1) 专病病程记录 {病程ID, 患者ID, 癌种类型, 原发灶特征, 手术方式, 放化疗方案,
 *      术后30天并发症, 记录时间, 记录人}（另含手术日期，支撑 30 天窗口校验）
 *   2) 病程模板配置 {模板ID, 模板名称, 癌种适用范围, 动态字段配置, 默认值规则}
 *   3) 病程关联数据索引 {关联TNM分期ID, 关联病理ID, 关联用药记录ID}
 *      TNM / 病理 / 用药为模拟外部系统的种子实体，接真实系统时只替换本文件。
 *
 * 纯前端原型：localStorage（jx.dcq.*.v1），schema 不符整组重播种。
 * ========================================================================== */
(function () {
  'use strict';

  /* ==================== 工具 ==================== */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function now() { var d = new Date(); return dateStr(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return dateStr(new Date()); }
  function addDays(ds, n) { var d = new Date(String(ds).replace(/-/g, '/') + ' 00:00:00'); d.setDate(d.getDate() + n); return dateStr(d); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function seedOf(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function rnd01(s) { return (seedOf(s) % 1000) / 1000; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* 日期差（天）：b - a */
  function dayDiff(a, b) {
    if (!a || !b) return null;
    var da = new Date(String(a).replace(/-/g, '/').replace('T', ' ').slice(0, 10));
    var db = new Date(String(b).replace(/-/g, '/').replace('T', ' ').slice(0, 10));
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
    return Math.round((db - da) / 86400000);
  }

  /* ==================== localStorage ==================== */
  var SCHEMA = 1;
  var K = {
    meta: 'jx.dcq.meta.v1', courses: 'jx.dcq.courses.v1', templates: 'jx.dcq.templates.v1',
    links: 'jx.dcq.links.v1', tnm: 'jx.dcq.tnm.v1', paths: 'jx.dcq.paths.v1',
    meds: 'jx.dcq.meds.v1', logs: 'jx.dcq.logs.v1'
  };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 静默降级内存态 */ } }

  /* ==================== 枚举 ==================== */
  var CANCERS = ['肺', '乳腺', '结直肠', '胃', '肝', '宫颈'];
  /* 与病理信息质控（pathology-qc-data.js）保持同一手术方式口径，便于交叉比对 */
  var SURGERY = ['根治性切除', '扩大根治切除', '姑息性切除', '局部切除', '活检', '未手术'];
  var THERAPY = ['未开始', '术前新辅助化疗', '术后辅助化疗', '同步放化疗', '单纯放疗', '靶向治疗', '免疫治疗', '不适用'];
  var QC_STATES = ['待质控', '需重新审核', '校验通过'];
  var TPL_STATES = ['启用', '停用'];
  var LINK_STATES = ['有效', '无效'];
  var FIELD_CN = {
    cancerType: '癌种类型', primaryFeature: '原发灶特征', surgery: '手术方式',
    therapy: '放化疗方案', complication: '术后30天并发症', recorder: '记录人',
    operDate: '手术日期', recordTime: '记录时间'
  };
  var ACTOR = '病程质控员（演示账号）';

  /* 各癌种术后 30 天常见并发症白名单（演示口径，依据临床常见模式整理） */
  var COMPLICATION_STD = {
    '肺': ['肺部感染', '胸腔积液', '气胸', '支气管胸膜瘘', '肺不张', '呼吸衰竭', '心律失常', '切口感染'],
    '乳腺': ['皮下积液', '皮瓣坏死', '上肢淋巴水肿', '腋窝血肿', '切口感染', '皮下血肿'],
    '结直肠': ['吻合口瘘', '肠梗阻', '切口感染', '吻合口出血', '腹腔感染', '腹泻'],
    '胃': ['吻合口瘘', '倾倒综合征', '腹腔感染', '吻合口狭窄', '胃排空障碍', '反流性食管炎'],
    '肝': ['腹腔出血', '肝功能衰竭', '胆瘘', '腹水', '胸腔积液', '切口感染'],
    '宫颈': ['尿潴留', '淋巴囊肿', '输尿管损伤', '下肢淋巴水肿', '膀胱阴道瘘', '切口感染']
  };
  var CORE_FIELDS = [
    ['cancerType', '癌种类型'], ['primaryFeature', '原发灶特征'], ['surgery', '手术方式'],
    ['therapy', '放化疗方案'], ['complication', '术后30天并发症'], ['recorder', '记录人']
  ];

  /* ==================== 病程完整性 / 并发症 / 评分 ==================== */
  function completeness(c) {
    var filled = CORE_FIELDS.filter(function (f) { return c[f[0]] != null && String(c[f[0]]).trim() !== ''; }).length;
    return {
      filled: filled, total: CORE_FIELDS.length, pct: Math.round(filled / CORE_FIELDS.length * 1000) / 10,
      miss: CORE_FIELDS.filter(function (f) { return c[f[0]] == null || String(c[f[0]]).trim() === ''; }).map(function (f) { return f[1]; })
    };
  }
  /* 术后并发症合理性：
     · 未手术却记录术后并发症 → 矛盾（强提示）
     · 活检 + 并发症 → 警告（活检创伤小，需核实）
     · 并发症不在该癌种常见白名单 → 警告（需人工核实）
     返回 level: 正常 | 矛盾 | 警告 | 缺失 */
  function validateComplication(c) {
    var v = String(c.complication == null ? '' : c.complication).trim();
    if (!v) return { ok: false, level: '缺失', reason: '术后30天并发症未记录', suggest: '补录并发症情况；无并发症请填写「无」' };
    if (v === '无') {
      if (c.surgery === '未手术') return { ok: true, level: '正常', reason: '', suggest: '' };
      return { ok: true, level: '正常', reason: '', suggest: '' };
    }
    if (c.surgery === '未手术') {
      return { ok: false, level: '矛盾', reason: '手术方式为「未手术」却记录了术后并发症「' + v + '」', suggest: '核对手术记录与并发症记录，修正手术方式或并发症' };
    }
    if (c.surgery === '活检') {
      return { ok: false, level: '警告', reason: '手术方式为「活检」但记录了并发症「' + v + '」', suggest: '核实并发症与活检操作的关联性' };
    }
    var std = COMPLICATION_STD[c.cancerType] || [];
    var hit = std.filter(function (x) { return v.indexOf(x) >= 0; })[0];
    if (!hit) {
      return { ok: false, level: '警告', reason: '「' + v + '」不在' + (c.cancerType || '该癌种') + '术后30天常见并发症模式内', suggest: '常见模式：' + (std.join(' / ') || '—') };
    }
    return { ok: true, level: '正常', reason: '', suggest: '' };
  }
  /* 及时性：记录时间与手术日期间隔 */
  function timeliness(c) {
    if (!c.operDate) return { days: null, got: 15, note: '手术日期缺失，及时性无法完整评估（按半分计）' };
    var d = dayDiff(c.operDate, c.recordTime);
    if (d == null) return { days: null, got: 15, note: '日期格式异常，及时性无法评估（按半分计）' };
    if (d < 0) return { days: d, got: 0, note: '记录时间早于手术日期，时序矛盾' };
    if (d <= 3) return { days: d, got: 30, note: '术后 ' + d + ' 天完成记录，及时' };
    if (d <= 7) return { days: d, got: 25, note: '术后 ' + d + ' 天完成记录，符合 7 天时限' };
    if (d <= 14) return { days: d, got: 18, note: '术后 ' + d + ' 天完成记录，超过 7 天时限' };
    return { days: d, got: 8, note: '术后 ' + d + ' 天完成记录，明显滞后' };
  }
  function scoreOf(c) {
    var items = [];
    var comp = completeness(c);
    items.push({
      name: '字段完整性', got: Math.round(comp.filled / comp.total * 40), full: 40,
      fail: comp.miss.map(function (x) { return x + '缺失'; }),
      note: comp.filled + '/' + comp.total + ' 个关键字段（' + comp.pct + '%）'
    });

    var logicFail = [], compv = validateComplication(c);
    if (!compv.ok && compv.level !== '缺失') logicFail.push(compv.reason);
    var link = linkOf(c.id);
    if (link) {
      var ci = consistencyIssues(link);
      ci.forEach(function (x) { logicFail.push(x.detail); });
    }
    if (String(c.therapy).indexOf('未开始') >= 0 && c.surgery === '根治性切除') logicFail.push('根治性切除术后方案仍为「未开始」，需确认是否漏填');
    items.push({ name: '逻辑一致性', got: Math.max(0, 30 - logicFail.length * 8), full: 30, fail: logicFail, note: '' });

    var tl = timeliness(c);
    var tlFail = [];
    if (tl.days != null && tl.days > 7) tlFail.push('记录滞后：' + tl.note);
    else if (tl.days != null && tl.days < 0) tlFail.push('时序矛盾：' + tl.note);
    else if (tl.days == null) tlFail.push('手术日期缺失');
    items.push({ name: '记录及时性', got: tl.got, full: 30, fail: tlFail, note: tl.note });

    var total = items.reduce(function (s, x) { return s + x.got; }, 0);
    return { total: total, items: items, completeness: comp };
  }

  /* ==================== 关联数据一致性 / 缺失预警 ==================== */
  function tnmById(id) { return tnmArr().filter(function (x) { return x.id === id; })[0] || null; }
  function pathById(id) { return pathsArr().filter(function (x) { return x.id === id; })[0] || null; }
  function medById(id) { return medsArr().filter(function (x) { return x.id === id; })[0] || null; }
  function courseById(id) { return coursesArr().filter(function (x) { return x.id === id; })[0] || null; }
  function linkOf(courseId) { return linksArr().filter(function (x) { return x.courseId === courseId && x.state === '有效'; })[0] || null; }
  function linkByCourseAny(courseId) { return linksArr().filter(function (x) { return x.courseId === courseId; })[0] || null; }

  /* 校验一条关联（TNM / 病理 / 用药）与病程之间的一致性 */
  function consistencyIssues(link) {
    var out = [];
    if (!link || link.state !== '有效') return out;
    var c = courseById(link.courseId);
    if (!c) return out;
    function chk(kind, ent, label) {
      if (!ent) return;
      if (ent.patientId !== c.patientId) {
        out.push({ kind: kind, level: '矛盾', detail: label + '「' + ent.id + '」患者ID为 ' + ent.patientId + '，与病程患者 ' + c.patientId + ' 不一致' });
      }
    }
    if (link.tnmId) {
      var t = tnmById(link.tnmId);
      chk('tnm', t, 'TNM分期记录');
      if (t) {
        var latest = tnmArr().filter(function (x) { return x.patientId === t.patientId; })
          .sort(function (a, b) { return Number(b.version) - Number(a.version); })[0];
        if (latest && Number(latest.version) > Number(t.version)) {
          out.push({ kind: 'tnm', level: '警告', detail: 'TNM分期绑定的是 v' + t.version + '（' + t.stage + '），该患者已有 v' + latest.version + '（' + latest.stage + '）更新版本' });
        }
      }
    }
    if (link.pathId) {
      var p = pathById(link.pathId);
      chk('path', p, '病理报告');
      if (p && dayDiff(c.recordTime, p.reportAt) != null && dayDiff(c.recordTime, p.reportAt) > 0) {
        out.push({ kind: 'path', level: '警告', detail: '病理报告「' + p.id + '」签发日期 ' + p.reportAt + ' 晚于病程记录时间 ' + c.recordTime });
      }
    }
    if (link.medId) {
      var m = medById(link.medId);
      chk('med', m, '用药记录');
      if (m && String(c.therapy).indexOf('未开始') >= 0 && m.status !== '未开始') {
        out.push({ kind: 'med', level: '矛盾', detail: '病程方案为「未开始」，但关联用药记录「' + m.id + '」状态为「' + m.status + '」（' + m.regimen + '）' });
      }
    }
    return out;
  }

  /* 缺失预警：列出缺少关键关联数据的病程 */
  function missingLinks() {
    var out = [];
    coursesArr().forEach(function (c) {
      var link = linkOf(c.id), miss = [];
      var hasT = link && link.tnmId, hasP = link && link.pathId, hasM = link && link.medId;
      /* 实体瘤均应有 TNM 分期 */
      if (!hasT) miss.push('TNM分期');
      /* 手术（非未手术）应有病理佐证 */
      if (c.surgery && c.surgery !== '未手术' && !hasP) miss.push('病理报告');
      /* 方案已开始应有用药记录 */
      if (c.therapy && c.therapy.indexOf('未开始') < 0 && c.therapy !== '不适用' && !hasM) miss.push('用药记录');
      if (miss.length) out.push({
        courseId: c.id, patientId: c.patientId, patientName: c.patientName, cancerType: c.cancerType,
        missing: miss, badLinks: linksArr().filter(function (x) { return x.courseId === c.id && x.state === '无效'; }).length
      });
    });
    return out;
  }

  /* 病程全量问题清单：完整性 + 并发症 + 及时性 + 关联一致性/缺失 */
  function checkCourse(c) {
    var issues = [];
    var comp = completeness(c);
    comp.miss.forEach(function (m) { issues.push({ type: '完整性', level: '缺失', detail: m + '缺失', suggest: '补录' + m }); });
    var cv = validateComplication(c);
    if (!cv.ok) issues.push({ type: '并发症合理性', level: cv.level, detail: cv.reason, suggest: cv.suggest });
    var tl = timeliness(c);
    if (tl.days != null && tl.days > 7) issues.push({ type: '记录及时性', level: '警告', detail: tl.note, suggest: '术后 7 天内完成病程记录' });
    if (tl.days == null && !c.operDate) issues.push({ type: '记录及时性', level: '警告', detail: '手术日期缺失，无法校验术后 30 天窗口', suggest: '补录手术日期' });
    var link = linkOf(c.id);
    if (link) consistencyIssues(link).forEach(function (x) {
      issues.push({ type: '关联一致性', level: x.level, detail: x.detail, suggest: '核对并修正关联关系' });
    });
    missingLinks().filter(function (m) { return m.courseId === c.id; }).forEach(function (m) {
      issues.push({ type: '关联缺失', level: '提示', detail: '缺少关键关联数据：' + m.missing.join('、'), suggest: '在「关联索引」页签补绑' });
    });
    return issues;
  }

  /* ==================== 种子：病程记录（12 条） ==================== */
  /* 字段：id 病程ID / patientId / patientName / cancerType / primaryFeature 原发灶特征 /
     surgery 手术方式 / therapy 放化疗方案 / complication 术后30天并发症 / operDate 手术日期 /
     recordTime 记录时间 / recorder 记录人 / qcState / reauditNote / score / logs */
  function mkCourse(r) {
    return {
      id: r.id, patientId: r.patientId, patientName: r.patientName, cancerType: r.cancerType,
      primaryFeature: r.primaryFeature, surgery: r.surgery, therapy: r.therapy,
      complication: r.complication, operDate: r.operDate, recordTime: r.recordTime,
      recorder: r.recorder, qcState: r.qcState || '待质控', reauditNote: r.reauditNote || '',
      score: null, logs: [{ at: r.recordTime, actor: r.recorder || '系统', action: '新建病程记录', note: '来源：EMR 病程模块（演示）' }]
    };
  }
  var seedCourses = [
    /* 标准数据（逻辑全通过） */
    { id: 'DC-20260812-0001', patientId: 'P-31001', patientName: '王建国', cancerType: '肺', primaryFeature: '左肺上叶 2.8cm 毛玻璃结节，胸膜牵拉', surgery: '根治性切除', therapy: '术后辅助化疗（TP 方案×4 周期）', complication: '无', operDate: '2026-08-10', recordTime: '2026-08-12 09:30', recorder: '王病程', qcState: '校验通过' },
    { id: 'DC-20260819-0002', patientId: 'P-31002', patientName: '李秀英', cancerType: '乳腺', primaryFeature: '左乳外上象限 1.5cm 结节，质硬', surgery: '根治性切除', therapy: '未开始', complication: '皮下积液', operDate: '2026-08-17', recordTime: '2026-08-19 15:10', recorder: '李病程', qcState: '校验通过' },
    { id: 'DC-20260902-0003', patientId: 'P-31003', patientName: '陈志强', cancerType: '结直肠', primaryFeature: '乙状结肠溃疡型肿块，侵占浆膜', surgery: '根治性切除', therapy: '术后辅助化疗（XELOX×6 周期）', complication: '吻合口瘘', operDate: '2026-08-30', recordTime: '2026-09-02 11:20', recorder: '陈病程', qcState: '校验通过' },
    /* 字段缺失 */
    { id: 'DC-20260915-0004', patientId: 'P-31004', patientName: '周敏', cancerType: '肺', primaryFeature: '', surgery: '根治性切除', therapy: '', complication: '无', operDate: '2026-09-13', recordTime: '2026-09-15 10:00', recorder: '周病程' },
    /* 并发症矛盾（未手术 + 术后并发症） */
    { id: 'DC-20260928-0005', patientId: 'P-31005', patientName: '张伟', cancerType: '胃', primaryFeature: '胃窦部 4cm 溃疡型肿物', surgery: '未手术', therapy: '术前新辅助化疗（SOX×3 周期）', complication: '吻合口瘘', operDate: '', recordTime: '2026-09-28 09:40', recorder: '张病程', qcState: '需重新审核', reauditNote: '并发症与手术方式矛盾，需核实手术记录' },
    /* 关联矛盾：用药已开始但方案未开始 + TNM 版本过期 */
    { id: 'DC-20261003-0006', patientId: 'P-31006', patientName: '冯刚', cancerType: '肝', primaryFeature: '右肝叶 5.5cm 肿块，门静脉侵犯可疑', surgery: '局部切除', therapy: '未开始', complication: '无', operDate: '2026-10-01', recordTime: '2026-10-03 14:20', recorder: '冯病程' },
    /* 及时性差（手术后 20 天记录） */
    { id: 'DC-20261008-0007', patientId: 'P-31007', patientName: '郑丽', cancerType: '乳腺', primaryFeature: '右乳内上象限 2cm 肿块，皮肤凹陷', surgery: '扩大根治切除', therapy: '术后辅助化疗（AC-T 方案）', complication: '无', operDate: '2026-09-18', recordTime: '2026-10-08 16:30', recorder: '郑病程' },
    /* 并发症不在常见模式 */
    { id: 'DC-20261012-0008', patientId: 'P-31008', patientName: '曹阳', cancerType: '宫颈', primaryFeature: '宫颈后唇菜花型肿物', surgery: '根治性切除', therapy: '同步放化疗', complication: '不明原因发热', operDate: '2026-10-10', recordTime: '2026-10-12 08:50', recorder: '曹病程' },
    /* 缺用药关联（方案已开始但未绑用药） */
    { id: 'DC-20261015-0009', patientId: 'P-31009', patientName: '谢芳', cancerType: '肺', primaryFeature: '左肺下叶 2.2cm 实性结节', surgery: '根治性切除', therapy: '术后辅助化疗（培美曲塞+铂类）', complication: '无', operDate: '2026-10-13', recordTime: '2026-10-15 10:30', recorder: '谢病程' },
    /* 缺并发症 + 缺记录人 */
    { id: 'DC-20261021-0010', patientId: 'P-31010', patientName: '徐勇', cancerType: '结直肠', primaryFeature: '升结肠隆起型病变 3cm', surgery: '姑息性切除', therapy: '靶向治疗（贝伐珠单抗）', complication: '', operDate: '2026-10-19', recordTime: '2026-10-21 13:00', recorder: '' },
    { id: 'DC-20261025-0011', patientId: 'P-31011', patientName: '高峰', cancerType: '胃', primaryFeature: '贲门部溃疡 3.5cm', surgery: '根治性切除', therapy: '术后辅助化疗（FOLFOX）', complication: '无', operDate: '2026-10-23', recordTime: '2026-10-25 09:15', recorder: '高病程', qcState: '校验通过' },
    /* 缺手术日期 + 病理报告晚于记录（时序矛盾） */
    { id: 'DC-20261028-0012', patientId: 'P-31012', patientName: '吕婷', cancerType: '肺', primaryFeature: '右肺中叶 2.5cm 结节', surgery: '活检', therapy: '未开始', complication: '无', operDate: '', recordTime: '2026-10-28 15:40', recorder: '吕病程' }
  ];

  /* ==================== 种子：病程模板（5 条，含同癌种两版本） ==================== */
  /* 字段：id / name / cancerTypes 癌种适用范围 / version / state 启用状态 /
     dynamicFields 动态字段配置 [{show,condField,op,value}] / defaults 默认值规则 {字段:默认值} */
  var seedTemplates = [
    {
      id: 'DCT-01', name: '肺癌根治术后病程模板', cancerTypes: ['肺'], version: 3, state: '启用',
      dynamicFields: [
        { show: '切缘状态', condField: '手术方式', op: '等于', value: '根治性切除' },
        { show: '淋巴结清扫数', condField: '手术方式', op: '等于', value: '根治性切除' }
      ],
      defaults: { therapy: '未开始', complication: '无' },
      editor: '王模板', updatedAt: '2026-09-20', desc: '适用于肺癌根治性切除术后的病程记录，动态显示切缘与淋巴结字段。'
    },
    {
      id: 'DCT-02', name: '肺癌姑息治疗病程模板', cancerTypes: ['肺'], version: 1, state: '启用',
      dynamicFields: [{ show: '姑息治疗线数', condField: '手术方式', op: '等于', value: '姑息性切除' }],
      defaults: { therapy: '未开始' },
      editor: '王模板', updatedAt: '2026-08-15', desc: '适用于晚期肺癌姑息治疗与随访期病程记录。'
    },
    {
      id: 'DCT-03', name: '乳腺癌改良根治病程模板', cancerTypes: ['乳腺'], version: 2, state: '启用',
      dynamicFields: [{ show: '腋窝淋巴结清扫数', condField: '手术方式', op: '包含', value: '根治' }],
      defaults: { complication: '无', therapy: '未开始' },
      editor: '李模板', updatedAt: '2026-09-28', desc: '适用于乳腺癌改良根治术，动态显示腋窝淋巴结清扫字段。'
    },
    {
      id: 'DCT-04', name: '消化道肿瘤通用病程模板', cancerTypes: ['结直肠', '胃'], version: 1, state: '启用',
      dynamicFields: [{ show: '吻合口情况', condField: '手术方式', op: '包含', value: '切除' }],
      defaults: { complication: '无' },
      editor: '陈模板', updatedAt: '2026-07-12', desc: '结直肠癌 / 胃癌通用，重点记录吻合口相关并发症。'
    },
    {
      id: 'DCT-05', name: '肺癌病程模板（旧版）', cancerTypes: ['肺'], version: 1, state: '停用',
      dynamicFields: [{ show: '切缘状态', condField: '手术方式', op: '等于', value: '根治性切除' }],
      defaults: { therapy: '未开始' },
      editor: '系统预置', updatedAt: '2026-03-01', fromId: '', desc: '已被 DCT-01 v3 取代，保留用于历史病程追溯（停用状态）。'
    }
  ];

  /* ==================== 种子：关联实体（模拟外部系统） ==================== */
  /* TNM 分期记录：同一患者可有多个版本（用于"分期版本不一致"校验） */
  var seedTnm = [
    { id: 'TNM-20260808-01', patientId: 'P-31001', tnm: 'cT1bN0M0', stage: 'IA', version: 1, assessedAt: '2026-08-08', assessor: '影像科·刘医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260816-01', patientId: 'P-31002', tnm: 'cT1N0M0', stage: 'IA', version: 1, assessedAt: '2026-08-16', assessor: '影像科·刘医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260828-01', patientId: 'P-31003', tnm: 'cT3N1M0', stage: 'IIIB', version: 1, assessedAt: '2026-08-28', assessor: '影像科·黄医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260911-01', patientId: 'P-31004', tnm: 'cT2N1M0', stage: 'IIA', version: 1, assessedAt: '2026-09-11', assessor: '影像科·黄医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260920-01', patientId: 'P-31005', tnm: 'cT3N0M0', stage: 'IIB', version: 1, assessedAt: '2026-09-20', assessor: '影像科·周医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260930-02', patientId: 'P-31005', tnm: 'cT4aN2M0', stage: 'IIIC', version: 2, assessedAt: '2026-09-30', assessor: '影像科·周医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260929-01', patientId: 'P-31006', tnm: 'cT2N0M0', stage: 'IB', version: 1, assessedAt: '2026-09-29', assessor: '影像科·刘医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261020-02', patientId: 'P-31006', tnm: 'cT3N1M0', stage: 'IIIA', version: 2, assessedAt: '2026-10-20', assessor: '影像科·刘医师', source: '肿瘤登记系统' },
    { id: 'TNM-20260916-01', patientId: 'P-31007', tnm: 'cT2N1M0', stage: 'IIB', version: 1, assessedAt: '2026-09-16', assessor: '影像科·黄医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261009-01', patientId: 'P-31008', tnm: 'cT2N0M0', stage: 'IB', version: 1, assessedAt: '2026-10-09', assessor: '影像科·周医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261012-01', patientId: 'P-31009', tnm: 'cT1aN0M0', stage: 'IA1', version: 1, assessedAt: '2026-10-12', assessor: '影像科·刘医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261017-01', patientId: 'P-31010', tnm: 'cT3N1M0', stage: 'IIIB', version: 1, assessedAt: '2026-10-17', assessor: '影像科·黄医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261021-01', patientId: 'P-31011', tnm: 'cT3N0M0', stage: 'IIB', version: 1, assessedAt: '2026-10-21', assessor: '影像科·周医师', source: '肿瘤登记系统' },
    { id: 'TNM-20261026-01', patientId: 'P-31012', tnm: 'cT1bN0M0', stage: 'IA', version: 1, assessedAt: '2026-10-26', assessor: '影像科·刘医师', source: '肿瘤登记系统' }
  ];
  var seedPaths = [
    { id: 'BL-20260811-0031', patientId: 'P-31001', histo: '8140/3', histoName: '浸润性腺癌', margin: '阴性', reportAt: '2026-08-11', hospital: '江西省肿瘤医院' },
    { id: 'BL-20260818-0044', patientId: 'P-31002', histo: '8500/3', histoName: '浸润性导管癌', margin: '阴性', reportAt: '2026-08-18', hospital: '南昌大学第二附属医院' },
    { id: 'BL-20260901-0017', patientId: 'P-31003', histo: '8140/3', histoName: '腺癌', margin: '阴性', reportAt: '2026-09-01', hospital: '九江市第一人民医院' },
    { id: 'BL-20260914-0062', patientId: 'P-31004', histo: '8070/3', histoName: '鳞状细胞癌', margin: '阳性', reportAt: '2026-09-14', hospital: '江西省肿瘤医院' },
    { id: 'BL-20260820-0038', patientId: 'P-31006', histo: '8170/3', histoName: '肝细胞癌', margin: '阴性', reportAt: '2026-08-20', hospital: '南昌市第一人民医院' },
    { id: 'BL-20260927-0028', patientId: 'P-31007', histo: '8500/3', histoName: '浸润性导管癌', margin: '阴性', reportAt: '2026-09-27', hospital: '上饶市人民医院' },
    { id: 'BL-20261007-0059', patientId: 'P-31008', histo: '8070/3', histoName: '鳞状细胞癌', margin: '阴性', reportAt: '2026-10-07', hospital: '赣州市肿瘤医院' },
    { id: 'BL-20261013-0067', patientId: 'P-31009', histo: '8140/3', histoName: '浸润性腺癌', margin: '阴性', reportAt: '2026-10-13', hospital: '江西省肿瘤医院' },
    { id: 'BL-20261024-0052', patientId: 'P-31011', histo: '8140/3', histoName: '腺癌', margin: '阴性', reportAt: '2026-10-24', hospital: '宜春市人民医院' },
    { id: 'BL-20261102-0071', patientId: 'P-31012', histo: '8140/3', histoName: '浸润性腺癌', margin: '阴性', reportAt: '2026-11-02', hospital: '江西省肿瘤医院' }
  ];
  var seedMeds = [
    { id: 'MED-20260820-01', patientId: 'P-31001', regimen: 'TP 方案', drug: '紫杉醇 + 顺铂', cycles: 4, startAt: '2026-08-25', status: '进行中' },
    { id: 'MED-20260905-02', patientId: 'P-31003', regimen: 'XELOX 方案', drug: '奥沙利铂 + 卡培他滨', cycles: 6, startAt: '2026-09-10', status: '进行中' },
    { id: 'MED-20261005-03', patientId: 'P-31006', regimen: '靶向治疗', drug: '仑伐替尼', cycles: 0, startAt: '2026-10-05', status: '进行中' },
    { id: 'MED-20260925-04', patientId: 'P-31007', regimen: 'AC-T 方案', drug: '多柔比星 + 环磷酰胺 / 紫杉醇', cycles: 8, startAt: '2026-10-01', status: '进行中' },
    { id: 'MED-20261015-05', patientId: 'P-31008', regimen: '同步放化疗', drug: '顺铂 + 放疗 28 次', cycles: 1, startAt: '2026-10-14', status: '进行中' },
    { id: 'MED-20260910-09', patientId: 'P-31005', regimen: 'SOX 方案', drug: '替吉奥 + 奥沙利铂', cycles: 3, startAt: '2026-09-05', status: '已完成' },
    { id: 'MED-20261018-06', patientId: 'P-31009', regimen: '培美曲塞 + 铂类', drug: '培美曲塞二钠 + 卡铂', cycles: 4, startAt: '2026-10-18', status: '进行中' },
    { id: 'MED-20261022-07', patientId: 'P-31010', regimen: '靶向治疗', drug: '贝伐珠单抗', cycles: 6, startAt: '2026-10-22', status: '进行中' },
    { id: 'MED-20261028-08', patientId: 'P-31011', regimen: 'FOLFOX 方案', drug: '奥沙利铂 + 亚叶酸钙 + 5-FU', cycles: 6, startAt: '2026-10-26', status: '进行中' },
    { id: 'MED-20260815-10', patientId: 'P-31002', regimen: '—', drug: '—', cycles: 0, startAt: '2026-08-20', status: '未开始' }
  ];

  /* ==================== 种子：关联索引（10 条，含无效关联与各类矛盾） ==================== */
  function mkLink(r) {
    return {
      id: r.id, courseId: r.courseId, tnmId: r.tnmId || '', pathId: r.pathId || '', medId: r.medId || '',
      state: r.state || '有效', invalidReason: r.invalidReason || '',
      boundAt: r.boundAt || '2026-09-01 10:00', boundBy: r.boundBy || '系统'
    };
  }
  var seedLinks = [
    { id: 'DCL-001', courseId: 'DC-20260812-0001', tnmId: 'TNM-20260808-01', pathId: 'BL-20260811-0031', medId: 'MED-20260820-01', boundAt: '2026-08-12 10:00', boundBy: '王病程' },
    { id: 'DCL-002', courseId: 'DC-20260819-0002', tnmId: 'TNM-20260816-01', pathId: 'BL-20260818-0044', boundAt: '2026-08-19 16:00', boundBy: '李病程' },
    { id: 'DCL-003', courseId: 'DC-20260902-0003', pathId: 'BL-20260901-0017', medId: 'MED-20260905-02', boundAt: '2026-09-02 12:00', boundBy: '陈病程' },
    { id: 'DCL-004', courseId: 'DC-20260915-0004', tnmId: 'TNM-20260911-01', boundAt: '2026-09-15 11:00', boundBy: '周病程' },
    /* 患者ID 不一致：误绑了 P-31004 的 TNM 分期给 P-31005 */
    { id: 'DCL-005', courseId: 'DC-20260928-0005', tnmId: 'TNM-20260911-01', medId: 'MED-20260910-09', boundAt: '2026-09-28 10:30', boundBy: '张病程' },
    /* TNM 版本过期（绑定 v1，已有 v2）+ 用药状态矛盾（方案未开始，用药进行中） */
    { id: 'DCL-006', courseId: 'DC-20261003-0006', tnmId: 'TNM-20260929-01', pathId: 'BL-20260820-0038', medId: 'MED-20261005-03', boundAt: '2026-10-03 15:00', boundBy: '冯病程' },
    { id: 'DCL-007', courseId: 'DC-20261008-0007', tnmId: 'TNM-20260916-01', pathId: 'BL-20260927-0028', medId: 'MED-20260925-04', boundAt: '2026-10-08 17:00', boundBy: '郑病程' },
    /* 无效关联：误绑定他人病理报告 */
    { id: 'DCL-008', courseId: 'DC-20261012-0008', tnmId: 'TNM-20261009-01', pathId: 'BL-20261013-0067', state: '无效', invalidReason: '误绑定他人病理报告', boundAt: '2026-10-12 09:30', boundBy: '曹病程' },
    /* 缺用药关联（方案已开始，外部系统存在 MED-20261018-06 但未绑定） */
    { id: 'DCL-009', courseId: 'DC-20261015-0009', tnmId: 'TNM-20261012-01', boundAt: '2026-10-15 11:30', boundBy: '谢病程' },
    /* 病理报告日期晚于病程记录（时序矛盾） */
    { id: 'DCL-010', courseId: 'DC-20261028-0012', tnmId: 'TNM-20261026-01', pathId: 'BL-20261102-0071', boundAt: '2026-10-28 16:30', boundBy: '吕病程' },
    /* 全关联（TNM + 病理 + 用药，一致性通过） */
    { id: 'DCL-011', courseId: 'DC-20261025-0011', tnmId: 'TNM-20261021-01', pathId: 'BL-20261024-0052', medId: 'MED-20261028-08', boundAt: '2026-10-25 10:00', boundBy: '高病程' }
  ];

  /* ==================== 存储读写 ==================== */
  var MEM = { courses: null, templates: null, links: null, tnm: null, paths: null, meds: null, logs: null };
  function metaOk() { var m = lsGet(K.meta, null); return !!(m && m.schema === SCHEMA); }
  function resetAll() {
    MEM.courses = MEM.templates = MEM.links = MEM.tnm = MEM.paths = MEM.meds = MEM.logs = null;
    try { Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); }); } catch (e) {}
  }
  function seedAll() {
    var courses = seedCourses.map(mkCourse);
    var templates = clone(seedTemplates);
    var links = seedLinks.map(mkLink);
    var logs = [];
    courses.forEach(function (c) { logs.push({ at: c.recordTime, courseId: c.id, patientId: c.patientId, actor: c.recorder || '系统', action: '新建病程记录', note: '来源：EMR 病程模块（演示）' }); });
    logs.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    setCourses(courses); setTemplates(templates); setLinks(links);
    setTnm(clone(seedTnm)); setPaths(clone(seedPaths)); setMeds(clone(seedMeds)); setLogs(logs);
    try { localStorage.setItem(K.meta, JSON.stringify({ schema: SCHEMA, seededAt: now() })); } catch (e) {}
    MEM.courses = courses; MEM.templates = templates; MEM.links = links;
    MEM.tnm = lsGet(K.tnm, []); MEM.paths = lsGet(K.paths, []); MEM.meds = lsGet(K.meds, []); MEM.logs = logs;
    refreshScores();
  }
  function boot() {
    if (!metaOk()) { resetAll(); seedAll(); return; }
    MEM.courses = lsGet(K.courses, null); MEM.templates = lsGet(K.templates, null);
    MEM.links = lsGet(K.links, null); MEM.tnm = lsGet(K.tnm, null);
    MEM.paths = lsGet(K.paths, null); MEM.meds = lsGet(K.meds, null); MEM.logs = lsGet(K.logs, null);
    if (!MEM.courses || !MEM.templates || !MEM.links || !MEM.tnm || !MEM.paths || !MEM.meds || !MEM.logs) { resetAll(); seedAll(); return; }
    refreshScores();
  }
  boot();
  function coursesArr() { return MEM.courses || (MEM.courses = lsGet(K.courses, [])); }
  function templatesArr() { return MEM.templates || (MEM.templates = lsGet(K.templates, [])); }
  function linksArr() { return MEM.links || (MEM.links = lsGet(K.links, [])); }
  function tnmArr() { return MEM.tnm || (MEM.tnm = lsGet(K.tnm, [])); }
  function pathsArr() { return MEM.paths || (MEM.paths = lsGet(K.paths, [])); }
  function medsArr() { return MEM.meds || (MEM.meds = lsGet(K.meds, [])); }
  function logsArr() { return MEM.logs || (MEM.logs = lsGet(K.logs, [])); }
  function setCourses(v) { MEM.courses = v; lsSet(K.courses, v); }
  function setTemplates(v) { MEM.templates = v; lsSet(K.templates, v); }
  function setLinks(v) { MEM.links = v; lsSet(K.links, v); }
  function setTnm(v) { MEM.tnm = v; lsSet(K.tnm, v); }
  function setPaths(v) { MEM.paths = v; lsSet(K.paths, v); }
  function setMeds(v) { MEM.meds = v; lsSet(K.meds, v); }
  function setLogs(v) { MEM.logs = v; lsSet(K.logs, v); }
  function saveCourses() { lsSet(K.courses, coursesArr()); }
  function saveTemplates() { lsSet(K.templates, templatesArr()); }
  function saveLinks() { lsSet(K.links, linksArr()); }
  function addLog(courseId, action, note) {
    var c = courseId ? courseById(courseId) : null;
    logsArr().unshift({ at: now(), courseId: courseId || '', patientId: c ? c.patientId : '', actor: ACTOR, action: action, note: note || '' });
    setLogs(logsArr());
  }
  function refreshScores() {
    coursesArr().forEach(function (c) { c.score = scoreOf(c).total; });
    saveCourses();
  }

  /* ==================== 病程记录操作（页签①） ==================== */
  /* 新增 / 编辑病程记录（新增时按所选模板应用默认值规则） */
  function saveCourse(data) {
    var courses = coursesArr();
    if (data.id) {
      var old = courses.filter(function (c) { return c.id === data.id; })[0];
      if (!old) return { ok: false, msg: '病程记录不存在' };
      var diff = [];
      ['patientName', 'cancerType', 'primaryFeature', 'surgery', 'therapy', 'complication', 'operDate', 'recorder'].forEach(function (k) {
        var nv = data[k] == null ? '' : String(data[k]);
        if (String(old[k] == null ? '' : old[k]) !== nv) diff.push(FIELD_CN[k] + '：' + (old[k] || '空') + ' → ' + (nv || '空'));
        old[k] = nv;
      });
      if (diff.length) old.logs.unshift({ at: now(), actor: ACTOR, action: '修正病程记录', note: diff.join('；') });
      old.score = scoreOf(old).total;
      setCourses(courses);
      addLog(old.id, '修正病程记录', diff.join('；') || '无字段变化');
      return { ok: true, msg: '病程记录已更新并重算质量评分' };
    }
    /* 新增：生成病程ID */
    var maxNo = 0;
    courses.forEach(function (c) { var n = parseInt(String(c.id).slice(-4), 10); if (n > maxNo) maxNo = n; });
    var id = 'DC-' + today().replace(/-/g, '') + '-' + String(maxNo + 1).padStart(4, '0');
    var tpl = data.tplId ? templatesArr().filter(function (t) { return t.id === data.tplId; })[0] : null;
    var rec = mkCourse({
      id: id, patientId: data.patientId, patientName: data.patientName, cancerType: data.cancerType,
      primaryFeature: data.primaryFeature, surgery: data.surgery,
      therapy: data.therapy || (tpl && tpl.defaults.therapy) || '',
      complication: data.complication || (tpl && tpl.defaults.complication) || '',
      operDate: data.operDate, recordTime: now(), recorder: data.recorder
    });
    rec.score = scoreOf(rec).total;
    courses.push(rec); setCourses(courses);
    addLog(id, '新建病程记录', '癌种：' + data.cancerType + '；模板：' + (tpl ? tpl.name : '无') + (tpl ? '（已应用默认值规则）' : ''));
    return { ok: true, msg: '病程记录已创建（' + id + '）', course: rec };
  }
  /* 批量评分 / 完整性 + 并发症校验（D1/D2/D5 共用引擎） */
  function runChecks() {
    var courses = coursesArr();
    var compMiss = 0, compConflict = 0, late = 0;
    courses.forEach(function (c) {
      c.score = scoreOf(c).total;
      var cv = validateComplication(c);
      if (!cv.ok && cv.level === '缺失') compMiss++;
      if (cv.level === '矛盾' || cv.level === '警告') compConflict++;
      var tl = timeliness(c);
      if (tl.days != null && tl.days > 7) late++;
    });
    saveCourses();
    addLog('', '执行病程质控校验', '完整性缺失 ' + compMiss + ' 项 · 并发症异常 ' + compConflict + ' 项 · 记录滞后 ' + late + ' 项');
    return { courses: courses.length, compMiss: compMiss, compConflict: compConflict, late: late, avg: avgScore() };
  }
  function avgScore() {
    var list = coursesArr();
    return list.length ? Math.round(list.reduce(function (s, c) { return s + (c.score || 0); }, 0) / list.length * 10) / 10 : 0;
  }
  /* 标记需重新审核（D6）：写状态 + 原因 + 通知记录人 */
  function markReaudit(id, reason) {
    var c = courseById(id);
    if (!c) return { ok: false, msg: '病程记录不存在' };
    c.qcState = '需重新审核';
    c.reauditNote = reason || '质控发现记录错误或信息不全，需重新审核';
    saveCourses();
    addLog(id, '标记需重新审核', c.reauditNote + '；已通知记录人 ' + (c.recorder || '（未填）'));
    return { ok: true, msg: '已标记为「需重新审核」，并通知记录人 ' + (c.recorder || '') };
  }
  /* 完成重新审核：按问题清单自动回到 校验通过 / 待质控 */
  function resolveReaudit(id) {
    var c = courseById(id);
    if (!c) return { ok: false, msg: '病程记录不存在' };
    var issues = checkCourse(c).filter(function (x) { return x.level === '矛盾' || x.level === '缺失'; });
    c.qcState = issues.length ? '待质控' : '校验通过';
    c.reauditNote = '';
    c.score = scoreOf(c).total;
    saveCourses();
    addLog(id, '完成重新审核', issues.length ? '仍有 ' + issues.length + ' 项待整改，状态回到待质控' : '问题已闭环，状态更新为校验通过');
    return { ok: true, msg: issues.length ? '审核完成：仍有 ' + issues.length + ' 项问题，已退回待质控' : '审核完成：问题已闭环，校验通过' };
  }
  function setState(id, st) {
    var c = courseById(id);
    if (!c) return { ok: false, msg: '病程记录不存在' };
    var old = c.qcState; c.qcState = st; saveCourses();
    addLog(id, '更新质控状态', old + ' → ' + st);
    return { ok: true, msg: '质控状态已更新：' + st };
  }

  /* ==================== 模板配置操作（页签②） ==================== */
  function saveTemplate(tpl) {
    if (!tpl.name || !String(tpl.name).trim()) return { ok: false, msg: '请填写模板名称' };
    if (!tpl.cancerTypes || !tpl.cancerTypes.length) return { ok: false, msg: '请至少选择一个癌种适用范围' };
    var list = templatesArr();
    if (tpl.id) {
      var old = list.filter(function (t) { return t.id === tpl.id; })[0];
      if (!old) return { ok: false, msg: '模板不存在' };
      Object.keys(tpl).forEach(function (k) { old[k] = tpl[k]; });
      old.updatedAt = today();
      setTemplates(list);
      addLog('', '编辑病程模板', old.id + ' · ' + old.name);
      return { ok: true, msg: '模板已保存（' + old.id + '）' };
    }
    var maxNo = 0;
    list.forEach(function (t) { var n = parseInt(String(t.id).replace('DCT-', ''), 10); if (n > maxNo) maxNo = n; });
    tpl.id = 'DCT-' + String(maxNo + 1).padStart(2, '0');
    tpl.version = Number(tpl.version) || 1;
    tpl.state = tpl.state || '停用';
    tpl.editor = ACTOR; tpl.updatedAt = today();
    list.push(tpl); setTemplates(list);
    addLog('', '新建病程模板', tpl.id + ' · ' + tpl.name + '（' + (tpl.cancerTypes || []).join('/') + '）');
    return { ok: true, msg: '模板已创建（' + tpl.id + '，默认停用）' };
  }
  function toggleTemplate(id) {
    var t = templatesArr().filter(function (x) { return x.id === id; })[0];
    if (!t) return null;
    t.state = t.state === '启用' ? '停用' : '启用';
    t.updatedAt = today(); saveTemplates();
    addLog('', (t.state === '启用' ? '启用' : '停用') + '病程模板', id + ' · ' + t.name + ' v' + t.version);
    return t.state;
  }
  function deleteTemplate(id) {
    var list = templatesArr(), idx = list.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return { ok: false, msg: '模板不存在' };
    if (list[idx].state === '启用') return { ok: false, msg: '启用中的模板不可删除，请先停用' };
    var old = list[idx]; list.splice(idx, 1); setTemplates(list);
    addLog('', '删除病程模板', old.id + ' · ' + old.name);
    return { ok: true, msg: '模板已删除' };
  }
  /* 复制现有模板生成新版本（T7）：版本号 +1，新版本默认停用待启用 */
  function copyTemplate(id) {
    var list = templatesArr();
    var src = list.filter(function (t) { return t.id === id; })[0];
    if (!src) return { ok: false, msg: '模板不存在' };
    var maxNo = 0;
    list.forEach(function (t) { var n = parseInt(String(t.id).replace('DCT-', ''), 10); if (n > maxNo) maxNo = n; });
    var nv = clone(src);
    nv.id = 'DCT-' + String(maxNo + 1).padStart(2, '0');
    nv.name = src.name.replace(/（旧版）$/, '').replace(/ V\d+$/, '') + ' V' + (Number(src.version) + 1);
    nv.version = Number(src.version) + 1;
    nv.state = '停用';
    nv.fromId = src.id;
    nv.editor = ACTOR; nv.updatedAt = today();
    list.push(nv); setTemplates(list);
    addLog('', '复制模板生成新版本', src.id + ' → ' + nv.id + '（v' + nv.version + '，默认停用，启用前请核对字段）');
    return { ok: true, msg: '已复制生成 ' + nv.id + '（v' + nv.version + '），请核对后启用', tpl: nv };
  }
  function templatesOfCancer(cancer) {
    return templatesArr().filter(function (t) { return t.state === '启用' && (t.cancerTypes || []).indexOf(cancer) >= 0; });
  }

  /* ==================== 关联索引操作（页签③） ==================== */
  /* 绑定 / 更换关联（R1-R3）。field: tnmId | pathId | medId */
  function bindLink(courseId, field, value) {
    var c = courseById(courseId);
    if (!c) return { ok: false, msg: '病程记录不存在' };
    if (!value) return { ok: false, msg: '请选择要关联的记录' };
    var label = { tnmId: 'TNM分期记录', pathId: '病理报告', medId: '用药记录' }[field] || field;
    var ent = field === 'tnmId' ? tnmById(value) : field === 'pathId' ? pathById(value) : medById(value);
    if (!ent) return { ok: false, msg: label + '不存在' };
    if (ent.patientId !== c.patientId) return { ok: false, msg: '患者ID不一致：' + label + '属于 ' + ent.patientId + '，当前病程患者为 ' + c.patientId };
    var links = linksArr();
    var link = links.filter(function (x) { return x.courseId === courseId; })[0];
    if (!link) {
      var maxNo = 0;
      links.forEach(function (x) { var n = parseInt(String(x.id).replace('DCL-', ''), 10); if (n > maxNo) maxNo = n; });
      link = mkLink({ id: 'DCL-' + String(maxNo + 1).padStart(3, '0'), courseId: courseId, boundAt: now(), boundBy: ACTOR });
      links.push(link);
    }
    link[field] = value;
    link.state = '有效'; link.invalidReason = ''; link.boundAt = now(); link.boundBy = ACTOR;
    setLinks(links);
    addLog(courseId, '绑定' + label, value);
    var warn = consistencyIssues(link).filter(function (x) { return x.level === '矛盾'; });
    return { ok: true, msg: label + '已绑定' + (warn.length ? '（注意：' + warn[0].detail + '）' : ''), link: link };
  }
  /* 解除某个字段的关联 */
  function unbindLink(courseId, field) {
    var link = linkOf(courseId);
    if (!link) return { ok: false, msg: '该病程暂无有效关联记录' };
    var label = { tnmId: 'TNM分期记录', pathId: '病理报告', medId: '用药记录' }[field] || field;
    var old = link[field];
    link[field] = '';
    setLinks(linksArr());
    addLog(courseId, '解除' + label + '关联', old || '');
    return { ok: true, msg: label + '关联已解除' };
  }
  /* 删除无效的关联关系（R7）：整条移除并留痕 */
  function removeLink(linkId, reason) {
    var links = linksArr(), idx = links.findIndex(function (x) { return x.id === linkId; });
    if (idx < 0) return { ok: false, msg: '关联记录不存在' };
    var old = links[idx];
    links.splice(idx, 1); setLinks(links);
    addLog(old.courseId, '删除关联关系', old.id + '（' + (reason || '无效关联') + '）');
    return { ok: true, msg: '关联关系已删除' };
  }
  function markLinkInvalid(linkId, reason) {
    var links = linksArr(), link = links.filter(function (x) { return x.id === linkId; })[0];
    if (!link) return { ok: false, msg: '关联记录不存在' };
    link.state = '无效'; link.invalidReason = reason || '人工判定无效';
    setLinks(links);
    addLog(link.courseId, '标记关联无效', link.id + '：' + link.invalidReason);
    return { ok: true, msg: '已标记为无效关联' };
  }

  /* ==================== 统计 / 导出 ==================== */
  function stats() {
    var courses = coursesArr(), templates = templatesArr(), links = linksArr();
    var compMiss = 0, compBad = 0, late = 0;
    courses.forEach(function (c) {
      var cp = completeness(c);
      if (cp.miss.length) compMiss++;
      var cv = validateComplication(c);
      if (cv.level === '矛盾' || cv.level === '警告') compBad++;
      var tl = timeliness(c);
      if (tl.days != null && tl.days > 7) late++;
    });
    var miss = missingLinks();
    return {
      total: courses.length,
      wait: courses.filter(function (c) { return c.qcState === '待质控'; }).length,
      reaudit: courses.filter(function (c) { return c.qcState === '需重新审核'; }).length,
      passed: courses.filter(function (c) { return c.qcState === '校验通过'; }).length,
      avgScore: avgScore(), compMiss: compMiss, compBad: compBad, late: late,
      tplTotal: templates.length,
      tplOn: templates.filter(function (t) { return t.state === '启用'; }).length,
      tplOff: templates.filter(function (t) { return t.state === '停用'; }).length,
      dynRules: templates.reduce(function (s, t) { return s + (t.dynamicFields || []).length; }, 0),
      defRules: templates.reduce(function (s, t) { return s + Object.keys(t.defaults || {}).length; }, 0),
      linkTotal: links.length,
      linkValid: links.filter(function (x) { return x.state === '有效'; }).length,
      linkInvalid: links.filter(function (x) { return x.state === '无效'; }).length,
      missTnm: miss.filter(function (m) { return m.missing.indexOf('TNM分期') >= 0; }).length,
      missPath: miss.filter(function (m) { return m.missing.indexOf('病理报告') >= 0; }).length,
      missMed: miss.filter(function (m) { return m.missing.indexOf('用药记录') >= 0; }).length,
      missTotal: miss.length,
      badConsistency: links.filter(function (l) { return consistencyIssues(l).some(function (x) { return x.level === '矛盾'; }); }).length
    };
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function exportCsv(name, headers, rows) {
    var out = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    download(name + '.csv', '\ufeff' + headers.map(csvCell).join(',') + '\n' + out);
  }
  function exportJson(name, obj) { download(name + '.json', JSON.stringify(obj, null, 2), 'application/json;charset=utf-8'); }

  /* ==================== 对外出口 ==================== */
  window.DCQD = {
    SCHEMA: SCHEMA,
    CANCERS: CANCERS, SURGERY: SURGERY, THERAPY: THERAPY, QC_STATES: QC_STATES,
    TPL_STATES: TPL_STATES, LINK_STATES: LINK_STATES, FIELD_CN: FIELD_CN,
    COMPLICATION_STD: COMPLICATION_STD, CORE_FIELDS: CORE_FIELDS, ACTOR: ACTOR,
    courses: coursesArr, courseById: courseById, templates: templatesArr, links: linksArr,
    tnm: tnmArr, paths: pathsArr, meds: medsArr, logs: logsArr,
    tnmById: tnmById, pathById: pathById, medById: medById, linkOf: linkOf, linkByCourseAny: linkByCourseAny,
    stats: stats, completeness: completeness, validateComplication: validateComplication,
    timeliness: timeliness, scoreOf: scoreOf, consistencyIssues: consistencyIssues,
    missingLinks: missingLinks, checkCourse: checkCourse, dayDiff: dayDiff,
    saveCourse: saveCourse, runChecks: runChecks, markReaudit: markReaudit,
    resolveReaudit: resolveReaudit, setState: setState,
    saveTemplate: saveTemplate, toggleTemplate: toggleTemplate, deleteTemplate: deleteTemplate,
    copyTemplate: copyTemplate, templatesOfCancer: templatesOfCancer,
    bindLink: bindLink, unbindLink: unbindLink, removeLink: removeLink, markLinkInvalid: markLinkInvalid,
    exportCsv: exportCsv, exportJson: exportJson,
    reset: function () { resetAll(); seedAll(); },
    esc: esc, now: now, today: today, addDays: addDays, rnd01: rnd01
  };
})();
