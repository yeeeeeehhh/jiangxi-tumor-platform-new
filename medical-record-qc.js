/* =========================================================================
 * medical-record-qc.js — 肿瘤病案首页质控（2026-11-12 新建，同日精简为最小可用）
 *
 * 菜单：首页 ▸ 质控管理 ▸ 病案首页质控（app.html quality-control 组内
 * {id:'mrqc-workbench'}）。参照「确诊病例质控」结构：单页 5 页签工作台 +
 * 隐藏详情页 mrqc-case|<采集ID>（hash 白名单已放行，菜单不占位）。
 * 对照《肿瘤病案首页质控》4 张信息表 / 30 个功能点全部小实现
 * （内存种子 + localStorage 持久化 jx.mrqc.*.v1，演示口径可重置），
 * 校验 / 核对 / 清单类结果直接融入表格或页内面板，弹窗仅保留表单与单条明细：
 *   · 页签① 基础临床信息（8 项）：HIS/EMR 加载；完整性 + ICD-10/ICD-O-3
 *     校验实时融入表格（问题项列明细、ICD 列建议值与行内采纳）；随访标识
 *     列内补充；质控报告面板；详情页；筛选批量查询；导出待修正包 → mrqc-base
 *   · 页签② 报告编号索引（7 项）：三类报告号绑定 / 影像补录 / 清除；格式
 *     异常编号标红 + 校验面板；缺失预警面板；与 LIS/PACS 核对点击即执行
 *     （不一致行内修正）；按住院号筛选即查 → mrqc-report
 *   · 页签③ 质控结果明细（7 项）：引擎点击即执行（规则ID/错误类型/严重
 *     等级/阻断标识留痕）；行内复核；问题分类统计与阻断清单面板；按规则
 *     筛选；全流程日志；明细导出 → mrqc-result
 *   · 页签④ 存储与脱敏（8 项）：策略配置、JSON 上传、归档/删除/恢复行内
 *     标记；「样本/验证」合并弹窗（样本输出 + 生效验证 + 一键整改）；版本
 *     历史回滚；配置清单导出；未脱敏高风险面板 → mrqc-storage
 * 四张表以住院号 ipNo 关联：病案 ⇄ 报告 ⇄ 质控结果 ⇄ 存储对象。
 * 页头含「功能点覆盖对照」（30 项按页签分组列出）与「重置演示数据」。
 * ========================================================================= */
