/* =====================================================================
   sistema.js — núcleo comum do Fila Hospitalar
   Usado pelas telas: triagem.html, fila-hospitalar.html e painel.html.

   Todas as telas leem e gravam o MESMO estado no armazenamento do
   navegador (localStorage). Quando uma tela grava, as outras abas
   recebem o evento "storage" e se redesenham sozinhas. Assim:
     triagem  ──admite──▶  fila  ──chama──▶  painel da TV
   A lógica da fila é a mesma do fila_hospitalar.py.
   ===================================================================== */
(function (global) {
  "use strict";

  const CAPACIDADE = 100;
  const NIVEIS = 5;
  const NOMES_RISCO = {5: "VERMELHO", 4: "LARANJA", 3: "AMARELO", 2: "VERDE", 1: "AZUL"};
  const DESC_RISCO = {5: "Emergência", 4: "Muito urgente", 3: "Urgente", 2: "Pouco urgente", 1: "Não urgente"};
  const TEMPO_MAXIMO = {5: 0, 4: 10, 3: 60, 2: 120, 1: 240};
  const ALERTAS = [
    ["inconsciente", "Inconsciente ou não responde", 5],
    ["convulsao", "Convulsão em andamento", 5],
    ["sangramento", "Sangramento intenso que não para", 5],
    ["peito", "Dor no peito", 4],
    ["ar", "Falta de ar intensa", 4],
    ["avc", "Fraqueza ou boca torta súbita", 4],
    ["vomito", "Vômitos persistentes", 3],
    ["trauma", "Trauma ou queda recente", 3]
  ];

  /* ---------- TAD Fila (FIFO) e fila de prioridade por baldes ---------- */
  class Fila {
    constructor(itens) { this.itens = itens || []; }
    vazia() { return this.itens.length === 0; }
    cheia() { return this.itens.length === CAPACIDADE; }
    tamanho() { return this.itens.length; }
    enfileirar(p) { if (this.cheia()) return false; this.itens.push(p); return true; }
    desenfileirar() { if (this.vazia()) return [false, null]; return [true, this.itens.shift()]; }
    frente() { if (this.vazia()) return [false, null]; return [true, this.itens[0]]; }
  }

  class FilaDePrioridade {
    constructor() {
      // baldes[1] = azul ... baldes[5] = vermelho; posição 0 não usada
      this.baldes = [null];
      for (let n = 1; n <= NIVEIS; n++) this.baldes.push(new Fila());
    }
    total() { let s = 0; for (let n = 1; n <= NIVEIS; n++) s += this.baldes[n].tamanho(); return s; }
    vazia() { return this.total() === 0; }
    inserir(p) { return this.baldes[p.risco].enfileirar(p); }
    proximo() {
      for (let n = NIVEIS; n >= 1; n--) if (!this.baldes[n].vazia()) return this.baldes[n].desenfileirar();
      return [false, null];
    }
    espiar() {
      for (let n = NIVEIS; n >= 1; n--) if (!this.baldes[n].vazia()) return this.baldes[n].frente();
      return [false, null];
    }
    ordem() {
      const out = [];
      for (let n = NIVEIS; n >= 1; n--) out.push(...this.baldes[n].itens);
      return out;
    }
  }

  /* ---------- Classificação (mesma regra de classificar_risco) ---------- */
  const fmtTemp = t => Number(t).toFixed(1).replace(".", ",");

  function classificarRisco(fc, sat, temp, dor) {
    let nivel = 1; const motivos = [];
    const marca = (n, txt) => { nivel = Math.max(nivel, n); motivos.push([n, txt]); };
    if (fc > 150 || fc < 40) marca(5, "FC " + fc + " bpm");
    else if (fc > 120) marca(4, "FC " + fc + " bpm");
    else if (fc > 100) marca(3, "FC " + fc + " bpm");
    if (sat < 85) marca(5, "SpO₂ " + sat + "%");
    else if (sat < 90) marca(4, "SpO₂ " + sat + "%");
    else if (sat < 94) marca(3, "SpO₂ " + sat + "%");
    const t = fmtTemp(temp) + " °C";
    if (temp >= 39.5 || temp <= 35.0) marca(5, "Temperatura " + t);
    else if (temp >= 38.5) marca(3, "Temperatura " + t);
    else if (temp >= 37.8) marca(2, "Temperatura " + t);
    if (dor >= 9) marca(4, "Dor " + dor + "/10");
    else if (dor >= 6) marca(3, "Dor " + dor + "/10");
    else if (dor >= 4) marca(2, "Dor " + dor + "/10");
    return { nivel, motivos };
  }

  /* Sinais vitais + sinais de alerta: vale o mais grave. alertas = lista de ids. */
  function triar(sinais, alertas) {
    const r = classificarRisco(sinais.fc, sinais.sat, sinais.temp, sinais.dor);
    (alertas || []).forEach(id => {
      const a = ALERTAS.find(x => x[0] === id);
      if (a) { r.nivel = Math.max(r.nivel, a[2]); r.motivos.push([a[2], a[1]]); }
    });
    r.motivos.sort((a, b) => b[0] - a[0]);
    return r;
  }

  /* ---------- Estado compartilhado entre as telas ---------- */
  const KEY = "fila-hospitalar-sistema-v2";
  const ev = new EventTarget();
  let canal = null;
  try { canal = new BroadcastChannel("fila-hospitalar"); } catch (e) { /* navegador sem suporte */ }

  let memoria = null; // usado se o navegador bloquear o localStorage

  function vazio() {
    return { fila: new FilaDePrioridade(), senha: 1, historico: [], ultimo: null, registros: [], rev: 0 };
  }

  function ler() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = memoria; }
    if (!d) d = memoria;
    const e = vazio();
    if (!d) return e;
    d.baldes.forEach((itens, i) => { e.fila.baldes[i + 1] = new Fila(itens); });
    e.senha = d.senha; e.historico = d.historico || []; e.ultimo = d.ultimo || null;
    e.registros = d.registros || []; e.rev = d.rev || 0;
    return e;
  }

  function gravar(e) {
    e.rev = (e.rev || 0) + 1;
    const d = { baldes: e.fila.baldes.slice(1).map(b => b.itens), senha: e.senha,
      historico: e.historico, ultimo: e.ultimo, registros: e.registros, rev: e.rev };
    memoria = d;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (err) { /* segue só em memória */ }
    try { canal && canal.postMessage(e.rev); } catch (err) {}
    ev.dispatchEvent(new Event("mudou")); // avisa a própria aba
  }

  /* Lê o estado mais recente, aplica a mudança e grava (evita perder o que outra aba fez). */
  function alterar(fn) { const e = ler(); const r = fn(e); gravar(e); return r; }

  /* Avisa quando QUALQUER tela mudar o estado (esta aba ou outra). */
  let ultimoRev = -1;
  function disparar() {
    const r = ler().rev;
    if (r === ultimoRev) return;
    ultimoRev = r;
    ev.dispatchEvent(new Event("externo"));
  }
  global.addEventListener("storage", ev2 => { if (ev2.key === KEY || ev2.key === null) disparar(); });
  if (canal) canal.onmessage = disparar;
  setInterval(disparar, 2000); // reserva, caso o navegador não entregue os eventos

  function aoMudar(cb) {
    ev.addEventListener("mudou", () => { ultimoRev = ler().rev; cb(); });
    ev.addEventListener("externo", cb);
  }

  /* ---------- Operações do sistema ---------- */

  /* Admite um paciente: grava o registro e coloca no fim do balde da sua cor. */
  function admitir(dados) {
    return alterar(e => {
      const r = triar(dados.sinais, dados.alertas);
      const p = {
        senha: e.senha, nome: dados.nome, idade: dados.idade || "", sexo: dados.sexo || "",
        queixa: dados.queixa || "", sinais: dados.sinais,
        alertas: (dados.alertas || []).map(id => (ALERTAS.find(a => a[0] === id) || [id, id])[1]),
        risco: r.nivel, motivos: r.motivos.map(m => m[1]),
        origem: dados.origem || "triagem", chegada: dados.chegada || Date.now()
      };
      if (!e.fila.inserir(p)) return { ok: false, erro: "Fila " + NOMES_RISCO[r.nivel] + " lotada (" + CAPACIDADE + " pacientes)." };
      e.senha++;
      e.registros.unshift(p);
      return { ok: true, paciente: p, posicao: e.fila.ordem().findIndex(x => x.senha === p.senha) + 1 };
    });
  }

  /* Retira o próximo da fila (mais grave; empate = quem chegou antes) e manda para o painel. */
  function chamarProximo(consultorio) {
    return alterar(e => {
      const [ok, p] = e.fila.proximo();
      if (!ok) return null;
      p.chamada = Date.now();
      p.consultorio = consultorio || 1;
      e.ultimo = p;
      e.historico.unshift(p);
      return p;
    });
  }

  /* Chama de novo o último paciente no painel (sem tirar ninguém da fila). */
  function rechamar() {
    return alterar(e => {
      if (!e.ultimo) return null;
      e.ultimo.rechamada = Date.now();
      if (e.historico[0] && e.historico[0].senha === e.ultimo.senha) e.historico[0].rechamada = e.ultimo.rechamada;
      return e.ultimo;
    });
  }

  function zerar() { const e = vazio(); e.rev = ler().rev; gravar(e); }

  /* Situação de um paciente pela senha: aguardando (com posição) ou chamado. */
  function situacao(e, senha) {
    const h = e.historico.find(p => p.senha === senha);
    if (h) return { estado: "chamado", paciente: h };
    const pos = e.fila.ordem().findIndex(p => p.senha === senha);
    if (pos >= 0) return { estado: "aguardando", posicao: pos + 1 };
    return { estado: "removido" };
  }

  function carregarExemplo() {
    const agora = Date.now(), min = 60000;
    const ex = [
      ["Ana Ribeiro",    "22", "Feminino",  "Dor de garganta",           [ 78, 98, 36.6, 2], [],        95],
      ["Bruno Carvalho", "34", "Masculino", "Febre há dois dias",        [108, 96, 37.2, 5], [],        70],
      ["Carla Menezes",  "41", "Feminino",  "Febre e calafrios",         [ 92, 93, 38.6, 3], [],        41],
      ["Fábio Nogueira", "29", "Masculino", "Torção no tornozelo",       [ 85, 97, 37.9, 4], ["trauma"], 33],
      ["Eduarda Lima",   "63", "Feminino",  "Palpitação",                [126, 95, 37.0, 7], [],        14],
      ["Gisele Prado",   "19", "Feminino",  "Renovação de receita",      [ 72, 99, 36.4, 1], [],        12],
      ["Diego Almeida",  "58", "Masculino", "Dor no peito e suor frio",  [168, 84, 37.1, 9], ["peito"],  4]
    ];
    ex.forEach(([nome, idade, sexo, queixa, [fc, sat, temp, dor], alertas, atras]) =>
      admitir({ nome, idade, sexo, queixa, sinais: { fc, sat, temp, dor }, alertas, origem: "exemplo", chegada: agora - atras * min }));
  }

  /* ---------- Utilitários de tela ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const hora = ms => new Date(ms).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"});
  const minutos = ms => Math.floor(ms / 60000);
  const fmtDur = min => min < 60 ? min + " min" : Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0");


  /* ---------- Aviso sonoro e voz (usados pelo painel e pela central) ---------- */
  const audio = (function () {
    let ligado = false, ctx = null, voz = null, vozFeminina = true;
    const temVoz = "speechSynthesis" in global;
    function escolherVoz() {
      if (!temVoz) return;
      const vs = speechSynthesis.getVoices().filter(v => /^pt/i.test(v.lang));
      // Prefere português do Brasil e VOZ FEMININA.
      // Femininas conhecidas: Francisca e Thalita (Edge/Windows), Maria (Windows),
      // Google português do Brasil (Chrome), Luciana e Fernanda (Mac/iPhone).
      const br = vs.filter(v => /pt[-_]BR/i.test(v.lang));
      const lista = br.length ? br : vs;
      const FEM = /francisca|thalita|maria|luciana|fernanda|leila|yara|manuela|brenda|elza|giovanna|leticia|let[ií]cia|raquel|vit[oó]ria|google/i;
      const MASC = /antonio|ant[oô]nio|daniel|felipe|donato|fabio|f[aá]bio|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|macerio/i;
      const fem = lista.filter(v => FEM.test(v.name) && !MASC.test(v.name));
      voz = fem.find(v => /natural|online/i.test(v.name)) || fem[0]
         || lista.find(v => !MASC.test(v.name)) || lista[0] || null;
      vozFeminina = !!voz && !MASC.test(voz.name);
    }
    if (temVoz) { escolherVoz(); speechSynthesis.onvoiceschanged = escolherVoz; }

    function bip() {
      if (!ligado) return;
      try {
        ctx = ctx || new (global.AudioContext || global.webkitAudioContext)();
        [[880, 0], [660, .28]].forEach(([f, t]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = f; o.type = "sine";
          g.gain.setValueAtTime(0, ctx.currentTime + t);
          g.gain.linearRampToValueAtTime(.35, ctx.currentTime + t + .03);
          g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .5);
          o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .55);
        });
      } catch (e) {}
    }
    const NUM = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
    const nomeFalado = n => { const p = String(n).trim().split(/\s+/); return p.length > 1 ? p[0] + " " + p[p.length - 1] : p[0]; };
    function falar(p) {
      if (!ligado || !temVoz || !p) return;
      const cons = p.consultorio || 1;
      const texto = "Senha " + p.senha + ". " + nomeFalado(p.nome) + ". Dirija-se ao consultório " + (NUM[cons] || cons) + ".";
      speechSynthesis.cancel();
      setTimeout(() => {   // espera o aviso sonoro terminar; fala duas vezes, como nos painéis de pronto-socorro
        [texto, texto].forEach(t => {
          const u = new SpeechSynthesisUtterance(t);
          u.lang = "pt-BR"; if (voz) u.voice = voz;
          u.rate = 0.92; u.pitch = vozFeminina ? 1.05 : 1.35; u.volume = 1;   // só voz masculina? tom mais agudo
          speechSynthesis.speak(u);
        });
      }, 700);
    }
    return {
      ligado: () => ligado,
      ligar(on) { ligado = !!on; if (ligado) bip(); else if (temVoz) speechSynthesis.cancel(); },
      bip,
      anunciar(p) { bip(); falar(p); },
      testar() { const e = ler(); this.anunciar(e.ultimo || { senha: 1, nome: "Maria Souza", consultorio: 1 }); }
    };
  })();

  /* Tela aberta dentro da central (uma aba só)? */
  const embutido = /[?&]embed\b/.test(global.location.search);

  /* Barra de navegação comum: liga as telas e mostra que estão sincronizadas. */
  const TELAS = [
    ["index.html", "Central (uma aba)"],
    ["triagem.html", "1 · Triagem"],
    ["fila-hospitalar.html", "2 · Fila e chamada"],
    ["painel.html", "3 · Painel da TV"]
  ];
  function nav(atual) {
    if (embutido) {
      // Na central, os links entre telas trocam a aba da central em vez de sair dela
      document.addEventListener("click", ev => {
        const a = ev.target.closest && ev.target.closest("a[href]");
        if (!a) return;
        const alvo = TELAS.find(t => a.getAttribute("href") === t[0]);
        if (alvo) { ev.preventDefault(); try { global.parent.postMessage({ abrir: alvo[0] }, "*"); } catch (e) {} }
      });
      return;
    }
    const css = document.createElement("style");
    css.textContent =
      ".sys-nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 4px;padding:8px 24px;background:var(--surface);border-bottom:1px solid var(--line);font-size:14px;position:sticky;top:0;z-index:20}" +
      ".sys-nav a{color:var(--muted);text-decoration:none;padding:6px 12px;border-radius:8px}" +
      ".sys-nav a:hover{background:var(--soft);color:var(--ink)}" +
      ".sys-nav a[aria-current]{background:var(--accent);color:var(--accent-ink);font-weight:700}" +
      ".sys-nav .sync{margin-left:auto;color:var(--muted);font-size:13px;display:flex;align-items:center;gap:6px}" +
      ".sys-nav .sync i{width:8px;height:8px;border-radius:50%;background:var(--r2,#2b8a3e);display:inline-block}" +
      ".sys-nav .sync.pulse i{animation:sysp .9s ease-out}" +
      "@keyframes sysp{from{box-shadow:0 0 0 6px rgb(43 138 62 / .35)}to{box-shadow:0 0 0 0 transparent}}" +
      "@media (max-width:600px){.sys-nav{padding:8px 12px}.sys-nav .sync{display:none}}";
    document.head.appendChild(css);
    const n = document.createElement("nav");
    n.className = "sys-nav"; n.setAttribute("aria-label", "Telas do sistema");
    n.innerHTML = TELAS.map(([href, txt]) =>
      '<a href="' + href + '"' + (href === atual ? ' aria-current="page"' : "") + ">" + txt + "</a>").join("") +
      '<span class="sync" id="sys-sync"><i></i><span></span></span>';
    document.body.prepend(n);
    const atualizar = () => {
      const e = ler();
      const s = document.getElementById("sys-sync");
      s.lastElementChild.textContent = "Sincronizado · " + e.fila.total() + " aguardando";
      s.classList.remove("pulse"); void s.offsetWidth; s.classList.add("pulse");
    };
    aoMudar(atualizar); atualizar();
  }

  global.Sistema = {
    CAPACIDADE, NIVEIS, NOMES_RISCO, DESC_RISCO, TEMPO_MAXIMO, ALERTAS,
    Fila, FilaDePrioridade, classificarRisco, triar,
    estado: ler, admitir, chamarProximo, rechamar, zerar, situacao, carregarExemplo, aoMudar, nav, audio, embutido, TELAS,
    esc, hora, minutos, fmtDur, fmtTemp
  };
})(window);
