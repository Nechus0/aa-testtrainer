import { chromium } from 'playwright';
const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const ctx = await b.newContext({viewport:{width:1440,height:1000}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
p.on('dialog',d=>d.accept());
const URL='file:///home/claude/build/Testtrainer_standalone.html';
await p.goto(URL); await p.waitForTimeout(400);
let pass=0,fail=0;
const T=(n,c,i='')=>{ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(i?'  → '+i:''));} };
const H=t=>console.log('\n== '+t);
const start = cfg => p.evaluate(c=>start(c), cfg);
const timer = ()=>p.textContent('#timer').catch(()=>null);

/* ---------- Zeitlogik ---------- */
H('Zeitlogik');
await start({typ:'block', block:'Original 2023', kat:'recht', zeit:600, titel:'Zeitprobe'});
await p.waitForTimeout(1400);
const t1 = await timer();
T('Fachtest startet bei 10:00 und läuft', /^09:5[5-9]$/.test(t1), t1);

// Fachtest-Vollsimulation: Timer muss je Teil neu starten
await start({typ:'sim', zeit:600, titel:'Simprobe'});
await p.waitForTimeout(2200);
const vorTeil2 = await timer();
await p.evaluate(async()=>{ const T=LAUF.teile[LAUF.ti]; T.fragen.forEach(q=>LAUF.antw[q.id]=0); teilFertig(); });
await p.waitForTimeout(600);
const nachTeil2 = await timer();
T('Fachtest: Timer startet je Teil neu', /^09:5[89]$|^10:00$/.test(nachTeil2) && vorTeil2 < nachTeil2, vorTeil2+' → '+nachTeil2);

// Französische Vollsimulation: ein gemeinsames Budget über alle Teile
await start({view:'fr', typ:'frSim', zeit:1800, gesamt:true, titel:'FR-Zeitprobe'});
await p.waitForTimeout(2200);
const frVor = await timer();
await p.evaluate(async()=>{ const T=LAUF.teile[LAUF.ti]; T.fragen.forEach(q=>LAUF.antw[q.id]=0); teilFertig(); });
await p.waitForTimeout(700);
const frNach = await timer();
T('Französisch: Timer läuft über Teilgrenze weiter', frNach < frVor, frVor+' → '+frNach);
T('Französisch: Beschriftung „Restzeit gesamt"', (await p.textContent('.timerlab')).includes('gesamt'));

// Ablauf der Zeit wertet automatisch
await start({typ:'zufall', kat:'wirtschaft', n:25, zeit:2, titel:'Ablaufprobe'});
await p.waitForTimeout(400);
const o=await p.$$('.opts .opt'); await o[0].click();
await p.waitForTimeout(3000);
T('Zeitablauf wertet automatisch aus', (await p.$('.score'))!==null);
const sess1 = await p.evaluate(()=>S.sessions.at(-1));
T('Zeitablauf: Ergebnis gespeichert (1 von 25 beantwortet)', sess1.n===25 && sess1.titel==='Ablaufprobe', JSON.stringify(sess1).slice(0,90));

// Ablauf, während die Ansicht gewechselt wurde
await p.evaluate(()=>{ S.sessions=[]; S.antworten=[]; save(); });
await start({typ:'zufall', kat:'recht', n:25, zeit:3, titel:'Wegklickprobe'});
await p.waitForTimeout(300);
await p.click('nav button[data-v="dash"]');
await p.waitForTimeout(4000);
const sess2 = await p.evaluate(()=>S.sessions.at(-1));
T('Zeitablauf wertet auch bei gewechselter Ansicht', !!sess2 && sess2.titel==='Wegklickprobe', JSON.stringify(sess2||null).slice(0,80));

