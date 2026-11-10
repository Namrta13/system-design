// Simulation and game rules for the load balancer concept. No React in here:
// the UI subscribes to changes and supplies the animation hooks in `ui`.

export type Algo = 'manual' | 'rr' | 'lc'
export type Tone = 'you' | 'warn' | 'bad' | 'info'
export type Anchor = 'store' | 'lb' | 'srv-a' | 'srv-b' | 'srv-c'
export type Edge = 'top' | 'bottom'

export interface RouteDef { m: string; p: string; body?: object; res: object }
export interface Req {
  id: number; def: RouteDef; path: string; mine: boolean
  t0: number; tLb?: number; tQ?: number; tStart?: number; tEnd?: number; status?: number; server?: string
}
export interface Server {
  k: 'a' | 'b' | 'c'; name: string; slow: boolean; down: boolean; out: boolean; downAt: number; warned: boolean
  busy: { req: Req; left: number; total: number } | null; queue: Req[]; lat: number[]
}
export interface Flight { id: number; label: string; kind: 'req' | 'res' | 'fail'; mine: boolean; from: [Anchor, Edge]; to: [Anchor, Edge]; ms: number }
export interface Quiz { q: string; opts: string[]; right: string; why: string; wrong: string[]; solved: boolean }

export const ROUTES: RouteDef[] = [
  { m: 'GET', p: '/cart/812', res: { cart_id: 812, items: 2 } },
  { m: 'GET', p: '/products/42', res: { id: 42, in_stock: 7 } },
  { m: 'POST', p: '/checkout', body: { cart_id: 812 }, res: { order_id: 1049 } },
  { m: 'GET', p: '/search?q=lamp', res: { results: 14 } },
  { m: 'GET', p: '/orders/1048', res: { status: 'shipped' } },
  { m: 'PUT', p: '/cart/812', body: { qty: 2 }, res: { items: 3 } },
]
export const ADD_TO_CART: RouteDef = { m: 'POST', p: '/cart/812/items', body: { product_id: 42, qty: 1 }, res: { items: 3 } }
export const CHECKOUT = ROUTES[2]
export const WORDS = ['Routing', 'Round robin', 'Tail latency', 'Least connections', 'Health check', 'Failover']

const BASE_MS = 420, SLOW_MS = 2400, TIMEOUT = 4200
const SHOP_GAP: Record<number, number> = { 10: 900, 100: 300 }
export const LEVEL_COUNT = 4

export const fmt = (ms: number) => (ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s')
export const p95 = (list: number[]) => {
  if (!list.length) return null
  const a = [...list].sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))]
}

export interface UiHooks {
  fly(f: Flight, done: () => void): void
  note(anchor: Anchor, text: string, tone: Tone): void
  toast(text: string, xp?: number): void
}

export class LoadBalancerSim {
  ui: UiHooks = {
    fly: (f, done) => setTimeout(done, f.ms),
    note: () => {},
    toast: () => {},
  }
  private listeners = new Set<() => void>()
  version = 0

  // game state
  level = -1
  hearts = 3
  xp = 0
  words = new Set<string>()
  algo: Algo = 'lc'
  health = false
  servers: Server[] = []
  waiting: Req[] = []
  rr = 0
  seq = 1000
  served = 0
  errors = 0
  recent: { lat: number; t0: number }[] = []
  arrivals: number[] = []
  since = 0
  clock = 0
  nextArrive = 0
  running = true
  paused = false
  armed = false
  warm = true
  warmStage = 0
  warmCount = 0
  shoppers = 0
  sandbox = false
  rps = 3
  cart = 2
  log: { id: number; path: string; status: number; lat: number; mine: boolean }[] = []
  streak = 0
  killed = false
  l4err = 0
  stable = 0
  cleared = new Set<number>()
  watch = false
  done = false
  mission = { label: '', title: '', text: '' }
  goal = { text: '', frac: 0, done: false }
  phone = { text: 'Tap a button to send a request.', tone: '' as '' | 'ok' | 'bad' }
  quiz: Quiz | null = null
  show = { algo: false, health: false, rps: false, dial: false, killC: false, sandbox: false }

  constructor() { this.reset() }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getVersion = () => this.version
  emit() { this.version++; this.listeners.forEach(f => f()) }

