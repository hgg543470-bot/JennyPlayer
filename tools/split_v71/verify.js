const fs=require('fs'),crypto=require('crypto');
const h=s=>crypto.createHash('md5').update(s.replace(/\s+/g,' ').trim()).digest('hex').slice(0,10);
function load(json,dir){const o=require(json);const ev=[];let seq=0;
  for(const f of Object.keys(o.files)){const L=fs.readFileSync(dir+'/'+f,'utf8').split('\n');
    for(const B of o.files[f].blocks){const rs=B.refs.filter(r=>!r.loc&&r.l).sort((a,b)=>a.ln-b.ln);
      for(const r of rs){ev.push({n:r.n,w:r.w,sig:h(L.slice(r.ln-1,(r.vl||r.ln)).join('\n')),line:h(L[r.ln-1]),f,ln:r.ln,seq:seq++});}
      for(const s of B.side){if(!s.l)continue;if(s.k==='listen'&&/^(document|window|player)/.test(s.t))ev.push({n:'@listen:'+s.t+'/'+s.ev+'/'+(/true/.test(s.cap)?'c':'b'),w:1,sig:h(L[s.ln-1]),line:h(L[s.ln-1]),f,ln:s.ln,seq:seq++});
        if(s.k==='style')ev.push({n:'@style',w:1,sig:h(L[s.ln-1]+L[s.ln]+(L[s.ln+1]||'')),line:'',f,ln:s.ln,seq:seq++});
        if(s.k==='proto'||s.k==='defprop')ev.push({n:'@proto:'+s.t.replace(/\s+/g,''),w:1,sig:h(L[s.ln-1]),line:'',f,ln:s.ln,seq:seq++});}
    }}
  // sort events by file order then line (source order)
  const fo=Object.keys(o.files);ev.sort((a,b)=>fo.indexOf(a.f)-fo.indexOf(b.f)||a.ln-b.ln||a.seq-b.seq);return ev;}
const A=load('./out2.json','orig'),B=load('./out2_new.json','newtree');
const isFlag=n=>/__[a-z_]+$/.test(n)||/^_jenny\w*(Installed|Fixed)\w*$/.test(n)||/Installed/.test(n);
function wseq(ev){const m={};ev.forEach(e=>{if(e.w&&!isFlag(e.n))(m[e.n]=m[e.n]||[]).push(e)});return m;}
const WA=wseq(A),WB=wseq(B);let bad=0;const names=new Set([...Object.keys(WA),...Object.keys(WB)]);
for(const n of names){const a=(WA[n]||[]).map(e=>e.sig).join(','),b=(WB[n]||[]).map(e=>e.sig).join(',');if(a!==b){bad++;if(bad<=25)console.log('WRITE-ORDER DIFF',n,'\n  old:',(WA[n]||[]).map(e=>e.f.replace('.js','')+':'+e.ln).join(' '),'\n  new:',(WB[n]||[]).map(e=>e.ln).join(' '));}}
console.log('names compared:',names.size,'write-sequence diffs:',bad);
// read -> preceding write
function rmap(ev){const last={},cnt={},m={};ev.forEach(e=>{if(isFlag(e.n))return;if(e.w){last[e.n]=e.sig;}else{const k=e.n+'|'+e.line;cnt[k]=(cnt[k]||0)+1;m[k+'|'+cnt[k]]={v:last[e.n]||'-',e};}});return m;}
const RA=rmap(A),RB=rmap(B);let rbad=0,miss=0;
for(const k in RA){if(!RB[k]){miss++;if(miss<=5)console.log('READ missing in new',k,RA[k].e.ln);continue;}if(RA[k].v!==RB[k].v){rbad++;if(rbad<=25)console.log('READ sees other version:',k.split('|')[0],'old L'+RA[k].e.ln,'new L'+RB[k].e.ln);}}
let extra=0;for(const k in RB)if(!RA[k])extra++;
console.log('load-time reads compared:',Object.keys(RA).length,'diffs:',rbad,'missing:',miss,'extra in new:',extra);
