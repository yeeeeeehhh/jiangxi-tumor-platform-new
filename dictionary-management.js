// Interactive dictionary-management prototype. Data persists for the current browser session.
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const badge=v=>'<span class="badge '+(['启用','正确'].includes(v)?'badge-success':['已撤并','错误'].includes(v)?'badge-danger':'badge-muted')+'">'+v+'</span>';
  const rows=(list,n,render)=>list.length?list.map(render).join(''):'<tr><td colspan="'+n+'" style="text-align:center;color:#64748b">暂无匹配数据</td></tr>';
  const shell=(title,filter,heads,body)=>'<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>'+title+'</div></div><div class="panel"><div class="panel-body">'+filter+'<div class="table-wrap"><table class="data-table tbl-auto"><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div></div></div>';
  const close=()=>document.querySelectorAll('.dict-modal').forEach(x=>x.remove());
  const modal=(title,content,save)=>{close();window.dictSave=save;const o=document.createElement('div');o.className='cd-overlay dict-modal';o.style.zIndex='10000';o.innerHTML='<div class="cd-dialog" style="max-width:720px"><div class="cd-header"><span>'+title+'</span><span class="cd-close" onclick="dictClose()">×</span></div><div class="cd-body" style="max-height:70vh;overflow:auto">'+content+'</div><div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px"><button class="btn btn-ghost btn-sm" onclick="dictClose()">取消</button><button class="btn btn-primary btn-sm" onclick="dictSave()">保存</button></div></div>';o.onclick=e=>{if(e.target===o)close()};document.body.appendChild(o)};
  window.dictClose=close;
  const input=(label,id,value='',type='text',required=false)=>'<div class="form-group"><label>'+label+(required?' <span class="required">*</span>':'')+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></div>';
  const select=(label,id,options,value,attrs='')=>'<div class="form-group"><label>'+label+'</label><select id="'+id+'" '+attrs+'>'+options.map(o=>{const p=typeof o==='string'?{v:o,t:o}:o;return '<option value="'+esc(p.v)+'"'+(String(p.v)===String(value)?' selected':'')+'>'+esc(p.t)+'</option>'}).join('')+'</select></div>';
  const text=(label,id,value='')=>'<div class="form-group full"><label>'+label+'</label><textarea id="'+id+'">'+esc(value)+'</textarea></div>';
  const value=id=>document.getElementById(id).value.trim();

  const missing=[['behavior','行为','3','恶性'],['grade','分级','2','II级'],['diagnosis_basis','诊断依据','7','病理（原发）'],['clinical_stage','临床分期','1','I期'],['treatment','治疗信息','SUR','手术'],['province_code','省份代码','36','江西'],['record_type','记录类型','0','原始卡'],['duplicate_status','重卡处理状态','SUSPECTED','疑似重卡'],['source_type','来源类型','OUT','门诊报告'],['death_cause','根本死因','1','肿瘤']];
  missing.forEach(([type,name,code,item])=>{if(!dictCommonTypes.some(x=>x.type===type))dictCommonTypes.push({type,name});if(!dictCommonData[type])dictCommonData[type]=[{code,name:item,sort:1,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''}]});
  if(dictCommonData.record_type&&dictCommonData.record_type.length===1)dictCommonData.record_type.push({code:'4',name:'补报卡',sort:2,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'110',name:'克隆卡',sort:3,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'2',name:'人工合并卡',sort:4,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'22',name:'自动合并卡',sort:5,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'222',name:'合并卡（克隆）',sort:6,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'3',name:'多原发卡',sort:7,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''});
  if(dictCommonData.duplicate_status&&dictCommonData.duplicate_status.length===1)dictCommonData.duplicate_status.push({code:'AUTO_MERGED',name:'自动合并',sort:2,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'MANUAL_MERGED',name:'人工合并',sort:3,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'INDEPENDENT',name:'标记为独立',sort:4,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''},{code:'MULTI_PRIMARY',name:'标记为多原发',sort:5,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''});

  function commonForm(index){const data=dictCommonData[dictCommonState.currentType],r=index==null?{code:'',name:'',sort:data.length+1,status:'启用',mergeStatus:'未撤并',mergeCode:'',remark:''}:data[index];const targets=[{v:'',t:'请选择目标项'}].concat(data.filter(x=>x.status==='启用'&&x.code!==r.code).map(x=>({v:x.code,t:x.code+' - '+x.name})));modal(index==null?'新增字典项':'编辑字典项','<div class="form-grid">'+input('代码','dCode',r.code,'text',true)+input('名称','dName',r.name,'text',true)+input('排序','dSort',r.sort,'number')+select('状态','dStatus',['启用','禁用'],r.status)+select('撤并状态','dMerge',['未撤并','已撤并'],r.mergeStatus,'onchange="dictMergeToggle()"')+select('撤并至','dMergeCode',targets,r.mergeCode)+text('备注','dRemark',r.remark)+'</div>',()=>{const code=value('dCode'),name=value('dName'),merged=document.getElementById('dMerge').value==='已撤并',target=value('dMergeCode');if(!code||!name)return toast('请填写代码和名称','error');if(data.some((x,i)=>x.code===code&&i!==index))return toast('同一类型下代码不能重复','error');if(merged&&(!target||target===code))return toast('请选择其他启用项作为撤并目标','error');const item={code,name,sort:Number(value('dSort'))||0,status:merged?'禁用':document.getElementById('dStatus').value,mergeStatus:merged?'已撤并':'未撤并',mergeCode:merged?target:'',remark:value('dRemark')};index==null?data.push(item):Object.assign(data[index],item);close();toast('保存成功');renderPage('dict-common')});}
  window.dictMergeToggle=()=>{const merged=document.getElementById('dMerge').value==='已撤并';document.getElementById('dStatus').disabled=merged;if(merged)document.getElementById('dStatus').value='禁用';document.getElementById('dMergeCode').disabled=!merged};
  window.renderDictCommon=()=>{const data=dictCommonData[dictCommonState.currentType],q=dictCommonState.keyword||'',types=dictCommonTypes.map(x=>({v:x.type,t:x.name}));const list=data.filter(x=>!q||x.code.includes(q)||x.name.includes(q)).sort((a,b)=>a.sort-b.sort);const body=rows(list,9,(r,n)=>{const i=data.indexOf(r);return '<tr><td>'+(n+1)+'</td><td>'+esc(r.code)+'</td><td>'+esc(r.name)+'</td><td>'+r.sort+'</td><td>'+badge(r.status)+'</td><td>'+badge(r.mergeStatus)+'</td><td>'+esc(r.mergeCode||'-')+'</td><td>'+esc(r.remark||'-')+'</td><td class="ops"><button class="btn btn-primary btn-xs" onclick="dictCommonEdit('+i+')">编辑</button> <button class="btn btn-danger btn-xs" onclick="dictCommonDelete('+i+')">删除</button></td></tr>'});const filter='<div class="filter-toolbar">'+select('字典类型','dcType',types,dictCommonState.currentType,'onchange="dictCommonState.currentType=this.value;dictCommonState.keyword=\'\';renderPage(\'dict-common\')"')+'<div class="form-group search-group"><label>检索内容</label><input value="'+esc(q)+'" placeholder="代码 / 名称" oninput="dictCommonState.keyword=this.value"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-common\')">查询</button><button class="btn btn-ghost btn-sm" onclick="dictCommonState.keyword=\'\';renderPage(\'dict-common\')">重置</button><button class="btn btn-primary btn-sm" onclick="dictCommonAdd()">+ 添加</button></div></div>';return shell('常规字典管理',filter,['序号','代码','名称','排序','状态','撤并状态','撤并编码','备注','操作'],body)};
  window.dictCommonAdd=()=>commonForm(null); window.dictCommonEdit=i=>commonForm(i); window.dictCommonDelete=i=>{const d=dictCommonData[dictCommonState.currentType],r=d[i];if(r.mergeStatus!=='已撤并')return toast('请先完成撤并操作后再删除','error');showConfirm('确认删除','确定要删除已撤并字典项「'+r.name+'」吗？',()=>{d.splice(i,1);toast('删除成功');renderPage('dict-common')})};

  function codeForm(kind,index){const anatomy=kind==='anatomy',data=anatomy?dictAnatomyData:dictPathologyData,r=index==null?{code:'',name:'',level:1,parent:'',group:'',category:'',sort:data.length+1,status:'启用',mergeStatus:'未撤并',mergeCode:''}:data[index];const targets=[{v:'',t:'请选择目标项'}].concat(data.filter(x=>x.status==='启用'&&x.code!==r.code).map(x=>({v:x.code,t:x.code+' - '+x.name})));const parents=[{v:'',t:'无（一级部位）'}].concat(dictAnatomyData.filter(x=>x.level===1&&x.status==='启用'&&x.code!==r.code).map(x=>({v:x.code,t:x.code+' - '+x.name})));let body='<div class="form-grid">'+input('编码','dCode',r.code,'text',true)+input('名称','dName',r.name,'text',true);if(anatomy)body+=select('层级','dLevel',[{v:1,t:'部位'},{v:2,t:'亚部位'}],r.level,'onchange="dictParentToggle()"')+select('父级部位','dParent',parents,r.parent)+input('分组','dGroup',r.group)+input('类目','dCategory',r.category);else body+=input('分组','dGroup',r.group);body+=input('排序','dSort',r.sort,'number')+select('状态','dStatus',['启用','禁用'],r.status)+select('撤并状态','dMerge',['未撤并','已撤并'],r.mergeStatus,'onchange="dictMergeToggle()"')+select('撤并至','dMergeCode',targets,r.mergeCode)+'</div>';modal((index==null?'新增':'编辑')+(anatomy?'解剖部位':'病理类型'),body,()=>{const code=value('dCode'),name=value('dName'),level=anatomy?Number(value('dLevel')):0,parent=anatomy?value('dParent'):'';if(!code||!name)return toast('请填写编码和名称','error');if(data.some((x,i)=>x.code===code&&i!==index))return toast('编码已存在','error');if(anatomy&&level===2&&!parent)return toast('亚部位必须选择父级部位','error');const merged=value('dMerge')==='已撤并',target=value('dMergeCode');if(merged&&(!target||target===code))return toast('请选择其他启用项作为撤并目标','error');const item={code,name,group:value('dGroup'),sort:Number(value('dSort'))||0,status:merged?'禁用':value('dStatus'),mergeStatus:merged?'已撤并':'未撤并',mergeCode:merged?target:''};if(anatomy)Object.assign(item,{level,parent:level===2?parent:'',category:value('dCategory')});const before=index!=null?Object.assign({},data[index]):null;index==null?data.push(item):Object.assign(data[index],item);const cr=codeChangeRecord(anatomy?'anatomy':'pathology',before,item);pushDictLog(anatomy?'B1':'B2',index==null?'新增':'修改',cr.fromValue,cr.toValue);close();toast('保存成功');renderPage(anatomy?'dict-anatomy':'dict-pathology')})}
  window.dictParentToggle=()=>{const second=Number(value('dLevel'))===2;document.getElementById('dParent').disabled=!second;if(!second)document.getElementById('dParent').value=''};
  function renderCode(kind){const anatomy=kind==='anatomy',state=anatomy?dictAnatomyState:dictPathologyState,data=anatomy?dictAnatomyData:dictPathologyData,q=state.keyword||'',list=data.filter(x=>!q||x.code.includes(q)||x.name.includes(q));const heads=anatomy?['序号','编码','名称','层级','分组','排序','类目','状态','撤并状态','操作']:['序号','编码','名称','分组','排序','状态','撤并状态','操作'];const body=rows(list,heads.length,(r,n)=>{const i=data.indexOf(r),name=(anatomy&&r.level===2?'└ ':'')+r.name;return '<tr><td>'+(n+1)+'</td><td>'+r.code+'</td><td style="padding-left:'+(anatomy&&r.level===2?'28':'12')+'px">'+name+'</td>'+(anatomy?'<td>'+(r.level===1?'部位':'亚部位')+'</td>':'')+'<td>'+esc(r.group||'-')+'</td><td>'+r.sort+'</td>'+(anatomy?'<td>'+esc(r.category||'-')+'</td>':'')+'<td>'+badge(r.status)+'</td><td>'+badge(r.mergeStatus)+'</td><td class="ops"><button class="btn btn-primary btn-xs" onclick="dictCodeEdit(\''+kind+'\','+i+')">编辑</button> <button class="btn btn-danger btn-xs" onclick="dictCodeDelete(\''+kind+'\','+i+')">删除</button></td></tr>'});const id=anatomy?'dict-anatomy':'dict-pathology',filter='<div class="filter-toolbar"><div class="form-group search-group"><label>检索内容</label><input value="'+esc(q)+'" placeholder="编码 / 名称" oninput="'+(anatomy?'dictAnatomyState':'dictPathologyState')+'.keyword=this.value"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\''+id+'\')">查询</button><button class="btn btn-ghost btn-sm" onclick="'+(anatomy?'dictAnatomyState':'dictPathologyState')+'.keyword=\'\';renderPage(\''+id+'\')">重置</button><button class="btn btn-primary btn-sm" onclick="dictCodeEdit(\''+kind+'\',null)">+ 添加</button></div></div>';return shell(anatomy?'解剖部位管理':'病理类型管理',filter,heads,body)}
  window.renderDictAnatomy=()=>renderCode('anatomy');window.renderDictPathology=()=>renderCode('pathology');window.dictAnatomyAdd=()=>codeForm('anatomy',null);window.dictAnatomyEdit=i=>codeForm('anatomy',i);window.dictPathologyAdd=()=>codeForm('pathology',null);window.dictPathologyEdit=i=>codeForm('pathology',i);window.dictCodeEdit=(k,i)=>codeForm(k,i);window.dictCodeDelete=(k,i)=>{const data=k==='anatomy'?dictAnatomyData:dictPathologyData,r=data[i];if(k==='anatomy'&&dictAnatomyData.some(x=>x.parent===r.code))return toast('请先处理该部位的亚部位','error');if(r.mergeStatus!=='已撤并')return toast('请先完成撤并操作后再删除','error');showConfirm('确认删除','确定要删除「'+r.name+'」吗？',()=>{const kind=k==='anatomy'?'anatomy':'pathology',snapshot=Object.assign({},r);data.splice(i,1);pushDictLog(k==='anatomy'?'B1':'B2','删除',codeFieldString(kind,snapshot),'');toast('删除成功');renderPage(k==='anatomy'?'dict-anatomy':'dict-pathology')})};

  /* ===== 码表变更记录（覆盖全部字典码表） ===== */
  window.dictLogState={keyword:'',table:'',type:'',version:'',from:'',to:''};
  const dictLogs=[
    {id:'CHG-A2-20260115-001',tableId:'A2',version:'V1.0',type:'新增',fromValue:'',toValue:'新增码值 59 个（01 汉族…99 未确定）',operator:'省登记处 · 王敏',time:'2026-01-15 09:20:31',remark:'初始化版本，经省级管理员复核后发布'},
    {id:'CHG-B1-20260115-002',tableId:'B1',version:'V1.0',type:'新增',fromValue:'',toValue:'新增一级部位 42 项；二级亚部位 168 项（C00–C80）',operator:'省登记处 · 王敏',time:'2026-01-15 10:02:18',remark:'经省级管理员复核后发布'},
    {id:'CHG-B2-20260211-003',tableId:'B2',version:'V1.0',type:'新增',fromValue:'',toValue:'新增组织学码 8000–9999（含行为/分级后缀规则）',operator:'省登记处 · 王敏',time:'2026-02-11 15:20:44',remark:''},
    {id:'CHG-B1-20260302-004',tableId:'B1',version:'V1.1',type:'修改',fromValue:'编码=C16.9；名称=胃，未特指；撤并状态=已撤并；撤并至=C16；状态=禁用',toValue:'编码=C16.9；名称=胃，未特指；撤并状态=未撤并；状态=启用',operator:'省登记处 · 王敏',time:'2026-03-02 14:05:12',remark:'关联问题单 JX-2026-0312'},
    {id:'CHG-A8-20260318-005',tableId:'A8',version:'V1.1',type:'新增',fromValue:'',toValue:'新增设区市码 11 个：360100 南昌市…361100 上饶市',operator:'南昌市 · 李强',time:'2026-03-18 09:40:27',remark:'县区级码待补全，关联 Q2'},
    {id:'CHG-B1-20260418-006',tableId:'B1',version:'V1.2',type:'新增',fromValue:'',toValue:'新增 C34.1=肺上叶；C34.9=肺，未特指（父级 C34）',operator:'南昌市 · 李强',time:'2026-04-18 10:42:56',remark:''},
    {id:'CHG-B5-20260506-007',tableId:'B5',version:'V1.1',type:'修改',fromValue:'编码=C22；名称=肝和肝内胆管恶性肿瘤',toValue:'编码=C22；名称=肝和肝内胆管恶性肿瘤；备注=明确 D45–D46 不再单列',operator:'省登记处 · 赵芳',time:'2026-05-06 11:15:33',remark:''},
    {id:'CHG-B1-20260609-008',tableId:'B1',version:'V1.3',type:'删除',fromValue:'编码=C00.2；名称=唇，未特指；状态=禁用',toValue:'',operator:'省登记处 · 王敏',time:'2026-06-09 16:30:08',remark:'已确认无历史报告卡引用'},
    {id:'CHG-D1-20260721-009',tableId:'D1',version:'V1.1',type:'修改',fromValue:'名称=移居/迁出',toValue:'名称=移居/迁出（境外迁出按此填报）',operator:'省登记处 · 赵芳',time:'2026-07-21 10:05:47',remark:''}
  ];
  window.dictLogData=dictLogs;
  const logPad=n=>String(n).padStart(2,'0');
  function logNow(){const d=new Date();return d.getFullYear()+'-'+logPad(d.getMonth()+1)+'-'+logPad(d.getDate())+' '+logPad(d.getHours())+':'+logPad(d.getMinutes())+':'+logPad(d.getSeconds())}
  const logToday=()=>logNow().slice(0,10);
  function logUser(){const el=document.getElementById('currentUserName');const t=el?String(el.textContent||'').trim():'';return (t.replace(/（[^）]*）|\([^)]*\)/g,'').trim())||'系统管理员'}
  const dictCatalogName=id=>{const c=(window.dictCatalogs||[]).find(d=>d.id===id);return c?c.name:''};
  function latestTableVersion(tableId){let best='V1.0';dictLogs.forEach(x=>{if(x.tableId!==tableId)return;const v=String(x.version||'');if(/^V\d+(\.\d+)+$/.test(v)&&v.localeCompare(best,'zh',{numeric:true})>0)best=v});return best}
  function nextTableVersion(tableId){if(!dictLogs.some(x=>x.tableId===tableId))return 'V1.0';const m=/^V(\d+)\.(\d+)$/.exec(latestTableVersion(tableId));return m?'V'+m[1]+'.'+(Number(m[2])+1):'V1.0'}
  function newDictLogId(tableId){const d=new Date(),day=d.getFullYear()+logPad(d.getMonth()+1)+logPad(d.getDate());let seq=dictLogs.filter(x=>String(x.id).indexOf('CHG-'+tableId+'-'+day+'-')===0).length+1,id='CHG-'+tableId+'-'+day+'-'+String(seq).padStart(3,'0');while(dictLogs.some(x=>x.id===id)){seq++;id='CHG-'+tableId+'-'+day+'-'+String(seq).padStart(3,'0')}return id}
  window.pushDictLog=function(tableId,type,fromValue,toValue){dictLogs.unshift({id:newDictLogId(tableId),tableId:tableId,version:nextTableVersion(tableId),type:type,fromValue:fromValue||'',toValue:toValue||'',operator:logUser(),time:logNow(),remark:''})};
  function codeFieldString(kind,item){
    const isPath=kind==='pathology';
    const fields=isPath?[['code','编码'],['name','名称'],['group','分组'],['sort','排序'],['status','状态'],['mergeStatus','撤并状态'],['mergeCode','撤并至']]:[['code','编码'],['name','名称'],['level','层级'],['parent','父级部位'],['group','分组'],['category','类目'],['sort','排序'],['status','状态'],['mergeStatus','撤并状态'],['mergeCode','撤并至']];
    const s=fields.filter(p=>String(item[p[0]]??'')!=='').map(p=>p[1]+'='+item[p[0]]).join('；');
    return s||'（空）';
  }
  function codeChangeRecord(kind,before,item){
    const noun=kind==='pathology'?'病理类型':'解剖部位';
    if(!before)return {fromValue:'',toValue:'新增'+noun+'：'+codeFieldString(kind,item)};
    return {fromValue:codeFieldString(kind,before),toValue:codeFieldString(kind,item)};
  }
  function dictLogList(){
    const s=window.dictLogState,q=String(s.keyword||'').trim().toLowerCase();
    return dictLogs.filter(x=>{
      if(s.table&&x.tableId!==s.table)return false;
      if(s.type&&x.type!==s.type)return false;
      if(s.version&&x.version!==s.version)return false;
      const day=String(x.time).slice(0,10);
      if(s.from&&day<s.from)return false;
      if(s.to&&day>s.to)return false;
      if(!q)return true;
      return [x.id,x.tableId,dictCatalogName(x.tableId),x.version,x.type,x.fromValue,x.toValue,x.operator,x.remark].join(' ').toLowerCase().indexOf(q)>=0;
    }).slice().sort((a,b)=>String(b.time).localeCompare(String(a.time)));
  }
  const logTypeBadge=t=>'<span class="badge '+(t==='新增'?'badge-success':t==='删除'?'badge-danger':'badge-warning')+'">'+esc(t)+'</span>';
  const detailItem=(k,v)=>'<div style="display:grid;grid-template-columns:110px 1fr;gap:10px;padding:9px 10px;border-bottom:1px dashed #e2e8f0;font-size:13px"><span style="color:#64748b">'+k+'</span><span style="color:#1e293b;word-break:break-all;line-height:1.6">'+v+'</span></div>';
  window.renderDictChangeLog=()=>{
    const list=dictLogList(),catalogs=(window.dictCatalogs||[]).filter(d=>!d.externalModule);
    const versions=[...new Set(dictLogs.map(x=>x.version))].sort((a,b)=>b.localeCompare(a,'zh',{numeric:true}));
    const tableIds=[...new Set(dictLogs.map(x=>x.tableId))];
    const summary='<div style="display:flex;flex-wrap:wrap;gap:18px;padding:9px 12px;margin-bottom:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#475569">'+
      '<span><b>涉及码表：</b>'+tableIds.length+' 类</span><span><b>变更记录：</b>'+dictLogs.length+' 条</span>'+
      '<span><b>最近变更：</b>'+esc(dictLogs[0]?dictLogs[0].time:'-')+'</span>'+
      '<span><b>说明：</b>各字典码表（含解剖部位、病理类型、常规字典库）的增删改均自动记录于此</span></div>';
    const filter=summary+'<div class="filter-toolbar">'+
      '<div class="form-group"><label>码表</label><select onchange="dictLogState.table=this.value"><option value="">全部码表</option>'+catalogs.map(d=>'<option value="'+esc(d.id)+'"'+(window.dictLogState.table===d.id?' selected':'')+'>'+esc(d.id+' · '+d.name)+'</option>').join('')+'</select></div>'+
      '<div class="form-group"><label>变更类型</label><select onchange="dictLogState.type=this.value">'+['','新增','修改','删除'].map(v=>'<option value="'+v+'"'+(window.dictLogState.type===v?' selected':'')+'>'+(v||'全部类型')+'</option>').join('')+'</select></div>'+
      '<div class="form-group"><label>版本号</label><select onchange="dictLogState.version=this.value">'+[''].concat(versions).map(v=>'<option value="'+esc(v)+'"'+(window.dictLogState.version===v?' selected':'')+'>'+(v?esc(v):'全部版本')+'</option>').join('')+'</select></div>'+
      '<div class="form-group search-group"><label>检索内容</label><input value="'+esc(window.dictLogState.keyword)+'" placeholder="记录ID / 码表 / 摘要 / 原因 / 变更人" oninput="dictLogState.keyword=this.value"></div>'+
      '<div class="form-group date-group"><label>变更时间</label><div style="display:flex;align-items:center;gap:6px"><input type="date" style="width:142px" value="'+esc(window.dictLogState.from)+'" onchange="dictLogState.from=this.value"><span>至</span><input type="date" style="width:142px" value="'+esc(window.dictLogState.to)+'" onchange="dictLogState.to=this.value"></div></div>'+
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-change-log\')">查询</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="dictLogState.keyword=\'\';dictLogState.table=\'\';dictLogState.type=\'\';dictLogState.version=\'\';dictLogState.from=\'\';dictLogState.to=\'\';renderPage(\'dict-change-log\')">重置</button>'+
      '<button class="btn btn-outline btn-sm" onclick="dictLogExport()">导出</button>'+
      '<button class="btn btn-primary btn-sm" onclick="dictLogAdd()">+ 新增变更记录</button></div></div>';
    const body=rows(list,10,(r,n)=>{const i=dictLogs.indexOf(r);return '<tr><td>'+(n+1)+'</td><td style="white-space:nowrap">'+esc(r.id)+'</td><td style="white-space:nowrap"><b>'+esc(r.tableId)+'</b> · '+esc(dictCatalogName(r.tableId)||'-')+'</td><td><b>'+esc(r.version)+'</b></td><td>'+logTypeBadge(r.type)+'</td><td style="max-width:260px;min-width:180px">'+esc(r.fromValue||'—')+'</td><td style="max-width:260px;min-width:180px">'+esc(r.toValue||'—')+'</td><td style="white-space:nowrap">'+esc(r.operator)+'</td><td style="white-space:nowrap">'+esc(r.time)+'</td><td class="ops" style="white-space:nowrap"><button class="btn btn-primary btn-xs" onclick="dictLogDetail('+i+')">详情</button> <button class="btn btn-ghost btn-xs" onclick="dictLogEdit('+i+')">修改</button> <button class="btn btn-danger btn-xs" onclick="dictLogDelete('+i+')">删除</button></td></tr>'});
    return shell('码表变更记录',filter,['序号','变更记录ID','码表','版本号','变更类型','原始值','改后值','变更人','变更时间','操作'],body);
  };
  function dictLogForm(index){
    const catalogs=(window.dictCatalogs||[]).filter(d=>!d.externalModule);
    const r=index==null?{id:newDictLogId(window.dictLogState.table||'B1'),tableId:window.dictLogState.table||'B1',version:nextTableVersion(window.dictLogState.table||'B1'),type:'新增',fromValue:'',toValue:'',operator:logUser(),time:logNow(),remark:''}:dictLogs[index];
    if(index!=null){
      const roField=(label,v)=>'<div class="form-group"><label>'+label+'</label><input value="'+esc(v)+'" readonly style="background:#f8fafc;color:#475569"></div>';
      const roArea=(label,v)=>'<div class="form-group full"><label>'+label+'（只读）</label><textarea readonly style="background:#f8fafc;color:#475569">'+esc(v)+'</textarea></div>';
      const body='<div style="padding:8px 10px;margin-bottom:10px;background:#fffbeb;border-left:3px solid #f59e0b;color:#7c5700;font-size:12px">变更记录创建后仅允许修改「备注」，其余字段为只读留痕。</div><div class="form-grid">'+
        roField('变更记录ID',r.id)+roField('码表',r.tableId+' - '+dictCatalogName(r.tableId))+roField('版本号',r.version)+roField('变更类型',r.type)+
        roField('变更人',r.operator)+roField('变更时间',r.time)+roArea('原始值',r.fromValue||'—')+roArea('改后值',r.toValue||'—')+
        text('备注（可修改）','dlRemark',r.remark)+'</div>';
      modal('修改变更记录 · '+r.id,body,()=>{
        dictLogs[index].remark=value('dlRemark');
        close();toast('备注已保存');renderPage('dict-change-log');
      });
      return;
    }
    const body='<div class="form-grid">'+
      '<div class="form-group"><label>变更记录ID</label><input id="dlId" value="'+esc(r.id)+'" readonly style="background:#f8fafc"></div>'+
      '<div class="form-group"><label>码表</label><select id="dlTable" onchange="dictLogTableChange()">'+catalogs.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===r.tableId?' selected':'')+'>'+esc(d.id+' · '+d.name)+'</option>').join('')+'</select></div>'+
      input('版本号','dlVersion',r.version,'text',true)+
      select('变更类型','dlType',['新增','修改','删除'],r.type)+
      input('变更人','dlOperator',r.operator,'text',true)+
      input('变更时间','dlTime',r.time,'text',true)+
      text('原始值','dlFrom',r.fromValue)+
      text('改后值','dlTo',r.toValue)+
      text('备注','dlRemark',r.remark)+'</div>';
    modal('新增码表变更记录',body,()=>{
      const table=document.getElementById('dlTable').value,version=value('dlVersion'),operator=value('dlOperator');
      let time=value('dlTime');
      if(!version||!operator||!time)return toast('版本号、变更人、变更时间为必填项','error');
      if(dictLogs.some(x=>x.tableId===table&&x.version===version))return toast('该码表下版本号已存在，请填写新的版本号','error');
      if(/^\d{4}-\d{2}-\d{2}$/.test(time))time+=' 00:00:00';
      if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time))return toast('变更时间格式应为 YYYY-MM-DD HH:mm:ss','error');
      dictLogs.unshift({id:newDictLogId(table),tableId:table,version,type:document.getElementById('dlType').value,fromValue:value('dlFrom'),toValue:value('dlTo'),operator,time,remark:value('dlRemark')});
      close();toast('保存成功');window.dictLogState.table='';renderPage('dict-change-log');
    });
  }
  window.dictLogTableChange=()=>{const t=document.getElementById('dlTable').value;document.getElementById('dlVersion').value=nextTableVersion(t);document.getElementById('dlId').value=newDictLogId(t)};
  window.dictLogAdd=()=>dictLogForm(null);
  window.dictLogEdit=i=>dictLogForm(i);
  window.dictLogDetail=i=>{
    const r=dictLogs[i];if(!r)return;
    close();
    const content=detailItem('变更记录ID',esc(r.id))+detailItem('码表',esc(r.tableId)+' · '+esc(dictCatalogName(r.tableId)||'-'))+detailItem('版本号','<b>'+esc(r.version)+'</b>')+detailItem('变更类型',logTypeBadge(r.type))+detailItem('原始值',esc(r.fromValue||'—'))+detailItem('改后值',esc(r.toValue||'—'))+detailItem('变更人',esc(r.operator))+detailItem('变更时间',esc(r.time))+detailItem('备注',esc(r.remark||'-'));
    const o=document.createElement('div');
    o.className='cd-overlay dict-modal';o.style.zIndex='10000';
    o.innerHTML='<div class="cd-dialog" style="max-width:720px"><div class="cd-header"><span>码表变更记录详情</span><span class="cd-close" onclick="dictClose()">×</span></div><div class="cd-body" style="max-height:70vh;overflow:auto">'+content+'</div><div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end"><button class="btn btn-primary btn-sm" onclick="dictClose()">关闭</button></div></div>';
    o.onclick=ev=>{if(ev.target===o)close()};
    document.body.appendChild(o);
  };
  window.dictLogDelete=i=>{const r=dictLogs[i];if(!r)return;showConfirm('确认删除','确定要删除变更记录「'+r.id+'」吗？删除后不可恢复。',()=>{dictLogs.splice(i,1);toast('删除成功');renderPage('dict-change-log')})};
  const logCsvCell=v=>{let s=String(v==null?'':v);if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  window.dictLogExport=()=>{
    const list=dictLogList();
    if(!list.length)return toast('当前查询条件下没有可导出的变更记录','error');
    const head=['变更记录ID','码表ID','码表名称','版本号','变更类型','原始值','改后值','变更人','变更时间','备注'];
    const lines=[head.map(logCsvCell).join(',')].concat(list.map(r=>[r.id,r.tableId,dictCatalogName(r.tableId),r.version,r.type,r.fromValue,r.toValue,r.operator,r.time,r.remark].map(logCsvCell).join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='码表变更记录_'+logToday()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('已导出 '+list.length+' 条变更记录');
  };

  const active=(data,predicate=x=>true)=>data.filter(x=>x.status==='启用'&&predicate(x)).map(x=>({v:x.code,t:x.code+' - '+x.name}));
  function logicForm(index){const r=index==null?{anatomy:'',pathology:'',status:'启用',remark:''}:dictLogicData[index];const body='<div class="form-grid">'+select('解剖部位（亚部位）','lAnatomy',[{v:'',t:'请选择'}].concat(active(dictAnatomyData,x=>x.level===2)),r.anatomy)+select('病理类型','lPathology',[{v:'',t:'请选择'}].concat(active(dictPathologyData)),r.pathology)+select('状态','lStatus',['启用','禁用'],r.status)+text('备注','lRemark',r.remark)+'</div>';modal(index==null?'新增逻辑字典':'编辑逻辑字典',body,()=>{const anatomy=value('lAnatomy'),pathology=value('lPathology');if(!anatomy||!pathology)return toast('请选择部位和病理类型','error');if(dictLogicData.some((x,i)=>x.anatomy===anatomy&&x.pathology===pathology&&i!==index))return toast('该组合已存在','error');const item={id:index==null?Date.now():dictLogicData[index].id,anatomy,pathology,status:value('lStatus'),remark:value('lRemark')};index==null?dictLogicData.push(item):Object.assign(dictLogicData[index],item);close();toast('保存成功');renderPage('dict-logic')})}
  const label=(code,data)=>{const r=data.find(x=>x.code===code);return r?code+' - '+r.name:code};
  window.renderDictLogic=()=>{const q=dictLogicState.keyword||'',list=dictLogicData.filter(x=>!q||label(x.anatomy,dictAnatomyData).includes(q)||label(x.pathology,dictPathologyData).includes(q));const body=rows(list,6,(r,n)=>{const i=dictLogicData.indexOf(r);return '<tr><td>'+(n+1)+'</td><td>'+label(r.anatomy,dictAnatomyData)+'</td><td>'+label(r.pathology,dictPathologyData)+'</td><td>'+badge(r.status)+'</td><td>'+esc(r.remark||'-')+'</td><td class="ops"><button class="btn btn-primary btn-xs" onclick="dictLogicEdit('+i+')">编辑</button> <button class="btn btn-danger btn-xs" onclick="dictLogicDelete('+i+')">删除</button></td></tr>'});const filter='<div class="filter-toolbar"><div class="form-group search-group"><label>检索内容</label><input value="'+esc(q)+'" placeholder="部位 / 病理" oninput="dictLogicState.keyword=this.value"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-logic\')">查询</button><button class="btn btn-ghost btn-sm" onclick="dictLogicState.keyword=\'\';renderPage(\'dict-logic\')">重置</button><button class="btn btn-primary btn-sm" onclick="dictLogicAdd()">+ 添加</button></div></div>';return shell('逻辑字典管理',filter,['序号','部位','病理类型','状态','备注','操作'],body)};window.dictLogicAdd=()=>logicForm(null);window.dictLogicEdit=i=>logicForm(i);window.dictLogicDelete=i=>showConfirm('确认删除','确定要删除该逻辑字典记录吗？',()=>{dictLogicData.splice(i,1);toast('删除成功');renderPage('dict-logic')});

  const validExpression=s=>{let n=0;for(const c of s){if(c==='(')n++;if(c===')')n--;if(n<0)return false}return !!s.trim()&&n===0};
  function conditionForm(index){const r=index==null?{name:'',expression:'',desc:'',createTime:new Date().toISOString().slice(0,10)}:dictConditionData[index];modal(index==null?'新增自定义条件':'编辑自定义条件','<div class="form-grid">'+input('条件名称','cName',r.name,'text',true)+text('表达式','cExpression',r.expression)+text('说明','cDesc',r.desc)+'</div>',()=>{const name=value('cName'),expression=value('cExpression');if(!name||!expression)return toast('请填写条件名称和表达式','error');if(dictConditionData.some((x,i)=>x.name===name&&i!==index))return toast('条件名称已存在','error');const item={id:index==null?Date.now():dictConditionData[index].id,name,expression,desc:value('cDesc'),status:validExpression(expression)?'正确':'错误',createTime:r.createTime};index==null?dictConditionData.push(item):Object.assign(dictConditionData[index],item);close();toast(item.status==='正确'?'保存成功，表达式校验通过':'已保存，但表达式语法校验未通过',item.status==='正确'?'':'error');renderPage('dict-condition')})}
  window.renderDictCondition=()=>{const q=dictConditionState.keyword||'',list=dictConditionData.filter(x=>!q||x.name.includes(q));const body=rows(list,7,(r,n)=>{const i=dictConditionData.indexOf(r);return '<tr><td>'+(n+1)+'</td><td>'+esc(r.name)+'</td><td style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.expression)+'">'+esc(r.expression)+'</td><td>'+esc(r.desc)+'</td><td>'+badge(r.status)+'</td><td>'+r.createTime+'</td><td class="ops"><button class="btn btn-primary btn-xs" onclick="dictConditionEdit('+i+')">编辑</button> <button class="btn btn-danger btn-xs" onclick="dictConditionDelete('+i+')">删除</button></td></tr>'});const filter='<div class="filter-toolbar"><div class="form-group search-group"><label>检索内容</label><input value="'+esc(q)+'" placeholder="条件名称" oninput="dictConditionState.keyword=this.value"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-condition\')">查询</button><button class="btn btn-ghost btn-sm" onclick="dictConditionState.keyword=\'\';renderPage(\'dict-condition\')">重置</button><button class="btn btn-primary btn-sm" onclick="dictConditionAdd()">+ 添加</button></div></div>';return shell('自定义条件管理',filter,['序号','条件名称','表达式','说明','校验状态','创建日期','操作'],body)};window.dictConditionAdd=()=>conditionForm(null);window.dictConditionEdit=i=>conditionForm(i);window.dictConditionDelete=i=>showConfirm('确认删除','确定要删除「'+dictConditionData[i].name+'」吗？',()=>{dictConditionData.splice(i,1);toast('删除成功');renderPage('dict-condition')});
})();

// V1.0-final dictionary specification implementation.
(function () {
  'use strict';

  var DOMAIN_NAMES = {
    A: '人口学与标识', B: '肿瘤诊断', C: '治疗', D: '随访与结局',
    E: '家族史与危险因素', F: '机构与报告', G: '平台配置'
  };
  function values(text) {
    if (!text) return [];
    return text.split('|').map(function (part, index) {
      var at = part.indexOf(':');
      return {
        code: part.slice(0, at),
        name: part.slice(at + 1),
        sort: index + 1,
        status: '启用',
        mergeStatus: '未撤并',
        mergeCode: '',
        validFrom: '2026-01-01',
        validTo: '',
        remark: ''
      };
    });
  }
  function catalog(id, name, encoding, source, required, valueRange, note, itemText, extra) {
    var item = {
      id: id,
      domain: DOMAIN_NAMES[id.charAt(0)],
      name: name,
      encoding: encoding,
      source: source,
      required: required,
      valueRange: valueRange || '',
      note: note || '',
      items: values(itemText),
      status: extra && extra.status || '可维护',
      openQuestion: extra && extra.openQuestion || '',
      externalModule: extra && extra.externalModule || ''
    };
    return item;
  }

  var NATIONALITIES = [
    '01:汉族','02:蒙古族','03:回族','04:藏族','05:维吾尔族','06:苗族','07:彝族','08:壮族','09:布依族','10:朝鲜族',
    '11:满族','12:侗族','13:瑶族','14:白族','15:土家族','16:哈尼族','17:哈萨克族','18:傣族','19:黎族','20:傈僳族',
    '21:佤族','22:畲族','23:高山族','24:拉祜族','25:水族','26:东乡族','27:纳西族','28:景颇族','29:柯尔克孜族','30:土族',
    '31:达斡尔族','32:仫佬族','33:羌族','34:布朗族','35:撒拉族','36:毛南族','37:仡佬族','38:锡伯族','39:阿昌族','40:普米族',
    '41:塔吉克族','42:怒族','43:乌孜别克族','44:俄罗斯族','45:鄂温克族','46:德昂族','47:保安族','48:裕固族','49:京族','50:塔塔尔族',
    '51:独龙族','52:鄂伦春族','53:赫哲族','54:门巴族','55:珞巴族','56:基诺族','97:其他','98:外国','99:未确定'
  ].join('|');
  var JIANGXI_CITIES = '360100:南昌市|360200:景德镇市|360300:萍乡市|360400:九江市|360500:新余市|360600:鹰潭市|360700:赣州市|360800:吉安市|360900:宜春市|361000:抚州市|361100:上饶市';

  var DICTIONARIES = [
    catalog('A1','性别字典','GB/T 2261.1','GB/T 2261.1-2003',true,'0/1/2/9','身份证第17位奇男偶女须与之一致。','0:未知的性别|1:男|2:女|9:未说明的性别'),
    catalog('A2','民族字典','两位数字码','GB/T 3304-2008',true,'01–56、97、98、99','已初始化56个民族及扩展值。',NATIONALITIES),
    catalog('A3','婚姻状况字典','待确认','GB/T 2261.2 / WS 372.6',false,'WS值1/2/3/4/9与国标10/20/30/40/90待对齐','未确认前不固化枚举。','', {status:'待确认',openQuestion:'Q3'}),
    catalog('A4','文化程度字典','待确认','WS/T 364.3',false,'常见0–9，最终值域待核对','未确认前不固化枚举。','', {status:'待确认',openQuestion:'Q3'}),
    catalog('A5','职业字典（职业类别）','GB/T 6565大类','GB/T 6565-2015',false,'1–8','职业与职业类别合并；可扩展工种。','1:机关企事业单位负责人|2:专业技术人员|3:办事人员和有关人员|4:社会生产服务和生活服务人员|5:农林牧渔生产及辅助人员|6:生产制造及有关人员|7:军人|8:不便分类的其他从业人员'),
    catalog('A6','证件类型字典','两位数字','WS 364 / GB/T 14946',true,'01–09','居民身份证触发V80/V81。','01:居民身份证|02:户口簿|03:护照|04:军官证|05:机动车驾驶证|06:港澳居民来往内地通行证|07:台湾居民来往大陆通行证|09:其他法定身份证件'),
    catalog('A7','国籍字典','三位数字码','GB/T 2659 / ISO 3166',false,'三位数字码','默认156；港澳台标注中国归属。','156:中国|344:中国香港|446:中国澳门|158:中国台湾|840:美国|392:日本|410:韩国|826:英国|250:法国|276:德国|036:澳大利亚|124:加拿大'),
    catalog('A8','行政区划信息（地址空间）','GB/T 2260六位','GB/T 2260',true,'省+市+县；江西省段36','户籍可外省；常住/登记地须为江西；县码保留生效停用日期。',JIANGXI_CITIES,{status:'待补全标准源',openQuestion:'Q2'}),
    catalog('A9','亲属关系字典','平台自定义','平台自定义',false,'1–6','用于家族史定位患癌亲属。','1:父母|2:子女|3:兄弟姐妹|4:祖父母/外祖父母|5:配偶|6:其他亲属'),
    catalog('B1','肿瘤部位编码（解剖部位）','ICD-O-3 topography','ICD-O-3（WHO）',true,'C00–C80及淋巴造血部位','在“解剖部位”专页维护；正式环境须导入全量码表。','',{status:'专页维护'}),
    catalog('B2','肿瘤形态学编码字典','ICD-O-3 morphology','ICD-O-3（WHO）',true,'8000–9999 + 行为/分级后缀','在“形态学编码”专页维护；病理诊断时必填。','',{status:'专页维护'}),
    catalog('B3','肿瘤行为字典','ICD-O-3 behavior','ICD-O-3（WHO）',true,'/0 /1 /2 /3 /6 /9','行为与ICD-10互验。','/0:良性|/1:交界性/动态未定|/2:原位癌|/3:恶性（原发性）|/6:恶性（继发性/转移性）|/9:恶性（性质未特指）'),
    catalog('B4','肿瘤分级字典','ICD-O-3 grade','ICD-O-3（WHO）',false,'1–4、9','须与形态学匹配。','1:高分化(G1)|2:中分化(G2)|3:低分化(G3)|4:未分化(G4)|9:未定级/不适用'),
    catalog('B5','ICD-10疾病编码','ICD-10','ICD-10（WHO）',true,'C00–C97、D00–D09','正式环境须导入全量码表；D45–D46不再单列。','C00:唇恶性肿瘤|C16:胃恶性肿瘤|C18:结肠恶性肿瘤|C22:肝和肝内胆管恶性肿瘤|C34:支气管和肺恶性肿瘤|C50:乳房恶性肿瘤|C53:宫颈恶性肿瘤|C61:前列腺恶性肿瘤|C80:原发部位不明恶性肿瘤|D00:口腔消化器官原位癌',{status:'待补全标准源'}),
    catalog('B6','诊断依据字典','待确认','WS 372.6 / IACR',true,'IACR版本与江西省版待确认','取值未确认前不得写死。','',{status:'待确认',openQuestion:'Q1'}),
    catalog('B7','肿瘤分期方法字典','1/2/3/4/9','WS 372.6-2012',false,'分期方法','选择1/3/4时联动T/N/M。','1:TNM分期|2:临床分期(FIGO等)|3:TNM临床(cTNM)|4:TNM病理(pTNM)|9:未分期/不适用'),
    catalog('B8','TNM-T分期字典','AJCC/UICC T','AJCC/UICC',false,'T0/Tis/T1–T4及亚分','按部位子集导入。','T0:T0|Tis:Tis|T1:T1|T1a:T1a|T1b:T1b|T2:T2|T2a:T2a|T2b:T2b|T3:T3|T4:T4|TX:TX'),
    catalog('B9','TNM-N分期字典','AJCC/UICC N','AJCC/UICC',false,'N0/N1–N3及亚分','按部位子集导入。','N0:N0|N1:N1|N1a:N1a|N1b:N1b|N2:N2|N2a:N2a|N2b:N2b|N3:N3|NX:NX'),
    catalog('B10','TNM-M分期字典','AJCC/UICC M','AJCC/UICC',false,'M0/M1及亚分','按部位子集导入。','M0:M0|M1:M1|M1a:M1a|M1b:M1b|M1c:M1c|MX:MX'),
    catalog('B11','肿瘤家族分类（家族史瘤别）','ICD-O-3 / 自定义','平台自定义',false,'常见癌种或复用B1','与E1、A9配合。','C50:乳腺癌|C18:结直肠癌|C34:肺癌|C16:胃癌|C22:肝癌|C56:卵巢癌|C61:前列腺癌'),
    catalog('C1','治疗方式字典','多选1–9','WS 372.6-2012',false,'1–9','可多选。','1:手术|2:化疗|3:放疗|4:内分泌治疗|5:靶向治疗|6:免疫治疗|7:中医中药治疗|8:其他|9:不详/未治'),
    catalog('C2','首次手术性质字典','1–5/9','WS 372.6-2012',false,'1–5、9','治疗方式含手术时必填。','1:根治术|2:改良根治术|3:姑息手术|4:活检/探查|5:未手术|9:不详'),
    catalog('C3','转移标志与部位字典','0/1 + B1','ICD-O-3 / WS 372.6',false,'转移标志0/1，部位复用B1','行为/6时转移标志应为1。','0:无转移|1:有转移'),
    catalog('D1','随访状态字典','1/2/3/4/9','WS 372.6-2012',true,'1/2/3/4/9','死亡须关联死亡地点、死因和日期。','1:在访（存活）|2:失访|3:死亡|4:移居/迁出|9:未知'),
    catalog('D2','死亡地点字典','1–5/9','WS 372.6-2012',false,'1–5、9','随访状态=死亡时必填。','1:医院|2:急诊室/急救车|3:家中|4:养老/福利院|5:其他场所|9:不详'),
    catalog('D3','死亡原因字典（根本死因）','ICD-10','ICD-10',false,'ICD-10全码','正式环境复用全量ICD-10并区分肿瘤/非肿瘤死因。','C34.9:肺恶性肿瘤|C50.9:乳房恶性肿瘤|I21.9:急性心肌梗死|I64:脑卒中|J18.9:肺炎',{status:'待补全标准源'}),
    catalog('E1','家族史标志字典','0/1/9','WS 372.6-2012',false,'0/1/9','=1时联动B11与A9。','0:无|1:有（一级亲属患癌）|9:不详'),
    catalog('E2','危险因素/暴露字典','多选','平台自定义',false,'平台枚举','用于流行病学分析。','1:吸烟|2:饮酒|3:HBV/HCV|4:HPV|5:幽门螺杆菌|6:石棉暴露|7:职业暴露|8:放射暴露|9:肥胖|10:家族史|99:其他'),
    catalog('F1','医疗机构信息（机构代码）','机构唯一代码','GB 11714 / 卫健机构标码',true,'机构代码+名称+等级+类型+区划','主数据，不纳入通用字典UI；由基础数据/机构管理维护。','',{status:'独立模块',externalModule:'master-hospital'}),
    catalog('F2','医院等级字典','1–9','卫健统计制度',false,'1–9','','1:三级特等|2:三级甲等|3:三级乙等|4:三级丙等|5:二级甲等|6:二级乙等|7:二级丙等|8:一级医院|9:未定级/其他'),
    catalog('F3','医院类型字典','1–8','卫健统计制度',false,'1–8','','1:综合医院|2:中医医院|3:专科医院（肿瘤）|4:妇幼专科医院|5:社区卫生服务中心|6:乡镇卫生院|7:疾病预防控制中心|8:其他医疗机构'),
    catalog('F4','报告卡状态字典','0/1/2/3/9','平台自定义',true,'状态流转','状态流转受权限控制。','0:暂存（草稿）|1:已上报（待审核）|2:已审核|3:已驳回|9:已注销'),
    catalog('F5','数据来源字典','1–6/9','平台自定义',true,'来源分类','来源=2时诊断依据通常为死亡补发病。','1:医院报告（新发）|2:死因监测（死亡补发）|3:医保/新农合|4:疾控交换|5:随访登记|6:外省/跨区交换|9:其他'),
    catalog('F6','肿瘤编码转ICD-10对照','ICD-O-3→ICD-10','IARC对照表',false,'B1+B2→B5','在“ICD编码对照”专页维护；正式环境须导入官方全量表。','C34.9+8070/3:C34.9|C34.9+8041/3:C34.9|C50.9+8500/3:C50.9|C16.9+8140/3:C16.9',{status:'专页维护'}),
    catalog('F7','登记编码年度配置','年份+地区+流水号','平台自定义',true,'年度规则','年度重置并保证登记号唯一。','2024:JX-{YYYY}-{REGION}-{SEQ:06}|2025:JX-{YYYY}-{REGION}-{SEQ:06}|2026:JX-{YYYY}-{REGION}-{SEQ:06}'),
    catalog('G1','字典分类字典 / 系统字典','A–G','平台自定义',true,'七大域','用于字典库自身分级。','A:人口学与标识|B:肿瘤诊断|C:治疗|D:随访与结局|E:家族史与危险因素|F:机构与报告|G:平台配置')
  ];

  var OPEN_QUESTIONS = [
    {id:'Q1',item:'诊断依据 B6',issue:'IACR标签与部分省报告卡变体码同义不同。',action:'由江西省肿瘤登记处书面确认采用版本',status:'待确认'},
    {id:'Q2',item:'赣江新区行政区划 A8',issue:'赣江新区为国家级新区，GB/T 2260暂无独立区划代码。',action:'确认按南昌市、九江市相关区县码建模还是预留码段建模',status:'待确认'},
    {id:'Q3',item:'文化程度 A4 / 婚姻 A3',issue:'WS/T 364.3、GB/T 2261.2与旧版取值不同。',action:'核对现行标准后固化值域',status:'待确认'},
    {id:'Q4',item:'标准版本',issue:'WS 372.6更新版及ICD-O-3.2采用情况待核。',action:'核查现行国标与WHO版本',status:'待确认'}
  ];

  function rule(id, level, type, text, related, nature, basis) {
    return {id:id, level:level, type:type, rule:text, related:related.split(','), nature:nature, basis:basis, enabled:true};
  }
  var RULES = [
    rule('V01','强制','登记范围','仅登记C00–C97恶性、D00–D09原位及规定中枢神经良性肿瘤；其他良性不报。','B1,B3,B5','官方','肿瘤登记管理办法 + IACR'),
    rule('V11','强制','行为×ICD-10','部位+行为须与ICD-10一致：C段对应恶性，D00–D09对应/2。','B1,B3,B5,F6','官方','ICD-O-3/ICD-10'),
    rule('V12','强制','部位×性别','卵巢、宫颈、子宫仅女；前列腺仅男。','B1,A1','国际参照','IARC edit check'),
    rule('V13','警告','部位×年龄','年龄<15或>100且非幼年高发瘤种时告警。','B1,A1','官方','登记质量评价'),
    rule('V21','强制','诊断依据×形态学','病理类诊断依据时形态学编码必填且合法。','B6,B2','官方','WS 372.6'),
    rule('V22','警告','诊断依据×部位','临床依据且为罕见原发部位时建议补病理。','B6,B1','平台推导','合理性提示'),
    rule('V23','强制','死亡原因×诊断','肿瘤死因须与主要诊断一致或位于转移部位。','D1,D3,B5','官方','死亡登记章'),
    rule('V31','强制','分级×形态学','分级须与形态学匹配。','B4,B2','官方','ICD-O-3'),
    rule('V32','警告','形态学×行为','已知不合理的形态学与行为组合告警。','B2,B3','国际参照','IARCcrgTools'),
    rule('V33','警告','形态学×性别','性别特异性形态与填报性别不符时告警。','B2,A1','国际参照','IARCcrgTools'),
    rule('V34','警告','部位×行为','部位与行为存在已知不合理组合时告警。','B1,B3','官方','ICD-O-3'),
    rule('V35','警告','部位×形态学','部位与形态学已知错配时告警。','B1,B2','国际参照','IARCcrgTools'),
    rule('V36','警告','性别×家族','家族史瘤别与亲属性别矛盾时告警。','E1,B11,A1','平台推导','平台加强质控'),
    rule('V37','警告','年龄×形态学','年龄与形态学高发特征矛盾时告警。','B2,A1','平台推导','平台加强质控'),
    rule('V41','警告','性别×形态学','性别与形态学矛盾时告警。','A1,B2','国际参照','IARCcrgTools'),
    rule('V50','强制','时间逻辑','出生≤诊断≤死亡，诊断≤首次治疗。','A1,B5','官方','登记指导手册'),
    rule('V51','强制','年龄范围','实足年龄须在0–120岁。','A1','平台推导','工程合理性边界'),
    rule('V54','警告','年龄一致性','系统算龄与填报年龄误差>1岁时告警。','A1','平台推导','平台加强质控'),
    rule('V60','强制','必填项','必填字典缺失或码值越界时阻断。','A1,A2,A6,A8,B1,B2,B3,B5,B6,D1,F1,F4,F5,G1','官方','WS 372.6'),
    rule('V70','强制','行政区划','常住/登记地省段须为41；户籍可外省。','A8','官方','GB/T 2260'),
    rule('V71','强制','机构×区划','报告机构所属区划须为江西有效码。','F1,A8','官方','江西省属地要求'),
    rule('V80','强制','身份证×出生','身份证出生段须与出生日期一致，兼容15位。','A6,A1','官方','GB 11643'),
    rule('V81','强制','身份证×性别','身份证第17位奇男偶女须与性别一致。','A6,A1','官方','GB 11643'),
    rule('V82','强制','查重','同身份证+同部位+同病理且非多原发时判疑似重复。','A6,B1,B2','官方','登记指导手册'),
    rule('V90','警告','多原发','符合多原发规则时豁免V82并标记序列号。','B1,B2','国际参照','IACR多原发规则'),
    rule('V91','警告','去重权重','按证件>部位>病理>确诊日加权提示人工复核。','A6,B1,B2','平台推导','平台加强质控')
  ];
  // th 是 target/redline 的数值化形式：dir=min 越大越好，dir=max 越小越好，dir=range 需落在 ok 区间内；超出 block 即触红线
  var QUALITY = [
    {id:'Q-MV',name:'病理诊断比例 MV%',def:'组织学/细胞学确诊例数 ÷ 总例数',target:'≥66%（高质量≥70%）',redline:'<60%',basis:'IARC + 国家癌症中心',th:{dir:'min',ok:66,block:60}},
    {id:'Q-DCO',name:'仅死亡证明书比例 DCO%',def:'仅死亡证明书例数 ÷ 总例数',target:'<15%（高质量<10%）',redline:'>15%',basis:'IARC + 县级考核',th:{dir:'max',ok:10,block:15}},
    {id:'Q-MI',name:'死亡/发病比 M/I',def:'恶性肿瘤死亡数 ÷ 发病数',target:'0.60–0.80（NCCR纳入）',redline:'<0.50或>0.90',basis:'NCCR acceptable criterion + IARC',th:{dir:'range',ok:[0.60,0.80],block:[0.50,0.90]}},
    {id:'Q-SITE',name:'部位不明比例',def:'C76–C80例数 ÷ 总例数',target:'<1%（可接受<3%）',redline:'>3%',basis:'IARC',th:{dir:'max',ok:1,block:3}},
    {id:'Q-BASIS',name:'诊断依据不明比例',def:'依据码不详或缺失 ÷ 总例数',target:'<5%',redline:'>5%',basis:'WS 372.6 + 县级考核',th:{dir:'max',ok:5,block:5}},
    {id:'Q-MISS',name:'漏报率（完整性）',def:'未报 ÷（已报+未报）',target:'<5%',redline:'>5%',basis:'指导手册 + 县级质控',th:{dir:'max',ok:5,block:5}},
    {id:'Q-AGE0',name:'0岁组异常比例',def:'年龄<1岁且非幼年特有瘤种占比',target:'极低且符合出生队列',redline:'异常偏高',basis:'IARC年龄分布检验',th:null}
  ];
  window.dictQuality = QUALITY;
  window.dictCatalogs = DICTIONARIES;

  var state = {domain:'', dictionary:'A1', keyword:'', ruleLevel:'', ruleNature:''};
  var auditResult = null;
  var e = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function badge(text, tone) { return '<span class="badge badge-' + (tone || 'muted') + '">' + e(text) + '</span>'; }
  function page(title, body, actions) {
    return '<div class="page-toolbar"><div class="page-toolbar-title"><span class="icon">●</span>' + e(title) + '</div>' +
      (actions ? '<div class="toolbar-actions">' + actions + '</div>' : '') + '</div><div class="panel"><div class="panel-body">' + body + '</div></div>';
  }
  function table(headers, rowsHtml) {
    return '<div class="table-wrap dict-final-table"><table class="data-table tbl-auto"><thead><tr>' +
      headers.map(function (h) { return '<th>' + e(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="' + headers.length + '" class="dict-empty">暂无数据</td></tr>') + '</tbody></table></div>';
  }
  function dictionaryById(id) { return DICTIONARIES.find(function (d) { return d.id === id; }); }
  function addStyles() {
    if (document.getElementById('dictFinalStyles')) return;
    var style = document.createElement('style');
    style.id = 'dictFinalStyles';
    style.textContent =
      '.dict-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}' +
      '.dict-card{border:1px solid #dbe3ec;border-radius:7px;padding:12px;background:#fff}.dict-card b{display:block;font-size:22px;color:#315a86;margin-top:3px}' +
      '.dict-domain-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dict-domain{border:1px solid #dbe3ec;border-radius:7px;padding:12px;cursor:pointer}.dict-domain:hover{border-color:#3b82f6;background:#f5f9ff}' +
      '.dict-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:10px;font-size:12px}.dict-meta b{display:block;color:#64748b;margin-bottom:3px}' +
      '.dict-note{padding:9px 12px;border-left:3px solid #f59e0b;background:#fffbeb;color:#7c5700;margin:8px 0;font-size:12px}' +
      '.dict-ok{padding:10px 12px;border-left:3px solid #22c55e;background:#f0fdf4;color:#166534;margin-bottom:12px}.dict-error{border-color:#ef4444!important;background:#fef2f2!important}' +
      '.dict-empty{text-align:center!important;color:#94a3b8!important;padding:28px!important}.dict-final-table td,.dict-final-table th{white-space:nowrap}.dict-rule{max-width:430px;white-space:normal!important;line-height:1.5}' +
      '.dict-modal .cd-dialog{max-width:760px}.dict-modal .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dict-modal .form-group.full{grid-column:1/-1}' +
      '@media(max-width:900px){.dict-summary,.dict-meta{grid-template-columns:repeat(2,1fr)}.dict-domain-grid{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(style);
  }
  function modal(title, body, saveFn) {
    document.querySelectorAll('.dict-final-modal').forEach(function (n) { n.remove(); });
    window.dictFinalSave = saveFn;
    var overlay = document.createElement('div');
    overlay.className = 'cd-overlay dict-modal dict-final-modal';
    overlay.style.zIndex = '10001';
    overlay.innerHTML = '<div class="cd-dialog"><div class="cd-header"><span>' + e(title) + '</span><span class="cd-close" onclick="dictFinalClose()">×</span></div>' +
      '<div class="cd-body">' + body + '</div><div class="cd-header" style="border-top:1px solid #e2e8f0;border-bottom:0;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="dictFinalClose()">取消</button><button class="btn btn-primary btn-sm" onclick="dictFinalSave()">保存并校验</button></div></div>';
    document.body.appendChild(overlay);
  }
  window.dictFinalClose = function () { document.querySelectorAll('.dict-final-modal').forEach(function (n) { n.remove(); }); };
  function input(label, id, value, required, full) {
    return '<div class="form-group' + (full ? ' full' : '') + '"><label>' + e(label) + (required ? ' <span class="required">*</span>' : '') + '</label><input id="' + id + '" value="' + e(value || '') + '"></div>';
  }
  function selectInput(label, id, list, value) {
    return '<div class="form-group"><label>' + e(label) + '</label><select id="' + id + '">' +
      list.map(function (x) { return '<option' + (x === value ? ' selected' : '') + '>' + e(x) + '</option>'; }).join('') + '</select></div>';
  }
  function validateAll() {
    var errors = [], warnings = [];
    var expected = ['A1','A2','A3','A4','A5','A6','A7','A8','A9','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','C1','C2','C3','D1','D2','D3','E1','E2','F1','F2','F3','F4','F5','F6','F7','G1'];
    if (DICTIONARIES.length !== 36) errors.push('字典数量应为36，当前' + DICTIONARIES.length);
    expected.forEach(function (id) { if (!dictionaryById(id)) errors.push('缺少字典 ' + id); });
    var seen = {};
    DICTIONARIES.forEach(function (d) {
      if (seen[d.id]) errors.push('字典ID重复：' + d.id);
      seen[d.id] = true;
      ['id','domain','name','encoding','source'].forEach(function (k) { if (!d[k]) errors.push(d.id + ' 缺少' + k); });
      if (d.required && !d.items.length && !d.valueRange && !d.externalModule) errors.push(d.id + ' 必填字典无值域');
      var itemSeen = {};
      d.items.forEach(function (item) {
        if (!item.code || !item.name) errors.push(d.id + ' 存在空代码或名称');
        if (itemSeen[item.code]) errors.push(d.id + ' 代码重复：' + item.code);
        itemSeen[item.code] = true;
        if (item.mergeStatus === '已撤并' && (!item.mergeCode || item.mergeCode === item.code)) errors.push(d.id + ' 撤并目标无效：' + item.code);
      });
      if (d.status.indexOf('待') === 0) warnings.push(d.id + ' ' + d.status);
    });
    if (RULES.length !== 26) errors.push('交叉校验规则应为26条，当前' + RULES.length);
    var ruleSeen = {};
    RULES.forEach(function (r) {
      if (ruleSeen[r.id]) errors.push('规则ID重复：' + r.id);
      ruleSeen[r.id] = true;
      if (['强制','警告'].indexOf(r.level) < 0) errors.push(r.id + ' 级别无效');
      r.related.forEach(function (id) { if (!dictionaryById(id)) errors.push(r.id + ' 引用了不存在的字典 ' + id); });
    });
    if (OPEN_QUESTIONS.length !== 4) errors.push('待确认事项应为4项');
    if (QUALITY.length !== 7) errors.push('群体质量指标应为7项');
    if (!dictionaryById('F1').externalModule) errors.push('F1必须由独立机构管理模块维护');
    ['A3','A4','B6'].forEach(function (id) {
      var d = dictionaryById(id);
      if (d.items.length) errors.push(id + ' 属争议值域，不得提前固化');
    });
    auditResult = {errors:errors, warnings:warnings, time:new Date().toLocaleString('zh-CN')};
    return auditResult;
  }
  window.dictRunAudit = function () {
    var result = validateAll();
    toast(result.errors.length ? '校验发现 ' + result.errors.length + ' 个错误' : '自动校验通过：36类字典、26条规则完整', result.errors.length ? 'error' : 'success');
    renderPage('dict-overview');
  };

  window.renderDictOverview = function () {
    addStyles();
    var result = validateAll();
    var domainRows = Object.keys(DOMAIN_NAMES).map(function (code) {
      var list = DICTIONARIES.filter(function (d) { return d.id.charAt(0) === code; });
      return '<div class="dict-domain" onclick="dictSelectDomain(\'' + code + '\')"><span>' + code + ' · ' + e(DOMAIN_NAMES[code]) + '</span><b>' + list.length + ' 类字典</b><div style="color:#64748b;font-size:12px;margin-top:4px">' +
        list.map(function (d) { return d.id; }).join(' / ') + '</div></div>';
    }).join('');
    var audit = result.errors.length
      ? '<div class="dict-note dict-error"><b>自动校验未通过</b>：' + result.errors.map(e).join('；') + '</div>'
      : '<div class="dict-ok"><b>自动校验通过</b>：36/36类字典、26/26条交叉规则、7/7项质量指标、4/4项待确认事项均完整。Q1–Q4保持未固化状态。<span style="float:right">校验时间：' + e(result.time) + '</span></div>';
    return page('字典功能总览 · V1.0-final',
      audit + '<div class="dict-summary">' +
      '<div class="dict-card">字典总数<b>36</b><span>7个业务域</span></div>' +
      '<div class="dict-card">字典项<b>' + DICTIONARIES.reduce(function (n,d) { return n + d.items.length; }, 0) + '</b><span>原型已初始化</span></div>' +
      '<div class="dict-card">交叉校验<b>26</b><span>强制14 / 警告12</span></div>' +
      '<div class="dict-card">待确认事项<b>4</b><span>未擅自固化</span></div></div>' +
      '<div class="dict-domain-grid">' + domainRows + '</div>' +
      '<div class="dict-note">说明：ICD-10、ICD-O-3、江西县区及ICD-O→ICD-10全量数据必须从授权标准源导入；当前原型提供结构、代表性数据、维护流程与完整性校验，不伪造标准全量码表。</div>',
      '<button class="btn btn-primary btn-sm" onclick="dictRunAudit()">重新自动校验</button>');
  };
  window.dictSelectDomain = function (code) { state.domain = DOMAIN_NAMES[code]; state.dictionary = DICTIONARIES.find(function (d) { return d.id.charAt(0) === code && !d.externalModule; }).id; renderPage('dict-common'); };

  window.renderDictCommon = function () {
    addStyles();
    var visibleCatalogs = DICTIONARIES.filter(function (d) { return !d.externalModule && ['B1','B2','F6'].indexOf(d.id) < 0; });
    var current = dictionaryById(state.dictionary);
    if (!current || current.externalModule || ['B1','B2','F6'].indexOf(current.id) >= 0) { current = visibleCatalogs[0]; state.dictionary = current.id; }
    var q = state.keyword.toLowerCase();
    var list = current.items.filter(function (r) { return !q || (r.code + r.name + r.remark).toLowerCase().indexOf(q) >= 0; });
    var domainOptions = [''].concat(Object.keys(DOMAIN_NAMES).map(function (k) { return DOMAIN_NAMES[k]; })).map(function (d) { return '<option value="' + e(d) + '"' + (state.domain === d ? ' selected' : '') + '>' + e(d || '全部域') + '</option>'; }).join('');
    var dictOptions = visibleCatalogs.filter(function (d) { return !state.domain || d.domain === state.domain; }).map(function (d) { return '<option value="' + d.id + '"' + (d.id === current.id ? ' selected' : '') + '>' + d.id + ' · ' + e(d.name) + '</option>'; }).join('');
    var rows = list.map(function (r, i) {
      var realIndex = current.items.indexOf(r);
      return '<tr><td>' + (i + 1) + '</td><td><b>' + e(r.code) + '</b></td><td>' + e(r.name) + '</td><td>' + r.sort + '</td><td>' + badge(r.status, r.status === '启用' ? 'success' : 'muted') + '</td>' +
        '<td>' + badge(r.mergeStatus, r.mergeStatus === '已撤并' ? 'danger' : 'success') + '</td><td>' + e(r.mergeCode || '—') + '</td><td>' + e(r.validFrom || '—') + '</td><td>' + e(r.validTo || '长期') + '</td><td>' + e(r.remark || '—') + '</td>' +
        '<td class="ops"><button class="btn btn-primary btn-xs" onclick="dictFinalEditItem(' + realIndex + ')">编辑</button> <button class="btn btn-danger btn-xs" onclick="dictFinalDeleteItem(' + realIndex + ')">删除</button></td></tr>';
    }).join('');
    var meta = '<div class="dict-meta"><div><b>规范ID</b>' + current.id + '</div><div><b>所属域</b>' + e(current.domain) + '</div><div><b>编码/标准</b>' + e(current.encoding) + '</div><div><b>来源</b>' + e(current.source) + '</div><div><b>是否必填</b>' + (current.required ? '是' : '否') + '</div><div><b>维护状态</b>' + e(current.status) + '</div><div style="grid-column:span 2"><b>值域</b>' + e(current.valueRange || '见当前字典项') + '</div></div>';
    var notice = current.note ? '<div class="dict-note">' + e(current.note) + (current.openQuestion ? '（关联 ' + current.openQuestion + '）' : '') + '</div>' : '';
    var filter = '<div class="filter-toolbar"><div class="form-group"><label>业务域</label><select onchange="dictFinalSetDomain(this.value)">' + domainOptions + '</select></div>' +
      '<div class="form-group" style="min-width:260px"><label>字典</label><select onchange="dictFinalSetDictionary(this.value)">' + dictOptions + '</select></div>' +
      '<div class="form-group search-group"><label>检索</label><input value="' + e(state.keyword) + '" placeholder="代码 / 名称 / 备注" oninput="stateDictKeyword(this.value)"></div>' +
      '<div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-common\')">查询</button><button class="btn btn-ghost btn-sm" onclick="stateDictKeyword(\'\');renderPage(\'dict-common\')">重置</button>' +
      '<button class="btn btn-primary btn-sm"' + (current.status === '待确认' ? ' disabled title="争议值域确认前禁止固化"' : '') + ' onclick="dictFinalEditItem(null)">+ 添加</button></div></div>';
    return page('字典库', filter + meta + notice + table(['序号','代码','名称','排序','状态','撤并状态','撤并至','生效日期','停用日期','备注','操作'], rows));
  };
  window.dictFinalSetDomain = function (domain) {
    state.domain = domain;
    var next = DICTIONARIES.find(function (d) { return (!domain || d.domain === domain) && !d.externalModule && ['B1','B2','F6'].indexOf(d.id) < 0; });
    state.dictionary = next.id; state.keyword = ''; renderPage('dict-common');
  };
  window.dictFinalSetDictionary = function (id) { state.dictionary = id; state.keyword = ''; renderPage('dict-common'); };
  window.stateDictKeyword = function (v) { state.keyword = v; };
  window.dictSetRuleFilter = function (key, value) { state[key] = value; renderPage('dict-validation'); };
  function dictItemFieldString(item) {
    var fields = [['code','代码'],['name','名称'],['sort','排序'],['status','状态'],['mergeStatus','撤并状态'],['mergeCode','撤并至'],['validFrom','生效日期'],['validTo','停用日期'],['remark','备注']];
    var s = fields.filter(function (p) { return String(item[p[0]] == null ? '' : item[p[0]]) !== ''; }).map(function (p) { return p[1] + '=' + item[p[0]]; }).join('；');
    return s || '（空）';
  }
  window.dictFinalEditItem = function (index) {
    var d = dictionaryById(state.dictionary);
    if (d.status === '待确认') return toast('该字典关联待确认事项，确认前不得固化值域','error');
    var r = index == null ? {code:'',name:'',sort:d.items.length+1,status:'启用',mergeStatus:'未撤并',mergeCode:'',validFrom:'2026-01-01',validTo:'',remark:''} : d.items[index];
    var targets = d.items.filter(function (x) { return x.status === '启用' && x.code !== r.code; });
    modal((index == null ? '新增' : '编辑') + ' · ' + d.id + ' ' + d.name,
      '<div class="form-grid">' + input('代码','dfCode',r.code,true) + input('名称','dfName',r.name,true) + input('排序','dfSort',r.sort) +
      selectInput('状态','dfStatus',['启用','禁用'],r.status) + selectInput('撤并状态','dfMerge',['未撤并','已撤并'],r.mergeStatus) +
      '<div class="form-group"><label>撤并至</label><select id="dfMergeCode"><option value="">请选择</option>' + targets.map(function (x) { return '<option value="' + e(x.code) + '"' + (x.code === r.mergeCode ? ' selected' : '') + '>' + e(x.code + ' - ' + x.name) + '</option>'; }).join('') + '</select></div>' +
      input('生效日期','dfFrom',r.validFrom) + input('停用日期','dfTo',r.validTo) + input('备注','dfRemark',r.remark,false,true) + '</div>',
      function () {
        var code = document.getElementById('dfCode').value.trim(), name = document.getElementById('dfName').value.trim();
        var merge = document.getElementById('dfMerge').value, mergeCode = document.getElementById('dfMergeCode').value;
        if (!code || !name) return toast('代码和名称必填','error');
        if (d.items.some(function (x,i) { return x.code === code && i !== index; })) return toast('同一字典代码不可重复','error');
        if (merge === '已撤并' && (!mergeCode || mergeCode === code)) return toast('撤并目标必须是其他启用项','error');
        var item = {code:code,name:name,sort:Number(document.getElementById('dfSort').value)||0,status:merge === '已撤并' ? '禁用' : document.getElementById('dfStatus').value,mergeStatus:merge,mergeCode:merge === '已撤并' ? mergeCode : '',validFrom:document.getElementById('dfFrom').value,validTo:document.getElementById('dfTo').value,remark:document.getElementById('dfRemark').value.trim()};
        var beforeItem = index == null ? null : Object.assign({}, d.items[index]);
        if (index == null) d.items.push(item); else d.items[index] = item;
        var result = validateAll();
        if (result.errors.length) return toast('保存后校验失败：' + result.errors[0],'error');
        pushDictLog(d.id, index == null ? '新增' : '修改', index == null ? '' : dictItemFieldString(beforeItem), dictItemFieldString(item));
        dictFinalClose(); toast('保存成功，自动校验通过'); renderPage('dict-common');
      });
  };
  window.dictFinalDeleteItem = function (index) {
    var d = dictionaryById(state.dictionary), item = d.items[index];
    if (item.mergeStatus !== '已撤并') return toast('请先完成撤并后再删除','error');
    showConfirm('确认删除','确定删除已撤并字典项「' + item.name + '」吗？',function () { d.items.splice(index,1); pushDictLog(d.id,'删除',dictItemFieldString(item),''); validateAll(); toast('删除成功，完整性已复核'); renderPage('dict-common'); });
  };

  var oldAnatomy = window.renderDictAnatomy, oldPathology = window.renderDictPathology;
  if (typeof dictAnatomyData !== 'undefined') {
    dictAnatomyData.forEach(function (x) { x.validFrom = x.validFrom || '2026-01-01'; x.validTo = x.validTo || ''; if (x.code === 'C16.9') x.mergeStatus = '未撤并'; });
  }
  if (typeof dictPathologyData !== 'undefined') {
    dictPathologyData.forEach(function (x) { x.validFrom = x.validFrom || '2026-01-01'; x.validTo = x.validTo || ''; if (x.code === '8050') x.mergeCode = '8070'; });
  }
  window.renderDictAnatomy = function () {
    addStyles();
    return '<div class="dict-meta"><div><b>规范ID</b>B1</div><div><b>编码</b>ICD-O-3 topography</div><div><b>范围</b>C00–C80</div><div><b>状态</b>专页维护</div></div>' +
      '<div class="dict-note">正式部署须从授权标准源导入全量ICD-O-3部位码。一级格式C00，二级格式C00.0；二级必须关联启用的一级父项。</div>' + oldAnatomy();
  };
  window.renderDictPathology = function () {
    addStyles();
    return '<div class="dict-meta"><div><b>规范ID</b>B2</div><div><b>编码</b>ICD-O-3 morphology</div><div><b>范围</b>8000–9999</div><div><b>状态</b>专页维护</div></div>' +
      '<div class="dict-note">正式部署须从授权标准源导入全量ICD-O-3形态学码。这里只维护四位组织学码，完整形态学代码由组织学码+行为位组成。</div>' + oldPathology();
  };

  window.renderDictMapping = function () {
    addStyles();
    var d = dictionaryById('F6'), q = state.keyword.toLowerCase();
    var list = d.items.filter(function (x) { return !q || (x.code + x.name).toLowerCase().indexOf(q) >= 0; });
    var rows = list.map(function (x,i) {
      var parts = x.code.split('+');
      return '<tr><td>' + (i+1) + '</td><td>' + e(parts[0]) + '</td><td>' + e(parts[1] || '—') + '</td><td><b>' + e(x.name) + '</b></td><td>' + badge(x.status,'success') + '</td><td>' + e(x.validFrom) + '</td></tr>';
    }).join('');
    return page('肿瘤编码转 ICD-10 对照',
      '<div class="dict-note">F6为IARC官方映射表。正式部署必须全量导入，当前展示代表性映射，不以人工样例替代官方码表。</div>' +
      '<div class="filter-toolbar"><div class="form-group search-group"><label>检索</label><input placeholder="部位 / 形态学 / ICD-10" oninput="stateDictKeyword(this.value)"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-mapping\')">查询</button></div></div>' +
      table(['序号','ICD-O部位','形态学/行为','ICD-10','状态','生效日期'],rows));
  };
  window.renderDictValidation = function () {
    addStyles();
    var list = RULES.filter(function (r) { return (!state.ruleLevel || r.level === state.ruleLevel) && (!state.ruleNature || r.nature === state.ruleNature) && (!state.keyword || (r.id+r.type+r.rule).indexOf(state.keyword) >= 0); });
    var rows = list.map(function (r,i) {
      return '<tr><td>' + (i+1) + '</td><td><b>' + r.id + '</b></td><td>' + badge(r.level,r.level === '强制' ? 'danger' : 'warning') + '</td><td>' + e(r.type) + '</td><td class="dict-rule">' + e(r.rule) + '</td><td>' + r.related.map(function (x) { return badge(x,'info'); }).join(' ') + '</td><td>' + e(r.nature) + '</td><td class="dict-rule">' + e(r.basis) + '</td><td>' + badge(r.enabled ? '启用' : '禁用',r.enabled ? 'success' : 'muted') + '</td></tr>';
    }).join('');
    return page('交叉校验规则 · 26条',
      '<div class="dict-note">规则属于校验引擎，不纳入字典库。强制规则阻断保存；警告规则留痕但不阻断。平台推导规则可独立关闭。</div>' +
      '<div class="filter-toolbar"><div class="form-group"><label>级别</label><select onchange="dictSetRuleFilter(\'ruleLevel\',this.value)"><option value="">全部</option><option' + (state.ruleLevel==='强制'?' selected':'') + '>强制</option><option' + (state.ruleLevel==='警告'?' selected':'') + '>警告</option></select></div>' +
      '<div class="form-group"><label>性质</label><select onchange="dictSetRuleFilter(\'ruleNature\',this.value)"><option value="">全部</option><option' + (state.ruleNature==='官方'?' selected':'') + '>官方</option><option' + (state.ruleNature==='国际参照'?' selected':'') + '>国际参照</option><option' + (state.ruleNature==='平台推导'?' selected':'') + '>平台推导</option></select></div>' +
      '<div class="form-group search-group"><label>检索</label><input placeholder="ID / 类型 / 规则" oninput="stateDictKeyword(this.value)"></div><div class="filter-actions"><button class="btn btn-primary btn-sm" onclick="renderPage(\'dict-validation\')">查询</button></div></div>' +
      table(['序号','ID','级别','类型','规则摘要','关联字典','性质','依据','状态'],rows),
      '<button class="btn btn-primary btn-sm" onclick="dictRunAudit()">校验规则完整性</button>');
  };
  window.renderDictQuality = function () {
    addStyles();
    var rows = QUALITY.map(function (x,i) { return '<tr><td>'+(i+1)+'</td><td><b>'+x.id+'</b></td><td>'+e(x.name)+'</td><td class="dict-rule">'+e(x.def)+'</td><td>'+e(x.target)+'</td><td>'+badge(x.redline,'danger')+'</td><td>'+e(x.basis)+'</td></tr>'; }).join('');
    return page('群体质量指标审核 · 7项','<div class="dict-note">该页是登记点/年度整体数据质量审核，与单卡26条交叉校验互补。</div>'+table(['序号','ID','指标','定义','目标','红线','出处'],rows));
  };
  window.renderDictOpen = function () {
    addStyles();
    var rows = OPEN_QUESTIONS.map(function (x,i) { return '<tr><td>'+(i+1)+'</td><td><b>'+x.id+'</b></td><td>'+e(x.item)+'</td><td class="dict-rule">'+e(x.issue)+'</td><td class="dict-rule">'+e(x.action)+'</td><td>'+badge(x.status,'warning')+'</td></tr>'; }).join('');
    return page('待确认事项 · 禁止提前固化','<div class="dict-note">Q1–Q4确认前，相关字典只展示结构与说明，新增按钮被禁用；确认后再由省级管理员回填正式值域。</div>'+table(['序号','ID','事项','冲突/不确定性','确认动作','状态'],rows));
  };

  window.renderDictPage = function (id) {
    if (id === 'dict-overview') return renderDictOverview();
    if (id === 'dict-common') return renderDictCommon();
    if (id === 'dict-anatomy') return renderDictAnatomy();
    if (id === 'dict-change-log') return renderDictChangeLog();
    if (id === 'dict-pathology') return renderDictPathology();
    if (id === 'dict-mapping') return renderDictMapping();
    if (id === 'dict-validation') return renderDictValidation();
    if (id === 'dict-quality') return renderDictQuality();
    if (id === 'dict-open') return renderDictOpen();
    return renderDictOverview();
  };

  validateAll();
})();