  reset() {
    Object.assign(this, {
      level: -1, hearts: 3, xp: 0, words: new Set(), algo: 'lc', health: false, waiting: [], rr: 0, seq: 1000,
      served: 0, errors: 0, recent: [], arrivals: [], since: 0, clock: 0, nextArrive: 0, running: true, paused: false,
      armed: false, sandbox: false, rps: 3, cart: 2, log: [], streak: 0, killed: false, l4err: 0, stable: 0, cleared: new Set(),
      done: false, quiz: null, show: { algo: false, health: false, rps: false, dial: false, killC: false, sandbox: false },
      phone: { text: 'Tap a button to send a request.', tone: '' },
    })
    this.servers = (['a', 'b', 'c'] as const).map(k => ({ k, name: 'app-' + k, slow: false, down: false, out: false, downAt: 0, warned: false, busy: null, queue: [], lat: [] }))
    this.startWarm()
    this.emit()
  }

  // ---------- timing ----------
  get gap() {
    const L = LEVELS[this.level]
    if ((L || this.sandbox) && !this.armed) return 0
    return L ? L.gap : this.sandbox ? 1000 / this.rps : this.shoppers ? SHOP_GAP[this.shoppers] : 0
  }
  // Your own requests fly in slow motion; shift t0 so the extra animation time doesn't count as latency.
  private dur(r: Req, ms: number) {
    if (!r.mine) return ms
    const f = this.gap && this.gap < 500 ? 1.8 : 3
    if (!r.status && this.running) r.t0 += ms * (f - 1)
    return ms * f
  }
  load = (s: Server) => s.queue.length + (s.busy ? 1 : 0)

  // ---------- traffic ----------
  private arrive(def?: RouteDef, mine = false) {
    def = def || ROUTES[Math.floor(Math.random() * ROUTES.length)]
    const req: Req = { id: ++this.seq, def, path: def.m + ' ' + def.p, t0: this.clock, mine }
    this.arrivals.push(this.clock)
    this.ui.fly({ id: req.id, label: req.path, kind: 'req', mine, from: ['store', 'bottom'], to: ['lb', 'top'], ms: this.dur(req, 420) }, () => {
      req.tLb = this.clock
      if (mine) this.ui.note('lb', this.algo === 'manual' ? 'Your request is waiting. Tap a server for it.' : 'Your request reached the load balancer. It is picking a server.', 'you')
      if (this.algo === 'manual') { this.waiting.push(req); this.emit() } else this.dispatch(req)
    })
  }
  private pick(): Server | null {
    const pool = this.servers.filter(s => !s.out)
    if (!pool.length) return null
    if (this.algo === 'rr') return pool[this.rr++ % pool.length]
    return pool.reduce((m, s) => (this.load(s) < this.load(m) ? s : m), pool[0])
  }
  peekNext(): Server | null {
    if (this.algo === 'manual') return null
    const pool = this.servers.filter(s => !s.out)
    if (!pool.length) return null
    return this.algo === 'rr' ? pool[this.rr % pool.length] : pool.reduce((m, s) => (this.load(s) < this.load(m) ? s : m), pool[0])
  }
  private dispatch(req: Req) { const s = this.pick(); if (!s) this.finish(req, null, 503); else this.send(req, s) }
  private send(req: Req, s: Server) {
    req.server = s.name
    this.ui.fly({ id: req.id, label: req.path, kind: 'req', mine: req.mine, from: ['lb', 'bottom'], to: [('srv-' + s.k) as Anchor, 'top'], ms: this.dur(req, 360) }, () => {
      if (s.down) { this.finish(req, s, 503); return }
      req.tQ = this.clock; s.queue.push(req)
      if (req.mine) this.ui.note(('srv-' + s.k) as Anchor, s.busy || s.queue.length > 1 ? `Your request is #${this.load(s)} in line. ${s.name} is busy.` : `${s.name} starts on your request.`, 'you')
      this.emit()
    })
  }
  private finish(req: Req, s: Server | null, status: number) {
    const lat = Math.round(this.clock - req.t0)
    req.status = status; req.tEnd = this.clock
    const label = status === 200 ? `200 · ${lat}ms` : String(status)
    const kind = status === 200 ? 'res' : 'fail'
    const back = () => this.ui.fly({ id: req.id, label, kind, mine: req.mine, from: ['lb', 'top'], to: ['store', 'bottom'], ms: this.dur(req, 300) }, () => {
      this.log = [{ id: req.id, path: req.path, status, lat, mine: req.mine }, ...this.log].slice(0, 3)
      if (req.mine) this.phoneResult(req, status, lat); else this.emit()
    })
    if (s) this.ui.fly({ id: req.id, label, kind, mine: req.mine, from: [('srv-' + s.k) as Anchor, 'top'], to: ['lb', 'bottom'], ms: this.dur(req, 260) }, back)
    else back()
    if (status === 200) {
      this.served++; this.recent.push({ lat, t0: req.t0 }); if (this.recent.length > 40) this.recent.shift()
      if (s) { s.lat.push(lat); if (s.lat.length > 12) s.lat.shift() }
      this.streak++
    } else {
      this.errors++; this.streak = 0
      if (this.level === 3 && this.killed && !this.servers[2].out && ++this.l4err % 4 === 0) this.loseHeart('4 failed checkouts. Health checks would have caught that.')
    }
    LEVELS[this.level]?.onResult?.(this, status)
  }
  private phoneResult(req: Req, status: number, lat: number) {
    if (status === 200) {
      this.phone = { text: `${req.def === ADD_TO_CART ? 'Added to cart' : 'Order placed'} · ${fmt(lat)}`, tone: 'ok' }
      if (req.def === ADD_TO_CART) this.cart++
    } else this.phone = { text: `Error ${status}. The shopper sees a failed page.`, tone: 'bad' }
    this.warmResult(status)
    this.emit()
  }

