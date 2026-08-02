import { chromium } from 'playwright';
const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
const p = await (await b.newContext()).newPage();
p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/build/Testtrainer_standalone.html'); await p.waitForTimeout(400);

// Szenario: künftiger Pool, in dem jeder Artikel genau 3 Fragen hat (so erzeugt es die Tagesaufgabe)
const r = await p.evaluate(()=>{
  const orig = FR.slice();
  // FR neu aufbauen: 8 Artikel à 3 Fragen + unveränderte Wortschatz-/Grammatikfragen
  const tv=[];
  for(let a=1;a<=8;a++) for(let i=1;i<=3;i++)
    tv.push({id:'FV-X'+a+'-'+i, kategorie:'franzoesisch', teil:'textverstaendnis', punkte:2,
             block:'Tag '+a, thema:'Textverständnis', textId:'FT-X'+a, titel:'Artikel '+a,
             text:'Lorem ipsum '.repeat(20), frage:'Frage '+a+'.'+i, optionen:['a','b','c','d'],
             loesung:0, erlaeuterung:'x'.repeat(80)});
  const rest = orig.filter(q=>q.teil!=='textverstaendnis');
  FR.length=0; FR.push(...tv, ...rest);
  const res={anzahlen:{}, artikel:{}, punkte:{}};
  for(let i=0;i<60;i++){
    const t=baueTeile({view:'fr',typ:'frSim',zeit:1800,gesamt:true,titel:'x'}).filter(x=>x.fragen.length);
    const tvT=t.find(x=>x.fragen[0].teil==='textverstaendnis');
    const n=tvT?tvT.fragen.length:0;
    const arts=tvT? new Set(tvT.fragen.map(q=>q.textId)).size : 0;
    const ges=t.reduce((a,x)=>a+x.fragen.length,0);
    const pkt=t.reduce((a,x)=>a+x.fragen.reduce((s,q)=>s+(q.punkte||1),0),0);
    res.anzahlen[n]=(res.anzahlen[n]||0)+1;
    res.artikel[arts]=(res.artikel[arts]||0)+1;
    res.punkte[pkt]=(res.punkte[pkt]||0)+1;
    res.gesamt=(res.gesamt||{}); res.gesamt[ges]=(res.gesamt[ges]||0)+1;
  }
  FR.length=0; FR.push(...orig);
  return res;
});
console.log('Textverständnis-Fragen je Lauf:', JSON.stringify(r.anzahlen));
console.log('Artikel je Lauf:              ', JSON.stringify(r.artikel));
console.log('Gesamtfragen je Lauf:         ', JSON.stringify(r.gesamt));
console.log('Punkte je Lauf:               ', JSON.stringify(r.punkte));
await b.close();
