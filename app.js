/* =====================================================================
   Testtrainer · Auswahlverfahren höherer Auswärtiger Dienst
   Online-Fassung mit Benutzerkonten (Supabase)
   ===================================================================== */

const SB_URL = 'https://xuybdwxbyfdlvydspfgq.supabase.co';
const SB_KEY = 'sb_publishable_e5iNDQQqMvpH2TFWUiUvbQ_rWQqHnBk';
const sb = window.supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

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
function navBauen(){
  const punkte = [
    ['dash','Dashboard'], ['train','Fachtests'], ['fr','Französisch'],
    ['archiv','Fehlerarchiv'], ['pool','Fragenpool']
  ];
  if(istAdmin()) punkte.push(['quellen','Quellen'], ['nutzer','Nutzer']);
  punkte.push(['konto','Konto']);
  $('#nav').innerHTML = punkte.map(([v,t])=>
    `<button data-v="${v}" class="${v===ANSICHT?'on':''}${(v==='quellen'||v==='nutzer')?' admin':''}">${t}</button>`).join('');
  $$('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.v));
}

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
      <div class="grid g4" id="kpis"></div>
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
        <h1>Fachtests</h1>
        <p class="lead">Im Original hast du 25 Fragen in 10 Minuten – gut 20 Sekunden pro Frage. Alle Modi mit Timer bilden das nach.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="sec" style="margin-top:0">
        <div class="sec-h"><h2>Heute</h2><span class="note" id="today-note"></span></div>
        <div class="modes" id="modes-today"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Prüfungssimulation</h2><span class="note">drei Tests hintereinander</span></div>
        <div class="modes" id="modes-exam"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Gezielt üben</h2></div>
        <div class="modes" id="modes-drill"></div>
      </div>
    </div>`;

  $('#fr-menu').innerHTML = `
    <div class="wrap page">
      <div class="eyebrow">Zweite Prüfsprache</div>
      <div class="row"><div style="flex:1;min-width:280px">
        <h1>Sprachtest Französisch</h1>
        <p class="lead">52 Fragen in 30 Minuten, 60 Punkte, bestanden ab 30. Drei Teile, die du dir zeitlich selbst einteilen kannst.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="spec" id="fr-spec"></div>
      <div class="sec">
        <div class="sec-h"><h2>Heute</h2><span class="note" id="fr-today-note"></span></div>
        <div class="modes" id="fr-today"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Prüfungssimulation</h2><span class="note">Originalformat des Auswärtigen Amts</span></div>
        <div class="modes" id="fr-exam"></div>
      </div>
      <div class="sec">
        <div class="sec-h"><h2>Einzelne Teile</h2></div>
        <div class="modes" id="fr-drill"></div>
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
        <p class="lead">Alle Fragen zum Nachschlagen, mit Lösung und Erläuterung.</p>
      </div></div>
    </div>
    <div class="wrap">
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
        <p class="lead">Grundlage für die täglich neu erzeugten Fragen. Nach Sachgebieten sortiert, mit Datei im Cloudspeicher.</p>
      </div></div>
    </div>
    <div class="wrap">
      <div class="card pad" style="display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:26px">
        <label class="fld" style="flex:1;min-width:220px">Suche<input type="search" id="qu-suche" placeholder="Titel oder Dateiname"></label>
        <label class="fld" style="flex:1;min-width:170px">Sachgebiet<select id="qu-kat"></select></label>
        <label class="fld" style="flex:1;min-width:150px">Datei<select id="qu-datei">
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
  $$('#nav button').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  $$('.view').forEach(s=>s.classList.toggle('on', s.id==='v-'+v));
  window.scrollTo({top:0});
  if(v==='dash') renderDash();
  if(v==='train'){ if(!LAUF || LAUF.view!=='train' || LAUF.phase==='ergebnis'){ LAUF=null; renderMenu(); } }
  if(v==='fr'){ if(!LAUF || LAUF.view!=='fr' || LAUF.phase==='ergebnis'){ LAUF=null; renderFrMenu(); } }
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

  frcard(); chart(); weak(); sessionsListe();
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
    <button class="btn ghost" id="zu-fr">Zum Sprachtest</button></div>`;
  $('#zu-fr').onclick=()=>go('fr');
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
    ? `<table><thead><tr><th style="width:66px">Datum</th><th>Durchgang</th><th style="width:76px">Ergebnis</th><th style="width:66px">Zeit</th></tr></thead><tbody>${
        rows.map(s=>`<tr><td class="mute tnum">${datumKurz(s.datum)}</td><td>${esc(s.titel)}</td>
        <td class="tnum" style="font-weight:700;color:${s.quote>=70?'var(--ok)':s.quote>=50?'var(--gold)':'var(--bad)'}">${s.richtig}/${s.n}</td>
        <td class="tnum mute">${mmss(s.dauer)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Noch kein Durchgang abgeschlossen.</div>';
}

/* =====================================================================
   TRAINING – Menüs
   ===================================================================== */
const neuesteTage = ()=> [...new Set(F.map(q=>q.block).filter(b=>b.startsWith('Tag ')))]
  .sort((a,b)=>parseInt(b.slice(4))-parseInt(a.slice(4)));

function karte(o){
  return `<button class="mode" data-mode='${esc(JSON.stringify(o.cfg))}'>
    ${o.kicker?`<div class="kicker">${esc(o.kicker)}</div>`:''}
    <h3>${esc(o.t)}</h3><p>${esc(o.p)}</p>
    <div class="meta">${o.meta.map(m=>`<em>${esc(m)}</em>`).join('')}</div>
    <span class="go">→</span></button>`;
}

function renderMenu(){
  $('#train-menu').style.display=''; $('#train-run').style.display='none'; $('#train-run').innerHTML='';
  const neu=neuesteTage()[0], l=letzteJeFrage();
  const heutePool = neu? F.filter(q=>q.block===neu) : [];
  const offenHeute = heutePool.filter(q=>!l[q.id]).length;
  $('#today-note').textContent = neu? (offenHeute? offenHeute+' von '+heutePool.length+' Fragen offen' : 'Tagespensum erledigt') : '';

  $('#modes-today').innerHTML = neu
    ? (offenHeute===0 ? `<div class="banner"><b>Tagespensum erledigt.</b> Alle Fragen aus ${esc(neu)} bearbeitet – eine gute Grundlage für eine Wiederholungsrunde.</div>` : '')
      + ALLE.filter(k=>heutePool.some(q=>q.kategorie===k)).map(k=>{
        const n=heutePool.filter(q=>q.kategorie===k).length;
        const off=heutePool.filter(q=>q.kategorie===k && !l[q.id]).length;
        return karte({kicker:neu, t:KAT[k].kurz, p:KAT[k].name+'. Neuer Abschnitt im Originalformat.',
          meta:[n+' Fragen', n===25?'10:00 Min':'ohne Zeitdruck', off?off+' offen':'erledigt'],
          cfg:{typ:'block', block:neu, kat:k, zeit:n===25?600:0, titel:KAT[k].kurz+' · '+neu}});
      }).join('')
    : '<div class="card pad mute">Noch kein Tagesabschnitt vorhanden.</div>';

  $('#modes-exam').innerHTML = [
    karte({kicker:'Ernstfall', t:'Vollsimulation', p:'Alle drei Fachtests hintereinander, je 25 Fragen in 10 Minuten – wie am 1. September.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'sim', zeit:600, titel:'Vollsimulation Fachtests'}}),
    karte({kicker:'Original', t:'Auswahlverfahren 2023', p:'Die drei veröffentlichten Fachtests des Jahrgangs 2023 im Original.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'orig', block:'Original 2023', zeit:600, titel:'Originalprüfung 2023'}}),
    karte({kicker:'Original', t:'Auswahlverfahren 2019', p:'Die drei veröffentlichten Fachtests des Jahrgangs 2019 im Original.',
      meta:['75 Fragen','3 × 10:00 Min'], cfg:{typ:'orig', block:'Original 2019', zeit:600, titel:'Originalprüfung 2019'}})
  ].join('');

  const fal=falscheOffen(), nieGesehen=F.filter(q=>!l[q.id]).length;
  $('#modes-drill').innerHTML = [
    karte({kicker:'Empfohlen', t:'Wiederholung', p:'Fragen, die du zuletzt falsch hattest – der wirksamste Teil des Trainings.',
      meta:[fal.length+' Fragen', fal.length?'ohne Zeitdruck':'nichts offen'], cfg:{typ:'fehler', zeit:0, titel:'Wiederholung'}}),
    ...ALLE.map(k=>{ const s=statsKat(k);
      return karte({kicker:'Zufallssatz', t:KAT[k].kurz, p:'25 zufällige Fragen aus dem gesamten Bestand dieser Kategorie, mit Prüfungstimer.',
        meta:[s.pool+' im Pool', s.offen+' offen','10:00 Min'], cfg:{typ:'zufall', kat:k, n:25, zeit:600, titel:KAT[k].kurz+' · Zufallssatz'}}); }),
    karte({kicker:'Neuland', t:'Nur neue Fragen', p:'Alles, was du noch nie beantwortet hast, über die drei Fachtests gemischt.',
      meta:[nieGesehen+' Fragen','ohne Zeitdruck'], cfg:{typ:'neu', n:25, zeit:0, titel:'Nur neue Fragen'}})
  ].join('');

  $$('#train-menu .mode').forEach(b=>b.onclick=()=>start(JSON.parse(b.dataset.mode)));
}

const frTage = ()=> [...new Set(FR.map(q=>q.block).filter(b=>b.startsWith('Tag ')))]
  .sort((a,b)=>parseInt(b.slice(4))-parseInt(a.slice(4)));
const frTeilFragen = t => FR.filter(q=>q.teil===t);

function renderFrMenu(){
  $('#fr-menu').style.display=''; $('#fr-run').style.display='none'; $('#fr-run').innerHTML='';
  const l=letzteJeFrage();

  $('#fr-spec').innerHTML = Object.entries(FR_TEIL).map(([k,t])=>
    `<div><div class="t">${esc(t.kurz)}</div><div class="v">${t.fragen} <span style="font-size:15px;font-weight:400;color:var(--muted-2)">Fragen</span></div>
     <div class="s">${t.punkte} ${t.punkte===1?'Punkt':'Punkte'} je Frage · ${t.fragen*t.punkte} Punkte · ca. ${Math.round(t.zeit/60)} Min</div></div>`).join('');

  const neu=frTage()[0];
  const tagesPool=neu? FR.filter(q=>q.block===neu):[];
  const offen=tagesPool.filter(q=>!l[q.id]).length;
  $('#fr-today-note').textContent = neu? (offen? offen+' von '+tagesPool.length+' Fragen offen':'Tagespensum erledigt') : '';
  $('#fr-today').innerHTML = neu
    ? (offen===0? `<div class="banner"><b>Tagespensum erledigt.</b> Alle Fragen aus ${esc(neu)} bearbeitet.</div>`:'')
      + Object.keys(FR_TEIL).filter(t=>tagesPool.some(q=>q.teil===t)).map(t=>{
          const n=tagesPool.filter(q=>q.teil===t).length, off=tagesPool.filter(q=>q.teil===t&&!l[q.id]).length;
          return karte({kicker:neu, t:FR_TEIL[t].kurz, p:FR_TEIL[t].name+'. Neuer Abschnitt im Originalformat.',
            meta:[n+' Fragen', off?off+' offen':'erledigt'],
            cfg:{view:'fr', typ:'frBlock', block:neu, teil:t, zeit:0, titel:FR_TEIL[t].kurz+' · '+neu}});
        }).join('')
    : '<div class="card pad mute">Noch kein Tagesabschnitt vorhanden.</div>';

  $('#fr-exam').innerHTML=[
    karte({kicker:'Ernstfall', t:'Vollständiger Sprachtest', p:'Alle drei Teile hintereinander mit einem gemeinsamen Zeitbudget von 30 Minuten – wie am 1. September.',
      meta:['52 Fragen','30:00 Min','60 Punkte'], cfg:{view:'fr', typ:'frSim', zeit:FR_META.dauer, gesamt:true, titel:'Vollständiger Sprachtest'}}),
    karte({kicker:'Original', t:'AA-Musteraufgaben', p:'Die vom Auswärtigen Amt veröffentlichten Beispielaufgaben zum Sprachtest Französisch.',
      meta:[FR.filter(q=>q.block==='AA-Musteraufgaben').length+' Fragen','ohne Zeitdruck'],
      cfg:{view:'fr', typ:'frBlockAlle', block:'AA-Musteraufgaben', zeit:0, titel:'AA-Musteraufgaben'}}),
    karte({kicker:'Empfohlen', t:'Wiederholung', p:'Französischfragen, die du zuletzt falsch beantwortet hast.',
      meta:[falscheOffen(FR).length+' Fragen','ohne Zeitdruck'], cfg:{view:'fr', typ:'frFehler', zeit:0, titel:'Wiederholung Französisch'}})
  ].join('');

  $('#fr-drill').innerHTML = Object.entries(FR_TEIL).map(([k,t])=>{
    const pool=frTeilFragen(k), off=pool.filter(q=>!l[q.id]).length;
    return karte({kicker:'Einzelteil', t:t.kurz, p:t.name+'. Zufallssatz im Prüfungsumfang, mit der empfohlenen Zeit.',
      meta:[pool.length+' im Pool', off+' offen', mmss(t.zeit)+' Min'],
      cfg:{view:'fr', typ:'frTeil', teil:k, zeit:t.zeit, titel:t.kurz}});
  }).join('');

  $$('#fr-menu .mode').forEach(b=>b.onclick=()=>start(JSON.parse(b.dataset.mode)));
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
  }
  return [];
}

function start(cfg){
  const teile=baueTeile(cfg).filter(t=>t.fragen.length);
  if(!teile.length){ toast('Für diesen Durchgang sind gerade keine Fragen vorhanden.'); return; }
  const view=cfg.view||'train';
  const anderer = view==='fr' ? '#train-run' : '#fr-run';
  $(anderer).innerHTML=''; $(anderer).style.display='none';
  $(view==='fr' ? '#train-menu' : '#fr-menu').style.display='';
  LAUF={cfg, view, mount:view==='fr'?'#fr-run':'#train-run', teile, ti:0, i:0, antw:{}, mark:{}, start:Date.now(), phase:'lauf'};
  $(view==='fr'?'#fr-menu':'#train-menu').style.display='none';
  $(LAUF.mount).style.display='';
  go(view); renderFrage(); starteTimer();
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
    clearInterval(TICK); const v=LAUF.view; LAUF=null; v==='fr'?renderFrMenu():renderMenu(); } };
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
  const fr = sess.kats.includes('franzoesisch');
  const farbe = sess.quote>=70?'#1c6f45':sess.quote>=50?'#8a6d0b':'#b3121b';
  const vollerTest = fr && LAUF.cfg.typ==='frSim' && sess.maxPunkte===FR_META.punkte;
  const gruppen = fr
    ? Object.keys(FR_TEIL).filter(t=>alle.some(q=>q.teil===t)).map(t=>{
        const qs=alle.filter(q=>q.teil===t);
        return {kls:'k-franzoesisch', name:FR_TEIL[t].kurz,
                r:qs.filter(q=>LAUF.antw[q.id]===q.loesung).length, n:qs.length,
                p:qs.filter(q=>LAUF.antw[q.id]===q.loesung).reduce((a,q)=>a+q.punkte,0),
                mp:qs.reduce((a,q)=>a+q.punkte,0)}; })
    : [...new Set(alle.map(q=>q.kategorie))].map(k=>{
        const qs=alle.filter(q=>q.kategorie===k);
        return {kls:'k-'+k, name:KAT[k].kurz, r:qs.filter(q=>LAUF.antw[q.id]===q.loesung).length, n:qs.length}; });

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
  const v=LAUF.view;
  M('#e-menu').onclick=()=>{ LAUF=null; v==='fr'?renderFrMenu():renderMenu(); };
  M('#e-dash').onclick=()=>{ LAUF=null; v==='fr'?renderFrMenu():renderMenu(); go('dash'); };
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
function renderPool(){
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
    $('#qu-neu').onclick=()=>quelleBearbeiten(null);
  }
  quellenListe();
}

function quellenListe(){
  const s=$('#qu-suche').value.toLowerCase().trim(), k=$('#qu-kat').value, d=$('#qu-datei').value;
  let r=QU_ALLE.filter(q=>(!k||q.kategorie===k)
    && (!d || (d==='ja'? q.vorhanden : !q.vorhanden))
    && (!s || (q.titel+' '+q.dateiname+' '+(q.herkunft||'')).toLowerCase().includes(s)));
  const da=QU_ALLE.filter(q=>q.vorhanden).length;
  const gb=QU_ALLE.reduce((a,q)=>a+(q.groesse||0),0);
  $('#qu-stat').innerHTML = `<b style="color:var(--ink)">${QU_ALLE.length} Quellen</b> in ${QU_KATS.length} Sachgebieten · ${da} Dateien im Cloudspeicher, ${QU_ALLE.length-da} noch nicht hochgeladen · zusammen ${mb(gb)}`;

  const gruppen = QU_KATS.map(k=>({k, items:r.filter(q=>q.kategorie===k.schluessel)})).filter(g=>g.items.length);
  $('#qu-liste').innerHTML = gruppen.length ? gruppen.map(g=>`
    <div class="sec" style="margin-top:0;margin-bottom:34px">
      <div class="sec-h"><h2>${esc(g.k.bezeichnung)}</h2>
        <span class="note">${g.items.length} ${g.items.length===1?'Quelle':'Quellen'} · ${g.items.filter(q=>q.vorhanden).length} hochgeladen</span></div>
      <div class="card">${g.items.map(q=>`
        <div class="quelle">
          <span class="punkt ${q.vorhanden?'ja':'nein'}" title="${q.vorhanden?'Datei im Cloudspeicher':'Datei fehlt'}"></span>
          <span class="t"><b>${esc(q.titel)}</b><span>${esc(q.dateiname)}${q.groesse?' · '+mb(q.groesse):''}${q.herkunft?' · '+esc(q.herkunft):''}</span></span>
          <span class="akt">
            ${q.vorhanden?`<button class="btn ghost sm" data-lade="${q.id}">Öffnen</button>`:''}
            <button class="btn ghost sm" data-hoch="${q.id}">${q.vorhanden?'Ersetzen':'Hochladen'}</button>
            <button class="btn ghost sm" data-bearb="${q.id}">Bearbeiten</button>
            <button class="btn ghost sm gefahr" data-weg="${q.id}">Löschen</button>
          </span>
        </div>`).join('')}</div>
    </div>`).join('') : '<div class="card"><div class="empty">Keine Quelle passt zu diesen Filtern.</div></div>';

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
    <h2 style="margin-bottom:20px">${neu?'Quelle hinzufügen':'Quelle bearbeiten'}</h2>
    <div style="display:flex;flex-direction:column;gap:16px">
      <label class="fld">Titel<input id="d-titel" value="${esc(q?q.titel:'')}"></label>
      <label class="fld">Sachgebiet<select id="d-kat">${QU_KATS.map(k=>`<option value="${esc(k.schluessel)}" ${q&&q.kategorie===k.schluessel?'selected':''}>${esc(k.bezeichnung)}</option>`).join('')}</select></label>
      <label class="fld">Dateiname<input id="d-datei" value="${esc(q?q.dateiname:'')}" spellcheck="false"></label>
      <label class="fld">Herkunft<input id="d-herkunft" value="${esc(q&&q.herkunft?q.herkunft:'')}" placeholder="z. B. bpb, IzpB 345"></label>
      <label class="fld">Bemerkung<textarea id="d-bem" rows="2">${esc(q&&q.bemerkung?q.bemerkung:'')}</textarea></label>
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
                herkunft:$('#d-herkunft').value.trim()||null, bemerkung:$('#d-bem').value.trim()||null};
    const {error} = neu ? await sb.from('quelle').insert(satz)
                        : await sb.from('quelle').update(satz).eq('id', q.id);
    if(error){ $('#d-fehler').innerHTML=`<div class="hinweis fehler">${esc(fehlertext(error))}</div>`; return; }
    d.remove(); toast(neu?'Quelle angelegt.':'Quelle gespeichert.'); renderQuellen();
  };
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
    $('#nu-liste').innerHTML = nu.length ? `<table><thead><tr>
        <th>Konto</th><th style="width:130px">Rolle</th><th style="width:120px">Status</th>
        <th style="width:110px">Aktivität</th><th style="width:190px"></th></tr></thead><tbody>${
      nu.map(u=>`<tr>
        <td><b>${esc(u.name||'ohne Namen')}</b><br><span class="xs mute">${esc(u.email)}</span></td>
        <td><select data-rolle="${u.id}" style="padding:7px 9px;font-size:14px">
              <option value="nutzer" ${u.rolle==='nutzer'?'selected':''}>Nutzer</option>
              <option value="admin" ${u.rolle==='admin'?'selected':''}>Administrator</option></select></td>
        <td><select data-status="${u.id}" style="padding:7px 9px;font-size:14px">
              <option value="aktiv" ${u.status==='aktiv'?'selected':''}>aktiv</option>
              <option value="wartend" ${u.status==='wartend'?'selected':''}>wartend</option>
              <option value="gesperrt" ${u.status==='gesperrt'?'selected':''}>gesperrt</option></select></td>
        <td class="xs mute tnum">${u.durchgaenge} Durchg.<br>${u.antworten} Antw.${u.quote!=null?' · '+u.quote+' %':''}</td>
        <td style="text-align:right"><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button class="btn ghost sm" data-pw="${u.id}" data-mail="${esc(u.email)}">Passwort</button>
          ${u.id===PROFIL.id?'':`<button class="btn ghost sm gefahr" data-del="${u.id}" data-mail="${esc(u.email)}">Löschen</button>`}
        </div></td></tr>`).join('')}</tbody></table>`
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
  $('#ei-liste').innerHTML = (ei&&ei.length) ? `<table><thead><tr>
      <th>Code</th><th style="width:150px">Gebunden an</th><th style="width:110px">Rolle</th>
      <th style="width:110px">Gültig bis</th><th style="width:170px"></th></tr></thead><tbody>${
    ei.map(e=>{
      const abgelaufen = new Date(e.gueltig_bis) < new Date();
      return `<tr${abgelaufen?' style="opacity:.5"':''}>
        <td class="xs" style="font-family:var(--mono);word-break:break-all">${esc(e.token)}</td>
        <td class="xs">${esc(e.email||'—')}</td>
        <td class="xs">${e.rolle==='admin'?'Administrator':'Nutzer'}</td>
        <td class="xs tnum">${datumLang(e.gueltig_bis)}${abgelaufen?' <span style="color:var(--bad)">abgelaufen</span>':''}</td>
        <td style="text-align:right"><div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn ghost sm" data-kop="${esc(e.token)}">Link</button>
          <button class="btn ghost sm gefahr" data-eiweg="${esc(e.token)}">Zurückziehen</button>
        </div></td></tr>`;
    }).join('')}</tbody></table>`
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
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  $('#konto-inhalt').innerHTML = `
    <div class="sec" style="margin-top:0">
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
      <div class="sec-h"><h2>Auf dem Telefon installieren</h2></div>
      ${standalone
        ? '<div class="hinweis gut">Der Testtrainer läuft bereits als installierte App.</div>'
        : `<div class="card pad small">
            ${iOS
              ? '<b>iPhone:</b> unten in Safari auf <b>Teilen</b> tippen, dann <b>Zum Home-Bildschirm</b>. Danach startet der Testtrainer wie eine App – ohne Adressleiste, mit eigenem Symbol.'
              : '<b>Android:</b> im Browsermenü <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b> wählen.'}
            <div class="mute" style="margin-top:12px">Die Anmeldung bleibt erhalten; Fragen werden zwischengespeichert und stehen auch ohne Netz zur Verfügung.</div>
          </div>`}
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
  go('dash');
  renderMenu(); renderFrMenu();
  setInterval(countdown, 60000);
}

$('#marke-heim').onclick = (e)=>{ e.preventDefault(); if(PROFIL) go('dash'); };
window.addEventListener('online', ()=>{ if(PROFIL) warteschlangeAbarbeiten(); });

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

starten();