  // ---------- player actions ----------
  tap(def: RouteDef) {
    if (!this.running) { this.ui.toast('Press resume first'); return }
    if (!this.armed) { this.armed = true; this.nextArrive = this.clock + 600 }
    this.arrive(def, true)
    this.phone = { text: `Sending ${def.m} ${def.p}…`, tone: '' }
    this.emit()
  }
  routeTo(k: Server['k']) {
    if (this.algo !== 'manual' || this.level !== 0) return
    const s = this.servers.find(x => x.k === k)!
    if (!this.waiting.length) { this.ui.toast('No request is waiting yet'); return }
    if (s.down) return
    this.send(this.waiting.shift()!, s); this.emit()
  }
  setAlgo(a: Algo) {
    this.algo = a; this.since = this.clock; this.stable = 0
    if (a !== 'manual') this.waiting.splice(0).forEach(r => this.dispatch(r))
    this.emit()
  }
  setHealth(on: boolean) {
    this.health = on
    if (on) this.servers.forEach(s => { if (s.down) s.downAt = Math.max(s.downAt, this.clock) })
    this.emit()
  }
  kill(k: Server['k']) {
    const s = this.servers.find(x => x.k === k)!
    s.down = true; s.downAt = this.clock
    if (this.level === 3) { this.killed = true; this.streak = 0; this.show.killC = false }
    this.ui.note(('srv-' + k) as Anchor, this.health ? `${s.name} is down. Health checks will catch it.` : `${s.name} is down, but the load balancer doesn't know yet.`, 'bad')
    this.emit()
  }
  restart(k: Server['k']) { const s = this.servers.find(x => x.k === k)!; s.down = s.out = false; this.emit() }
  toggleSlow(k: Server['k']) { const s = this.servers.find(x => x.k === k)!; s.slow = !s.slow; this.emit() }
  setShoppers(n: number) { this.shoppers = n; this.emit() }
  setRps(n: number) { this.rps = n; this.emit() }
  pause() { if (this.running) { this.running = false; this.paused = true; this.emit() } }
  resume() { this.running = true; this.paused = false; this.emit() }
  answer(opt: string) {
    const q = this.quiz; if (!q || q.solved) return
    if (opt === q.right) { q.solved = true; this.emit(); setTimeout(() => { this.quiz = null; LEVELS[this.level]?.onQuiz?.(this); this.emit() }, 2600) }
    else { q.wrong.push(opt); this.loseHeart('Not that one. Look at what round robin counts.'); this.emit() }
  }

  // ---------- game ----------
  award(xp: number, word?: string) {
    this.xp += xp; if (word) this.words.add(word)
    this.ui.toast(word ? `Unlocked: ${word}` : 'Nice', xp)
  }
  loseHeart(why: string) {
    this.hearts--; this.ui.toast(why)
    if (this.hearts <= 0) setTimeout(() => { this.hearts = 3; this.ui.toast('Out of hearts. Level restarted.'); this.startLevel(this.level) }, 900)
  }
  setGoal(text: string, frac: number, done = false) { this.goal = { text, frac: Math.min(1, frac), done } }
  get progress() { return this.done ? 1 : Math.max(0, this.level) / LEVEL_COUNT }

