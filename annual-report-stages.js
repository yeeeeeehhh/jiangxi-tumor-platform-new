/* ============================================================================
 * 年报编制 · 阶段引擎（annual-report-stages.js）
 * ----------------------------------------------------------------------------
 * 目标：把「建立任务 → 跨库取数 → 质量校验 → 生成正文 → 提交审核 → 审核发布 → 归档」
 *      从一条纯展示的进度条，升级为**可推进、可回退、有准入条件、有产物、有留痕**
 *      的正式编制流程状态机。
 *
 * 设计要点
 *  1. 单一事实来源：每个阶段的「是否完成 / 能否进入 / 产物是否齐备」全部由本文件的
 *     规则函数求值，UI 只负责展示。避免各处判断漂移（旧版 taskCaps / taskFlowIndex /
 *     nextStepInfo 三处各判一套的问题）。
 *  2. 准入闸门：进入某阶段前先跑该阶段的准入规则（gate）。不满足时**不放行**，
 *     而是返回「差什么 + 去哪补」，由 UI 渲染成可点击的整改入口。
 *  3. 产物（artifact）：每个阶段产出可核查的东西（数据源核对表、质控报告、统计表清单、
 *     章节树、审核意见单、上报回执），推进时校验产物是否存在。
 *  4. 全程留痕：阶段流转写 stageLog，记录 谁 / 何时 / 从哪到哪 / 依据。
 *
 * 依赖：宿主页面（annual-report.js）注入 ctx，避免本文件反向依赖其内部变量。
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
   * 1. 阶段定义
   * ------------------------------------------------------------------- */
  var STAGES = [
    {
      id: 'task', no: 1, name: '建立任务', short: '建任务',
      desc: '确定报告年度、覆盖范围、人口口径与标准人口，锁定编制基准',
      owner: '省级上报岗',
      // 该阶段的产物清单（推进时应齐备）
      artifacts: ['任务基准（年度/范围/口径）'],
      hint: '口径一经创建进入编制后即锁定，如需变更须退回本阶段。'
    },
    {
      id: 'data', no: 2, name: '数据准备', short: '数据准备',
      desc: '确认本年报纳入哪些病例：合并重复上报、识别一人多癌、核对关键字段填写完整度',
      owner: '省级上报岗',
      artifacts: ['纳入病例数口径', '有效病例分子', '关键字段完整度'],
      hint: '系统已预接入全部数据并自动完成处理，本阶段只需核对，无需手动操作。'
    },
    {
      id: 'draft', no: 3, name: '正文编制', short: '编制',
      desc: '按标准章节结构编排正文，引用统计产物，交叉核对',
      owner: '省级上报岗',
      artifacts: ['章节树', '正文定稿', '引用一致性核对'],
      hint: '正文引用的指标须与统计产物一致，不一致会被标红。'
    },
    {
      id: 'review', no: 4, name: '审核', short: '审核',
      desc: '多级审核（初审 / 复审），意见留痕与修订版本管理',
      owner: '审核岗',
      artifacts: ['审核意见单', '修订记录'],
      hint: '存在未回复的审核意见不得通过。'
    },
    {
      id: 'release', no: 5, name: '发布归档', short: '发布归档',
      desc: '发布审批、生成上报数据包、跟踪国家平台回执、归档入库',
      owner: '省级上报岗',
      artifacts: ['发布审批单', '上报数据包', '国家平台回执'],
      hint: '取得回执后方可归档，归档后定稿只读。'
    }
  ];

  var STAGE_BY_ID = {};
  STAGES.forEach(function (s) { STAGE_BY_ID[s.id] = s; });

  /* ---------------------------------------------------------------------
   * 2. 阶段运行态：由任务数据推导
   * ------------------------------------------------------------------- */

  /** 数据准备阶段：各数据源是否核对到位 */
  function dataSources(t) {
    var ds = (t && t.dataPrep && t.dataPrep.sources) || null;
    if (ds && ds.length) return ds;
    return [];
  }

  /** 质控阶段：问题是否全部闭环 */
  function qcSummary(t) {
    var q = (t && t.qc && t.qc.issues) || [];
    var open = q.filter(function (x) { return x.state !== 'closed' && x.state !== 'waived'; });
    var openBad = open.filter(function (x) { return x.level === 'bad'; });
    var openWarn = open.filter(function (x) { return x.level !== 'bad'; });
    return {
      total: q.length,
      closed: q.filter(function (x) { return x.state === 'closed'; }).length,
      waived: q.filter(function (x) { return x.state === 'waived'; }).length,
      open: open.length,
      openBad: openBad.length,
      openWarn: openWarn.length,
      issues: q
    };
  }

  /** 统计阶段：统计产物是否生成 */
  function statsSummary(t) {
    var st = (t && t.stats) || {};
    var tables = st.tables || [];
    var charts = st.charts || [];
    return {
      done: !!st.done,
      tables: tables, charts: charts,
      tableN: tables.length, chartN: charts.length,
      // 统计快照须与当前数据版本一致，否则视为过期
      stale: !!(st.snapshotAt && t && t.dataVersion && st.dataVersion !== t.dataVersion)
    };
  }

  /** 编制阶段：章节完成度 */
  function draftSummary(t, chapterTotal, chapterDone) {
    var total = chapterTotal ? chapterTotal(t) : 0;
    var done = chapterDone ? chapterDone(t) : 0;
    return { total: total, done: done, complete: total > 0 && done >= total };
  }

  /** 审核阶段：意见是否全部回复 */
  function reviewSummary(t) {
    var rs = (t && t.review && t.review.rounds) || [];
    var last = rs.length ? rs[rs.length - 1] : null;
    var pending = [];
    rs.forEach(function (r) {
      (r.items || []).forEach(function (it) {
        if (it.replyState !== 'replied') pending.push(it);
      });
    });
    // 注意：不能再写 !pending —— 空数组是 truthy，会让 passed 恒为 false
    return { rounds: rs, last: last, pending: pending.length, passed: !!(last && last.result === 'pass' && pending.length === 0) };
  }

  /** 发布归档阶段：回执与归档 */
  function releaseSummary(t) {
    var rel = (t && t.release) || {};
    return {
      approved: !!rel.approvedAt,
      packageBuilt: !!rel.packageBuiltAt,
      receiptNo: rel.receiptNo || '',
      receiptAt: rel.receiptAt || '',
      archivedAt: t && t.archivedAt
    };
  }

  /* ---------------------------------------------------------------------
   * 3. 准入闸门：能不能做这一阶段 / 能不能往下一阶段推进
   *    每个 gate 返回 { ok, blockers:[{text, action:{label,fn,arg}}], warns:[...] }
   * ------------------------------------------------------------------- */
  function blocker(text, label, fn, arg) { return { text: text, action: { label: label, fn: fn, arg: arg } }; }
  function warn(text) { return { text: text }; }

  var GATES = {
    /* 进入「数据准备」：任务口径必须齐全 */
    task: function (t) {
      var b = [];
      if (!t.year) b.push(blocker('未指定报告年度', '去设置年度', 'arGoStage', 'task'));
      if (!t.scope) b.push(blocker('未指定覆盖范围', '去设置范围', 'arGoStage', 'task'));
      if (t.scope === 'city' && (!t.cities || !t.cities.length)) b.push(blocker('覆盖范围选为「按设区市」但未勾选任何设区市', '去勾选设区市', 'arGoStage', 'task'));
      if (!t.popCal) b.push(blocker('未指定人口口径（常住 / 户籍）', '去设置人口口径', 'arGoStage', 'task'));
      if (!t.stdPop) b.push(blocker('未指定标准人口（中国 2000 / Segi 世界）', '去设置标准人口', 'arGoStage', 'task'));
      return { ok: !b.length, blockers: b, warns: [] };
    },

    /* 进入「质量校验」：数据源须全部接入并核对到位 */
    data: function (t) {
      var b = [], w = [];
      var srcs = dataSources(t);
      if (!srcs.length) {
        b.push(blocker('尚未登记任何数据源接入记录', '去登记数据源', 'arGoStage', 'data'));
        return { ok: false, blockers: b, warns: w };
      }
      // 未接入 → 引导去接入；已接入未核对 → 引导去核对
      srcs.filter(function (s) { return s.state === 'pending' || s.state === 'failed'; }).forEach(function (s) {
        b.push(blocker('数据源「' + s.name + '」尚未接入取数（当前：' + sourceStateLabel(s.state) + '）', '接入取数', 'arConnectSource', s.id));
      });
      srcs.filter(function (s) { return s.state === 'receiving'; }).forEach(function (s) {
        b.push(blocker('数据源「' + s.name + '」已接入但未执行核对', '执行核对', 'arVerifySource', s.id));
      });
      var noCard = srcs.filter(function (s) { return s.state === 'ready' && !(Number(s.cards) > 0) && s.id !== 'src-pop'; });
      noCard.forEach(function (s) {
        w.push(warn('数据源「' + s.name + '」核对到位但记录数为 0，请确认是否确实为空'));
      });
      var diff = srcs.filter(function (s) { return s.state === 'ready' && s.diff; });
      diff.forEach(function (s) {
        w.push(warn('数据源「' + s.name + '」较上一版差异 ' + (s.diff.delta > 0 ? '+' : '') + s.diff.delta + ' 条，请在备注中说明原因'));
      });
      var dp = t.dataPrep || {};
      if (!dp.dedupDone) b.push(blocker('尚未确认纳入统计的有效病例数（需先合并重复上报）', '查看病例数口径', 'arRunDataPrep'));
      if (!dp.fieldsChecked) b.push(blocker('尚未核对关键字段填写完整度', '查看字段完整度', 'arCheckFields'));
      return { ok: !b.length, blockers: b, warns: w };
    },

    /* 进入「审核」：章节须齐备 */
    draft: function (t, helpers) {
      var b = [], w = [];
      var d = draftSummary(t, helpers.chapterTotal, helpers.chapterDone);
      if (!d.total) { b.push(blocker('章节结构为空，请检查年报模板', '去模板管理', 'arGoPage', 'ar-templates')); return { ok: false, blockers: b, warns: w }; }
      if (d.done < d.total) b.push(blocker('正文尚缺 ' + (d.total - d.done) + ' 章（已完成 ' + d.done + '/' + d.total + '）', '去编制正文', 'arGoStage', 'draft'));
      var mism = (t.draftCheck && t.draftCheck.mismatches) || [];
      if (mism.length) b.push(blocker('正文引用一致性核对发现 ' + mism.length + ' 处与统计产物不符', '去核对', 'arCheckDraft'));
      return { ok: !b.length, blockers: b, warns: w };
    },

    /* 进入「发布归档」：审核须通过 */
    review: function (t) {
      var b = [], w = [];
      var r = reviewSummary(t);
      if (!r.rounds.length) { b.push(blocker('尚未提交审核', '提交审核', 'arSubmitReview')); return { ok: false, blockers: b, warns: w }; }
      if (r.pending > 0) b.push(blocker('存在 ' + r.pending + ' 条审核意见未回复', '去回复意见', 'arGoStage', 'review'));
      if (r.last && r.last.result === 'reject') b.push(blocker('最近一轮审核结论为「退回修改」', '去查看意见并修订', 'arGoStage', 'review'));
      if (r.last && r.last.result !== 'pass') b.push(blocker('最近一轮审核尚未给出「通过」结论', '等待审核结论', 'arGoStage', 'review'));
      return { ok: !b.length, blockers: b, warns: w };
    },

    /* 终态：归档前置条件 */
    release: function (t) {
      var b = [], w = [];
      var rel = releaseSummary(t);
      if (!rel.approved) b.push(blocker('尚未完成发布审批', '提交发布审批', 'arApproveRelease'));
      if (!rel.packageBuilt) b.push(blocker('尚未生成上报数据包', '生成数据包', 'arBuildPackage'));
      if (!rel.receiptNo) b.push(blocker('尚未取得国家平台回执，按流程不得归档', '登记回执', 'arEnterReceipt'));
      return { ok: !b.length, blockers: b, warns: w };
    }
  };

  function sourceStateLabel(s) {
    return ({ pending: '未接入', fetching: '取数中', receiving: '待核对', ready: '已核对', failed: '接入失败' })[s] || s;
  }

  /* ---------------------------------------------------------------------
   * 4. 阶段推进判定
   * ------------------------------------------------------------------- */

  /** 该阶段本身是否已完成（产物齐备） */
  function stageDone(t, id, helpers) {
    helpers = helpers || {};
    switch (id) {
      case 'task': return GATES.task(t).ok;
      case 'data': return GATES.data(t).ok;
      case 'draft': return draftSummary(t, helpers.chapterTotal, helpers.chapterDone).complete;
      case 'review': return reviewSummary(t).passed;
      case 'release': return !!(t.release && t.release.receiptNo && t.status === 'archived');
      default: return false;
    }
  }

  /**
   * 用户「正在工作的阶段」。
   *
   * t.stage 一旦设定即为权威——阶段只能通过 markStage（由「完成本阶段」或「回退」动作调用）改变。
   * 绝不能因为产物齐备就自动前进：否则数据准备一做完，工作位立刻跳到「正文编制」，
   * 「完成本阶段 · 进入下一阶段」按钮根本没机会出现，阶段流转也就写不进留痕。
   *
   * 只有 t.stage 缺失（新任务未初始化 / 老数据未迁移）时才退回按产物推导。
   */
  function workStage(t, helpers) {
    if (!t) return STAGES[0].id;
    if (t.status === 'voided') return 'task';
    if (t.status === 'archived') return 'release';
    if (t.stage && STAGE_BY_ID[t.stage]) return t.stage;
    return deriveStage(t, helpers);
  }

  /** 纯推导：第一个未完成的阶段 */
  function deriveStage(t, helpers) {
    if (!t) return STAGES[0].id;
    if (t.status === 'voided') return 'task';
    if (t.status === 'archived') return 'release';
    for (var i = 0; i < STAGES.length; i++) {
      if (!stageDone(t, STAGES[i].id, helpers)) return STAGES[i].id;
    }
    return 'release';
  }

  /** 当前所处阶段（对外：默认给工作位，无工作位则推导） */
  function currentStage(t, helpers) {
    return workStage(t, helpers);
  }

  /**
   * 能否推进到下一阶段。
   *
   * 语义：当前工作位（workStage）的产物是否齐备。齐备则允许「完成本阶段 · 进入下一阶段」，
   * 由用户显式确认后把工作位推到下一阶段并写留痕。
   *
   * 返回 { can, from=当前工作位, to=下一阶段, gate, reason }
   */
  function canAdvance(t, helpers) {
    var cur = currentStage(t, helpers);
    var idx = STAGES.map(function (s) { return s.id; }).indexOf(cur);
    var next = STAGES[idx + 1];
    var gate = evalGate(cur, t, helpers);
    if (!next) {
      return { can: false, from: cur, to: null, gate: gate, reason: '已处于最终阶段' };
    }
    if (!gate.ok) {
      return { can: false, from: cur, to: next.id, gate: gate, reason: '「' + STAGES[idx].name + '」尚有未满足的准入条件' };
    }
    return { can: true, from: cur, to: next.id, gate: gate, reason: '' };
  }

  /** 推进工作位：显式记录，并返回留痕所需信息 */
  function markStage(t, id) {
    if (!STAGE_BY_ID[id]) return false;
    t.stage = id;
    return true;
  }

  function evalGate(id, t, helpers) {
    var fn = GATES[id];
    if (!fn) return { ok: true, blockers: [], warns: [] };
    try { return fn(t, helpers || {}); }
    catch (err) { return { ok: false, blockers: [blocker('准入校验执行异常：' + err.message, '', '', '')], warns: [] }; }
  }

  /* ---------------------------------------------------------------------
   * 5. 留痕
   * ------------------------------------------------------------------- */
  function logStage(t, action, from, to, note, by) {
    t.stageLog = t.stageLog || [];
    t.stageLog.unshift({
      at: (global.arNowStr ? global.arNowStr() : new Date().toLocaleString('zh-CN')),
      action: action, from: from || '', to: to || '',
      note: note || '', by: by || '省级上报岗'
    });
    if (t.stageLog.length > 200) t.stageLog.length = 200;
  }

  /* ---------------------------------------------------------------------
   * 6. 对外接口
   * ------------------------------------------------------------------- */
  global.AR_STAGES = {
    list: STAGES,
    byId: function (id) { return STAGE_BY_ID[id]; },
    indexOf: function (id) { return STAGES.map(function (s) { return s.id; }).indexOf(id); },
    evalGate: evalGate,
    stageDone: stageDone,
    currentStage: currentStage,
    workStage: workStage,
    deriveStage: deriveStage,
    markStage: markStage,
    canAdvance: canAdvance,
    logStage: logStage,
    summaries: {
      dataSources: dataSources, qc: qcSummary, stats: statsSummary,
      draft: draftSummary, review: reviewSummary, release: releaseSummary
    },
    sourceStateLabel: sourceStateLabel,
    /* 供 UI 直接调用的别名（早期草稿里拼成了 sourceStandalone） */
    sourceStandalone: sourceStateLabel
  };
})(typeof window !== 'undefined' ? window : this);
