'use strict';
// Dynasty rules engine (rulebook v0.8). Pure logic: no network. Server calls it, client only renders view(pid).
const R = n => Math.floor(Math.random() * n);
const roll = n => { let s = 0; for (let i = 0; i < Math.min(Math.max(n | 0, 0), 10); i++) if (R(6) >= 3) s++; return s; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mk = ([name, age, i, n, m]) => ({ name, age, b: { i, n, m }, t: { i: 0, n: 0, m: 0 } });
const LEADERS = [['Corvin Aldane',0,4,2,2],['Sylvara Nox',0,2,4,2],['Brannoch Hale',0,2,2,4],['Isaren Voss',0,3,3,2],['Torvald Kerr',0,2,3,3],['Elmira Thane',1,5,2,2],['Mordan Skell',1,2,5,2],['Garrick Dunmoor',1,2,2,5]];
const HEIRS = [['Aren',0,4,1,1],['Bessa',0,1,4,1],['Caldor',0,1,1,4],['Dessa',0,3,2,1],['Edric',0,3,1,2],['Fenna',0,2,3,1],['Gaius',0,1,3,2],['Helda',0,2,1,3],['Ivor',0,1,2,3],['Jessa',0,2,2,2],['Kael',0,2,2,2],['Lyra',0,2,2,2],['Marek',1,5,1,1],['Nessa',1,1,5,1],['Orin',1,1,1,5],['Pella',1,4,2,1],['Quill',1,4,1,2],['Roran',1,2,4,1],['Sera',1,1,4,2],['Tamsin',1,2,1,4],['Ulric',1,1,2,4],['Vessa',1,3,2,2],['Wren',1,2,3,2],['Yara',1,2,2,3]];
// name, price, fertility, stat, bonus, fx
const WIVES = [['Adela',1,1,'i',1],['Berenne',1,2,'n',1],['Calista',1,2,'m',1],['Dorien',2,3,'n',1],['Elowen',2,1,'i',1,'sol1'],['Freya',2,2,'m',1,'gold1'],['Galena',3,2,'i',2],['Hesper',3,3,'n',1,'gold1'],['Ilsa',3,2,'n',1,'up'],['Joren',4,3,'m',1,'up'],['Katya',4,2,'n',2,'sol2'],['Liora',4,3,'m',2,'gold1']].map(([name, price, fert, s, v, fx]) => ({ name, price, fert, s, v, fx }));
const PRI = { guard: 1, lobby: 1, realm: 2, intrigue: 3, kidnap: 4, assassinate: 5, family: 6, petition: 7, decoy: 9 };
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
const regent = () => ({ name: 'Regent', age: 0, b: { i: 2, n: 2, m: 2 }, t: { i: 0, n: 0, m: 0 } });

// court cards: A/B choices
const COURT = [
  { name: 'ขุนนางขอที่ดิน', A: p => p.money >= 2 && (p.money -= 2, p.unrest = Math.max(0, p.unrest - 1), true), B: (p, g) => (p.inf++, g.addU(p, 1)) },
  { name: 'ทูตต่างแดน', A: p => p.money >= 1 && (p.money--, p.soldiers = Math.min(4, p.soldiers + 1), true), B: () => true },
  { name: 'เรื่องอื้อฉาว', A: p => p.money >= 2 && (p.money -= 2, true), B: (p, g) => { const q = g.left(p); if (q) g.giveSecret(q, 1, p.id); } },
  { name: 'ทายาทดื้อรั้น', A: (p, g) => p.heir && (p.heir.t.i < 5 - p.heir.b.i ? p.heir.t.i++ : p.heir.t.m++, g.addU(p, 1), true), B: () => true },
  { name: 'พ่อค้าเสนอส่วย', A: (p, g) => (p.money += 3, g.addU(p, 1), true), B: p => { p.inf++; } },
  { name: 'ผู้อาวุโสขอคำปรึกษา', A: p => { if (roll(stat(p, 'i')) >= 1) p.inf++; else p.money = Math.max(0, p.money - 1); return true; }, B: () => true },
];
const EVENTS = ['drought', 'border', 'feast', 'plague'];

class Game {
  constructor(players, seed) {
    this.n = players.length; this.era = 0; this.log = []; this.winner = null; this.phase = 'setup';
    const ls = shuffle(LEADERS.map(mk));
    this.heirDeck = shuffle(HEIRS.map(mk)); this.wifeDeck = shuffle(WIVES.map(w => ({ ...w })));
    this.courtDeck = []; this.courtDisc = [];
    this.market = []; this.sealIdx = 0;
    this.players = players.map((pl, i) => ({
      id: pl.id, name: pl.name, bot: !!pl.bot, style: pl.style || STYLES[R(6)], lead: ls[i], heir: null, spare: null, heirK: 0,
      wife: null, rank: 1, money: 3, inf: 0, unrest: 1, soldiers: 0, secrets: [], placed: null, deadEra: -1,
      bonus: 0, lobby: 0, guard: false, usedSec: -1, bribe: 0, defPay: 0, courtCard: null, courtDone: true,
    }));
    this.refill();
  }
  P(id) { return this.players.find(p => p.id === id); }
  left(p) { const i = this.players.indexOf(p); return this.players[(i + 1) % this.n]; }
  say(s) { this.log.push(`[ยุค ${this.era}] ${s}`); }
  refill() { while (this.market.length < 3 && this.wifeDeck.length) this.market.push(this.wifeDeck.pop()); }
  drawHeir() { if (!this.heirDeck.length) this.heirDeck = shuffle(HEIRS.map(mk)); return this.heirDeck.pop(); }
  giveSecret(p, v, about) { if (p.secrets.length < 3) p.secrets.push({ v, about }); }
  seatsFull(rank) { const cap = rank === 3 ? this.n - 1 : rank === 4 ? 2 : rank === 5 ? 1 : 99; return this.players.filter(p => p.rank === rank).length >= cap; }
  addU(p, k) { p.unrest += k; if (p.unrest >= 6) this.rebel(p); }

  rebel(p) {
    const use = Math.min(2, p.soldiers); p.soldiers -= use;
    const a = roll(stat(p, 'm') + use), b = roll(p.unrest);
    if (a >= b) { p.unrest = 1; p.inf++; this.say(`${p.name} ปราบกบฏสำเร็จ`); }
    else { p.rank = Math.max(1, p.rank - 1); p.money = Math.max(0, p.money - 3); p.inf = Math.max(0, p.inf - 1); p.unrest = 2; this.say(`${p.name} แพ้กบฏ ยศลด`); }
  }
  die(p, cause) {
    p.deadEra = this.era; p.wife = null;
    if (p.heir && !p.heirK) { p.lead = p.heir; p.heir = p.spare; p.spare = null; p.unrest += 1; this.say(`${p.name}: ทายาทขึ้นครองบัลลังก์`); }
    else {
      const had = false; p.lead = regent(); p.heir = p.spare; p.spare = null; p.heirK = 0; p.unrest += 3;
      if (cause !== 'kill') p.rank = Math.max(1, p.rank - 1);
      this.say(`${p.name}: ผู้สำเร็จราชการขึ้นครอง`);
    }
    if (p.unrest >= 6) this.rebel(p); else this.rebel(p); // succession always triggers a loyalty check
  }
  contest(a, t, stKey, pay) {
    const pa = Math.min(2, pay | 0, a.money); a.money -= pa;
    const pd = t.bot ? Math.min(2, Math.max(0, t.money - 3)) : Math.min(2, t.defPay | 0, t.money); t.money -= pd;
    const s = roll(stat(a, stKey) + pa), d = roll(stat(t, 'm') + (t.guard ? 2 : 0) + pd);
    return { s, d, win: s > d };
  }

  // ---------- era flow ----------
  startEra() {
    if (this.winner) return;
    this.era++; this.phase = 'orders'; this.flags = {};
    const ev = EVENTS[R(4)]; this.flags[ev] = true; this.say(`เหตุการณ์: ${ev}`);
    if (ev === 'border') this.players.forEach(p => { if (roll(stat(p, 'm')) < 2) this.addU(p, 1); });
    for (const p of this.players) {
      p.money += SAL[p.rank - 1]; p.placed = null; p.guard = false; p.lobby = 0; p.bonus = 0; p.bribe = 0;
      if (!this.courtDeck.length) { this.courtDeck = shuffle(this.courtDisc.splice(0).concat(COURT.map((c, i) => i))); }
      p.courtCard = this.courtDeck.pop(); p.courtDone = false;
      if (p.heirK > 0 && --p.heirK === 0) this.say(`ทายาทของ ${p.name} ถูกปล่อยตัว`);
    }
    this.refill();
    for (const p of this.players) if (p.bot) { this.botCourt(p); this.botSecrets(p); this.submit(p.id, this.botPlan(p)); }
  }
  court(id, choice) {
    const p = this.P(id); if (!p || p.courtDone) return false;
    const c = COURT[p.courtCard]; let ok = true;
    if (choice === 'A') ok = !!c.A(p, this); if (choice === 'B' || !ok) c.B(p, this);
    p.courtDone = true; this.courtDisc.push(p.courtCard); return true;
  }
  submit(id, list) {
    const p = this.P(id); if (!p || p.placed) return false;
    const slots = SLOTS[p.rank - 1], seen = new Set(), out = [];
    for (const o of list.slice(0, slots)) {
      if (!PRI[o.type] || seen.has(o.type)) continue;
      seen.add(o.type); out.push({ ...o, owner: id });
    }
    p.placed = out; return true;
  }
  allIn() { return this.players.every(p => p.placed); }
  useSecret(id, idx, mode, tid) {
    const p = this.P(id), t = this.P(tid), c = p && p.secrets[idx];
    if (!c || !t || p.usedSec === this.era) return false;
    p.usedSec = this.era; p.secrets.splice(idx, 1);
    if (mode === 'extort') { if (t.money >= c.v * 2) { t.money -= c.v * 2; p.money += c.v * 2; } else t.inf = Math.max(0, t.inf - c.v); }
    else if (mode === 'expose') { t.inf = Math.max(0, t.inf - c.v); this.addU(t, 1); p.inf++; }
    else if (mode === 'hush' && t.placed && t.placed.length) t.placed.splice(R(t.placed.length), 1);
    p.bonus++; this.say(`${p.name} ใช้การ์ดความลับ (${mode}) กับ ${t.name}`); return true;
  }

  resolve() {
    this.phase = 'resolve';
    for (const p of this.players) if (!p.courtDone) this.court(p.id, 'B');
    const all = this.players.flatMap((p, i) => (p.placed || []).map(o => ({ ...o, pri: PRI[o.type], seat: (i - this.sealIdx + this.n) % this.n })));
    all.sort((a, b) => a.pri - b.pri || a.seat - b.seat);
    const done = new Set();
    for (const o of all) {
      const p = this.P(o.owner); if (this.winner || done.has(o)) continue;
      if (p.deadEra === this.era) continue; // leader died before turn: orders cancelled
      this.exec(p, o, all, done);
    }
    if (!this.winner) this.endEra();
    return this.log;
  }
  exec(p, o, all, done) {
    const t = o.target ? this.P(o.target) : null;
    switch (o.type) {
      case 'guard': p.guard = true; break;
      case 'lobby': if (t) t.lobby += o.opt === 'oppose' ? -2 : 2; break;
      case 'realm':
        if (o.opt === 'recruit') { const k = Math.min(2, p.money, 4 - p.soldiers); p.money -= k; p.soldiers += k; }
        else { p.money += p.rank + 1; this.addU(p, this.flags.drought ? 2 : 1); }
        break;
      case 'intrigue': {
        if (!t || t === p) break;
        if (o.opt === 'tryst') {
          if (!p.wife || !t.wife) break;
          const r = this.contest(p, t, 'n', o.pay); if (r.s >= 2 && r.win) this.giveSecret(p, 3, t.id);
          else if (r.s === 0) this.giveSecret(t, 1, p.id);
        } else {
          const r = this.contest(p, t, 'n', o.pay);
          if (r.win) this.giveSecret(p, 1, t.id); else if (r.s === 0) this.giveSecret(t, 1, p.id);
        } break;
      }
      case 'kidnap': {
        if (!t || !t.heir || t.heirK) break;
        const r = this.contest(p, t, 'n', o.pay);
        if (r.win) { t.heirK = 3; this.addU(t, 1); this.say(`${p.name} ลักพาตัวทายาทของ ${t.name}`); }
        break;
      }
      case 'assassinate': {
        if (!t) break;
        const heir = o.opt === 'heir';
        if (!heir && t.deadEra === this.era) break; // cancelled, no fee
        if (heir && !t.heir) break;
        const cost = this.n === 3 ? 3 : 2; if (p.money < cost) break; p.money -= cost;
        const r = this.contest(p, t, 'n', o.pay);
        if (r.win) {
          this.say(`${p.name} ลอบสังหาร${heir ? 'ทายาท' : 'ผู้นำ'}ของ ${t.name} สำเร็จ`);
          if (heir) t.heir = t.spare, t.spare = null; else { this.die(t, 'kill'); p.bonus++; }
        } else if (r.s === 0) this.giveSecret(t, 2, p.id);
        break;
      }
      case 'family': this.family(p, o, all, done); break;
      case 'petition': this.petition(p, o); break;
    }
  }
  family(p, o, all, done) {
    if (o.opt === 'breed') {
      if (!p.wife) return;
      const cs = Array.from({ length: p.wife.fert }, () => this.drawHeir()).sort((a, b) => b.b.i + b.b.n + b.b.m - (a.b.i + a.b.n + a.b.m));
      if (!p.heir) p.heir = cs[0]; else if (!p.spare) p.spare = cs[0];
      if (p.wife.fert === 3 && !p.spare && cs[1]) p.spare = cs[1];
    } else if (o.opt === 'train') {
      const h = p.heir; const k = o.stat || 'i'; if (h && h.b[k] + h.t[k] < 5) h.t[k]++;
    } else {
      if (p.wife) return;
      let w = this.market[o.wife | 0]; if (!w) return;
      const rivals = all.filter(x => x !== o && !done.has(x) && x.type === 'family' && x.opt !== 'breed' && x.opt !== 'train' && x.wife === o.wife && this.P(x.owner).deadEra !== this.era && !this.P(x.owner).wife);
      let me = o, losers = [];
      if (rivals.length) {
        const rs = [o, ...rivals].map(x => ({ x, s: roll(stat(this.P(x.owner), 'i')) })).sort((a, b) => b.s - a.s);
        me = rs[0].x; losers = rs.slice(1).map(r => r.x);
        rs.forEach(r => done.add(r.x));
        for (const l of losers) { const q = this.P(l.owner), alt = this.market.findIndex((m, i) => m && i !== o.wife && m.price <= q.money); if (alt >= 0) this.takeWife(q, alt); }
      }
      this.takeWife(this.P(me.owner), o.wife | 0);
    }
  }
  takeWife(p, idx) {
    const w = this.market[idx]; if (!w || p.wife || p.money < w.price) return;
    p.money -= w.price; p.wife = w; this.market[idx] = null; this.market = this.market.filter(Boolean);
    if (w.fx === 'sol1') p.soldiers = Math.min(4, p.soldiers + 1);
    if (w.fx === 'sol2') p.soldiers = Math.min(4, p.soldiers + 2);
    if (w.fx === 'gold1') p.money++;
    if (w.fx === 'up') { if (p.rank < 4 && !this.seatsFull(p.rank + 1)) { p.rank++; p.inf += 2; } else p.inf += 2; }
    this.say(`${p.name} แต่งงานกับ ${w.name}`);
  }
  petition(p, o) {
    if (p.rank >= 5) return;
    const use = Math.min(2, p.soldiers), pay = Math.min(2, o.pay | 0, p.money);
    const full = this.seatsFull(p.rank + 1);
    const dice = stat(p, 'i') + use + Math.floor(stat(p, 'm') / 2) + p.bonus + p.lobby + pay;
    p.soldiers -= use; p.money -= pay;
    const need = TH[p.rank - 1] + (full ? 1 : 0), got = roll(dice);
    this.say(`${p.name} ขอเลื่อนยศ: ${got}/${need}`);
    if (got < need) return;
    if (full && p.rank + 1 < 5) { const v = this.players.filter(x => x.rank === p.rank + 1).sort((a, b) => a.inf - b.inf)[0]; if (v) v.rank--; }
    p.rank++; p.inf += 2;
    if (p.rank === 5) { this.winner = p; this.phase = 'over'; this.say(`${p.name} ขึ้นเป็นจักรพรรดิ!`); }
  }
  endEra() {
    for (const p of this.players) {
      p.guard = false;
      if (p.bot && p.unrest >= 3) p.bribe = Math.min(2, Math.max(0, p.money - 1));
      const b = Math.min(2, p.bribe, p.money, p.unrest - 0); p.money -= b; p.unrest = Math.max(0, p.unrest - b);
    }
    if (this.era >= 5) {
      const lv = [1, 1, 2][Math.min(this.era - 5, 2)] + (this.flags.plague ? 1 : 0);
      for (const p of this.players) if (R(6) + 1 <= lv + p.lead.age) { this.say(`${p.name}: ผู้นำตายเพราะชรา`); this.die(p, 'age'); }
    }
    this.sealIdx = (this.sealIdx + 1) % this.n;
    if (this.era >= 7) {
      this.winner = [...this.players].sort((a, b) => b.rank - a.rank || b.inf - a.inf || b.money - a.money)[0];
      this.phase = 'over'; this.say(`จบ 7 ยุค ผู้ชนะ: ${this.winner.name}`);
    } else this.phase = 'between';
  }

  // ---------- bots ----------
  botCourt(p) { const c = COURT[p.courtCard]; this.court(p.id, p.money >= 3 && R(2) ? 'A' : 'B'); }
  botSecrets(p) {
    if (!p.secrets.length) return;
    const c = p.secrets[0], t = this.P(c.about); if (!t || t === p) return;
    this.useSecret(p.id, 0, t.money >= c.v * 2 ? 'extort' : 'expose', t.id);
  }
  botPlan(p) {
    const others = this.players.filter(q => q !== p), slots = SLOTS[p.rank - 1], out = [];
    const top = [...others].sort((a, b) => b.rank - a.rank || b.inf - a.inf)[0];
    const payAmt = p.money >= 5 ? 2 : p.money >= 3 ? 1 : 0, cost = this.n === 3 ? 3 : 2;
    const can = {
      petition: () => p.rank < 5 && { type: 'petition', pay: payAmt },
      guard: () => ({ type: 'guard' }),
      lobby: () => top && top.rank >= 3 && { type: 'lobby', target: top.id, opt: 'oppose' },
      realm: () => (p.money < 3 || p.unrest <= 1) && p.unrest < 4 ? { type: 'realm', opt: 'tax' } : p.soldiers < 2 && p.money >= 3 ? { type: 'realm', opt: 'recruit' } : p.unrest < 4 && { type: 'realm', opt: 'tax' },
      family: () => {
        if (!p.wife) { const i = this.market.findIndex(m => m && m.price <= p.money); return i >= 0 && { type: 'family', opt: 'marry', wife: i }; }
        if (!p.heir) return { type: 'family', opt: 'breed' };
        return { type: 'family', opt: 'train', stat: 'i' };
      },
      intrigue: () => { const t = others[R(others.length)]; return t && (p.wife && t.wife && R(2) ? { type: 'intrigue', target: t.id, opt: 'tryst', pay: payAmt } : { type: 'intrigue', target: t.id, opt: 'spy' }); },
      kidnap: () => { const t = others.find(q => q.heir && !q.heirK); return t && { type: 'kidnap', target: t.id, pay: payAmt }; },
      assassinate: () => top && p.money >= cost + 1 && (top.rank >= p.rank) && { type: 'assassinate', target: top.id, opt: 'leader', pay: Math.max(0, Math.min(2, p.money - cost - 1)) },
    };
    for (const k of PREF[p.style]) { if (out.length >= slots) break; const o = can[k] && can[k](); if (o) out.push(o); }
    for (const k of ['petition', 'realm', 'guard']) { if (out.length >= slots) break; if (!out.some(o => o.type === k)) { const o = can[k](); if (o) out.push(o); } }
    while (out.length < slots) out.push({ type: 'decoy' });
    return out;
  }

  // public view for one player (hides others' secrets and tokens)
  view(pid) {
    return {
      era: this.era, phase: this.phase, assCost: this.n === 3 ? 3 : 2, usedSec: (this.P(pid) || {}).usedSec === this.era, winner: this.winner && this.winner.name, market: this.market, log: this.log.slice(-30),
      players: this.players.map(p => ({
        id: p.id, name: p.name, bot: p.bot, style: p.style, heirK: p.heirK, st: { i: stat(p, 'i'), n: stat(p, 'n'), m: stat(p, 'm') }, rank: p.rank, money: p.money, inf: p.inf, unrest: p.unrest, soldiers: p.id === pid ? p.soldiers : undefined,
        lead: p.lead, heirKnown: !!p.heir, wife: p.wife, seal: this.players.indexOf(p) === this.sealIdx,
        tokensPlaced: p.placed ? p.placed.length : 0, secretCount: p.secrets.length,
        ...(p.id === pid ? { heir: p.heir, spare: p.spare, secrets: p.secrets, placed: p.placed, court: p.courtDone ? null : COURT[p.courtCard].name } : {}),
      })),
    };
  }
}
module.exports = { Game, STYLES, COURT };
