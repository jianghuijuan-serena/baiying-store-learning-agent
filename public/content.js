const types={single_choice:'单选题',multiple_choice:'多选题',judgment:'判断题'};
const formats='.txt,.md,.pdf,.docx,.csv,.json';
const formatHelp='支持 TXT、Markdown、文字型 PDF、DOCX（含表格）、CSV、JSON；单个文件最多 6 MB，正文最多 60000 字。PDF/DOCX 需服务器安装 Python 及解析组件。扫描件、图片、旧版 DOC、Excel 请先转成文字或 UTF-8 CSV。';
async function filePayload(form) {
  const file=form.elements.file?.files[0],content=form.elements.content?.value.trim()||'';
  if(file&&content) throw new Error('文件与粘贴正文请选择一种，避免内容混淆');
  if(!file) {if(!content)throw new Error('请选择文件或粘贴正文');return {content};}
  if(file.size>6*1024*1024)throw new Error('文件超过6 MB，请拆分后上传');
  const fileBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取文件'));reader.readAsDataURL(file)});
  return {filename:file.name,fileBase64};
}
async function busy(form,label,fn) {
  if(form.dataset.pending)return;
  form.dataset.pending='true';form.setAttribute('aria-busy','true');
  const status=form.querySelector('[role="status"]'),buttons=[...form.querySelectorAll('button')];
  buttons.forEach(b=>b.disabled=true);if(status){status.textContent=label;status.classList.remove('form-error')}
  try {await fn(status)}catch(e){if(status){status.textContent=e.message;status.classList.add('form-error')}}
  finally {delete form.dataset.pending;form.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false)}
}
export async function renderKnowledge({api,shell,esc,date,state,render,knowledgeHtml,knowledgeTitle,message}) {
  const admin=state.user.role==='admin',value=await api('/api/documents');
  state.documents=value.documents;
  const groups=admin?(await api('/api/admin/knowledge-groups')).groups:[...new Map(value.documents.filter(x=>x.group_id).map(x=>[x.group_id,{id:x.group_id,name:x.group_name}])).values()];
  if(state.knowledgeGroup&&!groups.some(g=>g.id===state.knowledgeGroup))state.knowledgeGroup='';
  const groupOptions=groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  const filtered=value.documents.filter(x=>!state.knowledgeGroup||x.group_id===state.knowledgeGroup);
  const groupNames=[...new Set(filtered.map(x=>x.group_name||'未分组'))];
  const documentList=groupNames.map(name=>`<div class="knowledge-group-section"><h3>${esc(name)} <span class="badge gray">${filtered.filter(x=>(x.group_name||'未分组')===name).length}</span></h3>${filtered.filter(x=>(x.group_name||'未分组')===name).map(doc=>`<div class="list-item"><div><strong>${esc(doc.title)}</strong><p>v${doc.version} · ${date(doc.created_at)}</p></div><button class="button secondary small" data-doc="${esc(doc.id)}">${admin?'查看与管理':'开始学习'} →</button></div>`).join('')}</div>`).join('');
  const search=admin?'':`<section class="panel panel-spaced"><h2>搜索知识库</h2><form id="knowledge-search" class="search-form"><label class="sr-only" for="search-query">关键词或问题</label><input id="search-query" name="q" minlength="2" maxlength="200" required placeholder="输入关键词或问题，例如：交付时间" value="${esc(state.knowledgeQuery||'')}"><button class="button">搜索知识点</button><div role="status" aria-live="polite"></div></form><div id="search-results"></div></section>`;
  const d=state.currentDoc?await api('/api/documents/'+state.currentDoc):null;
  const reader=d?`<div class="main-title"><div><button class="button ghost small" id="back-kb">← 全部资料</button><h1>${esc(d.title)}</h1><p>${d.chunks.length} 个知识点 · v${d.version}</p></div></div>${search}${admin?`
    <section class="panel"><h2>查看与管理资料</h2><p class="muted">可以修改标题、摘要和各知识点正文。保存后学习资料立即更新；修改涉及的已发布题目将重新进入待审核，已发布考试保留原试卷。</p>
    <details class="source-original"><summary>查看最初上传的正文</summary><pre>${esc(d.original_content)}</pre></details>
    <form id="edit-document" class="form">
    <label class="field">资料标题<input name="title" maxlength="100" required value="${esc(d.title)}"></label>
    <label class="field">所属分组<select name="group_id"><option value="">未分组</option>${groups.map(g=>`<option value="${esc(g.id)}" ${d.group_id===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label class="field">摘要<textarea name="summary" maxlength="2000">${esc(d.analysis?.summary||'')}</textarea></label>
    <label class="field">主题词（用逗号分隔）<input name="tags" value="${esc((d.analysis?.tags||[]).join('，'))}"></label>
    ${d.chunks.map((c,i)=>`<label class="field knowledge-chunk" id="knowledge-${i}" data-chunk-id="${esc(c.id)}">知识点 ${i+1}<textarea class="chunk-editor" data-edit-chunk="${esc(c.id)}" maxlength="10000" required>${esc(c.content)}</textarea></label>`).join('')}
    <button class="button">保存资料修改</button><div role="status" aria-live="polite"></div></form>
    <form id="generate-questions" class="form panel-top-spaced"><h3>从资料生成候选题</h3><p class="muted">由模型出题，生成结果进入待审核题库；已有题目的知识点会跳过。</p><button class="button secondary">生成候选题</button><div role="status" aria-live="polite"></div></form>
    </section>`:`
    <div class="study-layout"><aside class="panel study-index"><h2>本份资料</h2>${d.chunks.map((c,i)=>`<a href="#knowledge-${i}" class="study-index-item"><span>${i+1}</span>${esc(knowledgeTitle(c.content,i))}</a>`).join('')}</aside>
    <section class="panel study-reader"><div class="knowledge-prose">${d.chunks.map((c,i)=>`<article class="knowledge-chunk" id="knowledge-${i}" data-chunk-id="${esc(c.id)}"><span>知识点 ${i+1}</span><h2>${esc(knowledgeTitle(c.content,i))}</h2>${knowledgeHtml(c.content)}</article>`).join('')}</div></section></div>`}`:'';
  const upload=admin&&!d?`<section class="panel panel-spaced"><h2>上传资料</h2><form id="upload-form" class="form">
    <label class="field">资料标题<input name="title" maxlength="100" placeholder="例如：门店服务标准"></label>
    <label class="field">所属分组<select name="group_id"><option value="">未分组</option>${groupOptions}</select></label>
    <label class="field">选择文件<input name="file" type="file" accept="${formats}" aria-describedby="upload-help"></label><small id="upload-help">${formatHelp}</small>
    <label class="field">或直接粘贴正文<textarea name="content" maxlength="60000" placeholder="粘贴培训资料正文，至少20字"></textarea></label>
    <p class="muted">AI 会保留原意，生成摘要、主题词和按知识点拆分的正文。完成后自动打开详情，你可核对原文并手动修改。</p>
    <button class="button">上传并由 AI 整理</button><div role="status" aria-live="polite"></div><div id="duplicate-upload" aria-live="polite"></div></form></section>`:'';
  const groupManager=admin&&!d?`<section class="panel panel-spaced"><h2>分组管理</h2><p class="muted">按业务或岗位整理资料。分组仅用于整理，学员仍按发布任务查看资料。</p><form id="new-group" class="knowledge-group-create"><label class="field">新建分组<input name="name" maxlength="40" required placeholder="例如：硬件工程师"></label><button class="button secondary">新增分组</button><div role="status" aria-live="polite"></div></form><div class="knowledge-group-manager">${groups.map(g=>`<form class="group-edit" data-group="${esc(g.id)}"><input name="name" aria-label="分组名称" maxlength="40" required value="${esc(g.name)}"><span class="badge gray">${g.document_count} 份</span><button class="button secondary small" type="submit">保存名称</button><button class="button ghost small" type="button" data-delete-group="${esc(g.id)}" ${g.document_count?'disabled title="请先移走分组内资料"':''}>删除</button><div role="status" aria-live="polite"></div></form>`).join('')}</div></section>`:'';
  shell(d?reader:`<div class="main-title"><div><h1>知识库</h1><p>${admin?'上传、核对并维护培训资料。':'搜索原文或选择资料开始学习。'}</p></div></div>${search}${upload}${groupManager}<section class="panel"><div class="knowledge-list-heading"><h2>资料列表</h2><label>按分组筛选 <select id="knowledge-group-filter"><option value="">全部分组</option>${groups.map(g=>`<option value="${esc(g.id)}" ${state.knowledgeGroup===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label></div>${documentList||'<div class="empty">该分组暂无可用资料</div>'}</section>`);
  document.querySelector('#back-kb')?.addEventListener('click',()=>{state.currentDoc=null;render()});
  document.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>{state.currentDoc=b.dataset.doc;render().then(()=>window.scrollTo(0,0))});
  document.querySelector('#knowledge-group-filter')?.addEventListener('change',e=>{state.knowledgeGroup=e.target.value;render()});
  const createGroup=document.querySelector('#new-group');
  if(createGroup)createGroup.onsubmit=e=>{e.preventDefault();busy(createGroup,'正在新增分组…',async()=>{await api('/api/admin/knowledge-groups','POST',{name:createGroup.elements.name.value});await render();message('分组已新增',true)})};
  document.querySelectorAll('.group-edit').forEach(form=>{
    form.onsubmit=e=>{e.preventDefault();busy(form,'正在保存名称…',async()=>{await api('/api/admin/knowledge-groups/'+encodeURIComponent(form.dataset.group),'PUT',{name:form.elements.name.value});await render();message('分组名称已保存',true)})};
    form.querySelector('[data-delete-group]')?.addEventListener('click',()=>busy(form,'正在删除空分组…',async()=>{await api('/api/admin/knowledge-groups/'+encodeURIComponent(form.dataset.group),'DELETE');if(state.knowledgeGroup===form.dataset.group)state.knowledgeGroup='';await render();message('空分组已删除',true)}));
  });
  const sf=document.querySelector('#knowledge-search');
  if(sf)sf.onsubmit=e=>{e.preventDefault();busy(sf,'正在搜索知识库…',async status=>{
    state.knowledgeQuery=sf.elements.q.value.trim();const result=await api('/api/knowledge/search?q='+encodeURIComponent(state.knowledgeQuery));
    if(!sf.isConnected)return;
    status.textContent=`找到 ${result.results.length} 个相关知识点${result.results.length===50?'（最多显示50条，请缩小关键词）':''}`;
    document.querySelector('#search-results').innerHTML=result.results.length?result.results.map(r=>`<article class="search-result"><a class="citation-link" href="#source-${esc(r.chunk_id)}" data-source-doc="${esc(r.document_id)}" data-source-chunk="${esc(r.chunk_id)}">${esc(r.title)} · 第 ${r.position+1} 个知识点 ↗</a><div class="knowledge-prose">${knowledgeHtml(r.content)}</div></article>`).join(''):'<p class="empty">没有找到相关原文。可缩短问题，或换用资料中的关键词。</p>';
  })};
  const uf=document.querySelector('#upload-form');
  if(uf){
    const submit=allowSimilar=>busy(uf,'正在解析并分段整理资料，较长资料可能需要 1–2 分钟，请勿重复提交…',async status=>{
      const area=uf.querySelector('#duplicate-upload');area.innerHTML='';
      const payload={...await filePayload(uf),title:uf.elements.title.value,group_id:uf.elements.group_id.value,allow_similar:allowSimilar};
      try{const result=await api('/api/admin/documents','POST',payload);state.currentDoc=result.id;await render();message(`整理完成：${result.chunk_count} 个知识点，请核对内容`,true);window.scrollTo(0,0)}
      catch(e){
        const duplicate=e.details?.duplicate;if(!duplicate)throw e;
        status.textContent='';
        const matches=duplicate.type==='exact'?[duplicate]:duplicate.matches;
        area.innerHTML=`<div class="knowledge-duplicate" role="alert"><strong>${duplicate.type==='exact'?'这份正文已在知识库中':'发现高度相似的资料'}</strong><p>${esc(e.message)}</p>${matches.map(item=>`<div class="duplicate-match"><span>${esc(item.title)} · v${item.version}${item.group_name?' · '+esc(item.group_name):''}${item.similarity?' · 相似度约 '+item.similarity+'%':''}</span><button type="button" class="button secondary small" data-existing-doc="${esc(item.id)}">查看已有资料</button></div>`).join('')}${duplicate.type==='similar'?'<button type="button" class="button secondary small" id="confirm-similar-upload">确认仍要上传新资料</button>':''}</div>`;
        area.querySelectorAll('[data-existing-doc]').forEach(button=>button.onclick=()=>{state.currentDoc=button.dataset.existingDoc;render().then(()=>window.scrollTo(0,0))});
        area.querySelector('#confirm-similar-upload')?.addEventListener('click',()=>submit(true));
      }
    });
    uf.onsubmit=e=>{e.preventDefault();submit(false)};
  }
  const ef=document.querySelector('#edit-document');
  if(ef)ef.onsubmit=e=>{e.preventDefault();busy(ef,'正在保存修改…',async status=>{const result=await api('/api/admin/documents/'+d.id,'PUT',{revision:d.revision,title:ef.elements.title.value,group_id:ef.elements.group_id.value,summary:ef.elements.summary.value,tags:ef.elements.tags.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),chunks:[...ef.querySelectorAll('[data-edit-chunk]')].map(x=>({id:x.dataset.editChunk,content:x.value}))});d.revision=result.revision;status.textContent=`修改已保存。${result.redrafted} 道关联题目重新进入待审核。`})};
  const gf=document.querySelector('#generate-questions');
  if(gf)gf.onsubmit=e=>{e.preventDefault();busy(gf,'AI 正在分批生成候选题，请稍候…',async status=>{const result=await api('/api/admin/documents/'+d.id+'/generate','POST',{});status.innerHTML=`本次生成 ${result.generated} 道待审核题。${esc(result.notice||'')}${result.remaining?`<br>仍有 ${result.remaining} 个知识点尚未生成题目，可再次点击继续。`:''}${result.generated?'<br><button type="button" class="button secondary small" id="open-generated-questions">查看待审核题目 →</button>':''}`;status.querySelector('#open-generated-questions')?.addEventListener('click',()=>{state.page='questions';render()})})};
}
const letters=value=>(Array.isArray(value)?value:[value]).filter(v=>Number.isInteger(v)).map(v=>String.fromCharCode(65+v)).join(',');
function fields(q,esc) {
  return `<label class="field">题型<select name="question_type">${Object.entries(types).map(([key,name])=>`<option value="${key}" ${q.question_type===key?'selected':''}>${name}</option>`).join('')}</select></label>
  <label class="field">题干<textarea name="stem" required minlength="5">${esc(q.stem||'')}</textarea></label>
  <label class="field">选项（每行一个，依次为 A、B、C…）<textarea name="options" required>${esc((q.options||[]).join('\n'))}</textarea></label>
  <label class="field">正确答案（单选填 B；多选填 A,C；判断 A=正确、B=错误）<input name="correct" required value="${letters(q.correct)}" placeholder="例如 A,C"></label>
  <label class="field">解析<textarea name="explanation">${esc(q.explanation||'')}</textarea></label>`;
}
function readQuestion(form) {
  const get=name=>form.querySelector(`[name="${name}"]`).value;
  const question_type=get('question_type'),raw=get('correct').trim().toUpperCase().replace(/[,，、;\s]/g,'');
  if(!/^[A-H]+$/.test(raw))throw new Error('正确答案请填写 A–H 的选项字母，例如 B 或 A,C');
  const indexes=[...new Set([...raw].map(x=>x.charCodeAt(0)-65))];
  if(question_type!=='multiple_choice'&&indexes.length!==1)throw new Error('单选题和判断题只能选择一个正确答案');
  if(question_type==='multiple_choice'&&indexes.length<2)throw new Error('多选题至少需要两个正确答案');
  const options=get('options').split('\n').map(x=>x.trim()).filter(Boolean);
  if(indexes.some(i=>i>=options.length))throw new Error('答案字母超出选项范围');
  return {question_type,stem:get('stem'),options,correct:question_type==='multiple_choice'?indexes:indexes[0],explanation:get('explanation')};
}
function wireTypes(container) {
  container.querySelectorAll('[name="question_type"]').forEach(select=>select.onchange=()=>{if(select.value==='judgment')select.closest('form, .import-item').querySelector('[name="options"]').value='正确\n错误'});
}
export async function renderQuestions({api,shell,esc,state,render}) {
  const [data,docs]=await Promise.all([api('/api/admin/questions'),api('/api/documents')]);
  const choices=docs.documents.map(d=>`<option value="${d.id}">${esc(d.title)} · v${d.version}</option>`).join('');
  shell(`<div class="main-title"><div><h1>题库审核</h1><p>批量导入、AI 出题和手工录入均先保存为草稿，审核发布后才能组卷。多选题采用全选正确才得分。</p></div></div>
    ${docs.documents.length?`<section class="panel panel-spaced"><h2>批量导入题库</h2><form id="import-form" class="form">
    <label class="field">关联培训资料<select name="document_id">${choices}</select></label>
    <label class="field">题库文件<input type="file" name="file" accept="${formats}"></label><small>${formatHelp}</small>
    <label class="field">或粘贴多道题目<textarea name="content" maxlength="60000" placeholder="1. 哪些做法正确？（多选）&#10;A. 核实资料&#10;B. 猜测答案&#10;C. 记录需求&#10;答案：AC&#10;解析：……"></textarea></label>
    <p class="muted">单次最多100题。自动识别单选、多选和判断题；缺失答案会留空，请补齐后保存。关联知识点由文字匹配，请在审核时核对依据。</p>
    <button class="button">AI 解析并预览</button><div role="status" aria-live="polite"></div></form><div id="import-preview"></div></section>
    <details class="panel panel-spaced"><summary>手工新增一道题</summary><form id="manual-question" class="form">
    <label class="field">关联资料<select name="document_id">${choices}</select></label><label class="field">知识点<select name="chunk_id"></select></label>
    ${fields({question_type:'single_choice',options:['','']},esc)}<button class="button">保存为待审核草稿</button><div role="status" aria-live="polite"></div></form></details>`:'<p class="empty">请先上传关联培训资料。</p>'}
    <section class="panel"><h2>题目列表 · ${data.questions.length} 道</h2><div class="question-filters"><label>搜索题目<input id="question-query" placeholder="题干关键词"></label><label>状态<select id="question-status"><option value="">全部</option><option value="draft">待审核</option><option value="published">已发布</option></select></label><label>题型<select id="question-type"><option value="">全部题型</option>${Object.entries(types).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label></div><div id="question-list"></div></section>`);
  const list=document.querySelector('#question-list');
  function showList(){
    const query=document.querySelector('#question-query').value.trim(),status=document.querySelector('#question-status').value,type=document.querySelector('#question-type').value;
    const matches=data.questions.filter(q=>(!query||q.stem.includes(query))&&(!status||q.status===status)&&(!type||q.question_type===type));
    list.innerHTML=matches.map(q=>`<details class="question-record"><summary><span class="badge ${q.status==='draft'?'orange':''}">${q.status==='draft'?'待审核':'已发布'}</span> <span>${types[q.question_type]}</span> ${esc(q.stem)}</summary><p class="muted">${esc(q.document_title)}</p><details><summary>查看关联知识点</summary><p class="source-text">${esc(q.source)}</p></details><form class="form question-form" data-id="${q.id}">${fields(q,esc)}<label class="field">审核状态<select name="status"><option value="draft" ${q.status==='draft'?'selected':''}>待审核</option><option value="published" ${q.status==='published'?'selected':''}>发布</option></select></label><button class="button">保存题目</button><div role="status" aria-live="polite"></div></form></details>`).join('')||'<p class="empty">没有匹配的题目。</p>';
    wireTypes(list);
    list.querySelectorAll('.question-form').forEach(f=>f.onsubmit=e=>{e.preventDefault();busy(f,'正在保存…',async status=>{const q={...readQuestion(f),status:f.elements.status.value};await api('/api/admin/questions/'+f.dataset.id,'PUT',q);Object.assign(data.questions.find(x=>x.id===f.dataset.id),q);status.textContent='题目已保存';const badge=f.closest('.question-record').querySelector('summary .badge');badge.textContent=q.status==='published'?'已发布':'待审核';badge.className='badge '+(q.status==='draft'?'orange':'')})});
  }
  showList();['question-query','question-status','question-type'].forEach(id=>document.getElementById(id).oninput=showList);
  const mf=document.querySelector('#manual-question');
  if(mf){
    const load=async()=>{const d=await api('/api/documents/'+mf.elements.document_id.value);mf.elements.chunk_id.innerHTML=d.chunks.map(c=>`<option value="${c.id}">${esc(c.content.slice(0,60))}</option>`).join('')};
    await load();mf.elements.document_id.onchange=()=>busy(mf,'正在加载知识点…',async status=>{await load();status.textContent='知识点已更新'});wireTypes(mf);
    mf.onsubmit=e=>{e.preventDefault();busy(mf,'正在保存…',async status=>{await api('/api/admin/questions','POST',{...readQuestion(mf),document_id:mf.elements.document_id.value,chunk_id:mf.elements.chunk_id.value});status.textContent='已保存，请在题目列表查看';const fresh=await api('/api/admin/questions');data.questions=fresh.questions;showList()})};
  }
  const im=document.querySelector('#import-form');
  if(im)im.onsubmit=e=>{e.preventDefault();busy(im,'AI 正在逐题解析，请稍候…',async status=>{
    const result=await api('/api/admin/questions/import-preview','POST',{...await filePayload(im),document_id:im.elements.document_id.value});
    status.textContent=`识别 ${result.questions.length} 道题，请展开核对。预览30分钟内有效。`;
    const preview=document.querySelector('#import-preview');
    preview.innerHTML=`<form id="save-import" class="form" novalidate><h3>导入预览</h3>${result.questions.map((q,i)=>`<details class="import-item question-record" ${q.correct===null?'open':''}><summary>第 ${i+1} 题 · ${types[q.question_type]||'需核对题型'} · ${esc(q.stem)} ${q.correct===null?'【缺少答案】':''}</summary><label class="row"><input type="checkbox" name="include" checked>导入这道题</label>${fields(q,esc)}</details>`).join('')}<button class="button">确认保存为待审核草稿</button><div role="status" aria-live="polite"></div></form>`;
    wireTypes(preview);const save=document.querySelector('#save-import');
    save.onsubmit=event=>{event.preventDefault();busy(save,'正在保存这批题目…',async saved=>{
      const selected=[...save.querySelectorAll('.import-item')].filter(el=>el.querySelector('[name="include"]').checked);
      if(!selected.length)throw new Error('请至少勾选一道题');
      const questions=selected.map((el,i)=>{try{return readQuestion(el)}catch(e){el.open=true;el.scrollIntoView({block:'center'});throw new Error(`已选第${i+1}题：${e.message}`)}});
      const out=await api('/api/admin/questions/import','POST',{token:result.token,questions});
      saved.textContent=`已保存 ${out.imported} 道待审核题，跳过 ${out.duplicates} 道同题干重复题。`;
      const submit=save.querySelector('button');submit.remove();save.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
      data.questions=(await api('/api/admin/questions')).questions;showList();
    })};
    preview.scrollIntoView({block:'start'});
  })};
}
