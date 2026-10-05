'use strict';
// Dynasty rules engine (rulebook v1.3). Pure logic: no network. Server calls it, client only renders view(pid).
const R = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const freshHeirs = () => shuffle(HEIRS.map(a => ({ ...mk(a), isHeir: true })));
const mk = ([name, age, i, n, m]) => ({ name, age, b: { i, n, m }, t: { i: 0, n: 0, m: 0 } });
const LEADERS = [['Corvin Aldane',0,4,2,2],['Sylvara Nox',0,2,4,2],['Brannoch Hale',0,2,2,4],['Isaren Voss',0,3,3,2],['Torvald Kerr',0,2,3,3],['Elmira Thane',1,5,2,2],['Mordan Skell',1,2,5,2],['Garrick Dunmoor',1,2,2,5]];
const HEIRS = [['Aren',0,4,1,1],['Bessa',0,1,4,1],['Caldor',0,1,1,4],['Dessa',0,3,2,1],['Edric',0,3,1,2],['Fenna',0,2,3,1],['Gaius',0,1,3,2],['Helda',0,2,1,3],['Ivor',0,1,2,3],['Jessa',0,2,2,2],['Kael',0,2,2,2],['Lyra',0,2,2,2],['Marek',1,5,1,1],['Nessa',1,1,5,1],['Orin',1,1,1,5],['Pella',1,4,2,1],['Quill',1,4,1,2],['Roran',1,2,4,1],['Sera',1,1,4,2],['Tamsin',1,2,1,4],['Ulric',1,1,2,4],['Vessa',1,3,2,2],['Wren',1,2,3,2],['Yara',1,2,2,3]];
// name, price, fertility, stat, bonus, fx
const WIVES = [['Adela',1,1,'i',1],['Berenne',1,2,'n',1],['Calista',1,2,'m',1],['Dorien',2,3,'n',1],['Elowen',2,1,'i',1,'sol1'],['Freya',2,2,'m',1,'gold1'],['Galena',3,2,'i',2],['Hesper',3,3,'n',1,'gold1'],['Ilsa',3,2,'n',1,'up'],['Joren',4,3,'m',1,'up'],['Katya',4,2,'n',2,'sol2'],['Liora',4,3,'m',2,'gold1']].map(([name, price, fert, s, v, fx]) => ({ name, price, fert, s, v, fx }));
const PUBLIC = ['petition', 'realm', 'family'];
const SECRET = ['intrigue', 'kidnap', 'assassinate', 'lobby', 'guard'];
const amount = (v, max = 2) => Math.min(max, Math.max(0, Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0));
const TH = [2, 2, 4, 5], SLOTS = [2, 2, 3, 3, 0], SAL = [1, 2, 3, 4, 0];
const STYLES = ['assassin', 'climber', 'warlord', 'balanced', 'schemer', 'turtle'];
const PREF = {
  assassin: ['assassinate', 'petition', 'intrigue', 'guard', 'realm'],
  climber: ['petition', 'lobby', 'realm', 'family', 'guard'],
  warlord: ['realm', 'petition', 'assassinate', 'kidnap', 'guard'],
  balanced: ['petition', 'family', 'realm', 'guard', 'intrigue'],
  schemer: ['intrigue', 'petition', 'family', 'lobby', 'realm'],
  turtle: ['guard', 'petition', 'family', 'realm', 'intrigue'],
};
const stat = (p, k) => { const l = p.lead; return Math.min(6, Math.min(5, l.b[k] + l.t[k]) + (p.wife && p.wife.s === k ? p.wife.v : 0)); };
const hb = (p, k) => (p.heir && p.heir.b[k] + p.heir.t[k] >= 3 ? 1 : 0);
const regent = () => ({ name: 'Regent', age: 1, regent: true, b: { i: 2, n: 2, m: 2 }, t: { i: 0, n: 0, m: 0 } });
const EVENTS = ['drought', 'border', 'feast', 'plague'];