  startWarm() {
    this.level = -1; this.warm = true; this.warmStage = 0; this.warmCount = 0; this.algo = 'lc'; this.shoppers = 0
    this.running = true; this.armed = true
    this.mission = { label: 'Warm-up', title: 'Send a request', text: 'The phone in the diagram is a storefront. Tap Add to cart and follow your blue request: to the load balancer, to a server, and back with the response.' }
    this.setGoal('Send 3 requests and watch them come back', 0)
  }
  private warmResult(status: number) {
    if (!this.warm || status !== 200) return
    if (this.warmStage === 0) {
      this.warmCount++; this.setGoal('Send 3 requests and watch them come back', this.warmCount / 3, this.warmCount >= 3)
      if (this.warmCount >= 3) {
        this.warmStage = 1; this.warmCount = 0; this.award(10); this.show.dial = true
        this.mission = { label: 'Warm-up', title: 'Add other shoppers', text: 'A real shop has more than one shopper. Set the dial to 10 shoppers and keep tapping. Your requests stay blue, so you can follow them in the crowd.' }
        this.setGoal('Send 3 requests with 10 or more shoppers', 0)
      }
    } else if (this.warmStage === 1 && this.shoppers >= 10) {
      this.warmCount++; this.setGoal('Send 3 requests with 10 or more shoppers', this.warmCount / 3, this.warmCount >= 3)
      if (this.warmCount >= 3) { this.warmStage = 2; this.award(10); setTimeout(() => { this.shoppers = 0; this.show.dial = false; this.startLevel(0) }, 1400) }
    }
  }
  startLevel(i: number) {
    const L = LEVELS[i]
    this.level = i; this.warm = false; this.armed = false; this.running = true; this.paused = false; this.quiz = null
    this.mission = { label: `Level ${i + 1} of ${LEVEL_COUNT}`, title: L.title, text: L.text }
    this.phone = { text: `Tap Add to cart to start level ${i + 1}.`, tone: '' }
    L.start(this); this.emit()
  }
  nextLevel() { setTimeout(() => (this.level + 1 < LEVEL_COUNT ? this.startLevel(this.level + 1) : this.finishGame()), 1400) }
  finishGame() {
    this.done = true; this.level = LEVEL_COUNT; this.sandbox = true; this.armed = false; this.rps = 3
    this.mission = { label: 'Free play', title: 'Break it yourself', text: 'Every control is unlocked. Change the traffic, slow down or kill any server, and switch algorithms to see how the system responds.' }
    this.show = { algo: true, health: true, rps: true, dial: false, killC: false, sandbox: true }
    this.phone = { text: 'Tap the phone to start free play.', tone: '' }
    this.emit()
  }

  // ---------- clock ----------
  private lastEmit = 0
  tick(dtReal: number) {
    const dt = this.running ? Math.min(100, dtReal) : 0
    this.clock += dt
    const gap = this.gap
    if (gap && this.running && this.clock >= this.nextArrive) { this.arrive(); this.nextArrive = this.clock + gap * (0.7 + Math.random() * 0.6) }
    for (const s of this.servers) {
      // Health checks take ~1.5 s to notice a dead server and pull it out of rotation.
      if (this.health && s.down && !s.out && this.clock - s.downAt > 1500) { s.out = true; this.ui.note(('srv-' + s.k) as Anchor, 'Health check failed. Removed from rotation.', 'bad') }
      if (s.down) { s.queue.splice(0).forEach(r => this.finish(r, s, 503)); if (s.busy) { this.finish(s.busy.req, s, 503); s.busy = null } continue }
      if (!s.busy && s.queue.length) {
        const req = s.queue.shift()!; req.tStart = this.clock
        if (req.mine && req.tQ != null && req.tStart - req.tQ > 200) this.ui.note(('srv-' + s.k) as Anchor, `Your turn. ${s.name} is working on it.`, 'you')
        const d = (s.slow ? SLOW_MS : BASE_MS) * (0.75 + Math.random() * 0.5)
        s.busy = { req, left: d, total: d }
      }
      if (s.busy) { s.busy.left -= dt; if (s.busy.left <= 0) { const r = s.busy.req; s.busy = null; this.finish(r, s, 200) } }
      if (s.queue.length >= 5 && !s.warned) { s.warned = true; this.ui.note(('srv-' + s.k) as Anchor, `${s.queue.length} requests waiting on ${s.name}`, 'warn') }
      if (s.queue.length < 2) s.warned = false
    }
    if (this.algo === 'manual') {
      for (let i = this.waiting.length - 1; i >= 0; i--) {
        if (this.clock - (this.waiting[i].tLb ?? 0) > TIMEOUT) { const r = this.waiting.splice(i, 1)[0]; this.finish(r, null, 504); this.loseHeart('A request timed out while waiting at the load balancer') }
      }
    }
    LEVELS[this.level]?.check?.(this, dt)
    this.arrivals = this.arrivals.filter(t => this.clock - t < 5000)
    const now = performance.now()
    if (now - this.lastEmit > 90) { this.lastEmit = now; this.emit() }
  }
  get p95() { return p95(this.recent.filter(r => r.t0 >= this.since).map(r => r.lat)) }
  get rpsNow() { return this.arrivals.length / 5 }
}

