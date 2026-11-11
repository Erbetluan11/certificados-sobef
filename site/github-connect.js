(() => {
  'use strict';
  const owner = 'Erbetluan11', repo = 'certificados-sobef-dados';
  let token = '', active = false, controller = null, generation = 0;
  function init() {
    const actions = document.querySelector('.heading-actions');
    if (!actions || document.getElementById('gh-open')) return;
    const button = document.createElement('button');
    button.id = 'gh-open'; button.type = 'button'; button.className = 'button';
    button.textContent = 'Conectar ao GitHub'; actions.append(button);
    const dialog = document.createElement('dialog');
    dialog.style.width = 'min(540px, calc(100% - 24px))';
    dialog.setAttribute('aria-labelledby', 'gh-title');
    dialog.innerHTML = `<form><div class="dialog-head"><h2 id="gh-title">Conectar ao GitHub</h2><button type="button" class="close-button" data-close aria-label="Fechar">×</button></div><div class="dialog-body"><p>Teste de acesso ao repositório privado. Esta etapa não salva nem carrega turmas.</p><label class="field" style="margin-top:16px">Repositório<input readonly value="Erbetluan11/certificados-sobef-dados"></label><label class="field" style="margin-top:16px">Token<input id="gh-token" type="password" required autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="gh-help"></label><button type="button" class="text-button" id="gh-show" aria-pressed="false">Mostrar token</button><p id="gh-help" style="font-size:.8rem;color:var(--muted)">Use um token restrito a este repositório, com Contents: Read and write. O módulo não grava a credencial no armazenamento do navegador. Será necessário reconectar após recarregar.</p><p id="gh-result" role="status" aria-live="polite" style="margin-top:16px;white-space:pre-line;overflow-wrap:anywhere"></p></div><div class="dialog-footer"><button type="button" class="button danger" id="gh-disconnect" hidden>Desconectar</button><button type="button" class="button" data-close>Fechar</button><button type="submit" class="button primary">Testar e conectar</button></div></form>`;
    document.body.append(dialog);
    const form = dialog.querySelector('form'), input = dialog.querySelector('#gh-token');
    const result = dialog.querySelector('#gh-result'), submit = dialog.querySelector('[type=submit]');
    const show = dialog.querySelector('#gh-show'), disconnect = dialog.querySelector('#gh-disconnect');
    function clear() { input.value = ''; input.type = 'password'; show.textContent = 'Mostrar token'; show.setAttribute('aria-pressed', 'false'); }
    function busy(value) { input.disabled = value; show.disabled = value; submit.disabled = value; submit.textContent = value ? 'Verificando...' : 'Testar e conectar'; }
    function paint() { button.textContent = active ? 'Conexão GitHub' : 'Conectar ao GitHub'; disconnect.hidden = !active; }
    function cancel() { generation++; controller?.abort(); controller = null; busy(false); clear(); }
    button.addEventListener('click', () => { clear(); paint(); result.textContent = active ? 'Conexão validada. Sincronização de turmas ainda não ativada.' : ''; if (!dialog.open) dialog.showModal(); input.focus(); });
    dialog.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', cancel);
    show.addEventListener('click', () => { const visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; show.textContent = visible ? 'Ocultar token' : 'Mostrar token'; show.setAttribute('aria-pressed', String(visible)); });
    disconnect.addEventListener('click', () => { cancel(); token = ''; active = false; paint(); result.textContent = 'Desconectado. Credencial removida da memória do módulo.'; });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submit.disabled) return;
      let candidate = input.value.trim(); if (!candidate) return;
      clear(); busy(true); result.textContent = 'Verificando acesso...';
      const id = ++generation, request = new AbortController(); controller = request;
      const timer = setTimeout(() => request.abort(), 20000);
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${candidate}` }, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: request.signal });
        if (id !== generation) return;
        if (!response.ok) { const messages = {401:'Token inválido, expirado ou revogado.',403:'Acesso negado ou limite de solicitações atingido.',404:'Repositório não encontrado ou token sem acesso.',429:'Muitas solicitações. Aguarde e tente novamente.'}; throw Error(messages[response.status] || `Falha HTTP ${response.status}.`); }
        const data = await response.json(); if (id !== generation) return;
        if (data.full_name?.toLowerCase() !== `${owner}/${repo}`.toLowerCase() || data.private !== true) throw Error('O destino não corresponde ao repositório privado esperado.');
        token = candidate; active = true; paint();
        result.textContent = 'Conexão validada com o repositório privado.\nNenhum arquivo foi modificado.\nEste teste não comprova a permissão de gravação. O salvamento automático ainda não está ativado.';
      } catch (error) {
        if (id === generation) result.textContent = error.name === 'AbortError' ? 'Tempo esgotado. Tente novamente.' : error instanceof TypeError ? 'Falha de rede ao acessar o GitHub.' : error.message;
      } finally { candidate = ''; clearTimeout(timer); if (id === generation) { controller = null; busy(false); } }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
