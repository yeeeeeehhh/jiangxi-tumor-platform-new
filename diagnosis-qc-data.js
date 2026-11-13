/* ============================================================================
 * diagnosis-qc-data.js — 确诊病例质控 · 数据层（window.CQD）
 *
 * 覆盖四类数据对象：
 *   1) 确诊病例主数据（含版本号 / 质量评分 / 版本留痕）
 *   2) 确诊审核流程实例（两级审核 / 意见 / 轨迹 / 终止）
 *   3) 质控规则与修复跟踪（规则配置 + 执行引擎 + 异常修复 + 重新审核标记）
 *   4) 病例生命周期（处理状态 / 归档 / 逻辑删除 / 整改 / 全局日志）
 *
 * 纯前端原型：localStorage 持久化（jx.cq.*.v1），schema 版本不符整组重播种。
 * ICD 校验基于 modules.js 的全局字典 dictAnatomyData / dictPathologyData。
 * ========================================================================== */
(function () {
  'use strict';

  /* ==================== 工具 ==================== */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
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
    meta: 'jx.cq.meta.v1',
    cases: 'jx.cq.cases.v1',
    rules: 'jx.cq.rules.v1',
    problems: 'jx.cq.problems.v1',
    logs: 'jx.cq.logs.v1'
  };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式等场景静默降级为内存态 */ } }

  /* ==================== 枚举 ==================== */
  var SOURCES = ['HIS', '电子病历', '登记系统', '手工录入'];
  var FOLLOW = ['在访(存活)', '失访', '死亡', '移居迁出', '未知'];
  var QC_STATES = ['待质控', '质控中', '已修正', '已归档', '已删除'];
  var AUDIT_STATES = ['未启动', '待初审', '待复审', '已退回', '已通过', '已终止'];
  var REVIEW_LEVELS = ['初审', '复审'];
  var REVIEW_ROLES = { '初审': '登记站初审员', '复审': '质控中心复审员' };
  var REVIEWERS = { '初审': ['王丽娟', '陈晓东', '刘敏'], '复审': ['张质控', '李克明'] };
  var RULE_TYPES = ['必填完整', '编码规范', '日期逻辑', '随访一致', '自定义'];
  var RULE_TPLS = [
    { id: 'required', name: '必填字段完整性', hint: '按字段清单逐个检查是否为空' },
    { id: 'icd10_valid', name: 'ICD-10 部位编码有效性', hint: '格式 + C00–C97 范围校验' },
    { id: 'icdo3_valid', name: 'ICD-O-3 形态学编码有效性', hint: '四位数字 8000–9999 校验' },
    { id: 'date_order', name: '日期先后逻辑', hint: '死亡日期不得早于诊断日期' },
    { id: 'age_consistent', name: '年龄与出生日期一致性', hint: '按诊断日期推算年龄，误差不超过 1 岁' },
    { id: 'followup_consistent', name: '随访状态与死亡信息一致性', hint: '死亡必须有死亡日期，有死亡日期必须为死亡状态' }
  ];
  var SEVERITIES = ['强拦截', '提示', '记录'];
  var ACTOR = '质控管理员（演示账号）';

  /* ==================== ICD 建议值映射 ==================== */
  var SITE_FIX = {
    '肺': 'C34.9', '支气管和肺': 'C34.9', '肺上叶': 'C34.1', '乳腺': 'C50.9', '乳房': 'C50.9',
    '胃': 'C16.9', '前列腺': 'C61', '肝': 'C22.9', '肝脏': 'C22.9', '宫颈': 'C53.9',
    '食管': 'C15.9', '结肠': 'C18.9', '直肠': 'C20', '鼻咽': 'C11.9', '甲状腺': 'C73',
    '膀胱': 'C67.9', '胰腺': 'C25.9', '子宫': 'C55', '卵巢': 'C56', '肾': 'C64.9'
  };
  var MORPH_FIX = {
    '腺癌': '8140/3', '鳞状细胞癌': '8070/3', '浸润性导管癌': '8500/3', '导管癌': '8500/3',
    '小细胞癌': '8041/3', '肿瘤，未特指': '8000/3', '乳头状癌': '8260/3', '移行细胞癌': '8120/3',
    '透明细胞癌': '8310/3', '肝细胞癌': '8170/3'
  };

  /* ICD-10：C00–C97 恶性肿瘤范围；ICD-O-3：8000–9999 四位数字（允许 /3 行为码后缀） */
  function validateIcd10(code, siteName) {
    code = String(code == null ? '' : code).trim().toUpperCase();
    if (!code) return { ok: false, reason: 'ICD-10 部位编码缺失', suggest: SITE_FIX[siteName] || 'C80' };
    var m = /^([A-Z])(\d{2})(?:\.(\d))?$/.exec(code);
    if (!m) return { ok: false, reason: '编码格式不符合 ICD-10 规范（应形如 C34.9）', suggest: SITE_FIX[siteName] || 'C80' };
    if (m[1] !== 'C' || Number(m[2]) > 97) {
      return { ok: false, reason: '编码超出恶性肿瘤范围（C00–C97）', suggest: SITE_FIX[siteName] || 'C80' };
    }
    return { ok: true, reason: '', suggest: '' };
  }
  function validateIcdO3(code, pathName) {
    code = String(code == null ? '' : code).trim();
    if (!code) return { ok: false, reason: 'ICD-O-3 形态学编码缺失', suggest: MORPH_FIX[pathName] || '8000/3' };
    var m = /^(\d{4})(?:\/\d)?$/.exec(code);
    if (!m) return { ok: false, reason: '编码格式不符合 ICD-O-3 规范（应为 4 位形态学代码，可带 /3 行为码）', suggest: MORPH_FIX[pathName] || '8000/3' };
    var n = Number(m[1]);
    if (n < 8000 || n > 9999) return { ok: false, reason: '形态学代码超出 8000–9999 范围', suggest: MORPH_FIX[pathName] || '8000/3' };
    return { ok: true, reason: '', suggest: '' };
  }

  /* ==================== 种子病例（24 条，覆盖各状态与各脏数据类型） ==================== */
  /* 字段：id 主数据ID / patientId 患者ID / name 姓名 / sex / birthDate / age / diagDate /
     siteName 部位 / pathName 病理 / icd10 / icdO3 / deathDate / followStatus /
     source 来源 / orgName 机构 / qcState 处理状态 / ver 版本 / audit 审核 / reaudit 待重新审核 */
  /* 审核态补充：层级 / 审核人 / 时限。
     在途审核的截止时间按「今天」前后分布（一半未超时、一半已超时），
     否则种子用诊断日期推算会随着自然时间推移全部变成超时，演示失真。 */
  function auditDeadlineOf(key) {
    return addDays(today(), (seedOf(key) % 2 === 0 ? 5 : -3));
  }
  function mkCase(r) {
    var c = {
      id: r.id, patientId: r.patientId, name: r.name, sex: r.sex,
      birthDate: r.birthDate, age: r.age, diagDate: r.diagDate,
      siteName: r.siteName, pathName: r.pathName, icd10: r.icd10, icdO3: r.icdO3,
      deathDate: r.deathDate || '', followStatus: r.followStatus == null ? '' : r.followStatus,
      source: r.source, orgName: r.orgName, qcState: r.qcState || '待质控',
      ver: r.ver || 1, score: null, reaudit: !!r.reaudit, rectify: r.rectify || null,
      verLog: [{ at: r.diagDate + ' 09:00', who: '系统', what: '主数据接收（v1）' }],
      lifecycle: [{ at: r.diagDate + ' 09:00', actor: '系统', action: '接收主数据', note: '来源：' + r.source }],
      audit: {
        state: r.auditState || '未启动', level: '', role: '', assignee: '', assignAt: '', deadline: '',
        opinions: [], terminateReason: ''
      }
    };
    /* 审核态补充：层级 / 审核人 / 时限（相对诊断日期 +2 天分配、+7 天截止） */
    var st = c.audit.state;
    if (st === '待初审' || st === '待复审') {
      var lv = st === '待复审' ? '复审' : '初审';
      c.audit.level = lv;
      c.audit.role = REVIEW_ROLES[lv];
      c.audit.assignee = REVIEWERS[lv][seedOf(r.id) % REVIEWERS[lv].length];
      c.audit.assignAt = addDays(r.diagDate, 2) + ' 10:00';
      c.audit.deadline = auditDeadlineOf(r.id);
    } else if (st === '已退回' || st === '已通过' || st === '已终止') {
      c.audit.level = '初审';
      c.audit.role = REVIEW_ROLES['初审'];
      c.audit.assignee = REVIEWERS['初审'][seedOf(r.id) % REVIEWERS['初审'].length];
      c.audit.assignAt = addDays(r.diagDate, 2) + ' 10:00';
      c.audit.deadline = addDays(r.diagDate, 9);
    }
    if (st === '已退回') {
      c.audit.opinions = [
        { level: '初审', role: '登记站初审员', actor: c.audit.assignee, at: addDays(r.diagDate, 4) + ' 15:20', result: '退回', opinion: '主数据编码与病理诊断不一致，请核对后重新提交。' }
      ];
    } else if (st === '已通过') {
      c.audit.opinions = [
        { level: '初审', role: '登记站初审员', actor: c.audit.assignee, at: addDays(r.diagDate, 4) + ' 11:05', result: '通过', opinion: '主数据完整性核对无误。' },
        { level: '复审', role: '质控中心复审员', actor: REVIEWERS['复审'][seedOf(r.id) % REVIEWERS['复审'].length], at: addDays(r.diagDate, 6) + ' 16:40', result: '通过', opinion: '编码规范、逻辑一致，同意归档。' }
      ];
    } else if (st === '已终止') {
      c.audit.terminateReason = '重复病例合并，原审核流程终止';
    }
    if (c.qcState === '已归档') {
      c.lifecycle.push({ at: addDays(r.diagDate, 10) + ' 09:30', actor: ACTOR, action: '归档病例', note: '审核通过且无未闭环问题' });
    } else if (c.qcState === '已删除') {
      c.lifecycle.push({ at: addDays(r.diagDate, 5) + ' 14:10', actor: ACTOR, action: '逻辑删除', note: '测试数据，非真实病例' });
    }
    return c;
  }

  var seedCases = [
    /* 待质控 7 条（其中 014 随访缺失、020 ICD 缺失、021 随访-死亡信息矛盾、010 年龄不一致） */
    { id: 'CQ-001', patientId: 'P-102401', name: '王建国', sex: '男', birthDate: '1958-03-12', age: 68, diagDate: '2026-08-15', siteName: '肺', pathName: '腺癌', icd10: 'C34.9', icdO3: '8140/3', followStatus: '在访(存活)', source: 'HIS', orgName: '南昌市第一人民医院' },
    { id: 'CQ-002', patientId: 'P-102402', name: '李秀英', sex: '女', birthDate: '1971-06-20', age: 55, diagDate: '2026-08-22', siteName: '乳腺', pathName: '浸润性导管癌', icd10: 'C50.9', icdO3: '8500/3', followStatus: '在访(存活)', source: '电子病历', orgName: '南昌大学第二附属医院' },
    { id: 'CQ-007', patientId: 'P-102407', name: '吴强', sex: '男', birthDate: '1967-07-07', age: 59, diagDate: '2026-08-11', siteName: '肝', pathName: '肝细胞癌', icd10: 'C22.9', icdO3: '8170/3', followStatus: '在访(存活)', source: '登记系统', orgName: '萍乡市人民医院' },
    { id: 'CQ-010', patientId: 'P-102410', name: '蒋红', sex: '女', birthDate: '1981-08-08', age: 39, diagDate: '2026-09-20', siteName: '卵巢', pathName: '浆液性癌', icd10: 'C56', icdO3: '8461/3', followStatus: '在访(存活)', source: '手工录入', orgName: '抚州市第一人民医院' },
    { id: 'CQ-012', patientId: 'P-102412', name: '韩雪', sex: '女', birthDate: '1993-04-22', age: 33, diagDate: '2026-10-05', siteName: '骨髓', pathName: '急性髓系白血病', icd10: 'C95.0', icdO3: '9861/3', followStatus: '在访(存活)', source: 'HIS', orgName: '南昌大学第一附属医院' },
    { id: 'CQ-014', patientId: 'P-102414', name: '谢芳', sex: '女', birthDate: '1968-03-09', age: 58, diagDate: '2026-07-22', siteName: '胃', pathName: '腺癌', icd10: 'C16.9', icdO3: '8140/3', followStatus: '', source: '手工录入', orgName: '赣州市肿瘤医院' },
    { id: 'CQ-021', patientId: 'P-102421', name: '何平', sex: '男', birthDate: '1961-08-03', age: 65, diagDate: '2026-07-05', siteName: '直肠', pathName: '腺癌', icd10: 'C20', icdO3: '8140/3', followStatus: '死亡', source: '电子病历', orgName: '吉安市中心人民医院' },
    /* 质控中 6 条（审核在途：待初审 4 / 待复审 2；含 008 形态学无效、013 ICD-10 无效） */
    { id: 'CQ-003', patientId: 'P-102403', name: '陈志强', sex: '男', birthDate: '1964-02-11', age: 62, diagDate: '2026-08-05', siteName: '胃', pathName: '腺癌', icd10: 'C16.9', icdO3: '8140/3', followStatus: '失访', source: '登记系统', orgName: '九江市第一人民医院', qcState: '质控中', auditState: '待初审' },
    { id: 'CQ-004', patientId: 'P-102404', name: '刘桂芳', sex: '女', birthDate: '1979-09-03', age: 47, diagDate: '2026-09-12', siteName: '宫颈', pathName: '鳞状细胞癌', icd10: 'C53.9', icdO3: '8070/3', followStatus: '在访(存活)', source: '手工录入', orgName: '赣州市肿瘤医院', qcState: '质控中', auditState: '待复审' },
    { id: 'CQ-008', patientId: 'P-102408', name: '郑敏', sex: '女', birthDate: '1963-01-15', age: 63, diagDate: '2026-07-18', siteName: '乳腺', pathName: '腺癌', icd10: 'C50.9', icdO3: '7999', followStatus: '失访', source: 'HIS', orgName: '宜春市人民医院', qcState: '质控中', auditState: '待初审' },
    { id: 'CQ-013', patientId: 'P-102413', name: '曹阳', sex: '男', birthDate: '1975-10-10', age: 51, diagDate: '2026-09-08', siteName: '肺', pathName: '腺癌', icd10: 'C99.9', icdO3: '8140/3', followStatus: '在访(存活)', source: '电子病历', orgName: '九江市第一人民医院', qcState: '质控中', auditState: '待初审' },
    { id: 'CQ-017', patientId: 'P-102417', name: '徐勇', sex: '男', birthDate: '1969-09-14', age: 57, diagDate: '2026-08-18', siteName: '鼻咽', pathName: '未分化癌', icd10: 'C11.9', icdO3: '8020/3', followStatus: '在访(存活)', source: '电子病历', orgName: '南昌市第三医院', qcState: '质控中', auditState: '待复审' },
    { id: 'CQ-020', patientId: 'P-102420', name: '秦岚', sex: '女', birthDate: '1986-05-16', age: 40, diagDate: '2026-10-12', siteName: '肺', pathName: '腺癌', icd10: '', icdO3: '8140/3', followStatus: '在访(存活)', source: 'HIS', orgName: '抚州市第一人民医院', qcState: '质控中', auditState: '待初审' },
    /* 已修正 4 条（含 005 日期矛盾已退回、018 已退回、015 已终止、022 修复后待重新审核） */
    { id: 'CQ-005', patientId: 'P-102405', name: '张伟', sex: '男', birthDate: '1955-04-18', age: 71, diagDate: '2026-07-30', siteName: '肺', pathName: '小细胞癌', icd10: 'C34.1', icdO3: '8041/3', deathDate: '2026-10-02', followStatus: '死亡', source: 'HIS', orgName: '南昌市第一人民医院', qcState: '已修正', auditState: '已退回' },
    { id: 'CQ-011', patientId: 'P-102411', name: '沈磊', sex: '男', birthDate: '1960-12-01', age: 66, diagDate: '2026-08-29', siteName: '膀胱', pathName: '移行细胞癌', icd10: 'C67.9', icdO3: '8120/2', followStatus: '在访(存活)', source: '登记系统', orgName: '吉安市中心人民医院', qcState: '已修正', auditState: '已通过' },
    { id: 'CQ-015', patientId: 'P-102415', name: '罗涛', sex: '男', birthDate: '1957-06-15', age: 69, diagDate: '2026-06-10', siteName: '前列腺', pathName: '腺癌', icd10: 'C61', icdO3: '8140/3', deathDate: '2026-05-20', followStatus: '死亡', source: '登记系统', orgName: '新余市人民医院', qcState: '已修正', auditState: '已终止' },
    { id: 'CQ-018', patientId: 'P-102418', name: '宋丽', sex: '女', birthDate: '1965-02-08', age: 61, diagDate: '2026-07-09', siteName: '结肠', pathName: '腺癌', icd10: 'C18.7', icdO3: '8140/3', deathDate: '2026-08-30', followStatus: '死亡', source: '手工录入', orgName: '鹰潭市人民医院', qcState: '已修正', auditState: '已退回' },
    /* 已归档 4 条（审核已通过） */
    { id: 'CQ-006', patientId: 'P-102406', name: '周丽', sex: '女', birthDate: '1988-11-25', age: 38, diagDate: '2026-09-01', siteName: '甲状腺', pathName: '乳头状癌', icd10: 'C73', icdO3: '8260/3', followStatus: '在访(存活)', source: '电子病历', orgName: '江西省肿瘤医院', qcState: '已归档', auditState: '已通过' },
    { id: 'CQ-009', patientId: 'P-102409', name: '冯军', sex: '男', birthDate: '1952-05-30', age: 74, diagDate: '2026-06-28', siteName: '食管', pathName: '鳞状细胞癌', icd10: 'C15.9', icdO3: '8070/3', deathDate: '2026-09-15', followStatus: '死亡', source: '电子病历', orgName: '上饶市人民医院', qcState: '已归档', auditState: '已通过' },
    { id: 'CQ-016', patientId: 'P-102416', name: '黄燕', sex: '女', birthDate: '1982-07-27', age: 44, diagDate: '2026-09-25', siteName: '乳腺', pathName: '导管癌', icd10: 'C50.4', icdO3: '8500/3', followStatus: '在访(存活)', source: 'HIS', orgName: '景德镇市第一人民医院', qcState: '已归档', auditState: '已通过' },
    { id: 'CQ-019', patientId: 'P-102419', name: '高峰', sex: '男', birthDate: '1954-11-20', age: 72, diagDate: '2026-05-30', siteName: '肺', pathName: '鳞状细胞癌', icd10: 'C34.9', icdO3: '8070/3', followStatus: '失访', source: '登记系统', orgName: '南昌大学第二附属医院', qcState: '已归档', auditState: '已通过' },
    /* 已删除 2 条（逻辑删除，保留删除人/时间留痕） */
    { id: 'CQ-023', patientId: 'P-102423', name: '唐磊', sex: '男', birthDate: '1978-12-12', age: 48, diagDate: '2026-08-08', siteName: '胰腺', pathName: '腺癌', icd10: 'C25.9', icdO3: '8140/3', followStatus: '在访(存活)', source: '登记系统', orgName: '上饶市人民医院', qcState: '已删除' },
    { id: 'CQ-024', patientId: 'P-102424', name: '许薇', sex: '女', birthDate: '1974-03-18', age: 52, diagDate: '2026-06-15', siteName: '肾', pathName: '透明细胞癌', icd10: 'C64.9', icdO3: '8310/3', followStatus: '在访(存活)', source: 'HIS', orgName: '萍乡市人民医院', qcState: '已删除' }
  ];

  /* 022 修复后需重新审核样本（修复动作发生在入库之后） */
  var c022 = mkCase({ id: 'CQ-022', patientId: 'P-102422', name: '吕婷', sex: '女', birthDate: '1990-10-24', age: 36, diagDate: '2026-09-30', siteName: '甲状腺', pathName: '乳头状癌', icd10: 'C73', icdO3: '8260/3', followStatus: '在访(存活)', source: '手工录入', orgName: '宜春市人民医院', qcState: '已修正', auditState: '已通过', ver: 2, reaudit: true });
  c022.verLog.push({ at: '2026-10-08 16:20', who: ACTOR, what: '修正 ICD-10（C79.9 → C73），版本升为 v2' });
  c022.lifecycle.push({ at: '2026-10-08 16:20', actor: ACTOR, why: '', action: '修正主数据', note: '修正 ICD-10 编码，标记需重新审核' });

  /* ==================== 种子规则 ==================== */
  var seedRules = [
    { id: 'CQR-01', name: '主数据必填字段完整性', type: '必填完整', scope: '确诊病例主数据', tpl: 'required', cond: '患者ID、性别、年龄、出生日期、诊断日期、ICD-10、ICD-O-3、随访状态不得为空', severity: '强拦截', enabled: true, creator: '系统预置', createdAt: '2026-01-10', updatedAt: '2026-02-01', desc: '对主数据关键字段逐项检查空值，缺失即拦截并生成异常，须补录后方可进入审核。' },
    { id: 'CQR-02', name: '肿瘤部位 ICD-10 编码有效性', type: '编码规范', scope: '确诊病例主数据', tpl: 'icd10_valid', cond: 'ICD-10 编码格式合法且落在 C00–C97 恶性肿瘤范围', severity: '强拦截', enabled: true, creator: '系统预置', createdAt: '2026-01-10', updatedAt: '2026-02-01', desc: '按 ICD-10 规则校验部位编码，非法编码给出建议值，避免错码进入统计口径。' },
    { id: 'CQR-03', name: '形态学 ICD-O-3 编码有效性', type: '编码规范', scope: '确诊病例主数据', tpl: 'icdo3_valid', cond: 'ICD-O-3 形态学代码为 8000–9999 的四位数字', severity: '强拦截', enabled: true, creator: '系统预置', createdAt: '2026-01-10', updatedAt: '2026-03-15', desc: '校验形态学编码范围与格式，支持 /3 行为码后缀。' },
    { id: 'CQR-04', name: '死亡日期与诊断日期逻辑', type: '日期逻辑', scope: '确诊病例主数据', tpl: 'date_order', cond: '死亡日期（若有）不得早于诊断日期', severity: '提示', enabled: true, creator: '质控中心 · 张质控', createdAt: '2026-03-01', updatedAt: '2026-03-01', desc: '日期倒挂通常意味着死亡日期误录或诊断日期错位，需要人工复核。' },
    { id: 'CQR-05', name: '年龄与出生日期一致性', type: '日期逻辑', scope: '确诊病例主数据', tpl: 'age_consistent', cond: '按诊断日期推算年龄，与填写年龄误差不超过 1 岁', severity: '提示', enabled: true, creator: '质控中心 · 张质控', createdAt: '2026-03-01', updatedAt: '2026-03-01', desc: '年龄字段为登记核心口径，与出生日期不一致会直接影响年龄别发病率统计。' },
    { id: 'CQR-06', name: '随访状态与死亡信息一致性', type: '随访一致', scope: '确诊病例主数据', tpl: 'followup_consistent', cond: '随访状态为死亡时必须填写死亡日期；填写死亡日期时必须为死亡状态', severity: '记录', enabled: true, creator: '质控中心 · 张质控', createdAt: '2026-04-12', updatedAt: '2026-04-12', desc: '随访结局与死亡日期必须相互印证，否则生存分析结果失真。' }
  ];

  /* ==================== 质量评分 ==================== */
  /* 完整性 40 分（8 个关键字段 × 5）+ 编码规范 30 分（ICD-10 15 + ICD-O-3 15）+ 逻辑一致 30 分 */
  function scoreOf(c) {
    var items = [];
    var completeFields = [
      ['patientId', '患者ID'], ['sex', '性别'], ['age', '年龄'], ['birthDate', '出生日期'],
      ['diagDate', '诊断日期'], ['icd10', 'ICD-10'], ['icdO3', 'ICD-O-3'], ['followStatus', '随访状态']
    ];
    var miss = completeFields.filter(function (f) { return c[f[0]] == null || String(c[f[0]]).trim() === ''; });
    items.push({ name: '完整性', got: 40 - miss.length * 5, full: 40, fail: miss.map(function (f) { return f[1] + '缺失'; }) });

    var v10 = validateIcd10(c.icd10, c.siteName), v3 = validateIcdO3(c.icdO3, c.pathName);
    var codeGot = (v10.ok ? 15 : 0) + (v3.ok ? 15 : 0);
    items.push({ name: '编码规范性', got: codeGot, full: 30, fail: [v10.ok ? '' : v10.reason, v3.ok ? '' : v3.reason].filter(Boolean) });

    var logicFail = [];
    /* 年龄与出生日期：按诊断年份推算，允许 ±1 岁 */
    if (c.birthDate && c.age != null && c.diagDate) {
      var calc = Number(c.diagDate.slice(0, 4)) - Number(c.birthDate.slice(0, 4));
      if (Math.abs(calc - Number(c.age)) > 1) logicFail.push('年龄与出生日期不符（推算 ' + calc + ' 岁，填写 ' + c.age + ' 岁）');
    }
    /* 死亡日期不得早于诊断日期 */
    if (c.deathDate && c.diagDate && c.deathDate < c.diagDate) logicFail.push('死亡日期早于诊断日期');
    /* 随访状态与死亡日期互证 */
    if (c.followStatus === '死亡' && !c.deathDate) logicFail.push('随访状态为死亡但未填死亡日期');
    if (c.deathDate && c.followStatus && c.followStatus !== '死亡') logicFail.push('已填死亡日期但随访状态非死亡');
    items.push({ name: '逻辑一致性', got: Math.max(0, 30 - logicFail.length * 10), full: 30, fail: logicFail });

    var total = items.reduce(function (s, x) { return s + x.got; }, 0);
    return { total: total, items: items };
  }

  /* ==================== 规则执行引擎 ==================== */
  function ruleHit(r, c) {
    var hits = [];
    if (!r.enabled) return hits;
    function push(field, value, detail, suggest) { hits.push({ field: field, value: value, detail: detail, suggest: suggest || '' }); }
    if (r.tpl === 'required') {
      var fields = [['patientId', '患者ID'], ['sex', '性别'], ['age', '年龄'], ['birthDate', '出生日期'], ['diagDate', '诊断日期'], ['icd10', 'ICD-10'], ['icdO3', 'ICD-O-3'], ['followStatus', '随访状态']];
      fields.forEach(function (f) {
        if (c[f[0]] == null || String(c[f[0]]).trim() === '') push(f[0], '', '必填字段「' + f[1] + '」为空', f[0] === 'icd10' ? (SITE_FIX[c.siteName] || 'C80') : (f[0] === 'icdO3' ? (MORPH_FIX[c.pathName] || '8000/3') : ''));
      });
    } else if (r.tpl === 'icd10_valid') {
      var v10 = validateIcd10(c.icd10, c.siteName);
      if (!v10.ok && c.icd10) push('icd10', c.icd10, v10.reason, v10.suggest);
      else if (!v10.ok && !c.icd10) push('icd10', '', 'ICD-10 部位编码缺失', v10.suggest);
    } else if (r.tpl === 'icdo3_valid') {
      var v3 = validateIcdO3(c.icdO3, c.pathName);
      if (!v3.ok) push('icdO3', c.icdO3 || '', v3.reason, v3.suggest);
    } else if (r.tpl === 'date_order') {
      if (c.deathDate && c.diagDate && c.deathDate < c.diagDate) push('deathDate', c.deathDate, '死亡日期（' + c.deathDate + '）早于诊断日期（' + c.diagDate + '）', '核对死亡日期或诊断日期');
    } else if (r.tpl === 'age_consistent') {
      if (c.birthDate && c.age != null && c.diagDate) {
        var calc = Number(c.diagDate.slice(0, 4)) - Number(c.birthDate.slice(0, 4));
        if (Math.abs(calc - Number(c.age)) > 1) push('age', c.age + ' 岁', '按出生日期与诊断日期推算为 ' + calc + ' 岁，与填写年龄 ' + c.age + ' 岁不一致', String(calc));
      }
    } else if (r.tpl === 'followup_consistent') {
      if (c.followStatus === '死亡' && !c.deathDate) push('followStatus', '死亡', '随访状态为死亡但死亡日期为空', '补录死亡日期');
      if (c.deathDate && c.followStatus && c.followStatus !== '死亡') push('followStatus', c.followStatus, '已填死亡日期（' + c.deathDate + '）但随访状态为「' + c.followStatus + '」', '死亡');
    } else if (r.tpl === 'custom') {
      /* 自定义模板：预留表达式引擎，原型阶段按提示规则不执行 */
    }
    return hits;
  }

  /* 全量执行规则 → 幂等同步异常库：
     · 已修复的异常不重新生成（按 ruleId|caseId|field 键）
     · 待修复但本轮未命中的 → 自动关闭（数据已被修正）
     · 新命中 → 生成异常记录 */
  function runRules(casesIn) {
    var cases = casesIn || casesArr().filter(function (c) { return c.qcState !== '已删除'; });
    var rules = rulesArr();
    var probs = problemsArr();
    var byKey = {};
    probs.forEach(function (p) { byKey[p.ruleId + '|' + p.caseId + '|' + p.field] = p; });
    var hitKeys = {};
    var created = 0, closed = 0;
    var seq = probs.length + 1;
    cases.forEach(function (c) {
      rules.forEach(function (r) {
        ruleHit(r, c).forEach(function (h) {
          var key = r.id + '|' + c.id + '|' + h.field;
          hitKeys[key] = 1;
          var old = byKey[key];
          if (old) {
            if (old.status === '待修复') {
              old.detail = h.detail; old.suggest = h.suggest; old.value = h.value;
            }
            return;
          }
          probs.push({
            id: 'CQP-' + String(seq++).padStart(3, '0'), ruleId: r.id, caseId: c.id, field: h.field, value: h.value,
            detail: h.detail, suggest: h.suggest, status: '待修复', foundAt: now(),
            fixer: '', fixAt: '', fixContent: '', reaudit: false, reauditAt: ''
          });
          created++;
        });
      });
    });
    probs.forEach(function (p) {
      if (p.status !== '待修复') return;
      var key = p.ruleId + '|' + p.caseId + '|' + p.field;
      if (!hitKeys[key]) { p.status = '已修复'; p.fixer = '系统（数据更新）'; p.fixAt = now(); p.fixContent = '主数据已更新，异常自动关闭'; closed++; }
    });
    setProblems(probs);
    return { created: created, closed: closed, total: probs.filter(function (p) { return p.status === '待修复'; }).length };
  }

  /* ==================== 存储读写 ==================== */
  var MEM = { cases: null, rules: null, problems: null, logs: null };

  function metaOk() {
    var m = lsGet(K.meta, null);
    return !!(m && m.schema === SCHEMA);
  }
  function resetAll() {
    MEM.cases = null; MEM.rules = null; MEM.problems = null; MEM.logs = null;
    try { localStorage.removeItem(K.cases); localStorage.removeItem(K.rules); localStorage.removeItem(K.problems); localStorage.removeItem(K.logs); localStorage.removeItem(K.meta); } catch (e) {}
  }
  function seedAll() {
    var cases = seedCases.map(mkCase);
    cases.push(c022);
    var problems = [];
    /* 两条历史已修复样本（挂在已修正病例上，验证修复记录与重新审核标记） */
    problems.push({
      id: 'CQP-F01', ruleId: 'CQR-03', caseId: 'CQ-011', field: 'icdO3', value: '',
      detail: 'ICD-O-3 形态学编码缺失', suggest: '8120/3', status: '已修复', foundAt: '2026-09-02 10:12',
      fixer: '刘敏', fixAt: '2026-09-03 09:40', fixContent: '补录形态学编码 8120/3（移行细胞癌）', reaudit: false, reauditAt: ''
    });
    problems.push({
      id: 'CQP-F02', ruleId: 'CQR-02', caseId: 'CQ-022', field: 'icd10', value: 'C79.9',
      detail: '编码超出恶性肿瘤范围（C00–C97）', suggest: 'C73', status: '已修复', foundAt: '2026-10-08 14:02',
      fixer: ACTOR, fixAt: '2026-10-08 16:20', fixContent: '修正为甲状腺 C73（依据病理报告）', reaudit: true, reauditAt: '2026-10-08 16:20'
    });
    /* 评分回填 */
    cases.forEach(function (c) { c.score = scoreOf(c).total; });
    /* 生命周期日志种子：从各病例留痕汇总（按时间倒序） */
    var logs = [];
    cases.forEach(function (c) {
      c.lifecycle.forEach(function (l) {
        logs.push({ at: l.at, caseId: c.id, patientId: c.patientId, actor: l.actor, action: l.action, note: l.note || '' });
      });
    });
    logs.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    setCases(cases); setRules(seedRules.slice()); setProblems(problems); setLogs(logs);
    try { localStorage.setItem(K.meta, JSON.stringify({ schema: SCHEMA, seededAt: now() })); } catch (e) {}
    MEM.cases = cases; MEM.rules = rulesArr(); MEM.problems = problems; MEM.logs = logs;
    runRules(cases.filter(function (c) { return c.qcState !== '已删除'; }));
  }
  function boot() {
    if (!metaOk()) { resetAll(); seedAll(); return; }
    MEM.cases = lsGet(K.cases, null); MEM.rules = lsGet(K.rules, null);
    MEM.problems = lsGet(K.problems, null); MEM.logs = lsGet(K.logs, null);
    if (!MEM.cases || !MEM.rules || !MEM.problems || !MEM.logs) { resetAll(); seedAll(); return; }
    /* 每次进入同步一次评分（数据可能在上次会话中被修正） */
    MEM.cases.forEach(function (c) { c.score = scoreOf(c).total; });
    saveCases();
  }
  boot();

  function casesArr() { return MEM.cases || (MEM.cases = lsGet(K.cases, [])); }
  function rulesArr() { return MEM.rules || (MEM.rules = lsGet(K.rules, [])); }
  function problemsArr() { return MEM.problems || (MEM.problems = lsGet(K.problems, [])); }
  function logsArr() { return MEM.logs || (MEM.logs = lsGet(K.logs, [])); }
  function setCases(v) { MEM.cases = v; lsSet(K.cases, v); }
  function setRules(v) { MEM.rules = v; lsSet(K.rules, v); }
  function setProblems(v) { MEM.problems = v; lsSet(K.problems, v); }
  function setLogs(v) { MEM.logs = v; lsSet(K.logs, v); }
  function saveCases() { lsSet(K.cases, casesArr()); }
  function saveRules() { lsSet(K.rules, rulesArr()); }
  function saveProblems() { lsSet(K.problems, problemsArr()); }
  function saveLogs() { lsSet(K.logs, logsArr()); }

  /* ==================== 生命周期日志 ==================== */
  function addLog(c, action, note) {
    var logs = logsArr();
    logs.unshift({ at: now(), caseId: c ? c.id : '', patientId: c ? c.patientId : '', actor: ACTOR, action: action, note: note || '' });
    setLogs(logs);
    if (c) {
      c.lifecycle.unshift({ at: now(), actor: ACTOR, action: action, note: note || '' });
      saveCases();
    }
  }

  /* ==================== 病例操作 ==================== */
  function caseById(id) {
    return casesArr().filter(function (c) { return c.id === id; })[0] || null;
  }
  function activeCases() { return casesArr().filter(function (c) { return c.qcState !== '已删除'; }); }

  /* A1 接收主数据：模拟 HIS/EMR 批次入库 */
  function receiveBatch(source, count) {
    count = Math.max(1, Math.min(10, count || 3));
    var cases = casesArr();
    var maxNo = 0;
    cases.forEach(function (c) { var n = parseInt(String(c.id).replace('CQ-', ''), 10); if (n > maxNo) maxNo = n; });
    var pool = [
      { name: '赵玉梅', sex: '女', site: '肺', path: '腺癌', icd10: 'C34.9', icdO3: '8140/3' },
      { name: '孙建华', sex: '男', site: '胃', path: '腺癌', icd10: 'C16.9', icdO3: '8140/3' },
      { name: '马丽华', sex: '女', site: '乳腺', path: '浸润性导管癌', icd10: 'C50.9', icdO3: '8500/3' },
      { name: '朱国庆', sex: '男', site: '直肠', path: '腺癌', icd10: 'C20', icdO3: '8140/3' },
      { name: '胡秀兰', sex: '女', site: '宫颈', path: '鳞状细胞癌', icd10: 'C53.9', icdO3: '8070/3' },
      { name: '郭志刚', sex: '男', site: '肝', path: '肝细胞癌', icd10: 'C22.9', icdO3: '8170/3' }
    ];
    var created = [];
    for (var i = 0; i < count; i++) {
      var p = pool[(maxNo + i) % pool.length];
      var birthY = 1950 + (seedOf(source + maxNo + i) % 40);
      var birth = birthY + '-0' + (1 + seedOf(p.name) % 9) + '-' + (10 + seedOf(p.name + 'd') % 18);
      var d = addDays(today(), -Math.floor(rnd01(p.name + maxNo + i) * 40));
      var c = mkCase({
        id: 'CQ-' + String(maxNo + i + 1).padStart(3, '0'), patientId: 'P-' + (102400 + maxNo + i + 1),
        name: p.name, sex: p.sex, birthDate: birth, age: Number(d.slice(0, 4)) - birthY,
        diagDate: d, siteName: p.site, pathName: p.path, icd10: p.icd10, icdO3: p.icdO3,
        followStatus: '在访(存活)', source: source, orgName: '江西省肿瘤医院', qcState: '待质控'
      });
      c.score = scoreOf(c).total;
      c.lifecycle = [{ at: now(), actor: '系统', action: '接收主数据', note: '来源：' + source + '（批量接收）' }];
      c.verLog = [{ at: now(), who: '系统', what: '主数据接收（v1）' }];
      cases.push(c); created.push(c);
    }
    setCases(cases);
    created.forEach(function (c) { addLog(c, '接收主数据', '来源：' + source); });
    runRules(cases.filter(function (x) { return x.qcState !== '已删除'; }));
    return created;
  }

  /* A2 补充随访状态：补录后版本号 +1，保留版本留痕 */
  function updateFollow(id, status, note) {
    var c = caseById(id);
    if (!c) return false;
    var old = c.followStatus || '（空）';
    c.followStatus = status;
    if (status === '死亡' && !c.deathDate && note) {
      var m = /(\d{4}-\d{2}-\d{2})/.exec(note);
      if (m) c.deathDate = m[1];
    }
    c.ver += 1;
    var at = now();
    c.verLog.unshift({ at: at, who: ACTOR, what: '补充随访状态（' + old + ' → ' + status + '），版本升为 v' + c.ver });
    c.score = scoreOf(c).total;
    addLog(c, '补充随访状态', old + ' → ' + status + (note ? '；' + note : ''));
    saveCases();
    runRules(activeCases());
    return true;
  }

  /* A3/A7 批量校验：重跑规则引擎 + 重算评分 */
  function runChecks() {
    var cases = activeCases();
    cases.forEach(function (c) { c.score = scoreOf(c).total; });
    saveCases();
    var res = runRules(cases);
    return { cases: cases.length, problems: res.total, created: res.created, closed: res.closed };
  }

  /* A8 修正主数据（带版本号自增） */
  function fixCaseField(id, field, value) {
    var c = caseById(id);
    if (!c) return false;
    var old = c[field] == null ? '' : c[field];
    c[field] = value;
    c.ver += 1;
    c.verLog.unshift({ at: now(), who: ACTOR, what: '修正字段「' + field + '」（' + (old || '空') + ' → ' + (value || '空') + '），版本升为 v' + c.ver });
    c.score = scoreOf(c).total;
    saveCases();
    addLog(c, '修正主数据', field + '：' + (old || '空') + ' → ' + (value || '空'));
    return true;
  }

  /* ==================== 审核流程 ==================== */
  function startAudit(id) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    if (c.qcState === '已删除') return { ok: false, msg: '已删除病例不能启动审核' };
    if (c.audit.state === '待初审' || c.audit.state === '待复审') return { ok: false, msg: '审核流程已在运行中' };
    c.audit = {
      state: '待初审', level: '初审', role: REVIEW_ROLES['初审'],
      assignee: REVIEWERS['初审'][seedOf(id + now()) % REVIEWERS['初审'].length],
      assignAt: now(), deadline: addDays(today(), 7), opinions: c.audit.opinions || [], terminateReason: ''
    };
    if (c.qcState === '待质控') c.qcState = '质控中';
    c.reaudit = false;
    saveCases();
    addLog(c, '启动审核流程', '初审已分配至 ' + c.audit.assignee + '，截止 ' + c.audit.deadline);
    return { ok: true, msg: '审核流程已启动（初审）' };
  }

  /* 提交审核意见：通过 → 进入下一级 / 完成；退回 → 已退回（可重新提交） */
  function submitOpinion(id, result, opinion) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    var a = c.audit;
    if (a.state !== '待初审' && a.state !== '待复审') return { ok: false, msg: '当前状态不可提交审核意见' };
    if (!opinion) return { ok: false, msg: '请填写审核意见' };
    a.opinions.push({
      level: a.level, role: a.role, actor: a.assignee, at: now(),
      result: result, opinion: opinion
    });
    if (result === '退回') {
      a.state = '已退回';
      if (c.qcState === '质控中') c.qcState = '已修正';
      addLog(c, '审核退回', a.level + '退回：' + opinion);
    } else if (a.level === '初审') {
      a.state = '待复审'; a.level = '复审'; a.role = REVIEW_ROLES['复审'];
      a.assignee = REVIEWERS['复审'][seedOf(id + now()) % REVIEWERS['复审'].length];
      a.assignAt = now(); a.deadline = addDays(today(), 7);
      addLog(c, '初审通过', '转复审，复审人 ' + a.assignee + '：' + opinion);
    } else {
      a.state = '已通过';
      addLog(c, '复审通过', '审核流程完成：' + opinion);
    }
    saveCases();
    return { ok: true, msg: result === '退回' ? '已退回并记录审核意见' : (a.state === '已通过' ? '复审通过，审核流程完成' : '初审通过，已流转至复审') };
  }

  /* 重新提交（已退回 → 待初审） */
  function resubmitAudit(id) {
    var c = caseById(id);
    if (!c || c.audit.state !== '已退回') return { ok: false, msg: '仅已退回病例可重新提交' };
    c.audit.state = '待初审'; c.audit.level = '初审'; c.audit.role = REVIEW_ROLES['初审'];
    c.audit.assignee = REVIEWERS['初审'][seedOf(id + now()) % REVIEWERS['初审'].length];
    c.audit.assignAt = now(); c.audit.deadline = addDays(today(), 7);
    saveCases();
    addLog(c, '重新提交审核', '退回整改后重新提交，分配至 ' + c.audit.assignee);
    return { ok: true, msg: '已重新提交审核' };
  }

  /* B8 终止异常审核流程 */
  function terminateAudit(id, reason) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    if (c.audit.state !== '待初审' && c.audit.state !== '待复审') return { ok: false, msg: '当前状态不可终止' };
    c.audit.state = '已终止';
    c.audit.terminateReason = reason || '管理员终止';
    saveCases();
    addLog(c, '终止审核流程', c.audit.terminateReason);
    return { ok: true, msg: '审核流程已终止' };
  }

  function auditQueue() {
    return activeCases().filter(function (c) { return c.audit.state !== '未启动'; });
  }
  function isOverdue(c) {
    if (c.audit.state !== '待初审' && c.audit.state !== '待复审') return false;
    return !!(c.audit.deadline && c.audit.deadline < today());
  }

  /* ==================== 规则配置 ==================== */
  function saveRule(rule) {
    var rules = rulesArr();
    if (rule.id) {
      var old = rules.filter(function (r) { return r.id === rule.id; })[0];
      if (!old) return { ok: false, msg: '规则不存在' };
      Object.keys(rule).forEach(function (k) { old[k] = rule[k]; });
      old.updatedAt = today();
    } else {
      var maxNo = 0;
      rules.forEach(function (r) { var n = parseInt(String(r.id).replace('CQR-', ''), 10); if (n > maxNo) maxNo = n; });
      rule.id = 'CQR-' + pad(maxNo + 1);
      rule.creator = ACTOR; rule.createdAt = today(); rule.updatedAt = today();
      rules.push(rule);
    }
    setRules(rules);
    return { ok: true, msg: '规则已保存' };
  }
  function toggleRule(id) {
    var r = rulesArr().filter(function (x) { return x.id === id; })[0];
    if (!r) return false;
    r.enabled = !r.enabled; r.updatedAt = today();
    saveRules();
    return r.enabled;
  }
  function deleteRule(id) {
    var rules = rulesArr();
    var idx = rules.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return false;
    rules.splice(idx, 1);
    setRules(rules);
    return true;
  }
  function ruleById(id) { return rulesArr().filter(function (r) { return r.id === id; })[0] || null; }

  /* 规则执行统计（C4）：触发次数 / 待修复 / 已修复 / 修复率 */
  function ruleStats(ruleId) {
    var ps = problemsArr().filter(function (p) { return p.ruleId === ruleId; });
    var open = ps.filter(function (p) { return p.status === '待修复'; }).length;
    var fixed = ps.filter(function (p) { return p.status === '已修复'; }).length;
    return { hits: ps.length, open: open, fixed: fixed, fixRate: ps.length ? Math.round(fixed / ps.length * 1000) / 10 : 0 };
  }

  /* ==================== 异常与修复（C5/C6/C8） ==================== */
  function problemsOf(ruleId) {
    return problemsArr().filter(function (p) { return !ruleId || p.ruleId === ruleId; });
  }
  /* 修复异常：写入修复人/内容；勾选重新审核 → 病例标记 reaudit 并重启审核流程 */
  function fixProblem(pid, fixer, content, needReaudit) {
    var ps = problemsArr();
    var p = ps.filter(function (x) { return x.id === pid; })[0];
    if (!p) return { ok: false, msg: '异常记录不存在' };
    if (p.status === '已修复') return { ok: false, msg: '该异常已修复' };
    p.status = '已修复'; p.fixer = fixer || ACTOR; p.fixAt = now(); p.fixContent = content || '';
    p.reaudit = !!needReaudit;
    p.reauditAt = needReaudit ? now() : '';
    setProblems(ps);
    var c = caseById(p.caseId);
    if (c) {
      if (needReaudit) {
        c.reaudit = true;
        /* 修复后必须真正"启动新一轮审核"：已通过/已终止/未启动/已退回的病例
           一律重置到待初审；仅当前正在初审/复审中的保持不变（流程本就在途）。 */
        if (c.audit.state !== '待初审' && c.audit.state !== '待复审') {
          c.audit.state = '待初审'; c.audit.level = '初审'; c.audit.role = REVIEW_ROLES['初审'];
          c.audit.assignee = REVIEWERS['初审'][seedOf(c.id + now()) % REVIEWERS['初审'].length];
          c.audit.assignAt = now(); c.audit.deadline = addDays(today(), 7);
          if (c.qcState === '待质控') c.qcState = '质控中';
        }
        addLog(c, '标记需重新审核', '异常 ' + p.id + ' 修复后标记重新审核，审核流程重置至待初审');
      } else {
        addLog(c, '修复异常', '异常 ' + p.id + ' 已修复：' + (content || ''));
      }
      c.score = scoreOf(c).total;
      saveCases();
    }
    return { ok: true, msg: needReaudit ? '修复完成，已标记需重新审核' : '修复完成' };
  }

  /* ==================== 生命周期操作（D1/D2/D3/D8） ==================== */
  function setState(id, st, note) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    var old = c.qcState;
    c.qcState = st;
    saveCases();
    addLog(c, '更新处理状态', old + ' → ' + st + (note ? '；' + note : ''));
    return { ok: true, msg: '处理状态已更新：' + st };
  }
  function archive(id) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    if (c.qcState === '已删除') return { ok: false, msg: '已删除病例不能归档' };
    if (c.audit.state !== '已通过') return { ok: false, msg: '审核未通过（当前：' + c.audit.state + '），不能归档' };
    c.qcState = '已归档';
    saveCases();
    addLog(c, '归档病例', '审核通过且无未闭环问题');
    return { ok: true, msg: '病例已归档' };
  }
  function softDelete(id, reason) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    var old = c.qcState;
    c.qcState = '已删除';
    saveCases();
    addLog(c, '逻辑删除', (reason || '测试或无效病例') + '（原状态：' + old + '）');
    return { ok: true, msg: '病例已逻辑删除（保留留痕）' };
  }
  function markRectify(id, note, owner, due) {
    var c = caseById(id);
    if (!c) return { ok: false, msg: '病例不存在' };
    c.rectify = { flag: true, note: note || '存在严重质量问题，需限期整改', owner: owner || '责任机构质控员', due: due || addDays(today(), 7), at: now() };
    saveCases();
    addLog(c, '标记需整改', c.rectify.note + '；责任人：' + c.rectify.owner + '；期限：' + c.rectify.due);
    return { ok: true, msg: '已标记需整改' };
  }

  /* ==================== 统计（页签 KPI / 图表） ==================== */
  function stats() {
    var cs = casesArr();
    var act = cs.filter(function (c) { return c.qcState !== '已删除'; });
    function n(fn) { return act.filter(fn).length; }
    return {
      total: act.length,
      wait: n(function (c) { return c.qcState === '待质控'; }),
      doing: n(function (c) { return c.qcState === '质控中'; }),
      fixed: n(function (c) { return c.qcState === '已修正'; }),
      archived: n(function (c) { return c.qcState === '已归档'; }),
      deleted: cs.length - act.length,
      inAudit: n(function (c) { return c.audit.state === '待初审' || c.audit.state === '待复审'; }),
      first: n(function (c) { return c.audit.state === '待初审'; }),
      second: n(function (c) { return c.audit.state === '待复审'; }),
      passed: n(function (c) { return c.audit.state === '已通过'; }),
      rejected: n(function (c) { return c.audit.state === '已退回'; }),
      terminated: n(function (c) { return c.audit.state === '已终止'; }),
      overdue: n(function (c) { return isOverdue(c); }),
      reaudit: n(function (c) { return c.reaudit; }),
      avgScore: act.length ? Math.round(act.reduce(function (s, c) { return s + c.score; }, 0) / act.length * 10) / 10 : 0,
      badIcd: act.filter(function (c) { return !validateIcd10(c.icd10, c.siteName).ok; }).length + act.filter(function (c) { return !validateIcdO3(c.icdO3, c.pathName).ok; }).length,
      openProblems: problemsArr().filter(function (p) { return p.status === '待修复'; }).length
    };
  }

  /* D4 生命周期趋势：近 6 个月四状态序列（以当前真实分布为末点，向前按演示口径外推） */
  function trendByMonth() {
    var months = [];
    var d = new Date();
    for (var i = 5; i >= 0; i--) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(x.getFullYear() + '-' + pad(x.getMonth() + 1));
    }
    var s = stats();
    var base = { wait: s.wait, doing: s.doing, fixed: s.fixed, archived: s.archived };
    /* 向前外推：归档递减（当时还没走完流程）、待质控递增（积压）；叠加确定性抖动 */
    var series = [
      { name: '待质控', color: '#d98b2b', key: 'wait', dir: 1 },
      { name: '质控中', color: '#5b8def', key: 'doing', dir: 0 },
      { name: '已修正', color: '#7fb4e8', key: 'fixed', dir: 0 },
      { name: '已归档', color: '#3f8f4a', key: 'archived', dir: -1 }
    ];
    return {
      months: months,
      series: series.map(function (sr) {
        return {
          name: sr.name, color: sr.color,
          points: months.map(function (m, idx) {
            var back = 5 - idx; /* 距离当前的月数 */
            var jitter = Math.round((rnd01(sr.key + m) - 0.5) * 2);
            var v = base[sr.key] + (sr.dir === 1 ? back : sr.dir === -1 ? -Math.round(back * 1.2) : Math.round(Math.sin(back) * 1.2)) + jitter;
            return { l: m.slice(5) + '月', v: Math.max(0, v) };
          })
        };
      })
    };
  }

  /* D6 问题来源分布：按数据来源统计病例数与异常数 */
  function sourceDist() {
    return SOURCES.map(function (s) {
      var cs = activeCases().filter(function (c) { return c.source === s; });
      var ids = {};
      cs.forEach(function (c) { ids[c.id] = 1; });
      var probs = problemsArr().filter(function (p) { return ids[p.caseId] && p.status === '待修复'; }).length;
      return { source: s, cases: cs.length, problems: probs };
    });
  }

  /* ==================== 导出 ==================== */
  function csvCell(v) {
    v = String(v == null ? '' : v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function exportCsv(name, headers, rows) {
    var csv = '\ufeff' + headers.map(csvCell).join(',') + '\n' +
      rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    download(name + '.csv', csv);
  }
  function exportJson(name, obj) {
    download(name + '.json', JSON.stringify(obj, null, 2), 'application/json;charset=utf-8');
  }

  /* ==================== 对外出口 ==================== */
  window.CQD = {
    SCHEMA: SCHEMA,
    SOURCES: SOURCES, FOLLOW: FOLLOW, QC_STATES: QC_STATES, AUDIT_STATES: AUDIT_STATES,
    REVIEW_LEVELS: REVIEW_LEVELS, RULE_TYPES: RULE_TYPES, RULE_TPLS: RULE_TPLS, SEVERITIES: SEVERITIES,
    ACTOR: ACTOR,
    /* 数据读取 */
    cases: casesArr, activeCases: activeCases, caseById: caseById,
    rules: rulesArr, ruleById: ruleById, problems: problemsOf, logs: logsArr,
    stats: stats, ruleStats: ruleStats, trendByMonth: trendByMonth, sourceDist: sourceDist,
    /* 校验 */
    validateIcd10: validateIcd10, validateIcdO3: validateIcdO3, scoreOf: scoreOf, runRules: runRules,
    /* 操作 */
    receiveBatch: receiveBatch, updateFollow: updateFollow, runChecks: runChecks, fixCaseField: fixCaseField,
    startAudit: startAudit, submitOpinion: submitOpinion, resubmitAudit: resubmitAudit, terminateAudit: terminateAudit,
    auditQueue: auditQueue, isOverdue: isOverdue,
    saveRule: saveRule, toggleRule: toggleRule, deleteRule: deleteRule,
    problemsOf: problemsOf, fixProblem: fixProblem,
    setState: setState, archive: archive, softDelete: softDelete, markRectify: markRectify,
    /* 导出 */
    exportCsv: exportCsv, exportJson: exportJson,
    /* 维护 */
    reset: function () { resetAll(); seedAll(); },
    esc: esc, now: now, today: today, addDays: addDays, rnd01: rnd01
  };
})();
