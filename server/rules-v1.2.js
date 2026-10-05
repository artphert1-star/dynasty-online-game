'use strict';
// Live five-phase flow for rulebook v1.2. Attach to the shared engine.
module.exports = Game => {
const proto = Game.prototype, oldExec = proto.exec, oldEnd = proto.endEra, oldView = proto.view;
const oldRoll=proto.rl;proto.rl=function(p,n,label){const k=Math.min(10,Math.max(0,n|0));const faces=Array.from({length:k},()=>1+Math.floor(Math.random()*6));const successes=faces.filter(f=>f>=4).length;this.say(`🎲 ${p.name} — ${label}: [${faces.join(', ')}] = ${successes} สำเร็จ`);this.lastRoll={pid:p.id,name:p.name,label,n:k,faces,s:successes};return successes;};
proto.addU=function(p,k){p.unrest=Math.min(6,Math.max(0,p.unrest+k));if(p.unrest>=6)this.rebel(p);};
const oldFix=proto.fixFamily;proto.fixFamily=function(p){const before=p.lead;oldFix.call(this,p);if(p.lead!==before)p.deadEra=this.era;};
const PUBLIC = ['petition','realm','family'], SECRET = ['intrigue','kidnap','assassinate','guard','lobby'];
proto.startEra = function() {
 if(this.winner)return;
 this.era++; this.phase='negotiation'; this.flags={}; this.pending=null; this.turnOrder=[]; this.turnIndex=0;
 this.eventName=this.eventDeck.pop() || ['drought','border','feast','plague'][Math.floor(Math.random()*4)]; this.flags[this.eventName]=true;
 this.say(`เหตุการณ์: ${this.eventName}`); this.refill();
 for(const p of this.players){p.placed=null;p.guard=false;p.bonus=0;p.lobby=0;p.used=[];p.ready=p.bot;p.courtDone=true;p.courtCard=null;p.bribe=0;
  if(this.flags.border && this.rl(p, this.stat(p,'m')+this.hb(p,'m'),'ศึกชายแดน')<2)this.addU(p,1);
  p.rebelSoldiers=p.bot?2:(p.rebelSoldiers||0);p.money += [1,2,3,4,0][p.rank-1];
 }
};
proto.stat=function(p,k){return Math.min(6,Math.min(5,p.lead.b[k]+p.lead.t[k])+(p.wife&&p.wife.s===k?p.wife.v:0));};
proto.hb=(p,k)=>p.heir&&p.heir.b[k]+p.heir.t[k]>=3?1:0;
proto.beginPlacement=function(){if(this.phase!=='negotiation')return false;this.phase='orders';for(const p of this.players)if(p.bot)this.submit(p.id,this.botPlan(p).filter(o=>SECRET.includes(o.type)));return true;};
proto.submit=function(id,list){const p=this.P(id);if(this.phase!=='orders'||!p||p.placed||!Array.isArray(list))return false;
 const seen=new Set();p.capacity=[2,2,3,3,0][p.rank-1];p.placed=list.slice(0,p.capacity).filter(o=>o&&SECRET.includes(o.type)&&!seen.has(o.type)&&seen.add(o.type)).map(o=>({type:o.type,owner:id,opened:false,cancelled:false}));p.actions=p.capacity-p.placed.length;return true;};
proto.openWindow=function(){this.phase='turns';const ties=new Map(this.players.map(p=>[p.id,Math.random()]));this.turnOrder=[...this.players].sort((a,b)=>a.rank-b.rank||b.inf-a.inf||ties.get(a.id)-ties.get(b.id)).map(p=>p.id);this.turnIndex=0;this.say('ลำดับตา: '+this.turnOrder.map(id=>this.P(id).name).join(' → '));};
proto.active=function(){return this.turnOrder[this.turnIndex];};
proto.action=function(id,o){const p=this.P(id);if(this.phase!=='turns'||this.pending||this.active()!==id||!o||p.used.includes(o.type))return false;
 let card=null;if(PUBLIC.includes(o.type)){if(p.actions<=0)return false;p.actions--;}else if(['intrigue','kidnap','assassinate'].includes(o.type)){card=p.placed.find(c=>c.type===o.type&&!c.opened&&!c.cancelled);if(!card)return false;card.opened=true;}else return false;
 p.used.push(o.type);o={...o,owner:id};
 if(o.type==='petition') {p.lobby=0;this.pending={o,responders:this.turnOrder.filter(q=>q!==id&&this.P(q).placed.some(c=>c.type==='lobby'&&!c.opened&&!c.cancelled)),idx:0};}
 else if(['intrigue','kidnap','assassinate'].includes(o.type)){const t=this.P(o.target);if(!t||t===p){return true;}this.pending={o,responders:[t.id],idx:0};}
 else this.exec(p,o,[],new Set());
 this.finishPending();return true;};
proto.finishPending=function(){if(!this.pending||this.pending.kind==='heir'||this.pending.idx<this.pending.responders.length)return;
 const o=this.pending.o;this.pending=null;this.exec(this.P(o.owner),o,[],new Set());for(const p of this.players)this.fixFamily(p);};
proto.respond=function(id,{guard=false,pay=0,lobby='pass'}={}){const q=this.pending;if(!q||q.kind==='heir'||q.responders[q.idx]!==id)return false;const p=this.P(id);
 if(q.o.type==='petition'){const c=p.placed.find(c=>c.type==='lobby'&&!c.opened&&!c.cancelled);if(c&&['support','oppose'].includes(lobby)){c.opened=true;p.used.push('lobby');this.P(q.o.owner).lobby+=lobby==='support'?2:-2;}}
 else {const c=p.placed.find(c=>c.type==='guard'&&!c.opened&&!c.cancelled);if(guard&&c){c.opened=true;p.guard=true;p.used.push('guard');}p.defPay=Math.max(0,Math.min(2,pay|0));}
 q.idx++;this.finishPending();return true;};
proto.endTurn=function(id){if(this.phase!=='turns'||this.pending||this.active()!==id)return false;this.turnIndex++;if(this.turnIndex>=this.turnOrder.length){this.phase='end';for(const p of this.players)p.ready=p.bot;}return true;};
proto.exec=function(p,o,all,done){if(o.type==='intrigue'&&o.opt==='tryst')return;
 if(o.type==='family'){this.family(p,o,[],new Set());this.fixFamily(p);return;}
 oldExec.call(this,p,o,all,done);};
proto.family=function(p,o){
 if(o.opt==='adopt'){if(p.heir||p.capt||p.money<4)return;p.money-=4;p.heir=this.drawHeir();}
 else if(o.opt==='train'){if(!['i','n','m'].includes(o.stat))return;const h=p.heir;if(h&&h.b[o.stat]+h.t[o.stat]<5)h.t[o.stat]++;}
 else if(o.opt==='breed'){if(!p.wife)return;const cards=Array.from({length:p.wife.fert},()=>this.drawHeir());this.pending={kind:'heir',owner:p.id,cards,responders:[p.id],idx:0};if(p.bot)this.chooseHeir(p.id,0,1);}
 else if(o.opt==='marry')this.takeWife(p,o.wife|0);
};
proto.chooseHeir=function(id,pick,spare){const q=this.pending;if(!q||q.kind!=='heir'||q.owner!==id)return false;pick=pick|0;spare=spare|0;if(!q.cards[pick])return false;const p=this.P(id);const keep=q.cards[pick];if(!p.heir&&!p.capt){this.discard(p.heir);p.heir=keep;}else {this.discard(p.spare);p.spare=keep;}if(p.wife.fert===3&&q.cards[spare]&&spare!==pick){this.discard(p.spare);p.spare=q.cards[spare];}q.cards.forEach(c=>{if(c!==p.heir&&c!==p.spare)this.discard(c);});this.pending=null;this.fixFamily(p);return true;};
proto.die=function(p,cause){p.deadEra=this.era;p.wife=null;this.discard(p.lead);if(!p.heir&&p.spare){p.heir=p.spare;p.spare=null;}
 if(p.heir){p.lead=p.heir;p.heir=p.spare;p.spare=null;p.unrest++;}else{p.lead={name:'Regent',regent:true,age:1,b:{i:2,n:2,m:2},t:{i:0,n:0,m:0}};p.unrest+=3;if(cause!=='kill')p.rank=Math.max(1,p.rank-1);}this.rebel(p);};
proto.useSecret=function(id,idx,mode){const p=this.P(id),c=p&&p.secrets[idx];const own=this.phase==='turns'&&this.active()===id&&!this.pending;
 if(!c||p.usedSec===this.era||!(this.phase==='negotiation'||own)||!['extort','hush'].includes(mode))return false;const t=this.P(c.about);if(!t||t===p)return false;
 if(mode==='hush'){if(!own)return false;const cards=t.placed.filter(c=>!c.opened&&!c.cancelled);if(!cards.length)return false;const card=cards[Math.floor(Math.random()*cards.length)];card.cancelled=true;card.opened=true;this.say(`ปิดปาก: เปิด ${card.type} ของ ${t.name} และยกเลิก`);}else if(t.money>=c.v*2){t.money-=c.v*2;p.money+=c.v*2;}else t.inf=Math.max(0,t.inf-c.v);
 p.secrets.splice(idx,1);p.usedSec=this.era;p.bonus++;return true;};
proto.feast=function(id){const p=this.P(id);if(!p||!this.flags.feast||!(this.phase==='negotiation'||this.phase==='turns'&&this.active()===id&&!this.pending)||p.money<2)return false;p.money-=2;p.inf++;return true;};
proto.ransom=function(){return false;}; // Ransom is a negotiated transfer, never automatic.
proto.trade=function(id,{target,money=0,secret=-1,release=false,favor=false}={}){if(this.phase!=='negotiation')return false;const p=this.P(id),t=this.P(target);money=Math.max(0,money|0);if(!p||!t||p===t||p.money<money)return false;
 if(secret>=0&&(!p.secrets[secret]||t.secrets.length>=3))return false;p.money-=money;t.money+=money;if(secret>=0)t.secrets.push(p.secrets.splice(secret,1)[0]);if(release&&p.captive&&p.captive.owner===t.id)this.release(id);if(favor){this.favors=this.favors||[];this.favors.push({creditor:id,debtor:target,called:false});}return true;};
proto.favor=function(id,idx,fulfill){const f=(this.favors||[])[idx];if(!f||f.done)return false;if(f.creditor===id&&!f.called&&['negotiation','turns'].includes(this.phase)){f.called=true;f.era=this.era;return true;}if(f.debtor===id&&f.called){f.done=true;if(!fulfill)this.P(id).inf=Math.max(0,this.P(id).inf-1);return true;}return false;};
proto.finishEra=function(){if(this.phase!=='end'||!this.players.every(p=>p.ready))return false;
 // Age first, then bribes. Use existing scoring and age rolls with bribes deferred.
 const bribes=this.players.map(p=>p.bribe);this.players.forEach(p=>p.bribe=0);const bots=this.players.map(p=>p.bot);this.players.forEach(p=>p.bot=false);oldEnd.call(this);this.players.forEach((p,i)=>{p.bot=bots[i];const n=Math.max(0,Math.min(2,bribes[i]|0,p.money,p.unrest));p.money-=n;p.unrest-=n;});
 for(const f of this.favors||[])if(f.called&&!f.done&&f.era===this.era){this.P(f.debtor).inf=Math.max(0,this.P(f.debtor).inf-1);f.done=true;}
 if(this.era>=7)this.finalScore();this.hist.push({era:this.era,p:this.players.map(p=>({id:p.id,r:p.rank,i:p.inf,m:p.money,u:p.unrest}))});return true;};
proto.view=function(id){const v=oldView.call(this,id);v.lastRoll=this.lastRoll;v.orders=null;v.turnOrder=this.turnOrder;v.active=this.active();v.pending=this.pending&&(this.pending.kind==='heir'?{kind:'heir',responder:this.pending.owner,cards:this.pending.owner===id?this.pending.cards:undefined}:{type:this.pending.o.type,attacker:this.pending.o.owner,target:this.pending.o.target,responder:this.pending.responders[this.pending.idx]});v.favors=this.favors||[];v.players.forEach(p=>{const raw=this.P(p.id);p.soldiers=raw.soldiers;p.heir=raw.heir;p.actions=raw.actions;p.used=raw.used||[];p.protected=raw.deadEra===this.era||raw.kidnapEra===this.era;});return v;};
};
