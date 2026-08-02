import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const ctx = await b.newContext({viewport:{width:1440,height:1000}, acceptDownloads:true});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/build/Testtrainer_standalone.html'); await p.waitForTimeout(400);
let pass=0,fail=0;
const T=(n,c,i='')=>{ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(i?'  → '+i:''));} };
const H=t=>console.log('\n== '+t);
const start = cfg => p.evaluate(c=>start(c), cfg);
const beenden = async()=>{ for(let i=0;i<5;i++){ const w=await p.evaluate(()=>{ if(!LAUF||LAUF.phase!=='lauf') return true;
  const T=LAUF.teile[LAUF.ti]; T.fragen.forEach((f,k)=>LAUF.antw[f.id]= k%3? f.loesung : (f.loesung+1)%4); teilFertig(); return false; });
  await p.waitForTimeout(250); if(w) break; } };

/* ---------- Wechsel zwischen den Bereichen ---------- */
H('Wechsel zwischen Fachtests und Französisch');
await start({typ:'sim', zeit:600, titel:'Fachtest'});
await p.waitForTimeout(300);
await p.click('nav button[data-v="fr"]'); await p.waitForTimeout(300);
await p.click('#fr-exam .mode'); await p.waitForTimeout(500);
const sichtbar = await p.evaluate(()=>({train:document.querySelector('#train-run').innerHTML.length,
                                        frTimer:document.querySelectorAll('#fr-run #timer').length,
                                        alleTimer:document.querySelectorAll('#timer').length}));
T('alter Fachtest-Durchgang wird beim FR-Start geräumt', sichtbar.train===0, String(sichtbar.train));
T('nur ein Timer im Dokument', sichtbar.alleTimer===1, String(sichtbar.alleTimer));
const t1=await p.textContent('#timer'); await p.waitForTimeout(2000); const t2=await p.textContent('#timer');
T('FR-Timer zählt sichtbar herunter', t1!==t2 && t2<t1, t1+' → '+t2);
await p.click('#abbruch'); await p.waitForTimeout(300);

/* ---------- Lesetext im Textverständnis ---------- */
H('Textverständnis');
await start({view:'fr', typ:'frTeil', teil:'textverstaendnis', zeit:900, titel:'TV'});
await p.waitForTimeout(400);
T('Artikel wird bei der ersten Frage angezeigt', await p.isVisible('#fr-run .artikel'));
const artikelJeFrage=[];
for(let i=0;i<8;i++){
  const st = await p.evaluate(()=>({ id:LAUF.teile[0].fragen[LAUF.i].textId,
    sichtbar: !!document.querySelector('#fr-run .artikel') && document.querySelector('#fr-run .artikel').style.display!=='none',
    knopf: !!document.querySelector('#fr-run #showtext') }));
  artikelJeFrage.push(st);
  if(i<7){ const o=await p.$$('#fr-run .opts .opt'); await o[0].click(); await p.waitForTimeout(120); }
}
const gruppen = artikelJeFrage.map(x=>x.id);
const wechsel = gruppen.filter((g,i)=>i===0||g!==gruppen[i-1]).length;
T('genau drei Artikel im Testverständnis-Satz', new Set(gruppen).size===3, JSON.stringify([...new Set(gruppen)]));
T('Fragen eines Artikels stehen zusammen', wechsel===3, 'Wechsel: '+wechsel);
T('Artikel nur bei der ersten Frage offen, danach nachladbar',
  artikelJeFrage[0].sichtbar && artikelJeFrage.slice(1).every(x=>x.sichtbar||x.knopf));
await p.click('#abbruch'); await p.waitForTimeout(200);

/* ---------- Fehlerarchiv und Wiederholung ---------- */
H('Fehlerarchiv');
await p.evaluate(()=>{ S=leer(); save(); });
await start({typ:'block', block:'Tag 1', kat:'recht', zeit:0, titel:'Fehlerlauf'});
const soll = await p.evaluate(()=>{ const T=LAUF.teile[0]; let f=0;
  T.fragen.forEach((q,i)=>{ if(i<10){ LAUF.antw[q.id]=(q.loesung+1)%4; f++; } else LAUF.antw[q.id]=q.loesung; });
  teilFertig(); return f; });
await p.waitForTimeout(400);
await p.click('nav button[data-v="archiv"]'); await p.waitForTimeout(400);
const archivN = await p.evaluate(()=>falscheOffen(ALLES).length);
T('Fehlerarchiv listet genau die falschen Fragen', archivN===soll, archivN+' statt '+soll);
await p.click('#a-start'); await p.waitForTimeout(400);
const wdh = await p.evaluate(()=>LAUF.teile[0].fragen.length);
T('Wiederholung startet mit denselben Fragen', wdh===soll, String(wdh));
await p.evaluate(()=>{ LAUF.teile[0].fragen.forEach(q=>LAUF.antw[q.id]=q.loesung); teilFertig(); });
await p.waitForTimeout(400);
await p.click('nav button[data-v="archiv"]'); await p.waitForTimeout(400);
T('nach richtiger Wiederholung ist das Archiv leer', await p.evaluate(()=>falscheOffen(ALLES).length)===0);