interface Level {
  title: string; text: string; gap: number
  start(s: LoadBalancerSim): void
  check?(s: LoadBalancerSim, dt: number): void
  onResult?(s: LoadBalancerSim, status: number): void
  onQuiz?(s: LoadBalancerSim): void
}

const LEVELS: Level[] = [
  {
    title: 'Be the load balancer', gap: 1300,
    text: 'Requests now arrive on their own. Tap a server to send the oldest waiting request there. If a request waits more than four seconds, it times out and you lose a heart.',
    start(s) { s.algo = 'manual'; s.warmCount = 0; s.setGoal('Route 8 requests', 0) },
    onResult(s, st) {
      if (st !== 200 || s.warmCount >= 8) return
      s.warmCount++; s.setGoal('Route 8 requests', s.warmCount / 8, s.warmCount >= 8)
      if (s.warmCount === 8) { s.award(20, 'Routing'); s.nextLevel() }
    },
  },
  {
    title: 'Automate it with round robin', gap: 330,
    text: 'Traffic is now 3 requests a second, too fast to route by hand. Round robin sends requests to app-a, app-b, app-c, app-a, and so on. Watch the routing table.',
    start(s) {
      s.setAlgo('rr'); s.watch = false; s.cleared.delete(1); s.servers[1].slow = false
      s.setGoal('Predict what happens', 0)
      s.quiz = {
        q: 'app-b’s disk is about to slow down to 2.4 s per request. With round robin, what happens next?',
        opts: ['Round robin notices and sends app-b less traffic', 'app-b keeps getting every third request and builds a queue', 'Nothing visible, because the average latency stays fine'],
        right: 'app-b keeps getting every third request and builds a queue',
        why: 'Round robin only counts turns. It has no idea app-b is slow, so app-b keeps getting a third of the traffic and can’t keep up. Tap the phone and watch its queue.',
        wrong: [], solved: false,
      }
    },
    onQuiz(s) { s.servers[1].slow = true; s.watch = true; s.ui.toast('app-b’s disk just got slow'); s.words.add('Round robin'); s.award(10, 'Round robin'); s.setGoal('Watch app-b’s queue reach 5', 0) },
    check(s) {
      if (!s.watch) return
      const q = s.servers[1].queue.length
      s.setGoal('Watch app-b’s queue reach 5', q / 5, q >= 5)
      if (q >= 5 && !s.cleared.has(1)) { s.cleared.add(1); s.award(10, 'Tail latency'); s.nextLevel() }
    },
  },
  {
    title: 'Route around the slow server', gap: 330,
    text: 'Switch the algorithm to least connections. The balancer then sends each request to the server with the fewest in flight, so app-b only gets new work once it has finished what it has. Requests already queued on app-b still have to finish, but no new queue should build anywhere.',
    start(s) { s.show.algo = true; s.stable = 0; s.cleared.delete(2); s.setGoal('No new queue longer than 1 for 8 s', 0) },
    check(s, dt) {
      const backlog = Math.max(...s.servers.map(x => x.queue.filter(r => (r.tLb ?? 0) >= s.since).length))
      if (s.algo === 'lc' && s.armed && backlog <= 1) s.stable += dt; else s.stable = 0
      s.setGoal('No new queue longer than 1 for 8 s', s.stable / 8000, s.stable >= 8000)
      if (s.stable >= 8000 && !s.cleared.has(2)) { s.cleared.add(2); s.award(20, 'Least connections'); s.nextLevel() }
    },
  },
  {
    title: 'Survive a crash', gap: 330,
    text: 'Kill app-c and watch what least connections does with a server that fails instantly. Every 4 failed checkouts costs a heart, so turn on health checks fast.',
    start(s) {
      const c = s.servers[2]; c.down = c.out = false; c.queue = []; c.busy = null
      s.health = false; s.l4err = 0; s.killed = false; s.streak = 0; s.cleared.delete(3)
      s.show.killC = true; s.show.health = true; s.setGoal('Kill app-c', 0)
    },
    check(s) {
      if (!s.killed) return
      const n = s.health && s.servers[2].out ? s.streak : 0
      s.setGoal('Serve 15 requests in a row with no errors', n / 15, n >= 15)
      if (n >= 15 && !s.cleared.has(3)) { s.cleared.add(3); s.words.add('Failover'); s.award(20, 'Health check'); s.nextLevel() }
    },
  },
]
