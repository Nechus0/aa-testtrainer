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
const CACHE_LAUF    = 'aa_lauf_v1';

/* ---------- Laufzeitzustand ---------- */
let PROFIL = null;                       // Zeile aus public.profile
let F = [], FR = [], ALLES = [], BY_ID = {};
let S = {antworten:[], sessions:[]};
let MARKIERT = new Set();   /* dauerhafte Markierungen, überdauern den Durchgang */
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
/* Lesetext des Sprachtests. Im Durchgang mit eigener Höhe und zwei Schaltern,
   in der Durchsicht ohne – der Aufbau bleibt derselbe, damit die Gestaltung greift. */
let TEXT_ZU=false, TEXT_VOLL=false, TEXT_AKT=null;
function artikelHtml(q, bedienbar){
  if(!q.text) return '';
  const inhalt = `<div class="text">${absatz(q.text)}${q.quelle?`<div class="q">${esc(q.quelle)}</div>`:''}</div>`;
  if(!bedienbar)
    return `<div class="artikel voll">${q.titel?`<div class="kopf statisch"><span>${esc(q.titel)}</span></div>`:''}${inhalt}</div>`;
  return `<div class="artikel${TEXT_ZU?' zu':''}${TEXT_VOLL?' voll':''}">
      <button class="kopf" id="t-zu">
        <span>${esc(q.titel||'Text')}<small>Lesetext zu den folgenden Aufgaben</small></span>
        <i class="pfeil">⌃</i>
      </button>
      ${inhalt}
      <button class="mehrlesen" id="t-voll">${TEXT_VOLL?'Weniger anzeigen':'Ganz lesen'}</button>
    </div>`;
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
    const [a, d, m] = await Promise.all([
      alleZeilen('antwort','frage_id,kat,gewaehlt,richtig,datum,ts'),
      alleZeilen('durchgang','id,datum,ts,titel,n,richtig,quote,punkte,max_punkte,dauer,kats'),
      alleZeilen('markierung','frage_id')
    ]);
    MARKIERT = new Set((m||[]).map(r=>r.frage_id));
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

async function markierungSetzen(frageId, an){
  if(an) MARKIERT.add(frageId); else MARKIERT.delete(frageId);
  try{
    if(an) await sb.from('markierung').upsert({nutzer:PROFIL.id, frage_id:frageId});
    else   await sb.from('markierung').delete().eq('nutzer',PROFIL.id).eq('frage_id',frageId);
  }catch(e){ /* offline: die Markierung gilt in dieser Sitzung */ }
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
/* Beide Formate zeigen dieselben vier Bereiche. */
const HAUPT = [['dash','Übersicht'], ['train','Trainer'], ['fragen','Fragen'], ['mehr','Mehr']];
const engesGeraet = ()=> matchMedia('(max-width:720px)').matches;

/* Unterseiten von "Mehr" färben den Reiter mit ein. */
const UNTER_MEHR = ['mehr','konto','quellen','nutzer','tagesstand'];
function navBauen(){
  $('#nav').innerHTML = HAUPT.map(([v,t])=>{
    const an = v===ANSICHT || (v==='mehr' && UNTER_MEHR.includes(ANSICHT));
    return `<button data-v="${v}" class="${an?'on':''}">${t}</button>`;
  }).join('');
  $('#navpop').innerHTML='';
  $$('#nav button[data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
}

function schaleBauen(){
  $('#v-dash').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Auswahlverfahren<span class="kopfrechts" id="kopf-serie"></span></div>
      <div class="row">
        <div style="flex:1;min-width:280px">
          <h1>Übersicht</h1>
          <p class="lead" id="dash-lead">Dein Stand in den drei Fachtests des schriftlichen Auswahlverfahrens.</p>
        </div>
      </div>
    </div>
    <div class="wrap">
      <div class="cdcard">
        <span class="n" id="cd-n">–</span>
        <span class="t"><b id="cd-u">Tage bis zur Prüfung</b><i>Dienstag, 1. September 2026</i></span>
      </div>
      <div id="offener-lauf"></div>
      <div class="sec" style="margin-top:0">
        <div class="sec-h"><h2>Heute</h2><span class="note" id="tag-note"></span></div>
        <div id="tagesaufgaben"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Dein Stand</h2><span class="note">über den gesamten Bestand</span></div>
        <div class="grid g4" id="kpis"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Nach Prüfungsteil</h2><span class="note">Trefferquote und Bearbeitungsstand</span></div>
        <div id="standkarten"></div>
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
        <p class="lead">Selbst zusammenstellen oder einen vorgegebenen Test im Originalformat starten.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="segmente" id="tr-seg">
        <button class="seg-btn an" data-seg="frei">Selbst wählen</button>
        <button class="seg-btn" data-seg="tests">Vorgegebene Tests</button>
      </div>
      <div id="tr-pane-frei">
        <div id="trainer"></div>
      </div>
      <div id="tr-pane-tests" hidden>
        <div class="sec" style="margin-top:0">
          <div class="sec-h"><h2>Prüfungssimulation</h2><span class="note">Originalformat mit Prüfungszeit</span></div>
          <div class="modes" id="modes-exam"></div>
        </div>
        <div class="sec">
          <div class="sec-h"><h2>Alle Tagespakete</h2><span class="note" id="pakete-note"></span></div>
          <div class="card" id="pakete"></div>
        </div>
      </div>
    </div>`;

  $('#v-fragen').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Bestand</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Fragen</h1>
        <p class="lead">Alle Fragen zum Nachschlagen, mit Lösung und Erläuterung.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="statusfilter" id="q-status"></div>
      <div class="suchzeile">
        <input type="search" id="q-search" placeholder="Stichwort, Norm, Begriff …">
        <button class="btn ghost" id="q-filter-auf" aria-expanded="false">Filter</button>
      </div>
      <div class="zahlzeile" id="q-zahl"></div>
      <div class="filterbox" id="q-filter" hidden>
        <label class="fld">Prüfungsteil<select id="q-kat"></select></label>
        <label class="fld">Abschnitt<select id="q-block"></select></label>
        <button class="link" id="q-reset">Filter zurücksetzen</button>
      </div>
      <div id="q-kopf"></div>
      <div id="poollist"></div>
      <div class="sec">
        <div class="sec-h"><h2>Abdeckung des Lehrplans</h2><span class="note" id="lp-note"></span></div>
        <div id="lehrplan"></div>
      </div>
    </div>`;

  $('#v-mehr').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Konto und Verwaltung</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Mehr</h1>
        <p class="lead">Konto, Quellen und Fortschritt.</p>
      </div></div>
    </div>
    <div class="wrap"><div class="mehrgitter" id="mehrgitter"></div></div>`;

  $('#v-tagesstand').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow"><button class="link" data-zurueck="1" style="font-size:12.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:var(--muted-2);text-decoration:none">← Mehr</button></div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Tägliche Fragen</h1>
        <p class="lead">Wann der letzte Abschnitt kam und wann der nächste kommt.</p>
      </div></div>
    </div>
    <div class="wrap"><div id="ts-inhalt"></div></div>`;

  $('#v-quellen').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow"><button class="link" data-zurueck="1" style="font-size:12.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:var(--muted-2);text-decoration:none">← Mehr</button></div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Quellen</h1>
        <p class="lead">Grundlage der täglich erzeugten Fragen. Jeder Zugang kann Dokumente aufnehmen und entfernen – der Bestand ist gemeinsam.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="card pad" id="qu-filterkarte" style="display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:26px">
        <label class="fld" style="flex:1;min-width:220px">Suche<input type="search" id="qu-suche" placeholder="Titel oder Dateiname"></label>
        <label class="fld" style="flex:1;min-width:170px">Prüfungsteil<select id="qu-kat"></select></label>
        <label class="fld" style="flex:1;min-width:160px">Prüfungsbezug<select id="qu-stufe">
          <option value="">alle</option><option value="kern">Kernquellen</option>
          <option value="ergaenzend">Ergänzungen</option><option value="abseits">ohne Bezug</option></select></label>
        <label class="fld" style="flex:1;min-width:150px">Vorliegen<select id="qu-datei">
          <option value="">alle</option>
          <option value="text">Volltext gelesen</option>
          <option value="ohnetext">ohne Volltext</option></select></label>
        <button class="btn sm" id="qu-neu">Quellen aufnehmen</button>
      </div>
      <div id="qu-stat" class="small mute" style="margin-bottom:12px"></div>
      <div id="qu-schalter" class="small" style="margin-bottom:14px"></div>
      <div id="qu-liste"></div>
    </div>`;

  $('#v-nutzer').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow"><button class="link" data-zurueck="1" style="font-size:12.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:var(--muted-2);text-decoration:none">← Mehr</button></div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Nutzer</h1>
        <p class="lead">Konten, Rollen und Einladungslinks.</p>
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
      <div class="eyebrow"><button class="link" data-zurueck="1" style="font-size:12.5px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:var(--muted-2);text-decoration:none">← Mehr</button></div>
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
  const d=Math.ceil(t/864e5);
  const n=$('#cd-n'); if(!n) return;
  n.textContent = t? d : 0;
  $('#cd-u').textContent = (t && d===1) ? 'Tag bis zur Prüfung' : 'Tage bis zur Prüfung';
}

/* ---------- Router ---------- */
function go(v){
  ANSICHT=v;
  navBauen();
  setTimeout(()=>$$('[data-zurueck]').forEach(b=>b.onclick=()=>go('mehr')), 0);
  $$('.view').forEach(s=>s.classList.toggle('on', s.id==='v-'+v));
  window.scrollTo({top:0});
  if(v==='dash') renderDash();
  if(v==='train'){ if(!LAUF || LAUF.phase==='ergebnis'){ LAUF=null; renderMenu(); } }
  if(v==='fragen') renderFragen();
  if(v==='mehr') renderMehr();
  if(v==='tagesstand') renderTagesstand();
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
  $('#dash-lead').textContent = (vn? vn+', d':'D')+'ein Stand in den drei Fachtests und im Sprachtest Französisch.';
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

  /* Alle vier Prüfungsteile in derselben Form – Fachtests und Sprachtest gleichrangig. */
  const fr=statsFr(), lf=fr.letzte;
  const karten = ALLE.map(k=>{
      const s=statsKat(k), sess=S.sessions.filter(x=>x.kats.includes(k)).slice(-5);
      return {kls:k, marke:KAT[k].kurz, name:KAT[k].name, quote:s.versuche? s.quote:null,
              gesehen:s.gesehen, pool:s.pool, offen:s.offen,
              trend: sess.length>=2 ? (sess.at(-1).quote - sess[0].quote) : null,
              fuss:'Prüfungsformat: 25 Fragen in 10 Minuten'};
    }).concat([{kls:'franzoesisch', marke:KAT_FR.kurz, name:KAT_FR.name,
      quote: fr.versuche? fr.quote:null, gesehen:fr.gesehen, pool:fr.pool, offen:fr.offen, trend:null,
      fuss: lf && lf.maxPunkte===FR_META.punkte
        ? 'Letzter Sprachtest: '+lf.punkte+' von '+FR_META.punkte+' Punkten · '+(lf.punkte>=FR_META.bestanden?'bestanden':'nicht bestanden')
        : 'Prüfungsformat: 52 Aufgaben in 30 Minuten, bestanden ab 30 Punkten'}]);

  $('#standkarten').innerHTML = `<div class="card liste">${karten.map(c=>`
    <div class="zeile standzeile k-${c.kls}">
      <span class="pt"></span>
      <span class="mitte">
        <span class="nm">${esc(c.name)}</span>
        <span class="sub"><b class="tnum">${c.gesehen}</b> / ${c.pool} bearbeitet · <b class="tnum">${c.offen}</b> offen${
          c.trend!==null?` · <span style="color:${c.trend>0?'var(--ok)':c.trend<0?'var(--bad)':'var(--muted-2)'}">${c.trend>0?'▲':c.trend<0?'▼':'▬'} ${Math.abs(c.trend)} Pp.</span>`:''}</span>
        <span class="bar"><i style="width:${c.quote||0}%"></i></span>
      </span>
      <span class="wert tnum">${c.quote!==null? c.quote+' %' : '–'}</span>
    </div>`).join('')}</div>`;

  const serie=$('#kopf-serie');
  if(serie){ const st=streak(); serie.textContent = st? st+(st===1?' Tag Serie':' Tage Serie') : ''; }
  offenenLaufZeigen();
  tagesaufgaben(); chart(); weak(); sessionsListe();
}

/* Hinweis auf einen Durchgang, der beim letzten Mal nicht zu Ende kam. */
function offenenLaufZeigen(){
  const box=$('#offener-lauf'); if(!box) return;
  const s=laufGesichert();
  if(!s){ box.innerHTML=''; return; }
  box.innerHTML=`
    <div class="offenerlauf">
      <div class="ol-text">
        <b>Unterbrochener Durchgang</b>
        <span>${esc(s.cfg.titel||'Übung')} · ${s.beantwortet} von ${s.gesamt} beantwortet · ${
          new Date(s.ts).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} Uhr</span>
      </div>
      <div class="ol-akt">
        <button class="btn ghost sm" id="ol-weg">Verwerfen</button>
        <button class="btn sm" id="ol-weiter">Fortsetzen</button>
      </div>
    </div>`;
  $('#ol-weiter').onclick=()=>laufFortsetzen();
  $('#ol-weg').onclick=()=>{
    if(!confirm('Den unterbrochenen Durchgang verwerfen? Die bisherigen Antworten gehen verloren.')) return;
    laufVergessen(); offenenLaufZeigen(); toast('Verworfen.');
  };
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

  box.innerHTML = `<div class="card liste">${posten.map((p,i)=>{
      const auf=p.qs.filter(q=>l[q.id]).length, n=p.qs.length;
      const ok=p.qs.filter(q=>l[q.id]&&l[q.id].ok).length;
      const fertig = auf===n;
      const chip = fertig
        ? `<span class="chip-fertig" title="${ok} von ${n} richtig">erledigt</span>`
        : (auf ? `<span class="chip-stand">${auf} / ${n}</span>`
               : `<span class="chip-start">Starten</span>`);
      return `<button class="zeile tagzeile k-${p.kls}" data-tag="${i}">
        <span class="pt"></span>
        <span class="mitte">
          <span class="nm">${esc(p.name)}</span>
          <span class="sub">${esc(p.block)} · ${n} ${p.kls==='franzoesisch'?'Aufgaben':'Fragen'}</span>
          <span class="bar"><i style="width:${Math.round(auf/n*100)}%"></i></span>
        </span>
        ${chip}
      </button>`;
    }).join('')}</div>`;
  $$('#tagesaufgaben [data-tag]').forEach(b=>b.onclick=()=>start(posten[+b.dataset.tag].cfg));
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

/* Themenfeld einer Frage = ihr Oberfeld im Lehrplan. Fragen, deren Thema kein
   Lehrplanfeld nennt, kämen sonst als eigene Rubrik neben die echten Felder –
   zwei Gliederungsebenen nebeneinander. Sie laufen unter „Weitere Themen“. */
function planOberfelder(){
  const m={};
  for(const s of (LP_STAND||[])) (m[s.kategorie]=m[s.kategorie]||new Set()).add(s.oberfeld);
  return m;
}
function themenfeld(q){
  const t=(q.thema||'').trim();
  if(!t) return q.kategorie==='franzoesisch' ? (FR_TEIL[q.teil]?.kurz||'Französisch') : 'Ohne Thema';
  const ober = (t.split(/\s[–—-]\s/)[0]||t).trim();
  const bekannt = planOberfelder()[lpTeil(q)];
  return (bekannt && bekannt.size && !bekannt.has(ober)) ? SONSTIGE : ober;
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
      <span class="ct fehler">${v.n-v.ok}</span></div>`;
  }).join('')
    + `<div class="morerow" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <button class="link" id="weak-uebe">Diese Themen gezielt üben</button>
        ${alle.length>5?`<button class="link" id="weak-more" style="margin-left:auto">${
          WEAK_ALLE?'Weniger anzeigen':'Alle '+alle.length+' Themenfelder anzeigen'}</button>`:''}
      </div>`;
  const b=$('#weak-more'); if(b) b.onclick=()=>{ WEAK_ALLE=!WEAK_ALLE; weak(); };
  $('#weak-uebe').onclick=()=>{
    TR.auswahl='schwach'; TR.zeit=false;
    TR.bereiche=new Set(alle.slice(0,8).map(v=>v.kat==='franzoesisch'? null : v.kat).filter(Boolean));
    if(!TR.bereiche.size) TR.bereiche=new Set(['textverstaendnis','wortschatz','grammatik']);
    go('train');
  };
}

/* Letzte Durchgänge als Liste, nicht als Tabelle: vier Spalten brechen auf dem
   Telefon um und der Titel wird unleserlich schmal. */
function sessionsListe(){
  const rows=S.sessions.slice(-9).reverse();
  $('#sessions').innerHTML = rows.length
    ? `<div class="liste">${rows.map(s=>{
        const farbe = s.quote>=70?'var(--ok)':s.quote>=50?'var(--gold)':'var(--bad)';
        return `<div class="zeile durchgangzeile">
          <span class="mitte">
            <span class="nm">${esc(s.titel)}</span>
            <span class="sub">${datumKurz(s.datum)} · ${mmss(s.dauer)} Min</span>
          </span>
          <span class="wert tnum" style="color:${farbe}">${s.richtig}<i>/${s.n}</i></span>
        </div>`; }).join('')}</div>`
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
  {id:'schwach',name:'Schwächste Themen', erl:'Bevorzugt Themenfelder mit der niedrigsten Trefferquote.'},
  {id:'mark',   name:'Markierte Fragen',  erl:'Was du im Durchgang mit dem Sternchen versehen hast.'}
];
let TR = {bereiche:new Set(['recht','geschichte','wirtschaft']), auswahl:'alle', anzahl:25, zeit:false, offen:null};

function trBereichFragen(id){
  const b = BEREICHE.find(x=>x.id===id);
  return b.gruppe==='fach' ? F.filter(q=>q.kategorie===id) : FR.filter(q=>q.teil===id);
}
function trPool(){
  const l=letzteJeFrage();
  let pool=[...TR.bereiche].flatMap(trBereichFragen);
  if(TR.auswahl==='neu')    pool=pool.filter(q=>!l[q.id]);
  if(TR.auswahl==='fehler') pool=pool.filter(q=>l[q.id] && !l[q.id].ok);
  if(TR.auswahl==='mark')   pool=pool.filter(q=>MARKIERT.has(q.id));
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
  const stufen=[10,25,50].filter(n=>n<max);
  const nurFr = [...TR.bereiche].every(id=>BEREICHE.find(b=>b.id===id).gruppe==='fr');

  /* Drei aufklappbare Zeilen statt vier offener Blöcke: die Seite bleibt auf
     dem Telefon kurz, und was gewählt ist, steht rechts in der Zeile. */
  const gewaehlteNamen = BEREICHE.filter(b=>TR.bereiche.has(b.id)).map(b=>b.kurz);
  const bereichWert = TR.bereiche.size===BEREICHE.length ? 'alle Bereiche'
    : TR.bereiche.size<=2 ? gewaehlteNamen.join(', ')
    : TR.bereiche.size+' Bereiche';

  const zeile = (id, name, wert, inhalt) => {
    const auf = TR.offen===id;
    return `<button class="grp-zeile${auf?' auf':''}" data-auf="${id}" aria-expanded="${auf}">
        <span class="gl">${name}</span><span class="gw">${esc(wert)}</span><span class="gp"></span>
      </button>
      <div class="grp-inhalt"${auf?'':' hidden'}>${inhalt}</div>`;
  };

  box.innerHTML = `
    <div class="card grpliste">
      ${zeile('bereiche','Bereiche',bereichWert,`
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
        </div>`)}
      ${zeile('auswahl','Schwerpunkt',AUSWAHL.find(a=>a.id===TR.auswahl).name.toLowerCase(),`
        <div class="optionen">
          ${AUSWAHL.map(a=>`<button class="tr-opt${TR.auswahl===a.id?' an':''}" data-auswahl="${a.id}">
            <b>${esc(a.name)}</b><span>${esc(a.erl)}</span></button>`).join('')}
        </div>`)}
      ${zeile('zeit','Zeit',TR.zeit? (max? mmss(trZeit(TR.anzahl))+' Minuten':'mit Prüfungszeit') : 'ohne Zeitdruck',`
        <div class="optionen zwei">
          <button class="tr-opt${TR.zeit?'':' an'}" data-zeit="0"><b>Ohne Zeitdruck</b>
            <span>In Ruhe nachdenken, keine Uhr. Für das Tagespensum und zum Lernen.</span></button>
          <button class="tr-opt${TR.zeit?' an':''}" data-zeit="1"><b>Mit Prüfungszeit</b>
            <span>${nurFr?'Anteilig am Budget von 30 Minuten für 52 Aufgaben.':'Rund 24 Sekunden je Frage, wie im Original.'}
              ${max?'Für '+TR.anzahl+' Fragen: '+mmss(trZeit(TR.anzahl))+' Min.':''}</span></button>
        </div>`)}
    </div>

    <div class="card pad umfangkarte">
      <div class="tr-lab">Umfang <span>${max} ${max===1?'Frage':'Fragen'} verfügbar</span></div>
      ${max ? `<div class="umfang">
          <input type="range" id="tr-schieber" min="1" max="${max}" value="${TR.anzahl}" step="1">
          <output class="tr-zahl tnum" id="tr-zahl">${TR.anzahl}</output>
        </div>
        <div class="stufen">${stufen.map(n=>`<button class="stufe-btn${TR.anzahl===n?' an':''}" data-anzahl="${n}">${n}</button>`).join('')}
          <button class="stufe-btn${TR.anzahl===max?' an':''}" data-anzahl="${max}">alle</button></div>`
        : '<div class="hinweis">Für diese Auswahl gibt es gerade keine Fragen. Wähle mehr Bereiche oder einen anderen Schwerpunkt.</div>'}
    </div>

    <div class="tr-start">
      <button class="btn" id="tr-los" ${max?'':'disabled'}>Training starten</button>
      <div class="tr-zusammen">${max
        ? `${TR.anzahl} ${TR.anzahl===1?'Frage':'Fragen'} · ${esc(bereichWert)}
           · ${esc(AUSWAHL.find(a=>a.id===TR.auswahl).name.toLowerCase())}
           · ${TR.zeit? mmss(trZeit(TR.anzahl))+' Minuten' : 'ohne Zeitdruck'}`
        : 'Keine Fragen für diese Zusammenstellung'}</div>
    </div>`;

  $$('#trainer [data-auf]').forEach(b=>b.onclick=()=>{
    TR.offen = TR.offen===b.dataset.auf ? null : b.dataset.auf; renderTrainer(); });

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
  document.body.classList.remove('imLauf');
  $('#train-menu').style.display=''; $('#train-run').style.display='none'; $('#train-run').innerHTML='';
  renderTrainer();
  /* Der Durchgang ist vorbei: eine zurückgestellte Fassung darf jetzt kommen. */
  if(SW_SPAETER){ SW_SPAETER=false; SW_NEULADEN=true; location.reload(); return; }
  nachAktualisierungSehen();

  /* Zwei Segmente: die eigene Zusammenstellung und die fertigen Prüfungen. */
  $$('#tr-seg .seg-btn').forEach(b=>b.onclick=()=>{
    const s=b.dataset.seg;
    $$('#tr-seg .seg-btn').forEach(x=>x.classList.toggle('an', x.dataset.seg===s));
    $('#tr-pane-frei').hidden = s!=='frei';
    $('#tr-pane-tests').hidden = s!=='tests';
    window.scrollTo({top:0});
  });

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
    case 'auswahl': {
      const menge = (cfg.ids||[]).map(id=>BY_ID[id]).filter(Boolean);
      return [{fragen: cfg.n? pick(menge, cfg.n) : shuffle(menge)}];
    }
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

/* =====================================================================
   UNTERBROCHENE DURCHGÄNGE
   Ein Durchgang wird erst am Ende gespeichert. Bis dahin steht er nur im
   Arbeitsspeicher – und den räumt das Telefon aus, sobald die App länger im
   Hintergrund liegt oder die Seite neu lädt. Deshalb legen wir nach jedem
   Schritt eine Kopie im Gerätespeicher ab und bieten sie beim nächsten Start
   zum Fortsetzen an.

   Nur Durchgänge ohne Zeitdruck: eine Prüfungssimulation mit laufender Uhr
   lässt sich nach einer Unterbrechung nicht ehrlich fortsetzen.
   ===================================================================== */
function laufSichern(){
  if(!LAUF || LAUF.phase!=='lauf' || LAUF.cfg.zeit) return;
  try{
    localStorage.setItem(CACHE_LAUF, JSON.stringify({
      ts: Date.now(),
      nutzer: PROFIL && PROFIL.id,
      fassung: FASSUNG,
      cfg: LAUF.cfg,
      teile: LAUF.teile.map(t=>t.fragen.map(f=>f.id)),
      ti: LAUF.ti, i: LAUF.i,
      antw: LAUF.antw, mark: LAUF.mark,
      start: LAUF.start
    }));
  }catch(e){}
}
function laufVergessen(){ try{ localStorage.removeItem(CACHE_LAUF); }catch(e){} }

/* Gibt den gesicherten Durchgang zurück – oder null, wenn er nicht zu diesem
   Konto gehört, zu alt ist oder die Fragen inzwischen fehlen. */
function laufGesichert(){
  let s;
  try{ s = JSON.parse(localStorage.getItem(CACHE_LAUF)||'null'); }catch(e){ return null; }
  if(!s || !Array.isArray(s.teile) || !s.teile.length) return null;
  if(!PROFIL || s.nutzer !== PROFIL.id) return null;
  if(Date.now() - s.ts > 24*3600*1000){ laufVergessen(); return null; }
  /* Jede Frage muss noch im Bestand sein, sonst stimmen Zähler und Wertung nicht. */
  for(const ids of s.teile) for(const id of ids) if(!BY_ID[id]){ laufVergessen(); return null; }
  const gesamt = s.teile.reduce((a,ids)=>a+ids.length, 0);
  const beantwortet = Object.keys(s.antw||{}).length;
  if(!gesamt || beantwortet>=gesamt){ laufVergessen(); return null; }
  return {...s, gesamt, beantwortet};
}

function laufFortsetzen(){
  const s = laufGesichert();
  if(!s){ toast('Der unterbrochene Durchgang ist nicht mehr verfügbar.'); renderDash(); return; }
  /* zeit:0 erzwingen – fortgesetzt wird ausdrücklich ohne Uhr. */
  LAUF = {cfg:{...s.cfg, zeit:0}, view:'train', mount:'#train-run',
          teile: s.teile.map(ids=>({fragen: ids.map(id=>BY_ID[id])})),
          ti: Math.min(s.ti||0, s.teile.length-1),
          i: 0, antw: s.antw||{}, mark: s.mark||{},
          start: s.start || Date.now(), phase:'lauf'};
  LAUF.i = Math.min(s.i||0, LAUF.teile[LAUF.ti].fragen.length-1);
  $('#train-menu').style.display='none';
  $('#train-run').style.display='';
  document.body.classList.add('imLauf');
  TEXT_ZU=false; TEXT_VOLL=false; TEXT_AKT=null;
  ANSICHT='train'; navBauen();
  $$('.view').forEach(x=>x.classList.toggle('on', x.id==='v-train'));
  window.scrollTo({top:0});
  renderFrage();
  toast('Weiter, wo du aufgehört hast.');
}

/* Zusätzlich sichern, wenn die App in den Hintergrund geht – dort kann iOS
   sie beenden, ohne dass noch Programmcode läuft. */
addEventListener('pagehide', laufSichern);
addEventListener('visibilitychange', ()=>{ if(document.hidden) laufSichern(); });

function start(cfg){
  laufVergessen(); SPRUNG_LINKS = 0;
  const teile=baueTeile(cfg).filter(t=>t.fragen.length);
  if(!teile.length){ toast('Für diesen Durchgang sind gerade keine Fragen vorhanden.'); return; }
  const vorMark={};
  for(const t of teile) for(const f of t.fragen) if(MARKIERT.has(f.id)) vorMark[f.id]=true;
  LAUF={cfg, view:'train', mount:'#train-run', teile, ti:0, i:0, antw:{}, mark:vorMark, start:Date.now(), phase:'lauf'};
  $('#train-menu').style.display='none';
  $('#train-run').style.display='';
  document.body.classList.add('imLauf');   /* Tab-Leiste weicht dem Prüfungsfuß */
  TEXT_ZU=false; TEXT_VOLL=false; TEXT_AKT=null;
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

let WEITER_TIMER = null;    /* kurze Pause zwischen Wahl und nächster Frage */
let SPRUNG_LINKS = 0;       /* Scrollstand der Zahlenleiste über das Neuzeichnen hinweg */

function renderFrage(){
  if(WEITER_TIMER){ clearTimeout(WEITER_TIMER); WEITER_TIMER=null; }
  const alteLeiste = M('#sprung');
  if(alteLeiste) SPRUNG_LINKS = alteLeiste.scrollLeft;
  const T=aktTeil(), q=T.fragen[LAUF.i], n=T.fragen.length;
  const fr=q.kategorie==='franzoesisch';
  const kls = fr? 'k-franzoesisch' : 'k-'+q.kategorie;
  const marke = fr? FR_TEIL[q.teil].kurz : KAT[q.kategorie].kurz;
  const kopf  = fr? FR_TEIL[q.teil].name : KAT[q.kategorie].name;
  const beantwortet=T.fragen.filter(f=>LAUF.antw[f.id]!==undefined).length;
  const mehr=LAUF.teile.length>1;
  const vorher = LAUF.i>0 ? T.fragen[LAUF.i-1] : null;
  const zeigeText = q.text && (!vorher || vorher.textId!==q.textId);
  /* Nur beim Wechsel auf einen anderen Artikel zurücksetzen – nicht bei
     jedem Neuzeichnen derselben Frage, sonst klappt der Text sofort wieder auf. */
  if(q.textId && q.textId!==TEXT_AKT){ TEXT_AKT=q.textId; TEXT_ZU=false; TEXT_VOLL=false; }
  const markierte = T.fragen.map((f,i)=> LAUF.mark[f.id]? i : -1).filter(i=>i>=0);
  /* Die Leiste zeigt jede Frage einzeln – ab 60 bliebe davon eine Wand.
     Dann bleibt es bei der eingeklappten Übersicht am Seitenende. */
  const sprungleiste = n<=60;

  $(LAUF.mount).innerHTML=`
    <div class="exambar">
      <div class="in wrap">
        <div class="kopfmitte" style="flex:1">
          <div class="who">${esc(LAUF.cfg.titel)}${mehr?' · Teil '+(LAUF.ti+1)+' von '+LAUF.teile.length:''}</div>
          <div class="what">${esc(kopf)}</div>
        </div>
        ${LAUF.cfg.zeit?`<div class="kopfzeit"><div class="timerlab">${LAUF.cfg.gesamt?'Restzeit gesamt':'Restzeit'}</div><div class="timer" id="timer">${mmss(LAUF.deadline?(LAUF.deadline-Date.now())/1000:LAUF.cfg.zeit)}</div></div>`
                      :'<div class="kopfzeit small mute">ohne Uhr</div>'}
        <button class="btn ghost sm" id="abbruch">Abbruch</button>
      </div>
      <div class="trail"><i style="width:${Math.round(beantwortet/n*100)}%"></i></div>
      ${sprungleiste? `<div class="sprung" id="sprung">${T.fragen.map((f,i)=>
        `<button data-i="${i}" class="${LAUF.antw[f.id]!==undefined?'done':''} ${LAUF.mark[f.id]?'mark':''} ${i===LAUF.i?'cur':''}">${i+1}</button>`).join('')}</div>`:''}
    </div>

    <div class="wrap${sprungleiste?' hat-sprung':''}"><div class="runwrap">
      <div class="qcard ${kls}${LAUF.mark[q.id]?' marked':''}">
        ${q.text? artikelHtml(q, true) : ''}
        <div class="qhead">
          <span class="tag">${esc(marke)}</span>
          <span class="qnum">Frage ${LAUF.i+1} / ${n}${fr?' · '+q.punkte+(q.punkte===1?' Punkt':' Punkte'):''}</span>
          ${LAUF.mark[q.id]?'<span class="markhint">★ markiert</span>':''}
          <button class="btn ghost sm markbtn" id="mark" style="margin-left:auto"
            aria-label="${LAUF.mark[q.id]?'Markierung aufheben':'Frage markieren'}"><span class="mk-ic">${
            LAUF.mark[q.id]?'★':'☆'}</span><span class="mk-txt">${LAUF.mark[q.id]?'Markierung aufheben':'Markieren'}</span></button>
        </div>
        <p class="stem">${stemHtml(q.frage)}</p>
        <div class="opts">${q.optionen.map((o,i)=>
          `<button class="opt ${LAUF.antw[q.id]===i?'sel':''}" data-o="${i}"><span class="ltr">${LTR[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="qfoot">
          ${LAUF.i===0 && LAUF.ti>0 && LAUF.cfg.gesamt
            ? `<button class="btn ghost" id="prevteil">← Teil ${LAUF.ti}</button>`
            : `<button class="btn ghost zurueckbtn" id="prev" ${LAUF.i===0?'disabled':''} aria-label="Vorige Frage"
                 ><span class="zb-ic">‹</span><span class="zb-txt">Zurück</span></button>`}
          <button class="markenav" id="marknav" ${markierte.length?'':'disabled'} title="Zur nächsten markierten Frage">★ ${markierte.length}</button>
          <span class="small mute tnum stand" style="margin-left:auto"
            ><span class="st-kurz"><b>${LAUF.i+1} / ${n}</b><i>${beantwortet} beantw.</i></span
            ><span class="st-lang">${beantwortet} von ${n} beantwortet${
            LAUF.cfg.gesamt? ' · gesamt '+LAUF.teile.flatMap(t=>t.fragen).filter(f=>LAUF.antw[f.id]!==undefined).length+' von '+LAUF.teile.reduce((a,t)=>a+t.fragen.length,0):''}</span></span>
          ${LAUF.i===n-1
            ? `<button class="btn" id="fertig">${LAUF.ti===LAUF.teile.length-1?'Auswerten':'Nächster Teil →'}</button>`
            : `<button class="btn" id="next">Weiter</button>`}
        </div>
        ${(()=>{ /* Bei langen Durchgängen die Übersicht einklappen, sonst wird die Seite unbrauchbar. */
          const raster = `<div class="pgrid">${T.fragen.map((f,i)=>
              `<button class="pg ${LAUF.antw[f.id]!==undefined?'done':''} ${LAUF.mark[f.id]?'mark':''} ${i===LAUF.i?'cur':''}" data-i="${i}">${i+1}</button>`).join('')}</div>
            <div class="pglegend">
              <span><i class="d"></i>beantwortet</span>
              <span><i class="m"></i>markiert</span>
              <span><i class="c"></i>aktuelle Frage</span>
            </div>`;
          return n>60
            ? `<details class="navi lang"><summary>Übersicht über alle ${n} Fragen · ${beantwortet} beantwortet${
                 Object.keys(LAUF.mark).filter(id=>LAUF.mark[id]).length? ' · '+Object.keys(LAUF.mark).filter(id=>LAUF.mark[id]).length+' markiert':''}</summary>
               <div style="padding-top:18px">${raster}</div></details>`
            : `<div class="navi"><div class="lab">Übersicht</div>${raster}</div>`;
        })()}
      </div>
    </div></div>`;

  /* Die Wahl kurz stehen lassen, bevor die nächste Frage kommt. Vorher sprang
     das Bild sofort weiter – man sah die eigene Antwort nur bei der letzten
     Frage und wusste nicht, ob der Tipp angekommen war. */
  MM('.opts .opt').forEach(b=>b.onclick=()=>{
    if(WEITER_TIMER) return;                       /* ein Tipp genügt */
    LAUF.antw[q.id] = +b.dataset.o;
    if(LAUF.i >= n-1){ renderFrage(); return; }
    MM('.opts .opt').forEach(x=>x.classList.toggle('sel', x===b));
    WEITER_TIMER = setTimeout(()=>{ WEITER_TIMER=null; LAUF.i++; renderFrage(); }, 280);
  });
  MM('.pg').forEach(b=>b.onclick=()=>{ LAUF.i=+b.dataset.i; renderFrage(); });
  M('#mark').onclick=()=>{
    LAUF.mark[q.id]=!LAUF.mark[q.id];
    markierungSetzen(q.id, !!LAUF.mark[q.id]);
    renderFrage();
  };

  /* Sprungleiste: Klicks binden und die aktuelle Frage mittig nachführen.
     Die Leiste wird bei jedem Neuzeichnen neu aufgebaut und stünde deshalb
     wieder ganz links – von dort aus sah jedes Weiterblättern wie ein Sprung
     aus. Erst den alten Stand wiederherstellen, dann sanft nachrücken. */
  MM('#sprung button').forEach(b=>b.onclick=()=>{ LAUF.i=+b.dataset.i; renderFrage(); });
  const leiste=M('#sprung'), akt=leiste && leiste.children[LAUF.i];
  if(leiste && akt){
    leiste.scrollLeft = SPRUNG_LINKS;            /* dort weitermachen, wo es stand */
    const rand = 2 * akt.offsetWidth;            /* zwei Zahlen Luft zum Rand */
    const links = akt.offsetLeft - rand;
    const rechts = akt.offsetLeft + akt.offsetWidth + rand - leiste.clientWidth;
    /* Nur nachrücken, wenn die aktuelle Zahl sonst an den Rand liefe. Steht sie
       bequem im Bild, bleibt die Leiste stehen – kein Scrollen bei jedem Tipp. */
    let ziel = SPRUNG_LINKS;
    if(SPRUNG_LINKS > links)  ziel = links;
    if(SPRUNG_LINKS < rechts) ziel = rechts;
    ziel = Math.max(0, Math.min(leiste.scrollWidth - leiste.clientWidth, ziel));
    if(Math.abs(ziel - leiste.scrollLeft) > 1) leiste.scrollTo({left:ziel, behavior:'smooth'});
    SPRUNG_LINKS = ziel;
  }

  laufSichern();

  const mn=M('#marknav');
  if(mn && markierte.length) mn.onclick=()=>{
    const naechste = markierte.find(i=>i>LAUF.i);
    LAUF.i = naechste===undefined ? markierte[0] : naechste;
    renderFrage();
  };

  /* Lesetext ein- und ausklappen beziehungsweise auf Lesehöhe vergrößern. */
  const tz=M('#t-zu'), tv=M('#t-voll');
  if(tz) tz.onclick=()=>{ TEXT_ZU=!TEXT_ZU; TEXT_VOLL=false; renderFrage(); };
  if(tv) tv.onclick=()=>{ TEXT_VOLL=!TEXT_VOLL; TEXT_ZU=false; renderFrage(); };
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
    clearInterval(TICK); laufVergessen(); SPRUNG_LINKS=0; LAUF=null; renderMenu(); } };
}

function teilFertig(){
  clearInterval(TICK);
  if(LAUF.ti < LAUF.teile.length-1){ LAUF.ti++; LAUF.i=0; renderFrage(); starteTimer(); window.scrollTo({top:0}); return; }
  auswerten();
}

async function auswerten(){
  clearInterval(TICK);
  laufVergessen();          /* der Durchgang ist zu Ende, die Kopie wird nicht mehr gebraucht */
  SPRUNG_LINKS = 0;
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
  document.body.classList.remove('imLauf');
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
        ${artikelHtml(q, false)}
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
        <div class="scoretext">
          <div class="scorezahl">
            ${fr? sess.punkte+' von '+sess.maxPunkte+' Punkten' : sess.richtig+' von '+sess.n+' richtig'}</div>
          <p class="small mute" style="margin:8px 0 0">
            ${fr? sess.richtig+' von '+sess.n+' Fragen richtig · ':''}Bearbeitungszeit ${mmss(sess.dauer)}${sess.n?' · '+(sess.dauer/sess.n).toFixed(1)+' Sekunden pro Frage':''}</p>
          ${vollerTest?`<div class="verdict ${sess.punkte>=FR_META.bestanden?'ja':'nein'}" style="margin-top:14px">${sess.punkte>=FR_META.bestanden?'Bestanden':'Nicht bestanden'} · Grenze ${FR_META.bestanden} von ${FR_META.punkte} Punkten</div>`:''}
        </div>
      </div>

      <div class="card liste teilliste">${gruppen.map(g=>`
        <div class="zeile ${g.kls}">
          <span class="pt"></span>
          <span class="mitte">
            <span class="nm">${esc(g.name)}</span>
            <span class="bar"><i style="width:${pct(g.r,g.n)}%"></i></span>
          </span>
          <span class="wert tnum">${g.p!==undefined? g.p+'/'+g.mp : g.r+'/'+g.n}</span>
        </div>`).join('')}</div>

      <div class="sec">
        <div class="sec-h"><h2>Durchsicht</h2><button class="link note" id="e-all">Alle aufklappen</button></div>
        <div id="revlist">${rows}</div>
      </div>

      <div class="ergfuss">
        <button class="btn ghost" id="e-menu">Weiter üben</button>
        <button class="btn" id="e-dash">Übersicht</button>
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
/* =====================================================================
   FRAGENPOOL
   ===================================================================== */
/* ---------- Abdeckung des Lehrplans ---------- */
const LP_NAME = {recht:'Völker-, Europa- und Staatsrecht', geschichte:'Geschichte und Politik',
  wirtschaft:'Wirtschaft', textverstaendnis:'Textverständnis', wortschatz:'Wortschatz', grammatik:'Grammatik'};
const LP_KLS = {recht:'recht', geschichte:'geschichte', wirtschaft:'wirtschaft',
  textverstaendnis:'franzoesisch', wortschatz:'franzoesisch', grammatik:'franzoesisch'};
const SONSTIGE = 'Weitere Themen';   /* Sammelrubrik für Fragen ohne Lehrplanfeld */
let LP_WEG = [];          /* Navigationspfad: [] | [kategorie] | [kategorie, oberfeld] */
let LP_MEHR = 15;         /* wie viele Zeilen je Ebene sichtbar sind */
let LP_STAND = null;      /* Zeilen aus lehrplan_stand, einmal geladen */

/* Prüfungsteil einer Frage, so wie der Lehrplan ihn benennt. */
const lpTeil = (q)=> q.kategorie==='franzoesisch' ? (q.teil||'wortschatz') : q.kategorie;

/* Ober- und Unterfeld aus dem Thema. Der Lehrplan schreibt „Oberfeld – Unterfeld“. */
function lpTeile(thema){
  const t=(thema||'').trim();
  if(!t) return ['Ohne Thema',''];
  const i=t.search(/\s[–—-]\s/);
  return i<0 ? [t,''] : [t.slice(0,i).trim(), t.slice(i+3).trim()];
}

/* Baut den Lehrplan und den eigenen Stand zu einem Baum zusammen:
   geplante Felder ohne Fragen erscheinen ebenso wie Fragen, die (noch)
   neben dem Plan liegen. */
function lpBaum(){
  const l = letzteJeFrage();
  const baum = {};                       /* teil -> oberfeld -> unterfeld */
  const holen = (teil, ober, unter)=>{
    const t = baum[teil] = baum[teil] || {name:LP_NAME[teil]||teil, kls:LP_KLS[teil]||'recht', felder:{}};
    const o = t.felder[ober] = t.felder[ober] || {name:ober, felder:{}};
    return o.felder[unter] = o.felder[unter] || {name:unter||ober, thema:'', gewicht:0,
                                                 bestand:0, bearbeitet:0, richtig:0, imPlan:false, ids:[]};
  };
  for(const s of (LP_STAND||[])){
    const f = holen(s.kategorie, s.oberfeld, s.unterfeld);
    f.imPlan = true; f.gewicht = s.gewicht; f.thema = s.thema;
  }
  /* Welche Oberfelder der Lehrplan kennt. Fragen aus den Originalprüfungen und
     den ersten Tagen tragen teils ein Thema ohne Oberfeld – die stünden sonst
     als eigene Rubrik neben „Geschichte“ und „Außenpolitik“ und sähen aus wie
     eine zweite Gliederung. Sie kommen darum gesammelt unter „Weitere Themen“. */
  const planFelder = planOberfelder();

  for(const q of ALLES){
    const teil = lpTeil(q);
    let [ober, unter] = lpTeile(q.thema);
    const bekannt = planFelder[teil];
    if(bekannt && bekannt.size && !bekannt.has(ober)){ unter = (q.thema||ober).trim(); ober = SONSTIGE; }
    const f = holen(teil, ober, unter);
    if(!f.thema) f.thema = q.thema || ober;
    f.bestand++; f.ids.push(q.id);
    const a = l[q.id];
    if(a){ f.bearbeitet++; if(a.ok) f.richtig++; }
  }
  /* Summen nach oben durchreichen */
  for(const t of Object.values(baum)){
    t.bestand=t.bearbeitet=t.richtig=t.felder_n=t.felder_leer=0; t.ids=[];
    for(const o of Object.values(t.felder)){
      o.bestand=o.bearbeitet=o.richtig=o.felder_n=o.felder_leer=0; o.ids=[];
      /* Ein Oberfeld mit genau einem gleichnamigen Unterfeld ist selbst schon
         das Themenfeld – dann führt ein weiterer Schritt auf dieselbe Zeile. */
      const kinder = Object.values(o.felder);
      o.blatt = kinder.length===1 && kinder[0].name===o.name;
      if(o.blatt) o.imPlan = kinder[0].imPlan;
      for(const f of kinder){
        o.bestand+=f.bestand; o.bearbeitet+=f.bearbeitet; o.richtig+=f.richtig;
        o.felder_n++; if(!f.bestand) o.felder_leer++; o.ids.push(...f.ids);
      }
      t.bestand+=o.bestand; t.bearbeitet+=o.bearbeitet; t.richtig+=o.richtig;
      t.felder_n+=o.felder_n; t.felder_leer+=o.felder_leer; t.ids.push(...o.ids);
    }
  }
  return baum;
}

async function lehrplanLaden(){
  if(LP_STAND) return true;
  const {data} = await sb.from('lehrplan_stand')
    .select('id,kategorie,oberfeld,unterfeld,thema,gewicht').order('id');
  if(!data) return false;
  LP_STAND = data;
  return true;
}

async function renderLehrplan(){
  const box=$('#lehrplan'); if(!box) return;
  if(!LP_STAND){
    box.innerHTML='<div class="card"><div class="empty">Wird geladen …</div></div>';
    if(!await lehrplanLaden()){
      box.innerHTML='<div class="card"><div class="empty">Lehrplan konnte nicht geladen werden.</div></div>'; return; }
  }
  lpZeichnen();
}

function lpZeichnen(){
  const box=$('#lehrplan'); if(!box) return;
  const baum = lpBaum();
  const [katWahl, oberWahl] = LP_WEG;
  const REIHE = ['recht','geschichte','wirtschaft','textverstaendnis','wortschatz','grammatik'];

  /* Welche Zeilen stehen auf dieser Ebene? */
  let zeilen, kls, titel, unterzeile;
  if(!katWahl){
    zeilen = REIHE.filter(k=>baum[k]).map(k=>({schluessel:k, ...baum[k]}));
    const b = zeilen.reduce((a,z)=>a+z.bestand,0), e = zeilen.reduce((a,z)=>a+z.bearbeitet,0);
    titel = 'Alle Prüfungsteile';
    unterzeile = `${e} von ${b} Fragen bearbeitet · ${zeilen.reduce((a,z)=>a+z.felder_n,0)} Themenfelder`;
  } else if(!oberWahl){
    const t = baum[katWahl] || {felder:{}};
    kls = t.kls;
    zeilen = Object.keys(t.felder).map(o=>({schluessel:o, kls:t.kls, ...t.felder[o]}));
    titel = t.name || katWahl;
    unterzeile = `${t.bearbeitet||0} von ${t.bestand||0} Fragen bearbeitet · ${t.felder_n||0} Themenfelder`;
  } else {
    const t = baum[katWahl] || {felder:{}};
    const o = t.felder[oberWahl] || {felder:{}};
    kls = t.kls;
    zeilen = Object.values(o.felder).map(f=>({schluessel:f.name, kls:t.kls, blatt:true, ...f}));
    titel = oberWahl;
    unterzeile = `${o.bearbeitet||0} von ${o.bestand||0} Fragen bearbeitet · ${o.felder_n||0} Themenfelder`;
  }
  /* „Weitere Themen“ steht immer am Ende – es ist keine Rubrik des Lehrplans. */
  zeilen.sort((a,b)=> (a.name===SONSTIGE)-(b.name===SONSTIGE)
                   || b.bestand-a.bestand || a.name.localeCompare(b.name,'de'));

  const zeige = zeilen.slice(0, LP_MEHR);
  const quote = (z)=> z.bearbeitet ? Math.round(z.richtig/z.bearbeitet*100) : null;

  const brot = LP_WEG.length
    ? `<div class="lp-brot">
         <button class="link" data-lp-zu="">Alle Prüfungsteile</button>
         ${LP_WEG.map((s,i)=> i<LP_WEG.length-1
            ? `<span>›</span><button class="link" data-lp-zu="${esc(LP_WEG.slice(0,i+1).join('||'))}">${esc(i===0?(LP_NAME[s]||s):s)}</button>`
            : `<span>›</span><b>${esc(i===0?(LP_NAME[s]||s):s)}</b>`).join('')}
       </div>` : '';

  box.innerHTML = `
    <div class="card">
      ${brot}
      <div class="feld lp-kopf" style="border-bottom:1px solid var(--line);padding-top:16px;padding-bottom:16px">
        <span class="nm">${esc(titel)}</span>
        <span class="uz">${esc(unterzeile)}</span>
      </div>
      ${zeige.map(z=>{
        const p = z.bestand ? Math.round(z.bearbeitet/z.bestand*100) : 0;
        const q = quote(z);
        return `<div class="feld lp-zeile k-${z.kls||kls||'recht'}"${z.blatt?'':` data-lp-tiefer="${esc(z.schluessel)}"`}>
          <span class="sq"></span>
          <span class="nm" title="${esc(z.name)}">${esc(z.name)}${
            z.blatt && z.imPlan===false ? ' <span class="lp-frei">nicht im Plan</span>' : ''}</span>
          <span class="bar" title="${z.bearbeitet} von ${z.bestand} bearbeitet"><i style="width:${p}%"></i></span>
          <span class="qt tnum">${z.bearbeitet}/${z.bestand}</span>
          <span class="ct">${
            z.bestand===0 ? 'noch keine Frage'
              : (q===null ? 'nicht bearbeitet' : q+' % richtig')}</span>
          ${z.blatt? '' : '<span class="lp-pfeil">›</span>'}
        </div>`;
      }).join('')}
      ${zeilen.length>zeige.length
        ? `<div class="morerow"><button class="link" id="lp-mehr">Weitere ${
             Math.min(15, zeilen.length-zeige.length)} von ${zeilen.length-zeige.length} anzeigen</button></div>`
        : (LP_MEHR>15 ? `<div class="morerow"><button class="link" id="lp-weniger">Wieder einklappen</button></div>`:'')}
      <div class="feld xs mute" style="border-top:1px solid var(--line-soft);border-bottom:0">
        <span class="nm" style="white-space:normal">bearbeitet / im Bestand</span>
      </div>
    </div>`;

  $('#lp-note').textContent = LP_WEG.length ? 'in diesem Bereich' : 'ganzer Lehrplan';

  $$('#lehrplan [data-lp-tiefer]').forEach(e=>e.onclick=(ev)=>{
    if(ev.target.closest('button')) return;
    LP_WEG = LP_WEG.concat(e.dataset.lpTiefer); LP_MEHR=15; lpZeichnen();
  });
  $$('#lehrplan [data-lp-zu]').forEach(b=>b.onclick=()=>{
    LP_WEG = b.dataset.lpZu ? b.dataset.lpZu.split('||') : []; LP_MEHR=15; lpZeichnen();
  });
  const m=$('#lp-mehr'); if(m) m.onclick=()=>{ LP_MEHR+=15; lpZeichnen(); };
  const w=$('#lp-weniger'); if(w) w.onclick=()=>{ LP_MEHR=15; lpZeichnen(); };
}

const STATUS = [
  {id:'alle',    name:'Alle',        test:()=>true},
  {id:'falsch',  name:'Falsch',      test:(q,l)=> l[q.id] && !l[q.id].ok},
  {id:'offen',   name:'Nie gesehen', test:(q,l)=> !l[q.id]},
  {id:'richtig', name:'Richtig',     test:(q,l)=> l[q.id] && l[q.id].ok},
  {id:'mark',    name:'Markiert',    test:(q)=> MARKIERT.has(q.id)}
];
let Q = {status:'alle'};
let TREFFER = [];

function renderFragen(){
  const ks=$('#q-kat'), bs=$('#q-block');
  if(!ks.options.length){
    ks.innerHTML='<option value="">alle</option>'+ALLE.concat('franzoesisch').map(k=>`<option value="${k}">${katKurz(k)}</option>`).join('');
    [ks,bs].forEach(e=>e.onchange=fragenListe);
    $('#q-search').oninput=fragenListe;
    $('#q-filter-auf').onclick=()=>{
      const box=$('#q-filter'), auf=box.hidden;
      box.hidden=!auf; $('#q-filter-auf').setAttribute('aria-expanded', String(auf));
    };
    $('#q-reset').onclick=()=>{ ks.value=''; bs.value=''; $('#q-search').value=''; fragenListe(); };
  }
  const bl=[...new Set(ALLES.map(q=>q.block))].sort((a,b)=>(a.startsWith('Tag')?1:0)-(b.startsWith('Tag')?1:0)||a.localeCompare(b,'de',{numeric:true}));
  const alt=bs.value;
  bs.innerHTML='<option value="">alle</option>'+bl.map(b=>`<option>${esc(b)}</option>`).join('');
  if(bl.includes(alt)) bs.value=alt;
  fragenListe();
  renderLehrplan();
}

function fragenListe(){
  const l=letzteJeFrage();
  const suche=$('#q-search').value.toLowerCase().trim(), kat=$('#q-kat').value, block=$('#q-block').value;
  const grund = ALLES.filter(q=>(!kat||q.kategorie===kat) && (!block||q.block===block)
    && (!suche || (q.frage+' '+q.optionen.join(' ')+' '+q.erlaeuterung+' '+(q.thema||'')).toLowerCase().includes(suche)));

  /* Die Filtertaste zeigt an, ob überhaupt etwas eingeengt ist. */
  const fb=$('#q-filter-auf');
  if(fb){ const eng = !!(kat||block);
    fb.classList.toggle('an', eng);
    fb.textContent = eng ? 'Filter · '+[kat?katKurz(kat):null, block||null].filter(Boolean).join(', ') : 'Filter'; }

  /* Der Statusfilter zählt immer über die bereits gesetzten Achsen. */
  $('#q-status').innerHTML = STATUS.map(st=>{
    const n = grund.filter(q=>st.test(q,l)).length;
    return `<button data-status="${st.id}" class="${Q.status===st.id?'an':''}">${esc(st.name)}<em>${n}</em></button>`;
  }).join('');
  $$('#q-status button').forEach(b=>b.onclick=()=>{ Q.status=b.dataset.status; fragenListe(); });

  const st = STATUS.find(x=>x.id===Q.status) || STATUS[0];
  TREFFER = grund.filter(q=>st.test(q,l));
  const gefiltert = !!(suche||kat||block) || Q.status!=='alle';
  $('#q-zahl').innerHTML = TREFFER.length
    ? `<b>${TREFFER.length}</b> von ${ALLES.length} Fragen${Q.status==='alle'?'':' · '+esc(st.name.toLowerCase())}`
    : 'Keine Frage in dieser Auswahl';

  /* Bei Fehlern und Markierungen die dichtesten Themenfelder voranstellen. */
  const kopf=$('#q-kopf');
  if((Q.status==='falsch'||Q.status==='mark') && TREFFER.length){
    const feld={};
    for(const q of TREFFER){ const f=themenfeld(q); (feld[f]=feld[f]||{f, kat:q.kategorie, n:0}); feld[f].n++; }
    const felder=Object.values(feld).sort((a,b)=>b.n-a.n).slice(0,6);
    kopf.innerHTML = `<div class="card" style="margin-bottom:22px">
      <div class="feld" style="border-bottom:1px solid var(--line)">
        <span class="nm" style="font-weight:600;color:var(--ink)">Dichteste Themenfelder</span>
        <span class="ct" style="width:auto">${Object.keys(feld).length} insgesamt</span></div>
      ${felder.map(f=>`<div class="feld k-${f.kat}">
        <span class="sq"></span><span class="nm">${esc(f.f)}</span>
        <span class="ct fehler" style="width:auto">${f.n}</span></div>`).join('')}
    </div>`;
  } else kopf.innerHTML='';

  gruppenliste('#poollist', TREFFER, l, POOL_OFFEN, POOL_MEHR, 20, gefiltert,
    'Keine Frage passt zu dieser Auswahl.');
  $$('#poollist [data-mehr]').forEach(x=>x.onclick=()=>{
    POOL_MEHR[x.dataset.mehr]=(POOL_MEHR[x.dataset.mehr]||20)+20; POOL_OFFEN.add(x.dataset.mehr); fragenListe(); });
  $$('#poollist [data-weniger]').forEach(x=>x.onclick=()=>{ POOL_MEHR[x.dataset.weniger]=20; fragenListe(); });

}

/* Eine Frage als aufklappbarer Eintrag. */
function poolEintrag(q, a){
  return `<details class="rev"><summary>
    <span class="mk ${a?(a.ok?'r':'w'):'s'}">${a?(a.ok?'✓':'✕'):'·'}</span>
    <span><span class="tagrow"><span class="tag k-${q.kategorie}" style="font-size:11px">${katKurz(q.kategorie)}</span></span>${stemHtml(q.frage)}</span></summary>
    <div class="body">
      ${artikelHtml(q, false)}
      <div class="opts">${q.optionen.map((o,j)=>
        `<div class="opt static ${j===q.loesung?'right':(a&&j===a.gew?'wrong':'')}"><span class="ltr">${LTR[j]}</span><span>${esc(o)}</span></div>`).join('')}</div>
      <div class="expl">${esc(q.erlaeuterung)}</div>
      <div class="srcline">${esc(q.thema||'')} · ${esc(q.block)} · ${esc(q.id)}</div></div></details>`;
}

/* Gruppierte, seitenweise Liste – nie mehr als ein Bildschirm auf einmal. */
const GRUPPEN = [
  {id:'recht',       name:'Völker-, Europa- und Staatsrecht', passt:q=>q.kategorie==='recht'},
  {id:'geschichte',  name:'Geschichte und Politik',           passt:q=>q.kategorie==='geschichte'},
  {id:'wirtschaft',  name:'Wirtschaft',                       passt:q=>q.kategorie==='wirtschaft'},
  {id:'franzoesisch',name:'Sprachtest Französisch',           passt:q=>q.kategorie==='franzoesisch'}
];
let POOL_OFFEN=new Set(), POOL_MEHR={};

function gruppenliste(ziel, fragen, l, offenSet, mehrZaehler, schritt, gefiltert, leer){
  const box=$(ziel); if(!box) return;
  const gruppen=GRUPPEN.map(g=>({g, items:fragen.filter(g.passt)})).filter(x=>x.items.length);
  if(!gruppen.length){ box.innerHTML='<div class="card"><div class="empty">'+leer+'</div></div>'; return; }
  /* Ein Filter klappt nur dann von selbst auf, wenn die Auswahl klein genug
     ist, um sie am Stück zu überblicken. Sonst bleibt der Abschnittsindex
     stehen und die Seite bleibt kurz – auch bei tausenden Fragen. */
  const kompakt = fragen.length > 40 && gruppen.length > 1;
  box.innerHTML = gruppen.map(({g,items})=>{
    const auf = offenSet.has(g.id) || (gefiltert && !kompakt);
    const zeigt = Math.min(items.length, mehrZaehler[g.id] || schritt);
    return `<details class="gebiet" data-gruppe="${g.id}"${auf?' open':''}>
      <summary>
        <span class="pfeil">▶</span>
        <span class="name k-${g.id}">${esc(g.name)}</span>
        <span class="zahl">${items.length} ${items.length===1?'Frage':'Fragen'}</span>
      </summary>
      <div style="padding:14px 16px 6px">
        ${items.slice(0,zeigt).map(q=>poolEintrag(q,l[q.id])).join('')}
        ${items.length>zeigt
          ? `<div class="morerow" style="border-top:0;padding-left:0"><button class="link" data-mehr="${g.id}">Weitere ${
              Math.min(schritt, items.length-zeigt)} von ${items.length-zeigt} anzeigen</button></div>`
          : (items.length>schritt? `<div class="morerow" style="border-top:0;padding-left:0"><button class="link" data-weniger="${g.id}">Wieder einklappen</button></div>`:'')}
      </div>
    </details>`;
  }).join('')
  + (kompakt ? `<p class="hint" style="margin:12px 2px 0">${fragen.length} Fragen in ${gruppen.length} Prüfungsteilen. Öffne einen Prüfungsteil, um die Fragen mit Lösung und Erläuterung nachzulesen.</p>` : '');
  $$(ziel+' .gebiet').forEach(d=>d.ontoggle=()=>{
    if(d.open) offenSet.add(d.dataset.gruppe); else offenSet.delete(d.dataset.gruppe);
  });
  return {gruppen, box};
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

/* Quellen darf jeder aktive Zugang pflegen – aufnehmen, einstufen, entfernen.
   Die Datenbank sieht das genauso (Regel „aktive Nutzer pflegen Quellen“). */
async function renderQuellen(){
  const liste=$('#qu-liste'); liste.innerHTML='<div class="card"><div class="empty">Wird geladen …</div></div>';
  await ladeQuellen();
  const ks=$('#qu-kat');
  if(ks.options.length<=1){
    ks.innerHTML='<option value="">alle</option>'+QU_KATS.map(k=>`<option value="${esc(k.schluessel)}">${esc(k.bezeichnung)}</option>`).join('');
    ks.onchange=quellenListe; $('#qu-datei').onchange=quellenListe; $('#qu-suche').oninput=quellenListe;
    $('#qu-stufe').onchange=quellenListe;
    $('#qu-neu').onclick=()=>aufnahmeOeffnen();
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
  const SPR = {de:'deutsch', fr:'französisch', en:'englisch'};
  return `<div class="quelle${bz==='abseits'?' abseits':''}">
    <span class="punkt ${q.volltext?'ja':'nein'}" title="${q.volltext?'Volltext in der Datenbank – die Tagesaufgabe kann daraus zitieren':'Kein Volltext gelesen'}"></span>
    <span class="t">
      <b>${esc(q.titel)}</b>
      <span class="herkunft">
        <span class="stufe ${esc(q.einstufung||'sonstige')}" title="${esc(st.lang)}">${esc(st.kurz)}</span>
        <span class="geber">${esc(q.herausgeber||'Herkunft nicht vermerkt')}</span>
        ${q.jahr?`<span class="fund">${esc(q.jahr)}</span>`:(q.herkunft?`<span class="fund">${esc(q.herkunft)}</span>`:'')}
        ${bz==='abseits'?`<span class="bezug ${bz}" title="${esc(BEZUG[bz].lang)}">${esc(BEZUG[bz].kurz)}</span>`:''}
      </span>
      <span class="datei">${esc(q.dateiname)}${q.groesse?' · '+mb(q.groesse):''}${
        q.volltext? ' · Volltext'+(q.textseiten?' '+q.textseiten+' Seiten':'')+(q.sprache&&q.sprache!=='de'?', '+SPR[q.sprache]:'') : ' · ohne Volltext'}${
        ''}${
        (bz==='abseits'&&q.bemerkung)?' · '+esc(q.bemerkung):''}</span>
    </span>
    <span class="akt">
      ${q.volltext? `<button class="btn ghost sm" data-lade="${q.id}">Text lesen</button>`:''}
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
    && (!d || (d==='text'? q.volltext : !q.volltext))
    && (!s || (q.titel+' '+q.dateiname+' '+(q.herausgeber||'')+' '+(q.herkunft||'')).toLowerCase().includes(s)));

  const gb=QU_ALLE.reduce((a,q)=>a+(q.groesse||0),0);
  const ohne=QU_ALLE.filter(q=>q.relevanz==='abseits');
  const ohneMb=ohne.reduce((a,q)=>a+(q.groesse||0),0);
  const zaehl = Object.entries(QU_ALLE.reduce((m,q)=>{ m[q.einstufung||'sonstige']=(m[q.einstufung||'sonstige']||0)+1; return m; },{}));
  const mitText = QU_ALLE.filter(q=>q.volltext);
  const textseiten = mitText.reduce((a,q)=>a+(q.textseiten||0),0);
  $('#qu-stat').innerHTML =
    `<b style="color:var(--ink)">${QU_ALLE.length} Quellen</b> für ${QU_KATS.length} Prüfungsteile · `
    + `<b style="color:var(--ink)">${mitText.length}</b> davon als Volltext gelesen`
    + (textseiten? ` (${textseiten.toLocaleString('de-DE')} Seiten)`:'')
    + (QU_ALLE.length-mitText.length? `, <b style="color:var(--gold)">${QU_ALLE.length-mitText.length} ohne Volltext</b>`:'')
    + ` · aus ${mb(gb)} PDF gewonnen, die selbst nicht mehr gespeichert werden`
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
      const fehlt = g.items.filter(q=>!q.volltext).length;
      const seiten = g.items.reduce((a,q)=>a+(q.textseiten||0),0);
      const auf = (gefiltert && r.length<=60) || QU_OFFEN.has(g.kat.schluessel);
      return `<details class="gebiet" data-gebiet="${esc(g.kat.schluessel)}"${auf?' open':''}>
        <summary>
          <span class="pfeil">▶</span>
          <span class="name">${esc(g.kat.bezeichnung)}</span>
          ${fehlt?`<span class="fehlt">${fehlt} ohne Volltext</span>`:''}
          <span class="zahl">${g.items.length} Quellen${seiten?' · '+seiten.toLocaleString('de-DE')+' Seiten':''}</span>
        </summary>
        <div>${g.items.map(quellenZeile).join('')}</div>
      </details>`;
    }).join('')
    : '<div class="card"><div class="empty">Keine Quelle passt zu diesen Filtern.</div></div>';

  /* Ein Schalter über der Liste statt zwei darunter: nach dem Aufklappen lag
     „Alle zuklappen“ am Ende einer sehr langen Seite. */
  const kopf=$('#qu-schalter');
  if(kopf){
    const offen = gruppen.length && gruppen.every(g=>QU_OFFEN.has(g.kat.schluessel));
    kopf.innerHTML = gruppen.length
      ? `<button class="link" id="qu-klapp">${offen?'Alle zuklappen':'Alle aufklappen'}</button>` : '';
    const kl=$('#qu-klapp');
    if(kl) kl.onclick=()=>{
      if(offen) QU_OFFEN.clear(); else gruppen.forEach(g=>QU_OFFEN.add(g.kat.schluessel));
      quellenListe();
    };
  }

  $$('#qu-liste .gebiet').forEach(d2=>d2.ontoggle=()=>{
    if(d2.open) QU_OFFEN.add(d2.dataset.gebiet); else QU_OFFEN.delete(d2.dataset.gebiet);
  });
  const frei=$('#qu-frei');
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

/* =====================================================================
   QUELLEN AUFNEHMEN
   Eine Stelle für alle neuen Quellen: Dateien wählen, Prüfungsteil und
   Herkunft festlegen, Text im Browser gewinnen, in die Datenbank schreiben.
   Die Datei selbst wird nicht gespeichert – nur ihr Text.
   ===================================================================== */
let AUF = [];                 /* die zur Aufnahme vorgemerkten Dateien */
let PDFJS = null;

async function pdfWerkzeug(){
  if(PDFJS) return PDFJS;
  const m = await import('./bibliothek/pdf.mjs');
  m.GlobalWorkerOptions.workerSrc = './bibliothek/pdf.worker.mjs';
  PDFJS = m;
  return m;
}

/* Seitenweiser Text. PDF über pdf.js, alles andere als reiner Text. */
async function textGewinnen(datei, melden){
  const name = datei.name.toLowerCase();
  if(name.endsWith('.pdf')){
    const m = await pdfWerkzeug();
    const buch = await m.getDocument({data: await datei.arrayBuffer(),
                                      isEvalSupported:false, useSystemFonts:true}).promise;
    const seiten = [];
    for(let i=1;i<=buch.numPages;i++){
      const s = await buch.getPage(i);
      const t = await s.getTextContent();
      let zeile = '', aus = '';
      for(const p of t.items){
        if(p.str) zeile += p.str;
        if(p.hasEOL){ aus += zeile.trim()+'\n'; zeile=''; }
      }
      aus += zeile;
      seiten.push(saubereSeite(aus));
      if(melden && i%10===0) melden(i, buch.numPages);
    }
    if(melden) melden(buch.numPages, buch.numPages);
    return seiten;
  }
  /* Textdateien in Abschnitte von rund 3000 Zeichen zerlegen */
  const roh = saubereSeite(await datei.text());
  const teile = [];
  for(let i=0;i<roh.length;i+=3000) teile.push(roh.slice(i, i+3000));
  return teile.length? teile : [roh];
}

function saubereSeite(t){
  return (t||'').normalize('NFC')
    .replace(/­/g,'')
    .replace(/-\n(?=[a-zäöüß])/g,'')
    .replace(/[ \t ]+/g,' ')
    .split('\n').map(z=>z.trim()).join('\n')
    .replace(/\n{3,}/g,'\n\n').trim();
}

const AUF_KAT = [['recht','Völker-, Europa- und Staatsrecht'],['geschichte','Geschichte und Politik'],
  ['wirtschaft','Wirtschaft'],['franzoesisch','Sprachtest Französisch'],['verfahren','Auswahlverfahren und Berufsbild']];

function aufnahmeOeffnen(){
  AUF = [];
  const d = dialog('');
  d.querySelector('.card').style.maxWidth = '640px';
  aufnahmeZeichnen();
}

function aufnahmeZeichnen(laeuft){
  const d = $('#dlg'); if(!d) return;
  const kasten = d.querySelector('.card');
  kasten.innerHTML = `
    <h2 style="margin-bottom:6px">Quellen aufnehmen</h2>
    <p class="small mute" style="margin-bottom:18px">Wähle eine oder mehrere Dateien (PDF, TXT, MD). Der Text
      wird hier im Browser gewonnen und in die Datenbank geschrieben – die Datei selbst wird nicht gespeichert.
      Die tägliche Fragenerstellung sucht darin nach Belegstellen.</p>
    <div class="auf-wahl">
      <input type="file" id="auf-datei" multiple accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" hidden>
      <button class="btn ghost" id="auf-waehlen">Dateien wählen</button>
      <span class="small mute">${AUF.length? AUF.length+(AUF.length===1?' Datei':' Dateien')+' vorgemerkt' : 'noch nichts gewählt'}</span>
    </div>
    <div id="auf-liste" style="margin-top:16px;display:flex;flex-direction:column;gap:12px"></div>
    ${AUF.length? `
      <div class="card" style="margin-top:18px;padding:16px 18px;background:var(--tint);border:0">
        <div style="display:flex;flex-direction:column;gap:14px">
          <label class="fld">Prüfungsteil für alle
            <select id="auf-kat">${AUF_KAT.map(([k,n])=>`<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
          <label class="fld">Herausgeber
            <input id="auf-geber" placeholder="z. B. Bundeszentrale für politische Bildung"></label>
          <div class="row" style="gap:14px">
            <label class="fld" style="flex:1;min-width:130px">Einstufung<select id="auf-stufe">
              ${Object.entries(STUFE).map(([k,v])=>`<option value="${k}"${k==='behoerde'?' selected':''}>${esc(v.kurz)}</option>`).join('')}</select></label>
            <label class="fld" style="flex:1;min-width:130px">Prüfungsbezug<select id="auf-bezug">
              <option value="kern">Kernquelle</option><option value="ergaenzend" selected>Ergänzung</option></select></label>
            <label class="fld" style="flex:1;min-width:100px">Jahr<input id="auf-jahr" inputmode="numeric" placeholder="2026"></label>
          </div>
          <label class="fld">Sachgebiet (frei, erscheint als Bereich)
            <input id="auf-bereich" placeholder="z. B. Europarecht"></label>
        </div>
      </div>` : ''}
    <div id="auf-fehler" style="margin-top:14px"></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap">
      <button class="btn ghost" id="auf-ab" ${laeuft?'disabled':''}>Schließen</button>
      <button class="btn" id="auf-los" ${(!AUF.length||laeuft)?'disabled':''}>${
        laeuft? 'Wird aufgenommen …' : (AUF.length? AUF.length+(AUF.length===1?' Quelle':' Quellen')+' aufnehmen' : 'Aufnehmen')}</button>
    </div>`;

  $('#auf-waehlen').onclick=()=>$('#auf-datei').click();
  $('#auf-datei').onchange=(e)=>{
    for(const f of e.target.files){
      if(AUF.some(x=>x.datei.name===f.name && x.datei.size===f.size)) continue;
      AUF.push({datei:f, titel:f.name.replace(/\.[^.]+$/,'').replace(/[_~]+/g,' ').trim(), stand:''});
    }
    aufnahmeZeichnen();
  };
  $('#auf-ab').onclick=()=>{ d.remove(); renderQuellen(); };
  $('#auf-los').onclick=()=>aufnahmeStarten();
  aufnahmeListe();
}

function aufnahmeListe(){
  const box=$('#auf-liste'); if(!box) return;
  box.innerHTML = AUF.map((e,i)=>`
    <div class="auf-zeile">
      <input class="auf-titel" data-i="${i}" value="${esc(e.titel)}" placeholder="Titel">
      <span class="small mute auf-info">${mb(e.datei.size)}${e.stand?' · '+esc(e.stand):''}</span>
      <button class="link" data-weg="${i}">Entfernen</button>
    </div>`).join('');
  $$('#auf-liste .auf-titel').forEach(x=>x.oninput=()=>{ AUF[+x.dataset.i].titel=x.value; });
  $$('#auf-liste [data-weg]').forEach(b=>b.onclick=()=>{ AUF.splice(+b.dataset.weg,1); aufnahmeZeichnen(); });
}

async function aufnahmeStarten(){
  const kat=$('#auf-kat').value, geber=$('#auf-geber').value.trim(),
        stufe=$('#auf-stufe').value, bezug=$('#auf-bezug').value,
        jahr=$('#auf-jahr').value.trim(), bereich=$('#auf-bereich').value.trim();
  if(!AUF.every(e=>e.titel.trim())){
    $('#auf-fehler').innerHTML='<div class="hinweis fehler">Jede Datei braucht einen Titel.</div>'; return;
  }
  aufnahmeZeichnen(true);
  let fertig=0, seitenGesamt=0;
  for(const e of AUF){
    try{
      e.stand='Text wird gelesen …'; aufnahmeListe();
      const seiten = (await textGewinnen(e.datei, (i,n)=>{ e.stand=`Seite ${i} von ${n}`; aufnahmeListe(); }))
        .map((t,i)=>({t, i:i+1})).filter(x=>x.t.length>=200);
      if(!seiten.length){ e.stand='kein Text gefunden – übersprungen'; aufnahmeListe(); continue; }
      const volltext = seiten.map(x=>x.t).join('\n');
      e.stand='wird gespeichert …'; aufnahmeListe();
      const {data:qz, error} = await sb.from('quelle').insert({
        kategorie:kat, bereich:bereich||null, titel:e.titel.trim(), dateiname:e.datei.name,
        herausgeber:geber||'Herkunft nicht vermerkt', einstufung:stufe, relevanz:bezug,
        jahr:jahr||null, groesse:e.datei.size, seiten:seiten.length, textseiten:seiten.length,
        sprache:spracheRaten(volltext), zeichen:volltext.length, volltext:true, vorhanden:false
      }).select('id').single();
      if(error) throw error;
      for(let i=0;i<seiten.length;i+=40){
        const {error:e2} = await sb.from('quelltext').insert(
          seiten.slice(i,i+40).map(x=>({quelle:qz.id, seite:x.i, text:x.t, sprache:spracheRaten(volltext)})));
        if(e2) throw e2;
        e.stand=`gespeichert: ${Math.min(i+40, seiten.length)} von ${seiten.length} Seiten`; aufnahmeListe();
      }
      e.stand=`aufgenommen · ${seiten.length} Seiten`; seitenGesamt+=seiten.length; fertig++;
      aufnahmeListe();
    }catch(x){
      e.stand='Fehler: '+fehlertext(x); aufnahmeListe();
    }
  }
  $('#auf-fehler').innerHTML = `<div class="hinweis">${fertig} von ${AUF.length} Quellen aufgenommen,
    zusammen ${seitenGesamt} Seiten Text. Die Tagesaufgabe findet sie ab sofort.</div>`;
  const ab=$('#auf-ab'), los=$('#auf-los');
  if(ab) ab.disabled=false;
  if(los){ los.disabled=true; los.textContent='Fertig'; }
}

/* Grobe Spracherkennung: reicht, um den richtigen Suchindex zu treffen. */
function spracheRaten(t){
  const p = t.slice(0, 20000).toLowerCase();
  const z = (re)=> (p.match(re)||[]).length;
  const de = z(/\b(und|der|die|das|nicht|werden|eine|dass)\b/g);
  const en = z(/\b(the|and|of|that|with|which|from|their)\b/g);
  const fr = z(/\b(les|des|une|dans|pour|est|que|avec)\b/g);
  return (fr>de && fr>en) ? 'fr' : (en>de ? 'en' : 'de');
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
      ${q&&q.volltext?`<div class="small mute">Volltext liegt in der Datenbank: ${q.textseiten} Seiten,
        aus einer PDF von ${mb(q.groesse)} gewonnen. Die Datei selbst wird nicht gespeichert.</div>`:''}
      <div id="d-fehler"></div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn ghost" id="d-ab">Abbrechen</button>
        <button class="btn" id="d-ok">Speichern</button>
      </div>
    </div>`);
  $('#d-ab').onclick=()=>d.remove();
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
  if(!confirm('Diese '+weg.length+' Quellen mitsamt ihrem Volltext entfernen?\n\n'+liste
              +'\n\nDie Fragen bleiben davon unberührt. Die PDF-Dateien liegen weiterhin auf deinem Rechner.')) return;
  toast('Wird entfernt …');
  const {error} = await sb.from('quelle').delete().in('id', weg.map(q=>q.id));
  if(error){ toast(fehlertext(error)); return; }
  toast(weg.length+' Quellen entfernt.');
  renderQuellen();
}

async function quelleLoeschen(q){
  /* Der Bestand ist gemeinsam und die PDFs liegen nicht mehr im Speicher:
     ein gelöschter Volltext ist endgültig weg. Bei Kernquellen deshalb ein
     zweiter, deutlicher Rückfragesatz. */
  if(!confirm('„'+q.titel+'“ wirklich löschen? Der Volltext dieser Quelle ('
              +(q.textseiten||0)+' Seiten) wird mitentfernt und steht der Tagesaufgabe nicht mehr zur Verfügung.')) return;
  if(q.relevanz==='kern' && !confirm('Achtung: „'+q.titel+'“ ist als Kernquelle eingestuft – '
      +'eine der Grundlagen für die täglichen Fragen. Der Bestand gehört allen Zugängen, '
      +'und der Text lässt sich nicht wiederherstellen. Trotzdem löschen?')) return;
  const {error} = await sb.from('quelle').delete().eq('id', q.id);
  if(error){ toast(fehlertext(error)); return; }
  toast('Quelle gelöscht.'); renderQuellen();
}

let TX_SEITE = 0, TX_QUELLE = null;

/* Der Volltext ersetzt die PDF-Datei: nachlesen, ohne etwas herunterzuladen. */
async function quelleOeffnen(q){
  TX_QUELLE = q; TX_SEITE = 0;
  const d = dialog('<div class="empty">Wird geladen …</div>');
  d.querySelector('.card').style.maxWidth = '760px';
  await textSeiteZeigen();
}

async function textSeiteZeigen(){
  const q = TX_QUELLE, d = $('#dlg'); if(!q||!d) return;
  const kasten = d.querySelector('.card');
  const {data, error} = await sb.from('quelltext')
    .select('seite,text').eq('quelle', q.id).order('seite')
    .range(TX_SEITE, TX_SEITE);
  const s = data && data[0];
  const n = q.textseiten || 0;
  kasten.innerHTML = `
    <div class="eyebrow">${esc(q.herausgeber||'Quelle')}</div>
    <h3 style="margin:6px 0 4px">${esc(q.titel)}</h3>
    <p class="small mute" style="margin:0 0 16px">${esc(q.dateiname)}${q.jahr?' · '+esc(q.jahr):''} · ${n} Seiten mit Text</p>
    ${error||!s
      ? '<div class="empty">Für diese Seite liegt kein Text vor.</div>'
      : `<div class="tx-seite">${esc(s.text)}</div>`}
    <div class="row" style="gap:10px;align-items:center;margin-top:18px;flex-wrap:wrap">
      <button class="btn ghost sm" id="tx-zur" ${TX_SEITE<=0?'disabled':''}>← Zurück</button>
      <span class="small mute" style="flex:1;text-align:center">Seite ${
        s? s.seite : '–'} · ${TX_SEITE+1} von ${n}</span>
      <button class="btn ghost sm" id="tx-vor" ${TX_SEITE>=n-1?'disabled':''}>Weiter →</button>
      <button class="btn sm" id="tx-zu" style="width:100%;margin-top:6px">Schließen</button>
    </div>`;
  const z=$('#tx-zur'), v=$('#tx-vor'), x=$('#tx-zu');
  if(z) z.onclick=()=>{ if(TX_SEITE>0){ TX_SEITE--; textSeiteZeigen(); } };
  if(v) v.onclick=()=>{ if(TX_SEITE<n-1){ TX_SEITE++; textSeiteZeigen(); } };
  if(x) x.onclick=()=>d.remove();
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
      <label class="fld">Neues Passwort<input id="p-neu" type="text" minlength="10" value=""></label>
      <div id="p-fehler"></div>
      <div style="display:flex;gap:12px;justify-content:flex-end">
        <button class="btn ghost" id="p-ab">Abbrechen</button>
        <button class="btn" id="p-ok">Setzen</button>
      </div>
    </div>`);
  /* Zwölf Zeichen: die Funktion verlangt mindestens zehn. */
  const zufall = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b=>'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%56]).join('');
  $('#p-neu').value = zufall;
  $('#p-ab').onclick=()=>d.remove();
  $('#p-ok').onclick=async ()=>{
    const pw=$('#p-neu').value;
    if(pw.length<10){ $('#p-fehler').innerHTML='<div class="hinweis fehler">Mindestens zehn Zeichen.</div>'; return; }
    try{ await funktionRufen('nutzer-verwalten', {aktion:'passwort', nutzer:id, passwort:pw});
         d.remove(); toast('Passwort gesetzt.'); }
    catch(e){ $('#p-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(e))}</div>`; }
  };
}

/* Das Feld heißt in der Funktion „nutzer“ – nicht „id“. Solange hier „id“
   stand, kam bei jedem Versuch „Kein Konto angegeben“ zurück. */
async function nutzerLoeschen(id, mail){
  if(!confirm('Konto '+mail+' endgültig löschen?\n\nDurchgänge, Antworten und Markierungen dieser Person '
             +'werden mitgelöscht. Aufgenommene Quellen bleiben erhalten, verlieren aber den Vermerk, '
             +'wer sie eingestellt hat.')) return;
  try{
    await funktionRufen('nutzer-verwalten', {aktion:'loeschen', nutzer:id});
    toast('Konto gelöscht.');
    nutzerlisten();
  }catch(e){ toast(fehlertext(e)); }
}


/* =====================================================================
   MEHR – Konto, Installation und Verwaltung an einem Ort
   ===================================================================== */
/* Der tägliche Lauf erzeugt um 6 Uhr Berliner Zeit einen Abschnitt "Tag N".
   Diese Auswertung liest den Bestand und rechnet daraus den Stand aus. */
function tagesstand(){
  const paket = {};
  for(const q of ALLES){
    const b = q.block || '—';
    (paket[b] = paket[b] || {block:b, n:0, stand:null});
    paket[b].n++;
    if(q.stand && (!paket[b].stand || q.stand > paket[b].stand)) paket[b].stand = q.stand;
  }
  const tage = Object.values(paket)
    .filter(p=>/^Tag \d+$/.test(p.block))
    .sort((a,b)=> parseInt(a.block.slice(4)) - parseInt(b.block.slice(4)));
  const feste = Object.values(paket).filter(p=>!/^Tag \d+$/.test(p.block));

  /* Nächster Lauf: 6 Uhr Berliner Zeit, heute oder morgen. */
  const jetzt = new Date();
  const naechster = new Date(jetzt);
  naechster.setHours(6,0,0,0);
  if(naechster <= jetzt) naechster.setDate(naechster.getDate()+1);

  const letzter = tage.at(-1) || null;
  const heute = heutigesDatum();
  const heuteDa = !!(letzter && letzter.stand === heute);
  const tagLuecke = letzter && letzter.stand
    ? Math.round((new Date(heute) - new Date(letzter.stand)) / 86400000) : null;

  return {tage, feste, letzter, naechster, heuteDa, tagLuecke,
          fragenAusLaeufen: tage.reduce((a,t)=>a+t.n,0)};
}
const heutigesDatum = ()=> new Date().toISOString().slice(0,10);

function tagesstandKachel(){
  const t = tagesstand();
  const datum = (iso)=> iso ? new Date(iso).toLocaleDateString('de-DE',
      {weekday:'short', day:'numeric', month:'long'}) : 'unbekannt';
  const uhr = t.naechster.toLocaleString('de-DE', {weekday:'long', hour:'2-digit', minute:'2-digit'});
  const zustand = t.heuteDa ? 'gut'
    : (t.tagLuecke!==null && t.tagLuecke<=1 ? 'gut' : (t.tagLuecke===null ? 'offen' : 'warnung'));
  const satz = t.heuteDa
    ? 'Der heutige Abschnitt ist da.'
    : (t.tagLuecke===null ? 'Bisher hat noch kein Lauf geschrieben.'
       : (t.tagLuecke<=1 ? 'Der letzte Lauf liegt einen Tag zurück – der heutige steht noch aus.'
                         : `Seit ${t.tagLuecke} Tagen ist nichts hinzugekommen.`));
  return `<button class="kachel" data-v="tagesstand">
      <h3>Tägliche Fragen <span class="ampel ${zustand}"></span></h3>
      <p>${esc(satz)} ${t.tage.length} ${t.tage.length===1?'Lauf':'Läufe'} bisher,
         zusammen ${t.fragenAusLaeufen} Fragen.</p>
      <span class="zahl">nächster Lauf ${esc(uhr)} Uhr</span>
    </button>`;
}

function renderTagesstand(){
  const t = tagesstand();
  const datum = (iso)=> iso ? new Date(iso).toLocaleDateString('de-DE',
      {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : 'unbekannt';
  const l = letzteJeFrage();
  const gezeigt = t.tage.slice().reverse();
  const zeige = gezeigt.slice(0, TS_MEHR);

  $('#ts-inhalt').innerHTML = `
    <div class="grid g4" style="margin-bottom:26px">
      <div class="card kpi"><div class="lab">Läufe bisher</div><div class="val">${t.tage.length}</div>
        <div class="sub">seit dem ersten Abschnitt</div></div>
      <div class="card kpi"><div class="lab">Letzter Lauf</div><div class="val">${
        t.letzter? esc(t.letzter.block) : '–'}</div>
        <div class="sub">${t.letzter? esc(datum(t.letzter.stand)) : 'noch keiner'}</div></div>
      <div class="card kpi"><div class="lab">Nächster Lauf</div><div class="val">6<span> Uhr</span></div>
        <div class="sub">${esc(t.naechster.toLocaleDateString('de-DE',{weekday:'long', day:'numeric', month:'long'}))}</div></div>
      <div class="card kpi"><div class="lab">Fragen aus Läufen</div><div class="val">${t.fragenAusLaeufen}</div>
        <div class="sub">von ${ALLES.length} insgesamt</div></div>
    </div>

    ${t.heuteDa
      ? `<div class="card pad" style="margin-bottom:26px">
           <p class="small" style="margin:0"><b style="color:var(--ink)">Alles in Ordnung.</b>
             Der Abschnitt von heute steht in der Anwendung.
             Der nächste Lauf schreibt morgen früh um 6 Uhr.</p></div>`
      : `<div class="hinweis fehler" style="margin-bottom:26px">
          ${t.tagLuecke===null
            ? `<b>Noch kein Lauf.</b> Die geplante Aufgabe hat bisher keinen Abschnitt geschrieben.`
            : `<b>Heute noch nichts.</b> Der letzte Abschnitt stammt vom ${esc(datum(t.letzter&&t.letzter.stand))}
               – das ist ${t.tagLuecke} ${t.tagLuecke===1?'Tag':'Tage'} her. Ein ausgefallener Tag bleibt folgenlos:
               die Aufgabe zählt vom höchsten vorhandenen Abschnitt weiter, nicht vom Kalender.`}
         </div>`}

    <div class="sec" style="margin-top:0">
      <div class="sec-h"><h2>Die einzelnen Läufe</h2><span class="note">neueste zuerst</span></div>
      <div class="card">
        ${zeige.length? zeige.map(p=>{
          const fragen = ALLES.filter(q=>q.block===p.block);
          const auf = fragen.filter(q=>l[q.id]).length;
          const proz = fragen.length? Math.round(auf/fragen.length*100) : 0;
          return `<div class="feld">
            <span class="sq" style="--kc:var(--ink)"></span>
            <span class="nm">${esc(p.block)}<small style="display:block;color:var(--muted-2);font-size:12.5px">${
              esc(datum(p.stand))}</small></span>
            <span class="bar"><i style="width:${proz}%"></i></span>
            <span class="qt tnum" style="width:74px">${auf}/${p.n}</span>
            <span style="flex:none"><button class="btn ghost sm" data-ts-ueben="${esc(p.block)}">Üben</button></span>
          </div>`;
        }).join('') : '<div class="empty">Noch kein täglicher Lauf.</div>'}
        ${gezeigt.length>zeige.length
          ? `<div class="morerow"><button class="link" id="ts-mehr">Weitere ${
               Math.min(10, gezeigt.length-zeige.length)} von ${gezeigt.length-zeige.length} anzeigen</button></div>`
          : (TS_MEHR>10? `<div class="morerow"><button class="link" id="ts-weniger">Wieder einklappen</button></div>`:'')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Feste Abschnitte</h2><span class="note">bleiben unverändert</span></div>
      <div class="card">
        ${t.feste.map(p=>`<div class="feld">
          <span class="sq" style="--kc:var(--muted-2)"></span>
          <span class="nm">${esc(p.block)}</span>
          <span class="ct" style="width:auto">${p.n} Fragen</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Wie der Lauf arbeitet</h2></div>
      <div class="card pad">
        <p class="small" style="margin:0">Jeden Morgen um 6 Uhr Berliner Zeit kommt ein neuer Abschnitt
          <b>Tag N</b>: 75 Fachtestfragen und ein vollständiger Sprachtestsatz. Welche Themenfelder
          drankommen, bestimmt der Lehrplan. Bestehende Abschnitte bleiben unverändert.</p>
      </div>
    </div>`;

  $$('#ts-inhalt [data-ts-ueben]').forEach(b=>b.onclick=()=>{
    const ids = ALLES.filter(q=>q.block===b.dataset.tsUeben).map(q=>q.id);
    if(ids.length) start({typ:'auswahl', zeit:0, titel:'Übung · '+b.dataset.tsUeben, ids});
  });
  const m=$('#ts-mehr'); if(m) m.onclick=()=>{ TS_MEHR+=10; renderTagesstand(); };
  const w=$('#ts-weniger'); if(w) w.onclick=()=>{ TS_MEHR=10; renderTagesstand(); };
}
let TS_MEHR = 10;

function renderMehr(){
  const l=letzteJeFrage();
  const kacheln = [
    {v:'konto', t:'Konto', p:'Name, Passwort, Fortschritt sichern und die Anleitung, wie der Trainer als App auf dem iPhone landet.',
     z: esc(PROFIL.email)},
  ];
  kacheln.push({v:'quellen', t:'Quellen',
    p:'Grundlage der täglich erzeugten Fragen, geordnet nach Prüfungsteil, mit Herausgeber und Einstufung. Du kannst eigene Dokumente aufnehmen und Quellen entfernen.',
    z: QU_ALLE.length ? QU_ALLE.length+' Dokumente' : 'aufnehmen und pflegen'});
  if(istAdmin()) kacheln.push(
    {v:'nutzer',  t:'Nutzer',  p:'Konten, Rollen und Einladungslinks. Neue Zugänge entstehen ausschließlich über einen Link.', z:'nur für Administratoren'});

  $('#mehrgitter').innerHTML = kacheln.map(k=>
    `<button class="kachel" data-v="${k.v}"><h3>${esc(k.t)}</h3><p>${esc(k.p)}</p><span class="zahl">${k.z}</span></button>`).join('')
    + tagesstandKachel()
    + `<div class="kachel" style="cursor:default">
         <h3>Bestand</h3>
         <p>${ALLES.length} Fragen in ${[...new Set(ALLES.map(q=>q.block))].length} Abschnitten ·
            ${Object.keys(l).length} davon bearbeitet · ${MARKIERT.size} markiert.</p>
         <span class="zahl">Prüfung am 1. September 2026</span>
       </div>`;
  $$('#mehrgitter [data-v]').forEach(b=>b.onclick=()=>go(b.dataset.v));
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
  /* Der Lehrplan bestimmt, wie Themenfelder gruppiert werden – auch auf der
     Übersicht. Deshalb gleich mitladen und die Übersicht danach auffrischen. */
  lehrplanLaden().then(ok=>{ if(ok && ANSICHT==='dash') renderDash(); }, ()=>{});

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

/* =====================================================================
   AKTUALISIERUNG
   Auf dem Home-Bildschirm hält iOS die alten Dateien hartnäckig fest. Der
   Dienst wird deshalb bei jedem Start und bei jeder Rückkehr in den
   Vordergrund neu geprüft; übernimmt eine neue Fassung, lädt die Seite
   genau einmal nach.
   ===================================================================== */
const FASSUNG = 'tt-2026-08-04-4';
let SW_REG = null, SW_NEULADEN = false, SW_SPAETER = false;

async function dienstStarten(){
  if(!('serviceWorker' in navigator)) return;
  try{
    SW_REG = await navigator.serviceWorker.register('sw.js', {updateViaCache:'none'});
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(SW_NEULADEN) return;
      /* Niemals mitten im Durchgang neu laden: die Antworten stehen bis zur
         Auswertung nur im Arbeitsspeicher und wären sonst verloren. */
      if(LAUF){ SW_SPAETER = true; return; }
      SW_NEULADEN = true;
      location.reload();
    });
    nachAktualisierungSehen();
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) nachAktualisierungSehen(); });
    setInterval(nachAktualisierungSehen, 30*60*1000);
  }catch(e){}
}

async function nachAktualisierungSehen(melden){
  if(!SW_REG){ if(melden) toast('Kein Zwischenspeicher aktiv.'); return; }
  /* Während eines Durchgangs und in der Durchsicht bleibt die Fassung stehen.
     Eine neue Fassung würde die Seite neu laden und den Lauf mitnehmen. */
  if(LAUF){ if(melden) toast('Erst nach dem Durchgang – sonst gingen die Antworten verloren.'); return; }
  try{
    await SW_REG.update();
    const neu = SW_REG.waiting || SW_REG.installing;
    if(SW_REG.waiting){
      SW_REG.waiting.postMessage({typ:'uebernehmen'});
      if(melden) toast('Neue Fassung wird geladen …');
    }else if(melden){
      toast(neu ? 'Neue Fassung wird geladen …' : 'Du hast bereits die neueste Fassung.');
    }
  }catch(e){ if(melden) toast('Prüfung nicht möglich – keine Verbindung.'); }
}
dienstStarten();

/* ---------- Anzeigegröße auf dem Telefon ----------
   Manche Geräte bauen die Seite auf einer breiteren Bühne auf als der
   Bildschirm hergibt und verkleinern sie danach. Dann wird die Bühnenbreite
   erneut gesetzt, damit wieder in Gerätepunkten gerechnet wird. Trifft die
   Bedingung nicht zu – der Normalfall –, ändert sich nichts. */
function bildschirmMassnehmen(){
  const m = document.querySelector('meta[name=viewport]');
  if(!m || !window.screen) return;
  const geraet = Math.min(screen.width||0, screen.height||0);
  if(!geraet || window.innerWidth <= geraet * 1.3) return;
  m.setAttribute('content', 'width=' + geraet + ', initial-scale=1, viewport-fit=cover');
  setTimeout(()=>m.setAttribute('content',
    'width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no'), 300);
}
bildschirmMassnehmen();
window.addEventListener('orientationchange', ()=>setTimeout(bildschirmMassnehmen, 250));

starten();
