(() => {
'use strict';
const themeKey='sobef-ui-theme',tokenKey='sobef-github-token-v1';
const get=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const remove=key=>{try{localStorage.removeItem(key);}catch{}};
function init(){
 const button=document.getElementById('theme');
 function theme(value){document.documentElement.dataset.theme=value;document.body.removeAttribute('data-theme');button.setAttribute('aria-pressed',String(value==='dark'));button.querySelector('span').textContent=value==='dark'?'Modo claro':'Modo escuro';}
 theme(get(themeKey)==='light'?'light':'dark');
 button.addEventListener('click',event=>{event.stopImmediatePropagation();const value=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem(themeKey,value);}catch{}},true);
 renderFiles=function(){document.getElementById('files').innerHTML=`<div class="files-grid"><article class="panel file-section"><h2>Importar</h2><p>Importações alteram a base e serão salvas se a conexão estiver ativa.</p><button class="button primary" data-action="import">Planilha</button><button class="button" data-action="restore">Backup JSON</button></article><article class="panel file-section"><h2>Backup</h2><p>Baixe uma cópia antes de resolver erros ou conflitos.</p><button class="button" data-action="backup">Baixar JSON</button></article><article class="panel file-section help"><h2>Ajuda</h2><details><summary>Salvamento e conflitos</summary><p>Aguarde a confirmação de salvamento. Sem conexão, os dados ficam apenas nesta aba. Não há atualização em tempo real entre computadores. Em caso de conflito, preserve um backup antes de reconectar.</p></details><details><summary>Conexão lembrada</summary><p>Opcional: guarda o token neste navegador. Use apenas em perfil de confiança; scripts do mesmo site podem acessá-lo. Desmarcar ou desconectar apaga a cópia local, mas não revoga nem renova o token no GitHub.</p></details></article></div>`;};
 if(state.view==='files')renderFiles();
 const input=document.getElementById('gh-token'),result=document.getElementById('gh-result');if(!input||!result)return;
 const form=input.closest('form'),dialog=form.closest('dialog'),disconnect=document.getElementById('gh-disconnect');
 const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;margin-top:16px';
 const remember=document.createElement('input');remember.type='checkbox';remember.checked=Boolean(get(tokenKey));remember.id='gh-remember';label.append(remember,document.createTextNode('Lembrar neste computador'));
 const warning=document.createElement('p');warning.style.cssText='font-size:.8rem;margin-top:8px;color:var(--muted)';warning.textContent='Opcional: salva o token no navegador. Use somente em perfil de confiança.';input.parentElement.after(label,warning);
 let pending='';
 remember.addEventListener('change',()=>{if(!remember.checked){pending='';remove(tokenKey);}});
 form.addEventListener('submit',()=>{if(form.querySelector('[type=submit]').disabled)return;pending=remember.checked?input.value.trim():'';if(!remember.checked)remove(tokenKey);},true);
 disconnect.addEventListener('click',()=>{if(disconnect.disabled)return;if(document.getElementById('gh-open').textContent==='Conectar ao GitHub'){pending='';remember.checked=false;remove(tokenKey);}});
 new MutationObserver(()=>{const text=result.textContent;if(text.startsWith('Base carregada.')||text.startsWith('Salvo no GitHub')){if(pending&&remember.checked){try{localStorage.setItem(tokenKey,pending);}catch{warning.textContent='Não foi possível lembrar a conexão neste navegador.';}}pending='';}else if(text.startsWith('Não foi possível ativar:')||text.startsWith('Sincronização pausada.')){pending='';if(text.includes('Token inválido')){remove(tokenKey);remember.checked=false;}}}).observe(result,{childList:true,subtree:true,characterData:true});
 let saved=get(tokenKey);if(saved){input.value=saved;form.requestSubmit();saved='';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
