const E='/Users/mohdsaeedafri/All-Code-Base/EMS';
const Fastify=(await import(`${E}/node_modules/fastify/fastify.js`)).default;
const {rateLimitPlugin}=await import(`${E}/src/plugins/rateLimit.js`);
const {corsPlugin}=await import(`${E}/src/plugins/cors.js`);
async function run(label, withPlugins){
  const f=Fastify();
  await f.register(rateLimitPlugin); await f.register(corsPlugin);
  f.post('/login',{rateLimit:{max:5,timeWindow:'15 minutes'}},async()=>({ok:1}));
  f.get('/x',async()=>({ok:1}));
  await f.ready();
  let c={};
  for(let i=0;i<150;i++){const r=await f.inject({method:'POST',url:'/login',headers:{origin:'http://localhost:3000'}});c[r.statusCode]=(c[r.statusCode]||0)+1;}
  const g=await f.inject({method:'GET',url:'/x',headers:{origin:'http://localhost:3000'}});
  console.log(label,JSON.stringify(c),'ratelimit-hdr:',g.headers['x-ratelimit-limit'],'cors-hdr:',g.headers['access-control-allow-origin']);
  await f.close();
}
await run('as-in-app');
