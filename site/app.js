'use strict';
// Static GitHub Pages application. Records and file handles never leave this device.
const $ = id => document.getElementById(id);
const STATUS = ['PENDENTE','EM ANDAMENTO','IMPRESSO','NA GRÁFICA','ENTREGUE'];
const LABELS = ['Pendente','Em andamento','Impresso','Na gráfica','Entregue'];
const COLORS = ['#bb7765','#c3a052','#7899bc','#a28aaa','#648e66'];
const PROCESSES = {proc_dados:'Dados para pesquisa',proc_tabulacao:'Tabulação',proc_pesquisa:'Pesquisa',proc_frente:'Frente e lista',proc_mala:'Mala direta',proc_protocolos:'Protocolos',proc_declaracoes:'Declarações'};
const NUMBERS = ['alunos','qtdCert','qtdDecl','qtdEfet','qtdDeslig','qtdSemDir'];
const COURSES = ['ASSISTENTE ADMINISTRATIVO','ALIMENTADOR DE LINHA DE PRODUÇÃO','APRENDIZAGEM PROFISSIONAL EM COMÉRCIO DE BENS, SERVIÇOS E TURISMO','VENDEDOR DE COMÉRCIO VAREJISTA','MÚLTIPLAS OCUPAÇÕES'];
const state = {records:[],year:'',view:'overview',query:'',status:'',supervisor:'',course:'',turno:'',start:'',end:'',min:'',sort:'numero',dir:1,page:1,selected:new Set(),calendar:new Date(new Date().getFullYear(),new Date().getMonth(),1),fileHandle:null,dirty:false};
let pendingImport = [], importSource = '', importYear = new Date().getFullYear(), writeChain = Promise.resolve(), xlsxLoading;
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const number = v => v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) && Number(v)>=0 && Number.isInteger(Number(v)) ? Number(v) : null;
const count = v => new Intl.NumberFormat('pt-BR').format(v);
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const icon = name => `<i data-lucide="${name}"></i>`;
const dateLabel = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : 'Não informada';
const dateDiff = v => Math.round((new Date(v+'T00:00:00') - new Date(new Date().toDateString()))/86400000);
const badge = s => {const i=STATUS.indexOf(s); return `<span class="badge s${i<0?0:i}"><span class="dot"></span>${LABELS[i<0?0:i]}</span>`;};
const scoped = () => state.records.filter(r=>!state.year || String(r.ano)===state.year);
const sum = (rows,key) => rows.reduce((n,r)=>n+(Number(r[key])||0),0);
const options = (values,selected='') => values.map(v=>`<option value="${esc(v)}"${String(v)===String(selected)?' selected':''}>${esc(v)}</option>`).join('');
function icons(){globalThis.lucide?.createIcons();}
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').className=error?'error':'';$('feedback').hidden=false;}
function statusOf(v){const n=norm(v);return STATUS.find(s=>norm(s)===n) || (n.includes('TABULAD')?'EM ANDAMENTO':'PENDENTE');}
function processValue(v){if(v===true)return 'OK';if(v===false||v==null)return '';const n=norm(v);return ['OK','PULADO','NAO TEM'].includes(n)?n==='NAO TEM'?'NÃO TEM':n:'';}
function iso(v,excel=false){
  if(v===null||v===undefined||v==='')return null;
  if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  if(excel && typeof v==='number'){const d=globalThis.XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:null;}
  const s=String(v).trim();let match=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match){const b=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);if(!b)return null;match=['',b[3].length===2?'20'+b[3]:b[3],b[2].padStart(2,'0'),b[1].padStart(2,'0')];}
  const out=`${match[1]}-${match[2]}-${match[3]}`,d=new Date(out+'T12:00:00');return !isNaN(d)&&iso(d)===out?out:null;
}
function cleanRecord(raw,year){
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || typeof raw.municipio!=='string' || !raw.municipio.trim())throw Error('Há registros sem município válido.');
  const r={id:/^[a-zA-Z0-9_-]{1,100}$/.test(raw.id||'')?raw.id:uid(),ano:Number(raw.ano||year||new Date().getFullYear())};
  if(!Number.isInteger(r.ano)||r.ano<2018||r.ano>2099)throw Error('Ano de referência inválido.');
  for(const k of ['numero','municipio','curso','dias','turno','supervisor','obs'])r[k]=raw[k]==null?'':String(raw[k]).trim().slice(0,k==='obs'?10000:1000);
  for(const k of NUMBERS){if(raw[k]!==''&&raw[k]!=null&&number(raw[k])===null)throw Error('Quantitativo inválido em '+r.municipio);r[k]=number(raw[k]);}
  for(const k of ['inicio','termino']){r[k]=iso(raw[k]);if(raw[k]&&!r[k])throw Error('Data inválida em '+r.municipio);}
  r.situacao=statusOf(raw.situacao);
  for(const k of Object.keys(PROCESSES))r[k]=processValue(raw[k]);
  r.history=Array.isArray(raw.history)?raw.history.slice(-500).map(h=>({from:String(h.from||'').slice(0,100),to:String(h.to||'').slice(0,100),date:String(h.date||'').slice(0,100)})):[];
  r.createdAt=String(raw.createdAt||new Date().toISOString()).slice(0,100);r.updatedAt=String(raw.updatedAt||r.createdAt).slice(0,100);
  return r;
}
function refreshScope(){
  const years=[...new Set([new Date().getFullYear(),...state.records.map(r=>r.ano)])].sort((a,b)=>b-a);
  $('year').innerHTML='<option value="">Todos os anos</option>'+options(years,state.year);$('year').value=state.year;
  $('scope-count').textContent=`${count(scoped().length)} turma${scoped().length===1?'':'s'} no período`;
  $('nav-count').textContent=count(state.records.length);
}
function render(){refreshScope();({overview:renderOverview,classes:renderClasses,calendar:renderCalendar,files:renderFiles}[state.view])();icons();}
function navigate(view){
  state.view=view;const names={overview:'Visão geral',classes:'Turmas',calendar:'Calendário',files:'Arquivos e ajuda'};
  const descriptions={overview:'Da conclusão da turma à entrega dos certificados.',classes:'Organize as turmas e acompanhe cada etapa.',calendar:'Datas de término e entregas que precisam de atenção.',files:'Importação, cópias de segurança e orientações de uso.'};
  document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==view);
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  $('page-title').textContent=names[view];$('breadcrumb').textContent=names[view];$('page-desc').textContent=descriptions[view];render();
}
function empty(title,description,button=''){return `<div class="empty">${icon('inbox')}<h2>${esc(title)}</h2><p>${esc(description)}</p>${button}</div>`;}
function renderOverview(){
  const rows=scoped(),total=rows.length,students=sum(rows,'alunos'),delivered=rows.filter(r=>r.situacao==='ENTREGUE').length;
  const counts=STATUS.map(s=>rows.filter(r=>r.situacao===s).length);
  const critical=rows.filter(r=>r.termino&&r.situacao!=='ENTREGUE'&&dateDiff(r.termino)<=30).sort((a,b)=>a.termino.localeCompare(b.termino));
  const metrics=[['Turmas no período',total,'layers',`${delivered} entregues · ${total-delivered} em produção`],['Alunos atendidos',students,'users',`${sum(rows,'qtdEfet')} efetivados no período`],['Certificados',sum(rows,'qtdCert'),'file-check-2',`${sum(rows,'qtdDecl')} declarações registradas`],['Turmas entregues',total?Math.round(delivered/total*100)+'%':'0%','circle-check',`${delivered} de ${total} turmas concluídas`]];
  let offset=0;const circumference=2*Math.PI*55;
  const segments=counts.map((n,i)=>{const length=total?n/total*circumference:0;const s=`<circle cx="75" cy="75" r="55" fill="none" stroke="${COLORS[i]}" stroke-width="15" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}"/>`;offset+=length;return s;}).join('');
  $('overview').innerHTML=(!state.records.length?`<div class="welcome">${icon('file-spreadsheet')}<div><h2>Seu acompanhamento começa aqui</h2><p>Importe seu Excel ou restaure um backup. A base não é publicada no site.</p></div><button class="button" data-action="import">Importar meu Excel ${icon('arrow-up-right')}</button></div>`:'')+
    `<div class="metrics">${metrics.map(([label,val,ic,foot])=>`<article class="metric"><div class="metric-top"><span>${label}</span>${icon(ic)}</div><div class="metric-value">${typeof val==='number'?count(val):val}</div><div class="metric-foot">${foot}</div></article>`).join('')}</div>
    <div class="dashboard-grid">
      <article class="panel"><div class="panel-head"><div><h2>Etapas de produção</h2><p>Distribuição das turmas por situação</p></div><span>${total} turmas</span></div><div class="panel-body status-chart"><div class="donut"><svg viewBox="0 0 150 150" role="img" aria-label="Distribuição por situação"><circle cx="75" cy="75" r="55" fill="none" stroke="var(--line)" stroke-width="15"/>${segments}</svg><div class="donut-center"><strong>${total}</strong><span>turmas</span></div></div><div class="legend">${counts.map((n,i)=>`<button data-status="${STATUS[i]}"><span class="dot" style="background:${COLORS[i]}"></span>${LABELS[i]}<strong>${n}</strong><small>${total?Math.round(n/total*100):0}%</small></button>`).join('')}</div></div><div class="outcomes"><span><strong>${count(sum(rows,'qtdEfet'))}</strong>Efetivados</span><span><strong>${count(sum(rows,'qtdDeslig'))}</strong>Desligados</span><span><strong>${count(sum(rows,'qtdSemDir'))}</strong>Sem direito</span><span><strong>${students?Math.round(sum(rows,'qtdEfet')/students*100):0}%</strong>Efetivação</span></div></article>
      <article class="panel"><div class="panel-head"><div><h2>Atenção aos prazos</h2><p>Turmas sem entrega, até 30 dias</p></div><span class="urgent-count">${critical.length} em atenção</span></div><div class="alert-list">${critical.length?critical.map(r=>{const d=dateDiff(r.termino);return `<button class="alert-row" data-detail="${r.id}">${icon(d<0?'circle-alert':'clock-3')}<span><strong>${esc(r.municipio)}</strong><small>Término ${dateLabel(r.termino)} · ${esc(r.supervisor||'Sem supervisor')}</small></span><span>${d<0?Math.abs(d)+' dias após término':d===0?'Termina hoje':'Em '+d+' dias'}</span></button>`;}).join(''):empty('Nenhum prazo crítico','Não há turmas sem entrega com término nos próximos 30 dias ou já encerradas.')}</div></article>
    </div><article class="panel recent"><div class="panel-head"><div><h2>Últimas turmas atualizadas</h2><p>Continue de onde parou</p></div><button class="text-button" data-view="classes">Ver todas ${icon('arrow-right')}</button></div>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Turma / curso</th><th>Término</th><th class="num">Alunos</th><th class="num">Certificados</th><th>Situação</th><th></th></tr></thead><tbody>${[...rows].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6).map(r=>`<tr><td><strong>${esc(r.municipio)}</strong><span class="course" title="${esc(r.curso)}">${esc(r.curso||'Curso não informado')}</span></td><td>${dateLabel(r.termino)}</td><td class="num">${r.alunos??'—'}</td><td class="num">${r.qtdCert??'—'}</td><td>${badge(r.situacao)}</td><td><button class="row-action" data-detail="${r.id}" aria-label="Ver ${esc(r.municipio)}">${icon('arrow-up-right')}</button></td></tr>`).join('')}</tbody></table></div>`:empty('Ainda não há turmas','Adicione uma turma ou importe sua planilha para começar.')}</article>`;
}
function filtered(){
  return scoped().filter(r=>(!state.status||r.situacao===state.status)&&(!state.supervisor||r.supervisor===state.supervisor)&&(!state.course||r.curso===state.course)&&(!state.turno||r.turno===state.turno)&&(!state.start||(r.inicio&&r.inicio>=state.start))&&(!state.end||(r.termino&&r.termino<=state.end))&&(!state.min||(r.alunos??0)>=Number(state.min))&&(!state.query||norm([r.numero,r.municipio,r.curso,r.supervisor,r.turno,r.situacao,r.obs].join(' ')).includes(norm(state.query)))).sort((a,b)=>{
    const x=a[state.sort]??'',y=b[state.sort]??'';return (['numero',...NUMBERS].includes(state.sort)?(Number(x)||0)-(Number(y)||0):String(x).localeCompare(String(y),'pt-BR',{numeric:true}))*state.dir;
  });
}
function renderClasses(){
  const rows=filtered();const pages=Math.max(1,Math.ceil(rows.length/25));state.page=Math.min(state.page,pages);
  const visible=rows.slice((state.page-1)*25,state.page*25),unique=k=>[...new Set(scoped().map(r=>r[k]).filter(Boolean))].sort();
  const sortHeader=(label,key)=>`<button class="sort-button" data-sort="${key}">${label} ${state.sort===key?(state.dir===1?'↑':'↓'):'↕'}</button>`;
  $('classes').innerHTML=`<article class="panel"><div class="filters"><label class="search">${icon('search')}<input id="search" aria-label="Buscar turmas" placeholder="Buscar município, curso ou supervisor..." value="${esc(state.query)}"></label><select data-filter="status" aria-label="Filtrar situação"><option value="">Todas as situações</option>${STATUS.map((s,i)=>`<option value="${s}"${state.status===s?' selected':''}>${LABELS[i]}</option>`).join('')}</select><select data-filter="supervisor" aria-label="Filtrar supervisor"><option value="">Todos os supervisores</option>${options(unique('supervisor'),state.supervisor)}</select><button class="text-button" data-action="clear">Limpar filtros</button>
    <div class="filter-extras"><select data-filter="course" aria-label="Filtrar curso"><option value="">Todos os cursos</option>${options(unique('curso'),state.course)}</select><select data-filter="turno" aria-label="Filtrar turno"><option value="">Todos os turnos</option>${options(unique('turno'),state.turno)}</select><label>Início a partir de<input type="date" data-filter="start" value="${state.start}"></label><label>Término até<input type="date" data-filter="end" value="${state.end}"></label><label>Mínimo de alunos<input type="number" min="0" step="1" data-filter="min" value="${esc(state.min)}"></label></div></div>
    <div class="table-tools"><span><strong>${rows.length}</strong> turma${rows.length===1?'':'s'} encontrada${rows.length===1?'':'s'}</span><div class="tool-group">${state.selected.size?`<button class="button danger" data-action="delete-selected">${icon('trash-2')}Excluir ${state.selected.size}</button>`:''}<button class="text-button" data-action="export-xlsx">${icon('file-spreadsheet')}Excel</button><button class="text-button" data-action="export-csv">${icon('download')}CSV</button><button class="text-button" data-action="print">${icon('printer')}Imprimir</button></div></div>
    ${visible.length?`<div class="table-scroll"><table><thead><tr><th class="select-col"><input type="checkbox" id="select-all" aria-label="Selecionar página"${visible.every(r=>state.selected.has(r.id))?' checked':''}></th><th>${sortHeader('Nº','numero')}</th><th>${sortHeader('Turma / curso','municipio')}</th><th>${sortHeader('Término','termino')}</th><th>${sortHeader('Supervisor','supervisor')}</th><th class="num">${sortHeader('Alunos','alunos')}</th><th class="num">${sortHeader('Cert.','qtdCert')}</th><th>${sortHeader('Situação','situacao')}</th><th>Ações</th></tr></thead><tbody>${visible.map(r=>`<tr><td class="select-col"><input type="checkbox" data-select="${r.id}" aria-label="Selecionar ${esc(r.municipio)}"${state.selected.has(r.id)?' checked':''}></td><td>${esc(r.numero||'—')}</td><td><button class="text-button" style="padding:0;text-align:left;display:block" data-detail="${r.id}"><strong>${esc(r.municipio)}</strong><span class="course" title="${esc(r.curso)}">${esc(r.curso||'Não informado')}</span></button></td><td>${dateLabel(r.termino)}<span class="course">${esc(r.turno)}</span></td><td>${esc(r.supervisor||'—')}</td><td class="num">${r.alunos??'—'}</td><td class="num">${r.qtdCert??'—'}</td><td>${badge(r.situacao)}</td><td style="white-space:nowrap"><button class="row-action" data-edit="${r.id}" aria-label="Editar ${esc(r.municipio)}">${icon('pencil')}</button><button class="row-action" data-delete="${r.id}" aria-label="Excluir ${esc(r.municipio)}">${icon('trash-2')}</button></td></tr>`).join('')}</tbody></table></div>`:empty(state.records.length?'Nenhuma turma encontrada':'Sua lista de turmas está vazia',state.records.length?'Tente outros filtros ou outro ano de referência.':'Importe a planilha ou cadastre sua primeira turma.')}
    <div class="pagination"><span>${visible.length?`${(state.page-1)*25+1}–${Math.min(state.page*25,rows.length)} de ${rows.length}`:'0 registros'} · 25 por página</span><div class="tool-group"><button class="button" data-page="-1" aria-label="Página anterior"${state.page<=1?' disabled':''}>${icon('chevron-left')}</button><span style="align-self:center;padding:0 8px">${state.page} / ${pages}</span><button class="button" data-page="1" aria-label="Próxima página"${state.page>=pages?' disabled':''}>${icon('chevron-right')}</button></div></div></article>`;
}
function renderCalendar(){
  const year=state.calendar.getFullYear(),month=state.calendar.getMonth(),first=new Date(year,month,1),start=new Date(year,month,1-first.getDay());
  const rows=scoped().filter(r=>r.termino);let days='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=iso(d),ev=rows.filter(r=>r.termino===key);days+=`<div class="cal-day${d.getMonth()!==month?' outside':''}${key===iso(new Date())?' today':''}"><span class="day-number">${d.getDate()}</span>${ev.map(r=>`<button class="cal-event" data-detail="${r.id}" title="${esc(r.municipio)} · ${esc(r.situacao)}">${r.situacao==='ENTREGUE'?'✓ ':''}${esc(r.municipio)}</button>`).join('')}</div>`;}
  $('calendar').innerHTML=`<article class="panel"><div class="calendar-toolbar"><h2>${state.calendar.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2><button class="button" data-month="-1" aria-label="Mês anterior">${icon('chevron-left')}</button><button class="button" data-month="0">Hoje</button><button class="button" data-month="1" aria-label="Próximo mês">${icon('chevron-right')}</button></div><div class="calendar-scroll"><div class="calendar-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="weekday">${d}</div>`).join('')}${days}</div></div></article><p class="notes">Eventos indicam o término da turma. O símbolo ✓ identifica turmas entregues. Use o ano de referência para limitar os eventos.</p>`;
}
function renderFiles(){
  $('files').innerHTML=`<div class="files-grid"><article class="panel file-section"><h2>Importar dados</h2><p>Leia Excel ou CSV sem enviar o arquivo para um servidor. Confira a prévia e o ano antes de confirmar.</p><button class="button primary" data-action="import">${icon('upload')}Importar planilha</button><button class="button" data-action="restore">${icon('folder-open')}Abrir backup JSON</button></article>
    <article class="panel file-section"><h2>Guardar seu trabalho</h2><p>O backup JSON preserva todas as turmas, processos e histórico. Excel e CSV são relatórios do filtro atual de Turmas.</p><button class="button primary" data-action="backup">${icon('download')}Baixar backup</button><button class="button" data-action="connect">${icon('link')}Conectar arquivo</button><button class="button" data-action="theme">${icon('moon')}Alternar tema</button></article>
    <article class="panel file-section help"><h2>Como usar com segurança</h2>
    <details open><summary>Onde os dados são salvos?</summary><p>Os registros ficam na memória desta aba. Salve o JSON antes de fechar ou atualizar. Em navegadores compatíveis, Conectar arquivo permite escolher um JSON no seu computador e atualizar esse arquivo automaticamente. Ao voltar, conecte-o novamente. Se a conexão não estiver disponível, use o download e a restauração de backup. Não existe sincronização entre dispositivos.</p></details>
    <details><summary>O que será publicado no GitHub Pages?</summary><p>Somente o aplicativo e suas bibliotecas. Sua planilha e seus backups não fazem parte do site nem do repositório. O aplicativo não tem login: quem tiver o endereço poderá abrir uma cópia vazia. Dados compartilhados entre uma equipe exigem um serviço de autenticação e um banco de dados separado.</p></details>
    <details><summary>Como o Excel é interpretado?</summary><p>Escolha a aba na prévia. O ano é sugerido pelo nome da aba, e não pelo nome do arquivo. TABULADO é tratado como Em andamento, com o valor original nas observações. Processos preservam OK, PULADO e NÃO TEM. Campos numéricos vazios continuam vazios. Duplicatas com mesmo ano, número, município, curso e início são ignoradas.</p></details>
    <details><summary>Como migrar do dashboard antigo?</summary><p>Exporte o backup JSON na versão antiga, caso essa função esteja operante, e abra-o aqui. Se a versão antiga estiver com erro, importe sua planilha original. Esta versão não lê automaticamente os dados armazenados por outro endereço do site.</p></details>
    <details><summary>Os quantitativos devem somar o número de alunos?</summary><p>Não necessariamente. Efetivados e desligados podem se sobrepor a outras categorias. A taxa de efetivação é efetivados divididos por alunos informados, e não uma taxa de entrega. Os dados e suas definições continuam sob sua responsabilidade.</p></details>
    <details><summary>Como imprimir e trabalhar sem internet?</summary><p>A impressão utiliza a janela nativa do navegador e pode ser bloqueada na prévia incorporada. No site aberto diretamente, vá a Turmas e use Imprimir. Para trabalhar offline, baixe o código do repositório e abra site/index.html: as bibliotecas e a fonte são locais. Não há instalação ou cache offline automático do GitHub Pages.</p></details></article></div>`;
}
function closeModal(){if($('modal').open)$('modal').close();}
function showModal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();icons();}
function head(title,sub=''){return `<div class="dialog-head"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><button class="close-button" type="button" data-action="close" aria-label="Fechar">${icon('x')}</button></div>`;}
function field(label,name,value='',type='text',extra=''){return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;}
function editRecord(id){
  const r=state.records.find(r=>r.id===id)||{ano:state.year||new Date().getFullYear(),situacao:'PENDENTE'};
  showModal(`${head(id?'Editar turma':'Nova turma','Informações da turma, produção e quantitativos')}<form id="class-form"><input type="hidden" name="id" value="${esc(id||'')}"><div class="dialog-body"><fieldset><legend>Informações da turma</legend><div class="form-grid">
    ${field('Nº','numero',r.numero,'number','min="0" step="1"')}${field('Ano de referência *','ano',r.ano,'number','min="2018" max="2099" required')}${field('Turno','turno',r.turno,'text','list="turnos"')}
    <label class="field span3">Município / identificação da turma *<input name="municipio" required maxlength="1000" value="${esc(r.municipio||'')}" placeholder="Ex.: FORTALEZA 01"></label>
    <label class="field span3">Curso *<input name="curso" required maxlength="1000" list="courses" value="${esc(r.curso||'')}" placeholder="Escolha ou digite o curso"></label>
    ${field('Dias da semana','dias',r.dias)}${field('Início','inicio',r.inicio,'date')}${field('Término','termino',r.termino,'date')}
    ${field('Supervisor','supervisor',r.supervisor,'text','list="supervisors"')}${field('Alunos atendidos','alunos',r.alunos,'number','min="0" step="1"')}
    <label class="field">Situação<select name="situacao">${STATUS.map((s,i)=>`<option value="${s}"${r.situacao===s?' selected':''}>${LABELS[i]}</option>`).join('')}</select></label>
    </div></fieldset><fieldset><legend>Quantitativos</legend><div class="form-grid">${[['Certificados','qtdCert'],['Declarações','qtdDecl'],['Efetivados','qtdEfet'],['Desligados','qtdDeslig'],['Sem direito','qtdSemDir']].map(([l,k])=>field(l,k,r[k],'number','min="0" step="1"')).join('')}</div></fieldset>
    <fieldset><legend>Processo de confecção</legend><div class="process-grid">${Object.entries(PROCESSES).map(([k,l])=>`<label>${l}<select name="${k}"><option value="">Pendente</option>${options(['OK','PULADO','NÃO TEM'],processValue(r[k]))}</select></label>`).join('')}</div></fieldset>
    <label class="field">Observações<textarea name="obs" rows="3" maxlength="10000">${esc(r.obs||'')}</textarea></label><p id="form-error" class="error-inline" role="alert"></p>
    <datalist id="courses">${options([...new Set([...COURSES,...state.records.map(x=>x.curso).filter(Boolean)])])}</datalist><datalist id="supervisors">${options([...new Set(state.records.map(x=>x.supervisor).filter(Boolean))])}</datalist><datalist id="turnos">${options(['MANHÃ','TARDE','NOITE','MANHÃ/TARDE','NOITE/MANHÃ'])}</datalist></div>
    <div class="dialog-footer"><button class="button" type="button" data-action="close">Cancelar</button><button class="button primary" type="submit">${icon('check')}Salvar turma</button></div></form>`);
}
function detail(id){
  const r=state.records.find(x=>x.id===id);if(!r)return;
  const pairs=[['Nº',r.numero||'Não informado'],['Ano',r.ano],['Situação',LABELS[STATUS.indexOf(r.situacao)]],['Curso',r.curso||'Não informado'],['Supervisor',r.supervisor||'Não informado'],['Turno',r.turno||'Não informado'],['Início',dateLabel(r.inicio)],['Término',dateLabel(r.termino)],['Dias',r.dias||'Não informado'],['Alunos',r.alunos??'Não informado'],['Certificados',r.qtdCert??'Não informado'],['Declarações',r.qtdDecl??'Não informado'],['Efetivados',r.qtdEfet??'Não informado'],['Desligados',r.qtdDeslig??'Não informado'],['Sem direito',r.qtdSemDir??'Não informado']];
  showModal(`${head(r.municipio,'Detalhes da turma')}<div class="dialog-body"><dl class="detail-grid">${pairs.map(([l,v])=>`<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><h3 class="detail-title">Processo de confecção</h3><div class="process-read">${Object.entries(PROCESSES).map(([k,l])=>`<span>${l}: <strong>${esc(r[k]||'Pendente')}</strong></span>`).join('')}</div><h3 class="detail-title">Observações</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.obs||'Nenhuma observação.')}</p><h3 class="detail-title">Histórico de situação</h3>${r.history.length?`<ul class="history">${[...r.history].reverse().map(h=>`<li>${esc(h.from)} → ${esc(h.to)}<time>${esc(h.date)}</time></li>`).join('')}</ul>`:'<p>Sem alterações de situação registradas.</p>'}</div><div class="dialog-footer"><button class="button" data-action="close">Fechar</button><button class="button primary" data-edit="${id}">${icon('pencil')}Editar turma</button></div>`);
}
async function ask(message){$('confirm-message').textContent=message;$('confirm-modal').showModal();return new Promise(resolve=>$('confirm-modal').addEventListener('close',()=>resolve($('confirm-modal').returnValue==='confirm'),{once:true}));}
function backupPayload(records=state.records){return JSON.stringify({version:'sobef_v4',exportedAt:new Date().toISOString(),records},null,2);}
function download(data,name,type){
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
function backup(){download(backupPayload(),'backup-sobef-'+iso(new Date())+'.json','application/json');state.dirty=false;feedback('Backup JSON preparado para download. Guarde o arquivo para reabrir sua base.');}
function saveNotice(message){$('save-notice').querySelector('span').textContent=message;}
function changed(){
  state.dirty=true;
  if(state.fileHandle){
    const handle=state.fileHandle,payload=backupPayload();
    writeChain=writeChain.then(async()=>{const writer=await handle.createWritable();await writer.write(payload);await writer.close();state.dirty=backupPayload()!==payload;saveNotice('Arquivo local atualizado: '+handle.name+'. Reconecte o arquivo quando abrir o sistema novamente.');}).catch(e=>{state.fileHandle=null;state.dirty=true;saveNotice('Falha ao salvar o arquivo local. Baixe um backup JSON antes de sair.');feedback('Não foi possível gravar no arquivo: '+e.message,true);});
  }else saveNotice('Há alterações nesta sessão. Salve um backup JSON antes de atualizar ou fechar esta aba.');
  render();
}
function parseBackup(text){
  const data=JSON.parse(text),rows=Array.isArray(data)?data:data.records;
  if(!Array.isArray(rows)||rows.length>50000)throw Error('Backup inválido: esperado um conjunto de até 50.000 turmas.');
  const cleaned=rows.map(r=>cleanRecord(r)),ids=new Set();for(const r of cleaned){if(ids.has(r.id))r.id=uid();ids.add(r.id);}return cleaned;
}
async function restoreFile(file,handle=null){
  if(file.size>30*1024*1024)throw Error('Arquivo acima de 30 MB.');
  const incoming=parseBackup(await file.text());
  if(!await ask(`Abrir ${incoming.length} turma(s) de "${file.name}"?${state.records.length?'\nA base desta sessão será substituída. Salve um backup antes se precisar mantê-la.':''}`))return false;
  await writeChain;state.records=incoming;state.fileHandle=handle;state.selected.clear();state.year='';state.page=1;state.dirty=false;render();closeModal();
  saveNotice(handle?'Arquivo conectado: '+handle.name+'. As próximas alterações serão gravadas neste arquivo.':'Backup aberto nesta sessão. Salve um novo JSON depois de alterar os dados.');feedback(`${incoming.length} turma(s) carregada(s).`);return true;
}
async function connectFile(){
  try{
    if(typeof window.showSaveFilePicker!=='function'||typeof window.showOpenFilePicker!=='function'){feedback('Conexão automática indisponível neste navegador ou na prévia. Use Salvar backup e Abrir backup JSON.');navigate('files');return;}
    showModal(`${head('Conectar arquivo local')}<div class="dialog-body"><p>Abra uma base existente ou escolha um novo arquivo JSON para guardar as turmas desta sessão. Depois de conectar, as alterações são gravadas nesse arquivo.</p><p class="notes">Ao abrir o sistema novamente, reconecte o arquivo. Não escolha uma base existente como destino novo se quiser preservar seu conteúdo.</p></div><div class="dialog-footer"><button class="button" data-action="open-local">Abrir JSON existente</button><button class="button primary" data-action="create-local">Criar arquivo da sessão</button></div>`);
  }catch(e){feedback(e.message,true);}
}
async function loadXlsx(){
  if(globalThis.XLSX)return globalThis.XLSX;
  if(!xlsxLoading)xlsxLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./assets/xlsx.full.min.js';s.onload=()=>resolve(globalThis.XLSX);s.onerror=()=>{xlsxLoading=null;reject(Error('Não foi possível carregar a biblioteca de planilhas.'));};document.head.append(s);});
  return xlsxLoading;
}
function column(key){
  const n=norm(key).replace(/[^A-Z0-9]/g,'');
  const exact={N:'numero',NR:'numero',NUMERO:'numero',MUNICIPIO:'municipio',CURSO:'curso',DIAS:'dias',TURNO:'turno',INICIO:'inicio',TERMINO:'termino',SUPERVISOR:'supervisor',ALUNOS:'alunos',SITUACAO:'situacao',QTDCERT:'qtdCert',QTDDECL:'qtdDecl',QTDEFET:'qtdEfet',QTDDESLIG:'qtdDeslig',QTDSEMDIR:'qtdSemDir',OBS:'obs',OBSERVACOES:'obs',ANO:'ano'};
  if(exact[n])return exact[n];
  if(n.includes('QUANT')||n.startsWith('QTD')){if(n.includes('CERTIFIC'))return 'qtdCert';if(n.includes('DECLARAC'))return 'qtdDecl';if(n.includes('DIREITO'))return 'qtdSemDir';if(n.includes('EFETIV'))return 'qtdEfet';if(n.includes('DESLIG'))return 'qtdDeslig';}
  if(n.includes('MUNICIP'))return 'municipio';if(n.includes('CURSO'))return 'curso';if(n.includes('ALUNO'))return 'alunos';if(n.includes('INICIO'))return 'inicio';if(n.includes('TERMINO'))return 'termino';if(n.includes('DIAS'))return 'dias';if(n.includes('SUPERVISOR'))return 'supervisor';if(n.includes('SITUAC'))return 'situacao';
  if(n.includes('DADOS')&&n.includes('PESQUISA'))return 'proc_dados';if(n.includes('TABULAC'))return 'proc_tabulacao';if(n.includes('PESQUISA'))return 'proc_pesquisa';if(n.includes('FRENTE')||n.includes('LISTA'))return 'proc_frente';if(n.includes('MALA'))return 'proc_mala';if(n.includes('PROTOCOLO'))return 'proc_protocolos';if(n==='DECLARACOES'||n==='PROCDECLARACOES')return 'proc_declaracoes';
  return Object.keys(PROCESSES).find(k=>norm(k).replace(/[^A-Z0-9]/g,'')===n)||null;
}
let importWorkbook=null,importSheets=[],importSheetIndex=0;
async function readSheet(file){
  try{
    if(!file)return;if(file.size>30*1024*1024)throw Error('Arquivo acima de 30 MB.');
    feedback('Lendo a planilha no seu dispositivo...');
    const XLSX=await loadXlsx();importWorkbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,cellFormula:false});
    importSheets=importWorkbook.SheetNames;if(!importSheets.length)throw Error('Planilha sem abas.');
    importSource=file.name;importSheetIndex=0;previewSheet();
  }catch(e){feedback('Importação não realizada: '+e.message,true);}
}
function previewSheet(){
  try{
    const XLSX=globalThis.XLSX,name=importSheets[importSheetIndex];importYear=Number(name.match(/20\d{2}/)?.[0]||state.year||new Date().getFullYear());
    const matrix=XLSX.utils.sheet_to_json(importWorkbook.Sheets[name],{header:1,defval:'',raw:true});
    const headIndex=matrix.findIndex(row=>row.some(v=>column(v)==='municipio'));
    if(headIndex<0)throw Error('Cabeçalho Município não encontrado nesta aba.');
    const headers=matrix[headIndex].map(column),mapped=[];
    for(const row of matrix.slice(headIndex+1)){const r={};headers.forEach((k,i)=>{if(k)r[k]=row[i]??'';});if(!String(r.municipio||'').trim())continue;
      for(const key of ['inicio','termino']){const original=r[key];r[key]=iso(original,true);if(original&&!r[key])throw Error('Data não reconhecida em '+r.municipio);}
      if(r.situacao && !STATUS.some(s=>norm(s)===norm(r.situacao)))r.obs=[r.obs,`Situação original: ${String(r.situacao).trim()}`].filter(Boolean).join('\n');
      mapped.push(cleanRecord(r,importYear));
    }
    if(mapped.length>50000)throw Error('Limite de 50.000 turmas por importação.');
    pendingImport=mapped;
    showModal(`${head('Conferir importação',importSource)}<div class="import-options"><label>Aba <select id="import-sheet">${importSheets.map((n,i)=>`<option value="${i}"${i===importSheetIndex?' selected':''}>${esc(n)}</option>`).join('')}</select></label><label>Ano de referência <input id="import-year" type="number" min="2018" max="2099" value="${importYear}" style="width:95px"></label></div><div class="import-summary"><strong>${mapped.length} turmas válidas</strong> · Prévia das primeiras 15 · Duplicatas serão ignoradas</div><div class="preview-table"><table><thead><tr><th>Turma</th><th>Início</th><th>Término</th><th>Alunos</th><th>Cert.</th><th>Situação</th></tr></thead><tbody>${mapped.slice(0,15).map(r=>`<tr><td>${esc(r.municipio)}</td><td>${dateLabel(r.inicio)}</td><td>${dateLabel(r.termino)}</td><td>${r.alunos??'—'}</td><td>${r.qtdCert??'—'}</td><td>${badge(r.situacao)}</td></tr>`).join('')}</tbody></table></div><p class="notes">O ano sugerido vem do nome da aba. Se você alterar o ano acima, ele será aplicado a todas as turmas desta importação. Quantitativos em branco são preservados.</p><div class="dialog-footer"><button class="button" data-action="close">Cancelar</button><button class="button primary" data-action="confirm-import"${!mapped.length?' disabled':''}>Importar ${mapped.length} turmas</button></div>`);
  }catch(e){feedback(e.message,true);pendingImport=[];}
}
function recordKey(r){return JSON.stringify([r.ano,norm(r.numero),norm(r.municipio),norm(r.curso),r.inicio]);}
function confirmImport(){
  const year=Number($('import-year').value);if(!Number.isInteger(year)||year<2018||year>2099){feedback('Informe um ano entre 2018 e 2099.',true);return;}
  const keys=new Set(state.records.map(recordKey));let added=0,skipped=0;
  for(const r of pendingImport){r.ano=year;const key=recordKey(r);if(keys.has(key)){skipped++;continue;}keys.add(key);state.records.push(r);added++;}
  state.year=String(year);state.page=1;closeModal();changed();feedback(`${added} turma(s) importada(s). ${skipped} duplicata(s) ignorada(s). Referência: ${year}.`);
}
const EXPORT_COLS=['ano','numero','municipio','curso','dias','turno','inicio','termino','supervisor','alunos','situacao','qtdCert','qtdDecl','qtdEfet','qtdDeslig','qtdSemDir','obs',...Object.keys(PROCESSES)];
const EXPORT_LABELS=['Ano','Nº','Município','Curso','Dias','Turno','Início','Término','Supervisor','Alunos','Situação','Quant. de Certificados','Quant. Declarações','Quant. de Efetivados','Quant. de Desligados','Quant. que não tem direito','Observações',...Object.values(PROCESSES)];
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(){const rows=filtered();download('\ufeff'+[EXPORT_COLS,...rows.map(r=>EXPORT_COLS.map(k=>r[k]??''))].map(row=>row.map(csvCell).join(';')).join('\r\n'),'turmas-sobef.csv','text/csv;charset=utf-8');feedback(`CSV preparado: ${rows.length} turma(s) do filtro atual.`);}
async function exportXlsx(){
  try{const XLSX=await loadXlsx(),rows=filtered(),wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([EXPORT_LABELS,...rows.map(r=>EXPORT_COLS.map(k=>r[k]??''))]);ws['!cols']=EXPORT_COLS.map(k=>({wch:k==='curso'?60:k==='municipio'?40:k==='obs'?45:19}));ws['!autofilter']={ref:ws['!ref']};
    XLSX.utils.book_append_sheet(wb,ws,'Turmas');const summary=[['RESUMO DO FILTRO ATUAL'],['Gerado em',new Date().toLocaleString('pt-BR')],['Ano',state.year||'Todos'],['Turmas',rows.length],['Alunos',sum(rows,'alunos')],['Certificados',sum(rows,'qtdCert')],['Declarações',sum(rows,'qtdDecl')],['Efetivados',sum(rows,'qtdEfet')],['Desligados',sum(rows,'qtdDeslig')],['Sem direito',sum(rows,'qtdSemDir')],[],...STATUS.map((s,i)=>[LABELS[i],rows.filter(r=>r.situacao===s).length])];const res=XLSX.utils.aoa_to_sheet(summary);res['!cols']=[{wch:30},{wch:25}];XLSX.utils.book_append_sheet(wb,res,'Resumo');download(XLSX.write(wb,{bookType:'xlsx',type:'array'}),'turmas-sobef.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');feedback(`Excel preparado: ${rows.length} turma(s). A aba Resumo usa o mesmo filtro.`);
  }catch(e){feedback('Não foi possível exportar: '+e.message,true);}
}
function toggleTheme(){const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('theme').setAttribute('aria-pressed',String(dark));$('theme').innerHTML=icon(dark?'sun':'moon')+`<span>Modo ${dark?'claro':'escuro'}</span>`;icons();}
async function action(name){
  if(name==='import'){$('input-sheet').value='';$('input-sheet').click();}
  if(name==='close')closeModal();
  if(name==='backup')backup();
  if(name==='restore'){$('input-backup').value='';$('input-backup').click();}
  if(name==='connect')await connectFile();
  if(name==='clear'){Object.assign(state,{query:'',status:'',supervisor:'',course:'',turno:'',start:'',end:'',min:'',page:1});state.selected.clear();render();}
  if(name==='confirm-import')confirmImport();
  if(name==='export-csv')exportCsv();
  if(name==='export-xlsx')await exportXlsx();
  if(name==='theme')toggleTheme();
  if(name==='delete-selected'){const n=state.selected.size;if(n&&await ask(`Excluir ${n} turma(s) selecionada(s)?\nEsta ação remove os registros desta base. Salve um backup se precisar recuperá-los.`)){state.records=state.records.filter(r=>!state.selected.has(r.id));state.selected.clear();changed();feedback(`${n} turma(s) excluída(s).`);}}
  if(name==='print'){
    navigate('classes');const rows=filtered();const container=document.createElement('section');container.id='print-report';container.innerHTML=`<h2>SOBEF · Relatório de turmas</h2><p>${esc(new Date().toLocaleString('pt-BR'))} · Ano: ${state.year||'Todos'} · ${rows.length} turmas no filtro</p><table><thead><tr><th>Nº</th><th>Turma</th><th>Término</th><th>Alunos</th><th>Cert.</th><th>Decl.</th><th>Situação</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.numero)}</td><td>${esc(r.municipio)}</td><td>${dateLabel(r.termino)}</td><td>${r.alunos??''}</td><td>${r.qtdCert??''}</td><td>${r.qtdDecl??''}</td><td>${esc(r.situacao)}</td></tr>`).join('')}</tbody></table>`;container.style.display='none';document.body.append(container);const style=document.createElement('style');style.textContent='@media print{body> *:not(#print-report){display:none!important}#print-report{display:block!important}}';document.head.append(style);window.print();container.remove();style.remove();feedback('Impressão solicitada. Se a janela não abrir na prévia, utilize o GitHub Pages diretamente ou exporte para Excel.');
  }
  if(name==='open-local'){try{const [handle]=await window.showOpenFilePicker({types:[{description:'Backup SOBEF',accept:{'application/json':['.json']}}]});await restoreFile(await handle.getFile(),handle);}catch(e){if(e.name!=='AbortError')feedback('Não foi possível abrir: '+e.message,true);}}
  if(name==='create-local'){try{const handle=await window.showSaveFilePicker({suggestedName:'base-sobef.json',types:[{description:'Backup SOBEF',accept:{'application/json':['.json']}}]});const writer=await handle.createWritable();await writer.write(backupPayload());await writer.close();state.fileHandle=handle;state.dirty=false;saveNotice('Arquivo conectado: '+handle.name+'. Alterações serão gravadas neste arquivo.');closeModal();feedback('Arquivo local conectado.');}catch(e){if(e.name!=='AbortError')feedback('Não foi possível conectar: '+e.message,true);}}
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  try{
    if(b.dataset.view)navigate(b.dataset.view);
    if(b.dataset.action)await action(b.dataset.action);
    if(b.hasAttribute('data-status')){state.status=b.dataset.status;state.page=1;state.selected.clear();navigate('classes');}
    if(b.dataset.detail)detail(b.dataset.detail);
    if(b.dataset.edit)editRecord(b.dataset.edit);
    if(b.dataset.delete&&await ask('Excluir esta turma?\nSalve um backup antes se precisar recuperar o registro.')){state.records=state.records.filter(r=>r.id!==b.dataset.delete);state.selected.delete(b.dataset.delete);changed();feedback('Turma excluída.');}
    if(b.dataset.sort){if(state.sort===b.dataset.sort)state.dir*=-1;else{state.sort=b.dataset.sort;state.dir=1;}render();}
    if(b.dataset.page){state.page+=Number(b.dataset.page);render();}
    if(b.hasAttribute('data-month')){const n=Number(b.dataset.month);state.calendar=n?new Date(state.calendar.getFullYear(),state.calendar.getMonth()+n,1):new Date(new Date().getFullYear(),new Date().getMonth(),1);render();}
  }catch(err){feedback(err.message,true);}
});
document.addEventListener('input',e=>{
  if(e.target.id==='search'){const pos=e.target.selectionStart;state.query=e.target.value;state.page=1;state.selected.clear();render();$('search').focus();$('search').setSelectionRange(pos,pos);}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='year'){state.year=el.value;state.page=1;state.selected.clear();render();}
  if(el.dataset.filter){state[el.dataset.filter]=el.value;state.page=1;state.selected.clear();render();}
  if(el.dataset.select){if(el.checked)state.selected.add(el.dataset.select);else state.selected.delete(el.dataset.select);render();}
  if(el.id==='select-all'){for(const r of filtered().slice((state.page-1)*25,state.page*25))el.checked?state.selected.add(r.id):state.selected.delete(r.id);render();}
  if(el.id==='import-sheet'){importSheetIndex=Number(el.value);previewSheet();}
});
document.addEventListener('submit',e=>{
  if(e.target.id!=='class-form')return;e.preventDefault();const form=e.target;if(!form.reportValidity())return;
  try{const raw=Object.fromEntries(new FormData(form));if(!raw.municipio.trim()||!raw.curso.trim())throw Error('Preencha município e curso.');
    const existing=state.records.find(r=>r.id===raw.id),r=cleanRecord({...existing,...raw});
    if(r.inicio&&r.termino&&r.termino<r.inicio)throw Error('O término não pode ser anterior ao início.');
    r.updatedAt=new Date().toISOString();r.history=[...(existing?.history||[])];
    if(existing&&existing.situacao!==r.situacao)r.history.push({from:existing.situacao,to:r.situacao,date:new Date().toLocaleString('pt-BR')});
    if(existing)state.records[state.records.indexOf(existing)]=r;else state.records.push(r);
    closeModal();changed();feedback(`Turma ${existing?'atualizada':'cadastrada'}.${state.year&&String(r.ano)!==state.year?' Ela está em outro ano; altere o filtro para visualizá-la.':''}`);
  }catch(err){$('form-error').textContent=err.message;}
});
$('import').onclick=()=>action('import');$('new').onclick=()=>editRecord();$('backup').onclick=backup;$('connect-file').onclick=connectFile;$('theme').onclick=toggleTheme;
$('input-sheet').onchange=e=>readSheet(e.target.files[0]);
$('input-backup').onchange=async e=>{if(!e.target.files[0])return;try{await restoreFile(e.target.files[0]);}catch(err){feedback('Restauração não realizada: '+err.message,true);}};
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
navigate('overview');
