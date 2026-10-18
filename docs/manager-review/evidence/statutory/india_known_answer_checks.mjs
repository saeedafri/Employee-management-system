import { computeIncomeTaxFromRegime as tax, computeStatutoryContributions as stat } from '/Users/mohdsaeedafri/All-Code-Base/EMS/src/utils/statutoryCalculation.js';
const P=100;
const seed={code:'IN_NEW_REGIME',standardDeduction:7500000,slabs:[{from:0,to:40000000,rate:0},{from:40000000,to:80000000,rate:5},{from:80000000,to:null,rate:30}],cess:{rate:4}};
const sur=[{thresholdAnnual:5000000*P,rate:10},{thresholdAnnual:10000000*P,rate:15},{thresholdAnnual:20000000*P,rate:25}];
const law={code:'N',standardDeduction:7500000,cess:4,surcharge:sur,slabs:[[0,4],[4,8],[8,12],[12,16],[16,20],[20,24],[24,null]].map(([a,b],i)=>({from:a*1e5*P,to:b==null?null:b*1e5*P,rate:i*5}))};
const old={code:'O',standardDeduction:5000000,cess:4,slabs:[{from:0,to:250000*P,rate:0},{from:250000*P,to:500000*P,rate:5},{from:500000*P,to:1000000*P,rate:20},{from:1000000*P,to:null,rate:30}]};
const o=(n,e,a)=>console.log(n.padEnd(52),'law',String(e).padStart(9),'EMS',String(a).padStart(9),e==a?'OK':'**DIFF**');
o('1.2M new, SEED pack',0,tax(1200000,seed));
o('1.2M new, correct slabs (no 87A in engine)',0,tax(1200000,law));
o('gross 1,275,001 (T=1,200,001) 87A marginal relief',1,tax(1275001,law));
o('old regime 1.2M (SD50k)',163800,tax(1200000,old));
o('old regime gross 550k (T=500k) 87A 12,500',0,tax(550000,old));
o('surcharge gross 5,000,000 (T=4.925M)',1099800,tax(5000000,law));
o('surcharge gross 5,000,001 (T=4.925M+1)',1099800,tax(5000001,law));
o('surcharge gross 5,075,001 (T=5,000,001) w/ relief',1123201,tax(5075001,law));
o('surcharge gross 5,200,000 (T=5.125M) relief',(()=>{const t=300000+0.3*(5125000-2400000);const raw=t*1.1,cap=1080000+125000;return Math.round(Math.min(raw,cap)*1.04)})(),tax(5200000,law));
const comps=new Map([['BASIC',{statutoryTag:'PF_WAGE'}]]);
const sch=[{code:'IN_EPF',wageBaseTag:'PF_WAGE',wageCeiling:1500000,employee:{rate:12,component:'PF'},employer:{rate:12,component:'PF_ER'}}];
for (const w of [14000,20000,30000]) { const r=stat([{code:'BASIC',amount:w}],comps,sch,{rounding:{mode:'NEAREST',precision:0}});
 const base=Math.min(w,25000); console.log('EPF wage',w,'law EE',Math.round(base*.12),'ER EPF',Math.round(base*.12)-Math.round(base*.0833),'ER EPS',Math.round(base*.0833),'| EMS EE',r.statutoryDeductions[0]?.amount,'ER lines',JSON.stringify(r.employerContributions.map(c=>[c.code,c.amount]))); }
// PT: replicate repository.js:1197-1201 matching on seed Maharashtra slabs
const bands=[{from:0,to:750000,amount:0},{from:750000,to:null,amount:20000}];
for (const g of [8000,30000,750000]) { let a=0; for(const b of bands){const up=b.to==null?Infinity:+b.to; if(g>=b.from&&g<up){a=b.amount;break;}} console.log('PT MH gross',g,'law',g>10000?200:g>7500?175:0,'EMS',a); }
