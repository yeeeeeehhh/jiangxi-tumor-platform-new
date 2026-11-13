/* ============================================================================
 * pathology-qc-data.js — 病理信息质控 · 数据层（window.PQD）
 *
 * 覆盖三类数据对象：
 *   1) 病理核心信息（报告号、患者ID、组织学类型、分化程度、切缘状态、
 *      淋巴结转移数、脉管/神经侵犯、免疫组化、分子标志物、报告医院/医师/时间、
 *      质量评分、版本号、版本留痕、脱敏展示）
 *   2) 病理附件与佐证（报告原文 / 显微图像 / 染色图谱 URL、URL 状态、缺失预警）
 *   3) 病理质控规则（强制填报字段、逻辑校验规则、脱敏规则、完整性阈值、
 *      启停、执行日志统计）
 *
 * 纯前端原型：localStorage（jx.pq.*.v1），schema 不符整组重播种。
 * WHO 组织学类型校验基于 modules.js 的全局 dictPathologyData（ICD-O-3 形态学字典）。
 * ========================================================================== */
(function () {
  'use strict';

  /* ==================== 工具 ==================== */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function now() { var d = new Date(); return dateStr(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return dateStr(new Date()); }
  function addDays(ds, n) { var d = new Date(ds.replace(/-/g, '/') + ' 00:00:00'); d.setDate(d.getDate() + n); return dateStr(d); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function seedOf(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function rnd01(s) { return (seedOf(s) % 1000) / 1000; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ==================== localStorage ==================== */
  var SCHEMA = 1;
  var K = {
    meta: 'jx.pq.meta.v1', reports: 'jx.pq.reports.v1', attachments: 'jx.pq.attachments.v1',
    rules: 'jx.pq.rules.v1', problems: 'jx.pq.problems.v1', logs: 'jx.pq.logs.v1'
  };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 静默降级内存态 */ } }

  /* ==================== 枚举 ==================== */
  var DIFF = ['高分化', '中分化', '低分化', '未分化', '分化程度不明确', '不适用'];
  var MARGIN = ['阴性', '阳性', '无法评估', '未提及'];
  var INVASION = ['无', '有', '可疑', '未查', '不适用'];
  var SURGERY = ['根治性切除', '扩大根治切除', '姑息性切除', '局部切除', '活检', '未手术'];
  var IHC = ['未做', '已做-阴性', '已做-阳性', '结果待回报'];
  var MARKERS = ['EGFR', 'ALK', 'ROS1', 'KRAS', 'BRAF', 'HER2', 'PD-L1', 'MSI/dMMR', 'BRCA1/2', 'TP53'];
  var ATT_TYPES = [{ id: 'report', name: '病理报告原文', key: 'reportUrl', icon: '📄' },
                   { id: 'micro', name: '显微图像', key: 'microUrl', icon: '🔬' },
                   { id: 'stain', name: '染色图谱', key: 'stainUrl', icon: '🎨' }];
  var RULE_TYPES = ['强制填报', '逻辑校验', '脱敏规则', '完整性阈值'];
  var MASK_MODES = ['掩码', '哈希', '替换'];
  var SEVERITIES = ['强拦截', '提示', '记录'];
  var ACTOR = '病理质控员（演示账号）';
  var QC_STATES = ['待质控', '已修正', '已归档'];

  /* WHO 组织学类型标准术语（基于 ICD-O-3 形态学，关联全局 dictPathologyData） */
  var HISTO_STD = [
    { code: '8140/3', name: '腺癌', cat: '上皮性肿瘤' },
    { code: '8070/3', name: '鳞状细胞癌', cat: '上皮性肿瘤' },
    { code: '8500/3', name: '浸润性导管癌', cat: '导管癌' },
    { code: '8041/3', name: '小细胞癌', cat: '神经内分泌肿瘤' },
    { code: '8170/3', name: '肝细胞癌', cat: '上皮性肿瘤' },
    { code: '8260/3', name: '乳头状癌', cat: '上皮性肿瘤' },
    { code: '8310/3', name: '透明细胞癌', cat: '上皮性肿瘤' },
    { code: '8120/3', name: '移行细胞癌', cat: '尿路上皮肿瘤' },
    { code: '8000/3', name: '肿瘤，未特指', cat: '未特指' },
    { code: '8010/3', name: '鳞状细胞癌，未特指', cat: '上皮性肿瘤' }
  ];
  var HISTO_FIX = {
    '腺癌': '8140/3', '鳞癌': '8070/3', '鳞状细胞癌': '8070/3', '浸润性导管癌': '8500/3',
    '导管癌': '8500/3', '小细胞癌': '8041/3', '肝细胞癌': '8170/3', '肝癌': '8170/3',
    '乳头状癌': '8260/3', '透明细胞癌': '8310/3', '移行细胞癌': '8120/3',
    '腺癌,非特指': '8140/3', '恶性肿瘤': '8000/3', '癌': '8010/3'
  };
  /* 与全局字典交叉校验：dictPathologyData 的 code 是 4 位数字（如 8140） */
  function whoDictHas(code4) {
    try {
      var arr = (typeof dictPathologyData !== 'undefined') ? dictPathologyData : [];
      return arr.some(function (x) { return String(x.code) === String(code4) && x.status !== '禁用'; });
    } catch (e) { return false; }
  }
  function validateHisto(text) {
    text = String(text == null ? '' : text).trim();
    if (!text) return { ok: false, reason: '肿瘤组织学类型缺失', suggest: '8140/3 腺癌', code: '' };
    /* 允许三种写法：纯 4 位码 / 4 位码+行为码 / 中文标准术语 / "M-xxxx/x" */
    var normalized = text.toUpperCase().replace(/^M-/, '');
    var m = /^(\d{4})(?:\/(\d))?$/.exec(normalized);
    if (m) {
      var code4 = m[1], beh = m[2] || '3';
      if (Number(code4) < 8000 || Number(code4) > 9999) {
        return { ok: false, reason: '形态学编码超出 WHO ICD-O-3 范围（8000–9999）', suggest: '8140/3', code: text };
      }
      var hit = HISTO_STD.filter(function (h) { return h.code.indexOf(code4) === 0; })[0];
      var inDict = whoDictHas(code4);
      if (!hit && !inDict) {
        return { ok: false, reason: '编码 ' + code4 + ' 不在 WHO 分类标准术语表内（非标准编码）', suggest: '8140/3', code: text };
      }
      if (beh !== '3') {
        return { ok: false, reason: '行为码 /' + beh + ' 与恶性病理诊断不符（WHO 浸润性癌应为 /3 恶性）', suggest: code4 + '/3', code: text };
      }
      return { ok: true, reason: '', suggest: '', code: code4 + '/' + beh, name: hit ? hit.name : '标准形态学编码' };
    }
    /* 中文术语 */
    var std = HISTO_STD.filter(function (h) { return h.name === text; })[0];
    if (std) return { ok: true, reason: '', suggest: '', code: std.code, name: std.name };
    if (HISTO_FIX[text]) {
      return { ok: false, reason: '「' + text + '」为非标准术语（未使用 WHO 标准名称/编码）', suggest: HISTO_FIX[text], code: '' };
    }
    return { ok: false, reason: '「' + text + '」不在 WHO 分类标准术语表内', suggest: '8140/3', code: '' };
  }

  /* 切缘状态与手术方式逻辑一致性 */
  function validateMarginLogic(r) {
    var m = r.margin, s = r.surgery;
    if (!m || m === '未提及' || m === '无法评估' || !s) return { ok: true, reason: '' };
    if (m === '阳性' && (s === '根治性切除' || s === '扩大根治切除')) {
      return { ok: false, reason: '切缘阳性但手术方式为「' + s + '」：根治性切除应达到切缘阴性，存在逻辑矛盾', suggest: '核对切缘状态或手术记录切除范围' };
    }
    if (m === '阴性' && (s === '活检' || s === '未手术')) {
      return { ok: false, reason: '切缘阴性但手术方式为「' + s + '」：未取得手术切缘标本，不应判定切缘状态', suggest: '切缘状态改为「无法评估」' };
    }
    return { ok: true, reason: '' };
  }

  /* ==================== 脱敏 ==================== */
  function maskValue(v, mode) {
    v = String(v == null ? '' : v);
    if (!v) return '';
    if (mode === '哈希') {
      var h = 0; for (var i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
      return 'HASH:' + h.toString(16).toUpperCase().padStart(8, '0');
    }
    if (mode === '替换') return '***已脱敏***';
    /* 掩码：保留前1后1，中间星号；身份证/姓名通用 */
    if (v.length <= 2) return v.charAt(0) + '*';
    return v.charAt(0) + '*'.repeat(Math.min(8, v.length - 2)) + v.charAt(v.length - 1);
  }
  function effectiveMaskMode() {
    /* 取最近配置的一条启用脱敏规则：updatedAt 精确到分钟，新增/编辑后置顶；
       同一分钟内的多条按数组顺序取最后一条（新增规则总在末尾）。 */
    var rs = rulesArr().filter(function (x) { return x.type === '脱敏规则' && x.enabled; });
    if (!rs.length) return '掩码';
    return rs[rs.length - 1].maskMode || '掩码';
  }
  function effectiveThreshold() {
    var rs = rulesArr().filter(function (x) { return x.type === '完整性阈值' && x.enabled; });
    if (!rs.length) return 80;
    return Number(rs[rs.length - 1].threshold) || 80;
  }

  /* ==================== 种子病理报告（22 条） ==================== */
  /* 字段：id 病理报告号 / patientId / patientName / histo 组织学类型 / diff 分化程度 /
     margin 切缘状态 / surgery 手术方式 / lnp 淋巴结转移数 / lnt 淋巴结总数 /
     vascular 脉管侵犯 / neural 神经侵犯 / ihc 免疫组化 / markers 分子标志物(数组) /
     hospital / doctor / signAt 签发时间 / source / qcState / ver / verLog */
  function mkReport(r) {
    var rep = {
      id: r.id, patientId: r.patientId, patientName: r.patientName,
      histo: r.histo, diff: r.diff, margin: r.margin, surgery: r.surgery,
      lnp: r.lnp, lnt: r.lnt, vascular: r.vascular, neural: r.neural,
      ihc: r.ihc, markers: r.markers || [], hospital: r.hospital, doctor: r.doctor,
      signAt: r.signAt, source: r.source, qcState: r.qcState || '待质控',
      ver: r.ver || 1, score: null, verLog: [{ at: r.signAt, who: '系统', what: '接收病理核心诊断信息（v1）' }],
      issues: []
    };
    return rep;
  }
  var seedReports = [
    /* 标准数据 6 条 */
    { id: 'BL-20260812-0031', patientId: 'P-102401', patientName: '王建国', histo: '8140/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 16, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['EGFR', 'ALK'], hospital: '南昌市第一人民医院', doctor: '李病理', signAt: '2026-08-12 14:20', source: '病理科系统' },
    { id: 'BL-20260819-0044', patientId: 'P-102402', patientName: '李秀英', histo: '8500/3', diff: '高分化', margin: '阴性', surgery: '扩大根治切除', lnp: 2, lnt: 18, vascular: '无', neural: '无', ihc: '已做-阳性', markers: ['HER2', 'PD-L1'], hospital: '南昌大学第二附属医院', doctor: '陈镜', signAt: '2026-08-19 09:45', source: '电子病历' },
    { id: 'BL-20260902-0017', patientId: 'P-102403', patientName: '陈志强', histo: '8070/3', diff: '低分化', margin: '阴性', surgery: '根治性切除', lnp: 4, lnt: 22, vascular: '有', neural: '可疑', ihc: '已做-阳性', markers: ['PD-L1', 'TP53'], hospital: '九江市第一人民医院', doctor: '周组织', signAt: '2026-09-02 11:10', source: '病理科系统' },
    { id: 'BL-20260915-0062', patientId: 'P-102406', patientName: '周丽', histo: '8260/3', diff: '高分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 12, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['BRAF'], hospital: '江西省肿瘤医院', doctor: '吴诊', signAt: '2026-09-15 16:30', source: '病理科系统' },
    { id: 'BL-20261003-0028', patientId: 'P-102409', patientName: '冯军', histo: '8010/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 1, lnt: 14, vascular: '无', neural: '无', ihc: '未做', markers: [], hospital: '上饶市人民医院', doctor: '何片', signAt: '2026-10-03 10:05', source: '电子病历' },
    { id: 'BL-20261021-0073', patientId: 'P-102416', patientName: '黄燕', histo: '8500/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 20, vascular: '无', neural: '无', ihc: '已做-阳性', markers: ['HER2', 'BRCA1/2'], hospital: '景德镇市第一人民医院', doctor: '许镜', signAt: '2026-10-21 13:55', source: '病理科系统' },
    /* 非标准术语 / 无效编码 4 条 */
    { id: 'BL-20260825-0011', patientId: 'P-102408', patientName: '郑敏', histo: '腺癌,非特指', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 15, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['EGFR'], hospital: '宜春市人民医院', doctor: '曹诊', signAt: '2026-08-25 08:40', source: '手工录入' },
    { id: 'BL-20260908-0035', patientId: 'P-102413', patientName: '曹阳', histo: '7999/3', diff: '低分化', margin: '阳性', surgery: '根治性切除', lnp: 6, lnt: 19, vascular: '有', neural: '有', ihc: '结果待回报', markers: [], hospital: '九江市第一人民医院', doctor: '张理', signAt: '2026-09-08 15:12', source: '病理科系统' },
    { id: 'BL-20260928-0050', patientId: 'P-102418', patientName: '宋丽', histo: '鳞癌', diff: '未分化', margin: '阴性', surgery: '姑息性切除', lnp: 3, lnt: 9, vascular: '可疑', neural: '无', ihc: '未做', markers: ['KRAS'], hospital: '鹰潭市人民医院', doctor: '沈片', signAt: '2026-09-28 09:20', source: '手工录入' },
    { id: 'BL-20261015-0067', patientId: 'P-102421', patientName: '何平', histo: 'M-8140/2', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 2, lnt: 17, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['MSI/dMMR'], hospital: '吉安市中心人民医院', doctor: '韩诊', signAt: '2026-10-15 11:48', source: '电子病历' },
    /* 切缘-手术方式逻辑矛盾 3 条 */
    { id: 'BL-20260830-0019', patientId: 'P-102405', patientName: '张伟', histo: '8041/3', diff: '低分化', margin: '阳性', surgery: '根治性切除', lnp: 8, lnt: 21, vascular: '有', neural: '有', ihc: '已做-阳性', markers: ['ALK', 'ROS1'], hospital: '南昌市第一人民医院', doctor: '李病理', signAt: '2026-08-30 14:02', source: '病理科系统' },
    { id: 'BL-20260922-0041', patientId: 'P-102412', patientName: '韩雪', histo: '8000/3', diff: '分化程度不明确', margin: '阴性', surgery: '活检', lnp: 0, lnt: 0, vascular: '未查', neural: '未查', ihc: '未做', markers: [], hospital: '南昌大学第一附属医院', doctor: '杨镜', signAt: '2026-09-22 10:33', source: '病理科系统' },
    { id: 'BL-20261008-0059', patientId: 'P-102420', patientName: '秦岚', histo: '8140/3', diff: '中分化', margin: '阳性', surgery: '扩大根治切除', lnp: 5, lnt: 20, vascular: '有', neural: '无', ihc: '结果待回报', markers: [], hospital: '抚州市第一人民医院', doctor: '朱片', signAt: '2026-10-08 16:15', source: '电子病历' },
    /* 必填缺失 / 分子标志物缺失 4 条 */
    { id: 'BL-20260816-0008', patientId: 'P-102410', patientName: '蒋红', histo: '', diff: '', margin: '未提及', surgery: '', lnp: null, lnt: null, vascular: '未查', neural: '未查', ihc: '未做', markers: [], hospital: '抚州市第一人民医院', doctor: '谢诊', signAt: '2026-08-16 09:12', source: '手工录入' },
    { id: 'BL-20260910-0038', patientId: 'P-102414', patientName: '谢芳', histo: '8140/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 1, lnt: 13, vascular: '无', neural: '无', ihc: '已做-阴性', markers: [], hospital: '赣州市肿瘤医院', doctor: '罗理', signAt: '2026-09-10 13:40', source: '病理科系统' },
    { id: 'BL-20260925-0048', patientId: 'P-102417', patientName: '徐勇', histo: '8020/3', diff: '未分化', margin: '无法评估', surgery: '局部切除', lnp: 0, lnt: 5, vascular: '无', neural: '无', ihc: '已做-阳性', markers: [], hospital: '南昌市第三医院', doctor: '高片', signAt: '2026-09-25 15:28', source: '病理科系统' },
    { id: 'BL-20261012-0064', patientId: 'P-102422', patientName: '吕婷', histo: '8260/3', diff: '高分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 11, vascular: '无', neural: '无', ihc: '已做-阴性', markers: [], hospital: '宜春市人民医院', doctor: '吕诊', signAt: '2026-10-12 10:50', source: '电子病历' },
    /* 淋巴结逻辑 / 已修正 / 已归档 5 条 */
    { id: 'BL-20260822-0014', patientId: 'P-102407', patientName: '吴强', histo: '8170/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 3, lnt: null, vascular: '有', neural: '无', ihc: '已做-阳性', markers: ['TP53'], hospital: '萍乡市人民医院', doctor: '邓镜', signAt: '2026-08-22 11:05', source: '病理科系统', qcState: '已修正' },
    { id: 'BL-20260905-0029', patientId: 'P-102411', patientName: '沈磊', histo: '8120/3', diff: '高分化', margin: '阴性', surgery: '根治性切除', lnp: 2, lnt: 15, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['PD-L1'], hospital: '吉安市中心人民医院', doctor: '龚诊', signAt: '2026-09-05 14:22', source: '病理科系统', qcState: '已修正' },
    { id: 'BL-20260918-0055', patientId: 'P-102415', patientName: '罗涛', histo: '8140/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 12, vascular: '无', neural: '无', ihc: '未做', markers: ['EGFR'], hospital: '新余市人民医院', doctor: '毛片', signAt: '2026-09-18 09:38', source: '病理科系统', qcState: '已归档' },
    { id: 'BL-20261005-0052', patientId: 'P-102419', patientName: '高峰', histo: '8070/3', diff: '低分化', margin: '阴性', surgery: '根治性切除', lnp: 1, lnt: 16, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['KRAS'], hospital: '南昌大学第二附属医院', doctor: '邱理', signAt: '2026-10-05 16:02', source: '病理科系统', qcState: '已归档' },
    { id: 'BL-20261025-0079', patientId: 'P-102423', patientName: '唐磊', histo: '8140/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 18, vascular: '无', neural: '无', ihc: '已做-阴性', markers: ['EGFR', 'KRAS'], hospital: '上饶市人民医院', doctor: '唐诊', signAt: '2026-10-25 11:20', source: '病理科系统', qcState: '已归档' }
  ];

  /* ==================== 种子附件（每条报告 1~3 个链接，含失效/重复样本） ==================== */
  function seedAttachments(reports) {
    var out = [], seq = 1;
    reports.forEach(function (r, i) {
      var base = 'https://path.jx-cancer.cn/reports/' + r.id.toLowerCase();
      /* 报告原文：绝大多数有，个别缺失 */
      if (i % 7 !== 3) out.push(mkAtt(seq++, r.id, 'report', base + '.pdf', i % 9 === 5 ? '失效' : '有效'));
      /* 显微图像：约 3/4 有 */
      if (i % 4 !== 2) out.push(mkAtt(seq++, r.id, 'micro', base + '/micro.jpg', i % 11 === 7 ? '失效' : '有效'));
      /* 染色图谱：约一半有 */
      if (i % 2 === 0) out.push(mkAtt(seq++, r.id, 'stain', base + '/ihc.png', '有效'));
    });
    /* 重复链接样本（同一报告同一类型两条） */
    out.push(mkAtt(seq++, reports[0].id, 'micro', 'https://path.jx-cancer.cn/reports/' + reports[0].id.toLowerCase() + '/micro.jpg', '有效'));
    /* 无效链接样本（格式错误） */
    out.push(mkAtt(seq++, reports[1].id, 'report', 'not-a-valid-url', '失效'));
    return out;
  }
  function mkAtt(n, reportId, type, url, status) {
    return { id: 'ATT-' + String(n).padStart(3, '0'), reportId: reportId, type: type,
             url: url, status: status || '有效', linkedAt: addDays(today(), -Math.floor(rnd01(reportId + type + n) * 30)) + ' 10:00',
             checkedAt: status === '失效' ? today() + ' 08:00' : '', operator: '系统' };
  }
  function validateUrl(u) {
    u = String(u || '').trim();
    if (!u) return { ok: false, reason: 'URL 为空' };
    if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(u)) return { ok: false, reason: 'URL 格式不合法（应为 http(s):// 开头）' };
    if (/\.(pdf|html?|jpg|jpeg|png|gif|tif|tiff|svs)(\?|$)/i.test(u) === false) return { ok: false, reason: '链接未指向 PDF/HTML/图像文件' };
    /* 原型阶段用确定性规则模拟可访问性：带 /404/ 或含 expired 视为失效 */
    if (/\/404\/|expired|invalid/i.test(u)) return { ok: false, reason: '远端返回 404 / 链接已过期' };
    return { ok: true, reason: '' };
  }

  /* ==================== 种子规则 ==================== */
  var seedRules = [
    { id: 'PQR-01', name: '病理核心字段强制填报', type: '强制填报', fields: ['histo', 'diff', 'margin', 'lnp', 'hospital', 'doctor', 'signAt'], cond: '组织学类型、分化程度、切缘状态、淋巴结转移数、报告医院、报告医师、签发时间不得为空', severity: '强拦截', enabled: true, creator: '系统预置', createdAt: '2026-01-10', updatedAt: '2026-02-01', desc: '定义必须填写的病理字段清单，缺失即拦截并生成异常。' },
    { id: 'PQR-02', name: 'WHO 组织学类型编码规范', type: '逻辑校验', cond: '组织学类型必须为 WHO ICD-O-3 标准术语或 8000–9999 编码，行为码 /3', severity: '强拦截', enabled: true, creator: '系统预置', createdAt: '2026-01-10', updatedAt: '2026-03-15', desc: '识别非标准术语与无效编码，给出建议值。' },
    { id: 'PQR-03', name: '切缘状态与手术方式一致性', type: '逻辑校验', cond: '根治性/扩大根治切除不应切缘阳性；活检/未手术不应判定切缘阴性', severity: '提示', enabled: true, creator: '病理质控中心 · 张质控', createdAt: '2026-03-01', updatedAt: '2026-03-01', desc: '检查切缘状态与手术记录中切除范围的匹配性。' },
    { id: 'PQR-04', name: '淋巴结转移与总数逻辑', type: '逻辑校验', cond: '淋巴结转移数 > 0 时必须填写淋巴结总数；转移数不得大于总数', severity: '强拦截', enabled: true, creator: '病理质控中心 · 张质控', createdAt: '2026-03-01', updatedAt: '2026-03-01', desc: '基于字段间逻辑关系的校验规则。' },
    { id: 'PQR-05', name: '患者姓名脱敏策略', type: '脱敏规则', maskMode: '掩码', fields: ['patientName', 'patientId'], cond: '对患者姓名、患者ID应用脱敏策略后用于展示与导出', severity: '记录', enabled: true, creator: '系统管理员', createdAt: '2026-04-12', updatedAt: '2026-04-12', desc: '支持掩码 / 哈希 / 替换三种策略。' },
    { id: 'PQR-06', name: '数据完整性合格阈值', type: '完整性阈值', threshold: 80, cond: '至少 80% 核心字段填写才视为有效病例', severity: '提示', enabled: true, creator: '系统管理员', createdAt: '2026-04-12', updatedAt: '2026-04-12', desc: '完整性低于阈值的病例输出预警。' },
    { id: 'PQR-07', name: '分子标志物完备性提示', type: '逻辑校验', cond: '腺癌/非小细胞肺癌病例建议填写 EGFR/ALK/ROS1 等分子标志物', severity: '记录', enabled: true, creator: '病理质控中心 · 张质控', createdAt: '2026-05-20', updatedAt: '2026-05-20', desc: '高误报时可临时停用。' }
  ];

  /* ==================== 质量评分 ==================== */
  /* 必填完整性 40（7 字段）+ 编码规范性 25（WHO 组织学）+ 逻辑一致性 35（切缘/手术、淋巴结论、分子标志物） */
  var CORE_FIELDS = [
    ['histo', '肿瘤组织学类型'], ['diff', '分化程度'], ['margin', '切缘状态'],
    ['lnp', '淋巴结转移数量'], ['hospital', '报告医院'], ['doctor', '报告医师'], ['signAt', '签发时间']
  ];
  function completeness(r) {
    var filled = CORE_FIELDS.filter(function (f) { return r[f[0]] != null && String(r[f[0]]).trim() !== ''; }).length;
    return { filled: filled, total: CORE_FIELDS.length, pct: Math.round(filled / CORE_FIELDS.length * 1000) / 10,
             miss: CORE_FIELDS.filter(function (f) { return r[f[0]] == null || String(r[f[0]]).trim() === ''; }).map(function (f) { return f[1]; }) };
  }
  function scoreOf(r) {
    var items = [];
    var comp = completeness(r);
    items.push({ name: '必填项完整性', got: Math.round(comp.filled / comp.total * 40), full: 40,
                 fail: comp.miss.map(function (x) { return x + '缺失'; }),
                 note: comp.filled + '/' + comp.total + ' 字段（' + comp.pct + '%）' });

    var hv = validateHisto(r.histo);
    items.push({ name: '编码规范性', got: hv.ok ? 25 : 0, full: 25,
                 fail: hv.ok ? [] : [hv.reason], note: hv.ok ? ('WHO 标准：' + (hv.name || hv.code)) : ('建议 ' + hv.suggest) });

    var logicFail = [];
    var ml = validateMarginLogic(r);
    if (!ml.ok) logicFail.push(ml.reason);
    if (r.lnp != null && Number(r.lnp) > 0 && (r.lnt == null || r.lnt === '')) logicFail.push('淋巴结转移数 > 0 但未填淋巴结总数');
    if (r.lnp != null && r.lnt != null && Number(r.lnp) > Number(r.lnt)) logicFail.push('淋巴结转移数（' + r.lnp + '）大于淋巴结总数（' + r.lnt + '）');
    if ((!r.markers || !r.markers.length)) logicFail.push('分子标志物缺失（建议补录系统未同步的检测结果）');
    items.push({ name: '逻辑一致性', got: Math.max(0, 35 - logicFail.length * 9), full: 35, fail: logicFail, note: '' });

    var total = items.reduce(function (s, x) { return s + x.got; }, 0);
    return { total: total, items: items, completeness: comp };
  }

  /* ==================== 规则执行引擎 ==================== */
  function ruleHit(rule, rep) {
    var hits = [];
    if (!rule.enabled) return hits;
    function push(field, value, detail, suggest) { hits.push({ field: field, value: value, detail: detail, suggest: suggest || '' }); }
    if (rule.type === '强制填报') {
      var fs = rule.fields || CORE_FIELDS.map(function (f) { return f[0]; });
      var names = {}; CORE_FIELDS.forEach(function (f) { names[f[0]] = f[1]; });
      fs.forEach(function (k) {
        if (rep[k] == null || String(rep[k]).trim() === '') push(k, '', '强制填报字段「' + (names[k] || k) + '」为空', '');
      });
    } else if (rule.tpl === 'who_histo' || /WHO|组织学/.test(rule.name)) {
      var hv = validateHisto(rep.histo);
      if (!hv.ok) push('histo', rep.histo || '', hv.reason, hv.suggest);
    } else if (rule.tpl === 'margin_logic' || /切缘/.test(rule.name)) {
      var ml = validateMarginLogic(rep);
      if (!ml.ok) push('margin', rep.margin, ml.reason, ml.suggest);
    } else if (rule.tpl === 'ln_logic' || /淋巴结/.test(rule.name)) {
      if (rep.lnp != null && Number(rep.lnp) > 0 && (rep.lnt == null || rep.lnt === '')) push('lnt', '', '淋巴结转移数 > 0 但淋巴结总数为空', '补录淋巴结总数');
      if (rep.lnp != null && rep.lnt != null && Number(rep.lnp) > Number(rep.lnt)) push('lnp', rep.lnp + ' / ' + rep.lnt, '转移数大于总数，数据矛盾', '核对病理报告');
    } else if (rule.tpl === 'markers' || /分子标志物/.test(rule.name)) {
      if (!rep.markers || !rep.markers.length) push('markers', '', '分子标志物检测结果缺失', '补录 EGFR / ALK / ROS1 等');
    } else if (rule.type === '完整性阈值') {
      var c = completeness(rep);
      var th = Number(rule.threshold || effectiveThreshold());
      if (c.pct < th) push('completeness', c.pct + '%', '字段填写率 ' + c.pct + '% 低于合格阈值 ' + th + '%', '补齐缺失字段');
    }
    return hits;
  }
  function runRules(reportsIn) {
    var reps = reportsIn || reportsArr();
    var rules = rulesArr(), probs = problemsArr();
    var byKey = {}; probs.forEach(function (p) { byKey[p.ruleId + '|' + p.reportId + '|' + p.field] = p; });
    var hitKeys = {}, created = 0, closed = 0, seq = probs.length + 1;
    reps.forEach(function (rep) {
      rules.forEach(function (rule) {
        ruleHit(rule, rep).forEach(function (h) {
          var key = rule.id + '|' + rep.id + '|' + h.field;
          hitKeys[key] = 1;
          var old = byKey[key];
          if (old) { if (old.status === '待修复') { old.detail = h.detail; old.suggest = h.suggest; old.value = h.value; old.foundAt = now(); } return; }
          probs.push({ id: 'PQP-' + String(seq++).padStart(3, '0'), ruleId: rule.id, reportId: rep.id, field: h.field,
                       value: h.value, detail: h.detail, suggest: h.suggest, status: '待修复', foundAt: now(),
                       fixer: '', fixAt: '', fixContent: '' });
          created++;
        });
      });
    });
    probs.forEach(function (p) {
      if (p.status !== '待修复') return;
      var key = p.ruleId + '|' + p.reportId + '|' + p.field;
      if (!hitKeys[key]) { p.status = '已修复'; p.fixer = '系统（数据更新）'; p.fixAt = now(); p.fixContent = '病理信息已更新，异常自动关闭'; closed++; }
    });
    setProblems(probs);
    return { created: created, closed: closed, total: probs.filter(function (p) { return p.status === '待修复'; }).length };
  }

  /* ==================== 存储读写 ==================== */
  var MEM = { reports: null, attachments: null, rules: null, problems: null, logs: null };
  function metaOk() { var m = lsGet(K.meta, null); return !!(m && m.schema === SCHEMA); }
  function resetAll() {
    MEM.reports = null; MEM.attachments = null; MEM.rules = null; MEM.problems = null; MEM.logs = null;
    try { Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); }); } catch (e) {}
  }
  function seedAll() {
    var reps = seedReports.map(mkReport);
    reps.forEach(function (r) { r.score = scoreOf(r).total; });
    var atts = seedAttachments(reps);
    var rules = clone(seedRules);
    var problems = [
      { id: 'PQP-F01', ruleId: 'PQR-02', reportId: 'BL-20260825-0011', field: 'histo', value: '腺癌,非特指',
        detail: '「腺癌,非特指」为非标准术语', suggest: '8140/3', status: '已修复', foundAt: '2026-09-01 10:12',
        fixer: '陈质控', fixAt: '2026-09-02 09:40', fixContent: '按 WHO 标准改为 8140/3 腺癌' },
      { id: 'PQP-F02', ruleId: 'PQR-01', reportId: 'BL-20260816-0008', field: 'diff', value: '',
        detail: '强制填报字段「分化程度」为空', suggest: '', status: '已修复', foundAt: '2026-08-18 14:02',
        fixer: ACTOR, fixAt: '2026-08-19 11:20', fixContent: '补录分化程度：中分化' }
    ];
    var logs = [];
    reps.forEach(function (r) { logs.push({ at: r.signAt, reportId: r.id, patientId: r.patientId, actor: '系统', action: '接收病理核心诊断信息', note: '来源：' + r.source }); });
    logs.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    setReports(reps); setAttachments(atts); setRules(rules); setProblems(problems); setLogs(logs);
    try { localStorage.setItem(K.meta, JSON.stringify({ schema: SCHEMA, seededAt: now() })); } catch (e) {}
    MEM.reports = reps; MEM.attachments = atts; MEM.rules = rules; MEM.problems = problems; MEM.logs = logs;
    runRules(reps);
  }
  function boot() {
    if (!metaOk()) { resetAll(); seedAll(); return; }
    MEM.reports = lsGet(K.reports, null); MEM.attachments = lsGet(K.attachments, null);
    MEM.rules = lsGet(K.rules, null); MEM.problems = lsGet(K.problems, null); MEM.logs = lsGet(K.logs, null);
    if (!MEM.reports || !MEM.rules || !MEM.problems || !MEM.logs || !MEM.attachments) { resetAll(); seedAll(); return; }
    MEM.reports.forEach(function (r) { r.score = scoreOf(r).total; }); saveReports();
  }
  boot();
  function reportsArr() { return MEM.reports || (MEM.reports = lsGet(K.reports, [])); }
  function attachmentsArr() { return MEM.attachments || (MEM.attachments = lsGet(K.attachments, [])); }
  function rulesArr() { return MEM.rules || (MEM.rules = lsGet(K.rules, [])); }
  function problemsArr() { return MEM.problems || (MEM.problems = lsGet(K.problems, [])); }
  function logsArr() { return MEM.logs || (MEM.logs = lsGet(K.logs, [])); }
  function setReports(v) { MEM.reports = v; lsSet(K.reports, v); }
  function setAttachments(v) { MEM.attachments = v; lsSet(K.attachments, v); }
  function setRules(v) { MEM.rules = v; lsSet(K.rules, v); }
  function setProblems(v) { MEM.problems = v; lsSet(K.problems, v); }
  function setLogs(v) { MEM.logs = v; lsSet(K.logs, v); }
  function saveReports() { lsSet(K.reports, reportsArr()); }
  function saveAttachments() { lsSet(K.attachments, attachmentsArr()); }
  function saveRules() { lsSet(K.rules, rulesArr()); }
  function saveProblems() { lsSet(K.problems, problemsArr()); }
  function saveLogs() { lsSet(K.logs, logsArr()); }
  function addLog(reportId, action, note, extra) {
    var rep = reportId ? reportById(reportId) : null;
    var l = { at: now(), reportId: reportId || '', patientId: rep ? rep.patientId : (extra && extra.patientId) || '',
              actor: ACTOR, action: action, note: note || '' };
    logsArr().unshift(l); saveLogs();
  }
  function reportById(id) { return reportsArr().filter(function (r) { return r.id === id; })[0] || null; }

  /* ==================== 病理核心信息操作 ==================== */
  /* 接收病理核心诊断信息（模拟病理系统 / EMR 批次入库） */
  function receiveBatch(source, count) {
    count = Math.max(1, Math.min(10, count || 3));
    var reps = reportsArr(), maxNo = 0;
    reps.forEach(function (r) { var n = parseInt(String(r.id).slice(-4), 10); if (n > maxNo) maxNo = n; });
    var pool = [
      { histo: '8140/3', diff: '中分化', margin: '阴性', surgery: '根治性切除', lnp: 0, lnt: 14, hospital: '江西省肿瘤医院', doctor: '李病理', markers: ['EGFR'] },
      { histo: '8500/3', diff: '高分化', margin: '阴性', surgery: '扩大根治切除', lnp: 1, lnt: 18, hospital: '南昌大学第二附属医院', doctor: '陈镜', markers: ['HER2'] },
      { histo: '8070/3', diff: '低分化', margin: '阴性', surgery: '根治性切除', lnp: 3, lnt: 20, hospital: '九江市第一人民医院', doctor: '周组织', markers: [] }
    ];
    var created = [];
    for (var i = 0; i < count; i++) {
      var p = pool[(maxNo + i) % pool.length];
      var d = addDays(today(), -Math.floor(rnd01(source + maxNo + i) * 25));
      var id = 'BL-' + d.replace(/-/g, '') + '-' + String(maxNo + i + 1).padStart(4, '0');
      var rep = mkReport({
        id: id, patientId: 'P-' + (102500 + maxNo + i + 1), patientName: '新接收病例' + (maxNo + i + 1),
        histo: p.histo, diff: p.diff, margin: p.margin, surgery: p.surgery, lnp: p.lnp, lnt: p.lnt,
        vascular: '无', neural: '无', ihc: '未做', markers: p.markers.slice(),
        hospital: p.hospital, doctor: p.doctor, signAt: d + ' 10:00', source: source
      });
      rep.score = scoreOf(rep).total;
      reps.push(rep); created.push(rep);
    }
    setReports(reps);
    created.forEach(function (r) { addLog(r.id, '接收病理核心诊断信息', '来源：' + source); });
    runRules(reps);
    return created;
  }
  /* 补录缺失的分子标志物 → 版本号 +1 + 留痕 */
  function supplementMarkers(id, markers, note) {
    var r = reportById(id); if (!r) return false;
    var arr = String(markers || '').split(/[,，、;；\s]+/).filter(Boolean);
    var before = (r.markers || []).slice();
    arr.forEach(function (m) { if (r.markers.indexOf(m) < 0) r.markers.push(m); });
    r.ver += 1;
    r.verLog.unshift({ at: now(), who: ACTOR, what: '补录分子标志物（' + (before.join('/') || '空') + ' → ' + r.markers.join('/') + '），版本升为 v' + r.ver });
    r.score = scoreOf(r).total; saveReports();
    addLog(id, '补录分子标志物', (note || '') + '；' + arr.join('、'));
    runRules(reportsArr());
    return true;
  }
  /* 修正字段 → 版本号 +1 */
  function fixField(id, field, value) {
    var r = reportById(id); if (!r) return false;
    var old = r[field] == null ? '' : r[field];
    r[field] = value; r.ver += 1;
    r.verLog.unshift({ at: now(), who: ACTOR, what: '修正字段「' + field + '」（' + (old || '空') + ' → ' + (value || '空') + '），版本升为 v' + r.ver });
    r.score = scoreOf(r).total; saveReports();
    addLog(id, '修正病理核心信息', field + '：' + (old || '空') + ' → ' + (value || '空'));
    runRules(reportsArr());
    return true;
  }
  function runChecks() {
    var reps = reportsArr();
    reps.forEach(function (r) { r.score = scoreOf(r).total; }); saveReports();
    var res = runRules(reps);
    return { reports: reps.length, problems: res.total, created: res.created, closed: res.closed };
  }
  function setState(id, st) {
    var r = reportById(id); if (!r) return { ok: false, msg: '病理报告不存在' };
    var old = r.qcState; r.qcState = st; saveReports();
    addLog(id, '更新质控状态', old + ' → ' + st);
    return { ok: true, msg: '质控状态已更新：' + st };
  }

  /* ==================== 附件操作 ==================== */
  function attachmentsOf(reportId) {
    return reportId ? attachmentsArr().filter(function (a) { return a.reportId === reportId; }) : attachmentsArr().slice();
  }
  function addAttachment(reportId, type, url) {
    var v = validateUrl(url);
    var atts = attachmentsArr(), maxNo = 0;
    atts.forEach(function (a) { var n = parseInt(String(a.id).replace('ATT-', ''), 10); if (n > maxNo) maxNo = n; });
    var a = mkAtt(maxNo + 1, reportId, type, url, v.ok ? '有效' : '失效');
    a.operator = ACTOR; a.linkedAt = now(); a.checkedAt = now();
    atts.push(a); setAttachments(atts);
    addLog(reportId, '关联附件URL', ATT_TYPES.filter(function (t) { return t.id === type; })[0].name + '：' + url + (v.ok ? '' : '（' + v.reason + '）'));
    return { ok: v.ok, msg: v.ok ? '附件已关联' : ('已关联但校验未通过：' + v.reason), att: a };
  }
  function checkUrls() {
    var atts = attachmentsArr(), bad = 0, ok = 0;
    atts.forEach(function (a) {
      var v = validateUrl(a.url);
      a.status = v.ok ? '有效' : '失效'; a.checkedAt = now(); a.checkReason = v.reason;
      if (v.ok) ok++; else bad++;
    });
    saveAttachments();
    addLog('', '校验附件URL有效性', '有效 ' + ok + ' 条 / 失效 ' + bad + ' 条');
    return { total: atts.length, ok: ok, bad: bad };
  }
  function missingAttachments() {
    var out = [];
    reportsArr().forEach(function (r) {
      var own = attachmentsOf(r.id);
      var miss = ATT_TYPES.filter(function (t) { return !own.some(function (a) { return a.type === t.id && a.status === '有效'; }); });
      if (miss.length) out.push({ reportId: r.id, patientId: r.patientId, patientName: r.patientName, missing: miss.map(function (t) { return t.name; }), badCount: own.filter(function (a) { return a.status === '失效'; }).length });
    });
    return out;
  }
  function deleteAttachment(attId, reason) {
    var atts = attachmentsArr();
    var a = atts.filter(function (x) { return x.id === attId; })[0];
    if (!a) return { ok: false, msg: '附件不存在' };
    var idx = atts.indexOf(a); atts.splice(idx, 1); setAttachments(atts);
    addLog(a.reportId, '删除附件链接', a.id + ' · ' + a.url + '（' + (reason || '无效或重复') + '）');
    return { ok: true, msg: '附件链接已删除' };
  }
  /* 重复检测：同报告同类型同 URL */
  function duplicateAttachments() {
    var seen = {}, out = [];
    attachmentsArr().forEach(function (a) {
      var k = a.reportId + '|' + a.type + '|' + a.url;
      if (seen[k]) out.push(a); else seen[k] = 1;
    });
    return out;
  }

  /* ==================== 规则配置操作 ==================== */
  function saveRule(rule) {
    var rules = rulesArr();
    if (rule.id) {
      var old = rules.filter(function (r) { return r.id === rule.id; })[0];
      if (!old) return { ok: false, msg: '规则不存在' };
      Object.keys(rule).forEach(function (k) { old[k] = rule[k]; });
      old.updatedAt = today();
    } else {
      var maxNo = 0;
      rules.forEach(function (r) { var n = parseInt(String(r.id).replace('PQR-', ''), 10); if (n > maxNo) maxNo = n; });
      rule.id = 'PQR-' + String(maxNo + 1).padStart(2, '0');
      rule.creator = ACTOR; rule.createdAt = today(); rule.updatedAt = today();
      rules.push(rule);
    }
    setRules(rules);
    addLog('', '配置质控规则', (rule.id || '') + ' ' + (rule.name || ''));
    return { ok: true, msg: '规则已保存' };
  }
  function toggleRule(id) {
    var r = rulesArr().filter(function (x) { return x.id === id; })[0];
    if (!r) return false;
    r.enabled = !r.enabled; r.updatedAt = today(); saveRules();
    addLog('', (r.enabled ? '启用' : '禁用') + '质控规则', id + ' · ' + r.name);
    return r.enabled;
  }
  function deleteRule(id) {
    var rules = rulesArr(), idx = rules.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return false;
    rules.splice(idx, 1); setRules(rules); return true;
  }
  function ruleById(id) { return rulesArr().filter(function (r) { return r.id === id; })[0] || null; }
  function problemsOf(ruleId) { return problemsArr().filter(function (p) { return !ruleId || p.ruleId === ruleId; }); }
  function ruleStats(ruleId) {
    var ps = problemsArr().filter(function (p) { return p.ruleId === ruleId; });
    var open = ps.filter(function (p) { return p.status === '待修复'; }).length;
    var fixed = ps.filter(function (p) { return p.status === '已修复'; }).length;
    return { hits: ps.length, problems: ps.length, open: open, fixed: fixed, fixRate: ps.length ? Math.round(fixed / ps.length * 1000) / 10 : 0 };
  }
  function fixProblem(pid, fixer, content) {
    var ps = problemsArr(), p = ps.filter(function (x) { return x.id === pid; })[0];
    if (!p) return { ok: false, msg: '异常记录不存在' };
    if (p.status === '已修复') return { ok: false, msg: '该异常已修复' };
    p.status = '已修复'; p.fixer = fixer || ACTOR; p.fixAt = now(); p.fixContent = content || '';
    setProblems(ps);
    addLog(p.reportId, '修复异常', p.id + '：' + (content || ''));
    return { ok: true, msg: '修复完成' };
  }

  /* ==================== 统计 / 导出 ==================== */
  function stats() {
    var reps = reportsArr(), atts = attachmentsArr(), rules = rulesArr(), probs = problemsArr();
    return {
      reports: reps.length, wait: reps.filter(function (r) { return r.qcState === '待质控'; }).length,
      archived: reps.filter(function (r) { return r.qcState === '已归档'; }).length,
      avgScore: reps.length ? Math.round(reps.reduce(function (s, r) { return s + r.score; }, 0) / reps.length * 10) / 10 : 0,
      badHisto: reps.filter(function (r) { return !validateHisto(r.histo).ok; }).length,
      marginConflict: reps.filter(function (r) { return !validateMarginLogic(r).ok; }).length,
      missingMarkers: reps.filter(function (r) { return !r.markers || !r.markers.length; }).length,
      attachments: atts.length, attOk: atts.filter(function (a) { return a.status === '有效'; }).length,
      attBad: atts.filter(function (a) { return a.status === '失效'; }).length,
      attMissing: missingAttachments().length,
      rules: rules.length, rulesOn: rules.filter(function (r) { return r.enabled; }).length,
      openProblems: probs.filter(function (p) { return p.status === '待修复'; }).length,
      threshold: effectiveThreshold(),
      maskMode: effectiveMaskMode()
    };
  }
  function executionLog() {
    return rulesArr().map(function (r) {
      var st = ruleStats(r.id);
      return { id: r.id, name: r.name, type: r.type, enabled: r.enabled, hits: st.hits,
               problems: st.problems, fixed: st.fixed, fixRate: st.fixRate, updatedAt: r.updatedAt };
    });
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function exportCsv(name, headers, rows, useMask) {
    var mode = effectiveMaskMode();
    var out = rows.map(function (r) { return r.map(function (v, i) {
      if (useMask && /患者|姓名|patientName/i.test(headers[i] || '')) return csvCell(maskValue(v, mode));
      return csvCell(v);
    }); }).join('\n');
    download(name + '.csv', '\ufeff' + headers.map(csvCell).join(',') + '\n' + out);
  }
  function exportJson(name, obj) { download(name + '.json', JSON.stringify(obj, null, 2), 'application/json;charset=utf-8'); }

  /* ==================== 对外出口 ==================== */
  window.PQD = {
    SCHEMA: SCHEMA,
    DIFF: DIFF, MARGIN: MARGIN, INVASION: INVASION, SURGERY: SURGERY, IHC: IHC, MARKERS: MARKERS,
    ATT_TYPES: ATT_TYPES, RULE_TYPES: RULE_TYPES, MASK_MODES: MASK_MODES, SEVERITIES: SEVERITIES,
    ACTOR: ACTOR, QC_STATES: QC_STATES, HISTO_STD: HISTO_STD, CORE_FIELDS: CORE_FIELDS,
    reports: reportsArr, reportById: reportById, attachments: attachmentsOf, rules: rulesArr, ruleById: ruleById,
    problems: problemsOf, logs: logsArr, stats: stats, executionLog: executionLog,
    validateHisto: validateHisto, validateMarginLogic: validateMarginLogic, validateUrl: validateUrl,
    scoreOf: scoreOf, completeness: completeness, maskValue: maskValue, effectiveMaskMode: effectiveMaskMode,
    receiveBatch: receiveBatch, supplementMarkers: supplementMarkers, fixField: fixField, runChecks: runChecks, setState: setState,
    addAttachment: addAttachment, checkUrls: checkUrls, missingAttachments: missingAttachments,
    deleteAttachment: deleteAttachment, duplicateAttachments: duplicateAttachments,
    saveRule: saveRule, toggleRule: toggleRule, deleteRule: deleteRule, ruleStats: ruleStats, fixProblem: fixProblem,
    exportCsv: exportCsv, exportJson: exportJson,
    reset: function () { resetAll(); seedAll(); },
    esc: esc, now: now, today: today, addDays: addDays, rnd01: rnd01
  };
})();
