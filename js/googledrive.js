/*
 * Sincronização opcional com o Google Drive.
 *
 * Como funciona (e por que precisa de um "Client ID" do Google Cloud):
 *  - O app é 100% local; aqui a gente só guarda uma CÓPIA do backup (o mesmo
 *    JSON do exportar/importar) numa pasta PRIVADA do app no Drive do usuário
 *    (escopo `drive.appdata` — invisível no Drive dele, o app não enxerga mais
 *    nada além do próprio arquivo).
 *  - Os dados vão DIRETO do navegador -> Google Drive. Nenhum servidor nosso
 *    participa. O "Client ID" é só a identidade do app perante o Google, pra
 *    ele mostrar a tela de consentimento; não é um segredo e não guarda dados.
 *
 * Precisa de: um OAuth Client ID (tipo "Aplicativo da Web") criado no Google
 * Cloud Console, com a origem do site (ex.: https://izacbertin.github.io e
 * http://localhost:8765) autorizada, e a "Google Drive API" ativada. O usuário
 * cola esse Client ID no app (fica salvo no localStorage) — nada de código.
 */
window.App = window.App || {};

App.gdrive = (function () {
  const GIS_SRC = 'https://accounts.google.com/gsi/client';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME = 'controle-financeiro.json';
  const CLIENT_ID_KEY = 'controleFinanceiroPessoal:gdriveClientId';
  const LAST_SYNC_KEY = 'controleFinanceiroPessoal:gdriveLastSync';

  // Client ID do app (identidade pública, NÃO é segredo — fica exposto no
  // código de qualquer app web). Vem embutido pra que o usuário final só
  // precise clicar em "Conectar com Google"; o campo de colar Client ID vira
  // só um override "Avançado" (localStorage) para quem quiser usar outro.
  const DEFAULT_CLIENT_ID = '162301481034-o6sj9q733cvp4dp2116qqjvb0fhh4osh.apps.googleusercontent.com';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpira = 0;      // epoch ms
  let gisPromise = null;    // carregamento do script do Google (uma vez só)
  let pendingToken = null;  // resolve/reject do requestAccessToken em andamento
  const listeners = [];

  // --- config (Client ID) -------------------------------------------------
  // Usa o override salvo (Avançado) ou, na falta dele, o embutido no app.
  function getClientId() {
    return (localStorage.getItem(CLIENT_ID_KEY) || '').trim() || DEFAULT_CLIENT_ID;
  }
  // Só o override informado pelo usuário (vazio = usando o embutido).
  function getClientIdOverride() {
    return (localStorage.getItem(CLIENT_ID_KEY) || '').trim();
  }
  function setClientId(id) {
    const limpo = (id || '').trim();
    if (limpo) localStorage.setItem(CLIENT_ID_KEY, limpo);
    else localStorage.removeItem(CLIENT_ID_KEY);
    // Trocar o Client ID invalida qualquer cliente/token já criado.
    tokenClient = null;
    accessToken = null;
    tokenExpira = 0;
    notify();
  }

  function getLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY) || '';
  }
  function marcarSync() {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    notify();
  }

  // --- estado/eventos -----------------------------------------------------
  function isConnected() {
    return !!accessToken && Date.now() < tokenExpira;
  }
  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } }); }

  // --- carregamento do Google Identity Services ---------------------------
  function carregarGIS() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('Não foi possível carregar o Google (você está online?).')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  function garantirTokenClient() {
    const clientId = getClientId();
    if (!clientId) throw new Error('Configure o Client ID do Google antes de conectar.');
    if (tokenClient) return tokenClient;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          // expires_in vem em segundos; guardamos com 1 min de folga.
          tokenExpira = Date.now() + ((Number(resp.expires_in) || 3600) - 60) * 1000;
          if (pendingToken) pendingToken.resolve(accessToken);
        } else if (pendingToken) {
          pendingToken.reject(new Error('Autorização não concluída.'));
        }
        pendingToken = null;
        notify();
      },
      error_callback: (err) => {
        if (pendingToken) pendingToken.reject(new Error((err && err.message) || 'Autorização cancelada.'));
        pendingToken = null;
      },
    });
    return tokenClient;
  }

  // Garante um token válido. `interativo` = pode abrir o popup do Google.
  function garantirToken(interativo) {
    if (isConnected()) return Promise.resolve(accessToken);
    return carregarGIS().then(() => new Promise((resolve, reject) => {
      const client = garantirTokenClient();
      pendingToken = { resolve, reject };
      // prompt '' tenta silencioso (reusa consentimento); 'consent' força a tela.
      client.requestAccessToken({ prompt: interativo ? '' : 'none' });
    }));
  }

  function connect() {
    return garantirToken(true).then(() => { notify(); return true; });
  }

  function disconnect() {
    const t = accessToken;
    accessToken = null;
    tokenExpira = 0;
    if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try { window.google.accounts.oauth2.revoke(t); } catch (e) { /* noop */ }
    }
    notify();
  }

  // --- chamadas à Drive API ----------------------------------------------
  function authHeaders(extra) {
    return Object.assign({ Authorization: `Bearer ${accessToken}` }, extra || {});
  }

  function acharArquivoId() {
    const url = 'https://www.googleapis.com/drive/v3/files'
      + '?spaces=appDataFolder&fields=files(id,name,modifiedTime)'
      + `&q=${encodeURIComponent(`name='${FILE_NAME}'`)}`;
    return fetch(url, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Falha ao consultar o Drive.'))))
      .then((j) => (j.files && j.files[0] ? j.files[0].id : null));
  }

  // Envia (cria ou atualiza) o backup no Drive.
  function upload(dataObj) {
    const corpo = JSON.stringify(dataObj);
    return garantirToken(true)
      .then(acharArquivoId)
      .then((fileId) => {
        if (fileId) {
          return fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: corpo,
          });
        }
        const meta = { name: FILE_NAME, parents: ['appDataFolder'] };
        const boundary = 'cfp_' + Math.abs(hashString(corpo)).toString(36);
        const multipart =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
          + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${corpo}\r\n--${boundary}--`;
        return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
          body: multipart,
        });
      })
      .then((r) => { if (!r.ok) throw new Error('Falha ao enviar para o Drive.'); marcarSync(); return true; });
  }

  // Baixa o backup do Drive (ou null se ainda não existe nenhum).
  function download() {
    return garantirToken(true)
      .then(acharArquivoId)
      .then((fileId) => {
        if (!fileId) return null;
        return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeaders() })
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Falha ao baixar do Drive.'))))
          .then((txt) => { marcarSync(); return JSON.parse(txt); });
      });
  }

  // Hash simples só pra gerar um boundary estável (não é segurança).
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }

  return {
    getClientId, getClientIdOverride, setClientId, getLastSync,
    isConnected, onChange,
    connect, disconnect, upload, download,
  };
})();
