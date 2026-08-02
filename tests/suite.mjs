import { chromium } from 'playwright';
const FILE = process.argv[2] || 'file:///home/claude/build/Testtrainer_standalone.html';
const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const ctx = await b.newContext({viewport:{width:1440,height:1000}});
const p = await ctx.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
p.on('dialog',d=>d.accept());
await p.goto(FILE); await p.waitForTimeout(500);

let pass=0, fail=0;
const T=(name,cond,info='')=>{ if(cond){pass++; console.log('  ok   '+name);} else {fail++; console.log('  FAIL '+name+(info?'  → '+info:''));} };
const H=t=>console.log('\n== '+t);

/* ---------- 1. Datenbestand und Spezifikation ---------- */
H('Bestand und AA-Vorgaben');
const meta = await p.evaluate(()=>({
  fach:F.length, fr:FR.length,
  kats:Object.keys(KAT),
  proKat:Object.fromEntries(ALLE.map(k=>[k,F.filter(q=>q.kategorie===k).length])),
  frMeta:window.AA_FR_META,
  frTeile:Object.fromEntries(Object.keys(FR_TEIL).map(t=>[t,FR.filter(q=>q.teil===t).length])),
  bloecke:[...new Set(F.map(q=>q.block))],
  frBloecke:[...new Set(FR.map(q=>q.block))],
  texte:(window.AA_FR_TEXTE||[]).map(t=>({id:t.id,n:t.fragen.length}))
}));
console.log('   ',JSON.stringify(meta.proKat), '| FR:', JSON.stringify(meta.frTeile), '| Texte:', JSON.stringify(meta.texte));
T('genau drei Fachtest-Kategorien', meta.kats.length===3 && meta.kats.join()==='recht,geschichte,wirtschaft', meta.kats.join());
T('Originalprüfungen 2019/2023 je 25 pro Kategorie', await p.evaluate(()=>
  ['Original 2019','Original 2023'].every(b=>ALLE.every(k=>F.filter(q=>q.block===b&&q.kategorie===k).length===25))));
T('Tagesblöcke je 25 pro Kategorie', await p.evaluate(()=>
  [...new Set(F.map(q=>q.block))].filter(b=>b.startsWith('Tag ')).every(b=>ALLE.every(k=>F.filter(q=>q.block===b&&q.kategorie===k).length===25))));
T('FR-Gesamtdauer 1800 s', meta.frMeta.dauer===1800, String(meta.frMeta.dauer));
T('FR 60 Punkte, bestanden ab 30', meta.frMeta.punkte===60 && meta.frMeta.bestanden===30);
T('FR Teilvorgaben 8/22/22', await p.evaluate(()=>FR_TEIL.textverstaendnis.fragen===8&&FR_TEIL.wortschatz.fragen===22&&FR_TEIL.grammatik.fragen===22));
T('FR Punktwerte 2/1/1', await p.evaluate(()=>FR_TEIL.textverstaendnis.punkte===2&&FR_TEIL.wortschatz.punkte===1&&FR_TEIL.grammatik.punkte===1));
T('FR Summe der Teilpunkte = 60', await p.evaluate(()=>Object.values(FR_TEIL).reduce((a,t)=>a+t.fragen*t.punkte,0)===60));
T('alle Fragen mit 4 Optionen und gültiger Lösung', await p.evaluate(()=>
  ALLES.every(q=>Array.isArray(q.optionen)&&q.optionen.length===4&&new Set(q.optionen).size===4&&Number.isInteger(q.loesung)&&q.loesung>=0&&q.loesung<=3)));
T('alle IDs eindeutig', await p.evaluate(()=>new Set(ALLES.map(q=>q.id)).size===ALLES.length));
T('alle Fragen mit Erläuterung', await p.evaluate(()=>ALLES.every(q=>typeof q.erlaeuterung==='string'&&q.erlaeuterung.length>40)));
T('Textverständnisfragen tragen 2 Punkte', await p.evaluate(()=>FR.filter(q=>q.teil==='textverstaendnis').every(q=>q.punkte===2)));

/* ---------- 2. Zusammenstellung der Durchgänge ---------- */
H('Zusammenstellung der Durchgänge');
const bau = async cfg => p.evaluate(c=>{
  const t=baueTeile(c).filter(x=>x.fragen.length);
  return {teile:t.length, pro:t.map(x=>x.fragen.length), gesamt:t.reduce((a,x)=>a+x.fragen.length,0),
          dubl: t.some(x=>new Set(x.fragen.map(q=>q.id)).size!==x.fragen.length),
          punkte:t.reduce((a,x)=>a+x.fragen.reduce((s,q)=>s+(q.punkte||1),0),0),
          teilnamen:t.map(x=>x.fragen[0].teil||x.fragen[0].kategorie)};
}, cfg);

const sim = await bau({typ:'sim', zeit:600, titel:'x'});
T('Fachtest-Vollsimulation: 3 Teile à 25', sim.teile===3 && sim.pro.every(n=>n===25), JSON.stringify(sim.pro));
T('Fachtest-Vollsimulation ohne Dubletten', !sim.dubl);
for(const blk of ['Original 2019','Original 2023']){
  const o = await bau({typ:'orig', block:blk, zeit:600, titel:'x'});
  T(blk+': 3 Teile à 25', o.teile===3 && o.pro.every(n=>n===25), JSON.stringify(o.pro));
}
// Französische Vollsimulation 20 × ziehen — muss IMMER 52 Fragen und 60 Punkte ergeben
let frBad=[];
for(let i=0;i<20;i++){
  const r = await bau({view:'fr', typ:'frSim', zeit:1800, gesamt:true, titel:'x'});
  if(r.gesamt!==52 || r.punkte!==60 || r.teile!==3 || r.dubl) frBad.push(JSON.stringify(r.pro)+'/'+r.punkte+'P');
}
T('FR-Vollsimulation 20× je 52 Fragen und 60 Punkte', frBad.length===0, frBad.slice(0,6).join(' · '));
const frTV = await bau({view:'fr', typ:'frTeil', teil:'textverstaendnis', zeit:900, titel:'x'});
T('FR Einzelteil Textverständnis = 8 Fragen', frTV.gesamt===8, String(frTV.gesamt));
const frW = await bau({view:'fr', typ:'frTeil', teil:'wortschatz', zeit:450, titel:'x'});
T('FR Einzelteil Wortschatz = 22 Fragen', frW.gesamt===22, String(frW.gesamt));

console.log('\n---- Zwischenstand: '+pass+' ok, '+fail+' Fehler');
console.log(errs.length? 'JS-Fehler:\n'+errs.join('\n') : 'Keine JS-Fehler.');
await b.close();
process.exit(fail?1:0);
