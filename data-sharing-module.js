/* =========================================================================
 * data-sharing-module.js — 肿瘤数据共享（v2 重构 2026-11-11）
 *
 * 对照《肿瘤数据共享》功能点 18—23 共 6 张信息表：
 *   · 18 外部平台对接与数据接入配置：单页完成接口协议定义（HTTP / FTP /
 *     SOAP / FHIR / MQ）、同步频率设置（实时 / 每日 / 每周 / 每月 + 增量
 *     全量 + 同步时点）、字段映射规则配置（源字段 → 目标字段）、接口
 *     启用/停用、接口版本管理与回滚（platformVer）、接口状态监控（连接
 *     状态 / 响应时间 / 可用率 / 检测记录）、接口配置导出（JSON / CSV），
 *     并保留接入说明与附件下载。
 *   · 19 数据共享申请流程：新建申请 → 数据管理科 → 数据安全小组 →
 *     分管领导三级审批（通过 / 驳回、意见留痕、审批时间线）。
 *   · 20 数据共享策略配置：脱敏级别 / 允许禁止字段（PII 提示）/
 *     最小颗粒度 / 有效期 / 机构白名单 / 二次授权，CRUD + 生效切换。
 *   · 21 共享数据交付凭证：仅对「已批准」申请按策略生成交付；令牌
 *     状态机（有效 / 已过期 / 已吊销）+ 续期 / 吊销 / 脱敏 CSV 真实下载。
 *   · 22 数据使用行为监控日志：模拟接入请求生成访问日志，按策略判定
 *     异常与风险等级；异常处置 / 忽略闭环。
 *   · 23 共享数据元数据血缘：字段级元数据（来源平台外键 ACC-*）、
 *     字段含义（fieldDesc）/ 数据类型 / 敏感等级 / PII / 脱敏规则 /
 *     更新频率 / 血缘路径，详情查询、补录 / 编辑，目录导出（CSV / JSON）。
 * 新增「共享操作审计」：shAudit，全部写操作留痕（上限 300 条），页面 sh-trail。
 *
 * v2 关键改动（相对 v1）：
 *   · 血缘来源平台由字符串匹配改为 sourcePlatformId 外键 → platform.accessId；
 *   · 交付令牌显式状态机 tokenStatus（有效 / 已吊销 + revokedTime），
 *     过期按 tokenExpire 实时判定；吊销 / 过期后下载拦截并写高风险日志；
 *   · 监控日志新增 handleStatus / handleBy / handleTime / handleNote 处置闭环；
 *   · 页面 id 前缀 sh-*，菜单组「数据共享管理」由 app.html menuData 静态注册；
 *   · 数据 localStorage 持久化（jx.sh.*.v1），调试出口 window.SH。
 * ========================================================================= */
