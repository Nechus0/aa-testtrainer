import { chromium } from 'playwright';
const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const p = await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/build/Testtrainer_standalone.html'); await p.waitForTimeout(400);
const MODI=[
  {typ:'sim', zeit:600, titel:'Vollsimulation Fachtests'},
  {typ:'orig', block:'Original 2019', zeit:600, titel:'Originalprüfung 2019'},
  {typ:'orig', block:'Original 2023', zeit:600, titel:'Originalprüfung 2023'},
  {typ:'block', block:'Tag 1', kat:'recht', zeit:600, titel:'Recht · Tag 1'},
  {typ:'block', block:'Tag 1', kat:'geschichte', zeit:600, titel:'Geschichte · Tag 1'},
  {typ:'block', block:'Tag 1', kat:'wirtschaft', zeit:600, titel:'Wirtschaft · Tag 1'},
  {typ:'zufall', kat:'recht', n:25, zeit:600, titel:'Recht · Zufallssatz'},
  {typ:'zufall', kat:'geschichte', n:25, zeit:600, titel:'Geschichte · Zufallssatz'},
  {typ:'zufall', kat:'wirtschaft', n:25, zeit:600, titel:'Wirtschaft · Zufallssatz'},
  {typ:'neu', n:25, zeit:0, titel:'Nur neue Fragen'},
  {typ:'fehler', zeit:0, titel:'Wiederholung'},
  {view:'fr', typ:'frSim', zeit:1800, gesamt:true, titel:'Vollständiger Sprachtest'},
  {view:'fr', typ:'frBlockAlle', block:'AA-Musteraufgaben', zeit:0, titel:'AA-Musteraufgaben'},
  {view:'fr', typ:'frTeil', teil:'textverstaendnis', zeit:900, titel:'Textverständnis'},
  {view:'fr', typ:'frTeil', teil:'wortschatz', zeit:450, titel:'Wortschatz'},
  {view:'fr', typ:'frTeil', teil:'grammatik', zeit:450, titel:'Grammatik'},
  {view:'fr', typ:'frBlock', block:'Tag 1', teil:'wortschatz', zeit:0, titel:'Wortschatz · Tag 1'},
  {view:'fr', typ:'frFehler', zeit:0, titel:'Wiederholung Französisch'}
];
let laeufe=0, abweichungen=[];
for(let runde=0; runde<3; runde++){
  for(const cfg of MODI){
    const gestartet = await p.evaluate(c=>{ const t=baueTeile(c).filter(x=>x.fragen.length); if(!t.length) return false; start(c); return true; }, cfg);
    if(!gestartet) continue;
    laeufe++;
    let erwR=0, erwP=0, erwN=0;
    for(let teil=0; teil<5; teil++){
      const info = await p.evaluate(()=>{
        const T=LAUF.teile[LAUF.ti]; let r=0,pk=0;
        T.fragen.forEach((f,i)=>{
          if(i%7===0) return;                                   // manche Fragen offen lassen
          const treffer = Math.random()<0.65;
          LAUF.antw[f.id]= treffer ? f.loesung : (f.loesung+1)%4;
          if(treffer){ r++; pk+=f.punkte||1; }
        });
        return {n:T.fragen.length, r, pk, letzter: LAUF.ti===LAUF.teile.length-1};
      });
      erwR+=info.r; erwP+=info.pk; erwN+=info.n;
      await p.evaluate(()=>teilFertig()); await p.waitForTimeout(120);
      if(info.letzter) break;
    }
    await p.waitForTimeout(200);
    const s = await p.evaluate(()=>S.sessions.at(-1));
    if(!s || s.n!==erwN || s.richtig!==erwR || (cfg.view==='fr' && s.punkte!==erwP))
      abweichungen.push(cfg.titel+': '+JSON.stringify({soll:{n:erwN,r:erwR,p:erwP}, ist:{n:s&&s.n,r:s&&s.richtig,p:s&&s.punkte}}));
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(ov>1) abweichungen.push(cfg.titel+': Querlauf '+ov+'px auf der Ergebnisseite');
    await p.evaluate(()=>{ const el=document.querySelector('#e-menu'); if(el) el.click(); });
    await p.waitForTimeout(100);
  }
}
const bilanz = await p.evaluate(()=>({antworten:S.antworten.length, sessions:S.sessions.length,
  kaputt:S.antworten.filter(a=>!BY_ID[a.id]).length,
  speicher:Math.round(JSON.stringify(S).length/1024)}));
console.log('Durchläufe:', laeufe, '| Antworten:', bilanz.antworten, '| Sessions:', bilanz.sessions,
            '| verwaiste Antworten:', bilanz.kaputt, '| Speicher:', bilanz.speicher+' kB');
console.log(abweichungen.length? 'ABWEICHUNGEN:\n  '+abweichungen.join('\n  ') : 'Alle Durchläufe rechnerisch korrekt.');
await p.click('nav button[data-v="dash"]'); await p.waitForTimeout(700);
console.log('Dashboard:', (await p.textContent('#kpis')).replace(/\s+/g,' ').slice(0,130));
console.log(errs.length? 'JS-Fehler:\n'+errs.join('\n') : 'Keine JS-Fehler über alle Durchläufe.');
await b.close(); process.exit(abweichungen.length||errs.length?1:0);
