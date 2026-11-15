process.env.NOTIMER='1';
const fs=require('fs');const P=require('./partition.js');const {units,iifeInfo}=P;
const LY=P.layer(P.OVR.order);
const NAME={'styles.1':'v71_styles.js','settings.1':'v71_settings.js','gestures.1':'v71_gestures.js','playlist.1':'v71_playlist.js','transport.1':'v71_transport.js','reverse.1':'v71_reverse.js','sources.1':'v71_sources.js','torrent.1':'v71_torrent.js','video.1':'v71_video.js','video_reverse.1':'v71_video_reverse.js','framegen.1':'v71_framegen.js','export.1':'v71_export.js','shade.1':'v71_shade.js','net.1':'v71_net.js','video.2':'v71_video_decks.js','settings.2':'v71_layout.js','transport.2':'v71_deck_a_guard.js'};
LY.files.forEach((f,i)=>{f.name=NAME[f.theme+'.'+f.layer]||('??'+f.theme+'.'+f.layer);f.pos=i;f.units.forEach(U=>U.fname=f.name)});
// components in one file?
let bad=0;for(const bi in iifeInfo){iifeInfo[bi].comps.forEach(c=>{const s=new Set(c.map(U=>U.fname));if(s.size>1){bad++;console.log('SPLIT COMPONENT b'+bi,[...s].join(','),c.map(U=>U.id).join(' ').slice(0,200));}});}
console.log('components straddling files:',bad);
// pieces per IIFE
let pieces=0;const perI=[];for(const bi in iifeInfo){const I=iifeInfo[bi];const m={};I.units.forEach(U=>{if(U.theme==='HEADER')return;(m[U.fname]=m[U.fname]||{n:0,l:0});m[U.fname].n++;m[U.fname].l+=U.e-U.s+1;});pieces+=Object.keys(m).length;
 // helpers needing duplication: locals (pure/const) used by units in >1 files
 const dup=[];for(const n in I.use){const fs2=new Set([...I.use[n]].filter(U=>U.theme!=='HEADER').map(U=>U.fname));if(fs2.size>1)dup.push(n+(I.pure.has(n)?'()':'')+(!I.pure.has(n)&&!I.consts.has(n)?'!!STATE':''));}
 perI.push({b:+bi,s:I.b.s,e:I.b.e,guard:I.b.guard||'',lead:I.b.lead,parts:m,dup});}
console.log('IIFE pieces total:',pieces,'from',perI.length,'IIFEs');
perI.forEach(p=>{if(p.dup.length)console.log('b'+p.b,'dup:',p.dup.join(', '))});
// timers reversed
const tm={};units.forEach(U=>U.side.forEach(x=>{if(x.l&&(x.k==='setTimeout'||x.k==='setInterval'))(tm[x.k+x.d]=tm[x.k+x.d]||[]).push(U)}));
let rev=0,tot=0;for(const k in tm){const a=tm[k];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){tot++;const fi=LY.files.find(f=>f.name===a[i].fname).pos,fj=LY.files.find(f=>f.name===a[j].fname).pos;if(fi>fj)rev++;}}
console.log('same-delay load-time timer pairs:',tot,'reversed:',rev);
LY.files.forEach((f,i)=>console.log((i+1)+'. '+f.name+' units='+f.units.length+' lines='+f.units.reduce((a,U)=>a+U.e-U.s+1,0)));
fs.writeFileSync('final.json',JSON.stringify({files:LY.files.map(f=>({name:f.name,theme:f.theme,layer:f.layer,units:f.units.map(U=>({id:U.id,s:U.s,e:U.e,b:U.b,u:U.u,par:!!U.parent,W:[...U.W].filter(n=>n[0]!=='@'),side:U.side.filter(x=>x.l).map(x=>x.k),desc:U.desc||'',lead:U.lead||''}))})),perI,headers:units.filter(U=>U.theme==='HEADER').map(U=>({id:U.id,s:U.s,e:U.e,b:U.b}))}));
