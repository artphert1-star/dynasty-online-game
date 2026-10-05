'use strict';
const assert=require('node:assert/strict');const {Game}=require('./engine');
const make=(n=4)=>new Game(Array.from({length:n},(_,i)=>({id:''+i,name:'P'+i})));
function turns(g){g.startEra();g.beginPlacement();g.players.forEach(p=>g.submit(p.id,[]));g.openWindow();}
let g=make();turns(g);const a=g.P(g.active()),b=g.players.find(p=>p!==a);const order=g.turnOrder.slice();a.rank=4;a.inf=99;assert.deepEqual(g.turnOrder,order);assert.equal(g.action(b.id,{type:'realm',opt:'tax'}),false);assert(g.action(a.id,{type:'realm',opt:'tax'}));assert.equal(g.action(a.id,{type:'realm',opt:'tax'}),false);
g=make();g.startEra();g.beginPlacement();g.players.forEach(p=>g.submit(p.id,p.id==='0'?[{type:'kidnap'},{type:'assassinate'}]:[]));g.openWindow();g.turnIndex=g.turnOrder.indexOf('0');const p=g.P('0'),t=g.P('1');t.heir=g.drawHeir();p.money=20;g.rl=()=>5;g.contest=()=>({win:true,s:5,d:0});assert(g.action('0',{type:'kidnap',target:'1'}));assert(g.respond('1',{}));assert.equal(t.kidnapEra,g.era);const money=p.money,lead=t.lead;assert(g.action('0',{type:'assassinate',target:'1',opt:'leader'}));g.respond('1',{});assert.equal(t.lead,lead);assert.equal(p.money,money);
g=make();turns(g);g.contest=()=>({win:false,s:0,d:1});g.exec(g.P('0'),{type:'assassinate',target:'1',opt:'leader'},[],new Set());assert.equal(g.P('1').secrets[0].v,3);
g=make();turns(g);g.contest=()=>({win:true,s:4,d:2});g.exec(g.P('0'),{type:'intrigue',target:'1',opt:'spy'},[],new Set());assert.equal(g.P('0').secrets[0].v,2);
g=make();g.startEra();g.giveSecret(g.P('0'),1,'1');assert.equal(g.useSecret('0',0,'hush'),false);assert.equal(g.useSecret('0',0,'expose'),false);assert.equal(g.P('0').secrets.length,1);assert(g.useSecret('0',0,'extort'));
g=make();turns(g);g.P('0').heir=g.drawHeir();g.die(g.P('0'),'kill');assert(g.P('0').lead.isHeir);assert.equal(g.P('0').deadEra,g.era);
g=make();turns(g);g.P('0').lead.regent=true;g.P('0').heir=g.drawHeir();const u=g.P('0').unrest;g.fixFamily(g.P('0'));assert.equal(g.P('0').unrest,u);
g=make();g.startEra();g.beginPlacement();g.players.forEach(p=>g.submit(p.id,p.id==='1'?[{type:'guard'}]:[]));g.openWindow();g.turnIndex=g.turnOrder.indexOf('0');g.giveSecret(g.P('0'),1,'1');assert(g.useSecret('0',0,'hush'));assert(g.P('1').placed[0].cancelled);assert.equal(g.P('1').actions,1);assert.equal(g.view('0').players.find(p=>p.id==='1').placed,undefined);
g=make();turns(g);g.P('0').wife={fert:3};g.family(g.P('0'),{opt:'breed'});assert.equal(g.pending.kind,'heir');assert(g.chooseHeir('0',2,0));assert(g.P('0').heir&&g.P('0').spare);
// Run full games for each supported player count using the live API.
for(let n=3;n<=6;n++)for(let run=0;run<30;run++){
 g=make(n);g.players.forEach(p=>p.bot=true);
 while(!g.winner){g.startEra();g.beginPlacement();g.openWindow();let limit=150;
 while(g.phase==='turns'&& !g.winner && limit--){if(g.pending){if(g.pending.kind==='heir')g.chooseHeir(g.pending.owner,0,1);else g.respond(g.pending.responders[g.pending.idx],{guard:true,pay:0,lobby:'support'});continue;}
 const p=g.P(g.active());const o=g.botPlan(p).find(o=>!p.used.includes(o.type)&&(['petition','realm','family'].includes(o.type)?p.actions>0:['intrigue','kidnap','assassinate'].includes(o.type)&&p.placed.some(c=>c.type===o.type&&!c.opened&&!c.cancelled)));if(o){if(o.opt==='tryst')o.opt='spy';o.soldiers=2;g.action(p.id,o);}else g.endTurn(p.id);}
 assert(limit>0);if(!g.winner){g.players.forEach(p=>p.ready=true);assert(g.finishEra());}
 for(const p of g.players){assert(p.money>=0);assert(p.rank>=1&&p.rank<=5);assert(p.secrets.length<=3);assert(p.soldiers>=0&&p.soldiers<=4);}
 }
 assert(g.era<=7);
}
console.log('Rules regression tests passed; 120 full games (3–6 players) completed.');
