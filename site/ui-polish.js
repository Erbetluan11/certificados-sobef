(() => {
'use strict';
function init(){
 const logs=document.querySelector('[data-view="logs"]');
 if(logs)logs.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();navigate('logs');},true);
 const style=document.createElement('style');style.textContent=`.eyebrow,#page-desc,.local-note,.main-footer{display:none!important}.heading{margin-bottom:20px}.topbar{min-height:44px;padding-block:10px}.heading-actions{align-items:center}.log-list p{font-size:var(--text-sm)}#sobef-toast{max-height:40dvh;overflow:auto}.sidebar-bottom{padding-top:16px}#gh-result{overflow-wrap:anywhere}@media(max-width:900px){.sidebar nav{grid-template-columns:repeat(5,minmax(0,1fr))}}`;document.head.append(style);
 const dialog=document.getElementById('gh-token')?.closest('dialog');
 if(dialog){const paragraphs=[...dialog.querySelectorAll('.dialog-body > p')];for(const p of paragraphs){const text=p.textContent;if(text.startsWith('Destino privado:'))p.textContent='Dados protegidos no repositório privado.';else if(text.startsWith('Ao conectar,'))p.textContent='Conecte para carregar a base e salvar alterações automaticamente.';else if(text.startsWith('Contents:'))p.textContent='Token com Contents: Read and write no repositório de dados.';else if(text.startsWith('Em caso de conflito:'))p.remove();}}
 const toast=document.getElementById('sobef-toast'),text=toast?.querySelector('span');
 if(!toast||!text)return;
 function compact(value){if(value.startsWith('Salvando no GitHub'))return 'Salvando alterações…';if(value.startsWith('Salvo no GitHub'))return value;if(value.startsWith('Base carregada.'))return 'Base carregada. Salvamento automático ativo.';if(value.startsWith('Alterações pendentes:'))return 'Alterações aguardando salvamento.';if(value.startsWith('Verificando repositório'))return 'Conectando ao GitHub…';if(value.startsWith('GitHub desconectado. Conecte'))return 'Conecte ao GitHub para carregar sua base.';return value;}
 function shorten(){const next=compact(text.textContent);if(next!==text.textContent)text.textContent=next;}
 new MutationObserver(shorten).observe(text,{childList:true,subtree:true,characterData:true});shorten();
 function place(){const target=document.querySelector('dialog[open]')||document.body;if(toast.parentElement!==target)target.append(toast);}
 new MutationObserver(place).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});document.addEventListener('close',place,true);place();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