class Game {
  constructor(players, options = {}) {
    if (!Array.isArray(players) || players.length < 3 || players.length > 6 || new Set(players.map(p => p.id)).size !== players.length) throw new Error('ต้องมีผู้เล่น 3–6 คนและรหัสไม่ซ้ำ');
    this.n = players.length; this.era = 0; this.hist = []; this.ev = []; this.rec = false; this.eventName = null; this.flags = {}; this.eventDeck = shuffle(EVENTS.flatMap(e => [e, e, e])); this.log = []; this.winner = null; this.phase = 'setup';
    const ls = shuffle(LEADERS.map(mk));
    this.leaderChoices = LEADERS.map((card, i) => ({ id: `L${i+1}`, ...mk(card) }));
    if (options.draftLeaders) this.phase = 'leaders';
    this.heirDeck = freshHeirs(); this.heirDisc = []; this.wifeDeck = shuffle(WIVES.map(w => ({ ...w })));
    this.pending = null; this.turnOrder = []; this.turnIndex = 0; this.favors = []; this.offers = []; this.nextOffer = 1;
    this.market = []; this.secretPool = [0,15,10,5];
    this.players = players.map((pl, i) => ({
      id: pl.id, name: pl.name, bot: !!pl.bot, style: pl.style || STYLES[R(6)], lead: options.draftLeaders ? null : ls[i], heir: null, spare: null, capt: null, captive: null, ready: false, used: [], envelope: [], slots: 2, publicLeft: 2, kidnappedEra: -1, turnEndedEra: -1, favorDebt: 0,
      wife: null, rank: 1, money: 3, inf: 0, unrest: 1, soldiers: 0, secrets: [], placed: null, deadEra: -1,
      bonus: 0, lobby: 0, guard: false, usedSec: -1, bribe: 0, defPay: 0,
    }));
    this.refill();
  }
  P(id) { return this.players.find(p => p.id === id); }
  chooseLeader(id, leaderId) {
    const p = this.P(id), leader = this.leaderChoices.find(c => c.id === leaderId);
    if (this.phase !== 'leaders' || !p || p.lead || !leader || this.players.some(q => q.lead?.id === leaderId)) return false;
    p.lead = { ...leader, b: { ...leader.b }, t: { ...leader.t } };
    this.say(`${p.name} เลือกผู้นำ ${leader.name}`); return true;
  }
  allLeadersChosen() { return this.players.every(p => p.lead); }
  chooseBotLeaders() {
    if (this.phase !== 'leaders' || this.players.some(p => !p.bot && !p.lead)) return false;
    for (const p of this.players.filter(p => p.bot && !p.lead)) {
      const available = this.leaderChoices.filter(c => !this.players.some(q => q.lead?.id === c.id));
      const key = ['assassin','schemer'].includes(p.style) ? 'n' : p.style === 'warlord' || p.style === 'turtle' ? 'm' : 'i';
      available.sort((a,b) => b.b[key]-a.b[key] || a.age-b.age);
      this.chooseLeader(p.id, available[0].id);
    }
    return this.allLeadersChosen();
  }
  netInf(p) { return p.inf - p.favorDebt; }
  gainInf(p,n) { const paid = Math.min(p.favorDebt,n); p.favorDebt -= paid; p.inf += n-paid; }
  penalizeFavor(p) { const paid = Math.min(p.inf,2); p.inf -= paid; p.favorDebt += 2-paid; }
  isProtected(p) { return p.deadEra === this.era || p.kidnappedEra >= 0 && (p.kidnappedEra === this.era || p.kidnappedEra === this.era-1 && p.turnEndedEra !== this.era); }
  left(p) { const i = this.players.indexOf(p); return this.players[(i + 1) % this.n]; }
  say(s) { const t = `[ยุค ${this.era}] ${s}`; this.log.push(t); if (this.rec) this.ev.push({ t: 'log', text: t }); }
  rl(p, n, label) {
    const k = Math.min(Math.max(n | 0, 0), 10), faces = Array.from({ length: k }, () => R(6) + 1), s = faces.filter(f => f >= 4).length;
    if (this.rec) this.ev.push({ t: 'roll', pid: p.id, name: p.name, label, n: k, faces, s });
    return s;
  }
  refill() { while (this.market.length < 3 && this.wifeDeck.length) this.market.push(this.wifeDeck.pop()); }
  discard(c) { if (c && c.isHeir) this.heirDisc.push({ ...c, t: { i: 0, n: 0, m: 0 } }); }
  drawHeir() { // Recycle only discarded heirs; never duplicate a character still in play.
    if (!this.heirDeck.length) { this.heirDeck = shuffle(this.heirDisc.splice(0));  }
    return this.heirDeck.pop() || null;
  }
  fixFamily(p) { // ทายาทสำรองเลื่อนขึ้น + ผู้สำเร็จราชการหมดวาระเมื่อมีทายาท (ข้อ 9ค)
    if (!p.heir && p.spare && !p.capt) { p.heir = p.spare; p.spare = null; }
    if (p.lead.regent && p.heir) {
      this.say(`${p.name}: ผู้สำเร็จราชการหมดวาระ ทายาทขึ้นเป็นผู้นำ`);
      this.discard(p.lead); p.lead = p.heir; p.heir = p.spare; p.spare = null;
    }
  }
  giveSecret(p, v, about) {
    if (p.secrets.length < 3 && this.secretPool[v] > 0) { p.secrets.push({v,about}); this.secretPool[v]--; }
  }
  discardSecret(p,index) { const c=p.secrets.splice(index,1)[0]; if(c)this.secretPool[c.v]++; }
  discardOwnSecret(id,index) { const p=this.P(id);if(!p||this.pending||this.phase==='over'||p.secrets[index]?.about!==id)return false;this.discardSecret(p,index);return true; }
  seatsFull(rank) { const cap = rank === 3 ? this.n - 1 : rank === 4 ? 2 : rank === 5 ? 1 : 99; return this.players.filter(p => p.rank === rank).length >= cap; }
  addU(p, k) { p.unrest += k; if (p.unrest >= 6) this.rebel(p); }

