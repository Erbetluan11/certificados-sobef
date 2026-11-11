(() => {
'use strict';
const root='https://api.github.com/repos/Erbetluan11/certificados-sobef-dados';
let token='',branch='',sha=null,active=false,busy=false,blocked=false,baseline='',observed='',changedAt=0;
const snapshot=()=>JSON.stringify(state.records);
const encode=text=>{let out='';for(const byte of new TextEncoder().encode(text))out+=String.fromCharCode(byte);return btoa(out);};
const decode=text=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));
function init(){
 const actions=document.querySelector('.heading-actions');
 if(!actions||document.getElementById('gh-open'))return;
 const open=document.createElement('button');open.id='gh-open';open.type='button';open.className='button';open.textContent='Conectar ao GitHub';actions.append(open);
 const bar=document.createElement('div');bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');bar.style.cssText='margin:0 0 18px;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:var(--surface);white-space:pre-line';
 document.getElementById('feedback').before(bar);
 const dialog=document.createElement('dialog');dialog.style.width='min(560px,calc(100% - 24px))';dialog.setAttribute('aria-labelledby','gh-title');
 dialog.innerHTML=`<form><div class="dialog-head"><h2 id="gh-title">Sincronização GitHub</h2><button class="close-button" type="button" data-close aria-label="Fechar">×</button></div><div class="dialog-body"><p>Destino privado: Erbetluan11/certificados-sobef-dados / dados.json</p><p style="margin-top:12px">Ao conectar, carregaremos a base existente. Se o arquivo ainda não existir, a base desta aba será enviada automaticamente. Depois, alterações confirmadas nas turmas serão salvas após alguns segundos.</p><label class="field" style="margin-top:16px">Token<input id="gh-token" type="password" required autocomplete="off" autocapitalize="none" spellcheck="false"></label><p style="margin-top:12px;font-size:.8rem">Contents: Read and write, somente no repositório de dados. A credencial fica apenas na memória desta página. Reconecte após recarregar. Não use Conectar arquivo local simultaneamente.</p><p style="margin-top:12px">Em caso de conflito: baixe o backup das alterações locais antes de reconectar. Não há mesclagem automática nem atualização em tempo real entre computadores.</p><p id="gh-result" role="status" aria-live="polite" style="margin-top:16px;white-space:pre-line"></p></div><div class="dialog-footer"><button type="button" class="button danger" id="gh-disconnect">Desconectar</button><button type="button" class="button" data-close>Fechar</button><button class="button primary" type="submit">Conectar e ativar</button></div></form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),input=dialog.querySelector('#gh-token'),submit=dialog.querySelector('[type=submit]'),disconnect=dialog.querySelector('#gh-disconnect'),result=dialog.querySelector('#gh-result');
 function say(text,error=false){bar.textContent=text;result.textContent=text;bar.style.color=error?'var(--red)':'var(--text)';}
 function lock(value){busy=value;submit.disabled=value;input.disabled=value;disconnect.disabled=value;}
 function stop(){active=false;token='';branch='';sha=null;blocked=false;open.textContent='Conectar ao GitHub';}
 async function api(path,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{const response=await fetch(root+path,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,...options.headers},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
   if(!response.ok){const error=Error(({401:'Token inválido, expirado ou revogado.',403:'Permissão negada ou limite de API atingido.',404:'Arquivo/repositório indisponível. Confira acesso e permissão Contents.',409:'Conflito: outro computador alterou o arquivo.',422:'Gravação rejeitada. Pode haver conflito ou restrição no repositório.'})[response.status]||`Falha HTTP ${response.status}.`);error.status=response.status;throw error;}
   return await response.json();
  }finally{clearTimeout(timer);}
 }
 function validate(payload){
  if(!payload||payload.version!=='sobef_v4'||!Array.isArray(payload.records))throw Error('JSON incompatível: esperada uma base sobef_v4 com records.');
  const ids=new Set();
  return payload.records.map(raw=>{if(!raw||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(raw.id)||ids.has(raw.id))throw Error('JSON com identificadores inválidos ou duplicados.');ids.add(raw.id);return cleanRecord(raw);});
 }
 function fail(error){blocked=true;say('Sincronização pausada. '+(error.name==='AbortError'?'Tempo esgotado; a gravação pode ter sido recebida.':error.message)+' Baixe um backup local e reconecte para verificar o estado do GitHub. Não feche esta aba antes de preservar as alterações.',true);}
 async function save(){
  if(!active||busy||blocked)return;
  if(state.fileHandle){blocked=true;say('Sincronização pausada: arquivo local conectado. Salve um backup e recarregue antes de usar somente o GitHub.',true);return;}
  const sent=snapshot();if(sent===baseline)return;
  lock(true);say('Salvando no GitHub… Não feche esta aba.');
  try{
   const payload=JSON.stringify({version:'sobef_v4',exportedAt:new Date().toISOString(),records:JSON.parse(sent)},null,2);
   if(new TextEncoder().encode(payload).length>900000)throw Error('Base maior que o limite de 900 KB desta integração. Exporte o backup e migre para um banco de dados.');
   const body={message:'Atualiza dados compartilhados SOBEF',content:encode(payload),branch};if(sha)body.sha=sha;
   const data=await api('/contents/dados.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!data.content?.sha)throw Error('Resposta de gravação sem confirmação de versão.');
   sha=data.content.sha;baseline=sent;
   say(snapshot()===baseline?'Salvo no GitHub às '+new Date().toLocaleTimeString('pt-BR')+'.':'Há novas alterações aguardando salvamento.');
  }catch(error){fail(error);}finally{lock(false);}
 }
 open.addEventListener('click',()=>{input.value='';if(!dialog.open)dialog.showModal();input.focus();});
 dialog.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>dialog.close()));
 dialog.addEventListener('close',()=>{input.value='';});
 disconnect.addEventListener('click',()=>{if(busy)return;if(active&&snapshot()!==baseline&&!confirm('Há alterações não salvas no GitHub. Desconectar mantém os dados nesta aba, mas não os salva. Continuar?'))return;stop();say('GitHub desconectado. Salve um backup antes de fechar a página.');});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(document.getElementById('modal').open){say('Feche o formulário de turma/importação antes de conectar.',true);return;}
  if(state.fileHandle){say('Um arquivo local está conectado. Salve backup e recarregue antes de conectar ao GitHub.',true);return;}
  let candidate=input.value.trim();input.value='';if(!candidate)return;
  stop();token=candidate;candidate='';lock(true);say('Verificando repositório e carregando dados…');
  const before=snapshot();
  try{
   const metadata=await api('');
   if(metadata.full_name?.toLowerCase()!=='erbetluan11/certificados-sobef-dados'||metadata.private!==true)throw Error('Destino privado inesperado.');
   branch=metadata.default_branch;
   let remote=null;
   try{remote=await api('/contents/dados.json?ref='+encodeURIComponent(branch));}catch(error){if(error.status!==404)throw error;await api('/contents?ref='+encodeURIComponent(branch));}
   if(snapshot()!==before||document.getElementById('modal').open)throw Error('A base local mudou durante a conexão. Tente novamente sem editar turmas.');
   if(remote){
    if(remote.type!=='file'||remote.encoding!=='base64'||typeof remote.content!=='string'||remote.size>900000)throw Error('Arquivo remoto fora do formato ou limite aceito.');
    const rows=validate(JSON.parse(decode(remote.content)));
    if(before!==JSON.stringify(rows)&&state.records.length){
     if(!confirm('Existe uma base no GitHub diferente da base desta aba. Carregar substituirá a base local. OK baixa um backup local e carrega o GitHub; Cancelar preserva a aba sem ativar sincronização.'))throw Error('Carregamento cancelado. Dados locais preservados.');
     download(backupPayload(),'sobef-antes-de-carregar-'+Date.now()+'.json','application/json');
    }
    state.records=rows;state.selected.clear();state.page=1;state.year='';state.dirty=false;revision++;render();sha=remote.sha;baseline=snapshot();
   }else{sha=null;baseline='';}
   active=true;blocked=false;observed=snapshot();changedAt=Date.now();open.textContent='Conexão GitHub';
   say(remote?'Base carregada. Salvamento automático ativo. Outros computadores devem reconectar para carregar a versão mais recente.':'Arquivo ainda não encontrado. A base desta aba será salva como dados.json; se não houver permissão de leitura/gravação, a sincronização será pausada.');
  }catch(error){stop();say('Não foi possível ativar: '+(error.name==='AbortError'?'tempo esgotado.':error.message),true);}finally{lock(false);}
  if(active&&sha===null)await save();
 });
 setInterval(()=>{if(!active||busy||blocked)return;const current=snapshot();if(current!==observed){observed=current;changedAt=Date.now();say('Alterações pendentes: aguardando salvamento automático.');}if(current!==baseline&&Date.now()-changedAt>=4000)void save();},1000);
 window.addEventListener('beforeunload',event=>{if(busy||(active&&snapshot()!==baseline)){event.preventDefault();event.returnValue='';}});
 say('GitHub desconectado. Conecte para carregar dados e ativar o salvamento automático.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
