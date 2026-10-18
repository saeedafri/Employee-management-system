const E='/Users/mohdsaeedafri/All-Code-Base/EMS';
const Fastify=(await import(`${E}/node_modules/fastify/fastify.js`)).default;
const fp=(await import(`${E}/node_modules/fastify-plugin/plugin.js`)).default;
const rl=(await import(`${E}/node_modules/@fastify/rate-limit/index.js`)).default;
const f=Fastify();
await f.register(fp(async (i)=>{await i.register(rl,{max:100,timeWindow:'15 minutes'});}));
f.post('/login',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async()=>({ok:1}));
await f.ready(); let c={};
for(let i=0;i<20;i++){const r=await f.inject({method:'POST',url:'/login'});c[r.statusCode]=(c[r.statusCode]||0)+1;}
console.log('fp-wrapped + config.rateLimit:',JSON.stringify(c));