  returnHeir(o, c) {
    const h = c.captive.heir; o.capt = null; c.captive = null;
    if (!o.heir) o.heir = h; else if (!o.spare) o.spare = h; else this.discard(h);
    this.fixFamily(o);
  }
  release(id) { const c = this.P(id); if (!c || !c.captive) return false; const o = this.P(c.captive.owner); this.say(`${c.name} ปล่อยตัวทายาทของ ${o.name}`); this.returnHeir(o, c); return true; }
  takeWife(p, idx) {
    const w = this.market[idx]; if (!w || p.wife || p.money < w.price) return;
    p.money -= w.price; p.wife = w; this.market[idx] = null; this.market = this.market.filter(Boolean);
    if (w.fx === 'sol1') p.soldiers = Math.min(4, p.soldiers + 1);
    if (w.fx === 'sol2') p.soldiers = Math.min(4, p.soldiers + 2);
    if (w.fx === 'gold1') p.money++;
    if (w.fx === 'up') { if (p.rank < 3 && !this.seatsFull(p.rank + 1)) p.rank++; else this.gainInf(p,2); }
    this.say(`${p.name} แต่งงานกับ ${w.name}`);
  }
  pubScore(p) { return [0, 1, 3, 5, 0][p.rank - 1] + Math.min(8, Math.floor(this.netInf(p) / 2)) + (p.heir ? 2 : 0) + Math.min(3, Math.floor(p.money / 5)) - (p.unrest >= 4 ? 1 : 0); }
  finalScore() { // ข้อ 5ก: คะแนนราชวงศ์ (+ การ์ดความลับที่ยังถือแบบจับคู่ศูนย์รวม)
    for (const p of this.players) { p.sec = 0; }
    for (const h of this.players) for (const c of h.secrets) {
      if (c.about === h.id) continue;
      const pts = c.v === 3 ? 2 : 1; h.sec += pts; this.P(c.about).sec -= pts;
    }
    for (const p of this.players) { p.total = this.pubScore(p) + p.sec; this.say(`คะแนนราชวงศ์ ${p.name}: ${p.total} (สถานะ ${this.pubScore(p)}, ความลับ ${p.sec >= 0 ? '+' : ''}${p.sec})`); }
    const compare = (a,b) => b.total-a.total || b.rank-a.rank || this.netInf(b)-this.netInf(a) || b.money-a.money;
    this.winner = [...this.players].sort(compare)[0];
    this.winners = this.players.filter(p => compare(p,this.winner) === 0);
    this.say(`จบ 7 ยุค ผู้ชนะ${this.winners.length>1?'ร่วมกัน':''}: ${this.winners.map(p=>p.name).join(', ')}`);
  }

  botPlan(p) {
    const others = this.players.filter(q => q !== p), slots = SLOTS[p.rank - 1], out = [];
    const top = [...others].sort((a, b) => b.rank - a.rank || this.netInf(b) - this.netInf(a))[0];
    const payAmt = p.money >= 5 ? 2 : p.money >= 3 ? 1 : 0, cost = this.n === 3 ? 3 : 2;
    const can = {
      petition: () => p.rank < 5 && { type: 'petition', pay: payAmt },
      guard: () => ({ type: 'guard' }),
      lobby: () => top && top.rank >= 3 && { type: 'lobby', target: top.id, opt: 'oppose' },
      realm: () => (p.money < 3 || p.unrest <= 1) && p.unrest < 4 ? { type: 'realm', opt: 'tax' } : p.soldiers < 2 && p.money >= 3 ? { type: 'realm', opt: 'recruit' } : p.unrest < 4 && { type: 'realm', opt: 'tax' },
      family: () => {
        if (p.lead.regent && !p.heir && !p.capt && p.money >= 5) return { type: 'family', opt: 'adopt' };
        if (!p.wife) { const i = this.market.findIndex(m => m && m.price <= p.money); return i >= 0 && { type: 'family', opt: 'marry', wife: i }; }
        if (!p.heir) return { type: 'family', opt: 'breed' };
        return { type: 'family', opt: 'train', stat: 'i' };
      },
      intrigue: () => {
        let t, pick = 'secret';
        if (p.capt) { t = this.P(p.capt.by); pick = 'release'; }
        else { const h = others.find(q => q.secrets.some(c => c.about === p.id)); if (h && R(2)) { t = h; pick = 'destroy'; } else t = others[R(others.length)]; }
        if (!t) return null;
        
        return { type: 'intrigue', target: t.id, opt: 'spy', pick, pay: payAmt };
      },
      kidnap: () => { const t = !p.captive && others.find(q => q.heir); return t && { type: 'kidnap', target: t.id, pay: payAmt }; },
      assassinate: () => top && p.money >= cost + 1 && (top.rank >= p.rank) && { type: 'assassinate', target: top.id, opt: 'leader', pay: Math.max(0, Math.min(2, p.money - cost - 1)) },
    };
    for (const k of PREF[p.style]) { if (out.length >= slots) break; const o = can[k] && can[k](); if (o) out.push(o); }
    for (const k of ['petition', 'realm', 'guard']) { if (out.length >= slots) break; if (!out.some(o => o.type === k)) { const o = can[k](); if (o) out.push(o); } }
    
    return out;
  }