/* ---------- Vollständige Probedurchläufe ---------- */
H('Probedurchläufe mit Rechenkontrolle');
await p.evaluate(()=>{ S=leer(); save(); });
async function durchlauf(cfg, quote){
  await start(cfg);
  let erwartetRichtig=0, erwartetPunkte=0, erwartetMax=0, n=0;
  for(let teil=0; teil<20; teil++){
    const info = await p.evaluate(q=>{
      const T=LAUF.teile[LAUF.ti];
      let r=0,pk=0,mx=0;
      T.fragen.forEach((f,i)=>{
        const treffer = (i % 10) < q*10;
        LAUF.antw[f.id] = treffer ? f.loesung : (f.loesung+1)%4;
        mx += f.punkte||1;
        if(treffer){ r++; pk += f.punkte||1; }
      });
      return {n:T.fragen.length, r, pk, mx, letzter: LAUF.ti===LAUF.teile.length-1};
    }, quote);
    erwartetRichtig+=info.r; erwartetPunkte+=info.pk; erwartetMax+=info.mx; n+=info.n;
    await p.evaluate(()=>teilFertig()); await p.waitForTimeout(250);
    if(info.letzter) break;
  }
  await p.waitForTimeout(300);
  const s = await p.evaluate(()=>S.sessions.at(-1));
  return {s, erwartetRichtig, erwartetPunkte, erwartetMax, n};
}
for(const [name,cfg] of [
  ['Fachtest-Vollsimulation', {typ:'sim', zeit:600, titel:'Vollsimulation Fachtests'}],
  ['Originalprüfung 2023',    {typ:'orig', block:'Original 2023', zeit:600, titel:'Originalprüfung 2023'}],
  ['Originalprüfung 2019',    {typ:'orig', block:'Original 2019', zeit:600, titel:'Originalprüfung 2019'}]]){
  const r = await durchlauf(cfg, 0.7);
  T(name+': 75 Fragen gewertet', r.s.n===75, String(r.s.n));
  T(name+': Trefferzahl stimmt', r.s.richtig===r.erwartetRichtig, r.s.richtig+' statt '+r.erwartetRichtig);
  T(name+': Quote stimmt', r.s.quote===Math.round(r.erwartetRichtig/75*100));
}
for(const q of [0.3,0.5,0.9]){
  const r = await durchlauf({view:'fr', typ:'frSim', zeit:1800, gesamt:true, titel:'Vollständiger Sprachtest'}, q);
  T('FR-Sprachtest ('+Math.round(q*100)+'%): 52 Fragen, 60 Punkte möglich', r.s.n===52 && r.s.maxPunkte===60, r.s.n+'/'+r.s.maxPunkte);
  T('FR-Sprachtest ('+Math.round(q*100)+'%): Punktzahl stimmt', r.s.punkte===r.erwartetPunkte, r.s.punkte+' statt '+r.erwartetPunkte);
  const urteil = await p.$('.verdict');
  const txt = urteil? (await p.textContent('.verdict')) : '';
  const soll = r.s.punkte>=30 ? 'Bestanden' : 'Nicht bestanden';
  T('FR-Sprachtest ('+Math.round(q*100)+'%): Urteil „'+soll+'"', txt.trim().startsWith(soll), txt.replace(/\s+/g,' '));
}

/* ---------- Speicherung und Wiederherstellung ---------- */
H('Speicherung');
const vorher = await p.evaluate(()=>({a:S.antworten.length, s:S.sessions.length}));
await p.reload(); await p.waitForTimeout(600);
const nachher = await p.evaluate(()=>({a:S.antworten.length, s:S.sessions.length}));
T('Fortschritt übersteht Neuladen', vorher.a===nachher.a && vorher.s===nachher.s, JSON.stringify(vorher)+' vs '+JSON.stringify(nachher));
const dash = await p.evaluate(()=>{ go('dash'); return {kpi:document.querySelector('#kpis').textContent.replace(/\s+/g,' '), fr:document.querySelector('#frcard').textContent.replace(/\s+/g,' ').slice(0,120)}; });
console.log('   KPI:', dash.kpi.slice(0,120));
console.log('   FR :', dash.fr);
T('Dashboard zeigt Französisch-Punkte', /\d+ von 60 Punkten/.test(dash.fr), dash.fr);

/* ---------- Bedienung im Test ---------- */
H('Bedienung');
await start({typ:'block', block:'Tag 1', kat:'geschichte', zeit:600, titel:'Bedienprobe'});
await p.waitForTimeout(300);
await p.click('#mark'); await p.waitForTimeout(150);
T('Markierung sichtbar am Kartenrand', (await p.$('.qcard.marked'))!==null);
T('Markierung sichtbar in der Übersicht', (await p.$('.pg.mark'))!==null);
T('Legende zur Übersicht vorhanden', (await p.$$('.pglegend span')).length===3);
await p.click('.opts .opt:nth-child(2)'); await p.waitForTimeout(200);
T('Antwort springt zur nächsten Frage', (await p.textContent('.qnum')).includes('Frage 2'));
await p.click('.pg:nth-child(1)'); await p.waitForTimeout(200);
T('Rücksprung über die Übersicht', (await p.textContent('.qnum')).includes('Frage 1'));
T('gewählte Antwort bleibt markiert', (await p.$$('.opt.sel')).length===1);
await p.click('nav button[data-v="dash"]'); await p.waitForTimeout(300);
await p.click('nav button[data-v="train"]'); await p.waitForTimeout(300);
T('Laufender Test bleibt beim Ansichtswechsel erhalten', (await p.$('.exambar'))!==null && (await p.$('#train-menu')) && await p.isHidden('#train-menu'));
await p.click('#abbruch'); await p.waitForTimeout(300);
T('Abbrechen führt zurück ins Menü', await p.isVisible('#train-menu'));
const nachAbbruch = await p.evaluate(()=>S.antworten.length);
T('Abbruch speichert nichts', nachAbbruch===nachher.a, nachAbbruch+' vs '+nachher.a);

console.log('\n---- '+pass+' ok, '+fail+' Fehler');
console.log(errs.length? 'JS-Fehler:\n'+errs.join('\n') : 'Keine JS-Fehler.');
await b.close(); process.exit(fail?1:0);
