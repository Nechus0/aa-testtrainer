/* =====================================================================
   Testtrainer · Auswahlverfahren höherer Auswärtiger Dienst
   Online-Fassung mit Benutzerkonten (Supabase)
   ===================================================================== */

const SB_URL = 'https://xuybdwxbyfdlvydspfgq.supabase.co';
const SB_KEY = 'sb_publishable_e5iNDQQqMvpH2TFWUiUvbQ_rWQqHnBk';
const sb = window.supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});
/* Kommt jemand ueber einen Wiederherstellungslink, wird die Anmeldung daraus
   uebernommen; der Hinweis fuehrt direkt zur Passwortvergabe. */
const WIEDERHERSTELLUNG = /type=recovery/.test(location.hash);

/* ---------- Fachliche Konstanten ---------- */
const KAT = {
  recht:      {name:'Völker-, Europa- und Staatsrecht', kurz:'Recht',      farbe:'#1c1c1c'},
  geschichte: {name:'Geschichte und Politik',           kurz:'Geschichte', farbe:'#b3121b'},
  wirtschaft: {name:'Wirtschaft',                       kurz:'Wirtschaft', farbe:'#8a6d0b'}
};
const KAT_FR = {name:'Sprachtest Französisch', kurz:'Französisch', farbe:'#1a4b8c'};
const ALLE = ['recht','geschichte','wirtschaft'];
const FR_TEIL = {
  textverstaendnis:{name:'Textverständnis', kurz:'Textverständnis', punkte:2, fragen:8,  zeit:900},
  wortschatz:      {name:'Wortschatz und Idiomatik', kurz:'Wortschatz', punkte:1, fragen:22, zeit:450},
  grammatik:       {name:'Grammatik und Zeitformen', kurz:'Grammatik',  punkte:1, fragen:22, zeit:450}
};
const FR_META = {dauer:1800, punkte:60, bestanden:30};
const PRUEFUNG = new Date('2026-09-01T09:00:00');
const LTR = ['A','B','C','D'];
const CACHE_FRAGEN = 'aa_fragen_cache_v2';
const CACHE_WARTE   = 'aa_warteschlange_v1';

/* ---------- Laufzeitzustand ---------- */
let PROFIL = null;                       // Zeile aus public.profile
let F = [], FR = [], ALLES = [], BY_ID = {};
let S = {antworten:[], sessions:[]};
let LAUF = null, TICK = null;
let ANSICHT = 'dash';

