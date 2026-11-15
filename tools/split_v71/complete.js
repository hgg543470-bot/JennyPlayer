process.env.NOTIMER='1';
const fs=require('fs');const P=require('./partition.js');
const SRC=fs.readFileSync('orig/'+(process.env.TARGET||'ui_v71.js'),'utf8'),NEW=fs.readFileSync('bundle_new.js','utf8');
const cnt=(hay,n)=>{let c=0,i=0;while((i=hay.indexOf(n,i))!==-1){c++;i+=n.length}return c};
let lost=0,more=0,hdr=0,moreList=[];const seen=new Map();
P.units.forEach(U=>{const t=SRC.slice(U.so,U.eo);if(U.theme==='HEADER'){hdr++;return}
  if(t.length<25)return; // too short to count reliably
  const a=cnt(SRC,t),b=cnt(NEW,t);if(b<a){lost++;console.log('LOST',U.id,'L'+U.s,t.slice(0,80))}else if(b>a){more++;moreList.push(U.id+' L'+U.s+'-'+U.e+' x'+b)}});
console.log('units',P.units.length,'headers',hdr,'lost',lost,'duplicated',more);console.log(moreList.join(' | '));
// comments: every comment line of the original should still exist
const cl=SRC.split('\n').filter(l=>/^\s*(\/\/|\/\*|\*)/.test(l)&&l.trim().length>12);let cm=0;cl.forEach(l=>{if(NEW.indexOf(l.trim())===-1)cm++});console.log('comment lines',cl.length,'missing',cm);