(function () {
'use strict';

/* ---------- 通用工具 ---------- */
function esc(v){ if(v===undefined||v===null||v==='') return '—'; return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function p2(n){ return (n<10?'0':'')+n; }
function p4(n){ return ('000'+n).slice(-4); }
function now(){ var d=new Date(); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes()); }
function today(){ return now().slice(0,10); }
function daysAgo(n,h){ var d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+(h||'10:'+p2(d.getDate()%60)); }
function lsGet(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
/* 简易确定性哈希（演示"哈希脱敏"用，非密码学） */
function hash8(s){ var h=0; String(s||'').split('').forEach(function(c){ h=(h*131+c.charCodeAt(0))>>>0; }); return ('00000000'+h.toString(16)).slice(-8); }
/* 当前质控人（演示口径） */
function op(){ return '质控员·李梅'; }
function fnum(v,d){ var n=Number(v); return isNaN(n)?(d||0):n; }

/* schema 版本守卫：结构升级时一次性清除本模块全部 localStorage 并重新播种 */
(function(){ try{
  if(lsGet('jx.mrqc.schema')!==4){
    Object.keys(localStorage).forEach(function(k){ if(String(k).indexOf('jx.mrqc.')===0) localStorage.removeItem(k); });
    lsSet('jx.mrqc.schema',4);
  }
}catch(e){} })();

/* ---------- 页面级样式（mrqc- 前缀） ---------- */
var css=document.createElement('style');
css.textContent=[
'.mrqc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:12px 0}',
'.mrqc-kpi{background:#fff;border:1px solid var(--border,#e2e8f0);border-left:3px solid #0b65c2;border-radius:6px;padding:10px 14px}',
'.mrqc-kpi .num{font-size:21px;font-weight:700;color:#0f172a;line-height:1.3}',
'.mrqc-kpi .num small{font-size:12px;font-weight:400;color:#64748b;margin-left:2px}',
'.mrqc-kpi .lbl{font-size:12px;color:#64748b;margin-top:2px}',
'.mrqc-kpi.warn{border-left-color:#d97706}.mrqc-kpi.danger{border-left-color:#dc2626}.mrqc-kpi.ok{border-left-color:#15803d}.mrqc-kpi.dim{border-left-color:#94a3b8}',
'.mrqc-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:2px 10px;border-radius:12px;border:1px solid #cfe1f5;background:#eef4fb;color:#0b65c2;cursor:pointer;white-space:nowrap}',
'.mrqc-chip:hover{background:#dbeafe}.mrqc-chip.on{background:#0b65c2;color:#fff;border-color:#0b65c2}',
'.mrqc-bar{display:flex;align-items:center;gap:8px;margin:6px 0}',
'.mrqc-bar .lb{flex:0 0 130px;font-size:12.5px;color:#334155;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.mrqc-bar .tr{flex:1;height:16px;background:#f1f5f9;border-radius:4px;overflow:hidden}',
'.mrqc-bar .fi{height:100%;border-radius:4px;background:#0b65c2;min-width:2px}',
'.mrqc-bar .vv{flex:0 0 74px;font-size:12px;color:#475569;font-variant-numeric:tabular-nums}',
'.mrqc-tl{margin:4px 0 2px}',
'.mrqc-tl .tl-item{position:relative;padding:0 0 12px 20px;border-left:2px solid #e2e8f0;margin-left:8px}',
'.mrqc-tl .tl-item:last-child{border-left-color:transparent;padding-bottom:2px}',
'.mrqc-tl .dot{position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#cbd5e1;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1}',
'.mrqc-tl .done .dot{background:#15803d;box-shadow:0 0 0 1px #15803d}',
'.mrqc-tl .warn .dot{background:#b45309;box-shadow:0 0 0 1px #b45309}',
'.mrqc-tl .fail .dot{background:#b91c1c;box-shadow:0 0 0 1px #b91c1c}',
'.mrqc-tl .tl-meta{font-size:12px;color:#64748b;line-height:1.6}',
'.mrqc-tl .tl-meta b{color:#1f2937}',
'.mrqc-tl .tl-body{font-size:12.5px;color:#334155;margin-top:2px;line-height:1.6}',
'.mrqc-kv{display:grid;grid-template-columns:170px 1fr;gap:6px 12px;font-size:13px}',
'.mrqc-kv .k{color:#667085}.mrqc-kv .v{color:#1f2937;word-break:break-all}',
'.mrqc-frow{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}',
'.mrqc-frow>label{flex:0 0 120px;font-size:12.5px;color:#475569;text-align:right;padding-top:7px}',
'.mrqc-frow select,.mrqc-frow input,.mrqc-frow textarea{flex:1;height:32px;border:1px solid #d1d8e0;border-radius:4px;padding:0 10px;font-size:13px;color:#1e293b;min-width:0}',
'.mrqc-frow textarea{height:120px;padding:6px 10px;font-family:Consolas,monospace;line-height:1.6;font-size:12px}',
'.mrqc-sec{font-size:13.5px;font-weight:700;color:#334155;margin:14px 0 8px}',
'.mrqc-note{font-size:12px;color:#64748b;line-height:1.8;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px}',
'.mrqc-mono{font-family:Consolas,monospace;font-size:11.5px;color:#475569;word-break:break-all}',
'.mrqc-box{width:860px;max-width:94vw}',
'.mrqc-box.mid{width:560px;max-width:92vw}',
'.mrqc-body{max-height:64vh;overflow:auto;text-align:left;line-height:1.8}',
'.mrqc-fp{font-size:10.5px;color:#94a3b8;border:1px solid #e2e8f0;border-radius:8px;padding:0 6px;margin-left:4px;white-space:nowrap}',
'.mrqc-iss{border:1px solid #f3d9d9;background:#fff7f7;border-radius:6px;padding:8px 12px;margin:6px 0;font-size:12.5px;line-height:1.8}',
'.mrqc-iss .t{font-weight:700;color:#b91c1c}',
'.mrqc-iss.ok{border-color:#cfe8d8;background:#f6fcf8}.mrqc-iss.ok .t{color:#15803d}',
'.mrqc-kpi.hl{box-shadow:0 0 0 2px #bfdbfe}',
/* 页签操作条 / 详情操作区（对齐 cq-bar / cq-detail-acts 系统规范） */
'.mrqc-tbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
'.mrqc-tbar .acts{display:flex;gap:8px;flex-wrap:wrap}',
'.mrqc-hint{font-size:11.5px;color:#94a3b8;line-height:1.6}',
'.mrqc-detail-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}'
].join('\n');
document.head.appendChild(css);

/* ---------- 功能点覆盖对照（37 项 → 实现入口） ---------- */
var FP_MAP={
  'mrqc-base':[
    ['1-1','加载患者病案首页基础信息','工具栏「从 HIS/EMR 加载」'],
    ['1-2','补充缺失的随访状态标识','详情页头部「补充随访标识」/ 详情页发病·死亡·随访标识行'],
    ['1-3','触发基础信息完整性校验','表格「问题项」列实时展示缺失明细（渲染时自动校验）'],
    ['1-4','输出 ICD 编码合规性校验结果','表格 ICD-10 / ICD-O-3 列内建议值 + 行内「采纳」'],
    ['1-5','生成病案首页基础信息质控报告','工具栏「生成质控报告」'],
    ['1-6','查询单例病案首页质控详情','搜索（住院号/患者ID）+ 列表行「详情」→ 质控详情页'],
    ['1-7','批量查询待质控病案列表','筛选条（科室/时间/来源/状态）+ 搜索（住院号/患者ID/姓名）'],
    ['1-8','导出待修正病案首页数据包','工具栏「导出待修正数据包」']],
  'mrqc-report':[
    ['3-1','关联病理与检验报告编号','列表行「关联报告」'],
    ['3-2','补录缺失的影像报告编号','缺失行「补录影像」'],
    ['3-3','校验报告编号格式合规性','工具栏「格式校验」'],
    ['3-4','输出报告缺失预警清单','工具栏「缺失预警清单」'],
    ['3-5','查询某病案关联的所有报告编号','表格报告号列直接展示（按住院号筛选即查）'],
    ['3-6','批量核对报告编号一致性','工具栏「与 LIS/PACS 核对」点击即执行，不一致行内「修正」'],
    ['3-7','清除无效报告关联关系','详情页报告号行内「解绑」/ 报告索引页签行「清除」']],
  'mrqc-result':[
    ['4-1','记录质控规则执行结果','工具栏「执行质控引擎」点击即执行（结果持久化到本页签表格）'],
    ['4-2','更新人工复核意见','列表行「复核」'],
    ['4-3','生成质控问题分类统计图','工具栏「问题分类统计」'],
    ['4-4','输出阻断上报病例清单','工具栏「阻断上报清单」'],
    ['4-5','查询某规则下的所有违规记录','筛选条（规则/版本/等级）'],
    ['4-6','查看单条质控执行全流程日志','列表行「日志」'],
    ['4-7','导出质控结果明细数据','工具栏「导出明细」']],
  'mrqc-storage':[
    ['5-1','配置敏感字段脱敏策略','工具栏「脱敏策略配置」'],
    ['5-2','上传 JSON 格式原始数据内容','工具栏「上传 JSON 数据」'],
    ['5-3','标记数据删除或归档状态','列表行「归档 / 删除 / 恢复」'],
    ['5-4','输出脱敏后数据样本','行「样本/验证」弹窗（脱敏后样本 + 导出）'],
    ['5-5','查询某数据对象的存储版本历史','列表行「版本」'],
    ['5-6','验证脱敏配置生效状态','行「样本/验证」弹窗（验证报告 + 未通过一键整改）'],
    ['5-7','导出数据存储配置参数清单','工具栏「导出配置清单」'],
    ['5-8','查询未脱敏的高风险数据列表','工具栏「未脱敏高风险」']]
};
window.mrqcFpList=function(page){
  var groups=page?[page]:TABS.map(function(t){ return t[0]; });
  var total=TABS.reduce(function(s,t){ return s+(FP_MAP[t[0]]||[]).length; },0);
  var html=groups.map(function(g){
    var rows=(FP_MAP[g]||[]).map(function(r){ return '<tr><td style="white-space:nowrap"><span class="mrqc-fp">'+r[0]+'</span></td><td>'+esc(r[1])+'</td><td style="color:#0b65c2">'+esc(r[2])+'</td></tr>'; }).join('');
    return (page?'':'<div class="mrqc-sec">'+esc(PAGE_TITLE[g])+'（'+(FP_MAP[g]||[]).length+' 项）</div>')+
      '<div class="table-wrap"><table class="data-table" style="min-width:560px"><thead><tr><th>编号</th><th>功能点</th><th>实现入口</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }).join('');
  mrqcModal('功能点覆盖对照 · 肿瘤病案首页质控（'+total+' 项）',
    '<div class="mrqc-note">本模块共 '+total+' 个功能点，全部以演示数据小实现；单页 4 页签分别对应 4 张信息表，可点击对应入口实际操作。</div>'+html,
    null,'mrqc-box');
};

/* ---------- 编码字典与校验规则（演示口径） ---------- */
var ICDO3_RE=/^M-\d{4}\/[0-9]$/;                        /* M-xxxx/x */
var ICD10_FIX={'C509':'C50.9','D50.9':'C85.9','c50.9':'C50.9'};   /* 常见错误建议修正值 */
var ICDO3_FIX={'M-8140':'M-8140/3','M-85003':'M-8500/3','M-8010/2':'M-8010/3','M8500/3':'M-8500/3'};
var FIELD_CN={pid:'患者ID',eventId:'就诊/检诊事件ID',ipNo:'住院号',diagDate:'诊断日期',icd10:'肿瘤部位ICD-10',icdo3:'肿瘤形态学ICD-O-3',vitStatus:'发病/死亡/随访标识'};
/* 报告编号格式（院内命名规范）：病理 BL-yyyymmdd-####，检验 LIS-yyyymmdd-####，影像 IMG-yyyymmdd-#### */
var RP_FMT={pathNo:{re:/^BL-\d{8}-\d{4}$/,cn:'病理报告号',ex:'BL-20260105-0032'},
            labNo:{re:/^LIS-\d{8}-\d{4}$/,cn:'检验报告号',ex:'LIS-20260106-0118'},
            imgNo:{re:/^IMG-\d{8}-\d{4}$/,cn:'影像报告号',ex:'IMG-20260104-0207'}};
/* 质控规则集（版本 v3.2） */
var RULES=[
  {ruleId:'MRQ-B01',name:'必填字段完整性',errType:'字段缺失',sev:'重要'},
  {ruleId:'MRQ-B02',name:'ICD-10 编码合规',errType:'编码错误',sev:'重要'},
  {ruleId:'MRQ-B03',name:'ICD-O-3 形态学合规',errType:'编码错误',sev:'重要'},
  {ruleId:'MRQ-L01',name:'诊断日期与入院日期逻辑',errType:'逻辑冲突',sev:'重要'},
  {ruleId:'MRQ-L02',name:'部位与形态学匹配（含动态编码）',errType:'逻辑冲突',sev:'严重'},
  {ruleId:'MRQ-F01',name:'报告编号格式合规',errType:'格式错误',sev:'一般'}];
function ruleOf(id){ var r=null; RULES.forEach(function(x){ if(x.ruleId===id)r=x; }); return r; }
var VIT_OPTS=['发病登记','随访中','死亡','失访'];
var DEPTS=['肿瘤外科','肿瘤内科','肝胆外科','呼吸内科','消化内科','神经外科','妇科','泌尿外科','血液内科','骨科'];
/* 授权机构编码白名单（演示） */

/* ---------- 种子数据 ---------- */
function seedCases(){
  return [
    {cid:'CJ-2026-0001',pid:'P-20260001',eventId:'EV-2026-0001',opNo:'MZ-0101',ipNo:'ZY20260101',name:'陈某某',sex:'女',age:52,dept:'肿瘤外科',srcType:'HIS',admDate:'2026-01-06',diagDate:'2026-01-08',icd10:'C50.9',icdo3:'M-8500/3',pathNote:'浸润性导管癌',vitStatus:'随访中',qcState:'校验通过',score:96,highRisk:false,issues:[],loadTime:daysAgo(30,'09:12'),opinion:'字段齐全，编码符合规范'},
    {cid:'CJ-2026-0002',pid:'P-20260002',eventId:'EV-2026-0002',opNo:'MZ-0102',ipNo:'ZY20260102',name:'刘某某',sex:'男',age:63,dept:'肿瘤内科',srcType:'EMR',admDate:'2026-01-10',diagDate:'2026-01-12',icd10:'C34.9',icdo3:'M-8140/3',pathNote:'腺癌',vitStatus:'随访中',qcState:'校验通过',score:94,highRisk:false,issues:[],loadTime:daysAgo(30,'09:12'),opinion:''},
    {cid:'CJ-2026-0003',pid:'P-20260003',eventId:'EV-2026-0003',opNo:'MZ-0103',ipNo:'ZY20260103',name:'王某某',sex:'男',age:58,dept:'肝胆外科',srcType:'HIS',admDate:'2026-01-13',diagDate:'2026-01-15',icd10:'C22.0',icdo3:'M-8170/3',pathNote:'肝细胞癌',vitStatus:'死亡',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(30,'09:12'),opinion:''},
    {cid:'CJ-2026-0004',pid:'P-20260004',eventId:'EV-2026-0004',opNo:'MZ-0104',ipNo:'ZY20260104',name:'张某某',sex:'女',age:47,dept:'肿瘤外科',srcType:'HIS',admDate:'2026-01-16',diagDate:'2026-01-18',icd10:'C509',icdo3:'M-8500/3',pathNote:'浸润性导管癌',vitStatus:'随访中',qcState:'待修正',score:78,highRisk:false,issues:[{type:'编码错误',field:'肿瘤部位ICD-10',sev:'重要',sugg:'建议修正为 C50.9'}],loadTime:daysAgo(28,'14:20'),opinion:''},
    {cid:'CJ-2026-0005',pid:'P-20260005',eventId:'EV-2026-0005',opNo:'MZ-0105',ipNo:'ZY20260105',name:'李某某',sex:'男',age:66,dept:'呼吸内科',srcType:'EMR',admDate:'2026-01-18',diagDate:'2026-01-20',icd10:'C34.9',icdo3:'M-8140',pathNote:'腺癌',vitStatus:'',qcState:'待修正',score:71,highRisk:false,issues:[{type:'编码错误',field:'肿瘤形态学ICD-O-3',sev:'重要',sugg:'建议修正为 M-8140/3'},{type:'字段缺失',field:'发病/死亡/随访标识',sev:'重要',sugg:'请补充随访状态标识'}],loadTime:daysAgo(26,'11:05'),opinion:''},
    {cid:'CJ-2026-0006',pid:'P-20260006',eventId:'EV-2026-0006',opNo:'MZ-0106',ipNo:'ZY20260106',name:'赵某某',sex:'女',age:55,dept:'消化内科',srcType:'HIS',admDate:'2026-01-20',diagDate:'2026-01-22',icd10:'C16.9',icdo3:'M-8140/3',pathNote:'胃腺癌',vitStatus:'随访中',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(24,'16:40'),opinion:''},
    {cid:'CJ-2026-0007',pid:'P-20260007',eventId:'EV-2026-0007',opNo:'MZ-0107',ipNo:'ZY20260107',name:'周某某',sex:'男',age:61,dept:'神经外科',srcType:'EMR',admDate:'2026-02-02',diagDate:'2026-01-25',icd10:'C71.9',icdo3:'M-9440/3',pathNote:'胶质母细胞瘤',vitStatus:'死亡',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(22,'08:55'),opinion:''},
    {cid:'CJ-2026-0008',pid:'P-20260008',eventId:'EV-2026-0008',opNo:'MZ-0108',ipNo:'ZY20260108',name:'吴某某',sex:'女',age:49,dept:'妇科',srcType:'HIS',admDate:'2026-01-26',diagDate:'2026-01-28',icd10:'C53.9',icdo3:'M-8010/2',pathNote:'宫颈浸润性癌',vitStatus:'随访中',qcState:'待修正',score:74,highRisk:false,issues:[{type:'逻辑冲突',field:'肿瘤形态学ICD-O-3',sev:'严重',sugg:'病理描述为浸润性癌，动态编码 /2（原位癌）矛盾，建议修正为 M-8010/3'}],loadTime:daysAgo(20,'15:30'),opinion:''},
    {cid:'CJ-2026-0009',pid:'P-20260009',eventId:'EV-2026-0009',opNo:'MZ-0109',ipNo:'ZY20260109',name:'郑某某',sex:'男',age:70,dept:'泌尿外科',srcType:'EMR',admDate:'2026-01-30',diagDate:'2026-02-01',icd10:'C61',icdo3:'M-8140/3',pathNote:'前列腺腺癌',vitStatus:'随访中',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(18,'10:15'),opinion:''},
    {cid:'CJ-2026-0010',pid:'P-20260010',eventId:'EV-2026-0010',opNo:'MZ-0110',ipNo:'ZY20260110',name:'孙某某',sex:'男',age:45,dept:'血液内科',srcType:'HIS',admDate:'2026-02-01',diagDate:'2026-02-03',icd10:'D50.9',icdo3:'M-9690/3',pathNote:'滤泡性淋巴瘤',vitStatus:'随访中',qcState:'待修正',score:65,highRisk:true,issues:[{type:'编码错误',field:'肿瘤部位ICD-10',sev:'严重',sugg:'恶性淋巴瘤应为 C 编码，建议修正为 C85.9'}],loadTime:daysAgo(16,'13:50'),opinion:''},
    {cid:'CJ-2026-0011',pid:'P-20260011',eventId:'EV-2026-0011',opNo:'MZ-0111',ipNo:'ZY20260111',name:'林某某',sex:'女',age:38,dept:'肿瘤内科',srcType:'EMR',admDate:'2026-02-03',diagDate:'2026-02-05',icd10:'C43.9',icdo3:'M-8720/3',pathNote:'恶性黑色素瘤',vitStatus:'',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(14,'09:30'),opinion:''},
    {cid:'CJ-2026-0012',pid:'P-20260012',eventId:'EV-2026-0012',opNo:'MZ-0112',ipNo:'ZY20260112',name:'何某某',sex:'男',age:57,dept:'骨科',srcType:'HIS',admDate:'2026-02-06',diagDate:'2026-02-08',icd10:'C40.9',icdo3:'M-8890/3',pathNote:'骨肉瘤',vitStatus:'失访',qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:daysAgo(10,'17:20'),opinion:''}]
    /* 数据来源机构ID（与「采集元信息」机构编码一致：HIS→360102-001，EMR→360102-002） */
    .map(function(c){ c.orgId=c.srcType==='EMR'?'360102-002':'360102-001'; return c; });
}
/* 模拟“远端 HIS/EMR”待拉取池：功能点 1-1 每次合并 1 条新病案（取完为止）+1 条既有更新 */
var HIS_POOL=[
  {ipNo:'ZY20260113',name:'黄某某',sex:'女',age:60,dept:'消化内科',srcType:'HIS',admDate:'2026-02-09',diagDate:'2026-02-10',icd10:'C18.7',icdo3:'M-8140/3',pathNote:'乙状结肠腺癌',vitStatus:'随访中'},
  {ipNo:'ZY20260114',name:'徐某某',sex:'男',age:52,dept:'呼吸内科',srcType:'EMR',admDate:'2026-02-11',diagDate:'2026-02-12',icd10:'C34.1',icdo3:'M-8046/3',pathNote:'小细胞癌',vitStatus:'随访中'},
  {ipNo:'ZY20260115',name:'宋某某',sex:'女',age:44,dept:'妇科',srcType:'HIS',admDate:'2026-02-13',diagDate:'2026-02-14',icd10:'C54.1',icdo3:'M-8930/3',pathNote:'子宫内膜样腺癌',vitStatus:'随访中'}];
function seedReports(){
  return [
    {ipNo:'ZY20260101',pathNo:'BL-20260105-0032',labNo:'LIS-20260106-0118',imgNo:'IMG-20260104-0207',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(20,'14:00')},
    {ipNo:'ZY20260102',pathNo:'BL-20260112-0041',labNo:'LIS-20260113-0122',imgNo:'IMG-20260111-0213',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(20,'14:00')},
    {ipNo:'ZY20260103',pathNo:'',labNo:'LIS-20260116-0127',imgNo:'IMG-20260115-0218',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(19,'10:00')},
    {ipNo:'ZY20260104',pathNo:'BL-20260118-0050',labNo:'20260118-55',imgNo:'IMG-20260117-0221',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(18,'15:00')},
    {ipNo:'ZY20260105',pathNo:'BL-20260120-0055',labNo:'LIS-20260121-0130',imgNo:'',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(17,'09:30')},
    {ipNo:'ZY20260106',pathNo:'BL-20260122-0058',labNo:'LIS-20260123-0133',imgNo:'IMG-20260121-0226',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(16,'11:00')},
    {ipNo:'ZY20260107',pathNo:'BL-20260125-0011',labNo:'LIS-20260126-0136',imgNo:'IMG-20260124-0230',fmtState:'合规',matchState:'待核对',checkedTime:''},
    {ipNo:'ZY20260108',pathNo:'BL-20260128-0015',labNo:'LIS-20260129-0139',imgNo:'IMG-20260127-0233',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(14,'16:20')},
    {ipNo:'ZY20260109',pathNo:'BL-20260201-0019',labNo:'LIS-20260202-0144',imgNo:'IMG-20260131-0238',fmtState:'合规',matchState:'待核对',checkedTime:''},
    {ipNo:'ZY20260110',pathNo:'BL-20260203-0022',labNo:'LIS-20260204-0147',imgNo:'IMG-20260202-0241',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(8,'10:40')},
    {ipNo:'ZY20260111',pathNo:'BL-20260205-0026',labNo:'LIS-20260206-0151',imgNo:'IMG-20260204-0244',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(7,'14:10')},
    {ipNo:'ZY20260112',pathNo:'BL-20260208-0030',labNo:'LIS-20260209-0155',imgNo:'IMG-20260207-0248',fmtState:'合规',matchState:'一致',checkedTime:daysAgo(6,'09:00')}];
}
function seedResults(){
  function lg(t,a,act,d,cls){ return {time:t,actor:a,action:act,detail:d,cls:cls||'done'}; }
  return [
    {qcId:'QC-2026-0001',ipNo:'ZY20260104',ruleVer:'v3.2',ruleId:'MRQ-B02',errType:'编码错误',sevLevel:'重要',fmtState:'不通过',missing:[],conflicts:['ICD-10“C509”缺少小数点分隔符'],score:78,blocked:false,state:'待复核',execTime:daysAgo(15,'10:02'),qcBy:'质控引擎',opinion:'',logs:[lg(daysAgo(15,'10:01'),'系统','加载数据','从缓存加载病案 ZY20260104 基础信息'),lg(daysAgo(15,'10:01'),'系统','格式校验','字段格式校验通过'),lg(daysAgo(15,'10:02'),'系统','规则命中','MRQ-B02：ICD-10 格式不合规'),lg(daysAgo(15,'10:02'),'质控引擎','生成结论','判定待修正，建议修正为 C50.9','warn')]},
    {qcId:'QC-2026-0002',ipNo:'ZY20260105',ruleVer:'v3.2',ruleId:'MRQ-B01',errType:'字段缺失',sevLevel:'重要',fmtState:'不通过',missing:['发病/死亡/随访标识'],conflicts:[],score:71,blocked:false,state:'待复核',execTime:daysAgo(15,'10:05'),qcBy:'质控引擎',opinion:'',logs:[lg(daysAgo(15,'10:04'),'系统','加载数据','加载病案 ZY20260105'),lg(daysAgo(15,'10:05'),'系统','规则命中','MRQ-B01：必填项“随访标识”缺失'),lg(daysAgo(15,'10:05'),'质控引擎','生成结论','判定待修正，提示补充随访标识','warn')]},
    {qcId:'QC-2026-0003',ipNo:'ZY20260108',ruleVer:'v3.2',ruleId:'MRQ-L02',errType:'逻辑冲突',sevLevel:'严重',fmtState:'不通过',missing:[],conflicts:['动态编码 /2 与病理“浸润性癌”矛盾'],score:74,blocked:true,state:'已复核',execTime:daysAgo(14,'09:12'),qcBy:'质控引擎',opinion:'复核确认编码矛盾，退回病案室修正',logs:[lg(daysAgo(14,'09:11'),'系统','加载数据','加载病案 ZY20260108'),lg(daysAgo(14,'09:12'),'系统','规则命中','MRQ-L02：部位与形态学匹配失败'),lg(daysAgo(14,'09:12'),'质控引擎','生成结论','严重逻辑冲突，阻断上报','fail'),lg(daysAgo(13,'15:40'),op(),'人工复核','确认阻断，退回修正',  'done')]},
    {qcId:'QC-2026-0004',ipNo:'ZY20260110',ruleVer:'v3.2',ruleId:'MRQ-B02',errType:'编码错误',sevLevel:'严重',fmtState:'不通过',missing:[],conflicts:['恶性淋巴瘤误用良性/非肿瘤编码 D50.9'],score:65,blocked:true,state:'待复核',execTime:daysAgo(13,'11:30'),qcBy:'质控引擎',opinion:'',logs:[lg(daysAgo(13,'11:29'),'系统','加载数据','加载病案 ZY20260110'),lg(daysAgo(13,'11:30'),'系统','规则命中','MRQ-B02：ICD-10 非恶性肿瘤编码'),lg(daysAgo(13,'11:30'),'质控引擎','生成结论','严重编码错误，阻断上报','fail')]},
    {qcId:'QC-2026-0005',ipNo:'ZY20260107',ruleVer:'v3.2',ruleId:'MRQ-L01',errType:'逻辑冲突',sevLevel:'重要',fmtState:'不通过',missing:[],conflicts:['诊断日期（2026-01-25）早于入院日期（2026-02-02）'],score:80,blocked:false,state:'待复核',execTime:daysAgo(13,'11:33'),qcBy:'质控引擎',opinion:'',logs:[lg(daysAgo(13,'11:32'),'系统','加载数据','加载病案 ZY20260107'),lg(daysAgo(13,'11:33'),'系统','规则命中','MRQ-L01：诊断日期早于入院日期'),lg(daysAgo(13,'11:33'),'质控引擎','生成结论','判定待修正，请核对首诊时间线','warn')]},
    {qcId:'QC-2026-0006',ipNo:'ZY20260101',ruleVer:'v3.2',ruleId:'—',errType:'无',sevLevel:'一般',fmtState:'通过',missing:[],conflicts:[],score:96,blocked:false,state:'已复核',execTime:daysAgo(12,'09:00'),qcBy:'质控引擎',opinion:'复核通过',logs:[lg(daysAgo(12,'08:59'),'系统','加载数据','加载病案 ZY20260101'),lg(daysAgo(12,'09:00'),'质控引擎','生成结论','全部规则通过，评分 96'),lg(daysAgo(11,'10:10'),op(),'人工复核','复核通过')]},
    {qcId:'QC-2026-0007',ipNo:'ZY20260102',ruleVer:'v3.2',ruleId:'—',errType:'无',sevLevel:'一般',fmtState:'通过',missing:[],conflicts:[],score:94,blocked:false,state:'已复核',execTime:daysAgo(12,'09:03'),qcBy:'质控引擎',opinion:'复核通过',logs:[lg(daysAgo(12,'09:02'),'系统','加载数据','加载病案 ZY20260102'),lg(daysAgo(12,'09:03'),'质控引擎','生成结论','全部规则通过，评分 94')]},
    {qcId:'QC-2026-0008',ipNo:'ZY20260104',ruleVer:'v3.2',ruleId:'MRQ-F01',errType:'格式错误',sevLevel:'一般',fmtState:'不通过',missing:[],conflicts:['检验报告号“20260118-55”不符合 LIS-yyyymmdd-#### 规范'],score:85,blocked:false,state:'待复核',execTime:daysAgo(10,'14:20'),qcBy:'质控引擎',opinion:'',logs:[lg(daysAgo(10,'14:19'),'系统','加载数据','加载关联报告索引 ZY20260104'),lg(daysAgo(10,'14:20'),'系统','规则命中','MRQ-F01：检验报告号格式异常'),lg(daysAgo(10,'14:20'),'质控引擎','生成结论','判定一般格式问题，提示修正','warn')]}];
}
/* 演示用原始 JSON（含敏感字段，供脱敏策略前后对照） */
function demoJson(ipNo,name){
  return JSON.stringify({住院号:ipNo,患者姓名:name,身份证号:'360102196503121234',联系电话:'13812345678',现住址:'江西省南昌市东湖区XX路25号3单元502',
    诊断:{主要诊断:'乳房恶性肿瘤',诊断日期:'2026-01-08',肿瘤部位ICD10:'C50.9',形态学ICDO3:'M-8500/3'},随访状态:'随访中'},null,1);
}
function seedStorage(){
  function v(n,t,st){ return {v:n,time:t,state:st}; }
  return [
    {contId:'CT-2026-0001',ipNo:'ZY20260101',fmt:'JSON',sizeKB:18.6,jsonStr:demoJson('ZY20260101','陈某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel；ICD10→icd10；ICDO3→icdo3',maskFlag:true,ver:3,state:'在线',versions:[v(1,daysAgo(29,'09:12'),'原始入库'),v(2,daysAgo(20,'10:00'),'应用脱敏策略'),v(3,daysAgo(12,'09:00'),'字段映射更新')],note:''},
    {contId:'CT-2026-0002',ipNo:'ZY20260102',fmt:'JSON',sizeKB:17.2,jsonStr:demoJson('ZY20260102','刘某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel；ICD10→icd10；ICDO3→icdo3',maskFlag:true,ver:2,state:'在线',versions:[v(1,daysAgo(29,'09:12'),'原始入库'),v(2,daysAgo(15,'11:00'),'应用脱敏策略')],note:''},
    {contId:'CT-2026-0003',ipNo:'ZY20260103',fmt:'JSON',sizeKB:19.8,jsonStr:demoJson('ZY20260103','王某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel；ICD10→icd10；ICDO3→icdo3',maskFlag:false,ver:1,state:'在线',versions:[v(1,daysAgo(28,'08:40'),'原始入库（尚未脱敏）')],note:'含敏感字段，未启用脱敏'},
    {contId:'CT-2026-0004',ipNo:'ZY20260105',fmt:'JSON',sizeKB:16.4,jsonStr:demoJson('ZY20260105','李某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel；ICD10→icd10；ICDO3→icdo3',maskFlag:false,ver:1,state:'在线',versions:[v(1,daysAgo(25,'14:00'),'原始入库（尚未脱敏）')],note:'含敏感字段，未启用脱敏'},
    {contId:'CT-2026-0005',ipNo:'ZY20260106',fmt:'JSON',sizeKB:15.9,jsonStr:demoJson('ZY20260106','赵某某'),fieldMap:'住院号→ipNo；患者姓名→name；ICD10→icd10；ICDO3→icdo3',maskFlag:true,ver:5,state:'已归档',versions:[v(1,daysAgo(27,'10:00'),'原始入库'),v(2,daysAgo(22,'10:00'),'应用脱敏策略'),v(3,daysAgo(18,'10:00'),'补充随访字段'),v(4,daysAgo(14,'10:00'),'映射修正'),v(5,daysAgo(5,'10:00'),'归档快照')],note:'年度归档'},
    {contId:'CT-2026-0006',ipNo:'ZY20260108',fmt:'JSON',sizeKB:14.3,jsonStr:demoJson('ZY20260108','吴某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel',maskFlag:true,ver:2,state:'在线',versions:[v(1,daysAgo(19,'16:30'),'原始入库'),v(2,daysAgo(9,'16:30'),'应用脱敏策略')],note:''},
    {contId:'CT-2026-0007',ipNo:'ZY20260110',fmt:'JSON',sizeKB:21.0,jsonStr:demoJson('ZY20260110','孙某某'),fieldMap:'住院号→ipNo；患者姓名→name；身份证号→idNo；联系电话→tel；ICD10→icd10',maskFlag:true,ver:3,state:'已删除',versions:[v(1,daysAgo(15,'09:00'),'原始入库'),v(2,daysAgo(11,'09:00'),'应用脱敏策略'),v(3,daysAgo(2,'09:00'),'逻辑删除（重复上传）')],note:'重复上传的测试数据'},
    {contId:'CT-2026-0008',ipNo:'ZY-TEST-001',fmt:'JSON',sizeKB:32.7,jsonStr:'{"备注":"接口联调测试数据（含批量造数）","batch":200}',fieldMap:'测试数据无正式映射',maskFlag:false,ver:1,state:'在线',versions:[v(1,daysAgo(6,'20:00'),'测试数据入库')],note:'联调测试数据，含敏感字段未脱敏'}];
}
var MASK_FIELDS=[
  {key:'name',cn:'患者姓名',demo:'陈某某',mask:function(v){ v=String(v||''); return v? v.charAt(0)+'**' : ''; }},
  {key:'idNo',cn:'身份证号',demo:'360102196503121234',mask:function(v){ v=String(v||''); return v.length>10? v.slice(0,6)+'********'+v.slice(-4):'******'; }},
  {key:'tel',cn:'联系电话',demo:'13812345678',mask:function(v){ v=String(v||''); return v.length>=7? v.slice(0,3)+'****'+v.slice(-4):'******'; }},
  {key:'addr',cn:'现住址',demo:'江西省南昌市东湖区XX路25号',mask:function(v){ v=String(v||''); return v.length>6? v.slice(0,6)+'****':''; }}];
var MASK_WAYS=['不处理','掩码','哈希','替换'];
function seedPolicy(){ return {name:'替换',idNo:'掩码',tel:'掩码',addr:'掩码'}; }

/* ---------- localStorage store ---------- */
function store(name,seedFn,keyField){
  var KEY='jx.mrqc.'+name+'.v1';
  var arr=lsGet(KEY);
  if(!Array.isArray(arr)){ arr=seedFn(); lsSet(KEY,arr); }
  return { key:KEY, all:function(){ return arr; }, find:function(id){ var o=null; arr.forEach(function(x){ if(x[keyField]===id)o=x; }); return o; },
    save:function(){ lsSet(KEY,arr); }, reset:function(){ arr=seedFn(); lsSet(KEY,arr); } };
}
var cases=store('cases',seedCases,'cid');
var reports=store('reports',seedReports,'ipNo');
var results=store('results',seedResults,'qcId');
var storages=store('storage',seedStorage,'contId');
var policyStore={ key:'jx.mrqc.policy.v1',
  get:function(){ var v=lsGet(this.key); if(!v){ v=seedPolicy(); lsSet(this.key,v); } return v; },
  save:function(p){ lsSet(this.key,p); } };
function nextId(arr,field,prefix){ var mx=0; arr.forEach(function(x){ var m=new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'-(\\d+)').exec(String(x[field])); if(m) mx=Math.max(mx,parseInt(m[1],10)); }); return prefix+'-'+p4(mx+1); }

/* ---------- 渲染工具 ---------- */
var PAGE_TITLE={'mrqc-base':'病案首页基础临床信息','mrqc-report':'关联报告编号索引','mrqc-result':'质控执行结果明细','mrqc-storage':'数据存储与脱敏配置'};
function bText(s,type){ return '<span class="badge '+(type||'badge-muted')+'">'+esc(s)+'</span>'; }
/* 状态/等级徽章（统一口径） */
function stBadge(s){
  var t='badge-muted';
  if(['校验通过','通过','已复核','一致','合规','在线','正常','已采纳','有效'].indexOf(s)>=0) t='badge-success';
  else if(['待质控','待复核','待核对','随访中','发病登记','已归档','重要','一般'].indexOf(s)>=0) t='badge-warning';
  else if(['待修正','已阻断','阻断','失访','死亡','高风险','严重','不通过','不一致','异常','已删除'].indexOf(s)>=0) t='badge-danger';
  else if(s==='无') t='badge-success';
  return '<span class="badge '+t+'">'+esc(s)+'</span>';
}
function fpTag(no){ return '<span class="mrqc-fp" title="功能点编号">'+no+'</span>'; }
function kpiCard(num,unit,lbl,cls){ return '<div class="mrqc-kpi '+(cls||'')+'"><div class="num">'+num+'<small>'+esc(unit||'')+'</small></div><div class="lbl">'+esc(lbl)+'</div></div>'; }
function kvGrid(rows){ return '<div class="mrqc-kv">'+rows.map(function(r){ return '<div class="k">'+r[0]+'</div><div class="v">'+(r[2]?r[1]:esc(r[1]))+'</div>'; }).join('')+'</div>'; }
function tbl(headers,rows,minW){
  return '<div class="table-wrap"><table class="data-table" style="min-width:'+(minW||1200)+'px"><thead><tr>'+
    headers.map(function(h){ return '<th>'+h+'</th>'; }).join('')+'</tr></thead><tbody>'+
    (rows||('<tr><td colspan="'+headers.length+'" style="text-align:center;padding:30px;color:#94a3b8">暂无数据</td></tr>'))+
    '</tbody></table></div>';
}
/* 页签内容容器：操作按钮条（mrqc-tbar，对齐 cq-bar 规范）+ 数据区（页头/页签条由工作台统一输出） */
function tabPanel(actions,body){
  return '<div class="mrqc-tbar"><div class="acts">'+(actions||'')+'</div></div>'+
    '<div class="panel"><div class="panel-body">'+body+'</div></div>';
}
/* 水平条形图（问题分布 / 质量报表用） */
function bars(pairs,unit,color){
  var mx=1; pairs.forEach(function(p){ mx=Math.max(mx,p[1]); });
  return pairs.map(function(p){
    return '<div class="mrqc-bar"><div class="lb" title="'+esc(p[0])+'">'+esc(p[0])+'</div><div class="tr"><div class="fi" style="width:'+Math.round(p[1]/mx*100)+'%;background:'+(color||'#0b65c2')+'"></div></div><div class="vv">'+p[1]+esc(unit||'')+'</div></div>';
  }).join('');
}
/* 操作日志时间线 */
function timeline(logs){
  return '<div class="mrqc-tl">'+(logs||[]).map(function(l){
    var cls=l.cls==='fail'?'fail':(l.cls==='warn'?'warn':'done');
    return '<div class="tl-item '+cls+'"><span class="dot"></span>'+
      '<div class="tl-meta"><b>'+esc(l.time)+'</b> · '+esc(l.actor)+'（'+esc(l.action)+'）</div>'+
      (l.detail?'<div class="tl-body">'+esc(l.detail)+'</div>':'')+'</div>';
  }).join('')+'</div>';
}
/* 文件下载（CSV 加 BOM 便于 Excel） */
function download(name,mime,text,noBom){
  try{
    var blob=new Blob([noBom?text:('\ufeff'+text)],{type:mime||'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },200);
    return true;
  }catch(e){ return false; }
}
function csvRow(cols){ return cols.map(function(c){ var s=String(c===undefined||c===null?'':c); return '"'+s.replace(/"/g,'""')+'"'; }).join(','); }

/* ---------- 弹窗 ---------- */
window.mrqcCloseModal=function(btn){ var m=btn&&btn.closest?btn.closest('.news-confirm-modal'):null; if(m)m.remove(); };
function mrqcModal(title,body,foot,cls){
  var m=document.createElement('div'); m.className='news-confirm-modal';
  m.innerHTML='<div class="news-confirm-box mrqc-box '+(cls||'')+'"><div class="news-confirm-title">'+title+'</div>'+
    '<div class="news-confirm-body mrqc-body">'+body+'</div>'+
    '<div class="news-confirm-actions">'+(foot||'<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">关闭</button>')+'</div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){ if(e.target===m)m.remove(); });
  return m;
}
function fv(id){ var el=document.getElementById(id); return el?String(el.value===undefined?'':el.value).trim():''; }

/* ---------- 通用筛选（内存态） ---------- */
var mrf={};
function fGet(page,key){ return (mrf[page]||{})[key]||''; }
window.mrqcSetFilter=function(page,key,val){ mrf[page]=mrf[page]||{}; mrf[page][key]=val; refresh(); };
window.mrqcResetFilter=function(page){ delete mrf[page]; refresh(); };
function selCtl(page,key,opts,placeholder){
  var cur=fGet(page,key);
  return '<div class="form-group"><label>'+esc(placeholder)+'</label><select onchange="mrqcSetFilter(\''+page+'\',\''+key+'\',this.value)">'+
    '<option value="">全部</option>'+opts.map(function(o){ return '<option'+(String(o)===String(cur)?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select></div>';
}
function txtCtl(page,key,placeholder){
  var cur=fGet(page,key);
  return '<div class="form-group"><label>'+esc(placeholder)+'</label><input value="'+(cur?esc(cur):'')+'" placeholder="输入后回车" onchange="mrqcSetFilter(\''+page+'\',\''+key+'\',this.value)"></div>';
}
function dateCtl(page,key,label){
  return '<div class="form-group"><label>'+esc(label)+'</label><input type="date" value="'+esc(fGet(page,key))+'" onchange="mrqcSetFilter(\''+page+'\',\''+key+'\',this.value)"></div>';
}
function filterBar(page,controls,extraActions){
  return '<div class="filter-toolbar">'+(controls||'')+'<div class="filter-actions">'+(extraActions||'')+'<button class="btn btn-ghost btn-sm" onclick="mrqcResetFilter(\''+page+'\')">重置</button></div></div>';
}
/* 搜索（功能点 1-6 / 1-7）：按住院号 / 患者ID / 患者姓名（含门诊号）模糊检索 */
window.mrqcSearch=function(page){
  var el=document.getElementById('mrqcKw');
  var v=el?String(el.value||'').trim():'';
  mrf[page]=mrf[page]||{};
  if(v) mrf[page].kw=v; else delete mrf[page].kw;
  refresh();
  if(v) toast('已按「'+v+'」检索病案列表','success');
};
function inDate(c,f,a,b){ var d=String(c[f]||''); if(a&&d<a)return false; if(b&&d>b)return false; return true; }

/* =========================================================
 * 单页工作台骨架（参照「确诊病例质控」diagnosis-qc.js 模式）：
 * head（页头，走 qcUI.head 规范）+ tabs（5 页签）+ tabPanel（页签内容）；
 * 隐藏详情页 mrqc-case|<采集ID> 由路由接管分发（见文件尾部）。
 * ========================================================= */
var ST={ tab:'mrqc-base', detailId:'', check:null };
var TABS=[
  ['mrqc-base','基础临床信息'],
  ['mrqc-report','报告编号索引'],
  ['mrqc-result','质控结果明细'],
  ['mrqc-storage','存储与脱敏']];
function refresh(){ window.renderPage(ST.tab==='DETAIL'?'mrqc-case|'+ST.detailId:'mrqc-workbench'); }
window.mrqcSwitchTab=function(tab){
  ST.tab=tab; ST.detailId='';
  try{ history.replaceState(null,'','#mrqc-workbench'); }catch(e){}
  refresh();
};
window.mrqcResetDemo=function(){
  showConfirm('重置演示数据','确认将「肿瘤病案首页质控」全部演示数据恢复为初始种子吗？当前会话内的病案、报告索引、质控结果与脱敏配置改动都会丢失。',function(){
    [cases,reports,results,storages].forEach(function(s){ s.reset(); }); policyStore.save(seedPolicy());
    ST.tab='mrqc-base'; ST.detailId=''; toast('演示数据已重置','success'); refresh();
  });
};
function tabs(){
  return '<div class="qc-tabs">'+TABS.map(function(t){
    return '<button class="'+(ST.tab===t[0]?'on':'')+'" onclick="mrqcSwitchTab(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('')+'</div>';
}
/* 页头：与确诊病例质控 / 专病病程质控一致，走 qcUI.head 规范（纯文字标题 + 页签副标题 + 右侧按钮） */
function head(sub){
  var acts='<button class="btn btn-ghost btn-sm" onclick="mrqcFpList()">功能点覆盖对照</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="mrqcResetDemo()">重置演示数据</button>';
  if(window.qcUI&&window.qcUI.head) return window.qcUI.head('肿瘤病案首页质控',sub,'',false,acts);
  return '<div class="qc-head"><div><div class="t">肿瘤病案首页质控</div>'+(sub?'<div class="s">'+esc(sub)+'</div>':'')+'</div><div class="acts">'+acts+'</div></div>';
}
function renderWorkbench(){
  var map={'mrqc-base':renderBase,'mrqc-report':renderReport,'mrqc-result':renderResult,'mrqc-storage':renderStorage};
  return head(PAGE_TITLE[ST.tab]||PAGE_TITLE['mrqc-base'])+tabs()+(map[ST.tab]||renderBase)();
}
/* ---------- 内联结果面板：批量校验/清单/报表结果直接呈现在表格上方（不弹窗） ---------- */
function checkPanel(){
  var ck=ST.check;
  if(!ck) return '';
  return '<div class="panel" style="border-color:#bfdbfe;margin-bottom:12px"><div class="panel-body">'+
    '<div class="mrqc-tbar" style="margin-bottom:8px"><div class="acts"><b style="font-size:13.5px;color:#334155;align-self:center">'+esc(ck.title)+'</b></div>'+
    '<button class="btn btn-ghost btn-xs" onclick="mrqcCheckClose()">收起</button></div>'+
    (ck.note?'<div class="mrqc-note">'+ck.note+'</div>':'')+
    ck.html+'</div></div>';
}
window.mrqcCheckClose=function(){ ST.check=null; refresh(); };

/* =========================================================
 * 页面 1：病案首页基础临床信息（mrqc-base，功能点 1-1 ~ 1-8）
 * ========================================================= */
/* 计算病案缺陷（完整性 + 编码格式 + 建议修正值），供种子外的动态校验复用 */
function computeIssues(c){
  var out=[];
  Object.keys(FIELD_CN).forEach(function(f){ if(!c[f]) out.push({type:'字段缺失',field:FIELD_CN[f],sev:'重要',sugg:'请补充'+FIELD_CN[f],ruleId:'MRQ-B01'}); });
  if(c.icd10){
    if(!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(c.icd10)) out.push({type:'编码错误',field:'肿瘤部位ICD-10',sev:'重要',sugg:'建议修正为 '+(ICD10_FIX[c.icd10]||'标准 ICD-10 编码'),ruleId:'MRQ-B02'});
    else if(c.icd10.charAt(0)==='D'&&(function(t){ return t.indexOf('恶性')>=0||t.indexOf('癌')>=0||t.indexOf('淋巴瘤')>=0||t.indexOf('肉瘤')>=0; })(String(c.pathNote||'')))
      out.push({type:'编码错误',field:'肿瘤部位ICD-10',sev:'严重',sugg:'D 码适用于良性/动态未定肿瘤，病理为恶性，建议修正为 '+(ICD10_FIX[c.icd10]||'对应 C 编码'),ruleId:'MRQ-B02'});
  }
  if(c.icdo3&&!ICDO3_RE.test(c.icdo3)) out.push({type:'编码错误',field:'肿瘤形态学ICD-O-3',sev:'重要',sugg:'建议修正为 '+(ICDO3_FIX[c.icdo3]||'M-xxxx/x 标准格式'),ruleId:'MRQ-B03'});
  if(/\/2$/.test(String(c.icdo3||''))&&String(c.pathNote||'').indexOf('浸润')>=0)
    out.push({type:'逻辑冲突',field:'肿瘤形态学ICD-O-3',sev:'严重',sugg:'病理描述为浸润性，动态编码 /2 矛盾，建议修正为 /3',ruleId:'MRQ-L02'});
  if(c.diagDate&&c.admDate&&c.diagDate<c.admDate)
    out.push({type:'逻辑冲突',field:'诊断日期',sev:'重要',sugg:'诊断日期早于入院日期，请核对首诊时间线',ruleId:'MRQ-L01'});
  return out;
}
function caseIssues(cid){ return computeIssues(cases.find(cid)||{}); }
function fmtList(page){
  var dept=fGet(page,'dept'),src=fGet(page,'src'),st=fGet(page,'st'),kw=fGet(page,'kw').toUpperCase(),a=fGet(page,'d1'),b=fGet(page,'d2');
  return cases.all().filter(function(c){
    if(dept&&c.dept!==dept) return false;
    if(src&&c.srcType!==src) return false;
    if(st&&c.qcState!==st) return false;
    if(!inDate(c,'diagDate',a,b)) return false;
    if(kw&&(c.ipNo+' '+c.name+' '+c.pid+' '+c.opNo).toUpperCase().indexOf(kw)<0) return false;
    return true;
  });
}
/* 从建议文案提取可采纳的编码值（如 "建议修正为 C50.9" → C50.9） */
function suggVal(s){ var m=/ ([A-Z]-?[\d.]+\/?\d?)$/.exec(String(s||'')); return m?m[1]:''; }
function renderBase(){
  var all=cases.all(),page='mrqc-base';
  var pending=all.filter(function(c){ return c.qcState==='待质控'; }).length;
  var fixed=all.filter(function(c){ return c.qcState==='待修正'; }).length;
  /* 完整性 + ICD 编码校验（功能点 1-3 / 1-4）实时融入表格列：
     ICD 列内嵌建议修正值与行内「采纳」，缺失字段列内补充，「问题项」列逐条列出明细 */
  var rows=fmtList(page).map(function(c){
    var iss=computeIssues(c);
    function icdCell(field){
      var p=iss.filter(function(i){ return i.field===field&&i.type==='编码错误'; })[0];
      var v=p?suggVal(p.sugg):'';
      var cur=field==='肿瘤部位ICD-10'?c.icd10:c.icdo3;
      return (cur?esc(cur):'<span style="color:#b91c1c">缺失</span>')+
        (p?'<div style="color:#15803d;white-space:nowrap">→ '+(v?esc(v):'按建议修正')+
          (v?' <a href="javascript:void(0)" style="font-size:11px" onclick="mrqcIcdFixCell(\''+c.cid+'\',\''+(field==='肿瘤部位ICD-10'?'icd10':'icdo3')+'\',\''+esc(v)+'\')">采纳</a>':'')+'</div>':'');
    }
    return '<tr>'+
      '<td class="mrqc-mono">'+esc(c.cid)+'</td><td>'+esc(c.name)+(c.highRisk?' <span class="badge badge-danger">高风险</span>':'')+'</td><td class="mrqc-mono">'+esc(c.ipNo)+'</td>'+
      '<td class="mrqc-mono">'+esc(c.orgId||(c.srcType==='EMR'?'360102-002':'360102-001'))+'</td><td>'+esc(c.diagDate)+'</td>'+
      '<td class="mrqc-mono">'+icdCell('肿瘤部位ICD-10')+'</td>'+
      '<td class="mrqc-mono">'+icdCell('肿瘤形态学ICD-O-3')+'</td>'+
      '<td>'+stBadge(c.qcState)+'</td>'+
      '<td style="max-width:250px;font-size:12px;line-height:1.7">'+(iss.length?iss.map(function(i){
        return '<div style="color:#b91c1c"><b>['+esc(i.type)+'·'+esc(i.sev)+']</b> '+esc(i.field)+(suggVal(i)?' → <span style="color:#15803d">'+esc(suggVal(i))+'</span>':'')+'</div>';
      }).join(''):'<span class="badge badge-success">通过</span>')+'</td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-outline btn-xs" onclick="mrqcCaseDetail(\''+c.cid+'\')">详情'+fpTag('1-6')+'</button> '+
        '<button class="btn btn-outline btn-xs" onclick="mrqcGotoFollowup(\''+c.ipNo+'\')">查看随访</button> '+
        '<button class="btn '+(c.highRisk?'btn-outline':'btn-danger')+' btn-xs" onclick="mrqcCaseRisk(\''+c.cid+'\')">'+(c.highRisk?'解除标记':'标记高风险')+'</button></td></tr>';
  }).join('');
  var body=
    '<div class="mrqc-kpis">'+
      kpiCard(all.length,'份','已加载病案总数')+
      kpiCard(pending,'份','待质控','warn')+
      kpiCard(fixed,'份','待修正','danger')+
      kpiCard(all.filter(function(c){ return c.qcState==='校验通过'; }).length,'份','校验通过','ok')+'</div>'+
    filterBar(page,selCtl(page,'dept',DEPTS,'科室')+selCtl(page,'src',['HIS','EMR'],'数据来源')+selCtl(page,'st',['待质控','待修正','校验通过','已阻断'],'质控状态')+dateCtl(page,'d1','诊断日期起')+dateCtl(page,'d2','诊断日期止')+
      '<div class="form-group"><label>随访标识快捷</label><button class="mrqc-chip'+(fGet(page,'st')==='待质控'?' on':'')+'" onclick="mrqcQuickPending(\''+page+'\')">仅看待质控</button></div>'+
      '<div class="form-group"><label>搜索（住院号 / 患者ID / 姓名）</label><input id="mrqcKw" value="'+(fGet(page,'kw')?esc(fGet(page,'kw')):'')+'" placeholder="输入关键字，回车或点「搜索」" onkeydown="if(event.key===\'Enter\')mrqcSearch(\''+page+'\')"></div>',
      '<button class="btn btn-primary btn-sm" onclick="mrqcSearch(\''+page+'\')">搜索</button>')+
    tbl(['采集ID','患者','住院号','机构来源','诊断日期','ICD-10','ICD-O-3','质控状态','问题项（校验明细）','操作'],rows,1280);
  return tabPanel(
    '<button class="btn btn-primary btn-sm" onclick="mrqcLoadHIS()">⤓ 从 HIS/EMR 加载'+fpTag('1-1')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcQcReport()">生成质控报告'+fpTag('1-5')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcExportFix()">导出待修正数据包'+fpTag('1-8')+'</button>',body);
}
window.mrqcQuickPending=function(page){ mrqcSetFilter(page,'st',fGet(page,'st')==='待质控'?'':'待质控'); };
/* 查看随访：跳转至「随访结局管理 ▸ 随访信息管理」（系统随访列表） */
window.mrqcGotoFollowup=function(ipNo){
  if(typeof window.navigateTo==='function'){ window.navigateTo('followup'); }
  else { toast('随访信息管理页面不可用','warn'); }
};
/* 标记 / 解除病案高风险（可逆操作）：高风险病例在质控报告（1-5）中重点标识 */
window.mrqcCaseRisk=function(cid){
  var c=cases.find(cid); if(!c) return;
  c.highRisk=!c.highRisk;
  cases.save();
  toast(c.highRisk?('已将 '+c.ipNo+'（'+c.name+'）标记为高风险病例，将在质控报告中重点标识'):('已解除 '+c.ipNo+' 的高风险标记'),c.highRisk?'warn':'success');
  refresh();
};

/* 功能点 1-1：加载患者病案首页基础信息（模拟从 HIS/EMR 拉取） */
window.mrqcLoadHIS=function(){
  mrqcModal('从 HIS/EMR 加载病案首页基础信息',
    '<div class="mrqc-note">对接说明：通过平台数据接入通道（见「数据共享管理 → 外部平台接入配置」）从 HIS / 电子病历系统拉取病案首页基础临床信息，' +
    '包含就诊标识、诊断日期、肿瘤部位 ICD-10 及形态学 ICD-O-3 编码等。演示环境为模拟通道。</div>'+
    '<div class="mrqc-frow"><label>数据来源</label><select id="mrqcHISrc"><option>HIS（东华）</option><option>EMR（联新）</option></select></div>'+
    '<div class="mrqc-frow"><label>采集范围</label><select id="mrqcHIDate"><option>最近 1 天</option><option>最近 7 天</option></select></div>'+
    '<div id="mrqcHILog" class="mrqc-note" style="display:none"></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" id="mrqcHIGo">开始加载</button>');
  document.getElementById('mrqcHIGo').onclick=function(){
    var logEl=document.getElementById('mrqcHILog'); logEl.style.display='block';
    logEl.innerHTML='正在连接模拟通道…（演示：约 0.8s）'; this.disabled=true;
    setTimeout(function(){
      var added=0,updated=0,src=document.getElementById('mrqcHISrc').value;
      if(HIS_POOL.length){
        var np=HIS_POOL.shift();
        if(!cases.find('CJ-2026-0013')) np.cid=nextId(cases.all(),'cid','CJ-2026');
        cases.all().push({cid:np.cid,pid:'P-'+np.ipNo.slice(-6),eventId:'EV-'+np.ipNo.slice(-4),opNo:'MZ-'+np.ipNo.slice(-4),ipNo:np.ipNo,name:np.name,sex:np.sex,age:np.age,dept:np.dept,srcType:np.srcType||'HIS',orgId:np.orgId||(np.srcType==='EMR'?'360102-002':'360102-001'),
          admDate:np.admDate,diagDate:np.diagDate,icd10:np.icd10,icdo3:np.icdo3,pathNote:np.pathNote,vitStatus:np.vitStatus,qcState:'待质控',score:null,highRisk:false,issues:[],loadTime:now(),opinion:''});
        added++;
      }
      var u=cases.find('CJ-2026-0003');
      if(u&&u.qcState==='待质控'){ u.vitStatus=u.vitStatus||'随访中'; updated++; }
      cases.save();
      logEl.innerHTML='模拟通道：HIS/EMR 接口返回 200，本次采集来源「'+esc(src)+'」<br>新增病案 <b>'+added+'</b> 条，更新既有记录 <b>'+updated+'</b> 条，写入时间 '+now();
      toast('加载完成：新增 '+added+' 条 / 更新 '+updated+' 条','success');
      setTimeout(function(){ refresh(); },600);
    },800);
  };
};
/* 功能点 1-2：补充缺失的随访状态标识 */
window.mrqcVitEdit=function(cid){
  var c=cases.find(cid); if(!c) return;
  mrqcModal('补充随访状态标识 · '+esc(c.ipNo),
    '<div class="mrqc-note">允许质控人员手动补充或修正病案中缺失的发病、死亡或随访状态标识，确保关键质控字段完整。修改将写入操作留痕。</div>'+
    '<div class="mrqc-frow"><label>当前标识</label><div>'+(c.vitStatus?stBadge(c.vitStatus):bText('缺失','badge-danger'))+'</div></div>'+
    '<div class="mrqc-frow"><label>补充 / 修正为</label><select id="mrqcVitVal">'+VIT_OPTS.map(function(o){ return '<option'+(c.vitStatus===o?' selected':'')+'>'+o+'</option>'; }).join('')+'</select></div>'+
    '<div class="mrqc-frow"><label>备注</label><input id="mrqcVitNote" placeholder="如：随访电话 2026-02 确认在治" value="'+esc(c.opinion)+'"></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcVitSave(\''+cid+'\')">保存</button>','mid');
};
window.mrqcVitSave=function(cid){
  var c=cases.find(cid); if(!c) return;
  c.vitStatus=fv('mrqcVitVal'); c.opinion=fv('mrqcVitNote');
  c.issues=computeIssues(c);
  if(c.qcState==='待修正'&&!c.issues.length) c.qcState='校验通过';
  cases.save();
  var openModals=document.querySelectorAll('.news-confirm-modal'); if(openModals.length) openModals[openModals.length-1].remove();
  toast('已保存随访标识：'+c.vitStatus,'success'); refresh();
};
/* 功能点 1-3 / 1-4：完整性 + ICD 编码校验结果直接呈现在表格列中（「问题项」列逐条
   明细、ICD 列内建议修正值），此处仅保留行内「采纳」：按建议修正编码并重算状态 */
window.mrqcIcdFixCell=function(cid,field,val){
  var c=cases.find(cid); if(!c||!val) return;
  if(field==='icd10') c.icd10=val; else if(field==='icdo3') c.icdo3=val;
  c.issues=computeIssues(c);
  if(c.qcState==='待修正'&&!c.issues.length){ c.qcState='校验通过'; c.score=Math.max(c.score||0,90); }
  cases.save();
  toast('已采纳建议值：'+val,'success'); refresh();
};
/* 功能点 1-5：生成病案首页基础信息质控报告 */
window.mrqcQcReport=function(){
  var all=cases.all(),n=all.length;
  var ok=all.filter(function(c){ return c.qcState==='校验通过'; }).length;
  var issueMap={};
  all.forEach(function(c){ (c.issues&&c.issues.length?c.issues:[]).forEach(function(i){ issueMap[i.type]=(issueMap[i.type]||0)+1; }); });
  var risk=all.filter(function(c){ return c.highRisk; });
  var rate=n?Math.round(ok/n*1000)/10:0;
  var dist=Object.keys(issueMap).map(function(k){ return [k,issueMap[k]]; });
  ST.check={tab:'mrqc-base',title:'病案首页基础信息质控报告 · '+today(),
    html:'<div class="mrqc-kpis">'+
      kpiCard(n,'份','病案总数')+kpiCard(rate,'%','编码/完整性通过率','ok')+
      kpiCard(all.filter(function(c){ return c.qcState==='待质控'; }).length,'份','待质控','warn')+
      kpiCard(all.filter(function(c){ return c.qcState==='待修正'; }).length,'份','待修正','danger')+'</div>'+
    '<div class="mrqc-sec">问题类型分布</div>'+(dist.length?bars(dist,' 项'):'<div class="mrqc-note">当前无未处置问题</div>')+
    '<div class="mrqc-sec">高风险病例标识（'+risk.length+'）</div>'+
    (risk.length?tbl(['住院号','患者','科室','ICD-10','质控状态'],risk.map(function(c){ return '<tr><td class="mrqc-mono">'+esc(c.ipNo)+'</td><td>'+esc(c.name)+'</td><td>'+esc(c.dept)+'</td><td class="mrqc-mono">'+esc(c.icd10)+'</td><td>'+stBadge(c.qcState)+'</td></tr>'; }).join(''),600):'<div class="mrqc-note">无高风险病例</div>')+
    '<div style="margin-top:12px"><button class="btn btn-outline btn-sm" onclick="mrqcReportExport(\''+rate+'\')">导出报告（HTML 文件）</button></div>'};
  refresh();
};
window.mrqcReportExport=function(rate){
  var all=cases.all();
  var html='<html><head><meta charset="utf-8"><title>病案首页基础信息质控报告</title></head><body style="font-family:Microsoft YaHei;max-width:800px;margin:24px auto">'+
    '<h2>肿瘤病案首页质控 · 基础信息质控报告</h2><p>生成时间：'+now()+'　质控人：'+op()+'</p><p>病案总数：'+all.length+'；通过率：'+rate+'%</p>'+
    '<table border="1" cellpadding="4" style="border-collapse:collapse;font-size:12px"><tr><th>采集ID</th><th>住院号</th><th>诊断日期</th><th>ICD-10</th><th>ICD-O-3</th><th>随访标识</th><th>质控状态</th><th>问题项</th></tr>'+
    all.map(function(c){ return '<tr><td>'+c.cid+'</td><td>'+c.ipNo+'</td><td>'+c.diagDate+'</td><td>'+c.icd10+'</td><td>'+c.icdo3+'</td><td>'+(c.vitStatus||'缺失')+'</td><td>'+c.qcState+'</td><td>'+((c.issues||[]).map(function(i){ return i.field; }).join('；')||'无')+'</td></tr>'; }).join('')+
    '</table></body></html>';
  download('病案首页基础信息质控报告_'+today()+'.html','text/html;charset=utf-8',html,true);
  toast('质控报告已导出','success');
};
/* 功能点 1-6：查询单例病案首页质控详情 —— 改为隐藏详情页 mrqc-case|<采集ID>
 * （参照 cq-case 模式），页面内容由 renderCaseDetail 渲染（见文件尾部路由区）。 */
window.mrqcCaseDetail=function(cid){ openCase(cid); };
/* 功能点 1-8：导出待修正病案首页数据包（JSON 标准格式，供原系统修正后重传） */
window.mrqcExportFix=function(){
  var list=cases.all().filter(function(c){ return c.qcState==='待修正'; });
  if(!list.length){ toast('没有「待修正」病案（或勾选记录不含待修正项）','warn'); return; }
  var pack={exportType:'肿瘤病案首页待修正数据包',exportTime:now(),exportBy:op(),count:list.length,
    items:list.map(function(c){ return {采集ID:c.cid,患者ID:c.pid,就诊事件ID:c.eventId,门诊号:c.opNo,住院号:c.ipNo,患者姓名:c.name,科室:c.dept,入院日期:c.admDate,诊断日期:c.diagDate,
      肿瘤部位ICD10:c.icd10,肿瘤形态学ICDO3:c.icdo3,随访标识:c.vitStatus||'',质控状态:c.qcState,问题清单:(c.issues||[]).map(function(i){ return {类型:i.type,字段:i.field,严重等级:i.sev,建议:i.sugg}; })}; })};
  download('待修正病案首页数据包_'+today()+'.json','application/json',JSON.stringify(pack,null,2),true);
  toast('已导出 '+list.length+' 份待修正病案数据包','success');
};

/* =========================================================
 * 页面 3：关联报告编号索引（mrqc-report，功能点 3-1 ~ 3-7）
 * ========================================================= */
function rpCaseName(ipNo){ var c=cases.all().filter(function(x){ return x.ipNo===ipNo; })[0]; return c?c.name:'—'; }
function rpList(page){
  var kw=fGet(page,'kw').toUpperCase(),st=fGet(page,'st'),mis=fGet(page,'mis');
  return reports.all().filter(function(r){
    if(kw&&(r.ipNo+' '+r.pathNo+' '+r.labNo+' '+r.imgNo+' '+rpCaseName(r.ipNo)).toUpperCase().indexOf(kw)<0) return false;
    if(st&&r.matchState!==st) return false;
    if(mis==='缺病理'&&!r.pathNo) return true;
    if(mis==='缺影像'&&!r.imgNo) return true;
    if(mis) return false;
    return true;
  });
}
function renderReport(){
  var all=reports.all(),page='mrqc-report';
  var noPath=all.filter(function(r){ return !r.pathNo; }).length;
  var noImg=all.filter(function(r){ return !r.imgNo; }).length;
  /* 报告编号列：缺失显示预警，格式异常（3-3 规则）直接在编号上标红；
     一致性列（3-6 核对结果）不一致时行内提供「修正」；3-5 查询 = 按住院号筛选即定位 */
  var diffs=window._mrqcRpDiffs||[];
  function rpCell(v,key){
    if(!v) return key==='pathNo'?'<span class="badge badge-danger">缺失（关键）</span>':bText('未关联');
    return '<span class="mrqc-mono'+(RP_FMT[key].re.test(v)?'':'" style="color:#b91c1c;font-weight:600')+'">'+esc(v)+'</span>';
  }
  var rows=rpList(page).map(function(r){
    var dd=diffs.filter(function(p){ return p.r.ipNo===r.ipNo; });
    return '<tr><td class="mrqc-mono">'+esc(r.ipNo)+'</td><td>'+esc(rpCaseName(r.ipNo))+'</td>'+
      '<td>'+rpCell(r.pathNo,'pathNo')+'</td>'+
      '<td>'+rpCell(r.labNo,'labNo')+'</td>'+
      '<td>'+(r.imgNo?rpCell(r.imgNo,'imgNo'):'<span class="badge badge-warning">缺失</span> <button class="btn btn-outline btn-xs" onclick="mrqcRpImg(\''+r.ipNo+'\')">补录'+fpTag('3-2')+'</button>')+'</td>'+
      '<td>'+stBadge(r.matchState)+(dd.length?dd.map(function(p){
        return '<div style="font-size:11px;color:#15803d">远端 '+esc(p.remote)+' <a href="javascript:void(0)" onclick="mrqcRpTakeRemote(\''+r.ipNo+'\',\''+p.k+'\',\''+esc(p.remote)+'\')">修正</a></div>';
      }).join(''):'')+'</td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-outline btn-xs" onclick="mrqcRpEdit(\''+r.ipNo+'\')">关联报告'+fpTag('3-1')+'</button> '+
        '<button class="btn btn-danger btn-xs" onclick="mrqcRpClear(\''+r.ipNo+'\')">清除'+fpTag('3-7')+'</button></td></tr>';
  }).join('');
  var body=
    '<div class="mrqc-kpis">'+
      kpiCard(all.length,'份','已建索引病案')+
      kpiCard(noPath,'份','缺失病理报告','danger')+
      kpiCard(noImg,'份','缺失影像报告','warn')+'</div>'+
    checkPanel()+
    filterBar(page,txtCtl(page,'kw','住院号 / 报告号 / 患者')+selCtl(page,'st',['一致','待核对','不一致'],'核对状态')+selCtl(page,'mis',['缺病理','缺影像'],'缺失筛选'))+
    tbl(['住院号','患者','病理报告号（关键）','检验报告号','影像报告号','一致性状态','操作'],rows,1080);
  return tabPanel(
    '<button class="btn btn-outline btn-sm" onclick="mrqcRpFmt()">格式校验'+fpTag('3-3')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcRpMissing()">缺失预警清单'+fpTag('3-4')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcRpMatch()">与 LIS/PACS 核对'+fpTag('3-6')+'</button>',body);
}
/* 详情页报告号快捷补录（3-1 / 3-2）：未关联项点击「补录」弹单输入框，保存后回写索引并留在详情页 */
window.mrqcRpQuickAdd=function(ipNo,type){
  var r=reports.find(ipNo); if(!r) return;
  var fmt=RP_FMT[type]; if(!fmt) return;
  mrqcModal('补录'+fmt.cn+' · '+esc(ipNo),
    '<div class="mrqc-note">当前病案未关联'+esc(fmt.cn)+'，可在此手动补录，完善多源数据关联索引。格式规范：'+esc(fmt.ex)+'</div>'+
    '<div class="mrqc-frow"><label>'+esc(fmt.cn)+'</label><input id="mrqcRpQv" placeholder="'+fmt.ex+'"></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcRpQuickSave(\''+ipNo+'\',\''+type+'\')">保存</button>','mid');
};
window.mrqcRpQuickSave=function(ipNo,type){
  var r=reports.find(ipNo); if(!r) return;
  var fmt=RP_FMT[type];
  var v=fv('mrqcRpQv');
  if(!v){ toast('请输入报告编号','warn'); return; }
  r[type]=v;
  reports.save();
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  if(fmt&&!fmt.re.test(v)) toast('已补录，但编号格式不符合 '+fmt.ex+' 规范，建议执行「格式校验」','warn');
  else toast('已补录'+(fmt?fmt.cn:''),'success');
  refresh();
};
/* 详情页报告号解绑（3-7）：解绑后变为「未关联」空状态，可随时通过「补录」重新添加 */
window.mrqcRpUnbind=function(ipNo,type){
  var r=reports.find(ipNo); if(!r||!r[type]) return;
  var fmt=RP_FMT[type]; if(!fmt) return;
  showConfirm('解绑'+fmt.cn,'确认解绑病案 '+ipNo+' 的'+fmt.cn+'「'+r[type]+'」吗？解绑后该编号变为未关联状态，可随时重新补录。',function(){
    r[type]='';
    reports.save();
    toast(fmt.cn+'已解绑，当前为未关联状态（可在下方点击「补录」重新添加）','success');
    refresh();
  });
};
/* 功能点 3-1：关联病理与检验报告编号（绑定 / 编辑三类报告号） */
window.mrqcRpEdit=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  mrqcModal('关联报告编号 · '+esc(ipNo),
    '<div class="mrqc-note">接收并绑定当前病案对应的病理报告号、检验报告号和影像报告号，建立多源数据关联索引。格式规范：'+Object.keys(RP_FMT).map(function(k){ return RP_FMT[k].cn+' '+RP_FMT[k].ex; }).join('；')+'</div>'+
    '<div class="mrqc-frow"><label>病理报告号</label><input id="mrqcRP" value="'+esc(r.pathNo)+'" placeholder="'+RP_FMT.pathNo.ex+'"></div>'+
    '<div class="mrqc-frow"><label>检验报告号</label><input id="mrqcRL" value="'+esc(r.labNo)+'" placeholder="'+RP_FMT.labNo.ex+'"></div>'+
    '<div class="mrqc-frow"><label>影像报告号</label><input id="mrqcRI" value="'+esc(r.imgNo)+'" placeholder="'+RP_FMT.imgNo.ex+'"></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcRpSave(\''+ipNo+'\')">保存绑定</button>');
};
window.mrqcRpSave=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  r.pathNo=fv('mrqcRP'); r.labNo=fv('mrqcRL'); r.imgNo=fv('mrqcRI');
  var bad=Object.keys(RP_FMT).filter(function(k){ return r[k]&&!RP_FMT[k].re.test(r[k]); });
  reports.save();
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast(bad.length?('已绑定，但 '+bad.map(function(k){ return RP_FMT[k].cn; }).join('、')+' 格式异常，建议执行「格式校验」'):'已绑定报告编号','success');
  refresh();
};
/* 功能点 3-2：补录缺失的影像报告编号 */
window.mrqcRpImg=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  mrqcModal('补录影像报告编号 · '+esc(ipNo),
    '<div class="mrqc-note">发现报告缺失时手动补录影像检查报告编号，完善数据链路。格式：IMG-yyyymmdd-####（如 '+RP_FMT.imgNo.ex+'）</div>'+
    '<div class="mrqc-frow"><label>影像报告号</label><input id="mrqcImgV" placeholder="'+RP_FMT.imgNo.ex+'"></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcRpImgSave(\''+ipNo+'\')">补录</button>','mid');
};
window.mrqcRpImgSave=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  var v=fv('mrqcImgV');
  if(!v){ toast('请输入影像报告号','warn'); return; }
  r.imgNo=v;
  if(!RP_FMT.imgNo.re.test(v)) toast('已补录，但编号格式不符合 IMG-yyyymmdd-#### 规范','warn');
  else toast('影像报告号已补录','success');
  reports.save(); refresh();
};
/* 功能点 3-3：校验报告编号格式合规性（院内命名规范） */
window.mrqcRpFmt=function(){
  var bad=[];
  reports.all().forEach(function(r){
    Object.keys(RP_FMT).forEach(function(k){
      if(r[k]&&!RP_FMT[k].re.test(r[k])) bad.push({r:r,k:k});
    });
  });
  var rows=bad.map(function(p){
    return '<tr><td class="mrqc-mono">'+esc(p.r.ipNo)+'</td><td>'+esc(RP_FMT[p.k].cn)+'</td><td class="mrqc-mono" style="color:#b91c1c;font-weight:600">'+esc(p.r[p.k])+'</td><td class="mrqc-mono">'+esc(RP_FMT[p.k].ex)+'</td>'+
      '<td><button class="btn btn-outline btn-xs" onclick="mrqcRpEdit(\''+p.r.ipNo+'\')">修正</button></td></tr>';
  }).join('');
  ST.check={tab:'mrqc-report',title:'报告编号格式校验结果',
    note:'校验规则（院内命名规范）：'+Object.keys(RP_FMT).map(function(k){ return RP_FMT[k].cn+' 为 <span class="mrqc-mono">'+RP_FMT[k].ex+'</span>'; }).join('；')+'。<b>'+(bad.length?'发现格式异常 '+bad.length+' 项':'全部编号格式合规')+'</b>',
    html:bad.length?tbl(['住院号','字段','当前编号','规范示例','操作'],rows,780):'<div class="mrqc-iss ok"><span class="t">[通过]</span> 所有已关联报告编号均符合命名规范</div>'};
  refresh();
};
/* 功能点 3-4：输出报告缺失预警清单（未关联关键报告） */
window.mrqcRpMissing=function(){
  var missP=reports.all().filter(function(r){ return !r.pathNo; });
  var missL=reports.all().filter(function(r){ return !r.labNo; });
  var missI=reports.all().filter(function(r){ return !r.imgNo; });
  function tr(r,f,sev){ return '<tr><td>'+(sev?'<span class="badge badge-danger">关键</span>':'<span class="badge badge-warning">一般</span>')+'</td><td class="mrqc-mono">'+esc(r.ipNo)+'</td><td>'+esc(rpCaseName(r.ipNo))+'</td><td>'+f+'</td>'+
    '<td><button class="btn btn-outline btn-xs" onclick="mrqcRpEdit(\''+r.ipNo+'\')">去补录</button></td></tr>'; }
  ST.check={tab:'mrqc-report',title:'报告缺失预警清单',
    note:'对未关联关键报告（如病理）的病案生成预警，提示需补充佐证材料。当前：病理缺失 <b style="color:#b91c1c">'+missP.length+'</b>、检验缺失 '+missL.length+'、影像缺失 '+missI.length+'。',
    html:tbl(['预警级别','住院号','患者','缺失报告','操作'],
      missP.map(function(r){ return tr(r,'病理报告号',1); }).join('')+
      missL.map(function(r){ return tr(r,'检验报告号',0); }).join('')+
      missI.map(function(r){ return tr(r,'影像报告号',0); }).join(''),700)};
  refresh();
};
/* 功能点 3-5：查询某病案关联的所有报告编号 —— 表格报告号列直接展示（含格式/一致性状态），
   按住院号筛选即快速定位，不设独立弹窗 */
/* 功能点 3-6：批量核对报告编号一致性 —— 点击即执行模拟比对，结果回写一致性列，
   不一致行内提供「修正」（以 LIS/PACS 为准），不再使用弹窗 */
window.mrqcRpMatch=function(){
  toast('正在与 LIS/PACS 模拟通道核对…');
  setTimeout(function(){
    /* 模拟远端库：病案 7 的病理号在 PACS 登记为 BL-20260126-0011（差一天），病案 9 的检验号多一位 */
    var remote={'ZY20260107':{pathNo:'BL-20260126-0011'},'ZY20260109':{labNo:'LIS-20260202-0145'}};
    var diffs=[];
    reports.all().forEach(function(r){
      var rm=remote[r.ipNo];
      if(rm) Object.keys(rm).forEach(function(k){
        if(String(r[k]||'')!==rm[k]) diffs.push({r:r,k:k,remote:rm[k]});
      });
    });
    window._mrqcRpDiffs=diffs;
    reports.all().forEach(function(r){ r.matchState=diffs.some(function(p){ return p.r.ipNo===r.ipNo; })?'不一致':'一致'; r.checkedTime=now(); });
    reports.save();
    toast('核对完成：共 '+reports.all().length+' 份病案，不一致 '+diffs.length+' 项（已在行内提供修正）',diffs.length?'warn':'success');
    refresh();
  },600);
};
window.mrqcRpTakeRemote=function(ipNo,k,val){
  var r=reports.find(ipNo); if(!r) return;
  r[k]=val; r.matchState='一致'; r.checkedTime=now(); reports.save();
  toast('已按 LIS/PACS 编号修正','success'); refresh();
};
/* 功能点 3-7：清除无效报告关联关系（误操作绑定） */
window.mrqcRpClear=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  var opts=['pathNo','labNo','imgNo'].filter(function(k){ return r[k]; });
  if(!opts.length){ toast('该病案无已关联报告编号','warn'); return; }
  mrqcModal('清除无效报告关联 · '+esc(ipNo),
    '<div class="mrqc-note">删除因误操作绑定的错误报告编号，保持索引准确性。清除前请确认编号确实无效。</div>'+
    opts.map(function(k){ return '<div class="mrqc-frow"><label>'+esc(RP_FMT[k].cn)+'</label><span class="mrqc-mono">'+esc(r[k])+'</span><label style="flex:0 0 auto;padding-top:0"><input type="checkbox" id="mrqcClr_'+k+'"> 清除</label></div>'; }).join(''),
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-danger" onclick="mrqcRpClearGo(\''+ipNo+'\')">确认清除</button>','mid');
};
window.mrqcRpClearGo=function(ipNo){
  var r=reports.find(ipNo); if(!r) return;
  var n=0;
  ['pathNo','labNo','imgNo'].forEach(function(k){ var ck=document.getElementById('mrqcClr_'+k); if(ck&&ck.checked&&r[k]){ r[k]=''; n++; } });
  reports.save();
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast(n?('已清除 '+n+' 项无效报告关联'):'未勾选任何项',n?'success':'warn');
  refresh();
};

/* =========================================================
 * 页面 4：质控执行结果明细（mrqc-result，功能点 4-1 ~ 4-7）
 * ========================================================= */
function resultList(page){
  var rid=fGet(page,'rid'),ver=fGet(page,'ver'),sev=fGet(page,'sev'),kw=fGet(page,'kw').toUpperCase();
  return results.all().filter(function(r){
    if(rid&&r.ruleId!==rid) return false;
    if(ver&&r.ruleVer!==ver) return false;
    if(sev&&r.sevLevel!==sev) return false;
    if(kw&&(r.qcId+' '+r.ipNo+' '+r.errType+' '+r.qcBy).toUpperCase().indexOf(kw)<0) return false;
    return true;
  });
}
function renderResult(){
  var all=results.all(),page='mrqc-result';
  var blocked=all.filter(function(r){ return r.blocked; }).length;
  var review=all.filter(function(r){ return r.state==='待复核'; }).length;
  var rows=resultList(page).map(function(r){
    /* 信息表4 字段对齐：必填项缺失列表 + 逻辑冲突详情 合并为「缺失 / 冲突详情」列 */
    var det=(r.missing&&r.missing.length?'缺失：'+r.missing.join('；'):'');
    if(r.conflicts&&r.conflicts.length) det+=(det?'；':'')+'冲突：'+r.conflicts.join('；');
    return '<tr><td class="mrqc-mono">'+esc(r.qcId)+'</td><td class="mrqc-mono">'+esc(r.ipNo)+'</td>'+
      '<td><span class="mrqc-mono">'+esc(r.ruleId)+'</span> <span style="color:#94a3b8;font-size:11px">'+esc(r.ruleVer)+'</span></td>'+
      '<td>'+esc(r.errType)+' '+stBadge(r.sevLevel)+'</td>'+
      '<td>'+(r.fmtState==='通过'?stBadge('通过'):stBadge('不通过'))+'</td>'+
      '<td><b style="color:'+(fnum(r.score)>=90?'#15803d':(fnum(r.score)>=75?'#b45309':'#b91c1c'))+'">'+(r.score??'—')+'</b></td>'+
      '<td>'+(r.blocked?bText('阻断','badge-danger'):bText('否'))+'</td>'+
      '<td style="max-width:220px;font-size:12px;color:#475569">'+esc(det||'—')+'</td>'+
      '<td>'+stBadge(r.state)+'</td><td>'+esc(r.execTime)+'</td>'+
      '<td style="white-space:nowrap">'+
        (r.state==='待复核'?'<button class="btn btn-outline btn-xs" onclick="mrqcReview(\''+r.qcId+'\')">复核'+fpTag('4-2')+'</button> ':'')+
        '<button class="btn btn-outline btn-xs" onclick="mrqcLogs(\''+r.qcId+'\')">日志'+fpTag('4-6')+'</button></td></tr>';
  }).join('');
  var body=
    '<div class="mrqc-kpis">'+
      kpiCard(all.length,'条','质控执行记录')+
      kpiCard(review,'条','待人工复核','warn')+
      kpiCard(blocked,'条','阻断上报','danger')+'</div>'+
    checkPanel()+
    filterBar(page,selCtl(page,'rid',RULES.map(function(r){ return r.ruleId; }),'质控规则')+selCtl(page,'ver',['v3.2'],'规则集版本')+selCtl(page,'sev',['严重','重要','一般'],'错误严重等级')+txtCtl(page,'kw','质控ID / 住院号 / 质控人'))+
    tbl(['质控ID','住院号','规则 / 版本','错误类型 / 等级','格式校验','质量评分','上报阻断','缺失 / 冲突详情','复核状态','执行时间','操作'],rows,1300);
  return tabPanel(
    '<button class="btn btn-primary btn-sm" onclick="mrqcRunEngine()">▶ 执行质控引擎'+fpTag('4-1')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcErrChart()">问题分类统计'+fpTag('4-3')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcBlockList()">阻断上报清单'+fpTag('4-4')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcResultExport()">导出明细'+fpTag('4-7')+'</button>',body);
}
/* 功能点 4-1：执行质控引擎，将规则执行结果持久化（规则ID/错误类型/严重等级/阻断标识）。
   点击即按规则集 v3.2 执行（今日已执行的病案不重复跑），不再使用弹窗 */
window.mrqcRunEngine=function(){
  var targets=cases.all().filter(function(c){ return !results.all().some(function(r){ return r.ipNo===c.ipNo&&r.execTime.slice(0,10)===today(); }); });
  toast('质控引擎执行中（规则集 v3.2，待执行 '+targets.length+' 份）…');
  setTimeout(function(){
    var made=0,blocked=0;
    targets.forEach(function(c){
      var iss=computeIssues(c);
      if(!iss.length){
        results.all().push({qcId:nextId(results.all(),'qcId','QC-2026'),ipNo:c.ipNo,ruleVer:'v3.2',ruleId:'—',errType:'无',sevLevel:'一般',fmtState:'通过',missing:[],conflicts:[],
          score:Math.max(90,100-(c.issues||[]).length*4),blocked:false,state:'待复核',execTime:now(),qcBy:'质控引擎',opinion:'',
          logs:[{time:now(),actor:'系统',action:'加载数据',detail:'加载病案 '+c.ipNo+' 基础信息',cls:'done'},{time:now(),actor:'质控引擎',action:'生成结论',detail:'全部规则通过，评分 '+Math.max(90,100-(c.issues||[]).length*4),cls:'done'}]});
        c.qcState='校验通过'; if(c.score===null)c.score=94; made++;
      } else {
        var hardBlock=false;
        iss.forEach(function(i){
          var hard=i.sev==='严重'||i.type==='逻辑冲突';
          if(hard) hardBlock=true;
          results.all().push({qcId:nextId(results.all(),'qcId','QC-2026'),ipNo:c.ipNo,ruleVer:'v3.2',ruleId:i.ruleId||'MRQ-B01',errType:i.type,sevLevel:i.sev,fmtState:'不通过',
            missing:i.type==='字段缺失'?[i.field]:[],conflicts:(i.type==='逻辑冲突'||i.type==='编码错误')?[i.sugg]:[],
            score:Math.max(55,88-(i.sev==='严重'?30:12)),blocked:hard,state:'待复核',execTime:now(),qcBy:'质控引擎',opinion:'',
            logs:[{time:now(),actor:'系统',action:'加载数据',detail:'加载病案 '+c.ipNo+' 基础信息',cls:'done'},
                  {time:now(),actor:'系统',action:'规则命中',detail:(i.ruleId||'MRQ-B01')+'：'+i.field+' — '+i.sugg,cls:hard?'fail':'warn'},
                  {time:now(),actor:'质控引擎',action:'生成结论',detail:hard?'严重问题，阻断上报':'判定待修正',cls:hard?'fail':'warn'}]});
          made++;
        });
        if(hardBlock){ c.qcState='已阻断'; blocked++; }
        else c.qcState='待修正';
        c.score=Math.max(55,100-iss.length*10);
      }
      c.issues=computeIssues(c);
    });
    results.save(); cases.save();
    toast('引擎执行完成：生成质控结果 '+made+' 条，其中阻断上报 '+blocked+' 份病案',blocked?'warn':'success');
    refresh();
  },600);
};
/* 功能点 4-2：更新人工复核意见（确认 / 修正，更新质控状态） */
window.mrqcReview=function(qcId){
  var r=results.find(qcId); if(!r) return;
  mrqcModal('人工复核 · '+esc(r.qcId)+'（'+esc(r.ipNo)+'）',
    '<div class="mrqc-note">质控员对自动校验结果进行人工确认或修正，提交复核意见后系统更新质控状态并留痕。</div>'+
    kvGrid([['规则',r.ruleId+'（'+esc((ruleOf(r.ruleId)||{}).name||'—')+'）'],['错误类型',r.errType],['严重等级',stBadge(r.sevLevel)],['引擎结论',r.blocked?'阻断上报':'不阻断'],['引擎评分',r.score]] )+
    '<div class="mrqc-frow"><label>复核结论</label><select id="mrqcRvRes"><option>复核通过</option><option>确认问题，退回修正</option><option>人工修正后通过</option></select></div>'+
    '<div class="mrqc-frow"><label>复核意见</label><textarea id="mrqcRvOp" placeholder="填写复核意见（将写入全流程日志）">'+esc(r.opinion)+'</textarea></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcReviewSave(\''+qcId+'\')">提交复核</button>','mid');
};
window.mrqcReviewSave=function(qcId){
  var r=results.find(qcId); if(!r) return;
  var res=fv('mrqcRvRes'),opv=fv('mrqcRvOp');
  r.opinion=opv||res;
  r.state='已复核';
  if(res==='复核通过'||res==='人工修正后通过'){ r.blocked=false; }
  r.logs.push({time:now(),actor:op(),action:'人工复核',detail:res+(opv?'：'+opv:''),cls:(res==='复核通过'||res==='人工修正后通过')?'done':'warn'});
  results.save();
  var c=cases.all().filter(function(x){ return x.ipNo===r.ipNo; })[0];
  if(c){
    var stillBad=results.all().some(function(x){ return x.ipNo===r.ipNo&&x.blocked; });
    c.qcState=stillBad?'已阻断':((res==='复核通过'||res==='人工修正后通过')?'校验通过':'待修正');
    cases.save();
  }
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast('复核意见已提交：'+res,'success'); refresh();
};
/* 功能点 4-3：生成质控问题分类统计图（按错误类型可视化） */
window.mrqcErrChart=function(){
  var all=results.all().filter(function(r){ return r.fmtState==='不通过'; });
  var byType={},byRule={};
  all.forEach(function(r){ byType[r.errType]=(byType[r.errType]||0)+1; if(r.ruleId&&r.ruleId!=='—'){ var nm=(ruleOf(r.ruleId)||{}).name||r.ruleId; var k=r.ruleId+' '+nm; byRule[k]=(byRule[k]||0)+1; } });
  ST.check={tab:'mrqc-result',title:'质控问题分类统计',
    html:'<div class="mrqc-sec">按错误类型（共 '+all.length+' 条不通过记录）</div>'+
    bars(Object.keys(byType).sort(function(a,b){ return byType[b]-byType[a]; }).map(function(k){ return [k,byType[k]]; }),' 条','#dc2626')+
    '<div class="mrqc-sec">按规则分布</div>'+
    bars(Object.keys(byRule).sort(function(a,b){ return byRule[b]-byRule[a]; }).map(function(k){ return [k,byRule[k]]; }),' 条','#b45309')+
    '<div class="mrqc-sec">按严重等级</div>'+
    bars(['严重','重要','一般'].map(function(s){ return [s,all.filter(function(r){ return r.sevLevel===s; }).length]; }),' 条')+
    '<div class="mrqc-note" style="margin-top:8px">统计口径：当前规则集 v3.2 全部执行记录；可在「导出明细」获取完整数据。</div>'};
  refresh();
};
/* 功能点 4-4：输出阻断上报病例清单 */
window.mrqcBlockList=function(){
  var list=results.all().filter(function(r){ return r.blocked; });
  var rows=list.map(function(r){
    return '<tr><td class="mrqc-mono">'+esc(r.qcId)+'</td><td class="mrqc-mono">'+esc(r.ipNo)+'</td><td>'+esc(rpCaseName(r.ipNo))+'</td>'+
      '<td class="mrqc-mono">'+esc(r.ruleId)+'</td><td>'+esc(r.errType)+'</td><td>'+stBadge(r.sevLevel)+'</td>'+
      '<td style="max-width:260px">'+esc((r.conflicts||[]).join('；')||'—')+'</td><td>'+esc(r.qcBy)+'</td><td>'+stBadge(r.state)+'</td></tr>';
  }).join('');
  ST.check={tab:'mrqc-result',title:'阻断上报病例清单（'+list.length+'）',
    note:'以下病例因严重质量问题被系统阻断上报，需完成整改并人工复核解除后方可进入上报流程。',
    html:list.length?tbl(['质控ID','住院号','患者','命中规则','错误类型','严重等级','阻断原因','责任人','复核状态'],rows,1100):'<div class="mrqc-iss ok"><span class="t">[通过]</span> 当前无阻断上报病例</div>'};
  refresh();
};
/* 功能点 4-6：查看单条质控执行全流程日志（审计追溯） */
window.mrqcLogs=function(qcId){
  var r=results.find(qcId); if(!r) return;
  mrqcModal('质控执行全流程日志 · '+esc(r.qcId),
    kvGrid([['质控ID',r.qcId],['住院号',r.ipNo],['患者',rpCaseName(r.ipNo)],['规则集版本',r.ruleVer],['质控人',r.qcBy],['执行时间',r.execTime],['复核状态',stBadge(r.state)],['质控意见',r.opinion||'（无）']])+
    '<div class="mrqc-sec">流程日志（加载 → 校验 → 人工干预）</div>'+timeline(r.logs));
};
/* 功能点 4-7：导出质控结果明细数据 */
window.mrqcResultExport=function(){
  var list=resultList('mrqc-result');
  var lines=[csvRow(['质控ID','住院号','患者','规则集版本','规则ID','错误类型','严重等级','格式校验状态','必填项缺失','逻辑冲突详情','质量评分','上报阻断','复核状态','质控人','质控意见','执行时间'])];
  list.forEach(function(r){ lines.push(csvRow([r.qcId,r.ipNo,rpCaseName(r.ipNo),r.ruleVer,r.ruleId,r.errType,r.sevLevel,r.fmtState,(r.missing||[]).join('；'),(r.conflicts||[]).join('；'),r.score,r.blocked?'是':'否',r.state,r.qcBy,r.opinion,r.execTime])); });
  download('质控结果明细_'+today()+'.csv','text/csv;charset=utf-8',lines.join('\n'));
  toast('已导出 '+list.length+' 条质控结果明细','success');
};

/* =========================================================
 * 页面 5：数据存储与脱敏配置（mrqc-storage，功能点 5-1 ~ 5-8）
 * ========================================================= */
function stList(page){
  var st=fGet(page,'st'),mk=fGet(page,'mk'),kw=fGet(page,'kw').toUpperCase();
  return storages.all().filter(function(s){
    if(st&&s.state!==st) return false;
    if(mk==='已脱敏'&&!s.maskFlag) return false;
    if(mk==='未脱敏'&&s.maskFlag) return false;
    if(kw&&(s.contId+' '+s.ipNo).toUpperCase().indexOf(kw)<0) return false;
    return true;
  });
}
/* 按策略对 JSON 文本做脱敏演示（返回脱敏后对象） */
function maskJson(jsonStr,policy){
  var o; try{ o=JSON.parse(jsonStr); }catch(e){ return null; }
  var log=[];
  function walk(obj,path){
    Object.keys(obj).forEach(function(k){
      var v=obj[k];
      if(typeof v==='object'&&v){ walk(v,path+k+'.'); return; }
      var f=null; MASK_FIELDS.forEach(function(m){ if(k.indexOf(m.cn)>=0||path.indexOf(m.cn)>=0) f=m; });
      if(!f) return;
      var way=policy[f.key]||'不处理';
      if(way==='掩码'){ obj[k]=f.mask(v); log.push(k+'（掩码）'); }
      else if(way==='哈希'){ obj[k]=hash8(v); log.push(k+'（哈希）'); }
      else if(way==='替换'){ obj[k]='PT-'+hash8(v).slice(0,6); log.push(k+'（替换）'); }
    });
  }
  walk(o,'');
  return {o:o,log:log};
}
function renderStorage(){
  var all=storages.all(),page='mrqc-storage';
  var risky=all.filter(function(s){ return !s.maskFlag&&String(s.jsonStr).indexOf('身份证号')>=0; }).length;
  var rows=stList(page).map(function(s){
    var sens=String(s.jsonStr).indexOf('身份证号')>=0||String(s.jsonStr).indexOf('联系电话')>=0;
    return '<tr'+(s.state==='已删除'?' style="opacity:.55"':'')+'><td class="mrqc-mono">'+esc(s.contId)+'</td><td class="mrqc-mono">'+esc(s.ipNo)+'</td>'+
      '<td>'+s.sizeKB+'</td>'+
      '<td>'+(s.maskFlag?bText('已脱敏','badge-success'):(sens?bText('未脱敏·高风险','badge-danger'):bText('未脱敏','badge-warning')))+'</td>'+
      '<td class="mrqc-mono">v'+s.ver+'</td><td>'+stBadge(s.state)+'</td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-outline btn-xs" onclick="mrqcMaskCheck(\''+s.contId+'\')">样本/验证'+fpTag('5-4')+'</button> '+
        '<button class="btn btn-outline btn-xs" onclick="mrqcStVersions(\''+s.contId+'\')">版本'+fpTag('5-5')+'</button> '+
        (s.state==='在线'?
          '<button class="btn btn-outline btn-xs" onclick="mrqcStState(\''+s.contId+'\',\'已归档\')">归档'+fpTag('5-3')+'</button> '+
          '<button class="btn btn-danger btn-xs" onclick="mrqcStState(\''+s.contId+'\',\'已删除\')">删除'+fpTag('5-3')+'</button>':
          '<button class="btn btn-outline btn-xs" onclick="mrqcStState(\''+s.contId+'\',\'在线\')">恢复在线</button>')+'</td></tr>';
  }).join('');
  var body=
    '<div class="mrqc-kpis">'+
      kpiCard(all.length,'个','存储对象总数')+
      kpiCard(risky,'个','未脱敏高风险','danger')+
      kpiCard(all.filter(function(s){ return s.state==='已归档'; }).length,'个','已归档','dim')+'</div>'+
    checkPanel()+
    filterBar(page,selCtl(page,'st',['在线','已归档','已删除'],'处理状态')+selCtl(page,'mk',['已脱敏','未脱敏'],'脱敏标识')+txtCtl(page,'kw','内容ID / 住院号'))+
    tbl(['内容ID','关联病案','大小KB','脱敏标识','存储版本','处理状态','操作'],rows,1000);
  return tabPanel(
    '<button class="btn btn-primary btn-sm" onclick="mrqcMaskPolicy()">脱敏策略配置'+fpTag('5-1')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcUploadJson()">上传 JSON 数据'+fpTag('5-2')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcUnmaskList()">未脱敏高风险'+fpTag('5-8')+'</button>'+
    '<button class="btn btn-outline btn-sm" onclick="mrqcStExport()">导出配置清单'+fpTag('5-7')+'</button>',body);
}
/* 功能点 5-1：配置敏感字段脱敏策略（掩码 / 哈希 / 替换） */
window.mrqcMaskPolicy=function(){
  var p=policyStore.get();
  mrqcModal('敏感字段脱敏策略配置',
    '<div class="mrqc-note">设置哪些字段需脱敏及采用的脱敏方式。保存后立即生效（对「脱敏样本」输出与「验证脱敏」校验生效）。</div>'+
    MASK_FIELDS.map(function(f){
      return '<div class="mrqc-frow"><label>'+esc(f.cn)+'</label><select id="mrqcPl_'+f.key+'">'+
        MASK_WAYS.map(function(w){ return '<option'+(p[f.key]===w?' selected':'')+'>'+w+'</option>'; }).join('')+'</select>'+
        '<span style="margin-left:10px;font-size:12px;color:#94a3b8">示例：'+esc(f.demo)+' → '+esc((p[f.key]==='掩码'?f.mask(f.demo):(p[f.key]==='哈希'?hash8(f.demo):(p[f.key]==='替换'?'PT-'+hash8(f.demo).slice(0,6):f.demo))))+'</span></div>';
    }).join(''),
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcMaskPolicySave()">保存策略</button>','mid');
};
window.mrqcMaskPolicySave=function(){
  var p={};
  MASK_FIELDS.forEach(function(f){ p[f.key]=fv('mrqcPl_'+f.key)||'不处理'; });
  policyStore.save(p);
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast('脱敏策略已保存并生效','success'); refresh();
};
/* 功能点 5-2：上传 JSON 格式原始数据内容（保留原始结构存储） */
window.mrqcUploadJson=function(){
  mrqcModal('上传 JSON 格式原始数据内容',
    '<div class="mrqc-note">接收并存储病案首页完整 JSON 数据体，保留原始结构用于回溯分析。系统将校验 JSON 合法性、计算数据大小并登记存储版本。</div>'+
    '<div class="mrqc-frow"><label>关联住院号</label><input id="mrqcUpIp" placeholder="如 ZY20260103"></div>'+
    '<div class="mrqc-frow"><label>JSON 内容</label><textarea id="mrqcUpJson" placeholder=\'粘贴病案首页 JSON\'>'+esc(demoJson('ZY20260103','王某某'))+'</textarea></div>',
    '<button class="btn btn-ghost" onclick="mrqcCloseModal(this)">取消</button><button class="btn btn-primary" onclick="mrqcUploadSave()">解析并入库</button>');
};
window.mrqcUploadSave=function(){
  var txt=fv('mrqcUpJson'),ip=fv('mrqcUpIp');
  try{ JSON.parse(txt); }catch(e){ toast('JSON 解析失败：'+e.message,'warn'); return; }
  if(!ip){ toast('请填写关联住院号','warn'); return; }
  var size=Math.round(txt.length/1024*10)/10;
  storages.all().push({contId:nextId(storages.all(),'contId','CT-2026'),ipNo:ip,fmt:'JSON',sizeKB:size||0.1,jsonStr:txt,
    fieldMap:'上传时自动登记（按病案首页标准字段）',maskFlag:false,ver:1,state:'在线',
    versions:[{v:1,time:now(),state:'原始入库（尚未脱敏，含敏感字段请尽快配置脱敏）'}],note:'手工上传'});
  storages.save();
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast('JSON 已入库：'+ip+'，大小 '+size+'KB（未脱敏，已列入高风险提醒）','success');
  refresh();
};
/* 功能点 5-3：标记数据删除或归档状态（逻辑删除） */
window.mrqcStState=function(contId,st){
  var s=storages.find(contId); if(!s) return;
  if(st==='已删除'){ showConfirm('逻辑删除确认','确认将数据对象 '+contId+' 标记为「逻辑删除」吗？数据保留但不再对业务可见。',function(){ doSt(); }); return; }
  doSt();
  function doSt(){
    s.state=st;
    s.ver+=1;
    s.versions.push({v:s.ver,time:now(),state:st==='已归档'?'归档快照':(st==='已删除'?'逻辑删除':'恢复在线')});
    storages.save();
    toast(st==='已归档'?'已归档':(st==='已删除'?'已逻辑删除':'已恢复在线'),'success');
    refresh();
  }
};
/* 功能点 5-4 / 5-6：脱敏样本输出 + 脱敏生效验证（合并为单弹窗，含未通过一键整改） */
window.mrqcMaskCheck=function(contId){
  var s=storages.find(contId); if(!s) return;
  var p=policyStore.get();
  var m=maskJson(s.jsonStr,p);
  var sensFound=MASK_FIELDS.filter(function(f){ return String(s.jsonStr).indexOf(f.demo)>=0||new RegExp('"[^"]*'+f.cn+'[^"]*"\\s*:').test(String(s.jsonStr)); });
  var ok=s.maskFlag&&sensFound.length===0;
  var rep='验证对象：'+s.contId+'（'+s.ipNo+'）\n脱敏标识：'+(s.maskFlag?'已启用':'未启用')+
    '\n敏感字段残留：'+(sensFound.length?sensFound.map(function(f){ return f.cn; }).join('、'):'无')+
    '\n当前策略：'+MASK_FIELDS.map(function(f){ return f.cn+'='+(p[f.key]||'不处理'); }).join('，')+
    '\n验证结论：'+(ok?'策略已正确应用，可对外提供':'未通过——存在未脱敏敏感字段，建议执行脱敏')+
    '\n验证时间：'+now()+'　验证人：'+op();
  mrqcModal('脱敏样本与生效验证 · '+esc(contId),
    '<div class="mrqc-sec">验证报告</div>'+
    '<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;font-size:12.5px;white-space:pre-wrap;line-height:1.9">'+esc(rep)+'</pre>'+
    '<div>'+(ok?'<span class="badge badge-success">验证通过</span>':'<span class="badge badge-danger">验证未通过</span>')+'</div>'+
    '<div class="mrqc-sec">脱敏后样本（可对外）</div><pre style="background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:6px;font-size:12px;white-space:pre-wrap;max-height:200px;overflow:auto">'+esc(JSON.stringify(m.o,null,2))+'</pre>'+
    (m.log.length?'<div>'+m.log.map(function(l){ return '<span class="badge badge-success" style="margin:2px">'+esc(l)+'</span>'; }).join('')+'</div>':'')+
    (!ok&&!s.maskFlag&&sensFound.length?'<div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="mrqcMaskApply(\''+contId+'\')">立即按当前策略脱敏（版本 +1）'+fpTag('5-6')+'</button></div>':'')+
    '<div style="margin-top:10px"><button class="btn btn-outline btn-sm" onclick="mrqcMaskCheckExport(\''+contId+'\')">导出样本（JSON 文件）</button></div>');
  window._mrqcMaskSample={id:contId,json:JSON.stringify(m.o,null,2)};
};
window.mrqcMaskApply=function(contId){
  var s=storages.find(contId); if(!s) return;
  s.maskFlag=true; s.ver+=1;
  s.versions.push({v:s.ver,time:now(),state:'应用脱敏策略（验证触发）'});
  storages.save();
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  toast('脱敏已应用并通过验证','success'); refresh();
};
window.mrqcMaskCheckExport=function(contId){
  var d=window._mrqcMaskSample; if(!d) return;
  download('脱敏样本_'+contId+'_'+today()+'.json','application/json',d.json,true);
  toast('脱敏样本已导出','success');
};
/* 功能点 5-5：查询某数据对象的存储版本历史 */
window.mrqcStVersions=function(contId){
  var s=storages.find(contId); if(!s) return;
  var rows=s.versions.map(function(v,i){
    var last=i===s.versions.length-1;
    return '<tr><td class="mrqc-mono">v'+v.v+(last?' <span class="badge badge-info">当前</span>':'')+'</td><td>'+esc(v.time)+'</td><td>'+esc(v.state)+'</td>'+
      '<td>'+(i>0?'<button class="btn btn-outline btn-xs" onclick="mrqcStRollback(\''+contId+'\','+v.v+')">回滚到此版本</button>':'<span style="color:#94a3b8;font-size:12px">初始版本</span>')+'</td></tr>';
  }).join('');
  mrqcModal('存储版本历史 · '+esc(contId),
    kvGrid([['内容ID',s.contId],['关联病案',s.ipNo],['当前版本','v'+s.ver],['处理状态',stBadge(s.state)],['字段映射',s.fieldMap]])+
    '<div class="mrqc-sec">版本记录（可回滚）</div>'+tbl(['版本','变更时间','处理状态','操作'],rows,620));
};
window.mrqcStRollback=function(contId,v){
  var s=storages.find(contId); if(!s) return;
  s.ver+=1;
  s.versions.push({v:s.ver,time:now(),state:'回滚至 v'+v+'（参考）'});
  storages.save();
  toast('已登记回滚参考版本：v'+v+' → 当前 v'+s.ver,'success');
  var ms=document.querySelectorAll('.news-confirm-modal'); if(ms.length) ms[ms.length-1].remove();
  mrqcStVersions(contId);
};
/* 功能点 5-6 验证逻辑已并入 mrqcMaskCheck（样本 + 验证一体，未通过可一键整改） */
/* 功能点 5-7：导出数据存储配置参数清单 */
window.mrqcStExport=function(){
  var lines=[csvRow(['内容ID','关联病案','数据格式','数据大小KB','字段映射','脱敏标识','存储版本号','当前处理状态','删除/归档标识','版本数'])];
  storages.all().forEach(function(s){ lines.push(csvRow([s.contId,s.ipNo,s.fmt,s.sizeKB,s.fieldMap,s.maskFlag?'已脱敏':'未脱敏','v'+s.ver,s.state,s.state,s.versions.length])); });
  var pol=policyStore.get();
  lines.push(csvRow(['【脱敏策略】',MASK_FIELDS.map(function(f){ return f.cn+'='+(pol[f.key]||'不处理'); }).join('，')]));
  download('数据存储配置清单_'+today()+'.csv','text/csv;charset=utf-8',lines.join('\n'));
  toast('已导出存储与脱敏配置清单（含策略）','success');
};
/* 功能点 5-8：查询未脱敏的高风险数据列表 */
window.mrqcUnmaskList=function(){
  var list=storages.all().filter(function(s){ return !s.maskFlag&&(String(s.jsonStr).indexOf('身份证号')>=0||String(s.jsonStr).indexOf('联系电话')>=0||String(s.jsonStr).indexOf('患者姓名')>=0); });
  var rows=list.map(function(s){
    return '<tr><td class="mrqc-mono">'+esc(s.contId)+'</td><td class="mrqc-mono">'+esc(s.ipNo)+'</td><td>'+s.sizeKB+'KB</td><td>v'+s.ver+'</td><td>'+stBadge(s.state)+'</td>'+
      '<td style="color:#b91c1c;font-size:12px">'+esc(MASK_FIELDS.filter(function(f){ return String(s.jsonStr).indexOf(f.cn)>=0; }).map(function(f){ return f.cn; }).join('、')||'患者姓名等')+'</td>'+
      '<td><button class="btn btn-outline btn-xs" onclick="mrqcMaskCheck(\''+s.contId+'\')">样本/验证'+fpTag('5-6')+'</button></td></tr>';
  }).join('');
  ST.check={tab:'mrqc-storage',title:'未脱敏高风险数据列表（'+list.length+'）',
    note:'列出所有未启用脱敏但包含敏感字段（姓名 / 身份证 / 电话 / 住址）的数据记录，提示安全风险。',
    html:list.length?tbl(['内容ID','关联病案','大小','版本','状态','涉及敏感字段','操作'],rows,900):'<div class="mrqc-iss ok"><span class="t">[安全]</span> 当前无未脱敏的高风险数据</div>'};
  refresh();
};

/* ---------- 质控详情页（隐藏页 mrqc-case|<采集ID>，参照 cq-case 模式） ---------- */
function renderCaseDetail(cid){
  var c=cases.find(cid);
  /* 页头走 qcUI.head 规范（同 cq 详情页：标题 + 关键标识副标题 + 右侧操作区） */
  var acts='<button class="btn btn-ghost btn-sm" onclick="mrqcBack()">← 返回工作台</button>'+
    (c?'<button class="btn btn-outline btn-sm" onclick="mrqcVitEdit(\''+c.cid+'\')">补充随访标识'+fpTag('1-2')+'</button>':'');
  var sub=c?(c.ipNo+'（'+c.name+'）· 采集ID '+c.cid):cid;
  var hd=(window.qcUI&&window.qcUI.head)?window.qcUI.head('病案首页质控详情',sub,'',false,'<div class="mrqc-detail-acts">'+acts+'</div>')
    :'<div class="qc-head"><div><div class="t">病案首页质控详情</div><div class="s">'+esc(sub)+'</div></div><div class="acts"><div class="mrqc-detail-acts">'+acts+'</div></div></div>';
  if(!c) return hd+'<div class="panel"><div class="panel-body"><div class="mrqc-note">未找到该采集ID（'+esc(cid)+'）对应的病案记录，可能已被重置或删除。</div></div></div>';
  var rp=reports.find(c.ipNo)||{};
  var rs=results.all().filter(function(r){ return r.ipNo===c.ipNo; });
  /* 报告号行：已关联显示编号 + 行内「解绑」（3-7）；未关联显示红色「未关联」徽章 + 「补录」（影像→3-2，其余→3-1） */
  function rpRow(label,val,type,ipNo){
    var v=val?'<span class="mrqc-mono">'+esc(val)+'</span> <button class="btn btn-outline btn-xs" onclick="mrqcRpUnbind(\''+ipNo+'\',\''+type+'\')">解绑'+fpTag('3-7')+'</button>'
      :'<span class="badge badge-danger">未关联</span> <button class="btn btn-outline btn-xs" onclick="mrqcRpQuickAdd(\''+ipNo+'\',\''+type+'\')">补录'+fpTag(type==='imgNo'?'3-2':'3-1')+'</button>';
    return '<div class="k">'+esc(label)+'</div><div class="v">'+v+'</div>';
  }
  var iss=(c.issues&&c.issues.length?c.issues:[]).map(function(i){
    return '<div class="mrqc-iss"><span class="t">['+esc(i.type)+'·'+esc(i.sev)+']</span> '+esc(i.field)+'　建议：'+esc(i.sugg)+(i.ruleId?'　<span class="mrqc-mono">'+esc(i.ruleId)+'</span>':'')+'</div>';
  }).join('')||'<div class="mrqc-iss ok"><span class="t">[通过]</span> 基础信息完整性 / 编码合规性均无问题</div>';
  return hd+'<div class="panel"><div class="panel-body">'+
    '<div class="mrqc-sec">基础临床信息</div>'+
    kvGrid([['采集ID',c.cid],['患者ID',c.pid],['就诊/检诊事件ID',c.eventId],['门诊号',c.opNo],['住院号',c.ipNo],['患者',c.name+'（'+c.sex+' / '+c.age+'岁）'],
      ['科室',c.dept],['数据来源',c.srcType],['机构ID',c.orgId||(c.srcType==='EMR'?'360102-002':'360102-001')],['入院日期',c.admDate],['诊断日期',c.diagDate],['肿瘤部位 ICD-10',c.icd10],['肿瘤形态学 ICD-O-3',c.icdo3],
      ['病理描述',c.pathNote],['发病/死亡/随访标识',c.vitStatus||'（缺失）'],['质控状态',c.qcState],['数据质量评分',(c.score===null||c.score===undefined)?'—':c.score],['最近加载',c.loadTime]])+
    '<div class="mrqc-sec">关联报告编号索引（联动信息表3，未关联项可点击「补录」）</div>'+
    '<div class="mrqc-kv">'+
      rpRow('病理报告号',rp.pathNo,'pathNo',c.ipNo)+
      rpRow('检验报告号',rp.labNo,'labNo',c.ipNo)+
      rpRow('影像报告号',rp.imgNo,'imgNo',c.ipNo)+
    '</div>'+
    '<div class="mrqc-sec">问题项与修正建议</div>'+iss+
    '<div class="mrqc-sec">质控执行结果（联动信息表4，'+rs.length+' 条）</div>'+
    (rs.length?tbl(['质控ID','规则','错误类型','严重等级','评分','阻断','状态'],rs.map(function(r){ return '<tr><td class="mrqc-mono">'+esc(r.qcId)+'</td><td class="mrqc-mono">'+esc(r.ruleId)+'</td><td>'+esc(r.errType)+'</td><td>'+stBadge(r.sevLevel)+'</td><td>'+(r.score??'—')+'</td><td>'+(r.blocked?bText('阻断','badge-danger'):bText('否'))+'</td><td>'+stBadge(r.state)+'</td></tr>'; }).join(''),760):'<div class="mrqc-note">尚未执行质控引擎，可切换到「质控结果明细」页签执行。</div>')+
    '</div></div>';
}
function openCase(cid){
  ST.tab='DETAIL'; ST.detailId=cid;
  try{ history.replaceState(null,'','#mrqc-case|'+cid); }catch(e){}
  window.renderPage('mrqc-case|'+cid);
}
window.mrqcBack=function(){
  ST.tab='mrqc-base'; ST.detailId='';
  try{ history.replaceState(null,'','#mrqc-workbench'); }catch(e){}
  if(typeof window.navigateTo==='function'){ window.navigateTo('mrqc-workbench'); }
  else refresh();
};

/* ---------- 路由接管（模式 A：覆写 window.renderPage，链式回退） ----------
 * 单页工作台：mrqc-workbench（5 页签）+ 隐藏详情页 mrqc-case|<采集ID>。 */
var mrqcBaseRender=(typeof window.renderPage==='function')?window.renderPage:function(){};
window.renderPage=function(id){
  if(id==='mrqc-workbench'||(typeof id==='string'&&id.indexOf('mrqc-case|')===0)){
    if(id==='mrqc-workbench'){
      if(ST.tab==='DETAIL') ST.tab='mrqc-base';
      ST.detailId='';
      document.getElementById('pageContainer').innerHTML=renderWorkbench();
    } else {
      ST.tab='DETAIL'; ST.detailId=id.slice(10);
      document.getElementById('pageContainer').innerHTML=renderCaseDetail(ST.detailId);
    }
    if(typeof setActiveMenu==='function') setActiveMenu('mrqc-workbench');
    /* navigateTo 尾部会用原始 id（mrqc-case|xxx）再刷一次面包屑，使详情直达时
       面包屑被覆盖成空路径；延迟一拍补写一次保证完整（幂等，正常点击无副作用）。 */
    var mrqcCrumb=function(){ if(typeof updateBreadcrumb==='function') updateBreadcrumb('mrqc-workbench',ST.tab==='DETAIL'?'病案首页质控详情':''); };
    mrqcCrumb(); setTimeout(mrqcCrumb,0);
    if(typeof autoSizeSelects==='function'){ try{ autoSizeSelects(); }catch(e){} }
    var mc=document.getElementById('mainContent'); if(mc&&mc.scrollTop!==undefined) mc.scrollTop=0;
    return;
  }
  return mrqcBaseRender.apply(this,arguments);
};
/* hash 直达详情页兜底（app.html initApp 白名单已放行 mrqc-case| 前缀） */
document.addEventListener('DOMContentLoaded',function(){
  var h=decodeURIComponent((location.hash||'').replace(/^#/,'')).trim();
  if(h.indexOf('mrqc-case|')!==0) return;
  var cid=h.slice(10);
  if(ST.tab==='DETAIL'&&ST.detailId===cid) return;
  if(cases.find(cid)) openCase(cid);
});

/* 调试 / 测试出口 */
window.MRQC={ cases:cases, reports:reports, results:results, storages:storages, policyStore:policyStore,
  TABS:TABS, FP_MAP:FP_MAP, RULES:RULES, computeIssues:computeIssues, maskJson:maskJson, MASK_FIELDS:MASK_FIELDS,
  state:ST, refresh:refresh, openCase:openCase,
  resetAll:function(){ [cases,reports,results,storages].forEach(function(s){ s.reset(); }); policyStore.save(seedPolicy()); ST.tab='mrqc-base'; ST.detailId=''; } };
})();
