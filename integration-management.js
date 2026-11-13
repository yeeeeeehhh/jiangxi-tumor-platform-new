// 集成管理：3 张信息表共用一份配置驱动 CRUD 引擎，差异只由 schema 表达。
// 存储与交互沿用 app.html 既有件：localStorage / toast / showConfirm / cd-overlay / renderPage 包装。
(function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  var SCHEMAS = {
    'int-app': {
      title: '第三方集成应用元信息',
      key: 'jx.int.app.v1',
      csv: '第三方集成应用信息表.csv',
      filters: [
        { k: 'keyword', label: '名称', kind: 'text', match: 'name' },
        { k: 'type', label: '类型', kind: 'select', match: 'type', options: ['', 'HIS', 'EMR', 'LIS', 'PACS', '其他'] },
        { k: 'status', label: '状态', kind: 'select', match: 'status', options: ['', '启用', '停用'] }
      ],
      fields: [
        { k: 'appId', label: '应用ID', kind: 'text', required: true, unique: true },
        { k: 'code', label: '编码', kind: 'text', required: true, unique: true },
        { k: 'name', label: '名称', kind: 'text', required: true },
        { k: 'type', label: '类型', kind: 'select', required: true, options: ['HIS', 'EMR', 'LIS', 'PACS', '其他'] },
        { k: 'uriTemplate', label: 'URI模板 / URL', kind: 'text', required: true },
        { k: 'passLogin', label: '登录态透传', kind: 'select', required: true, options: ['是', '否'] },
        { k: 'status', label: '状态', kind: 'select', required: true, options: ['启用', '停用'] }
      ]
    },
    'int-entry': {
      title: '集成入口展示配置',
      key: 'jx.int.entry.v1',
      csv: '集成入口展示配置表.csv',
      filters: [
        { k: 'keyword', label: '入口名称', kind: 'text', match: 'entryName' }
      ],
      fields: [
        { k: 'entryName', label: '入口名称', kind: 'text', required: true, unique: true },
        { k: 'icon', label: '图标', kind: 'text', required: true },
        { k: 'sort', label: '排序', kind: 'number', required: true },
        { k: 'defaultShow', label: '默认显示', kind: 'select', required: true, options: ['是', '否'] }
      ]
    },
    'int-security': {
      title: '集成安全与参数映射配置',
      key: 'jx.int.security.v1',
      csv: '集成安全与参数映射配置表.csv',
      filters: [
        { k: 'keyword', label: '规则名称', kind: 'text', match: 'ruleName' }
      ],
      fields: [
        { k: 'ruleName', label: '规则名称', kind: 'text', required: true, unique: true },
        { k: 'requestParamMap', label: '请求参数映射', kind: 'textarea', required: true },
        { k: 'signAlgorithm', label: '签名算法', kind: 'select', required: true, options: ['MD5', 'SHA256', 'HMAC-SHA256'] },
        { k: 'whitelistDomains', label: '白名单域名', kind: 'textarea', required: true },
        { k: 'signKey', label: '签名密钥', kind: 'text', required: true },
        { k: 'timeout', label: '超时设置(秒)', kind: 'number', required: true }
      ]
    }
  };

  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(id) { var v = lsGet(SCHEMAS[id].key); return Array.isArray(v) ? v : []; }
  function save(id, list) { lsSet(SCHEMAS[id].key, list); }

  var ST = { form: null };
  Object.keys(SCHEMAS).forEach(function (id) {
    var f = {};
    SCHEMAS[id].filters.forEach(function (x) { f[x.k] = ''; });
    ST[id] = { filter: f };
  });

  function filterList(id, list) {
    var s = SCHEMAS[id], q = ST[id].filter;
    return list.filter(function (r) {
      return s.filters.every(function (f) {
        var v = q[f.k] || '';
        if (v === '') return true;
        if (f.kind === 'text') return String(r[f.match] == null ? '' : r[f.match]).indexOf(v) >= 0;
        return String(r[f.match] == null ? '' : r[f.match]) === v;
      });
    });
  }

  function fieldHtml(f, v) {
    var id = 'im_' + f.k;
    var mark = f.required ? ' <span class="required">*</span>' : '';
    if (f.kind === 'select') {
      return '<div class="form-group"><label>' + esc(f.label) + mark + '</label><select id="' + id + '">' +
        f.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (String(o) === String(v) ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></div>';
    }
    if (f.kind === 'textarea') {
      return '<div class="form-group full"><label>' + esc(f.label) + mark + '</label><textarea id="' + id + '">' + esc(v) + '</textarea></div>';
    }
    return '<div class="form-group"><label>' + esc(f.label) + mark + '</label><input id="' + id + '" type="' +
      (f.kind === 'number' ? 'number' : 'text') + '" value="' + esc(v) + '"></div>';
  }

  function filterHtml(id) {
    var s = SCHEMAS[id], q = ST[id].filter;
    var h = '<div class="filter-toolbar">';
    s.filters.forEach(function (f) {
      var fid = 'imf_' + f.k, v = q[f.k] || '';
      if (f.kind === 'select') {
        h += '<div class="form-group"><label>' + esc(f.label) + '</label><select id="' + fid + '">' +
          f.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (String(o) === String(v) ? ' selected' : '') + '>' + esc(o === '' ? '全部' : o) + '</option>';
          }).join('') + '</select></div>';
      } else {
        h += '<div class="form-group search-group"><label>' + esc(f.label) + '</label><input id="' + fid + '" value="' + esc(v) + '" placeholder="名称关键字"></div>';
      }
    });
    h += '<div class="filter-actions">' +
      '<button class="btn btn-primary btn-sm" onclick="IM.query(\'' + id + '\')">查询</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="IM.reset(\'' + id + '\')">重置</button>' +
      '<button class="btn btn-primary btn-sm" onclick="IM.add(\'' + id + '\')">+ 新增</button>' +
      '<button class="btn btn-outline btn-sm" onclick="IM.exportCsv(\'' + id + '\')">导出</button>' +
      '</div></div>';
    return h;
  }

  function renderPageId(id) {
    var s = SCHEMAS[id], raw = load(id), list = filterList(id, raw);
    var heads = ['序号'].concat(s.fields.map(function (f) { return esc(f.label); })).concat(['操作']);
    var body = list.length ? list.map(function (r, n) {
      var i = raw.indexOf(r);
      return '<tr><td>' + (n + 1) + '</td>' + s.fields.map(function (f) { return '<td>' + esc(r[f.k]) + '</td>'; }).join('') +
        '<td class="ops">' +
        '<button class="btn btn-primary btn-xs" onclick="IM.detail(\'' + id + '\',' + i + ')">详情</button> ' +
        '<button class="btn btn-primary btn-xs" onclick="IM.edit(\'' + id + '\',' + i + ')">编辑</button> ' +
        '<button class="btn btn-danger btn-xs" onclick="IM.del(\'' + id + '\',' + i + ')">删除</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="' + (s.fields.length + 2) + '" style="text-align:center;color:#64748b">暂无匹配数据</td></tr>';
    return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>' + esc(s.title) + '</div></div>' +
      '<div class="panel"><div class="panel-body">' + filterHtml(id) +
      '<div class="table-wrap"><table class="data-table tbl-auto"><thead><tr>' +
      heads.map(function (x) { return '<th>' + x + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body + '</tbody></table></div></div></div>';
  }

  function closeModal() {
    document.querySelectorAll('.int-modal').forEach(function (x) { x.remove(); });
  }

  function modal(title, content, showSave) {
    closeModal();
    var o = document.createElement('div');
    o.className = 'cd-overlay int-modal';
    o.style.zIndex = '10000';
    o.innerHTML = '<div class="cd-dialog" style="max-width:720px">' +
      '<div class="cd-header"><span>' + esc(title) + '</span><span class="cd-close" onclick="IM.close()">×</span></div>' +
      '<div class="cd-body" style="max-height:70vh;overflow:auto">' + content + '</div>' +
      '<div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      (showSave
        ? '<button class="btn btn-ghost btn-sm" onclick="IM.close()">取消</button><button class="btn btn-primary btn-sm" onclick="IM.submit()">保存</button>'
        : '<button class="btn btn-primary btn-sm" onclick="IM.close()">关闭</button>') +
      '</div></div>';
    o.onclick = function (e) { if (e.target === o) closeModal(); };
    document.body.appendChild(o);
    return o;
  }

  function openForm(id, i) {
    var s = SCHEMAS[id], list = load(id);
    if (i != null && !list[i]) return;
    var r = i == null ? {} : list[i];
    ST.form = { id: id, index: i == null ? null : i };
    var body = '<div class="form-grid">' + s.fields.map(function (f) {
      return fieldHtml(f, r[f.k] == null ? '' : r[f.k]);
    }).join('') + '</div>';
    modal((i == null ? '新增 · ' : '编辑 · ') + s.title, body, true);
  }

  function submit() {
    var st = ST.form;
    if (!st) return false;
    var s = SCHEMAS[st.id], list = load(st.id), rec = {};
    for (var n = 0; n < s.fields.length; n++) {
      var f = s.fields[n], el = document.getElementById('im_' + f.k);
      var v = el ? String(el.value == null ? '' : el.value).trim() : '';
      if (f.required && !v) { toast('请填写' + f.label, 'error'); return false; }
      if (f.kind === 'number' && !/^\d+$/.test(v)) { toast(f.label + '必须为非负整数', 'error'); return false; }
      if (f.unique && list.some(function (x, j) { return j !== st.index && String(x[f.k]) === v; })) {
        toast(f.label + '已存在', 'error'); return false;
      }
      rec[f.k] = f.kind === 'number' ? Number(v) : v;
    }
    if (st.index == null) list.push(rec); else list[st.index] = rec;
    save(st.id, list);
    closeModal();
    toast('保存成功');
    refresh(st.id);
    return true;
  }

  function detail(id, i) {
    var s = SCHEMAS[id], r = load(id)[i];
    if (!r) return;
    var body = '<div class="form-grid">' + s.fields.map(function (f) {
      return '<div class="form-group"><label>' + esc(f.label) + '</label><div style="padding:6px 0">' + esc(r[f.k]) + '</div></div>';
    }).join('') + '</div>';
    modal('详情 · ' + s.title, body, false);
  }

  function del(id, i) {
    var r = load(id)[i];
    if (!r) return;
    var first = SCHEMAS[id].fields[0].k;
    showConfirm('确认删除', '确定要删除「' + r[first] + '」吗？', function () {
      var list = load(id);
      list.splice(i, 1);
      save(id, list);
      toast('删除成功');
      refresh(id);
    });
  }

  function query(id) {
    var q = ST[id].filter;
    SCHEMAS[id].filters.forEach(function (f) {
      var el = document.getElementById('imf_' + f.k);
      q[f.k] = el ? String(el.value == null ? '' : el.value).trim() : '';
    });
    refresh(id);
  }

  function reset(id) {
    var q = ST[id].filter;
    Object.keys(q).forEach(function (k) { q[k] = ''; });
    refresh(id);
  }

  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function exportCsv(id) {
    var s = SCHEMAS[id], list = load(id);
    var lines = [s.fields.map(function (f) { return csvCell(f.label); }).join(',')];
    list.forEach(function (r) {
      lines.push(s.fields.map(function (f) { return csvCell(r[f.k]); }).join(','));
    });
    try {
      var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = s.csv;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
      toast('导出成功');
      return true;
    } catch (e) {
      toast('导出失败', 'error');
      return false;
    }
  }

  function refresh(id) {
    if (typeof window.renderPage === 'function') window.renderPage(id);
  }

  var IM = {
    schemas: SCHEMAS,
    state: ST,
    data: load,
    renderPageId: renderPageId,
    add: function (id) { openForm(id, null); },
    edit: openForm,
    detail: detail,
    del: del,
    query: query,
    reset: reset,
    submit: submit,
    close: closeModal,
    exportCsv: exportCsv,
    refresh: refresh
  };
  window.IM = IM;

  var has = function (id) { return Object.prototype.hasOwnProperty.call(SCHEMAS, id); };
  var baseRender = (typeof window.renderPage === 'function') ? window.renderPage : function () {};
  window.renderPage = function (id) {
    if (!has(id)) return baseRender.apply(this, arguments);
    var pc = document.getElementById('pageContainer');
    if (pc) pc.innerHTML = renderPageId(id);
    if (typeof setActiveMenu === 'function') setActiveMenu(id);
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb(id);
    if (typeof autoSizeSelects === 'function') { try { autoSizeSelects(); } catch (e) {} }
    var mc = document.getElementById('mainContent');
    if (mc && mc.scrollTop !== undefined) mc.scrollTop = 0;
  };
})();