(function () {
'use strict';

/* ---------- 通用工具 ---------- */
function esc(v){ if(v===undefined||v===null||v==='') return '—'; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function now(){ var d=new Date(),p=function(n){return (n<10?'0':'')+n}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
function p2(n){ return (n<10?'0':'')+n; }
function p4(n){ return ('000'+n).slice(-4); }
function lsGet(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
/* v3 结构升级：外部平台接入配置扩展了协议 / 同步 / 字段映射 / 版本 / 监控
   字段，检测到 schema 版本号低于 6 时一次性清除本模块全部 localStorage 并重新播种。
   v6：血缘元数据新增「字段含义」（fieldDesc）与详情查询 / 目录导出。 */
(function(){ try{
  if(lsGet('jx.sh.schema')!==6){
    Object.keys(localStorage).forEach(function(k){ if(String(k).indexOf('jx.sh.')===0) localStorage.removeItem(k); });
    lsSet('jx.sh.schema',6);
  }
}catch(e){} })();
function op(){ return '管理员'; }   /* 与全系统演示口径一致 */
function hash(s){ var h=0; String(s||'').split('').forEach(function(c){ h=(h*31+c.charCodeAt(0))>>>0; }); return h; }
function uniq(a){ var s={},out=[]; (a||[]).forEach(function(x){ if(x&&!s[x]){ s[x]=1; out.push(x); } }); return out; }
function plusDays(n,h){ var d=new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+(h||'23:59'); }
function daysAgo(n,h){ var d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+(h||'10:'+p2(d.getDate()%60)); }
/* 令牌剩余天数（按到期字符串换算，向上取整） */
function daysLeft(s){ var t=new Date(String(s).replace(/-/g,'/')).getTime()-Date.now(); return Math.max(0,Math.ceil(t/86400000)); }
/* 令牌实时状态：已吊销（含空令牌）→ 已过期 → 有效 */
function tokenState(d){
  if(!d||d.tokenStatus==='已吊销'||!d.token) return '已吊销';
  return String(d.tokenExpire)<now()?'已过期':'有效';
}

/* ---------- 页面级样式 ---------- */
var css=document.createElement('style');
css.textContent=[
'.sh-modal-box{width:800px;max-width:94vw;text-align:left}',
'.sh-modal-body{max-height:64vh;overflow:auto;text-align:left;line-height:1.8}',
'.sh-modal-body pre{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto;margin:6px 0}',
'.sh-kv{display:grid;grid-template-columns:170px 1fr;gap:6px 12px;font-size:13px}',
'.sh-kv .k{color:#667085}',
'.sh-kv .v{color:#1f2937;word-break:break-all}',
'.sh-frow{display:flex;gap:10px;align-items:center;margin-bottom:10px}',
'.sh-frow>label{flex:0 0 110px;font-size:12.5px;color:#475569;text-align:right}',
'.sh-frow select,.sh-frow input,.sh-frow textarea{flex:1;height:32px;border:1px solid #d1d8e0;border-radius:4px;padding:0 10px;font-size:13px;color:#1e293b;min-width:0}',
'.sh-frow textarea{height:64px;padding:6px 10px;font-family:inherit;line-height:1.6}',
'.sh-chk{display:flex;flex:1;flex-wrap:wrap;gap:4px 14px}',
'.sh-chk label{font-size:12.5px;color:#1e293b;display:flex;align-items:center;gap:4px;cursor:pointer}',
'.sh-chk .pii{color:#b91c1c;font-size:11px;font-weight:600}',
'.sh-sec{font-size:13.5px;font-weight:700;color:#334155;margin:14px 0 8px}',
'.sh-lineage{font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;display:inline-block;line-height:1.9}',
'.sh-lineage b{color:#0b65c2}',
'.sh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
'.sh-card{background:#fff;border:1px solid var(--border);border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}',
'.sh-card-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
'.sh-card-h b{font-size:13.5px;color:#1f2937;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.sh-card-meta{font-size:12px;color:#647085;line-height:1.7}',
'.sh-card-ops{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}',
'.sh-ops-btn{width:28px;height:26px;padding:0;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#475569;font-size:16px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
'.sh-ops-btn:hover,.sh-ops-btn.on{border-color:#0b65c2;color:#0b65c2;background:#f1f7ff}',
'.sh-menu{position:fixed;z-index:9999;min-width:172px;padding:4px;background:#fff;border:1px solid #d7e0ea;border-radius:8px;box-shadow:0 12px 32px rgba(15,23,42,.18);font-size:13px}',
'.sh-menu-h{padding:6px 10px;margin-bottom:2px;border-bottom:1px solid #eef2f6;font-size:11.5px;color:#94a3b8;font-family:monospace}',
'.sh-menu-item{padding:7px 10px;border-radius:5px;color:#334155;cursor:pointer;white-space:nowrap}',
'.sh-menu-item:hover{background:#f1f7ff;color:#0b65c2}',
'.sh-menu-item.danger{color:#b91c1c}',
'.sh-menu-item.danger:hover{background:#fdeaea}',
'.sh-mono{font-family:monospace;font-size:11.5px;color:#475569;word-break:break-all}',
'.sh-sub{font-size:11.5px;color:#64748b}',
'.sh-chips{display:flex;flex-wrap:wrap;gap:4px}',
'.sh-chip{font-size:11px;padding:2px 8px;border-radius:10px;background:#eef4fb;color:#0b65c2;border:1px solid #cfe1f5;white-space:nowrap}',
'.sh-chip.dim{background:#f1f5f9;color:#475569;border-color:#dbe4ea}',
'.sh-chip.allow{background:#e8f7ee;color:#15803d;border-color:#bfe8cf}',
'.sh-chip.deny{background:#fdeaea;color:#b91c1c;border-color:#f3b4b4}',
/* 申请表单双列紧凑行 */
'.sh-frow2{display:flex;gap:10px;margin-bottom:10px}',
'.sh-frow2 .sh-frow{flex:1;margin-bottom:0}',
/* 审批时间线 */
'.sh-tl{margin:4px 0 2px}',
'.sh-tl .tl-item{position:relative;padding:0 0 12px 20px;border-left:2px solid #e2e8f0;margin-left:8px}',
'.sh-tl .tl-item:last-child{border-left-color:transparent;padding-bottom:2px}',
'.sh-tl .tl-item .dot{position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#cbd5e1;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1}',
'.sh-tl .tl-item.done .dot{background:#15803d;box-shadow:0 0 0 1px #15803d}',
'.sh-tl .tl-item.cur .dot{background:#b45309;box-shadow:0 0 0 1px #b45309}',
'.sh-tl .tl-item.fail .dot{background:#b91c1c;box-shadow:0 0 0 1px #b91c1c}',
'.sh-tl .tl-meta{font-size:12px;color:#64748b;line-height:1.6}',
'.sh-tl .tl-meta b{color:#1f2937}',
'.sh-tl .tl-body{font-size:12.5px;color:#334155;margin-top:2px;line-height:1.6}',
/* ---------- 申请 / 审批弹窗 v3 视觉 ---------- */
'.news-confirm-modal .sh-modal-box{width:860px;max-width:94vw;border-radius:12px;box-shadow:0 24px 64px rgba(15,23,42,.28)}',
'.news-confirm-modal .sh-modal-box .news-confirm-title{padding:14px 20px;font-size:15px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;background:linear-gradient(180deg,#f8fafc,#fff);display:flex;align-items:center;gap:8px}',
'.news-confirm-modal .sh-modal-box .news-confirm-title .tt-tag{font-size:11px;font-weight:600;color:#0b65c2;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:1px 9px}',
'.news-confirm-modal .sh-modal-box .news-confirm-body{padding:16px 20px;max-height:66vh;overflow:auto}',
'.news-confirm-modal .sh-modal-box .news-confirm-actions{padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0}',
'.sh-form-tip{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#0b65c2;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 12px;margin-bottom:14px;line-height:1.7}',
'.sh-form-tip .ico{flex:0 0 auto;font-weight:700}',
'.sh-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}',
'.sh-field{display:flex;flex-direction:column;gap:5px;min-width:0}',
'.sh-field.full{grid-column:1/-1}',
'.sh-field>label{font-size:12.5px;font-weight:600;color:#334155}',
'.sh-field>label .req{color:#dc2626;margin-left:2px;font-weight:700}',
'.sh-field input,.sh-field select,.sh-field textarea{width:100%;box-sizing:border-box;height:34px;border:1px solid #d1d8e0;border-radius:6px;padding:0 10px;font-size:13px;color:#1e293b;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}',
'.sh-field textarea{height:auto;min-height:76px;padding:8px 10px;line-height:1.6;resize:vertical;font-family:inherit}',
'.sh-field input:focus,.sh-field select:focus,.sh-field textarea:focus{border-color:#0b65c2;box-shadow:0 0 0 3px rgba(11,101,194,.12)}',
'.sh-field .hint{font-size:11.5px;color:#94a3b8;line-height:1.5}',
'.sh-sum{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:14px}',
'.sh-sum .sh-sum-h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1f2937}',
'.sh-sum .sh-sum-h .sh-chip{margin-left:auto}',
'.sh-sum .sh-sum-b{display:grid;grid-template-columns:104px 1fr;font-size:12.5px}',
'.sh-sum .sh-sum-b .k{padding:8px 14px;color:#667085;background:#fcfdfe;border-top:1px dashed #eef2f6}',
'.sh-sum .sh-sum-b .v{padding:8px 14px;color:#1f2937;border-top:1px dashed #eef2f6;word-break:break-all;line-height:1.7}',
'.sh-steps{display:flex;align-items:flex-start;margin:2px 0 12px}',
'.sh-steps .step{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;min-width:0}',
'.sh-steps .step .n{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:#f1f5f9;color:#94a3b8;border:1.5px solid #e2e8f0;z-index:1}',
'.sh-steps .step .l{font-size:11.5px;color:#94a3b8;font-weight:600;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
'.sh-steps .step .t{font-size:10.5px;color:#cbd5e1}',
'.sh-steps .step.done .n{background:#e8f7ee;color:#15803d;border-color:#bfe8cf}',
'.sh-steps .step.done .l{color:#15803d}',
'.sh-steps .step.done .t{color:#86c99f}',
'.sh-steps .step.cur .n{background:#0b65c2;color:#fff;border-color:#0b65c2;box-shadow:0 0 0 4px rgba(11,101,194,.14)}',
'.sh-steps .step.cur .l{color:#0b65c2}',
'.sh-steps .step.cur .t{color:#0b65c2}',
'.sh-steps .step.fail .n{background:#fdeaea;color:#b91c1c;border-color:#f3b4b4}',
'.sh-steps .step.fail .l{color:#b91c1c}',
'.sh-steps .bar{flex:0 0 30px;height:2px;background:#e2e8f0;margin-top:12px;border-radius:2px}',
'.sh-steps .bar.done{background:#15803d}',
/* 申请页标题栏按钮组 */
'.sh-apply-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px}',
'.sh-apply-hdr .sh-hdr-ops{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
/* 审批设置弹窗（层级卡片 + 审核人搜索） */
'.sh-modal-wide{width:960px;max-width:96vw}',
'.sh-cfg-list{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}',
'.sh-cfg-row{display:flex;gap:12px;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}',
'.sh-cfg-row .sh-cfg-idx{flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:#0b65c2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}',
'.sh-cfg-fields{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}',
'.sh-cfg-fields input{width:100%;box-sizing:border-box;height:36px;border:1px solid #d1d8e0;border-radius:6px;padding:0 10px;font-size:13px;color:#1e293b;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}',
'.sh-cfg-fields input:focus{border-color:#0b65c2;box-shadow:0 0 0 3px rgba(11,101,194,.12)}',
'.sh-cfg-fields .sh-cfg-user{font-family:inherit}',
'.sh-cfg-foot{display:flex;gap:12px;align-items:center;margin-bottom:12px}',
'.sh-cfg-foot .sh-cfg-hint{flex:1;font-size:12px;color:#94a3b8;line-height:1.7}'
].join('');
document.head.appendChild(css);

/* ---------- 存储工厂 ---------- */
function store(name, seedFn, keyField){
  var KEY='jx.sh.'+name+'.v1';
  var arr=lsGet(KEY);
  if(!Array.isArray(arr)||!arr.length){ arr=seedFn(); lsSet(KEY,arr); }
  return {
    key:KEY,
    all:function(){ return arr; },
    find:function(id){ for(var i=0;i<arr.length;i++){ if(arr[i][keyField]===id) return arr[i]; } return null; },
    save:function(){ lsSet(KEY,arr); },
    reset:function(){ arr=seedFn(); lsSet(KEY,arr); }
  };
}

/* ---------- 常量 ---------- */
var PROTOCOL=['HTTP + REST','HTTPS + REST','FTP 文件','SFTP 文件','WebService（SOAP）','HL7 FHIR','消息队列'];
var AUTH_TYPE=['API Key','OAuth 2.0','国密数字证书','IP 白名单'];
var SYNC_FREQ=['实时','每日','每周','每月'];
var SYNC_MODES=['增量','全量'];
var ACCESS_TYPES=['数据上报','数据订阅','双向交换','接口查询'];
var REQ_METHODS=['GET','POST','PUT','文件传输'];
var CONN_STATUS=['正常','异常','未连接'];
var DATA_TYPES=['病例报告卡数据','随访结局数据','死亡补发数据','统计分析汇总数据','年报数据'];

/* 接口配置快照口径（版本管理 / 配置导出共用） */
var CFG_KEYS=['platformName','accessType','protocol','endpoint','method','authType','credential',
  'syncFreq','syncMode','syncTime','timeout','retry','fieldMap','fieldMapJson','enabled'];
function cfgOf(p){ var o={}; CFG_KEYS.forEach(function(k){ o[k]=(p&&p[k]!==undefined)?p[k]:''; }); return o; }
function mapJson(m){ var o={}; (m||[]).forEach(function(x){ if(x&&String(x.src||'').trim()) o[x.src]=x.dst; }); return JSON.stringify(o); }
function bumpVersion(v){ var m=/v(\d+)\.(\d+)/.exec(String(v||'')); if(!m) return 'v1.0'; return 'v'+m[1]+'.'+(parseInt(m[2],10)+1); }
var DELIVERY_TYPES=['接口推送','沙箱取数','文件下载','库表同步'];
/* 可授权访问的页面白名单（cols 为该页面脱敏导出的列，不含直接标识字段） */
var ACCESS_PAGES=[
  {id:'datamgmt-card',label:'报告卡列表',cols:['登记编号','性别','年龄组','发病部位','ICD-10','确诊日期','诊断依据']},
  {id:'followup-records',label:'随访记录',cols:['登记编号','性别','年龄组','随访状态','生存月数','最后接触日期']},
  {id:'death-records',label:'死亡补发记录',cols:['死亡编号','性别','年龄组','根本死因','死因ICD10编码','死亡日期']},
  {id:'ar-tasks',label:'年报任务',cols:['年报任务','年度','状态','编制人']}
];
var SENS_LEVELS=['L1 公开','L2 内部','L3 敏感','L4 高敏感'];
var MASK_RULES=['不适用','姓名掩码','身份证分段掩码','出生日期泛化','哈希脱敏','数值抑制'];
/* 数据共享策略配置维度 */
var MASK_LEVELS=['不脱敏','去标识化','匿名化'];          /* 脱敏级别：匿名化 / 去标识化 / 不脱敏 */
var GRANULARITY=['省级','市级','区县级'];                 /* 最小颗粒度：仅共享到省级 / 市级 / 区级 */
var POLICY_AUTH=['API Key','OAuth 2.0','国密数字证书','IP 白名单']; /* 授权机制 */
/* 策略配置快照口径（版本管理 / 配置导出共用） */
var POLICY_CFG_KEYS=['policyName','applicant','applyOrg','pages','validUntil','enabled','maskLevel','allowFields','denyFields','granularity','authType'];
function policyCfgOf(p){ var o={}; POLICY_CFG_KEYS.forEach(function(k){ o[k]=(p&&p[k]!==undefined)?p[k]:''; }); return o; }
var FIELD_POOL=['登记编号','姓名','性别','出生日期','身份证号','户籍地址','发病部位','病理类型','ICD-10','确诊日期','诊断依据','随访状态','生存月数','根本死因'];
var PII_FIELDS=['姓名','身份证号','户籍地址','联系电话'];
var DATA_TYPE_ENUM=['STRING','NUMBER','DATE'];
var HANDLE_STATUS=['未处置','已处置','已忽略'];
/* 审批节点（三级）：审核人可配置，持久化于 jx.sh.nodes.v1 */
var nodesCfg=store('nodes',function(){
  return [
    {label:'数据管理科审核',user:'张三'},
    {label:'数据安全小组审核',user:'李四'},
    {label:'分管领导审批',user:'超级管理员'}
  ];
},'label');
var NODES=nodesCfg.all();

/* ---------- 种子数据 ---------- */
/* 字段映射：[源字段, 目标字段, 数据类型] */
function fm(list){ return list.map(function(x){ return {src:x[0],dst:x[1],type:x[2]||'STRING',required:x[3]===false?'否':'是'}; }); }
function seedPlatform(){
  var mk=function(o){
    o.fieldMap=o.fieldMap||[];
    o.fieldMapJson=mapJson(o.fieldMap);
    o.respHistory=o.respHistory||[];
    return o;
  };
  return [
    mk({accessId:'ACC-001',platformName:'国家癌症中心肿瘤登记平台',accessType:'数据上报',
      protocol:'WebService（SOAP）',endpoint:'https://nccr.jxcdc.org/soap/tumorReport',method:'POST',
      authType:'国密数字证书',credential:'SM2-2025-****317',
      syncFreq:'每月',syncMode:'全量',syncTime:'每月 5 日 02:00',timeout:30,retry:3,
      fieldMap:fm([['登记编号','reg_no'],['姓名','patient_name'],['身份证号','id_card'],['ICD-10','icd10'],['确诊日期','diag_date','DATE']]),
      enabled:'是',version:'v1.2',
      lastSyncTime:daysAgo(12,'09:00'),syncStatus:'正常',
      connStatus:'正常',respTime:218,lastCheckTime:daysAgo(0,'09:12'),availability:'99.6%',
      respHistory:[{time:daysAgo(0,'09:12'),status:'正常',respTime:218},
        {time:daysAgo(1,'09:10'),status:'正常',respTime:236},
        {time:daysAgo(2,'09:08'),status:'正常',respTime:205}],
      creator:'管理员',createTime:'2025-01-15 10:00',updateTime:'2026-06-18 15:20'}),
    mk({accessId:'ACC-002',platformName:'省死因监测直报系统',accessType:'数据订阅',
      protocol:'HTTPS + REST',endpoint:'https://death.jxcdc.org/api/v2/death',method:'GET',
      authType:'API Key',credential:'AK-****-9f2c',
      syncFreq:'每日',syncMode:'增量',syncTime:'每日 06:30',timeout:20,retry:2,
      fieldMap:fm([['死亡编号','death_id'],['根本死因','cause_icd'],['死亡日期','death_date','DATE'],['报告机构','org_code']]),
      enabled:'是',version:'v2.1',
      lastSyncTime:daysAgo(1,'06:30'),syncStatus:'正常',
      connStatus:'正常',respTime:146,lastCheckTime:daysAgo(0,'06:35'),availability:'99.2%',
      respHistory:[{time:daysAgo(0,'06:35'),status:'正常',respTime:146},
        {time:daysAgo(1,'06:32'),status:'正常',respTime:158}],
      creator:'管理员',createTime:'2025-03-02 14:20',updateTime:'2026-10-22 11:00'}),
    mk({accessId:'ACC-003',platformName:'省卫健委健康云平台',accessType:'双向交换',
      protocol:'HL7 FHIR',endpoint:'https://fhir.jxwjw.gov.cn/r4',method:'POST',
      authType:'OAuth 2.0',credential:'OA-****-3kd9',
      syncFreq:'每周',syncMode:'增量',syncTime:'每周一 02:00',timeout:60,retry:5,
      fieldMap:fm([['患者主索引','patient_id'],['就诊记录','encounter'],['诊断信息','condition']]),
      enabled:'是',version:'v1.0',
      lastSyncTime:daysAgo(9,'17:40'),syncStatus:'异常',
      connStatus:'异常',respTime:1860,lastCheckTime:daysAgo(0,'02:10'),availability:'92.4%',
      respHistory:[{time:daysAgo(0,'02:10'),status:'异常',respTime:1860},
        {time:daysAgo(1,'02:10'),status:'正常',respTime:342},
        {time:daysAgo(2,'02:10'),status:'正常',respTime:311}],
      creator:'数据管理科·王岗',createTime:'2025-06-18 09:15',updateTime:'2026-09-30 17:40'}),
    mk({accessId:'ACC-004',platformName:'省医学科研数据共享平台',accessType:'接口查询',
      protocol:'HTTP + REST',endpoint:'http://share.jxsci.org/api/v1/query',method:'GET',
      authType:'IP 白名单',credential:'IP-210.35.240.0/24',
      syncFreq:'实时',syncMode:'增量',syncTime:'实时（无固定时点）',timeout:15,retry:1,
      fieldMap:fm([['查询请求','query_path'],['返回结果','result_set'],['访问令牌','access_token']]),
      enabled:'否',version:'v1.0',
      lastSyncTime:daysAgo(0,'08:12'),syncStatus:'未同步',
      connStatus:'未连接',respTime:0,lastCheckTime:'—',availability:'—',respHistory:[],
      creator:'数据管理科·王岗',createTime:'2026-02-10 11:30',updateTime:'2026-02-10 11:30'}),
    mk({accessId:'ACC-005',platformName:'省医保结算数据平台',accessType:'数据订阅',
      protocol:'FTP 文件',endpoint:'ftp://10.20.30.41:21/medins/claim/',method:'文件传输',
      authType:'国密数字证书',credential:'SM2-2026-****088',
      syncFreq:'每日',syncMode:'增量',syncTime:'每日 03:00',timeout:45,retry:3,
      fieldMap:fm([['医保结算编号','claim_no'],['诊断编码','diag_code'],['结算日期','settle_date','DATE'],['参保人编号','insured_no']]),
      enabled:'是',version:'v1.0',
      lastSyncTime:daysAgo(1,'03:05'),syncStatus:'正常',
      connStatus:'正常',respTime:512,lastCheckTime:daysAgo(0,'03:05'),availability:'98.7%',
      respHistory:[{time:daysAgo(0,'03:05'),status:'正常',respTime:512},
        {time:daysAgo(1,'03:05'),status:'正常',respTime:489}],
      creator:'管理员',createTime:'2026-10-15 16:40',updateTime:'2026-11-02 16:40'})
  ];
}
/* 接口版本种子：每个平台的当前配置 + 历史版本快照，供回滚演示 */
function seedPlatformVer(){
  var out=[], seq=0;
  var push=function(accId,version,note,time,isCurrent,cfg){
    seq++;
    out.push({verId:'VER-'+p4(seq),accessId:accId,version:version,note:note,time:time,
      operator:'管理员',isCurrent:isCurrent,snapshot:JSON.stringify(cfg)});
  };
  var mut=function(p,patch){
    var o=cfgOf(p);
    Object.keys(patch).forEach(function(k){ o[k]=patch[k]; });
    if(patch.fieldMap) o.fieldMapJson=mapJson(patch.fieldMap);
    return o;
  };
  var p1=platforms.find('ACC-001'), p2=platforms.find('ACC-002'), p5=platforms.find('ACC-005');
  if(p1){
    push('ACC-001','v1.0','首次接入（REST 上报，字段映射 3 项）',daysAgo(420,'10:00'),'否',
      mut(p1,{protocol:'HTTPS + REST',endpoint:'https://nccr.jxcdc.org/api/v1/report',method:'POST',
        syncFreq:'每周',syncMode:'全量',syncTime:'每周一 02:00',timeout:20,retry:1,
        fieldMap:fm([['登记编号','reg_no'],['姓名','name'],['ICD-10','icd10']])}));
    push('ACC-001','v1.1','补充证件号映射，协议切换为 SOAP 上报',daysAgo(210,'15:20'),'否',
      mut(p1,{protocol:'WebService（SOAP）',endpoint:'https://nccr.jxcdc.org/soap/tumorReport',timeout:25,retry:2,
        fieldMap:fm([['登记编号','reg_no'],['姓名','patient_name'],['身份证号','id_card'],['ICD-10','icd10']])}));
    push('ACC-001','v1.2','补充确诊日期映射，同步改为每月全量（当前）',daysAgo(60,'09:30'),'是',cfgOf(p1));
  }
  if(p2){
    push('ACC-002','v2.0','死因直报订阅接入（每日增量）',daysAgo(180,'14:00'),'否',
      mut(p2,{fieldMap:fm([['死亡编号','death_id'],['根本死因','cause_icd'],['死亡日期','death_date','DATE']])}));
    push('ACC-002','v2.1','补充报告机构映射（当前）',daysAgo(20,'11:00'),'是',cfgOf(p2));
  }
  if(p5){
    push('ACC-005','v1.0','医保结算 FTP 目录对接（每日增量取数，当前）',daysAgo(9,'16:40'),'是',cfgOf(p5));
  }
  return out;
}
function seedApply(){
  /* v3：申请表单精简为 申请人 / 申请机构 / 申请用途 / 数据范围 / 申请有效期 / 申请说明（全部必填）。 */
  var mk=function(id,applicant,orgName,purpose,scope,vu,mode,note,submit,node,status,comments,finish){
    return {applyId:id,applicant:applicant,applyOrg:orgName,purpose:purpose,dataScope:scope,validUntil:vu,accessMode:mode,applyNote:note,
      submitTime:submit,currentNode:node,applyStatus:status,approveComments:comments||[],finishTime:finish||'—'};
  };
  return [
    mk('SHA-2026-0031','科研岗·陈涛','南昌大学公共卫生学院','江西省主要癌种流行病学特征研究（课题编号 NSFC-8230）','江西省 / 2020-2023 年 / 全部癌种','2027-03-01','文件下载',
      '用于课题「江西省主要癌种流行病学特征研究」的发病与死亡负担分析，仅使用地市级汇总数据，不涉及任何病例级标识信息，成果仅用于学术发表。','2026-09-01 10:20','数据管理科审核','审批中',
      [{node:'数据管理科审核',approver:'数据管理科·王岗',time:'2026-09-02 09:10',result:'待审',comment:''}]),
    mk('SHA-2026-0030','监测岗·吴敏','赣州市疾控中心','赣州市癌种死亡负担专项分析','赣州市 / 2021-2023 / 消化道癌种','2026-11-18','查看权限',
      '赣州市消化道癌种死亡负担专题分析，产出仅用于内部防控工作报告，数据范围限定为 2021-2023 年死亡汇总指标。','2026-08-20 15:40','分管领导审批','审批中',
      [{node:'数据管理科审核',approver:'数据管理科·王岗',time:'2026-08-21 10:05',result:'通过',comment:'用途明确，数据范围与申请机构职能相符'},
       {node:'数据安全小组审核',approver:'数据安全小组·李组长',time:'2026-08-22 14:30',result:'通过',comment:'仅汇总数据，脱敏风险可控'},
       {node:'分管领导审批',approver:'分管领导·赵主任',time:'',result:'待审',comment:''}]),
    mk('SHA-2026-0028','随访中心·刘芳','江西省肿瘤医院','随访结局多中心协作研究（多中心随访数据交换）','南昌市 / 2022-2023 / 肺·乳腺·结直肠','2027-08-05','接口对接',
      '多中心随访协作研究的数据交换需求，需按一级脱敏策略交付并完成二次授权，数据仅限课题组成员在院内终端访问。','2026-08-05 09:00','已完结','已批准',
      [{node:'数据管理科审核',approver:'数据管理科·王岗',time:'2026-08-06 09:30',result:'通过',comment:'合作单位资质已核验'},
       {node:'数据安全小组审核',approver:'数据安全小组·李组长',time:'2026-08-07 11:15',result:'通过',comment:'需按一级脱敏策略交付并二次授权'},
       {node:'分管领导审批',approver:'分管领导·赵主任',time:'2026-08-08 16:20',result:'通过',comment:'同意，按策略执行并全程监控'}],'2026-08-08 16:20'),
    mk('SHA-2026-0025','商业公司·赵经理','某健康科技公司','商业保险理赔核验数据需求','江西省 / 2023 / 全部癌种病例级数据','2026-08-14','接口对接',
      '用于商业保险理赔核验，申请按身份证号匹配病例级明细数据，用于核验投保人申报的肿瘤诊断真实性。','2026-07-15 14:00','已完结','已驳回',
      [{node:'数据管理科审核',approver:'数据管理科·王岗',time:'2026-07-16 09:40',result:'通过',comment:'形式审查通过'},
       {node:'数据安全小组审核',approver:'数据安全小组·李组长',time:'2026-07-17 10:25',result:'驳回',comment:'申请病例级明细用于商业目的，超出最小必要原则，不予批准'}],'2026-07-17 10:25'),
    mk('SHA-2026-0022','年报编制岗·张倩','江西省疾控中心登记处','国家年报编制对照数据核验','江西省 / 2023 / 全部癌种汇总','2026-09-02','查看权限',
      '国家年报编制前的数据交叉核验，仅使用全省汇总指标与年报统计表数据，用于与国家平台反馈数据比对。','2026-07-02 08:50','已完结','已批准',
      [{node:'数据管理科审核',approver:'数据管理科·王岗',time:'2026-07-03 09:00',result:'通过',comment:'内部处室按简化流程办理'},
       {node:'数据安全小组审核',approver:'数据安全小组·李组长',time:'2026-07-03 15:10',result:'通过',comment:'汇总数据，同意'},
       {node:'分管领导审批',approver:'分管领导·赵主任',time:'2026-07-04 10:00',result:'通过',comment:'同意'}],'2026-07-04 10:00')
  ];
}
function seedPolicy(){
  var mk=function(id,name,applicant,org,pages,days,enabled,creator,effect,maskLevel,allowFields,denyFields,granularity,authType,version){
    return {policyId:id,policyName:name,applicant:applicant,applyOrg:org,pages:pages,
      validUntil:plusDays(days),enabled:enabled,creator:creator,effectTime:effect,
      maskLevel:maskLevel,allowFields:allowFields,denyFields:denyFields,
      granularity:granularity,authType:authType,version:version||'v1.0'};
  };
  return [
    mk('P-2026-001','访问授权·南昌大学公共卫生学院','科研岗·陈涛','南昌大学公共卫生学院',['ar-tasks','datamgmt-card'],180,'是','数据安全小组·李组长','2026-09-05 10:00',
      '去标识化',['登记编号','性别','年龄组','发病部位','ICD-10','确诊日期','诊断依据'],['姓名','身份证号','户籍地址'],'市级','OAuth 2.0','v1.0'),
    mk('P-2026-002','访问授权·江西省肿瘤医院','随访中心·刘芳','江西省肿瘤医院',['followup-records'],365,'是','数据安全小组·李组长','2026-08-10 11:20',
      '匿名化',['登记编号','性别','年龄组','随访状态','生存月数','最后接触日期'],['姓名','身份证号'],'区县级','API Key','v1.1'),
    mk('P-2026-003','访问授权·赣州市疾控中心','监测岗·吴敏','赣州市疾控中心',['death-records','ar-tasks'],90,'否','数据管理科·王岗','2026-08-25 09:30',
      '去标识化',['死亡编号','性别','年龄组','根本死因','死因ICD10编码','死亡日期'],['姓名','身份证号','户籍地址'],'省级','国密数字证书','v1.0')
  ];
}
/* 策略版本历史种子：每个策略的当前配置 + 历史版本快照，供回滚演示 */
function seedPolicyVer(){
  var out=[], seq=0;
  var push=function(policyId,version,note,time,isCurrent,cfg){
    seq++;
    out.push({verId:'PVER-'+p4(seq),policyId:policyId,version:version,note:note,time:time,
      operator:'数据安全小组·李组长',isCurrent:isCurrent,snapshot:JSON.stringify(cfg)});
  };
  policies.all().forEach(function(p){
    push(p.policyId,p.version,'初始版本',p.effectTime,'是',policyCfgOf(p));
  });
  /* 给 P-2026-002 追加一个历史版本（v1.0 → v1.1 演进） */
  var p2=policies.find('P-2026-002');
  if(p2){
    var old=policyCfgOf(p2); old.maskLevel='去标识化'; old.version='v1.0';
    push('P-2026-002','v1.0','初始版本（去标识化）','2026-07-20 09:00','否',old);
  }
  return out;
}

function seedDelivery(){
  var mk=function(id,applyId,policyId,deliv,ep,sbx,path,fmt,rec,size,tk,expire,url,gen,tkStatus,rvk){
    return {deliveryId:id,applyId:applyId,policyId:policyId,deliveryType:deliv,apiEndpoint:ep,sandboxId:sbx,filePath:path,fileFormat:fmt,
      recordCount:rec,sizeKb:size,token:tk,tokenStatus:tkStatus||'有效',tokenExpire:expire,revokedTime:rvk||'—',downloadUrl:url,genTime:gen};
  };
  return [
    mk('SHD-2026-0018','SHA-2026-0028','P-科研脱敏','接口推送','https://share.jxcdc.org/api/v1/delivery/SHD-2026-0018/push','SBX-2317',
     '/share/2026/SHD-2026-0018/multicenter_followup.json','JSON',860,301.4,genToken('SHD-2026-0018'),plusDays(6,'23:59'),'https://share.jxcdc.org/api/v1/delivery/SHD-2026-0018/download',daysAgo(7,'11:20')),
    mk('SHD-2026-0019','SHA-2026-0022','P-汇总数据','文件下载','https://share.jxcdc.org/api/v1/delivery/SHD-2026-0019','SBX-1082',
     '/share/2026/SHD-2026-0019/annual_2023_summary.csv','CSV',1240,452.8,genToken('SHD-2026-0019'),plusDays(2,'23:59'),'https://share.jxcdc.org/api/v1/delivery/SHD-2026-0019/download',daysAgo(30,'09:40')),
    mk('SHD-2026-0017','SHA-2026-0028','P-科研脱敏','沙箱取数','https://sandbox.jxcdc.org/v1/SHD-2026-0017/query','SBX-2317',
     '/sandbox/SHD-2026-0017/dataset','JSON',860,298.6,genToken('SHD-2026-0017'),daysAgo(2,'23:59'),'https://sandbox.jxcdc.org/v1/SHD-2026-0017/download',daysAgo(40,'16:00'))
  ];
}
function seedMonitor(){
  var mk=function(id,deliv,user,ip,tm,otp,params,rc,abn,risk,apv,rm,hs,hb,ht,hn){
    return {monitorId:id,deliveryId:deliv,userId:user,ip:ip,accessTime:tm,opType:otp,accessParams:params,rowCount:rc,
      abnormal:abn,riskLevel:risk,approvalId:apv,remark:rm,
      handleStatus:hs||'',handleBy:hb||'—',handleTime:ht||'—',handleNote:hn||''};
  };
  var d18='SHD-2026-0018',d19='SHD-2026-0019',d17='SHD-2026-0017';
  return [
    mk('MON-0032',d18,'南昌大学·陈涛','210.35.240.17',daysAgo(1,'14:22'),'查询','{"field":["登记编号","ICD-10","随访状态"],"filter":{"site":"C34"}}',86,'否','低','SHA-2026-0028','合作研究例行取数'),
    mk('MON-0031',d19,'南昌大学·陈涛','210.35.240.17',daysAgo(2,'09:05'),'下载','{"file":"annual_2023_summary.csv"}',1240,'否','低','SHA-2026-0022','下载年报汇总包'),
    mk('MON-0030',d17,'某商业公司·赵经理','117.136.88.203',daysAgo(3,'22:41'),'令牌验证失败','{"token":"expired"}',0,'是','高','SHA-2026-0028','使用已过期令牌反复尝试访问（4 次），已自动拦截',
      '已处置','数据安全小组·李组长',daysAgo(3,'23:30'),'已封禁来源 IP 并函告机构核查'),
    mk('MON-0029',d18,'省科研平台·系统','58.20.150.9',daysAgo(4,'02:10'),'批量拉取','{"page_size":1000,"pages":6}',6000,'是','高','SHA-2026-0028','单次拉取 6000 条，超出策略单次上限 500 条，触发限流告警','未处置'),
    mk('MON-0028',d18,'南昌大学·陈涛','210.35.240.19',daysAgo(5,'10:33'),'查询','{"field":["登记编号","身份证号"]}',0,'是','中','SHA-2026-0028','请求字段包含策略禁止字段「身份证号」，已按策略过滤并告警',
      '已处置','数据管理科·王岗',daysAgo(5,'11:00'),'策略自动过滤，已复核为接口字段配置错误'),
    mk('MON-0027',d19,'某健康科技公司·赵经理','117.136.88.156',daysAgo(6,'15:48'),'下载','{"file":"annual_2023_summary.csv"}',1240,'否','中','SHA-2026-0022','非白名单机构首次下载，已留痕待确认',
      '已忽略','数据安全小组·李组长',daysAgo(6,'16:20'),'确认属公开汇总策略口径，白名单不限制下载'),
    mk('MON-0026',d18,'南昌大学·陈涛','210.35.240.17',daysAgo(7,'16:20'),'查询','{"field":["登记编号","随访状态"],"filter":{"site":"C50"}}',112,'否','低','SHA-2026-0028','合作研究例行取数'),
    mk('MON-0025',d19,'年报编制岗·张倩','192.168.1.156',daysAgo(8,'11:30'),'下载','{"file":"annual_2023_summary.csv"}',1240,'否','低','SHA-2026-0022','内部核验下载')
  ];
}
function seedLineage(){
  var mk=function(id,pid,plat,table,cn,en,dtype,sev,pii,rule,freq,path,upd,desc){
    return {metaId:id,sourcePlatformId:pid,sourcePlatform:plat,srcTable:table,fieldCn:cn,fieldEn:en,dataType:dtype,sensLevel:sev,isPii:pii,
      maskRule:rule,updateFreq:freq,lineagePath:path,lastUpdate:upd,fieldDesc:desc||'—'};
  };
  var P1='ACC-001',P2='ACC-002',P3='ACC-003';
  var N1='国家癌症中心肿瘤登记平台',N2='省死因监测直报系统',N3='省卫健委健康云平台';
  var L1=N1+'.report_card → ODS.ods_report_card → DWD.dwd_tumor_case → DWS.dws_site_stat → 共享交付层.share_v_case_summary';
  var L2=N2+'.death_record → ODS.ods_death_record → DWD.dwd_death_cause → DWS.dws_death_stat → 共享交付层.share_v_death_summary';
  var L3=N3+'.patient_index → ODS.ods_patient_index → DWD.dwd_tumor_case → DWS.dws_follow_stat → 共享交付层.share_v_followup';
  /* 报告卡登记全部字段（发病人口信息 20 · 肿瘤报告信息 19 · 随访报告信息 8）：
     [字段名, 英文标识, 数据类型, 敏感等级, 是否个人标识, 脱敏规则, 字段含义] */
  var RC=[
    ['登记编号','reg_no','STRING','L2 内部','否','哈希脱敏','肿瘤登记报告卡唯一编号，用于关联报告卡全生命周期记录'],
    ['记录类型','record_type','STRING','L2 内部','否','不适用','报告卡业务类型（发病卡 / 死亡卡 / 随访卡）'],
    ['姓名','patient_name','STRING','L4 高敏感','是','姓名掩码','患者真实姓名，用于身份核对与随访联系'],
    ['其他证件','other_id_type','STRING','L3 敏感','否','数值抑制','除身份证外的证件类型（如护照、军官证）'],
    ['身份证号码','id_card','STRING','L4 高敏感','是','身份证分段掩码','患者居民身份证号，跨报告卡查重合并的唯一身份依据'],
    ['性别','gender','STRING','L2 内部','否','不适用','患者性别（男 / 女）'],
    ['出生日期','birth_date','DATE','L3 敏感','否','出生日期泛化','患者出生日期，用于计算年龄与队列分组'],
    ['年龄','age','NUMBER','L3 敏感','否','数值抑制','确诊时周岁年龄，年龄别发病率统计基础'],
    ['联系电话','phone','STRING','L4 高敏感','是','数值抑制','患者本人联系电话，随访与数据核实联系方式'],
    ['联系人关系','contact_relation','STRING','L3 敏感','否','不适用','联系人与患者的关系（家属 / 监护人等）'],
    ['联系人','contact_name','STRING','L4 高敏感','是','姓名掩码','紧急联系人姓名，随访替代联系渠道'],
    ['联系人电话','contact_phone','STRING','L4 高敏感','是','数值抑制','紧急联系人电话号码'],
    ['民族','ethnicity','STRING','L3 敏感','否','不适用','患者民族，登记分层统计维度'],
    ['婚姻状况','marital_status','STRING','L3 敏感','否','不适用','患者婚姻状况，生存分析协变量'],
    ['职业','occupation','STRING','L3 敏感','否','不适用','患者职业类别，职业暴露与危险因素分析参考'],
    ['工作单位','work_unit','STRING','L3 敏感','否','数值抑制','患者工作单位名称'],
    ['户籍地址','household_addr','STRING','L4 高敏感','是','数值抑制','患者户籍所在地行政区划，用于地区归口统计'],
    ['户籍详细地址','household_addr_detail','STRING','L4 高敏感','是','数值抑制','户籍详细门牌地址'],
    ['常住地址','residence_addr','STRING','L4 高敏感','是','数值抑制','患者实际常住地行政区划，用于常住口径归口'],
    ['常住详细地址','residence_addr_detail','STRING','L4 高敏感','是','数值抑制','常住详细门牌地址'],
    ['发病部位','primary_site','STRING','L2 内部','否','不适用','肿瘤原发部位（解剖学部位）'],
    ['亚部位','sub_site','STRING','L2 内部','否','不适用','原发部位的亚部位细分'],
    ['病理类型','pathology_type','STRING','L2 内部','否','不适用','组织病理学类型（如腺癌、鳞癌）'],
    ['肿瘤解剖学部位代码（ICD-O-3）','icd_o3_topography','STRING','L2 内部','否','不适用','ICD-O-3 解剖学部位编码（T 位）'],
    ['肿瘤形态学代码（ICD-O-3）','icd_o3_morphology','STRING','L2 内部','否','不适用','ICD-O-3 形态学编码（M 位）'],
    ['行为','behavior_code','STRING','L2 内部','否','不适用','肿瘤行为编码（良性 / 原位 / 恶性等）'],
    ['分级','grade','STRING','L2 内部','否','不适用','肿瘤组织学分级（高 / 中 / 低分化）'],
    ['诊断依据','diag_basis','STRING','L2 内部','否','不适用','诊断依据级别（临床 / 病理 / 影像等），反映确诊可靠性'],
    ['临床分期','clinical_stage','STRING','L2 内部','否','不适用','临床分期（Ⅰ~Ⅳ期），表示肿瘤进展程度'],
    ['TNM分期','tnm_stage','STRING','L2 内部','否','不适用','国际 TNM 分期（T / N / M 组合）'],
    ['确诊日期','diag_date','DATE','L3 敏感','否','出生日期泛化','基于病理或临床证据的确诊日期'],
    ['ICD10','icd10','STRING','L2 内部','否','不适用','国际疾病分类第 10 版编码'],
    ['治疗信息','treatment','STRING','L3 敏感','否','不适用','接受的治疗方式（手术 / 放化疗等）'],
    ['诊断结果','diagnosis_result','STRING','L3 敏感','否','不适用','诊断结论（恶性 / 良性 / 疑似等）'],
    ['详细诊断结果','diagnosis_detail','STRING','L3 敏感','否','不适用','诊断结论的详细描述'],
    ['住院号','inpatient_no','STRING','L4 高敏感','是','哈希脱敏','诊断医院住院病案号'],
    ['门诊号','outpatient_no','STRING','L4 高敏感','是','哈希脱敏','诊断医院门诊号'],
    ['报告日期','report_date','DATE','L2 内部','否','不适用','报告卡填报日期，报告时效考核依据'],
    ['报告医师','report_doctor','STRING','L3 敏感','是','姓名掩码','报告卡填报医师姓名'],
    ['最后接触日期','last_contact_date','DATE','L3 敏感','否','不适用','随访中最后一次确认患者状态的时间'],
    ['最后接触状态','last_contact_state','STRING','L3 敏感','否','不适用','最后接触时的生存状态（存活 / 死亡 / 失访）'],
    ['生存月数','survival_months','NUMBER','L3 敏感','否','数值抑制','确诊至最后接触的生存月数，生存率计算基础'],
    ['死亡地点','death_place','STRING','L3 敏感','否','不适用','患者死亡地点（医院 / 家中 / 其他）'],
    ['根本死因','underlying_cause','STRING','L2 内部','否','不适用','直接导致死亡的根本疾病原因'],
    ['死因ICD10编码','cause_icd10','STRING','L2 内部','否','不适用','根本死因的 ICD-10 编码'],
    ['死亡日期','death_date','DATE','L3 敏感','否','不适用','患者死亡日期，死亡补发病匹配依据'],
    ['死亡报告医师','death_report_doctor','STRING','L3 敏感','是','姓名掩码','死亡卡填报医师姓名']
  ];
  var out=[],seq=0,upd=daysAgo(1,'06:00');
  RC.forEach(function(f){
    seq++;
    out.push(mk('META-'+p4(seq),P1,N1,'report_card',f[0],f[1],f[2],f[3],f[4],f[5],'实时',L1,upd,f[6]));
  });
  out.push(mk('META-'+p4(++seq),P2,N2,'death_record','死亡编号','death_id','STRING','L2 内部','否','哈希脱敏','每日',L2,upd,'死因监测系统的死亡记录唯一编号'));
  out.push(mk('META-'+p4(++seq),P2,N2,'death_record','根本死因','cause_icd','STRING','L2 内部','否','不适用','每日',L2,upd,'死因监测系统登记的根本死因编码（ICD-10）'));
  out.push(mk('META-'+p4(++seq),P2,N2,'death_record','死亡日期','death_date','DATE','L3 敏感','否','出生日期泛化','每日',L2,upd,'死因监测系统登记的死亡日期'));
  out.push(mk('META-'+p4(++seq),P3,N3,'patient_index','患者主索引','patient_id','STRING','L4 高敏感','是','哈希脱敏','每周',L3,daysAgo(4,'23:00'),'区域健康云患者主索引号，跨系统身份关联主键'));
  out.push(mk('META-'+p4(++seq),P3,N3,'patient_index','随访状态','follow_state','STRING','L3 敏感','否','数值抑制','每周',L3,daysAgo(4,'23:00'),'健康云随访管理状态（在管 / 失访等）'));
  out.push(mk('META-'+p4(++seq),P3,N3,'patient_index','生存月数','survival_months','NUMBER','L3 敏感','否','数值抑制','每周',L3,daysAgo(4,'23:00'),'健康云计算的确诊后生存月数'));
  return out;
}
function seedTrail(){
  var mk=function(id,t,rid,desc,before,after){
    return {logId:id,opType:t,relatedId:rid,operator:op(),time:daysAgo(9,'16:00'),ip:'192.168.1.100',terminal:'Web端',
      desc:desc,before:before||'',after:after||''};
  };
  return [
    mk('SHT-0006','新增','ACC-004','新增外部平台接入「省医学科研数据共享平台」','','{"accessId":"ACC-004","enabled":"否"}'),
    mk('SHT-0005','审批','SHA-2026-0028','三级审批全部通过，申请批准','{"applyStatus":"审批中"}','{"applyStatus":"已批准"}'),
    mk('SHT-0004','交付','SHD-2026-0018','按策略「P-科研脱敏」生成交付凭证','','{"deliveryId":"SHD-2026-0018"}'),
    mk('SHT-0003','吊销','SHD-2026-0016','吊销过期交付的访问令牌','{"tokenStatus":"有效"}','{"tokenStatus":"已吊销"}'),
    mk('SHT-0002','处置','MON-0030','处置高风险异常：封禁来源 IP','{"handleStatus":"未处置"}','{"handleStatus":"已处置"}'),
    mk('SHT-0001','新增','P-死亡交换','新建共享策略「死因数据双向交换策略」','','{"policyId":"P-死亡交换","enabled":"是"}')
  ];
}
/* 令牌：32 位十六进制（由 id 确定性派生，4 段 × 8 位） */
function genToken(id){
  var t='',h=id+'#token';
  for(var i=0;i<4;i++){ var v=hash(h+i).toString(16); while(v.length<8)v='0'+v; t+=v; }
  return t;
}

/* ---------- 存储实例 ---------- */
var platforms=store('platform',seedPlatform,'accessId');
var platformVer=store('platformVer',seedPlatformVer,'verId');
var applies=store('apply',seedApply,'applyId');
var policies=store('policy',seedPolicy,'policyId');
var policyVer=store('policyVer',seedPolicyVer,'verId');
var deliveries=store('delivery',seedDelivery,'deliveryId');
var monitors=store('monitor',seedMonitor,'monitorId');
var lineages=store('lineage',seedLineage,'metaId');
var trails=store('trail',seedTrail,'logId');

/* 清理历史授权数据中已下线页面的白名单（保证 pages 只含 ACCESS_PAGES 内有效页面） */
(function(){
  var ids=ACCESS_PAGES.map(function(p){ return p.id; });
  var changed=false;
  policies.all().forEach(function(p){
    if(!Array.isArray(p.pages)) return;
    var kept=p.pages.filter(function(pid){ return ids.indexOf(pid)>=0; });
    if(kept.length!==p.pages.length){ p.pages=kept; changed=true; }
  });
  if(changed) policies.save();
})();

/* ---------- 审计（shAudit，上限 300 条） ---------- */
function nextTrailId(){
  var mx=0; trails.all().forEach(function(l){ var m=/SHT-(\d+)/.exec(String(l.logId)); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
  return 'SHT-'+p4(mx+1);
}
function shAudit(opType,relatedId,desc,before,after){
  try{
    var logs=trails.all();
    logs.unshift({logId:nextTrailId(),opType:opType,relatedId:relatedId,operator:op(),time:now(),ip:'192.168.1.100',terminal:'Web端',
      desc:desc,before:before?JSON.stringify(before):'',after:after?JSON.stringify(after):''});
    if(logs.length>300) logs.length=300;
    trails.save();
  }catch(e){}
}

/* ---------- 渲染工具 ---------- */
function bText(s,type){ return '<span class="badge '+(type||'badge-muted')+'">'+esc(s)+'</span>'; }
function stBadge(s){
  var t='badge-muted';
  if(['正常','已批准','通过','已完成','是','启用','生效中','有效','已处置','已忽略'].indexOf(s)>=0) t='badge-success';
  else if(['审批中','待审','排队中','未同步','中','否','未处置'].indexOf(s)>=0) t='badge-warning';
  else if(['异常','已驳回','驳回','高','已吊销','过期','失效','已过期','已撤销'].indexOf(s)>=0) t='badge-danger';
  else if(s==='低') t='badge-success';
  return '<span class="badge '+t+'">'+esc(s)+'</span>';
}
function riskBadge(s){ return bText(s,s==='高'?'badge-danger':(s==='中'?'badge-warning':'badge-success')); }
function piiBadge(s){ return bText(s,s==='是'?'badge-danger':'badge-muted'); }
function sensBadge(s){
  if(s==='L4 高敏感') return '<span class="badge badge-danger">'+esc(s)+'</span>';
  if(s==='L3 敏感') return '<span class="badge badge-warning">'+esc(s)+'</span>';
  if(s==='L2 内部') return '<span class="badge badge-info">'+esc(s)+'</span>';
  return '<span class="badge badge-success">'+esc(s)+'</span>';
}
function tbl(headers,rows,minW){
  return '<div class="table-wrap"><table class="data-table" style="min-width:'+(minW||1200)+'px"><thead><tr>'+
    headers.map(function(h){ return '<th>'+h+'</th>'; }).join('')+'</tr></thead><tbody>'+
    (rows||('<tr><td colspan="'+headers.length+'" style="text-align:center;padding:30px;color:#94a3b8">暂无数据</td></tr>'))+
    '</tbody></table></div>';
}
function shPage(title,actions,body){
  return '<div class="page-toolbar"><div class="toolbar-actions">'+(actions||'')+'</div></div>'+
    '<div class="panel"><div class="panel-header">'+title+'</div><div class="panel-body">'+body+'</div></div>';
}
function kv(rows){
  return '<div class="sh-kv">'+rows.map(function(r){ return '<div class="k">'+r[0]+'</div><div class="v">'+esc(r[1])+'</div>'; }).join('')+'</div>';
}
function chip(text,type){ return '<span class="sh-chip '+(type||'')+'">'+esc(text)+'</span>'; }
var shFilters={};
function shF(page,key){ return (shFilters[page]||{})[key]||''; }
window.shSetFilter=function(page,key,val){ shFilters[page]=shFilters[page]||{}; shFilters[page][key]=val; renderPage(page); };
window.shResetFilter=function(page){ delete shFilters[page]; renderPage(page); };
function kwInput(page,placeholder){
  return '<div class="form-group search-group"><label>关键字</label><input value="'+esc(shF(page,'kw'))+'" placeholder="'+placeholder+'" onchange="shSetFilter(\''+page+'\',\'kw\',this.value)"></div>';
}
function filterBar(page,controls,extra){
  return '<div class="filter-toolbar">'+(controls||'')+'<div class="filter-actions"><button class="btn btn-ghost btn-sm" onclick="shResetFilter(\''+page+'\')">重置</button>'+(extra||'')+'</div></div>';
}

/* ---------- 弹窗 ---------- */
window.shCloseModal=function(btn){ var m=btn&&btn.closest?btn.closest('.news-confirm-modal'):null; if(m)m.remove(); };
function closeTopModal(){ try{ var list=document.querySelectorAll('.news-confirm-modal'); if(list&&list.length&&list[list.length-1].remove) list[list.length-1].remove(); }catch(e){} }
function modal(title,body,foot){
  var m=document.createElement('div'); m.className='news-confirm-modal';
  m.innerHTML='<div class="news-confirm-box sh-modal-box"><div class="news-confirm-title">'+title+'</div><div class="news-confirm-body sh-modal-body">'+body+'</div><div class="news-confirm-actions">'+(foot||'<button class="btn btn-ghost" onclick="shCloseModal(this)">关闭</button>')+'</div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){ if(e.target===m)m.remove(); });
  return m;
}
function fv(id){ var elx=document.getElementById(id); return elx?String(elx.value===undefined?'':elx.value).trim():''; }
function chkVals(name){ var out=[]; try{ (document.querySelectorAll('input[name="'+name+'"]:checked')||[]).forEach(function(c){ out.push(c.value); }); }catch(e){} return out; }
/* 勾选组：PII 字段自动带红色标记 */
function chkGroup(name,opts,checked){
  return '<div class="sh-chk">'+opts.map(function(o){
    var pii=PII_FIELDS.indexOf(o)>=0;
    return '<label><input type="checkbox" name="'+name+'" value="'+esc(o)+'"'+(checked.indexOf(o)>=0?' checked':'')+'>'+esc(o)+(pii?'<span class="pii">PII</span>':'')+'</label>';
  }).join('')+'</div>';
}
/* 审批轨迹时间线 */
function timeline(a){
  return '<div class="sh-tl">'+a.approveComments.map(function(c){
    var cls=c.result==='通过'?'done':(c.result==='驳回'?'fail':(c.result==='待审'?'cur':''));
    return '<div class="tl-item '+cls+'"><span class="dot"></span>'+
      '<div class="tl-meta"><b>'+esc(c.approver)+'</b>（'+esc(c.node)+'）· '+(c.time?esc(c.time):'待审')+' · '+bText(c.result,c.result==='通过'?'badge-success':(c.result==='驳回'?'badge-danger':'badge-warning'))+'</div>'+
      (c.comment?'<div class="tl-body">'+esc(c.comment)+'</div>':'')+
    '</div>';
  }).join('')+'</div>';
}
function realDownload(fileName,mime,text,noBom){
  try{
    var blob=new Blob([noBom?text:("\ufeff"+text)],{type:mime||'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fileName;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },200);
    return true;
  }catch(e){ return false; }
}

/* ---------- 页面：外部平台对接与数据接入配置（功能点18） ---------- */

/* --- 表单元件 --- */
function fField(label,ctrl,hint,full){
  return '<div class="sh-field'+(full?' full':'')+'"><label>'+label+'</label>'+ctrl+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
}
function fSel(id,opts,val){
  return '<select id="'+id+'">'+opts.map(function(o){ return '<option'+(String(o)===String(val)?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>';
}
function csvCell(v){
  var s=String(v===undefined||v===null?'':v);
  return '"'+s.replace(/"/g,'""')+'"';
}

/* --- 接口状态 / 统计 --- */
function mapCount(p){ return (p.fieldMap||[]).length; }
function connBadge(p){
  var s=p.connStatus||'未连接';
  var t=s==='正常'?'badge-success':(s==='异常'?'badge-danger':'badge-muted');
  return '<span class="badge '+t+'">'+esc(s)+'</span>'+
    (p.respTime>0?'<br><span class="sh-sub">'+esc(p.respTime)+' ms</span>':'');
}
/* --- 版本：保存当前配置快照 --- */
function addVersion(p,note,forceVer){
  var list=platformVer.all();
  var used=list.filter(function(x){ return x.accessId===p.accessId; }).map(function(x){ return x.version; });
  var v=forceVer||bumpVersion(p.version), guard=0;
  while(!forceVer&&used.indexOf(v)>=0&&guard<60){ v=bumpVersion(v); guard++; }
  var mx=0;
  list.forEach(function(x){ var m=/VER-(\d+)/.exec(String(x.verId)); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
  list.forEach(function(x){ if(x.accessId===p.accessId) x.isCurrent='否'; });
  list.unshift({verId:'VER-'+p4(mx+1),accessId:p.accessId,version:v,note:note||'配置变更',
    time:now(),operator:op(),isCurrent:'是',snapshot:JSON.stringify(cfgOf(p))});
  p.version=v;
  platformVer.save();
  return v;
}

/* --- 操作栏：符号按钮 + 展开菜单 ---
   表格容器 .table-wrap 是 overflow:auto，absolute 浮层会被裁掉，
   因此菜单用 position:fixed 挂到 body，按按钮位置贴边展开。 */
var shMenuEl=null;
function shMenuClose(){
  if(!shMenuEl) return;
  var btn=shMenuEl.__btn;
  if(btn&&btn.className) btn.className=String(btn.className).replace(/\s*on(?=\s|$)/,'');
  if(shMenuEl.parentNode) shMenuEl.parentNode.removeChild(shMenuEl);
  shMenuEl=null;
}
function shMenuDocClose(e){
  if(!shMenuEl) return;
  if(e&&shMenuEl.contains&&shMenuEl.contains(e.target)) return;
  shMenuClose();
}
window.shPlatMenu=function(ev,id){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  var p=platforms.find(id); if(!p) return false;
  /* 同一个按钮再次点击＝收起 */
  if(shMenuEl&&shMenuEl.__id===id){ shMenuClose(); return false; }
  shMenuClose();
  var items=[
    {t:'编辑接口配置',a:'edit'},
    {t:'字段映射规则',a:'map'},
    {t:'版本与回滚',a:'ver'},
    {t:'状态监控',a:'monitor'},
    {t:p.enabled==='是'?'停用接口':'启用接口',a:'toggle'},
    {t:'删除接口',a:'del',danger:true}
  ];
  var m=document.createElement('div');
  m.className='sh-menu';
  m.__id=id;
  m.innerHTML='<div class="sh-menu-h">'+esc(id)+'</div>'+items.map(function(it){
    return '<div class="sh-menu-item'+(it.danger?' danger':'')+'" onclick="shPlatAct(\''+it.a+'\',\''+id+'\')">'+esc(it.t)+'</div>';
  }).join('');
  document.body.appendChild(m);
  shMenuEl=m;
  /* 定位：默认贴按钮右下方，越界则上翻 / 左移 */
  var btn=ev&&ev.currentTarget;
  if(btn&&btn.getBoundingClientRect){
    var r=btn.getBoundingClientRect();
    if(btn.className&&!/\bon\b/.test(btn.className)) btn.className+=' on';
    m.__btn=btn;
    var w=m.offsetWidth||172, h=m.offsetHeight||230;
    var left=r.right-w, top=r.bottom+6;
    if(left<8) left=8;
    if(left+w>window.innerWidth-8) left=Math.max(8,window.innerWidth-w-8);
    if(top+h>window.innerHeight-8) top=Math.max(8,r.top-h-6);
    m.style.left=left+'px';
    m.style.top=top+'px';
  }
  return true;
};
window.shPlatAct=function(act,id){
  shMenuClose();
  if(act==='edit') return window.shPlatEdit(id);
  if(act==='map') return window.shPlatMap(id);
  if(act==='ver') return window.shPlatVer(id);
  if(act==='monitor') return window.shPlatMonitor(id);
  if(act==='toggle') return window.shPlatToggle(id);
  if(act==='del') return window.shPlatDel(id);
};
try{
  document.addEventListener('click',shMenuDocClose,false);
  window.addEventListener('scroll',function(){ shMenuClose(); },true);
  window.addEventListener('resize',function(){ shMenuClose(); });
}catch(e){}

/* --- 页面：外部平台对接与数据接入配置 --- */
function renderPlatform(){
  var page='sh-platform';
  var kw=(shF(page,'kw')||'').toLowerCase();
  var pf=shF(page,'pf'), cf=shF(page,'cf'), ef=shF(page,'ef');
  var all=platforms.all();
  var rows=all.filter(function(p){
      if(pf&&p.protocol!==pf) return false;
      if(cf&&(p.connStatus||'未连接')!==cf) return false;
      if(ef&&((ef==='是')!==(p.enabled==='是'))) return false;
      if(kw&&[p.accessId,p.platformName,p.endpoint,p.accessType,p.authType].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    }).map(function(p){
      var ops='<button class="sh-ops-btn" title="更多操作" aria-label="更多操作" onclick="shPlatMenu(event,\''+p.accessId+'\')">⋯</button>';
      return '<tr>'+
        '<td>'+esc(p.accessId)+'<br><span class="sh-mono">'+esc(p.version||'—')+'</span></td>'+
        '<td style="white-space:normal;min-width:170px"><b>'+esc(p.platformName)+'</b><br><span class="sh-sub">'+esc(p.accessType)+'</span></td>'+
        '<td style="white-space:normal;min-width:230px;max-width:320px"><span class="sh-mono">'+esc(p.protocol)+'</span><br><span class="sh-mono" style="color:#64748b">'+esc(p.endpoint)+'</span></td>'+
        '<td>'+esc(p.authType)+'</td>'+
        '<td style="white-space:normal;min-width:150px">'+esc(p.syncFreq)+'<br><span class="sh-sub">'+esc(p.syncMode||'—')+' · '+esc(p.syncTime||'—')+'</span></td>'+
        '<td>'+(mapCount(p)?'<b>'+mapCount(p)+'</b> 项':'<span style="color:#94a3b8">未配置</span>')+'</td>'+
        '<td>'+connBadge(p)+'<br><span class="sh-sub">'+esc(p.lastCheckTime||'—')+'</span></td>'+
        '<td>'+stBadge(p.enabled==='是'?'启用':'停用')+'</td>'+
        '<td class="sticky-col">'+ops+'</td></tr>';
    }).join('');
  var filterHtml=filterBar(page,kwInput(page,'接入ID / 平台名称 / 接口地址 / 认证')+
    '<div class="form-group"><label>接口协议</label><select onchange="shSetFilter(\''+page+'\',\'pf\',this.value)"><option value="">全部</option>'+
      PROTOCOL.map(function(s){ return '<option'+(pf===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></div>'+
    '<div class="form-group"><label>连接状态</label><select onchange="shSetFilter(\''+page+'\',\'cf\',this.value)"><option value="">全部</option>'+
      CONN_STATUS.map(function(s){ return '<option'+(cf===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></div>'+
    '<div class="form-group"><label>启用状态</label><select onchange="shSetFilter(\''+page+'\',\'ef\',this.value)"><option value="">全部</option>'+
      '<option value="是"'+(ef==='是'?' selected':'')+'>已启用</option><option value="否"'+(ef==='否'?' selected':'')+'>已停用</option></select></div>');
  var headers=['接入ID / 版本','平台名称 / 对接类型','接口协议 / 接口地址','认证方式','同步频率','字段映射','连接状态 / 最近检测','启用状态','操作'];
  var body=filterHtml+tbl(headers,rows,1750);
  var hdrOps='<button class="btn btn-primary btn-sm" onclick="shPlatEdit(\'\')">新建接口配置</button> '+
    '<button class="btn btn-outline btn-sm" onclick="shPlatCheckAll()">检测全部接口</button> '+
    '<button class="btn btn-outline btn-sm" onclick="shPlatExportDlg()">导出接口配置</button>';
  return '<div class="panel"><div class="panel-header sh-apply-hdr"><span>外部平台对接与数据接入配置</span><span class="sh-hdr-ops">'+hdrOps+'</span></div><div class="panel-body">'+body+'</div></div>';
}

/* --- 接口配置：定义协议 / 同步频率 / 认证 --- */
window.shPlatEdit=function(id){
  var p=id?platforms.find(id):null;
  var d=p||{accessType:'数据订阅',protocol:'HTTPS + REST',method:'GET',authType:'API Key',
    syncFreq:'每日',syncMode:'增量',timeout:30,retry:3,enabled:'是'};
  modal('<span class="tt-tag">'+(p?'编辑':'新建')+'</span>接口配置'+(p?' · '+esc(p.accessId):''),
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>接口协议定义传输协议与接口地址，并设置同步频率（实时 / 每日 / 每周 / 每月）、增量或全量及同步时点；保存后自动生成接口版本，可在「版本」中回滚。</span></div>'+
    '<div class="sh-form">'+
      fField('平台名称<span class="req">*</span>','<input id="sh-pl-name" value="'+esc(p?p.platformName:'')+'" placeholder="如：省医保结算数据平台">','外部系统全称')+
      fField('对接类型<span class="req">*</span>',fSel('sh-pl-type',ACCESS_TYPES,d.accessType),'数据上报 / 订阅 / 双向交换 / 接口查询')+
      fField('接口协议<span class="req">*</span>',fSel('sh-pl-proto',PROTOCOL,d.protocol),'HTTP / HTTPS / FTP / SFTP / SOAP / FHIR / MQ')+
      fField('请求方法',fSel('sh-pl-method',REQ_METHODS,d.method||'GET'),'FTP 取数选「文件传输」')+
      fField('接口地址<span class="req">*</span>','<input id="sh-pl-ep" value="'+esc(p?p.endpoint:'')+'" placeholder="https://host/path 或 ftp://host:21/path">','HTTP 需 http(s):// 前缀；FTP 需 ftp:// 或 sftp:// 前缀（含端口与目录）',true)+
      fField('认证方式',fSel('sh-pl-auth',AUTH_TYPE,d.authType))+
      fField('认证凭证','<input id="sh-pl-cred" value="'+esc(p?p.credential:'')+'" placeholder="仅保存摘要，如 SM2-2025-****317">','完整密钥由凭证库托管，此处仅留摘要')+
      fField('同步频率<span class="req">*</span>',fSel('sh-pl-freq',SYNC_FREQ,d.syncFreq))+
      fField('同步方式',fSel('sh-pl-smode',SYNC_MODES,d.syncMode||'增量'),'增量＝仅取变更；全量＝整表覆盖')+
      fField('同步时点','<input id="sh-pl-stime" value="'+esc(p?p.syncTime:'')+'" placeholder="如：每日 03:00 / 每周一 02:00">','实时同步可填「实时（无固定时点）」')+
      fField('超时（秒）','<input id="sh-pl-to" value="'+esc(p?p.timeout:30)+'" placeholder="30">','超时后按重试次数重试')+
      fField('重试次数','<input id="sh-pl-retry" value="'+esc(p?p.retry:3)+'" placeholder="3">')+
      fField('启用状态',fSel('sh-pl-en',['是','否'],p?p.enabled:'是'),'停用后不再发起同步，监控检测跳过')+
    '</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shPlatSubmit(\''+(p?p.accessId:'')+'\')">保存配置</button>');
};
window.shPlatSubmit=function(id){
  var name=fv('sh-pl-name'), proto=fv('sh-pl-proto'), ep=fv('sh-pl-ep');
  if(!name){ toast('请填写平台名称','error'); return; }
  if(!ep){ toast('请填写接口地址','error'); return; }
  if(/^(FTP|SFTP)/.test(proto)&&!/^(ftp|sftp):\/\//i.test(ep)){ toast('FTP / SFTP 协议接口地址需以 ftp:// 或 sftp:// 开头','error'); return; }
  if(/^HTTP/.test(proto)&&!/^https?:\/\//i.test(ep)){ toast('HTTP 协议接口地址需以 http:// 或 https:// 开头','error'); return; }
  var cfg={platformName:name,accessType:fv('sh-pl-type')||ACCESS_TYPES[0],protocol:proto||PROTOCOL[0],
    endpoint:ep,method:fv('sh-pl-method')||'GET',authType:fv('sh-pl-auth')||AUTH_TYPE[0],
    credential:fv('sh-pl-cred'),syncFreq:fv('sh-pl-freq')||'每日',syncMode:fv('sh-pl-smode')||'增量',
    syncTime:fv('sh-pl-stime'),timeout:parseInt(fv('sh-pl-to'),10)||30,retry:parseInt(fv('sh-pl-retry'),10)||0,
    enabled:fv('sh-pl-en')||'是'};
  if(id){
    var p=platforms.find(id); if(!p) return;
    var before=cfgOf(p), changed=false;
    CFG_KEYS.forEach(function(k){ if(cfg[k]!==undefined&&String(cfg[k])!==String(p[k])) changed=true; });
    Object.keys(cfg).forEach(function(k){ p[k]=cfg[k]; });
    p.updateTime=now();
    if(changed){ p.connStatus='未连接'; p.respTime=0; p.lastCheckTime='—'; }
    platforms.save();
    var v=changed?addVersion(p,'接口配置变更（协议 / 同步频率 / 认证等）'):p.version;
    closeTopModal(); renderPage('sh-platform');
    shAudit('编辑',id,'更新接口配置「'+name+'」（'+cfg.protocol+' / '+cfg.syncFreq+' / '+(cfg.enabled==='是'?'启用':'停用')+'）'+(changed?'，生成版本 '+v:''),before,cfg);
    toast('接口配置已保存'+(changed?'，已生成版本 '+v:''));
    return;
  }
  var mx=0;
  platforms.all().forEach(function(x){ var m=/ACC-(\d+)/.exec(String(x.accessId)); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
  var nid='ACC-'+p4(mx+1);
  var np={accessId:nid,fieldMap:[],fieldMapJson:'{}',version:'v0.9',connStatus:'未连接',respTime:0,
    lastCheckTime:'—',availability:'—',lastSyncTime:'—',syncStatus:'未同步',respHistory:[],
    creator:op(),createTime:now(),updateTime:now()};
  Object.keys(cfg).forEach(function(k){ np[k]=cfg[k]; });
  platforms.all().push(np);
  platforms.save();
  var nv=addVersion(np,'初始接入配置（新建接口）','v1.0');
  closeTopModal(); renderPage('sh-platform');
  shAudit('新增',nid,'新增外部平台接口「'+name+'」（'+cfg.protocol+' / '+cfg.syncFreq+'），版本 '+nv,null,{accessId:nid,version:nv,enabled:cfg.enabled});
  toast('接口配置已创建：'+nid+'（版本 '+nv+'）');
};
window.shPlatToggle=function(id){
  var p=platforms.find(id); if(!p) return;
  p.enabled=p.enabled==='是'?'否':'是';
  if(p.enabled!=='是'){ p.connStatus='未连接'; p.respTime=0; }
  p.updateTime=now();
  platforms.save(); renderPage('sh-platform');
  shAudit('启停',id,(p.enabled==='是'?'启用':'停用')+'接口「'+p.platformName+'」',null,{enabled:p.enabled});
  toast('接口 '+id+' 已'+(p.enabled==='是'?'启用':'停用')+(p.enabled==='是'?'，可开始同步与检测':'，同步与检测已暂停'));
};
window.shPlatDel=function(id){
  var p=platforms.find(id); if(!p) return;
  var refs=lineages.all().filter(function(l){ return l.sourcePlatformId===id; });
  if(refs.length){ toast('该接口下存在 '+refs.length+' 个字段元数据，请先在「共享数据元数据血缘」处理','error'); return; }
  showConfirm('删除接口配置','确认删除接口 '+id+'（'+p.platformName+'）吗？其历史版本与字段映射配置将一并删除，不可恢复。',function(){
    var before={accessId:id,platformName:p.platformName,protocol:p.protocol,enabled:p.enabled};
    var idx=platforms.all().indexOf(p); if(idx>=0) platforms.all().splice(idx,1);
    var keep=platformVer.all().filter(function(x){ return x.accessId!==id; });
    platformVer.all().length=0;
    keep.forEach(function(x){ platformVer.all().push(x); });
    platforms.save(); platformVer.save(); renderPage('sh-platform');
    shAudit('删除',id,'删除接口配置「'+p.platformName+'」及其历史版本',before,null);
    toast('接口配置已删除：'+id);
  });
};

/* --- 字段映射规则配置 --- */
var mapRows=[], mapTarget='';
window.shPlatMap=function(id){
  var p=platforms.find(id); if(!p) return;
  mapTarget=id;
  mapRows=(p.fieldMap||[]).map(function(m){ return {src:m.src,dst:m.dst,type:m.type||'STRING',required:m.required||'否'}; });
  if(!mapRows.length) mapRows.push({src:'',dst:'',type:'STRING',required:'是'});
  modal('<span class="tt-tag">字段映射</span>'+esc(id)+' · '+esc(p.platformName),
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>源字段为外部平台返回字段（如「病历号」），目标字段为本系统标准字段（如 <b>case_id</b>）；保存后自动生成 fieldMapJson 并写入接口版本。</span></div>'+
    '<div class="table-wrap"><table class="data-table" style="min-width:0"><thead><tr><th style="width:32%">源字段（外部平台）</th><th style="width:32%">目标字段（本系统）</th><th style="width:16%">数据类型</th><th style="width:10%">必填</th><th style="width:10%">操作</th></tr></thead><tbody id="sh-map-tb"></tbody></table></div>'+
    '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">'+
      '<button class="btn btn-ghost btn-sm" onclick="shMapAddRow()">+ 添加映射行</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="shMapTpl()">载入标准模板</button>'+
      '<span style="flex:1"></span><span class="sh-sub" id="sh-map-cnt"></span>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shPlatMapSubmit()">保存映射</button>');
  drawMapRows();
};
function drawMapRows(){
  var tb=document.getElementById('sh-map-tb'); if(!tb) return;
  var inp=function(i,k,v,ph){
    return '<input value="'+esc(v)+'" placeholder="'+ph+'" onchange="shMapSet('+i+',\''+k+'\',this.value)" style="width:100%;box-sizing:border-box;height:30px;border:1px solid #d1d8e0;border-radius:4px;padding:0 8px;font-size:12.5px">';
  };
  var selS=function(i,k,val){
    return '<select onchange="shMapSet('+i+',\''+k+'\',this.value)" style="width:100%;height:30px;border:1px solid #d1d8e0;border-radius:4px;font-size:12.5px">'+
      DATA_TYPE_ENUM.map(function(o){ return '<option'+(o===val?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>';
  };
  var selR=function(i,val){
    return '<select onchange="shMapSet('+i+',\'required\',this.value)" style="width:100%;height:30px;border:1px solid #d1d8e0;border-radius:4px;font-size:12.5px">'+
      ['是','否'].map(function(o){ return '<option'+(o===val?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>';
  };
  tb.innerHTML=mapRows.map(function(r,i){
    return '<tr><td>'+inp(i,'src',r.src,'如：病历号')+'</td><td>'+inp(i,'dst',r.dst,'如：case_id')+'</td>'+
      '<td>'+selS(i,'type',r.type||'STRING')+'</td><td>'+selR(i,r.required||'是')+'</td>'+
      '<td><button class="btn btn-danger btn-xs" onclick="shMapDelRow('+i+')">删除</button></td></tr>';
  }).join('');
  var cnt=document.getElementById('sh-map-cnt');
  if(cnt) cnt.textContent='共 '+mapRows.length+' 项映射';
}
window.shMapSet=function(i,k,v){ if(!mapRows[i]) return; mapRows[i][k]=v; };
window.shMapAddRow=function(){ mapRows.push({src:'',dst:'',type:'STRING',required:'是'}); drawMapRows(); };
window.shMapDelRow=function(i){
  mapRows.splice(i,1);
  if(!mapRows.length) mapRows.push({src:'',dst:'',type:'STRING',required:'是'});
  drawMapRows();
};
window.shMapTpl=function(){
  var tpl=[['登记编号','reg_no','STRING'],['姓名','patient_name','STRING'],['身份证号','id_card','STRING'],
    ['ICD-10','icd10','STRING'],['确诊日期','diag_date','DATE']];
  var existing={};
  mapRows.forEach(function(r){ if(String(r.src||'').trim()) existing[r.src]=1; });
  tpl.forEach(function(t){
    if(!existing[t[0]]) mapRows.push({src:t[0],dst:t[1],type:t[2],required:'是'});
  });
  mapRows=mapRows.filter(function(r){ return String(r.src||'').trim()||String(r.dst||'').trim(); });
  drawMapRows();
  toast('已载入标准字段映射模板（'+mapRows.length+' 项）');
};
window.shPlatMapSubmit=function(){
  var p=platforms.find(mapTarget); if(!p) return;
  var rows=mapRows.filter(function(r){ return String(r.src||'').trim()||String(r.dst||'').trim(); });
  var probs=[], srcs={}, dsts={};
  rows.forEach(function(r,i){
    var s=String(r.src||'').trim(), d=String(r.dst||'').trim();
    if(!s||!d) probs.push('第 '+(i+1)+' 行源字段 / 目标字段不能为空');
    if(s&&srcs[s]) probs.push('源字段重复：'+s);
    if(d&&dsts[d]) probs.push('目标字段重复：'+d);
    if(s) srcs[s]=1;
    if(d) dsts[d]=1;
  });
  if(probs.length){ toast(probs[0],'error'); return; }
  if(!rows.length){ toast('请至少配置一条字段映射','error'); return; }
  var before={fieldMap:p.fieldMap,fieldMapJson:p.fieldMapJson};
  p.fieldMap=rows.map(function(r){ return {src:String(r.src).trim(),dst:String(r.dst).trim(),type:r.type||'STRING',required:r.required||'是'}; });
  p.fieldMapJson=mapJson(p.fieldMap);
  p.updateTime=now();
  platforms.save();
  var v=addVersion(p,'更新字段映射规则（'+p.fieldMap.length+' 项）');
  closeTopModal(); renderPage('sh-platform');
  shAudit('编辑',p.accessId,'配置字段映射规则 '+p.fieldMap.length+' 项（生成版本 '+v+'）',before,{fieldMap:p.fieldMap});
  toast('字段映射已保存：'+p.fieldMap.length+' 项，版本 '+v);
};

/* --- 接口版本管理与回滚 --- */
window.shPlatVer=function(id){
  var p=platforms.find(id); if(!p) return;
  var list=platformVer.all().filter(function(v){ return v.accessId===id; });
  var rows=list.map(function(v){
    var isCur=v.version===p.version||v.isCurrent==='是';
    var ops='<button class="btn btn-ghost btn-xs" onclick="shVerSnap(\''+v.verId+'\')">快照</button>'+
      (isCur?'':'<button class="btn btn-primary btn-xs" onclick="shPlatRollback(\''+v.verId+'\')">回滚</button>');
    return '<tr><td><b>'+esc(v.version)+'</b></td><td style="white-space:normal;min-width:220px;max-width:340px">'+esc(v.note)+'</td><td>'+esc(v.operator)+'</td><td>'+esc(v.time)+'</td><td>'+(isCur?bText('当前版本','badge-success'):bText('历史版本','badge-muted'))+'</td><td class="sticky-col">'+ops+'</td></tr>';
  }).join('');
  modal('<span class="tt-tag">版本管理</span>'+esc(id)+' · '+esc(p.platformName),
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>每次保存接口配置或字段映射均自动生成版本（当前 <b>'+esc(p.version)+'</b>）。回滚会用所选版本快照覆盖当前配置，并在回滚前自动备份当前配置。</span></div>'+
    '<div class="sh-frow"><label>变更说明</label><input id="sh-ver-note" placeholder="如：切换为 FTP 目录取数"></div>'+
    tbl(['版本','变更说明','操作人','保存时间','状态','操作'],rows,900),
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">关闭</button><button class="btn btn-primary" onclick="shVerSave(\''+id+'\')">保存当前配置为新版本</button>');
};
window.shVerSave=function(id){
  var p=platforms.find(id); if(!p) return;
  var note=fv('sh-ver-note')||'手动保存配置快照';
  var v=addVersion(p,note);
  platforms.save(); closeTopModal(); renderPage('sh-platform');
  shAudit('版本',id,'保存接口 '+id+' 新版本 '+v+'：'+note,null,{version:v});
  toast('已保存版本 '+v);
};
window.shVerSnap=function(verId){
  var v=platformVer.all().filter(function(x){ return x.verId===verId; })[0]; if(!v) return;
  var pre=function(t){ try{ return JSON.stringify(JSON.parse(t),null,2); }catch(e){ return t; } };
  modal('版本快照 · '+esc(v.accessId)+' '+esc(v.version),
    kv([['版本',v.version],['变更说明',v.note],['操作人',v.operator],['保存时间',v.time]])+
    '<div class="sh-sec">配置快照（JSON）</div><pre>'+esc(pre(v.snapshot))+'</pre>');
};
window.shPlatRollback=function(verId){
  var v=platformVer.all().filter(function(x){ return x.verId===verId; })[0]; if(!v) return;
  var p=platforms.find(v.accessId); if(!p) return;
  showConfirm('回滚接口版本','确认将接口 '+v.accessId+' 从 '+p.version+' 回滚到 '+v.version+' 吗？回滚前会自动把当前配置保存为备份版本。',function(){
    var snap;
    try{ snap=JSON.parse(v.snapshot); }catch(e){ toast('版本快照解析失败，无法回滚','error'); return; }
    var beforeVer=p.version;
    var backup=addVersion(p,'回滚前自动备份（原版本 '+beforeVer+'）');
    CFG_KEYS.forEach(function(k){ if(snap[k]!==undefined) p[k]=snap[k]; });
    p.version=v.version; p.updateTime=now();
    p.connStatus='未连接'; p.respTime=0; p.lastCheckTime='—';
    platformVer.all().forEach(function(x){ if(x.accessId===p.accessId) x.isCurrent=(x.verId===v.verId?'是':'否'); });
    platforms.save(); platformVer.save(); closeTopModal(); renderPage('sh-platform');
    shAudit('回滚',p.accessId,'接口 '+p.accessId+' 从 '+beforeVer+' 回滚至 '+v.version+'（当前配置已备份为 '+backup+'）',
      {version:beforeVer},{version:v.version,protocol:p.protocol,syncFreq:p.syncFreq});
    toast('已回滚至版本 '+v.version+'（原配置已备份为 '+backup+'）');
  });
};

/* --- 接口状态监控：连接状态 / 响应时间 / 可用率 --- */
function doCheck(p){
  var h=hash(p.accessId+'|'+now()+'|'+((p.respHistory||[]).length));
  var fail=(h%9===0)||(String(p.protocol).indexOf('FTP')>=0&&h%11===0);
  var status=fail?'异常':'正常';
  var resp=fail?(1200+h%900):(60+h%420);
  p.connStatus=status; p.respTime=resp; p.lastCheckTime=now();
  p.syncStatus=status==='正常'?'正常':'异常';
  var hist=(p.respHistory||[]).slice(0,11);
  hist.unshift({time:now(),status:status,respTime:resp});
  p.respHistory=hist;
  var okCnt=hist.filter(function(x){ return x.status==='正常'; }).length;
  p.availability=(Math.round(okCnt/hist.length*1000)/10).toFixed(1)+'%';
  return status;
}
window.shPlatCheck=function(id){
  var p=platforms.find(id); if(!p) return 'fail';
  if(p.enabled!=='是'){ toast('接口已停用，检测已跳过','error'); return 'fail'; }
  var status=doCheck(p);
  platforms.save(); renderPage('sh-platform');
  shAudit('检测',id,'接口 '+id+' 手动检测：'+status+'（'+p.respTime+' ms）',null,{connStatus:status,respTime:p.respTime});
  toast('接口 '+id+' 检测完成：'+status+'（'+p.respTime+' ms）');
  return status;
};
window.shPlatCheckAll=function(){
  var list=platforms.all().filter(function(p){ return p.enabled==='是'; });
  if(!list.length){ toast('暂无已启用接口','error'); return; }
  var bad=0;
  list.forEach(function(p){ if(doCheck(p)==='异常') bad++; });
  platforms.save(); renderPage('sh-platform');
  shAudit('检测','ALL','批量检测 '+list.length+' 个已启用接口：异常 '+bad+' 个',null,{total:list.length,abnormal:bad});
  toast('已检测 '+list.length+' 个接口：正常 '+(list.length-bad)+' 个 / 异常 '+bad+' 个');
};
window.shPlatMonitor=function(id){
  var p=platforms.find(id); if(!p) return;
  var hist=(p.respHistory||[]);
  var rows=hist.map(function(h){
    return '<tr><td>'+esc(h.time)+'</td><td>'+stBadge(h.status)+'</td><td>'+esc(h.respTime)+'</td></tr>';
  }).join('');
  modal('<span class="tt-tag">状态监控</span>'+esc(id)+' · '+esc(p.platformName),
    kv([['接入ID',p.accessId],['接口协议',p.protocol],['接口地址',p.endpoint],['请求方法',p.method],
      ['认证方式',p.authType],['同步频率',p.syncFreq+' · '+(p.syncMode||'—')+' · '+(p.syncTime||'—')],
      ['连接状态',p.connStatus||'未连接'],['响应时间',(p.respTime>0?p.respTime+' ms':'—')],
      ['可用率',p.availability||'—'],['最近检测',p.lastCheckTime||'—'],
      ['最后同步时间',p.lastSyncTime||'—'],['同步状态',p.syncStatus||'—'],
      ['超时 / 重试',(p.timeout||'—')+' 秒 / '+(p.retry||0)+' 次'],
      ['启用状态',p.enabled==='是'?'启用':'停用']])+
    '<div class="sh-sec">检测记录（最近 12 次）</div>'+
    tbl(['检测时间','连接状态','响应时间(ms)'],rows,600),
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">关闭</button>'+
    '<button class="btn btn-primary" onclick="shPlatCheckModal(\''+id+'\')">立即检测</button>');
};
window.shPlatCheckModal=function(id){
  var st=window.shPlatCheck(id);
  if(st==='正常'||st==='异常') window.shPlatMonitor(id);
};

/* --- 接口配置导出：JSON / 表格 --- */
window.shPlatExportDlg=function(){
  modal('导出接口配置',
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>JSON 用于系统备份与迁移（含字段映射）；表格 CSV 用于线下核对与归档。</span></div>'+
    '<div class="sh-frow"><label>导出范围</label><select id="sh-ex-scope"><option value="all">全部接口</option><option value="on">仅已启用接口</option></select></div>'+
    '<div class="sh-frow"><label>字段映射</label><select id="sh-ex-map"><option value="是">包含字段映射</option><option value="否">不含字段映射</option></select></div>'+
    '<div style="font-size:12px;color:#94a3b8;padding-left:120px">导出动作自动写入共享操作审计。</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button>'+
    '<button class="btn btn-ghost" onclick="shPlatExport(\'csv\')">导出表格（CSV）</button>'+
    '<button class="btn btn-primary" onclick="shPlatExport(\'json\')">导出 JSON</button>');
};
window.shPlatExport=function(fmt){
  var scope=fv('sh-ex-scope')||'all';
  var withMap=(fv('sh-ex-map')||'是')==='是';
  var list=platforms.all().filter(function(p){ return scope==='on'?p.enabled==='是':true; });
  if(!list.length){ toast('无可导出的接口配置','error'); return false; }
  var stamp=now().slice(0,10).replace(/-/g,''), ok=false, file='';
  if(fmt==='json'){
    var data={exportTime:now(),module:'外部平台对接与数据接入配置',count:list.length,
      interfaces:list.map(function(p){
        var o=cfgOf(p);
        o.accessId=p.accessId; o.version=p.version; o.connStatus=p.connStatus;
        o.respTime=p.respTime; o.lastCheckTime=p.lastCheckTime; o.lastSyncTime=p.lastSyncTime; o.syncStatus=p.syncStatus;
        if(!withMap){ delete o.fieldMap; delete o.fieldMapJson; }
        return o;
      })};
    file='外部平台接口配置_'+stamp+'.json';
    ok=realDownload(file,'application/json;charset=utf-8',JSON.stringify(data,null,2),true);
  } else {
    var head=['接入ID','平台名称','对接类型','接口协议','接口地址','请求方法','认证方式','同步频率','同步方式','同步时点','超时(秒)','重试次数','字段映射项','版本','启用状态','连接状态','响应时间(ms)','可用率','最后同步时间','创建人','创建时间'];
    var lines=[head.map(csvCell).join(',')];
    list.forEach(function(p){
      lines.push([p.accessId,p.platformName,p.accessType,p.protocol,p.endpoint,p.method,p.authType,
        p.syncFreq,p.syncMode,p.syncTime,p.timeout,p.retry,
        withMap?mapCount(p):'',p.version,p.enabled==='是'?'启用':'停用',p.connStatus,p.respTime,p.availability,
        p.lastSyncTime,p.creator,p.createTime].map(csvCell).join(','));
    });
    file='外部平台接口配置_'+stamp+'.csv';
    ok=realDownload(file,'text/csv;charset=utf-8',lines.join('\n'));
  }
  if(!ok){ toast('当前环境不支持文件下载','error'); return false; }
  closeTopModal();
  shAudit('导出','PLATFORM','导出接口配置（'+(fmt==='json'?'JSON':'表格 CSV')+'，'+list.length+' 个接口'+(withMap?'，含字段映射':'')+'）',null,{file:file,count:list.length});
  toast('已导出：'+file+'（'+list.length+' 个接口）');
  return true;
};

/* ---------- 页面：数据共享申请审批（功能点19） ---------- */
/* 我的申请（默认）/ 我的审核：CUR_USER 来自系统账户体系（用户管理中 account=admin
   的启用账号姓名），与审批层级配置的审核人匹配后出现审批入口。 */
var CUR_USER=(function(){
  try{
    if(typeof userData!=='undefined'&&userData&&userData.length){
      var u=userData.filter(function(x){ return x.account==='admin'&&x.status==='enabled'; })[0];
      if(u&&u.name) return u.name;
    }
  }catch(e){}
  return '管理员';
})();
var applyView='mine';
function curApproverNode(){
  for(var i=0;i<NODES.length;i++){ if(NODES[i].user===CUR_USER) return NODES[i].label; }
  return null;
}
window.shApplyTab=function(v){ applyView=v; renderPage('sh-apply'); };
/* 内部切换钩子：无 UI 入口，供测试 / 将来登录系统注入 */
window.shApplyUser=function(u){ CUR_USER=u; applyView='mine'; renderPage('sh-apply'); };
function renderApply(){
  var page='sh-apply';
  var kw=(shF(page,'kw')||'').toLowerCase();
  var myNode=curApproverNode();
  var isMine=applyView!=='audit';
  var hdrOps='<button class="btn btn-sm '+(isMine?'btn-primary':'btn-ghost')+'" onclick="shApplyTab(\'mine\')">我的申请</button> '+
    '<button class="btn btn-sm '+(isMine?'btn-ghost':'btn-primary')+'" onclick="shApplyTab(\'audit\')">我的审核</button> '+
    '<button class="btn btn-outline btn-sm" onclick="shApplyCfg()">审批设置</button>';
  var all=applies.all(),rows,filterHtml,headers,minW;
  if(isMine){
    var st=shF(page,'st');
    rows=all.filter(function(a){
        if(st&&a.applyStatus!==st) return false;
        if(kw&&[a.applyId,a.applicant,a.applyOrg,a.purpose].join('|').toLowerCase().indexOf(kw)<0) return false;
        return true;
      }).map(function(a){
        var approved=a.applyStatus==='已批准';
        var pending=a.applyStatus==='审批中';
        var ops=pending?'<button class="btn btn-primary btn-xs" onclick="shApplyWithdraw(\''+a.applyId+'\')">撤销申请</button>'
          :(approved?'<button class="btn btn-primary btn-xs" onclick="shApplyAttach(\''+a.applyId+'\')">'+(a.attachment?'重新上传':'上传附件')+'</button>'
          :'<span style="color:#94a3b8;font-size:12px">—</span>');
        return '<tr><td>'+esc(a.applyId)+'</td><td style="white-space:normal;min-width:150px">'+esc(a.applicant)+'<br><span style="font-size:11.5px;color:#64748b">'+esc(a.applyOrg)+'</span></td><td style="white-space:normal;min-width:220px;max-width:300px">'+esc(a.purpose)+(a.dataScope?'<br><span style="font-size:11.5px;color:#64748b">数据范围：'+esc(a.dataScope)+'</span>':'')+'</td><td>'+stBadge(a.applyStatus)+(a.attachment?'<br><span style="font-size:11.5px;color:#64748b">附件：'+esc(a.attachment)+'</span>':'')+'</td><td>'+esc(a.validUntil||'—')+'</td><td>'+esc(a.submitTime)+'</td><td class="sticky-col">'+ops+'</td></tr>';
      }).join('');
    filterHtml=filterBar(page,kwInput(page,'申请ID / 申请人 / 机构 / 用途')+
      '<div class="form-group"><label>审批状态</label><select onchange="shSetFilter(\''+page+'\',\'st\',this.value)"><option value="">全部</option>'+['审批中','已批准','已驳回','已撤销'].map(function(s){ return '<option'+(st===s?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></div>',
      '<button class="btn btn-primary btn-sm" onclick="shApplyNew()">新建共享申请</button>');
    headers=['申请ID','申请人 / 机构','申请用途','审批状态','有效期至','提交时间','操作'];
    minW=1100;
  } else {
    var av=shF(page,'audit'),ar=shF(page,'ares');
    var mineOf=function(a){
      var m=a.approveComments.filter(function(c){ return c.approver===CUR_USER&&(c.result==='通过'||c.result==='驳回'); });
      return m.length?m[m.length-1]:null;
    };
    rows=all.filter(function(a){
        var mine=mineOf(a);
        var pending=a.applyStatus==='审批中'&&(!myNode||a.currentNode===myNode);
        if(av==='pending'&&!pending) return false;
        if(av==='done'&&!mine) return false;
        if(!av&&!pending&&!mine) return false;
        if(ar&&(!mine||mine.result!==ar)) return false;
        if(kw&&[a.applyId,a.applicant,a.applyOrg,a.purpose].join('|').toLowerCase().indexOf(kw)<0) return false;
        return true;
      }).map(function(a){
        var mine=mineOf(a);
        var pending=a.applyStatus==='审批中'&&(!myNode||a.currentNode===myNode);
        var concl=pending?bText('待审批','badge-warning')
          :(mine?bText(mine.result,mine.result==='通过'?'badge-success':'badge-danger')+'<br><span style="font-size:11.5px;color:#64748b">'+esc(mine.time||'')+'</span>':'—');
        var ops=(pending&&myNode)?'<button class="btn btn-primary btn-xs" onclick="shApplyReview(\''+a.applyId+'\')">审批</button>'
          :'<button class="btn btn-ghost btn-xs" onclick="shApplyDetail(\''+a.applyId+'\')">查看</button>';
        return '<tr><td>'+esc(a.applyId)+'</td><td style="white-space:normal;min-width:150px">'+esc(a.applicant)+'<br><span style="font-size:11.5px;color:#64748b">'+esc(a.applyOrg)+'</span></td><td style="white-space:normal;min-width:220px;max-width:300px">'+esc(a.purpose)+(a.dataScope?'<br><span style="font-size:11.5px;color:#64748b">数据范围：'+esc(a.dataScope)+'</span>':'')+'</td><td>'+stBadge(a.applyStatus)+'</td><td style="white-space:normal;min-width:110px">'+concl+'</td><td>'+esc(a.submitTime)+'</td><td class="sticky-col">'+ops+'</td></tr>';
      }).join('');
    filterHtml=filterBar(page,
      '<div class="form-group"><label>处理状态</label><select onchange="shSetFilter(\''+page+'\',\'audit\',this.value)"><option value="">全部</option><option value="pending"'+(av==='pending'?' selected':'')+'>未审批</option><option value="done"'+(av==='done'?' selected':'')+'>我已审批</option></select></div>'+
      '<div class="form-group"><label>审批结果</label><select onchange="shSetFilter(\''+page+'\',\'ares\',this.value)"><option value="">全部</option><option'+(ar==='通过'?' selected':'')+'>通过</option><option'+(ar==='驳回'?' selected':'')+'>驳回</option></select></div>'+
      kwInput(page,'申请ID / 申请人 / 机构 / 用途'));
    headers=['申请ID','申请人 / 机构','申请用途','申请状态','我的结论','提交时间','操作'];
    minW=1200;
  }
  var body=filterHtml+
    tbl(headers,rows,minW);
  /* 按钮组常驻面板标题栏右侧（不走 page-toolbar） */
  return '<div class="panel"><div class="panel-header sh-apply-hdr"><span>数据共享申请审批</span><span class="sh-hdr-ops">'+hdrOps+'</span></div><div class="panel-body">'+body+'</div></div>';
}
/* 审批设置：层级可增减；审核人从系统账户体系（用户管理启用账号）中搜索选择 */
var cfgDraft=null;
function shCfgAccounts(){
  try{
    if(typeof userData!=='undefined'&&userData&&userData.length) return userData.filter(function(u){ return u.status==='enabled'; });
  }catch(e){}
  return [];
}
function shApplyCfgRender(){
  if(cfgDraft) closeTopModal();
  var rows=cfgDraft.map(function(n,i){
    return '<div class="sh-cfg-row">'+
      '<span class="sh-cfg-idx">'+(i+1)+'</span>'+
      '<div class="sh-cfg-fields">'+
        '<input value="'+esc(n.label)+'" placeholder="层级名称，如 数据管理科审核 / 分管领导审批" oninput="shApplyCfgSet('+i+',\'label\',this.value)">'+
        '<input class="sh-cfg-user" list="sh-cfg-users" value="'+esc(n.user)+'" placeholder="选择或输入搜索审核人（姓名 / 账号）" oninput="shApplyCfgSet('+i+',\'user\',this.value)">'+
      '</div>'+
      (cfgDraft.length>1?'<button class="btn btn-danger btn-xs" onclick="shApplyCfgDel('+i+')">删除</button>':'')+
    '</div>';
  }).join('');
  var opts=shCfgAccounts().map(function(u){
    return '<option value="'+esc(u.name)+'">'+esc(u.name+'（'+u.account+'）· '+u.org)+'</option>';
  }).join('');
  modal('审批设置 · 审批层级与审核人',
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>审批流按层级自上而下逐级流转；审核人从<b>用户管理的启用账号</b>中选择，输入姓名或账号即可搜索。层级增减后，在途申请自动顺延至对应层级；历史审批记录保留原审核人。</span></div>'+
    '<div class="sh-cfg-list">'+rows+'</div>'+
    '<datalist id="sh-cfg-users">'+opts+'</datalist>'+
    '<div class="sh-cfg-foot">'+
      '<button class="btn btn-outline btn-sm" onclick="shApplyCfgAdd()">+ 添加审批层级</button>'+
      '<span class="sh-cfg-hint">至少保留一个层级；导出的数据访问与在途申请流转均按此配置执行</span>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shApplyCfgSubmit()">保存设置</button>',
    'sh-modal-box sh-modal-wide');
}
window.shApplyCfg=function(){
  cfgDraft=NODES.map(function(n){ return {label:n.label,user:n.user}; });
  if(!cfgDraft.length) cfgDraft=[{label:'第一级审核',user:(shCfgAccounts()[0]||{}).name||''}];
  shApplyCfgRender();
};
window.shApplyCfgSet=function(i,key,val){ if(cfgDraft&&cfgDraft[i]) cfgDraft[i][key]=val; };
window.shApplyCfgAdd=function(){
  if(!cfgDraft) return;
  cfgDraft.push({label:'第 '+(cfgDraft.length+1)+' 级审核',user:(shCfgAccounts()[0]||{}).name||''});
  shApplyCfgRender();
};
window.shApplyCfgDel=function(i){
  if(!cfgDraft||cfgDraft.length<=1){ toast('至少保留一个审批层级','error'); return; }
  cfgDraft.splice(i,1);
  shApplyCfgRender();
};
window.shApplyCfgSubmit=function(){
  if(!cfgDraft||!cfgDraft.length){ toast('请至少保留一个审批层级','error'); return; }
  var bad=cfgDraft.filter(function(n){ return !n.label||!n.user; });
  if(bad.length){ toast('各级层级名称与审核人均不能为空','error'); return; }
  var names=shCfgAccounts().map(function(u){ return u.name; });
  var badUser=cfgDraft.filter(function(n){ return names.indexOf(n.user)<0; })[0];
  if(badUser){ toast('审核人「'+badUser.user+'」不是系统启用账户，请从列表中选择','error'); return; }
  var before=NODES.map(function(n){ return {label:n.label,user:n.user}; });
  var oldLabels=before.map(function(n){ return n.label; });
  var arr=nodesCfg.all();
  arr.length=0;
  cfgDraft.forEach(function(n){ arr.push({label:n.label,user:n.user}); });
  nodesCfg.save();
  /* 在途申请顺延迁移：原层级被删除/调整时，按原位置映射到新层级并补待审记录 */
  var migrated=0;
  applies.all().forEach(function(a){
    if(a.applyStatus!=='审批中') return;
    if(NODES.some(function(n){ return n.label===a.currentNode; })) return;
    var oldIdx=oldLabels.indexOf(a.currentNode);
    var idx=oldIdx>=0?Math.min(oldIdx,NODES.length-1):0;
    a.currentNode=NODES[idx].label;
    var hasPend=a.approveComments.some(function(c){ return c.node===a.currentNode&&c.result==='待审'; });
    if(!hasPend) a.approveComments.push({node:a.currentNode,approver:NODES[idx].user,time:'',result:'待审',comment:''});
    migrated++;
  });
  applies.save();
  cfgDraft=null;
  closeTopModal(); renderPage('sh-apply');
  shAudit('设置','NODES','调整审批层级与审核人（共 '+NODES.length+' 级'+(migrated?'，顺延在途申请 '+migrated+' 条':'')+'）',before,NODES.map(function(n){ return {label:n.label,user:n.user}; }));
  toast('审批设置已保存（共 '+NODES.length+' 级）');
};
window.shApplyCfg=function(){
  cfgDraft=NODES.map(function(n){ return {label:n.label,user:n.user}; });
  if(!cfgDraft.length) cfgDraft=[{label:'第一级审核',user:(shCfgAccounts()[0]||{}).name||''}];
  shApplyCfgRender();
};
window.shApplyCfgSet=function(i,key,val){ if(cfgDraft&&cfgDraft[i]) cfgDraft[i][key]=val; };
window.shApplyCfgAdd=function(){
  if(!cfgDraft) return;
  cfgDraft.push({label:'第 '+(cfgDraft.length+1)+' 级审核',user:(shCfgAccounts()[0]||{}).name||''});
  shApplyCfgRender();
};
window.shApplyCfgDel=function(i){
  if(!cfgDraft||cfgDraft.length<=1){ toast('至少保留一个审批层级','error'); return; }
  cfgDraft.splice(i,1);
  shApplyCfgRender();
};
window.shApplyCfgSubmit=function(){
  if(!cfgDraft||!cfgDraft.length){ toast('请至少保留一个审批层级','error'); return; }
  var bad=cfgDraft.filter(function(n){ return !n.label||!n.user; });
  if(bad.length){ toast('各级层级名称与审核人均不能为空','error'); return; }
  var before=NODES.map(function(n){ return {label:n.label,user:n.user}; });
  var oldLabels=before.map(function(n){ return n.label; });
  var arr=nodesCfg.all();
  arr.length=0;
  cfgDraft.forEach(function(n){ arr.push({label:n.label,user:n.user}); });
  nodesCfg.save();
  /* 在途申请顺延迁移：原层级被删除/调整时，按原位置映射到新层级并补待审记录 */
  var migrated=0;
  applies.all().forEach(function(a){
    if(a.applyStatus!=='审批中') return;
    if(NODES.some(function(n){ return n.label===a.currentNode; })) return;
    var oldIdx=oldLabels.indexOf(a.currentNode);
    var idx=oldIdx>=0?Math.min(oldIdx,NODES.length-1):0;
    a.currentNode=NODES[idx].label;
    var hasPend=a.approveComments.some(function(c){ return c.node===a.currentNode&&c.result==='待审'; });
    if(!hasPend) a.approveComments.push({node:a.currentNode,approver:NODES[idx].user,time:'',result:'待审',comment:''});
    migrated++;
  });
  applies.save();
  cfgDraft=null;
  closeTopModal(); renderPage('sh-apply');
  shAudit('设置','NODES','调整审批层级与审核人（共 '+NODES.length+' 级'+(migrated?'，顺延在途申请 '+migrated+' 条':'')+'）',before,NODES.map(function(n){ return {label:n.label,user:n.user}; }));
  toast('审批设置已保存（共 '+NODES.length+' 级）');
};
window.shApplyNew=function(){
  modal('<span class="tt-tag">三级审批</span>新建数据共享申请',
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>提交后依次经 <b>数据管理科审核 → 数据安全小组审核 → 分管领导审批</b>；标 <b style="color:#dc2626">*</b> 为必填项，批准后交付方式为上传一个数据附件。</span></div>'+
    '<div class="sh-form">'+
      '<div class="sh-field"><label>申请人<span class="req">*</span></label><input id="sh-f-app" placeholder="如：科研岗·陈涛"><div class="hint">实际经办人，便于审批人联系核实</div></div>'+
      '<div class="sh-field"><label>申请机构<span class="req">*</span></label><input id="sh-f-org" placeholder="如：南昌大学公共卫生学院"><div class="hint">申请单位全称</div></div>'+
      '<div class="sh-field full"><label>申请用途<span class="req">*</span></label><textarea id="sh-f-purpose" placeholder="说明研究 / 业务用途与数据最小必要范围"></textarea></div>'+
      '<div class="sh-field"><label>数据范围<span class="req">*</span></label><input id="sh-f-scope" value="江西省 / 2023 / 全部癌种" placeholder="地区 / 年度 / 癌种与颗粒度"><div class="hint">示例：江西省 / 2020-2023 年 / 全部癌种（地市汇总）</div></div>'+
      '<div class="sh-field"><label>申请有效期<span class="req">*</span></label><select id="sh-f-vd">'+['30 天','90 天','180 天','365 天'].map(function(o){ return '<option'+(o==='90 天'?' selected':'')+'>'+o+'</option>'; }).join('')+'</select><div class="hint">到期后附件访问与导出自动失效</div></div>'+
      '<div class="sh-field full"><label>交付方式<span class="req">*</span></label><select id="sh-f-mode">'+['查看权限','接口对接','文件下载'].map(function(o){ return '<option'+(o==='查看权限'?' selected':'')+'>'+o+'</option>'; }).join('')+'</select><div class="hint">查看权限＝在线查看与脱敏导出；接口对接＝API 方式对接获取数据；文件下载＝脱敏附件下载</div></div>'+
      '<div class="sh-field full"><label>申请说明<span class="req">*</span></label><textarea id="sh-f-note" placeholder="说明数据使用方式、脱敏与安全承诺；申请病例级明细的，须说明理由与安全保障措施"></textarea><div class="hint">审批人将依据本说明评估最小必要原则与脱敏风险</div></div>'+
    '</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shApplySubmit()">提交申请</button>');
};
window.shApplySubmit=function(){
  var app=fv('sh-f-app'),org=fv('sh-f-org'),purpose=fv('sh-f-purpose'),scope=fv('sh-f-scope'),note=fv('sh-f-note');
  var miss=[];
  if(!app)miss.push('申请人'); if(!org)miss.push('申请机构'); if(!purpose)miss.push('申请用途');
  if(!scope)miss.push('数据范围'); if(!note)miss.push('申请说明');
  if(miss.length){ toast('请填写必填项：'+miss.join('、'),'error'); return; }
  var nid='SHA-'+now().slice(0,4)+'-'+p4(applies.all().length+32);
  applies.all().push({applyId:nid,applicant:app,applyOrg:org,purpose:purpose,dataScope:scope,applyNote:note,
    validUntil:plusDays(parseInt(fv('sh-f-vd'),10)||90),accessMode:fv('sh-f-mode')||'查看权限',
    submitTime:now(),currentNode:NODES[0].label,applyStatus:'审批中',
    approveComments:[{node:NODES[0].label,approver:NODES[0].user,time:'',result:'待审',comment:''}],finishTime:'—'});
  applies.save(); closeTopModal(); renderPage('sh-apply');
  shAudit('新增',nid,'提交共享申请「'+purpose.slice(0,20)+'」（'+org+'）',null,{applyId:nid,applyStatus:'审批中',currentNode:NODES[0].label});
  toast('申请已提交：'+nid+'（进入「'+NODES[0].label+'」）');
};
/* 审批弹窗：通过 / 驳回 */
/* 申请摘要卡：审批人第一眼看到「谁 · 要什么 · 用来干什么」 */
function applySummary(a){
  return '<div class="sh-sum"><div class="sh-sum-h">申请摘要'+bText(a.applyStatus,a.applyStatus==='已批准'?'badge-success':(a.applyStatus==='已驳回'?'badge-danger':'badge-warning'))+'</div>'+
    '<div class="sh-sum-b">'+
    '<div class="k">申请人</div><div class="v">'+esc(a.applicant)+'（'+esc(a.applyOrg)+'）</div>'+
    '<div class="k">申请用途</div><div class="v">'+esc(a.purpose)+'</div>'+
    '<div class="k">数据范围</div><div class="v">'+esc(a.dataScope)+'</div>'+
    '<div class="k">交付方式</div><div class="v">'+esc(a.accessMode||'—')+'</div>'+
    '<div class="k">申请有效期至</div><div class="v">'+esc(a.validUntil||'—')+'</div>'+
    '<div class="k">申请说明</div><div class="v">'+esc(a.applyNote||'—')+'</div>'+
    '<div class="k">交付方式</div><div class="v">附件上传（批准后由申请方上传数据附件）</div>'+
    '<div class="k">提交时间</div><div class="v">'+esc(a.submitTime)+'</div>'+
    '</div></div>';
}
/* 三节点审批进度条：通过=绿勾 / 当前=蓝高亮 / 驳回=红 */
function applySteps(a){
  var stateOf=function(i){
    var c=a.approveComments[i];
    if(!c) return '';
    if(c.result==='通过') return 'done';
    if(c.result==='驳回') return 'fail';
    if(c.result==='待审') return 'cur';
    return '';
  };
  var html='<div class="sh-steps">';
  NODES.forEach(function(n,i){
    var cls=stateOf(i);
    if(a.applyStatus==='已批准') cls='done';
    var c=a.approveComments[i]||{};
    html+='<div class="step '+cls+'"><span class="n">'+(cls==='done'?'✓':(i+1))+'</span>'+
      '<span class="l">'+esc(n.label)+'</span>'+
      '<span class="t">'+(c.time?esc(c.time):(cls==='cur'?'待审中':'未到达'))+'</span></div>';
    if(i<NODES.length-1) html+='<span class="bar'+(cls==='done'?' done':'')+'"></span>';
  });
  return html+'</div>';
}
window.shApplyReview=function(id){
  var a=applies.find(id); if(!a||a.applyStatus!=='审批中') return;
  var node=NODES.filter(function(n){ return n.label===a.currentNode; })[0];
  if(!node){ toast('审批节点配置异常','error'); return; }
  modal('<span class="tt-tag">'+esc(node.label)+'</span>审批 · '+esc(a.applyId),
    applySummary(a)+
    '<div class="sh-sec" style="margin-top:0">审批进度</div>'+applySteps(a)+
    '<div class="sh-sec">历史审批意见</div>'+timeline(a)+
    '<div class="sh-field" style="margin-top:12px"><label>审批意见<span class="req">*</span></label>'+
    '<textarea id="sh-f-comment" placeholder="通过请写明审核结论与附加要求；驳回请写明具体理由"></textarea></div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-danger" onclick="shApplySubmitReview(\''+id+'\',\'驳回\')">驳回</button><button class="btn btn-primary" onclick="shApplySubmitReview(\''+id+'\',\'通过\')">通过</button>');
};
window.shApplySubmitReview=function(id,result){
  var a=applies.find(id); if(!a) return;
  var comment=fv('sh-f-comment');
  if(!comment){ toast('审批意见必填','error'); return; }
  var node=NODES.filter(function(n){ return n.label===a.currentNode; })[0];
  var c=a.approveComments.filter(function(c){ return c.node===a.currentNode&&c.result==='待审'; })[0];
  if(c){ c.result=result; c.comment=comment; c.time=now(); }
  else { a.approveComments.push({node:a.currentNode,approver:node?node.user:op(),time:now(),result:result,comment:comment}); }
  if(result==='驳回'){
    var beforeR={applyStatus:a.applyStatus,currentNode:a.currentNode};
    a.applyStatus='已驳回'; a.finishTime=now();
    applies.save(); closeTopModal(); renderPage('sh-apply');
    shAudit('审批',a.applyId,'三级审批「'+a.currentNode+'」驳回：'+comment,beforeR,{applyStatus:'已驳回',finishTime:a.finishTime});
    toast('申请已驳回');
    return;
  }
  var idx=NODES.map(function(n){ return n.label; }).indexOf(a.currentNode);
  if(idx<NODES.length-1){
    var next=NODES[idx+1];
    a.currentNode=next.label;
    a.approveComments.push({node:next.label,approver:next.user,time:'',result:'待审',comment:''});
    applies.save(); closeTopModal(); renderPage('sh-apply');
    shAudit('审批',a.applyId,'「'+NODES[idx].label+'」通过，流转至「'+next.label+'」：'+comment,null,{currentNode:a.currentNode});
    toast('审批通过，流转至「'+next.label+'」');
  } else {
    a.applyStatus='已批准'; a.currentNode='已完结'; a.finishTime=now();
    applies.save(); closeTopModal(); renderPage('sh-apply');
    shAudit('审批',a.applyId,'三级审批全部通过，申请批准：'+comment,null,{applyStatus:'已批准',finishTime:a.finishTime});
    toast('三级审批全部通过，申请已批准，可进入交付');
  }
};
/* 交付 = 上传附件：选择文件后记录到申请并留痕 */
window.shApplyAttach=function(id){
  var a=applies.find(id); if(!a||a.applyStatus!=='已批准') return;
  var inp=document.createElement('input'); inp.type='file';
  inp.addEventListener('change',function(){
    var f=(inp.files||[])[0];
    if(f&&f.name) shApplyAttachDone(id,f.name);
  });
  inp.click();
};
window.shApplyAttachDone=function(id,name){
  var a=applies.find(id); if(!a||a.applyStatus!=='已批准') return;
  if(!name){ toast('未选择附件','error'); return; }
  var before={attachment:a.attachment||''};
  a.attachment=name; a.attachTime=now();
  applies.save(); renderPage('sh-apply');
  shAudit('交付',a.applyId,'上传交付附件「'+name+'」',before,{attachment:name,attachTime:a.attachTime});
  toast('附件已上传：'+name+'（'+a.applyId+'）');
};
/* 申请详情（只读）：审批人在「我的审核-已审批」中查看 */
window.shApplyDetail=function(id){
  var a=applies.find(id); if(!a) return;
  modal('申请详情 · '+esc(a.applyId),
    applySummary(a)+
    '<div class="sh-sec" style="margin-top:0">审批进度</div>'+applySteps(a)+
    '<div class="sh-sec">历史审批意见</div>'+timeline(a)+
    (a.attachment?'<div class="sh-sec">交付附件</div><div style="font-size:12.5px;color:#334155">附件：'+esc(a.attachment)+'（'+esc(a.attachTime||'')+' 上传）</div>':''));
};
/* 申请人撤销审批中的申请 */
window.shApplyWithdraw=function(id){
  var a=applies.find(id); if(!a||a.applyStatus!=='审批中') return;
  showConfirm('撤销申请','确认撤销申请 '+a.applyId+' 吗？撤销后审批流程终止，不可恢复。',function(){
    var before={applyStatus:a.applyStatus,currentNode:a.currentNode};
    a.applyStatus='已撤销'; a.currentNode='已撤销'; a.finishTime=now();
    var c=a.approveComments.filter(function(c){ return c.node===before.currentNode&&c.result==='待审'; })[0];
    if(c){ c.result='已撤销'; c.time=now(); c.comment='申请人主动撤销'; }
    applies.save(); renderPage('sh-apply');
    shAudit('撤销',a.applyId,'申请人撤销申请，审批流程终止',before,{applyStatus:'已撤销',finishTime:a.finishTime});
    toast('申请已撤销：'+a.applyId);
  });
};

/* ---------- 页面：数据共享策略配置（页面访问授权模型） ---------- */
function policyPage(pid){
  return ACCESS_PAGES.filter(function(x){ return x.id===pid; })[0]||{id:pid,label:pid,cols:[]};
}
function enabledOf(p){ return p.enabled==='是'||p.enabled===true; }
/* 脱敏导出的演示数据：按列名确定性生成，不含姓名 / 身份证号 / 联系方式 / 详细地址等直接标识字段 */
function pageCellValue(col,h){
  switch(col){
    case '登记编号': return 'JX-2026-'+p4(h%9000+1000);
    case '死亡编号': return 'SW-2026-'+p4(h%9000+1000);
    case '性别': return h%2?'男':'女';
    case '年龄组': return ['0-14 岁','15-39 岁','40-64 岁','65 岁及以上'][h%4];
    case '发病部位': return ['肺','胃','肝','结直肠','乳腺','甲状腺'][h%6];
    case 'ICD-10': return ['C34','C16','C22','C18','C50','C73'][h%6]+'.9';
    case '确诊日期': return (2020+h%4)+'-'+p2(h%12+1)+'-'+p2(h%28+1);
    case '诊断依据': return ['病理学诊断','临床诊断','影像学诊断'][h%3];
    case '随访状态': return h%3?'存活':'死亡';
    case '生存月数': return String(h%96);
    case '最后接触日期': return (2024+h%2)+'-'+p2(h%12+1)+'-'+p2(h%28+1);
    case '根本死因': return ['恶性肿瘤','心脏病','脑血管病','呼吸系统疾病'][h%4];
    case '死因ICD10编码': return ['C34','I21','I63','J44'][h%4];
    case '死亡日期': return (2024+h%2)+'-'+p2(h%12+1)+'-'+p2(h%28+1);
    case '统计指标': return ['发病数','死亡数','中标率','M/I 比值'][h%4];
    case '地区': return ['南昌市','赣州市','九江市','宜春市','上饶市'][h%5];
    case '年份': return String(2020+h%4);
    case '数值': return String(h%5000+120);
    case '年报任务': return (2020+h%4)+' 年度年报';
    case '年度': return String(2020+h%4);
    case '状态': return ['已归档','编制中'][h%2];
    case '编制人': return ['张*倩','王*岗','李*组','赵*任'][h%4];
    default: return String(h%900+100);
  }
}
function renderPolicyPanel(){
  var page='sh-policy';
  var kw=(shF(page,'kw')||'').toLowerCase(); var en=shF(page,'en');
  var all=policies.all().filter(function(p){
      if(en&&((en==='是')!==enabledOf(p))) return false;
      if(kw&&[p.policyId,p.policyName,p.applicant,p.applyOrg].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    });
  var rows=all.map(function(p){
    var verCnt=policyVer.all().filter(function(v){ return v.policyId===p.policyId; }).length;
    return '<tr><td>'+esc(p.policyId)+'</td><td style="white-space:normal;min-width:130px">'+esc(p.applicant)+(p.applyOrg?'<br><span style="font-size:11.5px;color:#64748b">'+esc(p.applyOrg)+'</span>':'')+'</td><td style="white-space:normal;min-width:260px">'+p.pages.map(function(pid){ return chip(policyPage(pid).label,'allow'); }).join(' ')+'</td><td>'+esc(p.validUntil)+'</td><td>'+stBadge(enabledOf(p)?'生效中':'已停用')+'</td><td>'+esc(p.effectTime)+'</td><td style="white-space:nowrap">'+chip(p.maskLevel||'去标识化','mask')+' '+chip(p.granularity||'市级','gran')+'<br><span style="font-size:11px;color:#64748b">'+esc(p.authType||'API Key')+'</span></td><td style="white-space:nowrap">'+esc(p.version||'v1.0')+' <button class="btn btn-ghost btn-xs" onclick="shPolicyVer(\''+p.policyId+'\')">版本('+verCnt+')</button></td><td class="sticky-col"><button class="btn btn-primary btn-xs" onclick="shPolicyPages(\''+p.policyId+'\')">页面导出</button> <button class="btn btn-ghost btn-xs" onclick="shPolicyToggle(\''+p.policyId+'\')">'+(enabledOf(p)?'停用':'生效')+'</button> <button class="btn btn-ghost btn-xs" onclick="shPolicyEdit(\''+p.policyId+'\')">编辑</button> <button class="btn btn-danger btn-xs" onclick="shPolicyDel(\''+p.policyId+'\')">删除</button></td></tr>';
  }).join('');
  var body=filterBar(page,kwInput(page,'策略ID / 名称 / 被授权人 / 机构')+
      '<div class="form-group"><label>状态</label><select onchange="shSetFilter(\''+page+'\',\'en\',this.value)"><option value="">全部</option><option value="是"'+(en==='是'?' selected':'')+'>生效中</option><option value="否"'+(en==='否'?' selected':'')+'>已停用</option></select></div>')+
    tbl(['策略ID','被授权人 / 机构','可访问页面','有效期至','状态','生效时间','脱敏级别 / 颗粒度 / 授权机制','版本','操作'],rows,1700);
  return '<div class="panel"><div class="panel-header sh-apply-hdr"><span>数据共享策略配置（页面访问授权）</span><span class="sh-hdr-ops"><button class="btn btn-primary btn-sm" onclick="shPolicyEdit(\'\')">新建访问授权</button></span></div><div class="panel-body">'+body+'</div></div>';
}
/* 策略配置与交付令牌两个入口共用同一组合视图：授权 + 交付全部展示，不做区分 */
function renderPolicy(){
  return renderPolicyPanel();
}
/* 页面访问与导出弹窗：每个授权页面一个脱敏导出入口 */
window.shPolicyPages=function(id){
  var p=policies.find(id); if(!p) return;
  var rows=p.pages.map(function(pid){
    var pg=policyPage(pid);
    return '<div class="sh-frow" style="margin-bottom:8px">'+
      '<label style="flex:0 0 120px;text-align:left;font-weight:600;color:#1e293b">'+esc(pg.label)+'</label>'+
      '<div style="flex:1;font-size:12px;color:#94a3b8">'+(pg.cols.length?esc(pg.cols.join(' · ')):'—')+'</div>'+
      '<button class="btn btn-primary btn-xs" onclick="shPolicyExport(\''+p.policyId+'\',\''+pg.id+'\')">脱敏导出</button>'+
    '</div>';
  }).join('')||'<div style="color:#94a3b8;font-size:12.5px">未配置可访问页面</div>';
  modal('页面访问与导出 · '+esc(p.policyId),
    kv([['被授权人',p.applicant],['所属机构',p.applyOrg],['有效期至',p.validUntil],['状态',enabledOf(p)?'生效中':'已停用']])+
    '<div class="sh-sec">可访问页面（点击导出，内容已脱敏）</div>'+rows+
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>导出数据按最小必要原则脱敏：<b>不含姓名、身份证号、联系方式、详细地址</b>等直接标识字段；导出动作自动写入共享操作审计。</span></div>');
};
/* 页面数据脱敏导出：停用授权拦截 + 字段白黑名单 + 脱敏级别 + 真实 CSV 下载 + 审计 */
window.shPolicyExport=function(policyId,pageId){
  var p=policies.find(policyId); if(!p) return false;
  if(!enabledOf(p)){ toast('授权已停用，禁止导出','error'); return false; }
  var pg=policyPage(pageId);
  if(!pg||!pg.cols||!pg.cols.length){ toast('页面未配置导出字段','error'); return false; }
  /* 字段白黑名单：白名单∩页面列，再剔除黑名单；黑名单为空时默认剔除 PII 字段 */
  var allow=(p.allowFields&&p.allowFields.length)?p.allowFields:pg.cols;
  var deny=(p.denyFields&&p.denyFields.length)?p.denyFields:PII_FIELDS;
  var cols=pg.cols.filter(function(c){ return allow.indexOf(c)>=0 && deny.indexOf(c)<0; });
  if(!cols.length){ toast('策略字段配置后无可导出字段','error'); return false; }
  var maskLevel=p.maskLevel||'去标识化';
  var n=30,rows=[];
  for(var i=0;i<n;i++){
    var h=hash(policyId+pageId+'#'+i);
    rows.push(cols.map(function(c){
      var v=pageCellValue(c,h);
      /* 匿名化：直接标识/准标识字段一律泛化或置空；去标识化：PII 掩码；不脱敏：原值 */
      if(maskLevel==='匿名化' && (PII_FIELDS.indexOf(c)>=0 || ['发病部位','病理类型','确诊日期','死亡日期','最后接触日期'].indexOf(c)>=0)) return '—';
      if(maskLevel==='去标识化' && PII_FIELDS.indexOf(c)>=0){
        if(c==='姓名') return v.slice(0,1)+'*某';
        if(c==='身份证号') return (String(v).length>=6?String(v).slice(0,6):'******')+'********'+(String(v).length>=14?String(v).slice(-4):'');
        if(c==='户籍地址') return '江西省**市**区（泛化）';
        if(c==='联系电话') return '138****'+String(h%9000+1000);
      }
      return v;
    }).join(','));
  }
  var csv=cols.join(',')+'\n'+rows.join('\n');
  var fileName=pg.label+'_脱敏导出('+maskLevel+').csv';
  if(!realDownload(fileName,'text/csv;charset=utf-8',csv)){ toast('当前环境不支持文件下载','error'); return false; }
  shAudit('导出',p.policyId,'按授权「'+p.policyName+'」脱敏导出「'+pg.label+'」数据 '+n+' 条（脱敏级别 '+maskLevel+'，字段白名单 '+cols.length+' 项）',null,{page:pg.label,rows:n,maskLevel:maskLevel});
  toast('已脱敏导出：'+fileName+'（'+n+' 条，'+maskLevel+'）');
  return true;
};
window.shPolicyEdit=function(id){
  var p=id?policies.find(id):null;
  var pagesChk='<div class="sh-chk">'+ACCESS_PAGES.map(function(pg){
    return '<label><input type="checkbox" name="sh-c-page" value="'+esc(pg.id)+'"'+((p?(p.pages||[]):[]).indexOf(pg.id)>=0?' checked':'')+'>'+esc(pg.label)+'</label>';
  }).join('')+'</div>';
  var sel=function(id,arr,cur){ return '<select id="'+id+'">'+arr.map(function(o){ return '<option'+(o===(cur||arr[0])?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>'; };
  var allowChk='<div class="sh-chk">'+FIELD_POOL.map(function(f){
    return '<label><input type="checkbox" name="sh-c-allow" value="'+esc(f)+'"'+((p&&(p.allowFields||[]).indexOf(f)>=0)?' checked':'')+'>'+esc(f)+'</label>';
  }).join('')+'</div>';
  var denyChk='<div class="sh-chk">'+FIELD_POOL.map(function(f){
    return '<label><input type="checkbox" name="sh-c-deny" value="'+esc(f)+'"'+((p&&(p.denyFields||[]).indexOf(f)>=0)?' checked':'')+'>'+esc(f)+'</label>';
  }).join('')+'</div>';
  modal(p?'编辑访问授权 · '+esc(p.policyId):'新建页面访问授权',
    '<div class="sh-frow"><label>被授权人 *</label><input id="sh-p-app" value="'+esc(p?p.applicant:'')+'" placeholder="如：科研岗·陈涛"></div>'+
    '<div class="sh-frow"><label>所属机构</label><input id="sh-p-org" value="'+esc(p?p.applyOrg:'')+'" placeholder="如：南昌大学公共卫生学院"></div>'+
    '<div class="sh-frow"><label style="align-self:flex-start;margin-top:4px">可访问页面 *</label>'+pagesChk+'</div>'+
    '<div class="sh-frow"><label>脱敏级别</label>'+sel('sh-p-mask',MASK_LEVELS,p?p.maskLevel:'去标识化')+'</div>'+
    '<div class="sh-frow"><label style="align-self:flex-start;margin-top:4px">字段白名单<br><span style="font-size:11px;color:#94a3b8">允许共享字段</span></label>'+allowChk+'</div>'+
    '<div class="sh-frow"><label style="align-self:flex-start;margin-top:4px">字段黑名单<br><span style="font-size:11px;color:#94a3b8">禁止共享字段</span></label>'+denyChk+'</div>'+
    '<div class="sh-frow"><label>最小颗粒度</label>'+sel('sh-p-gran',GRANULARITY,p?p.granularity:'市级')+'<div class="hint">共享数据仅下钻到该行政级别</div></div>'+
    '<div class="sh-frow"><label>授权机制</label>'+sel('sh-p-auth',POLICY_AUTH,p?p.authType:'API Key')+'</div>'+
    '<div class="sh-frow"><label>有效期至</label><input id="sh-p-vu" value="'+esc(p?p.validUntil:'2027-12-31')+'" placeholder="如 2027-12-31"></div>'+
    '<div class="sh-frow"><label>授权名称</label><input id="sh-p-name" value="'+esc(p?p.policyName:'')+'" placeholder="留空自动生成：访问授权·机构"></div>'+
    '<div style="font-size:12px;color:#94a3b8;padding-left:120px">授权生效后被授权人可访问所选页面，页面数据导出按脱敏级别与字段白黑名单处理（直接标识字段默认纳入黑名单）。</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shPolicySubmit(\''+(p?p.policyId:'')+'\')">保存授权</button>');
};
window.shPolicySubmit=function(id){
  var app=fv('sh-p-app'),org=fv('sh-p-org'),vu=fv('sh-p-vu'),pages=chkVals('sh-c-page');
  var mask=fv('sh-p-mask')||'去标识化',allow=chkVals('sh-c-allow'),deny=chkVals('sh-c-deny'),
      gran=fv('sh-p-gran')||'市级',auth=fv('sh-p-auth')||'API Key';
  if(!app){ toast('请填写被授权人','error'); return; }
  if(!pages.length){ toast('请至少勾选一个可访问页面','error'); return; }
  var name=fv('sh-p-name')||('访问授权·'+(org||app));
  if(id){
    var p=policies.find(id); if(!p) return;
    var before={applicant:p.applicant,pages:p.pages,validUntil:p.validUntil,policyName:p.policyName,
      maskLevel:p.maskLevel,allowFields:p.allowFields,denyFields:p.denyFields,granularity:p.granularity,authType:p.authType};
    p.applicant=app; p.applyOrg=org; p.pages=pages; p.validUntil=vu; p.policyName=name;
    p.maskLevel=mask; p.allowFields=allow; p.denyFields=deny; p.granularity=gran; p.authType=auth;
    addPolicyVersion(p,'编辑保存（脱敏级别 '+mask+' / 颗粒度 '+gran+' / 授权机制 '+auth+'）');
    policies.save(); policyVer.save(); closeTopModal(); renderPage('sh-policy');
    shAudit('编辑',p.policyId,'编辑访问授权「'+name+'」',before,{applicant:app,pages:pages,validUntil:vu,maskLevel:mask,granularity:gran,authType:auth});
    toast('授权已保存（已生成版本 '+p.version+'）');
    return;
  }
  var mx=0; policies.all().forEach(function(x){ var m=/P-\d{4}-(\d+)/.exec(String(x.policyId)); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
  var nid='P-'+now().slice(0,4)+'-'+p4(mx+1);
  var np={policyId:nid,policyName:name,applicant:app,applyOrg:org,pages:pages,
    validUntil:vu,enabled:'是',creator:op(),effectTime:now(),
    maskLevel:mask,allowFields:allow,denyFields:deny,granularity:gran,authType:auth,version:'v1.0'};
  policies.all().push(np);
  addPolicyVersion(np,'初始版本','v1.0');
  policies.save(); policyVer.save(); closeTopModal(); renderPage('sh-policy');
  shAudit('新增',nid,'新建页面访问授权「'+name+'」（'+pages.length+' 个页面，默认生效，脱敏级别 '+mask+'）',null,{policyId:nid,pages:pages,maskLevel:mask,granularity:gran,authType:auth});
  toast('访问授权已创建：'+nid+'（默认生效，版本 v1.0）');
};
window.shPolicyToggle=function(id){
  var p=policies.find(id); if(!p) return;
  p.enabled=!p.enabled;
  policies.save(); renderPage('sh-policy');
  shAudit('启停',p.policyId,(p.enabled?'生效':'停用')+'访问授权「'+p.policyName+'」',null,{enabled:p.enabled});
  toast('授权「'+p.policyName+'」已'+(p.enabled?'生效':'停用')+(p.enabled?'':'，页面导出已同步禁止'));
};
window.shPolicyDel=function(id){
  var p=policies.find(id); if(!p) return;
  showConfirm('删除访问授权','确认删除授权「'+p.policyName+'」吗？被授权人将立即失去所选页面的访问与导出能力。',function(){
    var before={policyId:p.policyId,policyName:p.policyName,pages:p.pages,enabled:p.enabled};
    var idx=policies.all().indexOf(p); if(idx>=0) policies.all().splice(idx,1);
    /* 清理该策略的全部版本历史 */
    var vs=policyVer.all().filter(function(v){ return v.policyId===id; });
    vs.forEach(function(v){ var i=policyVer.all().indexOf(v); if(i>=0) policyVer.all().splice(i,1); });
    policies.save(); policyVer.save(); renderPage('sh-policy');
    shAudit('删除',p.policyId,'删除访问授权「'+p.policyName+'」',before,null);
    toast('访问授权已删除');
  });
};
/* ---------- 策略版本管理（保存 / 查看 / 回滚） ---------- */
function addPolicyVersion(p,note,forceVer){
  var list=policyVer.all();
  var used=list.filter(function(x){ return x.policyId===p.policyId; }).map(function(x){ return x.version; });
  var v=forceVer||bumpVersion(p.version), guard=0;
  while(!forceVer&&used.indexOf(v)>=0&&guard<60){ v=bumpVersion(v); guard++; }
  var mx=0;
  list.forEach(function(x){ var m=/PVER-(\d+)/.exec(String(x.verId)); if(m) mx=Math.max(mx,parseInt(m[1],10)); });
  list.forEach(function(x){ if(x.policyId===p.policyId) x.isCurrent='否'; });
  list.unshift({verId:'PVER-'+p4(mx+1),policyId:p.policyId,version:v,note:note||'配置变更',
    time:now(),operator:op(),isCurrent:'是',snapshot:JSON.stringify(policyCfgOf(p))});
  p.version=v;
  return v;
}
window.shPolicyVerSave=function(id){
  var p=policies.find(id); if(!p) return;
  var note=fv('sh-p-vernote')||'手动保存配置快照';
  var v=addPolicyVersion(p,note);
  policyVer.save(); closeTopModal(); renderPage('sh-policy');
  shAudit('版本',id,'保存策略 '+id+' 新版本 '+v+'：'+note,null,{version:v});
  toast('已保存版本 '+v);
};
window.shPolicyVer=function(id){
  var p=policies.find(id); if(!p) return;
  var rows=policyVer.all().filter(function(v){ return v.policyId===id; }).map(function(v){
    return '<tr><td>'+esc(v.version)+'</td><td>'+(v.isCurrent==='是'?stBadge('当前'):'—')+'</td><td style="white-space:normal">'+esc(v.note)+'</td><td>'+esc(v.operator)+'</td><td>'+esc(v.time)+'</td><td class="sticky-col">'+
      '<button class="btn btn-ghost btn-xs" onclick="shPolicyVerSnap(\''+v.verId+'\')">快照</button> '+
      (v.isCurrent==='是'?'<span style="color:#94a3b8;font-size:11px">当前版本</span>':'<button class="btn btn-danger btn-xs" onclick="shPolicyRollback(\''+v.verId+'\')">回滚</button>')+
      '</td></tr>';
  }).join('');
  var body=tbl(['版本','状态','变更说明','操作人','保存时间','操作'],rows,760)+
    '<div class="sh-frow" style="margin-top:12px"><label>变更说明</label><input id="sh-p-vernote" placeholder="如：调整脱敏级别为匿名化"></div>';
  modal('策略版本管理 · '+esc(p.policyId)+' '+esc(p.policyName),
    kv([['当前版本',p.version],['脱敏级别',p.maskLevel],['最小颗粒度',p.granularity],['授权机制',p.authType]])+
    '<div class="sh-sec">版本历史（可回滚）</div>'+body+
    '<div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="shPolicyVerSave(\''+id+'\')">保存当前为版本</button></div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">关闭</button>');
};
window.shPolicyVerSnap=function(verId){
  var v=policyVer.all().filter(function(x){ return x.verId===verId; })[0]; if(!v) return;
  var pre=function(t){ try{ return JSON.stringify(JSON.parse(t),null,2); }catch(e){ return t; } };
  modal('版本快照 · '+esc(v.policyId)+' '+esc(v.version),
    kv([['版本',v.version],['变更说明',v.note],['操作人',v.operator],['保存时间',v.time]])+
    '<div class="sh-sec">配置快照（JSON）</div><pre>'+esc(pre(v.snapshot))+'</pre>');
};
window.shPolicyRollback=function(verId){
  var v=policyVer.all().filter(function(x){ return x.verId===verId; })[0]; if(!v) return;
  var p=policies.find(v.policyId); if(!p) return;
  showConfirm('回滚策略版本','确认将策略 '+v.policyId+' 从 '+p.version+' 回滚到 '+v.version+' 吗？回滚前会自动把当前配置保存为备份版本。',function(){
    var snap;
    try{ snap=JSON.parse(v.snapshot); }catch(e){ toast('版本快照解析失败，无法回滚','error'); return; }
    var beforeVer=p.version;
    addPolicyVersion(p,'回滚前自动备份（原版本 '+beforeVer+'）');
    POLICY_CFG_KEYS.forEach(function(k){ if(snap[k]!==undefined) p[k]=snap[k]; });
    p.version=v.version;
    policyVer.all().forEach(function(x){ if(x.policyId===p.policyId) x.isCurrent=(x.verId===v.verId?'是':'否'); });
    policies.save(); policyVer.save(); closeTopModal(); renderPage('sh-policy');
    shAudit('回滚',p.policyId,'策略 '+p.policyId+' 从 '+beforeVer+' 回滚至 '+v.version+'（当前配置已备份）',
      {version:beforeVer},{version:v.version,maskLevel:p.maskLevel,granularity:p.granularity,authType:p.authType});
    toast('已回滚至版本 '+v.version+'（原配置已备份）');
  });
};

/* ---------- 页面：共享交付与令牌（功能点21） ---------- */
function tokenBadge(d){
  var st=tokenState(d);
  if(st==='有效') return stBadge('有效')+'<span style="font-size:11.5px;color:#64748b">剩 '+daysLeft(d.tokenExpire)+' 天</span>';
  if(st==='已过期') return stBadge('已过期');
  return stBadge('已吊销')+'<span style="font-size:11.5px;color:#64748b">'+esc(d.revokedTime||'')+'</span>';
}
function renderDeliveryPanel(){
  var page='sh-delivery';
  var kw=(shF(page,'kw')||'').toLowerCase(); var st=shF(page,'st');
  var all=deliveries.all();
  var rows=all.filter(function(d){
      if(st&&tokenState(d)!==st) return false;
      if(kw&&[d.deliveryId,d.applyId,d.policyId,d.apiEndpoint].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    }).map(function(d){
      var a=applies.find(d.applyId);
      var tokenShow=d.token?(d.token.slice(0,8)+'••••••••'+d.token.slice(-6)):'<span style="color:#b91c1c">已吊销</span>';
      var eps='<div style="font-family:monospace;font-size:11px;white-space:normal;min-width:200px">'+esc(d.apiEndpoint)+
        '<br><span style="color:#2563eb">'+esc(d.downloadUrl)+'</span></div>';
      var ops='<button class="btn btn-primary btn-xs" onclick="shDeliveryDownload(\''+d.deliveryId+'\')">下载附件</button> '+
        (tokenState(d)!=='已吊销'?'<button class="btn btn-danger btn-xs" onclick="shDeliveryRevoke(\''+d.deliveryId+'\')">吊销令牌</button>':'');
      return '<tr><td>'+esc(d.deliveryId)+'</td><td style="white-space:normal;min-width:150px">'+esc(d.applyId)+(a?'<br><span style="font-size:11.5px;color:#64748b">'+esc(a.applyOrg)+'</span>':'')+'</td><td>'+chip(d.deliveryType||'文件下载','type')+'</td><td>'+eps+'</td><td style="font-family:monospace;font-size:11.5px">'+esc(tokenShow)+'<br><span style="font-size:11px;color:#64748b">API Key 型令牌</span></td><td>'+tokenBadge(d)+'</td><td>'+esc(d.genTime)+'</td><td class="sticky-col">'+ops+'</td></tr>';
    }).join('');
  var body=filterBar(page,kwInput(page,'交付ID / 申请ID / 端点')+
      '<div class="form-group"><label>凭证状态</label><select onchange="shSetFilter(\''+page+'\',\'st\',this.value)"><option value="">全部</option>'+
      ['有效','已过期','已吊销'].map(function(s){ return '<option value="'+s+'"'+(st===s?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></div>')+
    tbl(['交付ID','关联申请','交付方式','接口地址 / 下载链接','访问令牌','凭证状态','交付时间','操作'],rows,1500);
  return '<div class="panel"><div class="panel-header sh-apply-hdr"><span>共享交付与令牌</span><span class="sh-hdr-ops"><button class="btn btn-primary btn-sm" onclick="shDeliveryNew()">生成交付凭证</button></span></div><div class="panel-body">'+body+'</div></div>';
}
function renderDelivery(){
  return renderDeliveryPanel();
}
window.shDeliveryNew=function(){
  var approved=applies.all().filter(function(a){ return a.applyStatus==='已批准'; });
  if(!approved.length){ toast('暂无「已批准」的申请，请先在「数据共享申请审批」完成审批','error'); return; }
  var active=policies.all().filter(function(p){ return p.enabled==='是'||p.enabled===true; });
  if(!active.length){ toast('暂无生效中的共享策略','error'); return; }
  var apOpts=approved.map(function(a){ return '<option value="'+a.applyId+'">'+esc(a.applyId+' · '+a.applyOrg)+'</option>'; }).join('');
  var plOpts=active.map(function(p){ return '<option value="'+p.policyId+'">'+esc(p.policyId+' · '+p.policyName)+'</option>'; }).join('');
  var sel=function(id,opts){ return '<select id="'+id+'">'+opts+'</select>'; };
  modal('生成交付凭证',
    '<div class="sh-frow"><label>已批准申请</label>'+sel('sh-d-apply',apOpts)+'</div>'+
    '<div class="sh-frow"><label>执行策略</label>'+sel('sh-d-policy',plOpts)+'</div>'+
    '<div class="sh-frow"><label>交付方式</label>'+sel('sh-d-type',DELIVERY_TYPES)+'</div>'+
    '<div class="sh-frow"><label>接口地址</label><input id="sh-d-ep" placeholder="数据接收方接口地址，留空自动生成 https://share.jxcdc.org/api/v1/delivery/<交付ID>"><div class="hint">沙箱取数默认 https://sandbox.jxcdc.org/v1/<交付ID>/query</div></div>'+
    '<div class="sh-frow"><label>交付文件格式</label>'+sel('sh-d-fmt',['CSV','JSON'],'CSV')+'</div>'+
    '<div class="sh-frow"><label>令牌有效期</label>'+sel('sh-d-days',['7 天','30 天','90 天'],'7 天')+'</div>'+
    '<div style="font-size:12px;color:#94a3b8;padding-left:120px">交付记录数 / 大小按申请数据范围估算；交付内容按策略脱敏固化，令牌默认 7 天有效。</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shDeliverySubmit()">生成交付</button>');
};
window.shDeliverySubmit=function(){
  var a=applies.find(fv('sh-d-apply'));
  var p=policies.find(fv('sh-d-policy'));
  if(!a||a.applyStatus!=='已批准'){ toast('申请状态已变化，请刷新后重试','error'); return; }
  if(!p||!(p.enabled==='是'||p.enabled===true)){ toast('所选策略未生效','error'); return; }
  var days=parseInt(fv('sh-d-days'),10)||7;
  var nid='SHD-'+now().slice(0,4)+'-'+p4(deliveries.all().length+20);
  var rec=50+(hash(a.applyId+p.policyId)%1950);
  var sizeKb=Math.round(rec*0.35*10)/10;
  var deliveryType=fv('sh-d-type')||'文件下载';
  var fmt=fv('sh-d-fmt')||'CSV';
  /* 接口地址：优先使用配置的数据接收方地址，留空按交付方式自动生成 */
  var ep=fv('sh-d-ep')||(deliveryType==='沙箱取数'
    ?('https://sandbox.jxcdc.org/v1/'+nid+'/query')
    :('https://share.jxcdc.org/api/v1/delivery/'+nid+(deliveryType==='接口推送'?'/push':'')));
  deliveries.all().push({deliveryId:nid,applyId:a.applyId,policyId:p.policyId,deliveryType:deliveryType,
    apiEndpoint:ep,sandboxId:'SBX-'+p4(hash(nid)%9000+1000),
    filePath:(deliveryType==='沙箱取数'?'/sandbox/'+nid+'/dataset':'/share/'+now().slice(0,4)+'/'+nid+'/dataset.'+fmt.toLowerCase()),
    fileFormat:fmt,recordCount:rec,sizeKb:sizeKb,token:genToken(nid),tokenStatus:'有效',tokenExpire:plusDays(days,'23:59'),
    revokedTime:'—',downloadUrl:ep.replace(/\/(push|query)$/,'')+'/download',genTime:now()});
  deliveries.save();
  renderPage('sh-delivery');
  shAudit('交付',nid,'按策略「'+p.policyName+'」为申请 '+a.applyId+' 生成交付凭证（令牌 '+days+' 天，接口地址 '+ep+'）',null,{deliveryId:nid,applyId:a.applyId,policyId:p.policyId,apiEndpoint:ep,tokenExpire:plusDays(days,'23:59')});
  toast('交付凭证已生成：'+nid+'（按策略「'+p.policyName+'」脱敏）');
};
/* 凭证状态管理：主动吊销访问令牌（吊销后下载一律拦截并写高风险监控日志） */
window.shDeliveryRevoke=function(id){
  var d=deliveries.find(id); if(!d) return;
  if(tokenState(d)==='已吊销'){ toast('该交付的令牌已是吊销状态','error'); return; }
  showConfirm('吊销访问令牌','确认吊销交付 '+d.deliveryId+' 的访问令牌吗？吊销后凭证立即失效，所有下载将被拦截并记录高风险日志。',function(){
    var before={tokenStatus:d.tokenStatus||'有效'};
    d.tokenStatus='已吊销'; d.revokedTime=now();
    deliveries.save(); renderPage('sh-delivery');
    shAudit('吊销',d.deliveryId,'吊销交付 '+d.deliveryId+' 的访问令牌（凭证状态置为已吊销）',before,{tokenStatus:'已吊销',revokedTime:d.revokedTime});
    toast('令牌已吊销：'+d.deliveryId+'（凭证已失效）');
  });
};
/* 按策略脱敏生成 CSV 真实下载，并写使用监控日志 + 审计 */
window.shDeliveryDownload=function(id){
  var d=deliveries.find(id); if(!d) return;
  var p=policies.find(d.policyId);
  var a=applies.find(d.applyId);
  var st=tokenState(d);
  if(st!=='有效'){
    /* 拦截 + 写高风险监控日志 */
    var mid=nextMonitorId();
    monitors.all().unshift({monitorId:mid,deliveryId:d.deliveryId,userId:op(),ip:'192.168.1.100',accessTime:now(),
      opType:'令牌验证失败',accessParams:'{"token":"'+st+'"}',rowCount:0,
      abnormal:'是',riskLevel:'高',approvalId:d.applyId,remark:'令牌已'+st+'仍尝试下载「'+d.deliveryId+'」，已拦截',
      handleStatus:'未处置',handleBy:'—',handleTime:'—',handleNote:''});
    monitors.save(); renderPage('sh-delivery');
    shAudit('下载拦截',d.deliveryId,'令牌'+st+'，拦截对交付 '+d.deliveryId+' 的下载并写入高风险监控日志 '+mid,null,{monitorId:mid});
    toast('访问令牌已'+st+'，已拦截并记录异常','error');
    return;
  }
  /* 模拟脱敏数据：禁止字段不导出；直接标识按规则掩码 */
  var allow=(p&&p.allowFields)||FIELD_POOL;
  var deny=(p&&p.denyFields)||[];
  var cols=allow.filter(function(f){ return deny.indexOf(f)<0; });
  if(!cols.length){ toast('策略字段配置异常（允许字段全部被禁止）','error'); return; }
  var maskName=function(n){ var s=['张','李','王','刘','陈','赵','黄','周','徐','孙','马','朱'][hash(n)%12]; return s+'*某'; };
  var maskId=function(v){ v=String(v||'360102196501011234'); return v.slice(0,6)+'********'+v.slice(-4); };
  var records=Math.min(d.recordCount||50,50);
  var rows=[];
  for(var i=0;i<records;i++){
    var h=hash(d.deliveryId+'#'+i);
    var row=cols.map(function(c){
      switch(c){
        case '登记编号': return 'JX-'+d.deliveryId.slice(4,8)+'-'+p4(h%9000+1000);
        case '姓名': return maskName(String.fromCharCode(65+h%26));
        case '性别': return h%2?'男':'女';
        case '出生日期': return (1950+h%50)+'-'+p2(h%12+1)+'-'+p2(h%28+1);
        case '身份证号': return maskId('');
        case '户籍地址': return '江西省**市**区（泛化）';
        case '发病部位': return ['肺','胃','肝','结直肠','乳腺','甲状腺'][h%6];
        case '病理类型': return ['腺癌','鳞状细胞癌','导管癌','乳头状癌'][h%4];
        case 'ICD-10': return ['C34','C16','C22','C18','C50','C73'][h%6]+'.9';
        case '确诊日期': return (2020+h%4)+'-'+p2(h%12+1)+'-'+p2(h%28+1);
        case '诊断依据': return ['病理学诊断','临床诊断','影像学诊断'][h%3];
        case '随访状态': return h%3?'存活':'死亡';
        case '生存月数': return h%96;
        case '根本死因': return h%3?['C34','C22','C16'][h%3]:'-';
        default: return String(h%900+100);
      }
    });
    rows.push(row.join(','));
  }
  var csv=cols.join(',')+'\n'+rows.join('\n');
  var fileName=d.deliveryId+'_masked.csv';
  if(!realDownload(fileName,'text/csv;charset=utf-8',csv)){ toast('当前环境不支持文件下载','error'); return; }
  /* 写使用监控日志 */
  var mid2=nextMonitorId();
  monitors.all().unshift({monitorId:mid2,deliveryId:d.deliveryId,userId:op(),ip:'192.168.1.100',accessTime:now(),
    opType:'下载',accessParams:'{"file":"'+fileName+'","fields":"'+cols.length+'个","rows":'+records+'}',rowCount:records,
    abnormal:'否',riskLevel:'低',approvalId:d.applyId,remark:'策略内字段下载（'+(p?p.policyId:'默认')+'，'+records+' 条脱敏记录）',
    handleStatus:'',handleBy:'—',handleTime:'—',handleNote:''});
  monitors.save();
  renderPage('sh-delivery');
  shAudit('下载',d.deliveryId,'按策略「'+(p?p.policyId:'默认')+'」下载脱敏数据 '+fileName+'（'+records+' 条，写监控日志 '+mid2+'）',null,{monitorId:mid2,records:records});
  toast('已下载脱敏数据 '+fileName+'（'+records+' 条，写入监控日志 '+mid2+'）');
};

/* ---------- 页面：使用行为监控（功能点22，含处置闭环） ---------- */
function nextMonitorId(){
  var mx=0; monitors.all().forEach(function(m){ var r=/MON-(\d+)/.exec(String(m.monitorId)); if(r) mx=Math.max(mx,parseInt(r[1],10)); });
  return 'MON-'+p4(mx+1);
}
function handleBadge(m){
  if(m.abnormal!=='是') return '<span style="color:#94a3b8;font-size:12px">—</span>';
  return stBadge(m.handleStatus||'未处置');
}
/* 监控日志查询口径：页面渲染与导出共用（关键字 / 使用者 / 时间范围 / 风险等级 / 处置状态） */
function monitorQuery(){
  var page='sh-monitor';
  var kw=(shF(page,'kw')||'').toLowerCase(); var abn=shF(page,'abn'); var risk=shF(page,'risk'); var hs=shF(page,'hs');
  var d1=shF(page,'d1'); var d2=shF(page,'d2');
  return monitors.all().filter(function(m){
      if(abn&&m.abnormal!==abn) return false;
      if(risk&&m.riskLevel!==risk) return false;
      if(hs&&((m.abnormal!=='是')?true:(m.handleStatus||'未处置')!==hs)) return false;
      if(d1&&String(m.accessTime||'').slice(0,10)<d1) return false;
      if(d2&&String(m.accessTime||'').slice(0,10)>d2) return false;
      if(kw&&[m.monitorId,m.deliveryId,m.userId,m.ip].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    });
}
function renderMonitor(){
  var page='sh-monitor';
  var abn=shF(page,'abn'); var risk=shF(page,'risk'); var hs=shF(page,'hs');
  var d1=shF(page,'d1'); var d2=shF(page,'d2');
  var rows=monitorQuery().map(function(m){
      var ops='<button class="btn btn-ghost btn-xs" onclick="shMonitorDetail(\''+m.monitorId+'\')">详情</button>';
      if(m.abnormal==='是'&&(m.handleStatus||'未处置')==='未处置')
        ops=' <button class="btn btn-primary btn-xs" onclick="shMonitorHandle(\''+m.monitorId+'\',\'handle\')">处置</button> <button class="btn btn-ghost btn-xs" onclick="shMonitorHandle(\''+m.monitorId+'\',\'ignore\')">忽略</button> '+ops;
      return '<tr><td>'+esc(m.monitorId)+'</td><td>'+esc(m.accessTime)+'</td><td style="white-space:normal;min-width:150px">'+esc(m.userId)+'</td><td>'+esc(m.ip)+'</td><td>'+esc(m.deliveryId)+'</td><td>'+bText(m.opType,'badge-info')+'</td><td>'+esc(m.rowCount)+'</td><td>'+bText(m.abnormal,m.abnormal==='是'?'badge-danger':'badge-success')+'</td><td>'+riskBadge(m.riskLevel)+'</td><td>'+handleBadge(m)+'</td><td style="white-space:normal;min-width:200px;max-width:320px">'+esc(m.remark)+'</td><td class="sticky-col">'+ops+'</td></tr>';
    }).join('');
  /* 异常预警：存在未处置异常时顶部醒目提示（检测到异常即自动触发预警） */
  var openAbn=monitors.all().filter(function(m){ return m.abnormal==='是'&&(m.handleStatus||'未处置')==='未处置'; });
  var nHigh=openAbn.filter(function(m){ return m.riskLevel==='高'; }).length;
  var alertBanner=openAbn.length?
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:13px">'+
      '<span style="font-weight:600">⚠ 异常预警</span>'+
      '<span>检测到 <b>'+openAbn.length+'</b> 条未处置异常行为（高风险 '+nHigh+' 条 / 中风险 '+(openAbn.length-nHigh)+' 条），已自动触发预警，请及时处置。</span>'+
      '<button class="btn btn-outline btn-xs" style="border-color:#fca5a5;color:#b91c1c" onclick="shMonitorAlertView()">查看待处置</button>'+
    '</div>':'';
  var body=alertBanner+filterBar(page,kwInput(page,'日志ID / 交付ID / 使用者 / IP')+
      '<div class="form-group"><label>是否异常</label><select onchange="shSetFilter(\''+page+'\',\'abn\',this.value)"><option value="">全部</option><option value="是"'+(abn==='是'?' selected':'')+'>异常</option><option value="否"'+(abn==='否'?' selected':'')+'>正常</option></select></div>'+
      '<div class="form-group"><label>风险等级</label><select onchange="shSetFilter(\''+page+'\',\'risk\',this.value)"><option value="">全部</option>'+['高','中','低'].map(function(s){ return '<option'+(risk===s?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label>处置状态</label><select onchange="shSetFilter(\''+page+'\',\'hs\',this.value)"><option value="">全部</option>'+HANDLE_STATUS.map(function(s){ return '<option'+(hs===s?' selected':'')+'>'+s+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label>开始日期</label><input type="date" value="'+esc(d1)+'" onchange="shSetFilter(\''+page+'\',\'d1\',this.value)"></div>'+
      '<div class="form-group"><label>结束日期</label><input type="date" value="'+esc(d2)+'" onchange="shSetFilter(\''+page+'\',\'d2\',this.value)"></div>')+
    tbl(['监控日志ID','访问时间','使用者','访问IP','交付ID','操作类型','返回记录数','是否异常','风险等级','处置状态','备注','操作'],rows,1800);
  return shPage('使用行为监控',
    '<button class="btn btn-primary btn-sm" onclick="shMonitorSim()">模拟接入请求</button>'+
    '<button class="btn btn-outline btn-sm" onclick="shMonExportDlg()">导出日志</button>',body);
}
window.shMonitorAlertView=function(){ shFilters['sh-monitor']={abn:'是',hs:'未处置'}; renderPage('sh-monitor'); };
window.shMonitorDetail=function(mid){
  var m=monitors.find(mid); if(!m) return;
  var params=m.accessParams; try{ params=JSON.stringify(JSON.parse(m.accessParams),null,2); }catch(e){}
  modal('监控日志 · '+esc(m.monitorId),
    kv([['监控日志ID',m.monitorId],['交付ID',m.deliveryId],['使用者ID',m.userId],['访问IP',m.ip],['访问时间',m.accessTime],['操作类型',m.opType],['返回记录数',m.rowCount],['是否异常行为',m.abnormal],['风险等级',m.riskLevel],['关联审批ID',m.approvalId],['备注',m.remark]])+
    (m.abnormal==='是'?'<div class="sh-sec">处置信息</div>'+kv([['处置状态',m.handleStatus||'未处置'],['处置人',m.handleBy],['处置时间',m.handleTime],['处置说明',m.handleNote||'—']]):'')+
    '<div class="sh-sec">访问参数</div><pre>'+esc(params)+'</pre>');
};
/* 处置 / 忽略弹窗 */
window.shMonitorHandle=function(mid,mode){
  var m=monitors.find(mid); if(!m) return;
  var isHandle=mode==='handle';
  modal((isHandle?'处置':'忽略')+'异常行为 · '+esc(m.monitorId),
    kv([['监控日志ID',m.monitorId],['交付ID',m.deliveryId],['使用者',m.userId],['访问IP',m.ip],['访问时间',m.accessTime],['操作类型',m.opType],['风险等级',m.riskLevel],['异常说明',m.remark]])+
    '<div class="sh-sec">'+(isHandle?'处置说明（必填）':'忽略理由（必填）')+'</div><textarea id="sh-f-hnote" style="width:100%;border:1px solid #d1d8e0;border-radius:4px;padding:6px 10px;font-size:13px;height:64px" placeholder="'+(isHandle?'如：已封禁来源 IP，函告机构核查':'如：确认属策略口径内行为，无需处置')+'"></textarea>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shMonitorHandleSubmit(\''+mid+'\',\''+mode+'\')">'+(isHandle?'确认处置':'确认忽略')+'</button>');
};
window.shMonitorHandleSubmit=function(mid,mode){
  var m=monitors.find(mid); if(!m||m.abnormal!=='是') return;
  var note=fv('sh-f-hnote');
  if(!note){ toast(mode==='handle'?'处置说明必填':'忽略理由必填','error'); return; }
  var before={handleStatus:m.handleStatus||'未处置'};
  m.handleStatus=mode==='handle'?'已处置':'已忽略';
  m.handleBy=op(); m.handleTime=now(); m.handleNote=note;
  monitors.save(); closeTopModal(); renderPage('sh-monitor');
  shAudit(mode==='handle'?'处置':'忽略',m.monitorId,(mode==='handle'?'处置':'忽略')+'异常行为 '+m.monitorId+'：'+note,before,{handleStatus:m.handleStatus,handleBy:m.handleBy,handleTime:m.handleTime});
  toast('日志 '+mid+' 已'+(mode==='handle'?'处置':'忽略'));
};
/* 模拟外部接入请求：对最新有效交付生成一条访问日志（确定性判定） */
window.shMonitorSim=function(){
  var d=deliveries.all().filter(function(x){ return tokenState(x)==='有效'; })[0];
  if(!d){ toast('暂无有效令牌的交付凭证','error'); return; }
  var p=policies.find(d.policyId);
  var opTypes=['查询','查询','下载','批量拉取'];
  var otp=opTypes[hash(now()+d.deliveryId)%opTypes.length];
  var deny=(p&&p.denyFields)||[];
  var reqFields=allowOf(p);
  var abnormal='否',risk='低',remark='正常访问（策略 '+d.policyId+' 口径内）';
  var rc=20+(hash(d.deliveryId+now())%280);
  if(otp==='批量拉取'&&rc>500){ abnormal='是'; risk='高'; remark='单次拉取 '+rc+' 条，超出单次上限 500 条，已限流'; }
  else if(deny.length&&(hash(now())%4===0)){ abnormal='是'; risk='中'; rc=0; remark='请求字段包含策略禁止字段「'+deny[hash(now())%deny.length]+'」，已按策略过滤'; }
  var a=applies.find(d.applyId);
  var mid=nextMonitorId();
  monitors.all().unshift({monitorId:mid,deliveryId:d.deliveryId,
    userId:(a?a.applyOrg+'·外部用户':'外部用户'),ip:'117.'+(hash(mid)%255)+'.'+(hash(mid+'x')%255)+'.'+(hash(mid+'y')%255),
    accessTime:now(),opType:otp,accessParams:'{"fields":['+reqFields.slice(0,3).map(function(f){ return '"'+f+'"'; }).join(',')+'],"filter":{"delivery":"'+d.deliveryId+'"}}',
    rowCount:rc,abnormal:abnormal,riskLevel:risk,approvalId:d.applyId,remark:remark,
    handleStatus:abnormal==='是'?'未处置':'',handleBy:'—',handleTime:'—',handleNote:''});
  monitors.save();
  shFilters['sh-monitor']={abn:abnormal==='是'?'是':''};
  renderPage('sh-monitor');
  shAudit('模拟接入',mid,'模拟外部接入请求生成访问日志：'+otp+'（'+(abnormal==='是'?'异常 · '+risk+' 风险':'正常')+'）',null,{monitorId:mid});
  if(abnormal==='是') toast('异常预警：接入日志 '+mid+'（'+otp+'）判定为异常 · '+risk+' 风险，已自动触发预警，请及时处置','error');
  else toast('已生成接入日志 '+mid+'：'+otp+'（正常）');
};
/* 导出使用行为监控日志：CSV 供线下审计归档（导出动作写共享操作审计） */
window.shMonExportDlg=function(){
  modal('导出使用行为监控日志',
    '<div class="sh-form-tip"><span class="ico">ℹ</span><span>导出 CSV（Excel/WPS 可直接打开）供线下审计与归档；「当前筛选结果」按页面查询条件（使用者 / 时间 / 风险等级 / 处置状态等）过滤后导出。</span></div>'+
    '<div class="sh-frow"><label>导出范围</label><select id="sh-mex-scope"><option value="filter">当前筛选结果</option><option value="all">全部日志</option></select></div>'+
    '<div style="font-size:12px;color:#94a3b8;padding-left:120px">导出动作自动写入共享操作审计。</div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button>'+
    '<button class="btn btn-primary" onclick="shMonExport()">导出 CSV</button>');
};
window.shMonExport=function(){
  var scope=fv('sh-mex-scope')||'filter';
  var list=scope==='all'?monitors.all().slice():monitorQuery();
  if(!list.length){ toast('无可导出的监控日志','error'); return false; }
  var head=['监控日志ID','交付ID','使用者','访问IP','访问时间','操作类型','访问参数','返回记录数','是否异常','风险等级','关联审批ID','处置状态','处置人','处置时间','处置说明','备注'];
  var lines=[head.map(csvCell).join(',')];
  list.forEach(function(m){
    lines.push([m.monitorId,m.deliveryId,m.userId,m.ip,m.accessTime,m.opType,m.accessParams,m.rowCount,
      m.abnormal,m.riskLevel,m.approvalId,
      (m.abnormal==='是'?(m.handleStatus||'未处置'):'—'),m.handleBy,m.handleTime,m.handleNote,m.remark].map(csvCell).join(','));
  });
  var file='使用行为监控日志_'+now().slice(0,10).replace(/-/g,'')+'.csv';
  var okDl=realDownload(file,'text/csv;charset=utf-8',lines.join('\n'));
  if(!okDl){ toast('当前环境不支持文件下载','error'); return false; }
  closeTopModal();
  shAudit('导出','MONITOR','导出使用行为监控日志（'+(scope==='all'?'全部':'当前筛选')+'，'+list.length+' 条，CSV）',null,{file:file,count:list.length});
  toast('已导出：'+file+'（'+list.length+' 条日志）');
  return true;
};
function allowOf(p){
  var allow=(p&&p.allowFields)||FIELD_POOL;
  var deny=(p&&p.denyFields)||[];
  return allow.filter(function(f){ return deny.indexOf(f)<0; });
}

/* ---------- 页面：共享数据元数据血缘（功能点23，支持补录/编辑） ---------- */
/* 血缘路径最短展示：表名 → ODS → DWD → DWS → 共享交付层 */
function pathShort(path){
  return String(path||'').split('→').map(function(seg){
    var s=seg.trim();
    if(/^(ODS|DWD|DWS|共享交付层)/.test(s)) return s.split('.')[0];
    return s.indexOf('.')>=0?s.slice(s.lastIndexOf('.')+1):s;
  }).join(' → ');
}
/* 列表内长文本截断展示（完整内容见详情弹窗） */
function clipText(v,n){ v=String(v||''); return v.length>n?v.slice(0,n)+'…':v; }
function renderLineage(){
  var page='sh-lineage';
  var kw=(shF(page,'kw')||'').toLowerCase(); var plat=shF(page,'plat'); var pii=shF(page,'pii'); var sev=shF(page,'sev'); var dt=shF(page,'dt');
  var all=lineages.all();
  var rows=all.filter(function(l){
      if(plat&&l.sourcePlatformId!==plat) return false;
      if(pii&&l.isPii!==pii) return false;
      if(sev&&l.sensLevel!==sev) return false;
      if(dt&&l.dataType!==dt) return false;
      if(kw&&[l.metaId,l.fieldCn,l.fieldEn,l.fieldDesc,l.srcTable].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    }).map(function(l){
      return '<tr><td>'+esc(l.metaId)+'</td><td style="white-space:normal;min-width:140px"><b>'+esc(l.fieldCn)+'</b><br><span style="font-size:11.5px;color:#64748b">'+esc(clipText(l.fieldDesc,18))+'</span></td><td style="white-space:normal;min-width:150px">'+esc(l.sourcePlatform)+'<br><span style="font-size:11.5px;color:#64748b;font-family:monospace">'+esc(l.srcTable)+'</span></td><td>'+esc(l.dataType)+'</td><td>'+sensBadge(l.sensLevel)+'</td><td>'+piiBadge(l.isPii)+'</td><td>'+esc(l.maskRule)+'</td><td>'+esc(l.updateFreq)+'</td><td style="white-space:nowrap;font-size:12px;color:#475569;font-family:monospace">'+esc(pathShort(l.lineagePath))+'</td><td>'+esc(l.lastUpdate)+'</td><td class="sticky-col"><button class="btn btn-ghost btn-xs" onclick="shLineageDetail(\''+l.metaId+'\')">详情</button></td></tr>';
    }).join('');
  var platOpts=platforms.all().map(function(p){ return '<option value="'+esc(p.accessId)+'"'+(plat===p.accessId?' selected':'')+'>'+esc(p.platformName)+'</option>'; }).join('');
  var sevOpts=SENS_LEVELS.map(function(s){ return '<option'+(sev===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('');
  var body=filterBar(page,kwInput(page,'元数据ID / 字段名 / 含义 / 原始表')+
      '<div class="form-group"><label>来源平台</label><select onchange="shSetFilter(\''+page+'\',\'plat\',this.value)"><option value="">全部</option>'+platOpts+'</select></div>'+
      '<div class="form-group"><label>数据类型</label><select onchange="shSetFilter(\''+page+'\',\'dt\',this.value)"><option value="">全部</option>'+DATA_TYPE_ENUM.map(function(t){ return '<option'+(shF(page,'dt')===t?' selected':'')+'>'+t+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label>敏感等级</label><select onchange="shSetFilter(\''+page+'\',\'sev\',this.value)"><option value="">全部</option>'+sevOpts+'</select></div>'+
      '<div class="form-group"><label>个人标识</label><select onchange="shSetFilter(\''+page+'\',\'pii\',this.value)"><option value="">全部</option><option value="是"'+(pii==='是'?' selected':'')+'>是 PII</option><option value="否"'+(pii==='否'?' selected':'')+'>非 PII</option></select></div>')+
    tbl(['元数据ID','字段名 / 含义','来源平台 / 原始表','数据类型','敏感等级','个人标识','脱敏规则','更新频率','数据血缘路径','最后更新时间','操作'],rows,1650);
  return shPage('共享数据元数据血缘',
    '<button class="btn btn-primary btn-sm" onclick="shLineageEdit(\'\')">新增元数据</button>'+
    '<button class="btn btn-outline btn-sm" onclick="shLineageExport(\'csv\')">导出 CSV</button>'+
    '<button class="btn btn-outline btn-sm" onclick="shLineageExport(\'json\')">导出 JSON</button>',body);
}
/* 元数据详情查询：字段定义 / 来源 / 敏感 / 血缘完整路径 */
window.shLineageDetail=function(id){
  var l=lineages.find(id); if(!l) return;
  modal('字段元数据详情 · '+esc(l.metaId),
    kv([['元数据ID',l.metaId],['字段名',l.fieldCn],['英文标识',l.fieldEn],['字段含义',l.fieldDesc||'—'],
      ['数据类型',l.dataType],['敏感等级',l.sensLevel],['是否个人标识',l.isPii],['脱敏规则',l.maskRule],
      ['更新频率',l.updateFreq],['来源平台',l.sourcePlatform+'（'+l.sourcePlatformId+'）'],['原始表',l.srcTable],
      ['最后更新时间',l.lastUpdate]])+
    '<div class="sh-sec">数据血缘路径</div><pre>'+esc(l.lineagePath)+'</pre>');
};
/* 元数据目录导出：表格（CSV，Excel 兼容 BOM）或 JSON（含导出信息） */
function lineageExportName(ext){
  var d=new Date(); return '共享数据元数据目录_'+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'.'+ext;
}
window.shLineageExport=function(fmt){
  var headers=['元数据ID','字段名','英文标识','字段含义','数据类型','敏感等级','是否个人标识','脱敏规则','更新频率','来源平台','原始表','血缘路径','最后更新时间'];
  var list=lineages.all();
  var csvEsc=function(v){ v=(v===undefined||v===null)?'':String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  var done;
  if(fmt==='json'){
    var payload={exportType:'共享数据内容元数据目录',exportTime:now(),total:list.length,
      records:list.map(function(l){ return {metaId:l.metaId,fieldCn:l.fieldCn,fieldEn:l.fieldEn,fieldDesc:l.fieldDesc||'—',
        dataType:l.dataType,sensLevel:l.sensLevel,isPii:l.isPii,maskRule:l.maskRule,updateFreq:l.updateFreq,
        sourcePlatformId:l.sourcePlatformId,sourcePlatform:l.sourcePlatform,srcTable:l.srcTable,lineagePath:l.lineagePath,lastUpdate:l.lastUpdate}; })};
    done=realDownload(lineageExportName('json'),'application/json;charset=utf-8',JSON.stringify(payload,null,2),true);
  }else{
    var csv=[headers].concat(list.map(function(l){
      return [l.metaId,l.fieldCn,l.fieldEn,l.fieldDesc||'—',l.dataType,l.sensLevel,l.isPii,l.maskRule,l.updateFreq,
        l.sourcePlatform,l.srcTable,l.lineagePath,l.lastUpdate];
    })).map(function(r){ return r.map(csvEsc).join(','); }).join('\r\n');
    done=realDownload(lineageExportName('csv'),'text/csv;charset=utf-8',csv);
  }
  if(done){
    shAudit('导出','META-CATALOG','导出共享数据元数据目录（'+(fmt==='json'?'JSON':'CSV')+'，'+list.length+' 条）');
    toast('已导出元数据目录 '+list.length+' 条（'+(fmt==='json'?'JSON':'CSV')+'）');
  }else toast('导出失败','error');
};
window.shLineageEdit=function(id){
  var l=id?lineages.find(id):null;
  var pls=platforms.all();
  if(!pls.length){ toast('请先在「外部平台接入配置」维护接口','error'); return; }
  var sel=function(id2,opts,val){ return '<select id="'+id2+'">'+opts.map(function(o){ return '<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>'; };
  var pids=pls.map(function(p){ return '<option value="'+esc(p.accessId)+'"'+((l?l.sourcePlatformId:pls[0].accessId)===p.accessId?' selected':'')+'>'+esc(p.accessId+' · '+p.platformName)+'</option>'; }).join('');
  var defPath=l?l.lineagePath:'';
  var defDesc=(l&&l.fieldDesc&&l.fieldDesc!=='—')?l.fieldDesc:'';
  modal(l?'编辑字段元数据 · '+esc(l.metaId):'新增字段元数据',
    '<div class="sh-frow"><label>来源平台 *</label><select id="sh-l-pid">'+pids+'</select></div>'+
    '<div class="sh-frow"><label>原始表名 *</label><input id="sh-l-table" value="'+esc(l?l.srcTable:'')+'" placeholder="如 report_card"></div>'+
    '<div class="sh-frow"><label>字段名 *</label><input id="sh-l-cn" value="'+esc(l?l.fieldCn:'')+'" placeholder="如 身份证号"></div>'+
    '<div class="sh-frow"><label style="align-self:flex-start;margin-top:4px">字段含义</label><textarea id="sh-l-desc" placeholder="说明字段业务含义，如「肿瘤分期」表示临床分期（Ⅰ~Ⅳ期）">'+esc(defDesc)+'</textarea></div>'+
    '<div class="sh-frow"><label>数据类型</label>'+sel('sh-l-dt',DATA_TYPE_ENUM,l?l.dataType:'STRING')+'</div>'+
    '<div class="sh-frow"><label>敏感等级</label>'+sel('sh-l-sev',SENS_LEVELS,l?l.sensLevel:'L2 内部')+'</div>'+
    '<div class="sh-frow"><label>是否个人标识</label>'+sel('sh-l-pii',['是','否'],l?l.isPii:'否')+'</div>'+
    '<div class="sh-frow"><label>脱敏规则</label>'+sel('sh-l-rule',MASK_RULES,l?l.maskRule:'不适用')+'</div>'+
    '<div class="sh-frow"><label>更新频率</label>'+sel('sh-l-freq',SYNC_FREQ,l?l.updateFreq:'实时')+'</div>'+
    '<div class="sh-frow"><label style="align-self:flex-start;margin-top:4px">血缘路径</label><textarea id="sh-l-path" placeholder="留空则按 来源平台.原始表 → ODS → DWD → DWS → 共享交付层 自动生成">'+esc(defPath)+'</textarea></div>',
    '<button class="btn btn-ghost" onclick="shCloseModal(this)">取消</button><button class="btn btn-primary" onclick="shLineageSubmit(\''+(l?l.metaId:'')+'\')">保存</button>');
};
window.shLineageSubmit=function(id){
  var pid=fv('sh-l-pid'),table=fv('sh-l-table'),cn=fv('sh-l-cn'),desc=fv('sh-l-desc')||'—';
  if(!pid||!table||!cn){ toast('来源平台 / 原始表 / 字段名为必填','error'); return; }
  var p=platforms.find(pid); if(!p){ toast('来源平台不存在','error'); return; }
  var path=fv('sh-l-path');
  if(!path){
    var t=table.toLowerCase();
    path=p.platformName+'.'+t+' → ODS.ods_'+t+' → DWD.dwd_'+t+' → DWS.dws_'+t+'_stat → 共享交付层.share_v_'+t;
  }
  if(id){
    var l=lineages.find(id); if(!l) return;
    var before={sourcePlatformId:l.sourcePlatformId,srcTable:l.srcTable,fieldCn:l.fieldCn,fieldDesc:l.fieldDesc,sensLevel:l.sensLevel,isPii:l.isPii,maskRule:l.maskRule};
    l.sourcePlatformId=pid; l.sourcePlatform=p.platformName; l.srcTable=table; l.fieldCn=cn; l.fieldDesc=desc;
    l.dataType=fv('sh-l-dt'); l.sensLevel=fv('sh-l-sev'); l.isPii=fv('sh-l-pii'); l.maskRule=fv('sh-l-rule');
    l.updateFreq=fv('sh-l-freq'); l.lineagePath=path; l.lastUpdate=now();
    lineages.save(); closeTopModal(); renderPage('sh-lineage');
    shAudit('编辑',l.metaId,'编辑字段元数据「'+cn+'」',before,{sourcePlatformId:pid,fieldDesc:l.fieldDesc,sensLevel:l.sensLevel,isPii:l.isPii,maskRule:l.maskRule});
    toast('元数据已保存：'+l.metaId);
    return;
  }
  var nid='META-',mx=0;
  lineages.all().forEach(function(l){ var r=/META-(\d+)/.exec(String(l.metaId)); if(r) mx=Math.max(mx,parseInt(r[1],10)); });
  nid+=p4(mx+1);
  lineages.all().push({metaId:nid,sourcePlatformId:pid,sourcePlatform:p.platformName,srcTable:table,fieldCn:cn,fieldEn:'—',fieldDesc:desc,
    dataType:fv('sh-l-dt'),sensLevel:fv('sh-l-sev'),isPii:fv('sh-l-pii'),maskRule:fv('sh-l-rule'),
    updateFreq:fv('sh-l-freq'),lineagePath:path,lastUpdate:now()});
  lineages.save(); closeTopModal(); renderPage('sh-lineage');
  shAudit('新增',nid,'补录字段元数据「'+cn+'」→ 平台 '+pid,null,{metaId:nid,fieldDesc:desc,sensLevel:fv('sh-l-sev'),isPii:fv('sh-l-pii')});
  toast('元数据已创建：'+nid);
};


/* ---------- 页面：共享操作审计 ---------- */
function renderTrail(){
  var page='sh-trail';
  var kw=(shF(page,'kw')||'').toLowerCase(); var ot=shF(page,'ot');
  var all=trails.all();
  var types=uniq(all.map(function(l){ return l.opType; }));
  var rows=all.filter(function(l){
      if(ot&&l.opType!==ot) return false;
      if(kw&&[l.logId,l.relatedId,l.desc,l.operator].join('|').toLowerCase().indexOf(kw)<0) return false;
      return true;
    }).map(function(l){
      return '<tr><td>'+esc(l.logId)+'</td><td>'+bText(l.opType,'badge-info')+'</td><td>'+esc(l.relatedId)+'</td><td style="white-space:normal;min-width:240px;max-width:420px">'+esc(l.desc)+'</td><td>'+esc(l.operator)+'</td><td>'+esc(l.time)+'</td><td>'+esc(l.ip)+'<br><span style="font-size:11.5px;color:#64748b">'+esc(l.terminal)+'</span></td><td class="sticky-col"><button class="btn btn-ghost btn-xs" onclick="shTrailDetail(\''+l.logId+'\')">详情</button></td></tr>';
    }).join('');
  var body=filterBar(page,kwInput(page,'日志ID / 关联对象 / 说明 / 操作人')+
      '<div class="form-group"><label>操作类型</label><select onchange="shSetFilter(\''+page+'\',\'ot\',this.value)"><option value="">全部</option>'+types.map(function(s){ return '<option'+(ot===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></div>')+
    tbl(['审计日志ID','操作类型','关联对象','操作说明','操作人','操作时间','来源 IP / 终端','操作'],rows,1600);
  return shPage('共享操作审计',
    '<button class="btn btn-outline btn-sm" onclick="shResetAll()">重置演示数据</button>',body);
}
window.shTrailDetail=function(id){
  var l=trails.find(id); if(!l) return;
  var pre=function(v){ try{ return v?JSON.stringify(JSON.parse(v),null,2):'—'; }catch(e){ return v||'—'; } };
  modal('审计日志 · '+esc(l.logId),
    kv([['审计日志ID',l.logId],['操作类型',l.opType],['关联对象',l.relatedId],['操作说明',l.desc],['操作人',l.operator],['操作时间',l.time],['来源 IP',l.ip],['终端',l.terminal]])+
    '<div class="sh-sec">操作前快照</div><pre>'+esc(pre(l.before))+'</pre>'+
    '<div class="sh-sec">操作后快照</div><pre>'+esc(pre(l.after))+'</pre>');
};

/* ---------- 全局重置（审计页入口） ---------- */
window.shResetAll=function(){
  showConfirm('重置演示数据','确认重置「数据共享管理」全部演示数据吗？你在本模块中的改动（接入 / 申请 / 策略 / 交付 / 监控 / 血缘 / 审计）将恢复为初始种子。',function(){
    platforms.reset(); platformVer.reset(); applies.reset(); policies.reset(); deliveries.reset(); monitors.reset(); lineages.reset(); trails.reset();
    renderPage('sh-trail');
    shAudit('重置','ALL','重置数据共享模块全部演示数据为初始种子');
    toast('演示数据已重置');
  });
};

/* ---------- 路由接管 ---------- */
var ROUTES={
  'sh-platform':renderPlatform,
  'sh-apply':renderApply,
  'sh-policy':renderPolicy,
  'sh-delivery':renderDelivery,
  'sh-monitor':renderMonitor,
  'sh-lineage':renderLineage,
  'sh-trail':renderTrail
};
var shBaseRender=(typeof window.renderPage==='function')?window.renderPage:function(){};
window.renderPage=function(id){
  if(ROUTES[id]){
    document.getElementById('pageContainer').innerHTML=ROUTES[id]();
    if(typeof setActiveMenu==='function') setActiveMenu(id);
    if(typeof updateBreadcrumb==='function') updateBreadcrumb(id);
    if(typeof autoSizeSelects==='function'){ try{ autoSizeSelects(); }catch(e){} }
    var mc=document.getElementById('mainContent'); if(mc&&mc.scrollTop!==undefined) mc.scrollTop=0;
    return;
  }
  return shBaseRender(id);
};

/* 调试/测试出口 */
window.SH={ platforms:platforms, platformVer:platformVer, applies:applies, policies:policies, policyVer:policyVer, deliveries:deliveries,
  monitors:monitors, lineages:lineages, trails:trails, genToken:genToken, tokenState:tokenState,
  ACCESS_PAGES:ACCESS_PAGES, NODES:NODES, cfgOf:cfgOf, mapJson:mapJson, policyCfgOf:policyCfgOf };
})();