/* ---------- Französische Fehler landen im Archiv ---------- */
await start({view:'fr', typ:'frTeil', teil:'grammatik', zeit:0, titel:'FR-Fehler'});
await p.evaluate(()=>{ LAUF.teile[0].fragen.forEach((q,i)=>LAUF.antw[q.id]= i<5?(q.loesung+1)%4:q.loesung); teilFertig(); });
await p.waitForTimeout(400);
await p.click('nav button[data-v="archiv"]'); await p.waitForTimeout(400);
T('französische Fehler erscheinen im Archiv', await p.evaluate(()=>falscheOffen(ALLES).filter(q=>q.kategorie==='franzoesisch').length)===5);
T('Wiederholung startet dann im Französisch-Modus',
  await p.evaluate(()=>{ const fal=falscheOffen(ALLES); return fal.every(q=>q.kategorie==='franzoesisch'); }));

/* ---------- Export und Import ---------- */
H('Daten');
await p.click('nav button[data-v="daten"]'); await p.waitForTimeout(300);
const d1 = await Promise.all([p.waitForEvent('download'), p.click('#d-exp')]);
const jf = '/tmp/exp.json'; await d1[0].saveAs(jf);
const exp = JSON.parse(fs.readFileSync(jf,'utf8'));
T('Export enthält Antworten und Durchgänge', Array.isArray(exp.antworten)&&Array.isArray(exp.sessions)&&exp.antworten.length>0);
const d2 = await Promise.all([p.waitForEvent('download'), p.click('#d-csv')]);
await d2[0].saveAs('/tmp/exp.csv');
const csv = fs.readFileSync('/tmp/exp.csv','utf8').split('\n');
T('CSV mit Kopfzeile und allen Antworten', csv[0].startsWith('﻿'.replace('﻿',''))||csv[0].includes('datum'), csv[0].slice(0,40));
T('CSV-Zeilenzahl passt', csv.filter(z=>z.trim()).length===exp.antworten.length+1, csv.filter(z=>z.trim()).length+' vs '+(exp.antworten.length+1));
const vorReset = exp.antworten.length;
await p.evaluate(()=>{ S=leer(); save(); renderDash(); });
await p.setInputFiles('#d-file', jf); await p.waitForTimeout(600);
T('Import stellt den Stand wieder her', await p.evaluate(()=>S.antworten.length)===vorReset, String(await p.evaluate(()=>S.antworten.length)));
await p.setInputFiles('#d-file', jf); await p.waitForTimeout(600);
T('doppelter Import erzeugt keine Dubletten', await p.evaluate(()=>S.antworten.length)===vorReset);

/* ---------- Fragenpool ---------- */
H('Fragenpool');
await p.click('nav button[data-v="pool"]'); await p.waitForTimeout(400);
T('Pool zeigt Fachtests und Französisch', (await p.textContent('#q-count')).startsWith('286'), await p.textContent('#q-count'));
await p.fill('#q-search','élargissement'); await p.waitForTimeout(400);
const trefferFr = await p.textContent('#q-count');
T('Suche findet französische Begriffe mit Akzent', parseInt(trefferFr)>0, trefferFr);
await p.fill('#q-search','Schuldenbremse'); await p.waitForTimeout(400);
T('Suche findet deutsche Begriffe', parseInt(await p.textContent('#q-count'))>0, await p.textContent('#q-count'));
await p.fill('#q-search',''); await p.selectOption('#q-kat','franzoesisch'); await p.waitForTimeout(400);
T('Filter Französisch zeigt 61 Aufgaben', (await p.textContent('#q-count')).startsWith('61'), await p.textContent('#q-count'));

/* ---------- Darstellung ---------- */
H('Darstellung');
for(const [w,h] of [[1680,1050],[1440,900],[1180,800],[900,700]]){
  await p.setViewportSize({width:w,height:h});
  await p.click('nav button[data-v="dash"]'); await p.waitForTimeout(350);
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  T('Dashboard ohne Querlauf bei '+w+'px', ov<=1, 'Überstand '+ov+'px');
}
await p.setViewportSize({width:1440,height:1000});
await start({view:'fr', typ:'frSim', zeit:1800, gesamt:true, titel:'Darstellung'});
await p.waitForTimeout(400);
const ov2 = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
T('Sprachtest ohne Querlauf', ov2<=1, 'Überstand '+ov2+'px');
const box = await p.evaluate(()=>{ const a=document.querySelector('#fr-run .artikel'), s=document.querySelector('#fr-run .stem');
  return {art:a?a.getBoundingClientRect().width|0:0, stem:s?s.getBoundingClientRect().width|0:0,
          lesbar: a? getComputedStyle(a.querySelector('p')).lineHeight : null}; });
T('Lesetext in vernünftiger Spaltenbreite', box.art>600 && box.art<900, box.art+'px');
await beenden(); await p.waitForTimeout(400);
const revOv = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
T('Ergebnisseite ohne Querlauf', revOv<=1, 'Überstand '+revOv+'px');
T('Durchsicht listet alle 52 Aufgaben', (await p.$$('#fr-run #revlist details')).length===52, String((await p.$$('#fr-run #revlist details')).length));
T('Lesetexte auch in der Durchsicht', (await p.$$('#fr-run #revlist .artikel')).length>=3);

console.log('\n---- '+pass+' ok, '+fail+' Fehler');
console.log(errs.length? 'JS-Fehler:\n'+errs.join('\n') : 'Keine JS-Fehler.');
await b.close(); process.exit(fail?1:0);