/* ---------- Helfer ---------- */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const M  = s => document.querySelector((LAUF?LAUF.mount:'body')+' '+s);
const MM = s => [...document.querySelectorAll((LAUF?LAUF.mount:'body')+' '+s)];
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const heute = ()=> new Date().toISOString().slice(0,10);
const pct = (a,b)=> b? Math.round(a/b*100) : 0;
const mmss = s => { s=Math.max(0,Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const datumKurz = iso => new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
const datumLang = iso => iso? new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '–';
const katName = k => k==='franzoesisch' ? KAT_FR.name  : (KAT[k]?.name||k);
const katKurz = k => k==='franzoesisch' ? KAT_FR.kurz  : (KAT[k]?.kurz||k);
const katFarbe= k => k==='franzoesisch' ? KAT_FR.farbe : (KAT[k]?.farbe||'#4f5661');
const mb = n => n==null? '–' : (n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(n/1024))+' kB');
const istAdmin = ()=> PROFIL && PROFIL.rolle==='admin';

function toast(m){
  const t=$('#toast'); if(!t) return;
  t.textContent=m; t.classList.add('on');
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'),3000);
}
function stemHtml(s){
  return esc(s).replace(/(\s[–-]\s*(?:kein|keine|keinen|nicht|falsch)\s*[–-]\s)/gi,
    m=>' <em>'+m.trim().replace(/^[–-]\s*|\s*[–-]$/g,'')+'</em> ');
}
function absatz(t){
  const s = String(t||'').replace(/\\n/g,'\n');       // auch maskierte Umbrueche beruecksichtigen
  return s.split(/\n{2,}/).map(a=>`<p>${esc(a).replace(/\n/g,' ')}</p>`).join('');
}
function fehlertext(e){
  const m = (e && (e.message||e.error_description||e.msg)) || String(e||'');
  if(/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
  if(/Email not confirmed/i.test(m))      return 'Das Konto ist noch nicht freigeschaltet.';
  if(/rate limit|too many/i.test(m))      return 'Zu viele Versuche. Bitte kurz warten.';
  if(/Failed to fetch|NetworkError/i.test(m)) return 'Keine Verbindung zum Server.';
  return m;
}

/* =====================================================================
   ANMELDUNG UND REGISTRIERUNG
   ===================================================================== */
function zeigeAnmeldung(){
  $('#app').style.display='none';
  $('#anmeldung').classList.add('on');
  $('#laden').classList.add('weg');
  const t = new URL(location.href).searchParams.get('einladung');
  if(t) formEinladung(t); else formLogin();
}

function tabsHtml(aktiv){
  return `<div class="tabs">
    <button data-t="login" class="${aktiv==='login'?'on':''}">Anmelden</button>
    <button data-t="neu" class="${aktiv==='neu'?'on':''}">Einladung einlösen</button>
  </div>`;
}
function tabsBinden(){
  $$('#a-inhalt .tabs button').forEach(b=>b.onclick=()=>{
    if(b.dataset.t==='login') formLogin(); else formEinladung('');
  });
}

function formLogin(hinweis){
  $('#a-inhalt').innerHTML = tabsHtml('login') + `
    ${hinweis?`<div class="hinweis gut" style="margin-top:22px">${esc(hinweis)}</div>`:''}
    <form id="f-login" autocomplete="on">
      <label class="fld">E-Mail<input type="email" id="l-mail" required autocomplete="username" inputmode="email"></label>
      <label class="fld">Passwort<input type="password" id="l-pw" required autocomplete="current-password"></label>
      <div id="l-fehler"></div>
      <button class="btn blk" type="submit" id="l-btn">Anmelden</button>
    </form>
    <p class="small mute" style="margin-top:20px">Ein Konto entsteht nur über einen Einladungslink. Wenn du einen bekommen hast, öffne ihn oder wechsle oben auf „Einladung einlösen“.</p>
    <p class="xs mute" style="margin-top:14px"><button class="link" id="l-reset" style="font-size:13px">Passwort vergessen?</button></p>`;
  tabsBinden();
  $('#f-login').onsubmit = async (e)=>{
    e.preventDefault();
    const b=$('#l-btn'); b.disabled=true; b.textContent='Anmelden …';
    const {error} = await sb.auth.signInWithPassword({email:$('#l-mail').value.trim(), password:$('#l-pw').value});
    if(error){
      $('#l-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(error))}</div>`;
      b.disabled=false; b.textContent='Anmelden'; return;
    }
    await starten();
  };
  $('#l-reset').onclick = async ()=>{
    const mail=$('#l-mail').value.trim();
    if(!mail){ toast('Bitte zuerst die E-Mail-Adresse eintragen.'); return; }
    const {error} = await sb.auth.resetPasswordForEmail(mail, {redirectTo: location.origin+location.pathname});
    $('#l-fehler').innerHTML = error
      ? `<div class="hinweis fehler">${esc(fehlertext(error))}</div>`
      : `<div class="hinweis">Falls für diese Adresse ein Konto besteht, ist eine E-Mail unterwegs. Kommt keine an, kann ein Administrator das Passwort direkt neu setzen.</div>`;
  };
}

async function formEinladung(token){
  $('#a-inhalt').innerHTML = tabsHtml('neu') + `
    <form id="f-neu">
      <label class="fld">Einladungscode<input id="e-token" value="${esc(token||'')}" required spellcheck="false" autocapitalize="off"></label>
      <div id="e-info"></div>
      <label class="fld">E-Mail<input type="email" id="e-mail" required autocomplete="username" inputmode="email"></label>
      <label class="fld">Name<input id="e-name" autocomplete="name" placeholder="optional"></label>
      <label class="fld">Passwort<input type="password" id="e-pw" required minlength="8" autocomplete="new-password"></label>
      <label class="fld">Passwort wiederholen<input type="password" id="e-pw2" required minlength="8" autocomplete="new-password"></label>
      <div id="e-fehler"></div>
      <button class="btn blk" type="submit" id="e-btn">Konto anlegen</button>
    </form>
    <p class="small mute" style="margin-top:20px">Es wird keine Bestätigungsmail verschickt. Nach dem Anlegen kannst du dich sofort anmelden.</p>`;
  tabsBinden();
  const pruefen = async ()=>{
    const t=$('#e-token').value.trim();
    if(!t){ $('#e-info').innerHTML=''; return; }
    const {data, error} = await sb.rpc('einladung_pruefen', {p_token:t});
    const r = Array.isArray(data)? data[0] : data;
    if(error || !r){ $('#e-info').innerHTML=`<div class="hinweis fehler">Code konnte nicht geprüft werden.</div>`; return; }
    if(!r.gueltig){ $('#e-info').innerHTML=`<div class="hinweis fehler">${esc(r.grund||'Einladung ungültig.')}</div>`; return; }
    $('#e-info').innerHTML=`<div class="hinweis gut">Einladung gültig${r.rolle==='admin'?' · Rolle: Administrator':''}.</div>`;
    if(r.email){ $('#e-mail').value=r.email; $('#e-mail').readOnly=true; }
  };
  $('#e-token').onchange = pruefen;
  if(token) pruefen();

  $('#f-neu').onsubmit = async (e)=>{
    e.preventDefault();
    if($('#e-pw').value !== $('#e-pw2').value){
      $('#e-fehler').innerHTML='<div class="hinweis fehler">Die beiden Passwörter stimmen nicht überein.</div>'; return;
    }
    const b=$('#e-btn'); b.disabled=true; b.textContent='Konto wird angelegt …';
    $('#e-fehler').innerHTML='';
    try{
      const r = await fetch(SB_URL+'/functions/v1/registrieren', {
        method:'POST', headers:{'Content-Type':'application/json', apikey:SB_KEY},
        body: JSON.stringify({token:$('#e-token').value.trim(), email:$('#e-mail').value.trim(),
                              passwort:$('#e-pw').value, name:$('#e-name').value.trim()})
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.fehler || j.error || 'Registrierung fehlgeschlagen.');
      const {error} = await sb.auth.signInWithPassword({email:$('#e-mail').value.trim(), password:$('#e-pw').value});
      if(error){ formLogin('Konto angelegt. Bitte melde dich jetzt an.'); return; }
      history.replaceState(null,'',location.pathname);
      await starten();
    }catch(x){
      $('#e-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(x))}</div>`;
      b.disabled=false; b.textContent='Konto anlegen';
    }
  };
}

async function abmelden(){
  await sb.auth.signOut();
  localStorage.removeItem(fortschrittSchluessel());
  location.href = location.pathname;
}

/* =====================================================================
   DATEN LADEN
   ===================================================================== */
const fortschrittSchluessel = ()=> 'aa_fortschritt_'+(PROFIL?PROFIL.id:'anon');

function frAufbereiten(texte, fragen){
  const byText = {};
  for(const t of texte) byText[t.id]=t;
  return fragen.map(q=>{
    const t = q.text_id ? byText[q.text_id] : null;
    return {
      id:q.id, kategorie:'franzoesisch', teil:q.teil, block:q.block,
      thema:q.thema || (FR_TEIL[q.teil]?.kurz||''), frage:q.frage,
      optionen:q.optionen, loesung:q.loesung, erlaeuterung:q.erlaeuterung,
      punkte: q.teil==='textverstaendnis' ? 2 : 1,
      textId: t? t.id : undefined, titel: t? t.titel : undefined,
      quelle: t? t.quelle : undefined, text: t? t.text : undefined
    };
  });
}

function poolSetzen(fachfragen, frTexte, frFragen){
  F  = (fachfragen||[]).filter(q=>KAT[q.kategorie]);
  FR = frAufbereiten(frTexte||[], frFragen||[]);
  ALLES = F.concat(FR);
  BY_ID = Object.fromEntries(ALLES.map(q=>[q.id,q]));
}

async function alleZeilen(tabelle, spalten){
  const out=[]; const schritt=1000;
  for(let von=0;;von+=schritt){
    const {data, error} = await sb.from(tabelle).select(spalten).range(von, von+schritt-1);
    if(error) throw error;
    out.push(...data);
    if(data.length < schritt) break;
  }
  return out;
}

async function ladeFragen(){
  try{
    const [fach, texte, frf] = await Promise.all([
      alleZeilen('frage','id,kategorie,block,thema,frage,optionen,loesung,erlaeuterung,schwierigkeit,stand'),
      alleZeilen('fr_text','id,block,titel,quelle,text'),
      alleZeilen('fr_frage','id,teil,text_id,block,thema,frage,optionen,loesung,erlaeuterung,schwierigkeit,stand')
    ]);
    poolSetzen(fach, texte, frf);
    try{ localStorage.setItem(CACHE_FRAGEN, JSON.stringify({ts:Date.now(), fach, texte, frf})); }catch(e){}
    return true;
  }catch(e){
    try{
      const c = JSON.parse(localStorage.getItem(CACHE_FRAGEN)||'null');
      if(c){ poolSetzen(c.fach, c.texte, c.frf); toast('Offline – Fragen aus dem Zwischenspeicher.'); return true; }
    }catch(x){}
    return false;
  }
}

async function ladeFortschritt(){
  try{
    const [a, d] = await Promise.all([
      alleZeilen('antwort','frage_id,kat,gewaehlt,richtig,datum,ts'),
      alleZeilen('durchgang','id,datum,ts,titel,n,richtig,quote,punkte,max_punkte,dauer,kats')
    ]);
    S.antworten = a.map(r=>({id:r.frage_id, kat:r.kat, gew:r.gewaehlt, ok:r.richtig, datum:r.datum, ts:r.ts}))
                   .sort((x,y)=>String(x.ts).localeCompare(String(y.ts)));
    S.sessions  = d.map(r=>({datum:r.datum, ts:r.ts, titel:r.titel, n:r.n, richtig:r.richtig, quote:r.quote,
                             punkte:r.punkte, maxPunkte:r.max_punkte, dauer:r.dauer, kats:r.kats||[]}))
                   .sort((x,y)=>String(x.ts).localeCompare(String(y.ts)));
    try{ localStorage.setItem(fortschrittSchluessel(), JSON.stringify(S)); }catch(e){}
  }catch(e){
    try{
      const c = JSON.parse(localStorage.getItem(fortschrittSchluessel())||'null');
      if(c){ S = c; }
    }catch(x){}
  }
}

/* Nicht gespeicherte Durchgänge zwischenlagern und später nachreichen */
function warteschlange(){ try{ return JSON.parse(localStorage.getItem(CACHE_WARTE)||'[]'); }catch(e){ return []; } }
function warteschlangeSetzen(a){ try{ localStorage.setItem(CACHE_WARTE, JSON.stringify(a)); }catch(e){} }

async function durchgangSpeichern(sess, antworten){
  const nutzer = PROFIL.id;
  const {data, error} = await sb.from('durchgang').insert({
    nutzer, datum:sess.datum, ts:sess.ts, titel:sess.titel, n:sess.n, richtig:sess.richtig,
    quote:sess.quote, punkte:sess.punkte, max_punkte:sess.maxPunkte, dauer:sess.dauer, kats:sess.kats
  }).select('id').single();
  if(error) throw error;
  if(antworten.length){
    const rows = antworten.map(a=>({nutzer, durchgang:data.id, frage_id:a.id, kat:a.kat,
                                    gewaehlt:a.gew, richtig:a.ok, datum:a.datum, ts:a.ts}));
    for(let i=0;i<rows.length;i+=200){
      const {error:e2} = await sb.from('antwort').insert(rows.slice(i,i+200));
      if(e2) throw e2;
    }
  }
}

async function warteschlangeAbarbeiten(){
  const w = warteschlange();
  if(!w.length || !PROFIL) return;
  const rest=[];
  for(const p of w){
    try{ await durchgangSpeichern(p.sess, p.antworten); }
    catch(e){ rest.push(p); }
  }
  warteschlangeSetzen(rest);
  if(w.length && !rest.length) toast('Zwischengespeicherte Ergebnisse wurden übertragen.');
}

async function sichern(sess, neueAntworten){
  try{
    await durchgangSpeichern(sess, neueAntworten);
  }catch(e){
    const w = warteschlange(); w.push({sess, antworten:neueAntworten}); warteschlangeSetzen(w);
    toast('Kein Netz – das Ergebnis wird später übertragen.');
  }
  try{ localStorage.setItem(fortschrittSchluessel(), JSON.stringify(S)); }catch(e){}
}

/* =====================================================================
   GERÜST DER ANSICHTEN
   ===================================================================== */
/* Oben stehen die Übungsbereiche, alles Verwaltende liegt im Klappmenü. */
const HAUPT = [['dash','Dashboard'], ['train','Trainer'],
               ['archiv','Fehlerarchiv'], ['pool','Fragenpool']];
const menuPunkte = ()=> istAdmin()
  ? [['konto','Konto','Zugang und Installation'], null,
     ['quellen','Quellen','Grundlage der Fragen'], ['nutzer','Nutzer','Konten und Einladungen']]
  : [['konto','Konto','Zugang und Installation']];

function navBauen(){
  const imMenu = menuPunkte().filter(Boolean).some(p=>p[0]===ANSICHT);
  $('#nav').innerHTML = HAUPT.map(([v,t])=>
      `<button data-v="${v}" class="${v===ANSICHT?'on':''}">${t}</button>`).join('')
    + `<button class="mehr${imMenu?' on':''}" id="nav-mehr" aria-haspopup="true" aria-expanded="false">${
        istAdmin()?'Verwaltung':'Konto'}<span class="pfeil">▼</span></button>`;
  $('#navpop').innerHTML = (istAdmin()? '<div class="kopfzeile">Verwaltung</div>':'')
    + menuPunkte().map(p=> p===null ? '<div class="trenner"></div>'
        : `<button data-v="${p[0]}" class="${p[0]===ANSICHT?'on':''}">${p[1]}<i>${p[2]}</i></button>`).join('');
  $$('#nav button[data-v]').forEach(b=>b.onclick=()=>{ menuZu(); go(b.dataset.v); });
  $$('#navpop button').forEach(b=>b.onclick=()=>{ menuZu(); go(b.dataset.v); });
  $('#nav-mehr').onclick = (e)=>{ e.stopPropagation(); menuUm(); };
}
function menuZu(){
  $('#navpop').classList.remove('offen');
  const b=$('#nav-mehr'); if(b){ b.classList.remove('offen'); b.setAttribute('aria-expanded','false'); }
}
function menuUm(){
  const p=$('#navpop'), b=$('#nav-mehr');
  const auf = !p.classList.contains('offen');
  p.classList.toggle('offen', auf); b.classList.toggle('offen', auf);
  b.setAttribute('aria-expanded', auf?'true':'false');
}
document.addEventListener('click', (e)=>{
  const p=$('#navpop');
  if(p && p.classList.contains('offen') && !p.contains(e.target)) menuZu();
});
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') menuZu(); });

function schaleBauen(){
  $('#v-dash').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Auswahlverfahren</div>
      <div class="row">
        <div style="flex:1;min-width:280px">
          <h1>Dashboard</h1>
          <p class="lead" id="dash-lead">Dein Stand in den drei Fachtests des schriftlichen Auswahlverfahrens.</p>
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:8px">Schriftlicher Teil</div>
          <div class="cd"><span class="n" id="cd-n">–</span><span class="u" id="cd-u"></span></div>
          <div class="small mute" style="margin-top:8px">Dienstag, 1. September 2026</div>
        </div>
      </div>
    </div>
    <div class="wrap">
      <div class="sec" style="margin-top:0">
        <div class="sec-h"><h2>Fragen des Tages</h2><span class="note" id="tag-note"></span></div>
        <div id="tagesaufgaben"></div>
      </div>
      <div class="grid g4" id="kpis" style="margin-top:56px"></div>
      <div class="sec">
        <div class="sec-h"><h2>Fachtests</h2><span class="note">je 25 Fragen in 10 Minuten</span></div>
        <div class="grid g3" id="katcards"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Sprachtest Französisch</h2><span class="note">60 Punkte, bestanden ab 30</span></div>
        <div id="frcard"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Verlauf</h2><span class="note">Trefferquote je Tag</span></div>
        <div class="card pad"><div id="chart"></div><div class="legend" id="chartleg"></div></div>
      </div>
      <div class="sec">
        <div class="grid g2">
          <div>
            <div class="sec-h"><h2>Schwächste Themenfelder</h2><span class="note">nach Fehlern</span></div>
            <div class="card" id="weak"></div>
          </div>
          <div>
            <div class="sec-h"><h2>Letzte Durchgänge</h2></div>
            <div class="card" id="sessions"></div>
          </div>
        </div>
      </div>
    </div>`;

  $('#train-menu').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Üben</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Trainer</h1>
        <p class="lead">Stell dir zusammen, was du üben willst: Bereiche, Umfang, Auswahl und Zeitdruck. Darunter die Prüfungssimulationen im Originalformat.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="sec" style="margin-top:0">
        <div class="sec-h"><h2>Training zusammenstellen</h2><span class="note" id="tr-note"></span></div>
        <div class="card pad" id="trainer"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Prüfungssimulation</h2><span class="note">Originalformat mit Prüfungszeit</span></div>
        <div class="modes" id="modes-exam"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Alle Tagespakete</h2><span class="note" id="pakete-note"></span></div>
        <div class="card" id="pakete"></div>
      </div>
    </div>`;

  $('#v-archiv').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Wiederholung</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Fehlerarchiv</h1>
        <p class="lead">Alles, was du zuletzt falsch beantwortet hast. Wer hier aufräumt, gewinnt die meisten Punkte.</p>
      </div></div>
    </div>
    <div class="wrap"><div id="archivbox"></div></div>`;

  $('#v-pool').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Bestand</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Fragenpool</h1>
        <p class="lead">Alle Fragen zum Nachschlagen, mit Lösung und Erläuterung – und wie weit der Lehrplan abgedeckt ist.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="sec" style="margin-top:0;margin-bottom:44px">
        <div class="sec-h"><h2>Abdeckung des Lehrplans</h2><span class="note" id="lp-note"></span></div>
        <div id="lehrplan"></div>
      </div>
      <div class="card pad" style="display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:26px">
        <label class="fld" style="flex:1;min-width:220px">Suche
          <input type="search" id="q-search" placeholder="Stichwort, Norm, Begriff …"></label>
        <label class="fld" style="flex:1;min-width:150px">Kategorie<select id="q-kat"></select></label>
        <label class="fld" style="flex:1;min-width:150px">Abschnitt<select id="q-block"></select></label>
        <span class="small mute" id="q-count" style="padding-bottom:12px"></span>
      </div>
      <div id="poollist"></div>
    </div>`;

  $('#v-quellen').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Verwaltung</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Quellen</h1>
        <p class="lead">Grundlage für die täglich neu erzeugten Fragen – geordnet nach den drei Fachtests, dem Sprachtest und dem Verfahren selbst.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="card pad" style="display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:26px">
        <label class="fld" style="flex:1;min-width:220px">Suche<input type="search" id="qu-suche" placeholder="Titel oder Dateiname"></label>
        <label class="fld" style="flex:1;min-width:170px">Prüfungsteil<select id="qu-kat"></select></label>
        <label class="fld" style="flex:1;min-width:160px">Prüfungsbezug<select id="qu-stufe">
          <option value="">alle</option><option value="kern">Kernquellen</option>
          <option value="ergaenzend">Ergänzungen</option><option value="abseits">ohne Bezug</option></select></label>
        <label class="fld" style="flex:1;min-width:130px">Datei<select id="qu-datei">
          <option value="">alle</option><option value="ja">hochgeladen</option><option value="nein">fehlt</option></select></label>
        <button class="btn sm" id="qu-neu">Quelle hinzufügen</button>
      </div>
      <div id="qu-stat" class="small mute" style="margin-bottom:18px"></div>
      <div id="qu-liste"></div>
    </div>`;

  $('#v-nutzer').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Verwaltung</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Nutzer</h1>
        <p class="lead">Konten, Rollen und Einladungslinks. Neue Zugänge entstehen ausschließlich über einen Link.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="sec" style="margin-top:0">
        <div class="sec-h"><h2>Einladung erzeugen</h2></div>
        <div class="card pad">
          <div style="display:flex;gap:16px;align-items:end;flex-wrap:wrap">
            <label class="fld" style="flex:2;min-width:220px">E-Mail<input type="email" id="ei-mail" placeholder="optional – bindet die Einladung an eine Adresse"></label>
            <label class="fld" style="flex:1;min-width:140px">Rolle<select id="ei-rolle"><option value="nutzer">Nutzer</option><option value="admin">Administrator</option></select></label>
            <label class="fld" style="flex:1;min-width:120px">Gültig (Tage)<input type="number" id="ei-tage" value="21" min="1" max="365"></label>
            <button class="btn" id="ei-los">Link erzeugen</button>
          </div>
          <div id="ei-ergebnis"></div>
        </div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Konten</h2><span class="note" id="nu-note"></span></div>
        <div class="card" id="nu-liste"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Offene Einladungen</h2></div>
        <div class="card" id="ei-liste"></div>
      </div>
    </div>`;

  $('#v-konto').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Persönlich</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Konto</h1>
        <p class="lead">Zugang, Fortschritt und Installation auf dem Telefon.</p>
      </div></div>
    </div>
    <div class="wrap" style="max-width:820px"><div id="konto-inhalt"></div></div>`;
}

/* ---------- Countdown ---------- */
function countdown(){
  const t=Math.max(0, PRUEFUNG-new Date());
  const d=Math.floor(t/864e5), h=Math.floor(t/36e5)%24;
  const n=$('#cd-n'); if(!n) return;
  n.textContent = t? d : 0;
  $('#cd-u').textContent = t? (d===1?'Tag':'Tage')+' und '+h+' Std' : 'Tage';
}

/* ---------- Router ---------- */
function go(v){
  ANSICHT=v;
  navBauen();
  $$('.view').forEach(s=>s.classList.toggle('on', s.id==='v-'+v));
  window.scrollTo({top:0});
  if(v==='dash') renderDash();
  if(v==='train'){ if(!LAUF || LAUF.phase==='ergebnis'){ LAUF=null; renderMenu(); } }
  if(v==='archiv') renderArchiv();
  if(v==='pool') renderPool();
  if(v==='quellen') renderQuellen();
  if(v==='nutzer') renderNutzer();
  if(v==='konto') renderKonto();
}

/* =====================================================================
   AUSWERTUNG
   ===================================================================== */
const letzteJeFrage = ()=>{ const m={}; for(const a of S.antworten) m[a.id]=a; return m; };
function statsKat(k){
  const as = S.antworten.filter(a=>a.kat===k), l = letzteJeFrage();
  const eind = Object.values(l).filter(a=>a.kat===k);
  return { versuche:as.length, quote:pct(as.filter(a=>a.ok).length, as.length),
           gesehen:eind.length, pool:F.filter(q=>q.kategorie===k).length,
           offen:F.filter(q=>q.kategorie===k && !l[q.id]).length };
}
function streak(){
  const tage=[...new Set(S.sessions.map(s=>s.datum))].sort().reverse();
  if(!tage.length) return 0;
  let n=0, d=new Date(heute());
  if(tage[0]!==heute()){ d.setDate(d.getDate()-1); if(tage[0]!==d.toISOString().slice(0,10)) return 0; }
  for(;;){ const iso=d.toISOString().slice(0,10); if(tage.includes(iso)){n++; d.setDate(d.getDate()-1);} else break; }
  return n;
}
const falscheOffen = (pool)=>{ const l=letzteJeFrage(); return (pool||F).filter(q=> l[q.id] && !l[q.id].ok); };
function statsFr(){
  const as=S.antworten.filter(a=>a.kat==='franzoesisch'), l=letzteJeFrage();
  const eind=Object.values(l).filter(a=>a.kat==='franzoesisch');
  const pkt=(arr)=>arr.reduce((n,a)=>n+(a.ok?(BY_ID[a.id]?.punkte||1):0),0);
  const max=(arr)=>arr.reduce((n,a)=>n+(BY_ID[a.id]?.punkte||1),0);
  const sess=S.sessions.filter(x=>x.kats.includes('franzoesisch'));
  return {versuche:as.length, quote:pct(as.filter(a=>a.ok).length,as.length),
          gesehen:eind.length, pool:FR.length, offen:FR.filter(q=>!l[q.id]).length,
          punkte:pkt(eind), maxPunkte:max(eind), letzte:sess.at(-1)||null};
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function renderDash(){
  countdown();
  const vn = (PROFIL?.name||'').trim().split(/\s+/)[0];
  $('#dash-lead').textContent = (vn? vn+', d':'D')+'ein Stand in den drei Fachtests des schriftlichen Auswahlverfahrens.';
  const ges=S.antworten.length, ok=S.antworten.filter(a=>a.ok).length, l=letzteJeFrage();
  const gesehen = Object.keys(l).length;
  const heutigeSess = S.sessions.filter(s=>s.datum===heute()).length;
  const kpi=[
    ['Trefferquote', ges? pct(ok,ges)+'<span> %</span>':'–', ges? ok+' von '+ges+' Antworten':'noch keine Antwort'],
    ['Bearbeitet', gesehen+'<span> / '+ALLES.length+'</span>', (ALLES.length-gesehen)+' noch nie gesehen'],
    ['Durchgänge', S.sessions.length, heutigeSess? heutigeSess+' heute':'heute noch keiner'],
    ['Lernserie', streak()+'<span> Tage</span>', streak()>=1?'in Folge trainiert':'heute starten']
  ];
  $('#kpis').innerHTML = kpi.map(k=>`<div class="card kpi"><div class="lab">${k[0]}</div><div class="val">${k[1]}</div><div class="sub">${k[2]}</div></div>`).join('');

  $('#katcards').innerHTML = ALLE.map(k=>{
    const s=statsKat(k), K=KAT[k];
    const sess=S.sessions.filter(x=>x.kats.includes(k)).slice(-5);
    const trend = sess.length>=2 ? (sess.at(-1).quote - sess[0].quote) : null;
    return `<div class="card pad k-${k}">
      <div class="tag">${K.kurz}</div>
      <h3 style="margin:14px 0 22px;min-height:50px">${esc(K.name)}</h3>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">
        <span style="font-size:38px;font-weight:700;letter-spacing:-.035em;color:${s.versuche?'var(--ink)':'var(--muted-2)'}" class="tnum">${s.versuche? s.quote:'–'}</span>
        <span class="mute" style="font-size:17px">${s.versuche?'%':''}</span>
        ${trend!==null?`<span style="margin-left:auto;font-size:14px;color:${trend>0?'var(--ok)':trend<0?'var(--bad)':'var(--muted-2)'}">${trend>0?'▲':trend<0?'▼':'▬'} ${Math.abs(trend)} Pp.</span>`:''}
      </div>
      <div class="meter"><i style="width:${s.versuche?s.quote:0}%"></i></div>
      <div class="xs mute" style="margin-top:16px;display:flex;gap:20px">
        <span><b style="color:var(--ink)" class="tnum">${s.gesehen}</b> / ${s.pool} bearbeitet</span>
        <span><b style="color:var(--ink)" class="tnum">${s.offen}</b> offen</span>
      </div></div>`;
  }).join('');

  tagesaufgaben(); frcard(); chart(); weak(); sessionsListe();
}

/* ---------- Fragen des Tages ----------
   Vier Aufgaben je Tag: die drei Fachtests und der Sprachtest. Alle ohne
   Zeitdruck – das Original bildet nur die Prüfungssimulation nach. */
function tagesaufgaben(){
  const box=$('#tagesaufgaben'); if(!box) return;
  const l=letzteJeFrage();
  const tagF=neuesteTage()[0], tagFr=frTage()[0];
  const posten=[];
  if(tagF) for(const k of ALLE){
    const qs=F.filter(q=>q.block===tagF && q.kategorie===k);
    if(qs.length) posten.push({kls:k, marke:KAT[k].kurz, name:KAT[k].name, block:tagF, qs,
      cfg:{typ:'block', block:tagF, kat:k, zeit:0, titel:KAT[k].kurz+' · '+tagF}});
  }
  if(tagFr){
    const qs=FR.filter(q=>q.block===tagFr);
    if(qs.length) posten.push({kls:'franzoesisch', marke:KAT_FR.kurz, name:'Sprachtest Französisch', block:tagFr, qs,
      cfg:{typ:'frBlockAlle', block:tagFr, zeit:0, titel:'Französisch · '+tagFr}});
  }
  if(!posten.length){
    $('#tag-note').textContent='';
    box.innerHTML='<div class="card"><div class="empty">Noch kein Tagesabschnitt vorhanden. Der nächste kommt morgen früh um 6 Uhr.</div></div>';
    return;
  }
  const offenGesamt = posten.reduce((a,p)=>a+p.qs.filter(q=>!l[q.id]).length, 0);
  const gesamt = posten.reduce((a,p)=>a+p.qs.length, 0);
  $('#tag-note').textContent = offenGesamt
    ? offenGesamt+' von '+gesamt+' Fragen offen'
    : 'alle '+gesamt+' Fragen erledigt';

  box.innerHTML =
    (offenGesamt===0 ? `<div class="banner" style="margin-bottom:20px"><b>Pensum für heute erledigt.</b>
        Alle ${gesamt} Fragen aus ${esc(posten[0].block)} sind bearbeitet.</div>`:'')
    + `<div class="grid g4">${posten.map((p,i)=>{
        const auf=p.qs.filter(q=>l[q.id]).length, n=p.qs.length;
        const ok=p.qs.filter(q=>l[q.id]&&l[q.id].ok).length;
        const fertig = auf===n;
        return `<div class="card pad tagpost k-${p.kls}${fertig?' fertig':''}">
          <div class="tagkopf">
            <span class="tag">${esc(p.marke)}</span>
            ${fertig?'<span class="haken" title="erledigt">✓</span>':''}
          </div>
          <h3 style="margin:12px 0 6px;font-size:17px">${esc(p.name)}</h3>
          <div class="xs mute">${esc(p.block)} · ${n} Fragen</div>
          <div class="meter" style="margin:16px 0 10px"><i style="width:${Math.round(auf/n*100)}%"></i></div>
          <div class="xs mute" style="margin-bottom:18px">${fertig
            ? '<b style="color:var(--ok)">erledigt</b> · '+ok+' von '+n+' richtig'
            : '<b style="color:var(--ink)">'+auf+'</b> von '+n+' bearbeitet'}</div>
          <button class="btn ${fertig?'ghost':''} blk" data-tag="${i}">${fertig?'Wiederholen':'Starten'}</button>
        </div>`;
      }).join('')}</div>`;

  $$('#tagesaufgaben [data-tag]').forEach(b=>b.onclick=()=>start(posten[+b.dataset.tag].cfg));
}

function frcard(){
  const s=statsFr(), l=s.letzte;
  const hoch = l && l.maxPunkte ? Math.round(l.punkte/l.maxPunkte*FR_META.punkte) : null;
  $('#frcard').innerHTML=`<div class="card pad k-franzoesisch" style="display:flex;gap:32px;align-items:center;flex-wrap:wrap">
    <div style="min-width:200px">
      <div class="tag">Französisch</div>
      ${!s.versuche? `<div class="xs mute" style="margin-top:16px"><b style="color:var(--ink)" class="tnum">0</b> / ${s.pool} bearbeitet</div>` : `
      <div style="display:flex;align-items:baseline;gap:10px;margin:14px 0 12px">
        <span style="font-size:38px;font-weight:700;letter-spacing:-.035em;color:var(--ink)" class="tnum">${s.quote}</span>
        <span class="mute" style="font-size:17px">%</span>
      </div>
      <div class="meter"><i style="width:${s.quote}%"></i></div>
      <div class="xs mute" style="margin-top:14px"><b style="color:var(--ink)" class="tnum">${s.gesehen}</b> / ${s.pool} bearbeitet · <b style="color:var(--ink)" class="tnum">${s.offen}</b> offen</div>`}
    </div>
    <div style="flex:1;min-width:240px">
      ${l ? `<div class="small mute">Letzter Durchgang · ${esc(l.titel)}</div>
        <div style="font-size:27px;font-weight:700;color:var(--ink);letter-spacing:-.02em;margin-top:6px" class="tnum">${l.punkte} von ${l.maxPunkte} Punkten</div>
        ${l.maxPunkte===FR_META.punkte ? `<div class="verdict ${l.punkte>=FR_META.bestanden?'ja':'nein'}">${l.punkte>=FR_META.bestanden?'Bestanden':'Nicht bestanden'} · Grenze ${FR_META.bestanden} Punkte</div>`
          : `<div class="small mute" style="margin-top:8px">Hochgerechnet auf den vollen Test: rund ${hoch} von ${FR_META.punkte} Punkten</div>`}`
        : '<div class="small mute">Noch kein Sprachtest absolviert. Der vollständige Testlauf dauert 30 Minuten.</div>'}
    </div>
    <button class="btn ghost" id="zu-fr">Zum Trainer</button></div>`;
  $('#zu-fr').onclick=()=>{
    TR.bereiche=new Set(['textverstaendnis','wortschatz','grammatik']);
    go('train');
  };
}

function chart(){
  const tage=[...new Set(S.sessions.map(s=>s.datum))].sort(), box=$('#chart');
  if(!tage.length){ box.innerHTML='<div class="empty">Sobald du den ersten Durchgang abgeschlossen hast, erscheint hier dein Verlauf.</div>'; $('#chartleg').innerHTML=''; return; }
  /* Auf dem Telefon ein schmaleres Koordinatensystem, damit Schrift und Punkte gross genug bleiben */
  const eng = window.innerWidth < 720;
  const W = eng? 380 : 1000, H = eng? 250 : 260;
  const fs = eng? 15 : 13, rad = eng? 5 : 4, dick = eng? 3 : 2.4;
  const P = eng? {t:14,r:10,b:32,l:34} : {t:16,r:18,b:34,l:42};
  const iw=W-P.l-P.r, ih=H-P.t-P.b;
  const x=i=> P.l + (tage.length>1 ? i/(tage.length-1)*iw : iw/2);
  const y=v=> P.t + (100-v)/100*ih;
  let g='';
  for(let v=0;v<=100;v+=25){
    g+=`<line x1="${P.l}" y1="${y(v)}" x2="${W-P.r}" y2="${y(v)}" stroke="#e6e9ec" stroke-width="1"/>`;
    g+=`<text x="${P.l-8}" y="${y(v)+fs*0.36}" text-anchor="end" font-size="${fs}" fill="#6b7581">${v}</text>`;
  }
  const step=Math.ceil(tage.length/(eng?5:9));
  tage.forEach((t,i)=>{ if(i%step===0||i===tage.length-1){
    const anker = i===0? 'start' : (i===tage.length-1? 'end' : 'middle');
    g+=`<text x="${x(i)}" y="${H-8}" text-anchor="${anker}" font-size="${fs}" fill="#6b7581">${datumKurz(t)}</text>`; } });
  let leg='';
  for(const k of ALLE.concat('franzoesisch')){
    const pts=[];
    tage.forEach((t,i)=>{ const r=S.antworten.filter(a=>a.kat===k && a.datum===t);
      if(r.length) pts.push([x(i), y(pct(r.filter(a=>a.ok).length,r.length)), pct(r.filter(a=>a.ok).length,r.length)]); });
    if(!pts.length) continue;
    const c=katFarbe(k);
    if(pts.length>1) g+=`<polyline fill="none" stroke="${c}" stroke-width="${dick}" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p=>p[0]+','+p[1]).join(' ')}"/>`;
    g+=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${rad}" fill="#fff" stroke="${c}" stroke-width="${dick}"><title>${katKurz(k)}: ${p[2]} %</title></circle>`).join('');
    leg+=`<span><i style="background:${c}"></i>${katKurz(k)}</span>`;
  }
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Trefferquote im Zeitverlauf">${g}</svg>`;
  $('#chartleg').innerHTML=leg;
}

function themenfeld(q){
  const t=(q.thema||'').trim();
  if(!t) return q.kategorie==='franzoesisch' ? (FR_TEIL[q.teil]?.kurz||'Französisch') : 'Ohne Thema';
  return (t.split(/\s[–—-]\s/)[0]||t).trim();
}
let WEAK_ALLE=false;
function weak(){
  const m={};
  for(const a of S.antworten){
    const q=BY_ID[a.id]; if(!q) continue;
    const feld=themenfeld(q), key=q.kategorie+'|'+feld;
    (m[key]=m[key]||{feld, kat:q.kategorie, n:0, ok:0});
    m[key].n++; if(a.ok) m[key].ok++;
  }
  const alle=Object.values(m).filter(v=>v.ok<v.n)
    .sort((a,b)=>(b.n-b.ok)-(a.n-a.ok) || (a.ok/a.n)-(b.ok/b.n) || b.n-a.n);
  if(!alle.length){ $('#weak').innerHTML='<div class="empty">Noch keine Schwächen erkennbar – oder noch zu wenige Antworten.</div>'; return; }
  const zeige = WEAK_ALLE ? alle.slice(0,14) : alle.slice(0,5);
  $('#weak').innerHTML = zeige.map(v=>{
    const q=pct(v.ok,v.n);
    return `<div class="feld k-${v.kat}">
      <span class="sq" title="${esc(katKurz(v.kat))}"></span>
      <span class="nm" title="${esc(katKurz(v.kat))} · ${esc(v.feld)}">${esc(v.feld)}</span>
      <span class="bar"><i style="width:${q}%"></i></span>
      <span class="qt" style="color:${q<50?'var(--bad)':'var(--gold)'}">${q} %</span>
      <span class="ct">${v.n-v.ok} ✕</span></div>`;
  }).join('') + (alle.length>5
    ? `<div class="morerow"><button class="link" id="weak-more">${WEAK_ALLE?'Weniger anzeigen':'Alle '+alle.length+' Themenfelder anzeigen'}</button></div>` : '');
  const b=$('#weak-more'); if(b) b.onclick=()=>{ WEAK_ALLE=!WEAK_ALLE; weak(); };
}

function sessionsListe(){
  const rows=S.sessions.slice(-9).reverse();
  $('#sessions').innerHTML = rows.length
    ? `<div class="tabelle"><table style="min-width:300px"><thead><tr><th style="width:60px">Datum</th><th>Durchgang</th><th style="width:76px">Ergebnis</th><th style="width:62px">Zeit</th></tr></thead><tbody>${
        rows.map(s=>`<tr><td class="mute tnum">${datumKurz(s.datum)}</td><td>${esc(s.titel)}</td>
        <td class="tnum" style="font-weight:700;color:${s.quote>=70?'var(--ok)':s.quote>=50?'var(--gold)':'var(--bad)'}">${s.richtig}/${s.n}</td>
        <td class="tnum mute">${mmss(s.dauer)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty">Noch kein Durchgang abgeschlossen.</div>';
}

/* =====================================================================
   TRAINING – Menüs
   ===================================================================== */
const frTage = ()=> [...new Set(FR.map(q=>q.block).filter(b=>b.startsWith('Tag ')))]
  .sort((a,b)=>parseInt(b.slice(4))-parseInt(a.slice(4)));
const frTeilFragen = t => FR.filter(q=>q.teil===t);
const neuesteTage = ()=> [...new Set(F.map(q=>q.block).filter(b=>b.startsWith('Tag ')))]
  .sort((a,b)=>parseInt(b.slice(4))-parseInt(a.slice(4)));

function karte(o){
  return `<button class="mode" data-mode='${esc(JSON.stringify(o.cfg))}'>
    ${o.kicker?`<div class="kicker">${esc(o.kicker)}</div>`:''}
    <h3>${esc(o.t)}</h3><p>${esc(o.p)}</p>
    <div class="meta">${o.meta.map(m=>`<em>${esc(m)}</em>`).join('')}</div>
    <span class="go">→</span></button>`;
}

/* =====================================================================
   TRAINER – frei zusammenstellbares Training
   ===================================================================== */
const BEREICHE = [
  {id:'recht',            gruppe:'fach', kls:'recht',        name:'Völker-, Europa- und Staatsrecht', kurz:'Recht'},
  {id:'geschichte',       gruppe:'fach', kls:'geschichte',   name:'Geschichte und Politik',            kurz:'Geschichte'},
  {id:'wirtschaft',       gruppe:'fach', kls:'wirtschaft',   name:'Wirtschaft',                        kurz:'Wirtschaft'},
  {id:'textverstaendnis', gruppe:'fr',   kls:'franzoesisch', name:'Textverständnis',                   kurz:'Textverständnis'},
  {id:'wortschatz',       gruppe:'fr',   kls:'franzoesisch', name:'Wortschatz und Idiomatik',          kurz:'Wortschatz'},
  {id:'grammatik',        gruppe:'fr',   kls:'franzoesisch', name:'Grammatik und Zeitformen',          kurz:'Grammatik'}
];
const AUSWAHL = [
  {id:'alle',   name:'Alles gemischt',   erl:'Zufällig aus dem gesamten Bestand der gewählten Bereiche.'},
  {id:'neu',    name:'Nur neue Fragen',  erl:'Nur was du noch nie beantwortet hast.'},
  {id:'fehler', name:'Fehler wiederholen', erl:'Nur Fragen, die du zuletzt falsch hattest – der wirksamste Teil.'},
  {id:'schwach',name:'Schwächste Themen', erl:'Bevorzugt Themenfelder mit der niedrigsten Trefferquote.'}
];
let TR = {bereiche:new Set(['recht','geschichte','wirtschaft']), auswahl:'alle', anzahl:25, zeit:false};

function trBereichFragen(id){
  const b = BEREICHE.find(x=>x.id===id);
  return b.gruppe==='fach' ? F.filter(q=>q.kategorie===id) : FR.filter(q=>q.teil===id);
}
function trPool(){
  const l=letzteJeFrage();
  let pool=[...TR.bereiche].flatMap(trBereichFragen);
  if(TR.auswahl==='neu')    pool=pool.filter(q=>!l[q.id]);
  if(TR.auswahl==='fehler') pool=pool.filter(q=>l[q.id] && !l[q.id].ok);
  if(TR.auswahl==='schwach'){
    const feld={};
    for(const a of S.antworten){ const q=BY_ID[a.id]; if(!q) continue;
      const s=q.kategorie+'|'+themenfeld(q); (feld[s]=feld[s]||{n:0,ok:0}); feld[s].n++; if(a.ok) feld[s].ok++; }
    const schwach=new Set(Object.entries(feld).filter(([,v])=>v.ok/v.n < 0.7).map(([s])=>s));
    const eng=pool.filter(q=>schwach.has(q.kategorie+'|'+themenfeld(q)));
    if(eng.length) pool=eng;
  }
  return pool;
}
/* Prüfungszeit: 25 Fachfragen in 10 Minuten, Französisch nach Teilbudget. */
function trZeit(n){
  const nurFr = [...TR.bereiche].every(id=>BEREICHE.find(b=>b.id===id).gruppe==='fr');
  return Math.max(60, Math.round(n * (nurFr ? 1800/52 : 24)));
}

function renderTrainer(){
  const box=$('#trainer'); if(!box) return;
  const l=letzteJeFrage();
  const pool=trPool();
  const max=pool.length;
  if(TR.anzahl>max) TR.anzahl=max;
  if(TR.anzahl<1 && max) TR.anzahl=Math.min(25,max);
  const stufen=[10,25,50,75,100].filter(n=>n<=max);
  const nurFr = [...TR.bereiche].every(id=>BEREICHE.find(b=>b.id===id).gruppe==='fr');

  box.innerHTML = `
    <div class="tr-block">
      <div class="tr-lab">Bereiche <span>${TR.bereiche.size} von ${BEREICHE.length} gewählt</span></div>
      <div class="chips">
        ${['fach','fr'].map(g=>`<div class="chipgruppe">
          <span class="chiptitel">${g==='fach'?'Fachtests':'Sprachtest Französisch'}</span>
          ${BEREICHE.filter(b=>b.gruppe===g).map(b=>{
            const qs=trBereichFragen(b.id);
            const off=qs.filter(q=>!l[q.id]).length;
            return `<button class="chip k-${b.kls}${TR.bereiche.has(b.id)?' an':''}" data-bereich="${b.id}">
              <i></i>${esc(b.kurz)}<em>${qs.length}${off?' · '+off+' offen':''}</em></button>`;
          }).join('')}
          <button class="chip alle" data-gruppe="${g}">${
            BEREICHE.filter(b=>b.gruppe===g).every(b=>TR.bereiche.has(b.id))?'keine':'alle'}</button>
        </div>`).join('')}
      </div>
    </div>

    <div class="tr-block">
      <div class="tr-lab">Auswahl</div>
      <div class="optionen">
        ${AUSWAHL.map(a=>{
          const merk = TR.auswahl===a.id;
          return `<button class="tr-opt${merk?' an':''}" data-auswahl="${a.id}">
            <b>${esc(a.name)}</b><span>${esc(a.erl)}</span></button>`;
        }).join('')}
      </div>
    </div>

    <div class="tr-block">
      <div class="tr-lab">Umfang <span>${max} Fragen verfügbar</span></div>
      ${max ? `<div class="umfang">
          <input type="range" id="tr-schieber" min="1" max="${max}" value="${TR.anzahl}" step="1">
          <output class="tr-zahl tnum" id="tr-zahl">${TR.anzahl}</output>
        </div>
        <div class="stufen">${stufen.map(n=>`<button class="stufe-btn${TR.anzahl===n?' an':''}" data-anzahl="${n}">${n}</button>`).join('')}
          <button class="stufe-btn${TR.anzahl===max?' an':''}" data-anzahl="${max}">alle ${max}</button></div>`
        : '<div class="hinweis">Für diese Auswahl gibt es gerade keine Fragen. Wähle mehr Bereiche oder eine andere Auswahl.</div>'}
    </div>

    <div class="tr-block">
      <div class="tr-lab">Zeit</div>
      <div class="optionen zwei">
        <button class="tr-opt${TR.zeit?'':' an'}" data-zeit="0"><b>Ohne Zeitdruck</b>
          <span>In Ruhe nachdenken, keine Uhr. Für das Tagespensum und zum Lernen.</span></button>
        <button class="tr-opt${TR.zeit?' an':''}" data-zeit="1"><b>Mit Prüfungszeit</b>
          <span>${nurFr?'Anteilig am Budget von 30 Minuten für 52 Aufgaben.':'Rund 24 Sekunden je Frage, wie im Original.'}
            ${max?'Für '+TR.anzahl+' Fragen: '+mmss(trZeit(TR.anzahl))+' Min.':''}</span></button>
      </div>
    </div>

    <div class="tr-start">
      <div class="tr-zusammen">${max
        ? `<b>${TR.anzahl} ${TR.anzahl===1?'Frage':'Fragen'}</b> aus ${TR.bereiche.size} ${TR.bereiche.size===1?'Bereich':'Bereichen'}
           · ${esc(AUSWAHL.find(a=>a.id===TR.auswahl).name.toLowerCase())}
           · ${TR.zeit? mmss(trZeit(TR.anzahl))+' Minuten' : 'ohne Zeitdruck'}`
        : 'Keine Fragen für diese Zusammenstellung'}</div>
      <button class="btn" id="tr-los" ${max?'':'disabled'}>Training starten</button>
    </div>`;

  $('#tr-note').textContent = max? max+' Fragen passen zur Auswahl' : 'keine passenden Fragen';

  $$('#trainer [data-bereich]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.bereich;
    if(TR.bereiche.has(id)){ if(TR.bereiche.size>1) TR.bereiche.delete(id); }
    else TR.bereiche.add(id);
    renderTrainer();
  });
  $$('#trainer [data-gruppe]').forEach(b=>b.onclick=()=>{
    const g=b.dataset.gruppe, ids=BEREICHE.filter(x=>x.gruppe===g).map(x=>x.id);
    if(ids.every(i=>TR.bereiche.has(i))){ ids.forEach(i=>TR.bereiche.delete(i)); if(!TR.bereiche.size) TR.bereiche.add('recht'); }
    else ids.forEach(i=>TR.bereiche.add(i));
    renderTrainer();
  });
  $$('#trainer [data-auswahl]').forEach(b=>b.onclick=()=>{ TR.auswahl=b.dataset.auswahl; renderTrainer(); });
  $$('#trainer [data-anzahl]').forEach(b=>b.onclick=()=>{ TR.anzahl=+b.dataset.anzahl; renderTrainer(); });
  $$('#trainer [data-zeit]').forEach(b=>b.onclick=()=>{ TR.zeit=b.dataset.zeit==='1'; renderTrainer(); });
  const sch=$('#tr-schieber');
  if(sch){
    sch.oninput=()=>{ TR.anzahl=+sch.value; $('#tr-zahl').textContent=TR.anzahl; };
    sch.onchange=()=>renderTrainer();
  }
  const los=$('#tr-los');
  if(los) los.onclick=()=>start({typ:'trainer', zeit:TR.zeit? trZeit(TR.anzahl):0,
    titel:'Training · '+AUSWAHL.find(a=>a.id===TR.auswahl).name});
}

function renderMenu(){
  $('#train-menu').style.display=''; $('#train-run').style.display='none'; $('#train-run').innerHTML='';
  renderTrainer();

  $('#modes-exam').innerHTML = [
    karte({kicker:'Ernstfall', t:'Vollsimulation Fachtests', p:'Alle drei Fachtests hintereinander, je 25 Fragen in 10 Minuten – wie am 1. September.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'sim', zeit:600, titel:'Vollsimulation Fachtests'}}),
    karte({kicker:'Ernstfall', t:'Vollständiger Sprachtest', p:'Alle drei Teile mit einem gemeinsamen Budget von 30 Minuten, 60 Punkte, bestanden ab 30.',
      meta:['52 Aufgaben','30:00 Min'], cfg:{typ:'frSim', zeit:FR_META.dauer, gesamt:true, titel:'Vollständiger Sprachtest'}}),
    karte({kicker:'Original', t:'Auswahlverfahren 2023', p:'Die drei veröffentlichten Fachtests des Jahrgangs 2023 im Original.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'orig', block:'Original 2023', zeit:600, titel:'Originalprüfung 2023'}}),
    karte({kicker:'Original', t:'Auswahlverfahren 2019', p:'Die drei veröffentlichten Fachtests des Jahrgangs 2019 im Original.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'orig', block:'Original 2019', zeit:600, titel:'Originalprüfung 2019'}}),
    karte({kicker:'Original', t:'AA-Musteraufgaben Französisch', p:'Die vom Auswärtigen Amt veröffentlichten Beispielaufgaben zum Sprachtest.',
      meta:[FR.filter(q=>q.block==='AA-Musteraufgaben').length+' Aufgaben','ohne Zeitdruck'],
      cfg:{typ:'frBlockAlle', block:'AA-Musteraufgaben', zeit:0, titel:'AA-Musteraufgaben Französisch'}})
  ].join('');
  $$('#modes-exam .mode').forEach(b=>b.onclick=()=>start(JSON.parse(b.dataset.mode)));
  paketliste();
}

/* ---------- Übersicht über alle Abschnitte ----------
   Damit die Sammlung auch nach dreißig Tagen überschaubar bleibt: eine Zeile
   je Paket mit Fortschritt, standardmäßig die letzten acht. */
let PAKETE_ALLE=false;

function paketZeile(name, teile, l, sofort){
  const ges = teile.reduce((a,t)=>a+t.n, 0);
  const auf = teile.reduce((a,t)=>a+t.gemacht, 0);
  const ok  = teile.reduce((a,t)=>a+t.richtig, 0);
  const quote = auf? Math.round(ok/auf*100) : null;
  return `<div class="paket${auf===0?' neu':''}">
    <span class="pn">${esc(name)}${sofort?' <em>neu</em>':''}</span>
    <span class="pt">${teile.map(t=>`<span class="k-${t.kls}" title="${esc(t.name)}: ${t.gemacht} von ${t.n}">
        <i class="pp"></i><span class="pz tnum">${t.gemacht}/${t.n}</span></span>`).join('')}</span>
    <span class="pq tnum">${auf? quote+' %' : '–'}</span>
    <span class="pb"><i style="width:${ges? Math.round(auf/ges*100):0}%"></i></span>
    <span class="pa"><button class="btn ghost sm" data-paket="${esc(name)}">${auf===ges?'Wiederholen':'Üben'}</button></span>
  </div>`;
}

function paketliste(){
  const box=$('#pakete'); if(!box) return;
  const l=letzteJeFrage();
  const namen=[...new Set(ALLES.map(q=>q.block))]
    .sort((a,b)=>{
      const ta=a.startsWith('Tag ')?parseInt(a.slice(4)):-1, tb=b.startsWith('Tag ')?parseInt(b.slice(4)):-1;
      if(ta>=0&&tb>=0) return tb-ta;
      if(ta>=0) return -1; if(tb>=0) return 1;
      return b.localeCompare(a,'de');
    });
  const neuster = neuesteTage()[0];
  const zeilen = namen.map(n=>{
    const teile = ALLE.map(k=>{
      const qs=F.filter(q=>q.block===n && q.kategorie===k);
      return {kls:k, name:KAT[k].kurz, n:qs.length,
              gemacht:qs.filter(q=>l[q.id]).length,
              richtig:qs.filter(q=>l[q.id]&&l[q.id].ok).length};
    }).concat([(()=>{ const qs=FR.filter(q=>q.block===n);
      return {kls:'franzoesisch', name:KAT_FR.kurz, n:qs.length,
              gemacht:qs.filter(q=>l[q.id]).length,
              richtig:qs.filter(q=>l[q.id]&&l[q.id].ok).length}; })()])
      .filter(t=>t.n);
    return {n, teile, offen: teile.reduce((a,t)=>a+(t.n-t.gemacht),0)};
  });
  const offen = zeilen.filter(z=>z.offen).length;
  $('#pakete-note').textContent = zeilen.length + (zeilen.length===1?' Paket':' Pakete')
    + (offen? ' · '+offen+' noch offen' : ' · alle bearbeitet');
  const zeige = PAKETE_ALLE ? zeilen : zeilen.slice(0,8);
  box.innerHTML = zeilen.length
    ? zeige.map(z=>paketZeile(z.n, z.teile, l, z.n===neuster && z.offen===z.teile.reduce((a,t)=>a+t.n,0))).join('')
      + (zeilen.length>8 ? `<div class="morerow"><button class="link" id="pakete-mehr">${
          PAKETE_ALLE?'Nur die letzten acht zeigen':'Alle '+zeilen.length+' Pakete zeigen'}</button></div>`:'')
    : '<div class="empty">Noch kein Abschnitt vorhanden.</div>';
  const m=$('#pakete-mehr'); if(m) m.onclick=()=>{ PAKETE_ALLE=!PAKETE_ALLE; paketliste(); };
  $$('#pakete [data-paket]').forEach(b=>b.onclick=()=>{
    const n=b.dataset.paket;
    /* Originalprüfungen mit Prüfungszeit, Tagespakete ohne. */
    const orig = n.startsWith('Original');
    start({typ:'paket', block:n, zeit: orig?600:0, titel:n});
  });
}

/* =====================================================================
   TRAINING – Ablauf
   ===================================================================== */
const pick=(a,n)=>shuffle(a).slice(0,n);

/* Textverständnis artikelweise ziehen: drei Artikel wie im Original,
   der letzte wird gekürzt, damit die Zielzahl exakt erreicht wird. */
function frTextsatz(pool, ziel, maxArtikel){
  maxArtikel = maxArtikel || 3;
  const gruppen = {};
  for(const q of pool) (gruppen[q.textId] = gruppen[q.textId] || []).push(q);
  const ids = shuffle(Object.keys(gruppen));
  const out = [];
  const nimm = (id, rest) => { const g = gruppen[id].filter(q => out.indexOf(q) < 0);
                               out.push(...g.slice(0, rest)); };
  for(const id of ids){
    if(out.length >= ziel) break;
    if(new Set(out.map(q => q.textId)).size >= maxArtikel) break;
    nimm(id, ziel - out.length);
  }
  for(const id of ids){
    if(out.length >= ziel) break;
    nimm(id, ziel - out.length);
  }
  return out;
}

function baueTeile(cfg){
  const l=letzteJeFrage();
  switch(cfg.typ){
    case 'block':   return [{fragen:F.filter(q=>q.block===cfg.block && q.kategorie===cfg.kat)}];
    case 'orig':    return ALLE.map(k=>({fragen:F.filter(q=>q.block===cfg.block && q.kategorie===k)}));
    case 'paket':   return ALLE.map(k=>({fragen:F.filter(q=>q.block===cfg.block && q.kategorie===k)}))
                      .concat(Object.keys(FR_TEIL).map(t=>({fragen:FR.filter(q=>q.block===cfg.block && q.teil===t)})))
                      .filter(x=>x.fragen.length);
    case 'sim':     return ALLE.map(k=>({fragen:pick(F.filter(q=>q.kategorie===k),25)}));
    case 'zufall':  return [{fragen:pick(F.filter(q=>q.kategorie===cfg.kat), cfg.n)}];
    case 'fehler':  return [{fragen:shuffle(falscheOffen(F))}];
    case 'neu':     return [{fragen:pick(F.filter(q=>!l[q.id]), cfg.n)}];
    case 'frBlock': return [{fragen:FR.filter(q=>q.block===cfg.block && q.teil===cfg.teil)}];
    case 'frBlockAlle': return Object.keys(FR_TEIL).map(t=>({fragen:FR.filter(q=>q.block===cfg.block && q.teil===t)})).filter(x=>x.fragen.length);
    case 'frTeil':  return [{fragen: cfg.teil==='textverstaendnis'
                              ? frTextsatz(frTeilFragen(cfg.teil), FR_TEIL[cfg.teil].fragen)
                              : pick(frTeilFragen(cfg.teil), FR_TEIL[cfg.teil].fragen)}];
    case 'frSim':   return Object.keys(FR_TEIL).map(t=>({fragen: t==='textverstaendnis'
                              ? frTextsatz(frTeilFragen(t), FR_TEIL[t].fragen)
                              : pick(frTeilFragen(t), FR_TEIL[t].fragen)}));
    case 'frFehler':return [{fragen:shuffle(falscheOffen(FR))}];
    case 'trainer': {
      /* Textverständnis artikelweise ziehen, damit die Lesetexte vollständig bleiben. */
      const pool=trPool();
      const tv=pool.filter(q=>q.teil==='textverstaendnis');
      const rest=pool.filter(q=>q.teil!=='textverstaendnis');
      let satz;
      if(tv.length && TR.bereiche.has('textverstaendnis')){
        const anteil=Math.min(tv.length, Math.max(1, Math.round(TR.anzahl*tv.length/pool.length)));
        satz = frTextsatz(tv, anteil, 3).concat(pick(rest, TR.anzahl-anteil));
      } else {
        satz = pick(pool, TR.anzahl);
      }
      /* Nach Bereich sortieren, damit zusammengehörige Fragen beieinander stehen. */
      const rang = q => BEREICHE.findIndex(b=>b.id===(q.kategorie==='franzoesisch'? q.teil : q.kategorie));
      satz.sort((a,b)=> rang(a)-rang(b) || String(a.textId||'').localeCompare(String(b.textId||'')));
      return [{fragen:satz}];
    }
  }
  return [];
}

function start(cfg){
  const teile=baueTeile(cfg).filter(t=>t.fragen.length);
  if(!teile.length){ toast('Für diesen Durchgang sind gerade keine Fragen vorhanden.'); return; }
  LAUF={cfg, view:'train', mount:'#train-run', teile, ti:0, i:0, antw:{}, mark:{}, start:Date.now(), phase:'lauf'};
  $('#train-menu').style.display='none';
  $('#train-run').style.display='';
  ANSICHT='train'; navBauen();
  $$('.view').forEach(s=>s.classList.toggle('on', s.id==='v-train'));
  window.scrollTo({top:0});
  renderFrage(); starteTimer();
}
const aktTeil = ()=> LAUF.teile[LAUF.ti];

function starteTimer(){
  clearInterval(TICK);
  if(!LAUF.cfg.zeit) return;
  if(!(LAUF.cfg.gesamt && LAUF.deadline)) LAUF.deadline = Date.now() + LAUF.cfg.zeit*1000;
  TICK=setInterval(()=>{
    if(!LAUF || LAUF.phase!=='lauf'){ clearInterval(TICK); return; }
    const rest=(LAUF.deadline-Date.now())/1000;
    if(rest<=0){ clearInterval(TICK);
      if(LAUF.cfg.gesamt){ toast('Zeit abgelaufen – der Test wird gewertet.'); auswerten(); }
      else { toast('Zeit abgelaufen – dieser Teil wird gewertet.'); teilFertig(); }
      return; }
    const el=M('#timer');
    if(el){ el.textContent=mmss(rest); el.classList.toggle('warn', rest<=60); }
  },250);
}

function renderFrage(){
  const T=aktTeil(), q=T.fragen[LAUF.i], n=T.fragen.length;
  const fr=q.kategorie==='franzoesisch';
  const kls = fr? 'k-franzoesisch' : 'k-'+q.kategorie;
  const marke = fr? FR_TEIL[q.teil].kurz : KAT[q.kategorie].kurz;
  const kopf  = fr? FR_TEIL[q.teil].name : KAT[q.kategorie].name;
  const beantwortet=T.fragen.filter(f=>LAUF.antw[f.id]!==undefined).length;
  const mehr=LAUF.teile.length>1;
  const vorher = LAUF.i>0 ? T.fragen[LAUF.i-1] : null;
  const zeigeText = q.text && (!vorher || vorher.textId!==q.textId);

  $(LAUF.mount).innerHTML=`
    <div class="exambar">
      <div class="in wrap">
        <div style="flex:1">
          <div class="who">${esc(LAUF.cfg.titel)}${mehr?' · Teil '+(LAUF.ti+1)+' von '+LAUF.teile.length:''}</div>
          <div class="what">${esc(kopf)}</div>
        </div>
        ${LAUF.cfg.zeit?`<div><div class="timerlab">${LAUF.cfg.gesamt?'Restzeit gesamt':'Restzeit'}</div><div class="timer" id="timer">${mmss(LAUF.deadline?(LAUF.deadline-Date.now())/1000:LAUF.cfg.zeit)}</div></div>`
                      :'<div class="small mute">ohne Zeitdruck</div>'}
        <button class="btn ghost sm" id="abbruch">Abbrechen</button>
      </div>
      <div class="trail"><i style="width:${Math.round(beantwortet/n*100)}%"></i></div>
    </div>

    <div class="wrap"><div class="runwrap">
      <div class="qcard ${kls}${LAUF.mark[q.id]?' marked':''}">
        ${q.text?`<div class="artikel"${zeigeText?'':' style="display:none"'}>
            ${q.titel?`<h4>${esc(q.titel)}</h4>`:''}
            ${absatz(q.text)}
            ${q.quelle?`<div class="q">${esc(q.quelle)}</div>`:''}
          </div>
          ${zeigeText?'':`<button class="link" id="showtext" style="margin-bottom:22px">Text erneut anzeigen</button>`}`:''}
        <div class="qhead">
          <span class="tag">${esc(marke)}</span>
          <span class="qnum">Frage ${LAUF.i+1} von ${n}${fr?' · '+q.punkte+(q.punkte===1?' Punkt':' Punkte'):''}</span>
          ${LAUF.mark[q.id]?'<span class="markhint">★ markiert</span>':''}
          <button class="btn ghost sm" id="mark" style="margin-left:auto">${LAUF.mark[q.id]?'★ Markierung aufheben':'☆ Markieren'}</button>
        </div>
        <p class="stem">${stemHtml(q.frage)}</p>
        <div class="opts">${q.optionen.map((o,i)=>
          `<button class="opt ${LAUF.antw[q.id]===i?'sel':''}" data-o="${i}"><span class="ltr">${LTR[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="qfoot">
          ${LAUF.i===0 && LAUF.ti>0 && LAUF.cfg.gesamt
            ? `<button class="btn ghost" id="prevteil">← Teil ${LAUF.ti}</button>`
            : `<button class="btn ghost" id="prev" ${LAUF.i===0?'disabled':''}>Zurück</button>`}
          <span class="small mute tnum" style="margin-left:auto">${beantwortet} von ${n} beantwortet${
            LAUF.cfg.gesamt? ' · gesamt '+LAUF.teile.flatMap(t=>t.fragen).filter(f=>LAUF.antw[f.id]!==undefined).length+' von '+LAUF.teile.reduce((a,t)=>a+t.fragen.length,0):''}</span>
          ${LAUF.i===n-1
            ? `<button class="btn" id="fertig">${LAUF.ti===LAUF.teile.length-1?'Auswerten':'Nächster Teil →'}</button>`
            : `<button class="btn" id="next">Weiter</button>`}
        </div>
        <div class="navi">
          <div class="lab">Übersicht</div>
          <div class="pgrid">${T.fragen.map((f,i)=>
            `<button class="pg ${LAUF.antw[f.id]!==undefined?'done':''} ${LAUF.mark[f.id]?'mark':''} ${i===LAUF.i?'cur':''}" data-i="${i}">${i+1}</button>`).join('')}</div>
          <div class="pglegend">
            <span><i class="d"></i>beantwortet</span>
            <span><i class="m"></i>markiert</span>
            <span><i class="c"></i>aktuelle Frage</span>
          </div>
        </div>
      </div>
    </div></div>`;

  MM('.opts .opt').forEach(b=>b.onclick=()=>{ LAUF.antw[q.id]=+b.dataset.o; if(LAUF.i<n-1) LAUF.i++; renderFrage(); });
  MM('.pg').forEach(b=>b.onclick=()=>{ LAUF.i=+b.dataset.i; renderFrage(); });
  M('#mark').onclick=()=>{ LAUF.mark[q.id]=!LAUF.mark[q.id]; renderFrage(); };
  const st=M('#showtext'); if(st) st.onclick=()=>{ const a=M('.artikel'); if(a) a.style.display=''; st.style.display='none'; };
  const p=M('#prev'), nx=M('#next'), fe=M('#fertig');
  if(p) p.onclick=()=>{ LAUF.i--; renderFrage(); };
  const pt=M('#prevteil'); if(pt) pt.onclick=()=>{ LAUF.ti--; LAUF.i=aktTeil().fragen.length-1; renderFrage(); window.scrollTo({top:0}); };
  if(nx) nx.onclick=()=>{ LAUF.i++; renderFrage(); };
  if(fe) fe.onclick=()=>{
    const letzter = LAUF.ti===LAUF.teile.length-1;
    const off = (LAUF.cfg.gesamt && letzter)
      ? LAUF.teile.flatMap(t=>t.fragen).filter(f=>LAUF.antw[f.id]===undefined).length
      : n-beantwortet;
    if(off && !confirm(off+' Frage(n) sind noch unbeantwortet. Trotzdem werten?')) return;
    teilFertig();
  };
  M('#abbruch').onclick=()=>{ if(confirm('Durchgang abbrechen? Die Antworten werden nicht gespeichert.')){
    clearInterval(TICK); LAUF=null; renderMenu(); } };
}

function teilFertig(){
  clearInterval(TICK);
  if(LAUF.ti < LAUF.teile.length-1){ LAUF.ti++; LAUF.i=0; renderFrage(); starteTimer(); window.scrollTo({top:0}); return; }
  auswerten();
}

async function auswerten(){
  clearInterval(TICK);
  const dauer=(Date.now()-LAUF.start)/1000, alle=LAUF.teile.flatMap(t=>t.fragen);
  const d=heute(), ts=new Date().toISOString();
  let richtig=0, punkte=0, maxPunkte=0;
  const neue=[];
  for(const q of alle){
    const g=LAUF.antw[q.id], ok=g===q.loesung, p=q.punkte||1;
    maxPunkte+=p; if(ok){ richtig++; punkte+=p; }
    if(g!==undefined) neue.push({id:q.id, kat:q.kategorie, gew:g, ok, datum:d, ts});
  }
  const sess={datum:d, ts, titel:LAUF.cfg.titel, n:alle.length, richtig, quote:pct(richtig,alle.length),
              punkte, maxPunkte, dauer:Math.round(dauer), kats:[...new Set(alle.map(q=>q.kategorie))]};
  S.antworten.push(...neue);
  S.sessions.push(sess);
  LAUF.phase='ergebnis';
  renderErgebnis(alle, sess);
  sichern(sess, neue);
}

function ring(p, farbe){
  const r=52, c=2*Math.PI*r;
  return `<svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${p} Prozent">
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="#e6e9ec" stroke-width="10"/>
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="${farbe}" stroke-width="10" stroke-linecap="butt"
      stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p/100)}" transform="rotate(-90 64 64)"/>
    <text x="64" y="72" text-anchor="middle" font-size="30" font-weight="700" fill="#000">${p}%</text></svg>`;
}

function renderErgebnis(alle, sess){
  const nurFr = sess.kats.length===1 && sess.kats[0]==='franzoesisch';
  const fr = sess.kats.includes('franzoesisch');
  const farbe = sess.quote>=70?'#1c6f45':sess.quote>=50?'#8a6d0b':'#b3121b';
  const vollerTest = fr && LAUF.cfg.typ==='frSim' && sess.maxPunkte===FR_META.punkte;
  const gruppen = nurFr
    ? Object.keys(FR_TEIL).filter(t=>alle.some(q=>q.teil===t)).map(t=>{
        const qs=alle.filter(q=>q.teil===t);
        return {kls:'k-franzoesisch', name:FR_TEIL[t].kurz,
                r:qs.filter(q=>LAUF.antw[q.id]===q.loesung).length, n:qs.length,
                p:qs.filter(q=>LAUF.antw[q.id]===q.loesung).reduce((a,q)=>a+q.punkte,0),
                mp:qs.reduce((a,q)=>a+q.punkte,0)}; })
    : [...new Set(alle.map(q=>q.kategorie))].map(k=>{
        const qs=alle.filter(q=>q.kategorie===k);
        return {kls:'k-'+k, name:katKurz(k), r:qs.filter(q=>LAUF.antw[q.id]===q.loesung).length, n:qs.length,
                p:qs.filter(q=>LAUF.antw[q.id]===q.loesung).reduce((a,q)=>a+(q.punkte||1),0),
                mp:qs.reduce((a,q)=>a+(q.punkte||1),0)}; });

  const rows=alle.map((q,i)=>{
    const g=LAUF.antw[q.id], ok=g===q.loesung, offen=g===undefined;
    return `<details class="rev" ${ok?'':'open'}><summary>
      <span class="mk ${offen?'s':ok?'r':'w'}">${offen?'–':ok?'✓':'✕'}</span>
      <span><span class="mute tnum small">${i+1}</span>&nbsp;&nbsp;${stemHtml(q.frage)}</span></summary>
      <div class="body">
        ${q.text?`<div class="artikel">${q.titel?`<h4>${esc(q.titel)}</h4>`:''}${absatz(q.text)}
          ${q.quelle?`<div class="q">${esc(q.quelle)}</div>`:''}</div>`:''}
        <div class="opts">${q.optionen.map((o,j)=>
          `<div class="opt static ${j===q.loesung?'right':(j===g?'wrong':'')}"><span class="ltr">${LTR[j]}</span><span>${esc(o)}</span></div>`).join('')}</div>
        <div class="expl ${offen?'':ok?'ok':'bad'}"><b>${offen?'Nicht beantwortet.':ok?'Richtig.':'Deine Antwort: '+LTR[g]+' · richtig ist '+LTR[q.loesung]+'.'}</b> ${esc(q.erlaeuterung)}</div>
        <div class="srcline">${esc(q.thema||'')} · ${esc(q.block)} · ${esc(q.id)}</div>
      </div></details>`;
  }).join('');

  $(LAUF.mount).innerHTML=`
    <div class="wrap page" style="margin-bottom:32px">
      <div class="eyebrow">Ergebnis</div>
      <div class="row"><div style="flex:1;min-width:280px"><h1>${esc(sess.titel)}</h1></div></div>
    </div>
    <div class="wrap">
      <div class="card score">
        ${ring(sess.quote, farbe)}
        <div style="flex:1;min-width:240px">
          <div style="font-size:27px;font-weight:700;color:var(--ink);letter-spacing:-.02em">
            ${fr? sess.punkte+' von '+sess.maxPunkte+' Punkten' : sess.richtig+' von '+sess.n+' richtig'}</div>
          <p class="small mute" style="margin:8px 0 ${vollerTest?'10px':'24px'}">
            ${fr? sess.richtig+' von '+sess.n+' Fragen richtig · ':''}Bearbeitungszeit ${mmss(sess.dauer)}${sess.n?' · '+(sess.dauer/sess.n).toFixed(1)+' Sekunden pro Frage':''}</p>
          ${vollerTest?`<div class="verdict ${sess.punkte>=FR_META.bestanden?'ja':'nein'}">${sess.punkte>=FR_META.bestanden?'Bestanden':'Nicht bestanden'} · Grenze ${FR_META.bestanden} von ${FR_META.punkte} Punkten</div><div style="height:16px"></div>`:''}
          <div style="display:flex;gap:28px;flex-wrap:wrap">${gruppen.map(g=>`
            <div class="${g.kls}" style="min-width:186px;flex:1 1 186px;max-width:260px">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-bottom:9px">
                <span class="tag" style="font-size:11.5px;white-space:nowrap">${esc(g.name)}</span>
                <span class="tnum small mute" style="white-space:nowrap">${g.p!==undefined? g.p+'/'+g.mp+' P.' : g.r+'/'+g.n}</span></div>
              <div class="meter"><i style="width:${pct(g.r,g.n)}%"></i></div></div>`).join('')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <button class="btn" id="e-menu">Weiter trainieren</button>
          <button class="btn ghost" id="e-dash">Zum Dashboard</button>
        </div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Durchsicht</h2><button class="link note" id="e-all">Alle aufklappen</button></div>
        <div id="revlist">${rows}</div>
      </div>
    </div>`;
  M('#e-menu').onclick=()=>{ LAUF=null; renderMenu(); };
  M('#e-dash').onclick=()=>{ LAUF=null; renderMenu(); go('dash'); };
  M('#e-all').onclick=()=>MM('#revlist details').forEach(d=>d.open=true);
  window.scrollTo({top:0});
}

/* =====================================================================
   FEHLERARCHIV
   ===================================================================== */
function renderArchiv(){
  const fal=falscheOffen(ALLES), l=letzteJeFrage();
  if(!fal.length){ $('#archivbox').innerHTML='<div class="card"><div class="empty">Kein offener Fehler. Entweder läuft es gut – oder es fehlt noch an Durchgängen.</div></div>'; return; }
  $('#archivbox').innerHTML=
    `<div class="card pad" style="display:flex;align-items:center;gap:22px;margin-bottom:26px;flex-wrap:wrap">
       <div style="font-size:19px"><b>${fal.length} Fragen</b> hast du zuletzt falsch beantwortet.</div>
       <button class="btn" id="a-start" style="margin-left:auto">Jetzt wiederholen</button></div>`
    + fal.map(q=>{ const g=l[q.id].gew;
      return `<details class="rev"><summary><span class="mk w">✕</span>
        <span><span class="tagrow"><span class="tag k-${q.kategorie}" style="font-size:11px">${katKurz(q.kategorie)}</span></span>${stemHtml(q.frage)}</span></summary>
        <div class="body">${q.text?`<div class="artikel">${q.titel?`<h4>${esc(q.titel)}</h4>`:''}${absatz(q.text)}</div>`:''}<div class="opts">${q.optionen.map((o,j)=>
          `<div class="opt static ${j===q.loesung?'right':(j===g?'wrong':'')}"><span class="ltr">${LTR[j]}</span><span>${esc(o)}</span></div>`).join('')}</div>
        <div class="expl bad"><b>Richtig ist ${LTR[q.loesung]}.</b> ${esc(q.erlaeuterung)}</div>
        <div class="srcline">${esc(q.thema||'')} · ${esc(q.block)}</div></div></details>`; }).join('');
  $('#a-start').onclick=()=>{
    const nurFr = fal.every(q=>q.kategorie==='franzoesisch');
    start(nurFr ? {view:'fr', typ:'frFehler', zeit:0, titel:'Wiederholung Französisch'}
                : {typ:'fehler', zeit:0, titel:'Wiederholung'});
  };
}

/* =====================================================================
   FRAGENPOOL
   ===================================================================== */
/* ---------- Abdeckung des Lehrplans ---------- */
const LP_NAME = {recht:'Völker-, Europa- und Staatsrecht', geschichte:'Geschichte und Politik',
  wirtschaft:'Wirtschaft', textverstaendnis:'Textverständnis', wortschatz:'Wortschatz', grammatik:'Grammatik'};
const LP_KLS = {recht:'recht', geschichte:'geschichte', wirtschaft:'wirtschaft',
  textverstaendnis:'franzoesisch', wortschatz:'franzoesisch', grammatik:'franzoesisch'};
let LP_OFFEN = null;

async function renderLehrplan(){
  const box=$('#lehrplan'); if(!box) return;
  const [{data:ueb}, {data:stand}] = await Promise.all([
    sb.from('lehrplan_uebersicht').select('*'),
    sb.from('lehrplan_stand').select('kategorie,thema,gewicht,fragen,soll,zuletzt').order('kategorie')
  ]);
  if(!ueb){ box.innerHTML='<div class="card"><div class="empty">Lehrplan konnte nicht geladen werden.</div></div>'; return; }
  const reihe=['recht','geschichte','wirtschaft','textverstaendnis','wortschatz','grammatik'];
  const sortiert=reihe.map(k=>ueb.find(u=>u.kategorie===k)).filter(Boolean);
  const felder=sortiert.reduce((a,u)=>a+u.felder,0);
  const begonnen=sortiert.reduce((a,u)=>a+u.begonnen,0);
  $('#lp-note').textContent = begonnen+' von '+felder+' Themenfeldern begonnen';

  box.innerHTML = `<div class="grid g3">${sortiert.map(u=>{
      const p=Math.round(u.begonnen/u.felder*100);
      return `<div class="card pad k-${LP_KLS[u.kategorie]}">
        <div class="tag">${esc(LP_NAME[u.kategorie])}</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:14px 0 12px">
          <span style="font-size:34px;font-weight:700;letter-spacing:-.03em;color:var(--ink)" class="tnum">${u.begonnen}</span>
          <span class="mute" style="font-size:16px">von ${u.felder} Feldern</span>
        </div>
        <div class="meter"><i style="width:${p}%"></i></div>
        <div class="xs mute" style="margin-top:14px">${u.fragen} Fragen · Ziel ${u.soll}${
          u.erfuellt? ' · '+u.erfuellt+' Felder vollständig':''}</div>
      </div>`;
    }).join('')}</div>
    <div class="card" style="margin-top:20px">
      <div class="feld" style="border-bottom:1px solid var(--line)">
        <span class="nm" style="font-weight:600;color:var(--ink)">Noch nicht begonnene Themenfelder</span>
        <span class="ct" style="width:auto">${(stand||[]).filter(s=>!s.fragen).length}</span>
      </div>
      <div id="lp-liste"></div>
      <div class="morerow"><button class="link" id="lp-mehr"></button></div>
    </div>`;

  const offen=(stand||[]).filter(s=>!s.fragen);
  const zeichnen=()=>{
    const zeige = LP_OFFEN ? offen : offen.slice(0,10);
    $('#lp-liste').innerHTML = offen.length
      ? zeige.map(s=>`<div class="feld k-${LP_KLS[s.kategorie]}">
          <span class="sq"></span>
          <span class="nm" title="${esc(s.thema)}">${esc(s.thema)}</span>
          <span class="ct" style="width:auto;white-space:nowrap">${s.gewicht===3?'häufig':s.gewicht===2?'normal':'selten'}</span>
        </div>`).join('')
      : '<div class="empty">Jedes Themenfeld hat mindestens eine Frage.</div>';
    const b=$('#lp-mehr');
    if(offen.length>10){ b.style.display=''; b.textContent = LP_OFFEN? 'Weniger anzeigen' : 'Alle '+offen.length+' offenen Felder anzeigen'; }
    else b.style.display='none';
  };
  zeichnen();
  $('#lp-mehr').onclick=()=>{ LP_OFFEN=!LP_OFFEN; zeichnen(); };
}

function renderPool(){
  renderLehrplan();
  const ks=$('#q-kat'), bs=$('#q-block');
  if(!ks.options.length){
    ks.innerHTML='<option value="">alle</option>'+ALLE.concat('franzoesisch').map(k=>`<option value="${k}">${katKurz(k)}</option>`).join('');
    [ks,bs].forEach(e=>e.onchange=poolList);
    $('#q-search').oninput=poolList;
  }
  const bl=[...new Set(ALLES.map(q=>q.block))].sort((a,b)=>(a.startsWith('Tag')?1:0)-(b.startsWith('Tag')?1:0)||a.localeCompare(b,'de',{numeric:true}));
  const alt=bs.value;
  bs.innerHTML='<option value="">alle</option>'+bl.map(b=>`<option>${esc(b)}</option>`).join('');
  if(bl.includes(alt)) bs.value=alt;
  poolList();
}
function poolList(){
  const s=$('#q-search').value.toLowerCase().trim(), k=$('#q-kat').value, b=$('#q-block').value, l=letzteJeFrage();
  let r=ALLES.filter(q=>(!k||q.kategorie===k)&&(!b||q.block===b));
  if(s) r=r.filter(q=>(q.frage+' '+q.optionen.join(' ')+' '+q.erlaeuterung+' '+(q.thema||'')).toLowerCase().includes(s));
  $('#q-count').textContent=r.length+' von '+ALLES.length+' Fragen';
  $('#poollist').innerHTML = r.length
    ? r.slice(0,250).map(q=>{ const a=l[q.id];
        return `<details class="rev"><summary>
          <span class="mk ${a?(a.ok?'r':'w'):'s'}">${a?(a.ok?'✓':'✕'):'·'}</span>
          <span><span class="tagrow"><span class="tag k-${q.kategorie}" style="font-size:11px">${katKurz(q.kategorie)}</span></span>${stemHtml(q.frage)}</span></summary>
          <div class="body"><div class="opts">${q.optionen.map((o,j)=>
            `<div class="opt static ${j===q.loesung?'right':''}"><span class="ltr">${LTR[j]}</span><span>${esc(o)}</span></div>`).join('')}</div>
          <div class="expl">${esc(q.erlaeuterung)}</div>
          <div class="srcline">${esc(q.thema||'')} · ${esc(q.block)} · ${esc(q.id)}</div></div></details>`; }).join('')
      + (r.length>250?'<div class="empty">Weitere Treffer ausgeblendet – bitte Suche eingrenzen.</div>':'')
    : '<div class="card"><div class="empty">Keine Frage passt zu diesen Filtern.</div></div>';
}

/* =====================================================================
   QUELLEN (nur Administratoren)
   ===================================================================== */
let QU_KATS = [], QU_ALLE = [];

const STUFE = {
  amtlich:      {kurz:'Amtlich',       lang:'Amtlicher Text – verbindliche Fassung'},
  behoerde:     {kurz:'Öffentlich',    lang:'Behörde oder Verfassungsorgan – redaktionell geprüft'},
  wissenschaft: {kurz:'Wissenschaft',  lang:'Wissenschaftlicher Verlag oder Forschungsinstitut'},
  kommerziell:  {kurz:'Kommerziell',   lang:'Kommerzieller Anbieter – nicht als Lernquelle verwenden'},
  sonstige:     {kurz:'Ungeprüft',     lang:'Herkunft nicht eingeordnet'}
};

async function ladeQuellen(){
  const [{data:kats}, {data:qs}] = await Promise.all([
    sb.from('quellenkategorie').select('schluessel,bezeichnung,reihenfolge').order('reihenfolge'),
    sb.from('quelle').select('*').order('titel')
  ]);
  QU_KATS = kats||[]; QU_ALLE = qs||[];
}

async function renderQuellen(){
  if(!istAdmin()){ go('dash'); return; }
  const liste=$('#qu-liste'); liste.innerHTML='<div class="card"><div class="empty">Wird geladen …</div></div>';
  await ladeQuellen();
  const ks=$('#qu-kat');
  if(ks.options.length<=1){
    ks.innerHTML='<option value="">alle</option>'+QU_KATS.map(k=>`<option value="${esc(k.schluessel)}">${esc(k.bezeichnung)}</option>`).join('');
    ks.onchange=quellenListe; $('#qu-datei').onchange=quellenListe; $('#qu-suche').oninput=quellenListe;
    $('#qu-stufe').onchange=quellenListe;
    $('#qu-neu').onclick=()=>quelleBearbeiten(null);
  }
  quellenListe();
}

let QU_OFFEN = new Set();          // aufgeklappte Sachgebiete merken

const BEZUG = {
  kern:       {kurz:'Kernquelle', lang:'Deckt Prüfungsstoff unmittelbar ab'},
  ergaenzend: {kurz:'Ergänzung',  lang:'Nützlich, aber am Rand des Prüfungsstoffs'},
  abseits:    {kurz:'ohne Prüfungsbezug', lang:'Deckt keinen Prüfungsstoff ab – kann entfernt werden'}
};

function quellenZeile(q){
  const st = STUFE[q.einstufung] || STUFE.sonstige;
  const bz = q.relevanz || 'ergaenzend';
  return `<div class="quelle${bz==='abseits'?' abseits':''}">
    <span class="punkt ${q.vorhanden?'ja':'nein'}" title="${q.vorhanden?'Datei im Cloudspeicher':'Datei fehlt'}"></span>
    <span class="t">
      <b>${esc(q.titel)}</b>
      <span class="herkunft">
        <span class="stufe ${esc(q.einstufung||'sonstige')}" title="${esc(st.lang)}">${esc(st.kurz)}</span>
        <span class="geber">${esc(q.herausgeber||'Herkunft nicht vermerkt')}</span>
        ${q.herkunft?`<span class="fund">${esc(q.herkunft)}</span>`:''}
        ${bz!=='kern'?`<span class="bezug ${bz}" title="${esc(BEZUG[bz].lang)}">${esc(BEZUG[bz].kurz)}</span>`:''}
      </span>
      <span class="datei">${esc(q.dateiname)}${q.groesse?' · '+mb(q.groesse):''}${q.vorhanden?'':' · Datei fehlt'}${
        (bz==='abseits'&&q.bemerkung)?' · '+esc(q.bemerkung):''}</span>
    </span>
    <span class="akt">
      ${q.vorhanden
        ? `<button class="btn ghost sm" data-lade="${q.id}">Öffnen</button>`
        : `<button class="btn ghost sm" data-hoch="${q.id}">Hochladen</button>`}
      <button class="btn ghost sm" data-bearb="${q.id}">Bearbeiten</button>
      <button class="btn ghost sm gefahr" data-weg="${q.id}">Löschen</button>
    </span>
  </div>`;
}

function quellenListe(){
  const s=$('#qu-suche').value.toLowerCase().trim(), k=$('#qu-kat').value, d=$('#qu-datei').value;
  const e=$('#qu-stufe')? $('#qu-stufe').value : '';
  const gefiltert = !!(s||k||d||e);
  const r=QU_ALLE.filter(q=>(!k||q.kategorie===k)
    && (!e||(q.relevanz||'ergaenzend')===e)
    && (!d || (d==='ja'? q.vorhanden : !q.vorhanden))
    && (!s || (q.titel+' '+q.dateiname+' '+(q.herausgeber||'')+' '+(q.herkunft||'')).toLowerCase().includes(s)));

  const da=QU_ALLE.filter(q=>q.vorhanden).length;
  const gb=QU_ALLE.reduce((a,q)=>a+(q.groesse||0),0);
  const ohne=QU_ALLE.filter(q=>q.relevanz==='abseits');
  const ohneMb=ohne.reduce((a,q)=>a+(q.groesse||0),0);
  const zaehl = Object.entries(QU_ALLE.reduce((m,q)=>{ m[q.einstufung||'sonstige']=(m[q.einstufung||'sonstige']||0)+1; return m; },{}));
  $('#qu-stat').innerHTML =
    `<b style="color:var(--ink)">${QU_ALLE.length} Quellen</b> für ${QU_KATS.length} Prüfungsteile · `
    + `${QU_ALLE.filter(q=>q.relevanz==='kern').length} Kernquellen`
    + (ohne.length? `, ${ohne.length} ohne Prüfungsbezug`:'')
    + ` · ${da} im Cloudspeicher`
    + (QU_ALLE.length-da? `, <b style="color:var(--gold)">${QU_ALLE.length-da} ohne Datei</b>`:'')
    + ` · zusammen ${mb(gb)}`
    + `<div class="herkunft" style="margin-top:12px">${zaehl
        .sort((a,b)=>b[1]-a[1])
        .map(([s2,n])=>`<span class="stufe ${esc(s2)}" title="${esc((STUFE[s2]||STUFE.sonstige).lang)}">${esc((STUFE[s2]||STUFE.sonstige).kurz)} ${n}</span>`).join('')}</div>`
    + (ohne.length? `<div class="hinweis" style="margin:16px 0 0;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span style="flex:1;min-width:240px"><b>${ohne.length} Quellen ohne Prüfungsbezug</b> – ältere Ausgaben, Schulmaterial
        und Randthemen, zusammen ${mb(ohneMb)}. Sie verwässern die tägliche Fragenerstellung.</span>
        <button class="btn ghost sm" id="qu-zeigeohne">Anzeigen</button>
        <button class="btn ghost sm gefahr" id="qu-raus">Alle entfernen</button></div>`:'')
    + (gefiltert? `<div style="margin-top:12px">${r.length} Treffer · <button class="link" id="qu-frei" style="font-size:14px">Filter zurücksetzen</button></div>`:'');

  const gruppen = QU_KATS.map(kat=>({kat, items:r.filter(q=>q.kategorie===kat.schluessel)})).filter(g=>g.items.length);
  $('#qu-liste').innerHTML = gruppen.length ? gruppen.map(g=>{
      const fehlt = g.items.filter(q=>!q.vorhanden).length;
      const kern  = g.items.filter(q=>q.relevanz==='kern').length;
      const raus  = g.items.filter(q=>q.relevanz==='abseits').length;
      const auf = gefiltert || QU_OFFEN.has(g.kat.schluessel);
      return `<details class="gebiet" data-gebiet="${esc(g.kat.schluessel)}"${auf?' open':''}>
        <summary>
          <span class="pfeil">▶</span>
          <span class="name">${esc(g.kat.bezeichnung)}</span>
          ${fehlt?`<span class="fehlt">${fehlt} ohne Datei</span>`:''}
          <span class="zahl">${kern} Kern${raus?' · '+raus+' ohne Bezug':''} · ${g.items.length} gesamt</span>
        </summary>
        <div>${g.items.map(quellenZeile).join('')}</div>
      </details>`;
    }).join('')
    + `<div class="small mute" style="margin-top:18px;display:flex;gap:18px;flex-wrap:wrap">
         <button class="link" id="qu-alle" style="font-size:14px">Alle aufklappen</button>
         <button class="link" id="qu-keine" style="font-size:14px">Alle zuklappen</button></div>`
    : '<div class="card"><div class="empty">Keine Quelle passt zu diesen Filtern.</div></div>';

  $$('#qu-liste .gebiet').forEach(d2=>d2.ontoggle=()=>{
    if(d2.open) QU_OFFEN.add(d2.dataset.gebiet); else QU_OFFEN.delete(d2.dataset.gebiet);
  });
  const alle=$('#qu-alle'), keine=$('#qu-keine'), frei=$('#qu-frei');
  if(alle) alle.onclick=()=>{ QU_KATS.forEach(k2=>QU_OFFEN.add(k2.schluessel)); quellenListe(); };
  if(keine) keine.onclick=()=>{ QU_OFFEN.clear(); quellenListe(); };
  if(frei) frei.onclick=()=>{
    $('#qu-suche').value=''; $('#qu-kat').value=''; $('#qu-datei').value='';
    if($('#qu-stufe')) $('#qu-stufe').value=''; quellenListe();
  };
  const zeig=$('#qu-zeigeohne');
  if(zeig) zeig.onclick=()=>{ $('#qu-stufe').value='abseits'; quellenListe(); $('#qu-liste').scrollIntoView({behavior:'smooth'}); };
  const raus=$('#qu-raus');
  if(raus) raus.onclick=()=>ohneBezugEntfernen();
  $$('#qu-liste [data-bearb]').forEach(b=>b.onclick=()=>quelleBearbeiten(QU_ALLE.find(q=>q.id===b.dataset.bearb)));
  $$('#qu-liste [data-weg]').forEach(b=>b.onclick=()=>quelleLoeschen(QU_ALLE.find(q=>q.id===b.dataset.weg)));
  $$('#qu-liste [data-hoch]').forEach(b=>b.onclick=()=>quelleHochladen(QU_ALLE.find(q=>q.id===b.dataset.hoch)));
  $$('#qu-liste [data-lade]').forEach(b=>b.onclick=()=>quelleOeffnen(QU_ALLE.find(q=>q.id===b.dataset.lade)));
}

function dialog(inhalt){
  const alt=$('#dlg'); if(alt) alt.remove();
  const d=document.createElement('div');
  d.id='dlg';
  d.style.cssText='position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.42);display:grid;place-items:center;padding:20px;overflow:auto';
  d.innerHTML=`<div class="card pad" style="width:100%;max-width:520px;background:#fff;max-height:90vh;overflow:auto">${inhalt}</div>`;
  d.onclick=e=>{ if(e.target===d) d.remove(); };
  document.body.appendChild(d);
  return d;
}

function quelleBearbeiten(q){
  const neu=!q;
  const d=dialog(`
    <h2 style="margin-bottom:6px">${neu?'Quelle hinzufügen':'Quelle bearbeiten'}</h2>
    <p class="small mute" style="margin-bottom:20px">Herausgeber und Einstufung machen sichtbar, wie belastbar eine Quelle ist.</p>
    <div style="display:flex;flex-direction:column;gap:16px">
      <label class="fld">Titel<input id="d-titel" value="${esc(q?q.titel:'')}"></label>
      <label class="fld">Sachgebiet<select id="d-kat">${QU_KATS.map(k=>`<option value="${esc(k.schluessel)}" ${q&&q.kategorie===k.schluessel?'selected':''}>${esc(k.bezeichnung)}</option>`).join('')}</select></label>
      <label class="fld">Herausgeber<input id="d-geber" value="${esc(q&&q.herausgeber?q.herausgeber:'')}" placeholder="z. B. Bundeszentrale für politische Bildung"></label>
      <label class="fld">Einstufung<select id="d-stufe">${Object.entries(STUFE).map(([k,v])=>
        `<option value="${k}" ${q&&(q.einstufung||'sonstige')===k?'selected':''}>${esc(v.kurz)} – ${esc(v.lang)}</option>`).join('')}</select></label>
      <label class="fld">Prüfungsbezug<select id="d-bezug">${Object.entries(BEZUG).map(([k,v])=>
        `<option value="${k}" ${q&&(q.relevanz||'ergaenzend')===k?'selected':''}>${esc(v.kurz)} – ${esc(v.lang)}</option>`).join('')}</select></label>
      <label class="fld">Fundstelle<input id="d-herkunft" value="${esc(q&&q.herkunft?q.herkunft:'')}" placeholder="z. B. Informationen zur politischen Bildung 345"></label>
      <label class="fld">Dateiname<input id="d-datei" value="${esc(q?q.dateiname:'')}" spellcheck="false"></label>
      <label class="fld">Bemerkung<textarea id="d-bem" rows="2">${esc(q&&q.bemerkung?q.bemerkung:'')}</textarea></label>
      ${q&&q.vorhanden?`<div class="small mute">Datei liegt im Cloudspeicher (${mb(q.groesse)}).
        <button class="link" id="d-ersetzen" style="font-size:14px">Durch neue Datei ersetzen</button></div>`:''}
      <div id="d-fehler"></div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn ghost" id="d-ab">Abbrechen</button>
        <button class="btn" id="d-ok">Speichern</button>
      </div>
    </div>`);
  $('#d-ab').onclick=()=>d.remove();
  const ers=$('#d-ersetzen');
  if(ers) ers.onclick=()=>{ d.remove(); quelleHochladen(q); };
  $('#d-ok').onclick=async ()=>{
    const titel=$('#d-titel').value.trim(), datei=$('#d-datei').value.trim();
    if(!titel||!datei){ $('#d-fehler').innerHTML='<div class="hinweis fehler">Titel und Dateiname sind Pflicht.</div>'; return; }
    const satz={kategorie:$('#d-kat').value, titel, dateiname:datei,
                herausgeber:$('#d-geber').value.trim()||'Herkunft nicht vermerkt',
                einstufung:$('#d-stufe').value, relevanz:$('#d-bezug').value,
                herkunft:$('#d-herkunft').value.trim()||null, bemerkung:$('#d-bem').value.trim()||null};
    const {error} = neu ? await sb.from('quelle').insert(satz)
                        : await sb.from('quelle').update(satz).eq('id', q.id);
    if(error){ $('#d-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(error))}</div>`; return; }
    d.remove(); toast(neu?'Quelle angelegt.':'Quelle gespeichert.'); renderQuellen();
  };
}

/* Alle als "ohne Prüfungsbezug" eingestufte Quellen samt Datei entfernen. */
async function ohneBezugEntfernen(){
  const weg = QU_ALLE.filter(q=>q.relevanz==='abseits');
  if(!weg.length) return;
  const liste = weg.map(q=>'· '+q.titel).join('\n');
  if(!confirm('Diese '+weg.length+' Quellen mitsamt ihren Dateien entfernen?\n\n'+liste
              +'\n\nDie Fragen bleiben davon unberührt. Die Dateien liegen weiterhin auf deinem Rechner.')) return;
  toast('Wird entfernt …');
  const pfade = weg.map(q=>q.pfad).filter(Boolean);
  if(pfade.length) await sb.storage.from('quellen').remove(pfade);
  const {error} = await sb.from('quelle').delete().in('id', weg.map(q=>q.id));
  if(error){ toast(fehlertext(error)); return; }
  toast(weg.length+' Quellen entfernt.');
  renderQuellen();
}

async function quelleLoeschen(q){
  if(!confirm('„'+q.titel+'“ wirklich löschen? Auch die Datei im Cloudspeicher wird entfernt.')) return;
  if(q.pfad) await sb.storage.from('quellen').remove([q.pfad]);
  const {error} = await sb.from('quelle').delete().eq('id', q.id);
  if(error){ toast(fehlertext(error)); return; }
  toast('Quelle gelöscht.'); renderQuellen();
}

function quelleHochladen(q){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.pdf,.txt,.md,.doc,.docx,application/pdf,text/plain';
  inp.onchange=async ()=>{
    const f=inp.files[0]; if(!f) return;
    if(f.size > 100*1024*1024){ toast('Die Datei ist größer als 100 MB.'); return; }
    toast('Datei wird hochgeladen …');
    const pfad = q.kategorie+'/'+(q.dateiname||f.name);
    const {error} = await sb.storage.from('quellen').upload(pfad, f, {upsert:true, contentType:f.type||'application/pdf'});
    if(error){ toast(fehlertext(error)); return; }
    const {error:e2} = await sb.from('quelle').update({pfad, groesse:f.size, vorhanden:true, hochgeladen_von:PROFIL.id}).eq('id', q.id);
    if(e2){ toast(fehlertext(e2)); return; }
    toast('„'+q.titel+'“ ist im Cloudspeicher.'); renderQuellen();
  };
  inp.click();
}

async function quelleOeffnen(q){
  const {data, error} = await sb.storage.from('quellen').createSignedUrl(q.pfad, 3600);
  if(error||!data){ toast(fehlertext(error||'Datei nicht gefunden.')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

/* =====================================================================
   NUTZERVERWALTUNG (nur Administratoren)
   ===================================================================== */
function einladungsLink(token){
  return location.origin + location.pathname + '?einladung=' + encodeURIComponent(token);
}

async function renderNutzer(){
  if(!istAdmin()){ go('dash'); return; }
  $('#ei-los').onclick = async ()=>{
    const b=$('#ei-los'); b.disabled=true;
    const {data, error} = await sb.rpc('einladung_erzeugen', {
      p_email: $('#ei-mail').value.trim()||null,
      p_rolle: $('#ei-rolle').value,
      p_bemerkung: null,
      p_tage: Math.max(1, Math.min(365, parseInt($('#ei-tage').value)||21))
    });
    b.disabled=false;
    if(error||!data){ $('#ei-ergebnis').innerHTML=`<div class="hinweis fehler" style="margin-top:20px">${esc(fehlertext(error))}</div>`; return; }
    const link=einladungsLink(data.token);
    $('#ei-ergebnis').innerHTML=`
      <div class="hinweis gut" style="margin-top:22px">
        <b>Einladung erzeugt.</b> Gültig bis ${datumLang(data.gueltig_bis)}${data.email?' · gebunden an '+esc(data.email):''}.
        <div style="margin-top:12px"><input id="ei-link" readonly value="${esc(link)}" style="font-size:13px"></div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn sm" id="ei-kopie">Link kopieren</button>
          <button class="btn ghost sm" id="ei-mailto">Als E-Mail öffnen</button>
        </div>
      </div>`;
    $('#ei-kopie').onclick=async ()=>{
      try{ await navigator.clipboard.writeText(link); toast('Link kopiert.'); }
      catch(e){ $('#ei-link').select(); document.execCommand('copy'); toast('Link kopiert.'); }
    };
    $('#ei-mailto').onclick=()=>{
      const betreff='Zugang zum Testtrainer für das Auswahlverfahren';
      const text='Hallo,\n\nüber diesen Link kannst du dir einen Zugang zum Testtrainer anlegen:\n\n'+link+
                 '\n\nDer Link ist bis zum '+datumLang(data.gueltig_bis)+' gültig und nur einmal verwendbar.\n\nViele Grüße';
      location.href='mailto:'+(data.email||'')+'?subject='+encodeURIComponent(betreff)+'&body='+encodeURIComponent(text);
    };
    nutzerlisten();
  };
  nutzerlisten();
}

async function nutzerlisten(){
  const {data:nu, error} = await sb.rpc('nutzeruebersicht');
  if(error){ $('#nu-liste').innerHTML=`<div class="empty">${esc(fehlertext(error))}</div>`; }
  else {
    $('#nu-note').textContent = nu.length + (nu.length===1?' Konto':' Konten');
    $('#nu-liste').innerHTML = nu.length ? nu.map(u=>`
      <div class="konto">
        <span class="wer"><b>${esc(u.name||'ohne Namen')}${u.id===PROFIL.id?' · du':''}</b>
          <span>${esc(u.email)}</span></span>
        <span class="wahl">
          <label>Rolle<select data-rolle="${u.id}">
            <option value="nutzer" ${u.rolle==='nutzer'?'selected':''}>Nutzer</option>
            <option value="admin" ${u.rolle==='admin'?'selected':''}>Administrator</option></select></label>
          <label>Status<select data-status="${u.id}">
            <option value="aktiv" ${u.status==='aktiv'?'selected':''}>aktiv</option>
            <option value="wartend" ${u.status==='wartend'?'selected':''}>wartend</option>
            <option value="gesperrt" ${u.status==='gesperrt'?'selected':''}>gesperrt</option></select></label>
        </span>
        <span class="zahlen">${u.durchgaenge} ${u.durchgaenge===1?'Durchgang':'Durchgänge'}<br>
          ${u.antworten} ${u.antworten===1?'Antwort':'Antworten'}${u.quote!=null?' · '+u.quote+' %':''}</span>
        <span class="akt">
          <button class="btn ghost sm" data-pw="${u.id}" data-mail="${esc(u.email)}">Passwort</button>
          ${u.id===PROFIL.id?'':`<button class="btn ghost sm gefahr" data-del="${u.id}" data-mail="${esc(u.email)}">Löschen</button>`}
        </span>
      </div>`).join('')
      : '<div class="empty">Noch kein Konto angelegt.</div>';

    $$('#nu-liste [data-rolle]').forEach(s=>s.onchange=async ()=>{
      const {error} = await sb.from('profile').update({rolle:s.value}).eq('id', s.dataset.rolle);
      toast(error? fehlertext(error) : 'Rolle geändert.');
      if(s.dataset.rolle===PROFIL.id){ PROFIL.rolle=s.value; navBauen(); }
    });
    $$('#nu-liste [data-status]').forEach(s=>s.onchange=async ()=>{
      const {error} = await sb.from('profile').update({status:s.value}).eq('id', s.dataset.status);
      toast(error? fehlertext(error) : 'Status geändert.');
    });
    $$('#nu-liste [data-pw]').forEach(b=>b.onclick=()=>passwortSetzen(b.dataset.pw, b.dataset.mail));
    $$('#nu-liste [data-del]').forEach(b=>b.onclick=()=>nutzerLoeschen(b.dataset.del, b.dataset.mail));
  }

  const {data:ei} = await sb.from('einladung').select('*').is('eingeloest_am', null).order('erstellt_am', {ascending:false});
  $('#ei-liste').innerHTML = (ei&&ei.length) ? ei.map(e=>{
      const abgelaufen = new Date(e.gueltig_bis) < new Date();
      return `<div class="einladung${abgelaufen?' alt':''}">
        <span class="code">${esc(e.token)}</span>
        <span class="wem">${esc(e.email||'an niemanden gebunden')} · ${e.rolle==='admin'?'Administrator':'Nutzer'}
          · ${abgelaufen?'<b style="color:var(--bad)">abgelaufen am '+datumLang(e.gueltig_bis)+'</b>':'gültig bis '+datumLang(e.gueltig_bis)}</span>
        <span class="akt">
          <button class="btn ghost sm" data-kop="${esc(e.token)}">Link kopieren</button>
          <button class="btn ghost sm gefahr" data-eiweg="${esc(e.token)}">Zurückziehen</button>
        </span>
      </div>`;
    }).join('')
    : '<div class="empty">Keine offene Einladung.</div>';

  $$('#ei-liste [data-kop]').forEach(b=>b.onclick=async ()=>{
    try{ await navigator.clipboard.writeText(einladungsLink(b.dataset.kop)); toast('Link kopiert.'); }
    catch(e){ prompt('Einladungslink:', einladungsLink(b.dataset.kop)); }
  });
  $$('#ei-liste [data-eiweg]').forEach(b=>b.onclick=async ()=>{
    if(!confirm('Diese Einladung zurückziehen?')) return;
    const {error} = await sb.from('einladung').delete().eq('token', b.dataset.eiweg);
    toast(error? fehlertext(error):'Einladung zurückgezogen.'); nutzerlisten();
  });
}

async function funktionRufen(name, koerper){
  const {data:{session}} = await sb.auth.getSession();
  const r = await fetch(SB_URL+'/functions/v1/'+name, {
    method:'POST',
    headers:{'Content-Type':'application/json', apikey:SB_KEY, Authorization:'Bearer '+(session?.access_token||'')},
    body: JSON.stringify(koerper)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.fehler || j.error || ('Fehler '+r.status));
  return j;
}

function passwortSetzen(id, mail){
  const d=dialog(`
    <h2 style="margin-bottom:8px">Passwort neu setzen</h2>
    <p class="small mute" style="margin-bottom:20px">Für ${esc(mail)}. Das neue Passwort gilt sofort; teile es der Person auf sicherem Weg mit.</p>
    <div style="display:flex;flex-direction:column;gap:16px">
      <label class="fld">Neues Passwort<input id="p-neu" type="text" minlength="8" value=""></label>
      <div id="p-fehler"></div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn ghost" id="p-ab">Abbrechen</button>
        <button class="btn" id="p-ok">Setzen</button>
      </div>
    </div>`);
  const zufall = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map(b=>'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%56]).join('');
  $('#p-neu').value = zufall;
  $('#p-ab').onclick=()=>d.remove();
  $('#p-ok').onclick=async ()=>{
    const pw=$('#p-neu').value;
    if(pw.length<8){ $('#p-fehler').innerHTML='<div class="hinweis fehler">Mindestens acht Zeichen.</div>'; return; }
    try{ await funktionRufen('nutzer-verwalten', {aktion:'passwort', id, passwort:pw});
         d.remove(); toast('Passwort gesetzt.'); }
    catch(e){ $('#p-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(e))}</div>`; }
  };
}

async function nutzerLoeschen(id, mail){
  if(!confirm('Konto '+mail+' endgültig löschen? Alle Ergebnisse dieser Person gehen verloren.')) return;
  try{ await funktionRufen('nutzer-verwalten', {aktion:'loeschen', id}); toast('Konto gelöscht.'); nutzerlisten(); }
  catch(e){ toast(fehlertext(e)); }
}

/* =====================================================================
   KONTO
   ===================================================================== */
function renderKonto(){
  const offen = warteschlange().length;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const schritte = [
    ['Diese Adresse auf dem iPhone in <b>Safari</b> öffnen',
     'Nur Safari kann ein Symbol anlegen – nicht Chrome und nicht die Vorschau innerhalb einer anderen App.'],
    ['Unten auf <b>Teilen</b> tippen',
     'Das Quadrat mit dem Pfeil nach oben, in der Leiste am unteren Bildschirmrand.'],
    ['<b>Zum Home-Bildschirm</b> wählen',
     'In der Liste etwas nach unten wischen. Danach oben rechts auf <b>Hinzufügen</b> tippen.'],
    ['Fertig',
     'Der Testtrainer liegt nun als Symbol auf dem Home-Bildschirm und startet ohne Adressleiste – wie eine App.']];

  $('#konto-inhalt').innerHTML = `
    <div class="sec" style="margin-top:0">
      <div class="sec-h"><h2>Auf dem iPhone installieren</h2><span class="note">kostenlos, ohne App Store</span></div>
      ${standalone
        ? '<div class="hinweis gut"><b>Erledigt.</b> Der Testtrainer läuft bereits als installierte App.</div>'
        : `<div class="card pad">
            <p style="font-size:17px;margin-bottom:6px"><b>Der Testtrainer lässt sich wie eine App auf dem Telefon ablegen.</b></p>
            <p class="small mute" style="margin-bottom:22px">Kein App Store, keine Installation, keine Kosten – der Browser legt lediglich ein Symbol auf den Home-Bildschirm.</p>
            <ol style="margin:0;padding-left:22px;display:flex;flex-direction:column;gap:16px">
              ${schritte.map(([t,e])=>`<li style="padding-left:4px">
                 <div style="font-size:16px;color:var(--ink)">${t}</div>
                 <div class="small mute" style="margin-top:4px">${e}</div></li>`).join('')}
            </ol>
            <div class="hinweis" style="margin:24px 0 0">Die Anmeldung bleibt erhalten. Fragen werden zwischengespeichert und
              stehen auch ohne Netz zur Verfügung; Ergebnisse werden nachgereicht, sobald wieder Netz da ist.</div>
            <div class="small mute" style="margin-top:18px">Adresse zum Weitergeben:<br>
              <span style="font-family:var(--mono);font-size:13px;color:var(--ink);overflow-wrap:anywhere">${esc(location.origin+location.pathname)}</span>
              <button class="link" id="k-adresse" style="font-size:13px;margin-left:10px">kopieren</button></div>
            <div class="small mute" style="margin-top:14px"><b>Android:</b> im Browsermenü (drei Punkte oben rechts)
              <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b> wählen.</div>
          </div>`}
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Zugang</h2></div>
      <div class="card pad">
        <div style="display:flex;flex-direction:column;gap:16px;max-width:420px">
          <label class="fld">Name<input id="k-name" value="${esc(PROFIL.name||'')}"></label>
          <div class="small mute">${esc(PROFIL.email)} · ${PROFIL.rolle==='admin'?'Administrator':'Nutzer'} · Konto seit ${datumLang(PROFIL.angelegt_am)}</div>
          <div id="k-fehler"></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn" id="k-name-ok">Namen speichern</button>
            <button class="btn ghost" id="k-pw">Passwort ändern</button>
          </div>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Fortschritt</h2><span class="note">${S.antworten.length} Antworten · ${S.sessions.length} Durchgänge</span></div>
      <p class="small mute" style="margin-bottom:20px">Deine Ergebnisse liegen in deinem Konto und stehen auf jedem Gerät zur Verfügung, auf dem du dich anmeldest.
      ${offen?`<b style="color:var(--bad)">${offen} Durchgang/Durchgänge warten noch auf die Übertragung.</b>`:''}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn ghost" id="k-exp">Als JSON sichern</button>
        <button class="btn ghost" id="k-csv">Antworten als CSV</button>
        ${offen?'<button class="btn" id="k-sync">Jetzt übertragen</button>':''}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Bestand</h2></div>
      <p class="small" id="k-pool"></p>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Abmelden</h2></div>
      <button class="btn ghost" id="k-out">Abmelden</button>
    </div>`;

  const bl=[...new Set(ALLES.map(q=>q.block))];
  $('#k-pool').innerHTML = `<b>${ALLES.length} Fragen</b> in ${bl.length} Abschnitten · `
    + ALLE.map(k=>KAT[k].kurz+' '+F.filter(q=>q.kategorie===k).length).join(' · ') + ' · Französisch '+FR.length;

  const adr=$('#k-adresse');
  if(adr) adr.onclick=async ()=>{
    try{ await navigator.clipboard.writeText(location.origin+location.pathname); toast('Adresse kopiert.'); }
    catch(e){ prompt('Adresse:', location.origin+location.pathname); }
  };
  $('#k-name-ok').onclick=async ()=>{
    const n=$('#k-name').value.trim();
    const {error} = await sb.from('profile').update({name:n}).eq('id', PROFIL.id);
    if(error){ $('#k-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(error))}</div>`; return; }
    PROFIL.name=n; toast('Gespeichert.');
  };
  $('#k-pw').onclick=()=>{
    const d=dialog(`<h2 style="margin-bottom:20px">Passwort ändern</h2>
      <div style="display:flex;flex-direction:column;gap:16px">
        <label class="fld">Neues Passwort<input type="password" id="n1" minlength="8" autocomplete="new-password"></label>
        <label class="fld">Wiederholen<input type="password" id="n2" minlength="8" autocomplete="new-password"></label>
        <div id="n-fehler"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button class="btn ghost" id="n-ab">Abbrechen</button><button class="btn" id="n-ok">Ändern</button></div>
      </div>`);
    $('#n-ab').onclick=()=>d.remove();
    $('#n-ok').onclick=async ()=>{
      if($('#n1').value.length<8){ $('#n-fehler').innerHTML='<div class="hinweis fehler">Mindestens acht Zeichen.</div>'; return; }
      if($('#n1').value!==$('#n2').value){ $('#n-fehler').innerHTML='<div class="hinweis fehler">Die Eingaben stimmen nicht überein.</div>'; return; }
      const {error} = await sb.auth.updateUser({password:$('#n1').value});
      if(error){ $('#n-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(error))}</div>`; return; }
      d.remove(); toast('Passwort geändert.');
    };
  };
  $('#k-exp').onclick=()=>dl('testtrainer-fortschritt-'+heute()+'.json', JSON.stringify(S,null,1),'application/json');
  $('#k-csv').onclick=()=>{
    const z=['datum;zeit;kategorie;frage_id;thema;gewaehlt;richtig;korrekt'];
    for(const a of S.antworten){ const q=BY_ID[a.id]||{};
      z.push([a.datum,(a.ts||'').slice(11,19),a.kat,a.id,'"'+String(q.thema||'').replace(/"/g,'""')+'"',LTR[a.gew],LTR[q.loesung],a.ok?1:0].join(';')); }
    dl('testtrainer-antworten-'+heute()+'.csv','﻿'+z.join('\n'),'text/csv');
  };
  const sy=$('#k-sync'); if(sy) sy.onclick=async ()=>{ await warteschlangeAbarbeiten(); renderKonto(); };
  $('#k-out').onclick=abmelden;
}

function dl(name, text, typ){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:typ})); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* =====================================================================
   START
   ===================================================================== */
function fehlerseite(titel, text){
  $('#laden').classList.add('weg');
  $('#anmeldung').classList.remove('on');
  $('#app').style.display='';
  $('#nav').innerHTML='';
  $$('.view').forEach(s=>s.classList.remove('on'));
  $('#v-dash').classList.add('on');
  $('#v-dash').innerHTML=`<div class="wrap page"><h1>${esc(titel)}</h1><p class="lead">${text}</p></div>`;
}

async function starten(){
  $('#laden').classList.remove('weg');
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ zeigeAnmeldung(); return; }

  const {data:prof, error} = await sb.from('profile').select('*').eq('id', session.user.id).maybeSingle();
  if(error || !prof){
    await sb.auth.signOut();
    zeigeAnmeldung();
    toast('Zu diesem Zugang gibt es kein Profil. Bitte an einen Administrator wenden.');
    return;
  }
  if(prof.status!=='aktiv'){
    await sb.auth.signOut();
    zeigeAnmeldung();
    toast(prof.status==='gesperrt' ? 'Dieses Konto ist gesperrt.' : 'Dieses Konto ist noch nicht freigeschaltet.');
    return;
  }
  PROFIL = prof;

  $('#anmeldung').classList.remove('on');
  $('#app').style.display='';
  schaleBauen();
  navBauen();

  const ok = await ladeFragen();
  if(!ok){ fehlerseite('Keine Verbindung', 'Die Fragen konnten nicht geladen werden und liegen auch nicht im Zwischenspeicher. Bitte später erneut versuchen.'); return; }
  await ladeFortschritt();
  warteschlangeAbarbeiten();
  sb.rpc('aktiv_melden').then(()=>{}, ()=>{});

  $('#laden').classList.add('weg');
  renderMenu();
  if(WIEDERHERSTELLUNG){
    history.replaceState(null, '', location.pathname);
    go('konto');
    toast('Bitte jetzt ein neues Passwort vergeben.');
  } else {
    go('dash');
  }
  setInterval(countdown, 60000);
}

$('#marke-heim').onclick = (e)=>{ e.preventDefault(); if(PROFIL) go('dash'); };
window.addEventListener('online', ()=>{ if(PROFIL) warteschlangeAbarbeiten(); });

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

starten();