  active() { return this.turnOrder[this.turnIndex]; }
  has(p, type) { return p.envelope.some(c => c.type === type && !c.opened); }
  reveal(p, type) { const c = p.envelope.find(c => c.type === type && !c.opened); if (!c) return false; c.opened = true; p.used.push(type); return true; }
  startEra(now = Date.now()) {
    if (this.winner || !this.allLeadersChosen()) return false;
    this.era++; this.phase = 'negotiation'; this.pending = null; this.ev = []; this.rec = true;
    this.flags = {}; this.eventName = this.eventDeck.pop(); this.flags[this.eventName] = true;
    this.deadline = now + (this.n >= 5 ? 180000 : 120000);
    this.offers = []; this.turnOrder = []; this.turnIndex = 0;
    for (const p of this.players) {
      p.envelope = []; p.used = []; p.placed = null; p.ready = p.bot;
      p.guard = false; p.lobby = 0; p.bonus = 0; p.bribe = 0;
      if (this.flags.border && this.rl(p, stat(p, 'm') + hb(p, 'm'), 'ศึกชายแดน: ต้องได้ 2') < 2) this.addU(p, 1);
      p.money += SAL[p.rank - 1];
    }
    this.refill(); this.say(`เหตุการณ์: ${this.eventName} · รับเงินเดือน · เจรจา`);
    return true;
  }
  setReady(id) {
    const p = this.P(id); if (!p || !['negotiation','end'].includes(this.phase) || this.pending) return false;
    p.ready = true; return true;
  }
  allReady() { return this.players.every(p => p.ready); }
  beginPlacement() {
    if (this.phase !== 'negotiation') return false;
    this.phase = 'placement'; this.offers = [];
    for (const p of this.players) { p.slots = SLOTS[p.rank - 1]; p.ready = false; if (p.bot) this.submit(p.id, this.botPlan(p).filter(o => SECRET.includes(o.type)).map(o => ({ type: o.type }))); }
    return true;
  }
  submit(id, list) {
    const p = this.P(id);
    if (!p || this.phase !== 'placement' || p.placed !== null || !Array.isArray(list) || list.length > p.slots) return false;
    const types = list.map(c => c && c.type);
    if (types.some(t => !SECRET.includes(t)) || new Set(types).size !== types.length) return false;
    p.envelope = types.map(type => ({ type, opened: false })); p.placed = p.envelope;
    p.publicLeft = p.slots - types.length; p.ready = true; return true;
  }
  allIn() { return this.players.every(p => p.placed !== null); }
  beginTurns() {
    if (this.phase !== 'placement' || !this.allIn()) return false;
    const sorted = [...this.players].sort((a,b) => a.rank-b.rank || this.netInf(b)-this.netInf(a));
    const order = [];
    for (let i=0;i<sorted.length;) {
      let end=i+1;
      while(end<sorted.length && sorted[end].rank===sorted[i].rank && this.netInf(sorted[end])===this.netInf(sorted[i])) end++;
      order.push(...this.tieOrder(sorted.slice(i,end))); i=end;
    }
    this.turnOrder = order.map(p => p.id); this.turnIndex = 0; this.phase = 'turns';
    this.say(`ลำดับตาล็อก: ${order.map(p => p.name).join(' → ')}`); return true;
  }
  tieDie(p) { const face=R(6)+1; if(this.rec)this.ev.push({t:'roll',pid:p.id,name:p.name,label:'ทอยจัดลำดับตา',n:1,faces:[face],s:face,turnOrder:true});return face; }
  tieOrder(group) {
    if(group.length<2)return group;
    const buckets = new Map();
    for(const p of group){const face=this.tieDie(p);if(!buckets.has(face))buckets.set(face,[]);buckets.get(face).push(p);}
    return [...buckets.keys()].sort((a,b)=>b-a).flatMap(face=>this.tieOrder(buckets.get(face)));
  }
  act(id, input) {
    const p = this.P(id), o = input && { ...input, owner: id };
    if (!p || !o || this.phase !== 'turns' || this.active() !== id || this.pending || p.used.includes(o.type)) return false;
    const isPublic = PUBLIC.includes(o.type), t = this.P(o.target);
    if (isPublic ? p.publicLeft < 1 : !['intrigue','kidnap','assassinate'].includes(o.type) || !this.has(p,o.type)) return false;
    if (!isPublic && (!t || t === p)) return false;
    if (o.type === 'realm' && !['tax','recruit'].includes(o.opt)) return false;
    if (o.type === 'family' && !['marry','breed','train','adopt'].includes(o.opt)) return false;
    if (o.type === 'family' && o.opt === 'train' && !['i','n','m'].includes(o.stat)) return false;
    if (o.type === 'intrigue' && !['secret','destroy','release'].includes(o.pick)) return false;
    if (o.type === 'assassinate' && !['leader','heir'].includes(o.opt)) return false;
    if (o.type === 'petition' && this.seatsFull(p.rank+1) && p.rank < 4 && !this.players.some(q => q.id === o.victim && q.rank === p.rank+1)) return false;
    if (isPublic) { p.publicLeft--; p.used.push(o.type); } else this.reveal(p,o.type);
    o.pay = amount(o.pay); o.soldiers = amount(o.soldiers);
    this.say(`${p.name}: ${o.type}`);
    if (o.type === 'petition') {
      this.pending = { kind: 'lobby', actor: id, order: o, queue: this.turnOrder.filter(pid => pid !== id && this.has(this.P(pid),'lobby')), index: 0 };
      this.advanceLobby();
    } else if (!isPublic) {
      if (o.type === 'kidnap' && (!t.heir || p.captive) || o.type === 'assassinate' && (o.opt === 'heir' ? !t.heir : this.isProtected(t))) { this.say('เป้าหมายไม่พร้อมหรือผู้นำได้รับการคุ้มครอง ช่องที่เปิดเสียไป'); return true; }
      if (o.type === 'assassinate') { const cost = this.n === 3 ? 3 : 2; if (p.money < cost) return true; p.money -= cost; }
      this.pending = { kind: 'defense', actor: id, responder: t.id, order: o };
    } else if (o.type === 'realm') {
      if (o.opt === 'tax') { p.money += p.rank+1; this.addU(p,this.flags.drought ? 2 : 1); }
      else { const n = Math.min(amount(o.count),p.money,4-p.soldiers); p.money -= n; p.soldiers += n; }
    } else this.familyAction(p,o);
    return true;
  }
  advanceLobby() {
    const q = this.pending;
    if (q.index < q.queue.length) { q.responder = q.queue[q.index]; return; }
    this.pending = { kind: 'petition', actor: q.actor, responder: q.actor, order: q.order };
  }
  respond(id, data = {}) {
    const q = this.pending; if (!q || q.responder !== id) return false;
    const p = this.P(id), a = this.P(q.actor);
    if (q.kind === 'lobby') {
      if (!['support','oppose','pass'].includes(data.choice)) return false;
      if (data.choice !== 'pass' && this.reveal(p,'lobby')) {
        a.lobby += data.choice === 'oppose' ? -2 : 2;
        p.lobbyAction = { era:this.era,target:q.actor,choice:data.choice };
        for(const f of this.favors)if(f.debtor===id && f.called===this.era && f.terms.kind==='lobby' && f.terms.target===q.actor && f.terms.choice===data.choice)f.fulfilled=true;
      }
      q.index++; this.advanceLobby(); return true;
    }
    if (q.kind === 'petition') { this.pending = null; this.petition(p,{...q.order,pay:amount(data.pay),soldiers:amount(data.soldiers)}); return true; }
    if (q.kind === 'defense') {
      if (data.guard && this.has(p,'guard')) { this.reveal(p,'guard'); p.guard = true; }
      p.defPay = amount(data.pay); this.pending = null; this.attack(a,p,q.order); return true;
    }
    if (q.kind === 'birth') {
      const first = amount(data.first,q.cards.length-1), second = data.second == null ? null : amount(data.second,q.cards.length-1);
      if (q.keepSpare && data.second != null && first === second) return false;
      this.pending = null;
      const kept = [];
      if (!p.heir && !p.capt) { p.heir = q.cards[first]; kept.push(q.cards[first]); }
      else if (!p.spare) { p.spare = q.cards[first]; kept.push(q.cards[first]); }
      if (q.keepSpare && second !== null && !p.spare && q.cards[second] && first !== second) { p.spare = q.cards[second]; kept.push(q.cards[second]); }
      q.cards.filter(c => !kept.includes(c)).forEach(c => this.discard(c)); this.fixFamily(p); return true;
    }
    if (q.kind === 'destroy') {
      const index = amount(data.index,p.secrets.length-1); if (!p.secrets[index] || p.secrets[index].about !== q.actor) return false;
      this.discardSecret(p,index); this.pending = null; return true;
    }
    return false;
  }
  contest(a,t,pay) {
    const pa = Math.min(amount(pay),a.money), pd = Math.min(amount(t.defPay),t.money);
    a.money -= pa; t.money -= pd;
    const s = this.rl(a,stat(a,'n')+hb(a,'n')+pa,'โจมตี: เล่ห์เหลี่ยม'), d = this.rl(t,stat(t,'m')+hb(t,'m')+(t.guard?2:0)+pd,'ป้องกัน: กำลังรบ');
    return {s,d,win:s>d};
  }
  attack(p,t,o) {
    const r = this.contest(p,t,o.pay);
    if (o.type === 'intrigue') {
      if (r.win) {
        if (o.pick === 'release' && t.captive && t.captive.owner === p.id) this.release(t.id);
        else if (o.pick === 'destroy' && t.secrets.some(c => c.about === p.id)) this.pending = {kind:'destroy',actor:p.id,responder:t.id};
        else if (o.pick === 'secret') this.giveSecret(p,r.s-r.d>=2?2:1,t.id);
      } else if (r.s === 0) this.giveSecret(t,1,p.id);
    } else if (o.type === 'kidnap' && r.win) {
      p.captive = {owner:t.id,heir:t.heir}; t.capt = {by:p.id}; t.heir = null; t.kidnappedEra = this.era;
      this.addU(t,1); this.say(`${p.name} ลักพาตัวทายาทของ ${t.name} · ผู้นำคุ้มครองจนเหยื่อจบตาในยุค ${this.era+1}`);
    } else if (o.type === 'assassinate') {
      if (r.win) { p.inf = Math.max(0,p.inf-1); if(o.opt==='heir'){this.discard(t.heir);t.heir=null;this.fixFamily(t);}else{this.die(t,'kill');p.bonus++;} }
      else if(r.s===0) this.giveSecret(t,3,p.id);
    }
    this.say(`${p.name} ${o.type}: ${r.s} ต่อ ${r.d} · ${r.win?'สำเร็จ':'ล้มเหลว'}`);
  }
  familyAction(p,o) {
    if(o.opt==='adopt'){if(p.heir||p.capt||p.money<4)return;const card=this.drawHeir();if(!card)return;p.money-=4;p.heir=card;this.fixFamily(p);}
    else if(o.opt==='train'){if(p.heir && p.heir.b[o.stat]+p.heir.t[o.stat]<5)p.heir.t[o.stat]++;}
    else if(o.opt==='breed'){
      if(!p.wife || p.heir || p.capt)return;
      const cards=Array.from({length:p.wife.fert},()=>this.drawHeir()).filter(Boolean);
      if(cards.length)this.pending={kind:'birth',actor:p.id,responder:p.id,cards,keepSpare:p.wife.fert===3};
    }else this.takeWife(p,amount(o.wife,2));
  }
  petition(p,o) {
    const use=Math.min(amount(o.soldiers),p.soldiers),pay=Math.min(amount(o.pay),p.money),full=this.seatsFull(p.rank+1),need=TH[p.rank-1]+(full?1:0);
    const dice=stat(p,'i')+hb(p,'i')+use+Math.floor(stat(p,'m')/2)+p.bonus+p.lobby+pay;
    p.soldiers-=use;p.money-=pay;p.bonus=0;p.lobby=0;
    const got=this.rl(p,dice,`ขอเลื่อนยศ ต้องได้ ${need}`);this.say(`${p.name} ขอเลื่อนยศ ${got}/${need}`);
    if(got<need)return;
    if(full && p.rank<4){const v=this.P(o.victim);if(v && v.rank===p.rank+1)v.rank--;}
    p.rank++;this.gainInf(p,2);if(p.rank===5){this.winner=p;this.winners=[p];this.phase='over';this.say(`${p.name} เป็นจักรพรรดิ`);}
  }
  rebel(p) {
    // A rebellion can interrupt any action. Queue it until that action's own response is complete.
    this.rebellions ||= []; if(!this.rebellions.includes(p.id))this.rebellions.push(p.id); p.unrest=Math.min(6,p.unrest);
  }
  checkRebellion() {
    if(this.pending || !this.rebellions?.length)return false;
    const id=this.rebellions.shift();this.pending={kind:'rebellion',actor:id,responder:id};return true;
  }
  resolveRebellion(id,data={}) {
    if(this.pending?.kind!=='rebellion'||this.pending.responder!==id)return false;
    const p=this.P(id),use=Math.min(amount(data.soldiers),p.soldiers);
    p.soldiers-=use;this.pending=null;
    const a=this.rl(p,stat(p,'m')+hb(p,'m')+use,'ปราบกบฏ'),b=this.rl(p,p.unrest,'ฝ่ายกบฏ');
    if(a>=b){p.unrest=1;this.gainInf(p,1);}else{p.rank=Math.max(1,p.rank-1);p.money=Math.max(0,p.money-3);p.inf=Math.max(0,p.inf-1);p.unrest=2;}
    this.say(`${p.name} ${a>=b?'ชนะ':'แพ้'}กบฏ`);return true;
  }
  die(p,cause) {
    p.deadEra=this.era;p.wife=null;this.discard(p.lead);
    if(!p.heir && p.spare){p.heir=p.spare;p.spare=null;if(p.capt)p.capt.asSpare=true;}
    if(p.heir){p.lead=p.heir;p.heir=p.spare;p.spare=null;p.unrest+=1;}
    else{p.lead=regent();p.unrest+=3;if(cause!=='kill')p.rank=Math.max(1,p.rank-1);}
    this.say(`${p.name}: ผลัดบัลลังก์เป็น ${p.lead.name}`);this.rebel(p);
  }
  endTurn(id) {
    if(this.phase!=='turns'||this.active()!==id||this.pending)return false;
    this.P(id).turnEndedEra=this.era;this.turnIndex++;if(this.turnIndex===this.n)this.beginEnd();return true;
  }
  beginEnd() {
    this.phase='aging'; const base=this.era>=4?[1,1,1,2][this.era-4]:0,lv=base+(this.flags.plague?1:0);
    if(lv>0)for(const p of this.players){const f=R(6)+1,thr=lv+p.lead.age;this.ev.push({t:'roll',pid:p.id,name:p.name,label:`วัย: ตายเมื่อ ≤ ${thr}`,n:1,faces:[f],s:f<=thr?1:0,die:true});if(f<=thr)this.die(p,'age');}
  }
  finishAging() { if(this.phase!=='aging'||this.pending||this.rebellions?.length)return false;this.phase='end';for(const p of this.players)p.ready=p.bot;return true; }
  bribe(id,n) { const p=this.P(id);if(!p||this.phase!=='end'||p.ready)return false;const k=Math.min(amount(n,2-p.bribe),p.money,p.unrest);p.money-=k;p.unrest-=k;p.bribe+=k;return true; }
  finishEra() {
    if(this.phase!=='end'||!this.allReady())return false;
    for(const f of this.favors)if(f.called===this.era && !f.fulfilled){const p=this.P(f.debtor);this.penalizeFavor(p);f.fulfilled=true;this.say(`${p.name} ผิดสัญญาบุญคุณ บารมี −2 · โทษค้าง ${p.favorDebt}`);}
    this.favors=this.favors.filter(f=>f.called!==this.era);
    this.hist.push({era:this.era,p:this.players.map(p=>({id:p.id,r:p.rank,i:this.netInf(p),m:p.money,u:p.unrest}))});
    for(const p of this.players){p.envelope=[];p.placed=null;this.fixFamily(p);}
    if(this.era>=7){this.finalScore();this.phase='over';}else this.phase='between';return true;
  }
  useSecret(id,index,mode) {
    const p=this.P(id),c=p?.secrets[index],own=this.phase==='turns'&&this.active()===id;
    if(!p||!c||this.pending||p.usedSec===this.era||!(this.phase==='negotiation'||own)||!['extort','hush'].includes(mode)||mode==='hush'&&!own)return false;
    const t=this.P(c.about);if(!t||t===p)return false;
    if(mode==='hush'){const cards=t.envelope.filter(c=>!c.opened);if(!cards.length)return false;cards[R(cards.length)].opened=true;}
    else if(t.money>=c.v*2){t.money-=c.v*2;p.money+=c.v*2;}else t.inf=Math.max(0,t.inf-c.v);
    this.discardSecret(p,index);p.usedSec=this.era;p.bonus++;this.say(`${p.name} ใช้ความลับ ${mode} กับ ${t.name}`);return true;
  }
  feast(id) { const p=this.P(id);if(!p||!this.flags.feast||this.pending||!['negotiation','placement','turns'].includes(this.phase)||p.money<2)return false;p.money-=2;this.gainInf(p,1);return true; }
  offer(id,d) {
    const p=this.P(id),t=this.P(d.target);if(this.phase!=='negotiation'||this.pending||!p||!t||p===t)return false;
    const money=amount(d.money,999),secret=d.secret==null?null:amount(d.secret,2);
    if(money>p.money||secret!==null&&!p.secrets[secret]||d.release&&p.captive?.owner!==t.id||d.favor&&this.favors.length>=18)return false;
    if(this.offers.filter(o=>o.from===id).length>=5)return false;
    const terms = d.favor ? this.favorTerms(d.terms,t.id) : null;
    if(d.favor && !terms)return false;
    this.offers.push({id:this.nextOffer++,from:id,to:t.id,money,secret:secret===null?null:p.secrets[secret],release:!!d.release,favor:!!d.favor,terms});return true;
  }
  favorTerms(input,debtor) {
    if(!input || typeof input !== 'object')return null;
    if(input.kind==='lobby' && ['support','oppose'].includes(input.choice) && this.P(input.target) && input.target!==debtor)return {kind:'lobby',target:input.target,choice:input.choice};
    if(input.kind==='other' && typeof input.text==='string' && input.text.trim())return {kind:'other',text:input.text.trim().slice(0,200)};
    return null;
  }
  accept(id,offerId) {
    const o=this.offers.find(o=>o.id===offerId&&o.to===id),p=o&&this.P(o.from),t=this.P(id);
    if(this.phase!=='negotiation'||this.pending||!o||p.money<o.money||o.secret&&!p.secrets.includes(o.secret)||o.secret&&t.secrets.length>=3||o.release&&p.captive?.owner!==id||o.favor&&this.favors.length>=18)return false;
    p.money-=o.money;t.money+=o.money;if(o.secret){p.secrets.splice(p.secrets.indexOf(o.secret),1);t.secrets.push(o.secret);}if(o.release)this.release(p.id);
    if(o.favor)this.favors.push({id:o.id,holder:p.id,debtor:id,called:null,fulfilled:false,terms:o.terms});
    this.offers=this.offers.filter(x=>x!==o);this.say(`${t.name} รับข้อตกลงจาก ${p.name}`);return true;
  }
  favor(id,tokenId,fulfill=false) {
    const f=this.favors.find(f=>f.id===tokenId);if(!f||this.pending||!['negotiation','turns'].includes(this.phase))return false;
    if(fulfill&&f.holder===id&&f.terms.kind==='other'&&f.called===this.era){f.fulfilled=true;return true;}
    if(!fulfill&&f.holder===id&&f.called===null){
      f.called=this.era;const action=this.P(f.debtor).lobbyAction;
      if(f.terms.kind==='lobby'&&action?.era===this.era&&action.target===f.terms.target&&action.choice===f.terms.choice)f.fulfilled=true;
      return true;
    }return false;
  }
  botStep() {
    if(this.checkRebellion())return true;
    if(this.pending){const q=this.pending,p=this.P(q.responder);if(!p.bot)return false;
      if(q.kind==='rebellion')return this.resolveRebellion(p.id,{soldiers:2});
      if(q.kind==='destroy')return this.respond(p.id,{index:p.secrets.findIndex(c=>c.about===q.actor)});
      return this.respond(p.id,{choice:'oppose',guard:true,pay:Math.min(2,Math.max(0,p.money-3)),soldiers:2,first:0,second:1});
    }
    if(this.phase==='aging')return this.finishAging();
    if(this.phase==='turns'){const p=this.P(this.active());if(!p.bot)return false;
      const plan=this.botPlan(p);
      for(const o of plan){if(p.used.includes(o.type))continue;if(PUBLIC.includes(o.type)&&p.publicLeft>0||this.has(p,o.type)&&!['guard','lobby'].includes(o.type)){
        if(o.type==='intrigue')o.pick=o.pick||'secret';if(o.type==='realm')o.count=2;
        if(o.type==='petition')o.victim=this.players.find(t=>t.rank===p.rank+1)?.id;
        if(this.act(p.id,o))return true;
      }}return this.endTurn(p.id);
    }return false;
  }
  view(pid) {
    const own=this.P(pid),q=this.pending;
    if(this.phase==='leaders')return {rulesVersion:'1.3',era:0,phase:'leaders',log:this.log,leaderChoices:this.leaderChoices.map(c=>({...c,takenBy:this.players.find(p=>p.lead?.id===c.id)?.id})),players:this.players.map(p=>({id:p.id,name:p.name,bot:p.bot,style:p.style,lead:p.lead}))};
    return {rulesVersion:'1.3',era:this.era,phase:this.phase,deadline:this.deadline,event:this.eventName,feast:!!this.flags.feast,
      hist:this.hist,market:this.market,log:this.log.slice(-40),turnOrder:this.turnOrder,active:this.active(),usedSec:own?.usedSec===this.era,
      assCost:this.n===3?3:2,winner:this.winners?.map(p=>p.name).join(', ')||this.winner?.name,winnerId:this.winner?.id,winnerIds:this.winners?.map(p=>p.id)||[],offers:this.offers.filter(o=>o.from===pid||o.to===pid),favors:this.favors,
      pending:q?{kind:q.kind,actor:q.actor,responder:q.responder,...(q.order?{order:q.order}:{}),...(q.responder===pid&&q.cards?{cards:q.cards,keepSpare:q.keepSpare}:{})}:null,
      rolls:this.ev.filter(e=>e.t==='roll').slice(-4),
      players:this.players.map(p=>({id:p.id,name:p.name,bot:p.bot,style:p.style,lead:p.lead,rank:p.rank,money:p.money,inf:p.inf,netInf:this.netInf(p),favorDebt:p.favorDebt,unrest:p.unrest,
        st:{i:stat(p,'i'),n:stat(p,'n'),m:stat(p,'m')},hb:{i:hb(p,'i'),n:hb(p,'n'),m:hb(p,'m')},score:this.phase==='over'?p.total??this.pubScore(p):this.pubScore(p),
        wife:p.wife,heir:p.heir,heirKnown:!!p.heir,capt:p.capt,holding:p.captive?{owner:p.captive.owner}:null,ready:p.ready,secretCount:p.secrets.length,secretAbout:p.secrets.map(c=>c.about),tokensPlaced:p.envelope.length,
        protected:this.isProtected(p),protectionUntil:p.kidnappedEra>=0?p.kidnappedEra+1:null,publicLeft:p.publicLeft,slots:p.slots,used:p.used,
        revealed:p.envelope.filter(c=>c.opened).map(c=>c.type),
        ...(p.id===pid?{heir:p.heir,spare:p.spare,secrets:p.secrets,soldiers:p.soldiers,envelope:p.envelope,placed:p.placed}:{})}))};
  }

}
module.exports = { Game, STYLES };
