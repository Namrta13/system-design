import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Heart, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { LoadBalancerSim, WORDS, fmt, type Algo } from '@/sim/load-balancer'
import { Diagram } from './Diagram'
import { SimContext } from './nodes'

type Toast = { key: number; text: string; xp?: number }

export function App() {
  const sim = useRef<LoadBalancerSim>(null!)
  if (!sim.current) sim.current = new LoadBalancerSim()
  const s = sim.current
  const version = useSyncExternalStore(s.subscribe, s.getVersion)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    let raf = 0, last = performance.now(), t = 0
    s.ui.toast = (text, xp) => { setToast({ key: Date.now(), text, xp }); clearTimeout(t); t = window.setTimeout(() => setToast(null), 2600) }
    const loop = (now: number) => { s.tick(now - last); last = now; raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    const onVis = () => { if (document.hidden) s.pause() }
    document.addEventListener('visibilitychange', onVis)
    ;(window as unknown as { __lab: LoadBalancerSim }).__lab = s
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis) }
  }, [s])

  const p = s.p95
  return (
    <SimContext.Provider value={s}>
      <div className="mx-auto max-w-[860px] pb-16" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
        {/* HUD */}
        <div className="sticky top-0 z-30 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <a href={import.meta.env.BASE_URL} className="text-[13px] font-semibold">System Design Lab</a>
            <span className="flex gap-0.5 text-bad" aria-label={`${s.hearts} lives`}>
              {[0, 1, 2].map(i => <Heart key={i} size={15} className={i < s.hearts ? 'fill-bad' : 'opacity-40'} />)}
            </span>
            <Progress value={s.progress * 100} className="flex-1" indicatorClassName="bg-gradient-to-r from-primary to-violet" />
            <span className="font-semibold text-violet tabular-nums">{s.xp} XP</span>
            {s.armed && !s.done && (
              <Button size="xs" variant="outline" onClick={() => (s.running ? s.pause() : s.resume())} aria-label={s.running ? 'Pause' : 'Resume'}>
                {s.running ? <Pause size={12} /> : <Play size={12} />}{s.running ? 'Pause' : 'Resume'}
              </Button>
            )}
          </div>
          {!s.done && (
            <div className="mt-1.5 flex items-center gap-2.5 text-[13px]">
              <span className="font-semibold whitespace-nowrap text-primary">{s.mission.label}</span>
              <span className={cn('min-w-0 flex-1 truncate', s.goal.done && 'font-semibold text-good')}>{s.goal.text}</span>
              <Progress value={s.goal.frac * 100} className="h-1.5 max-w-28" indicatorClassName="bg-good" />
            </div>
          )}
        </div>

        <header className="pt-6">
          <p className="font-semibold text-primary">Concept · Scaling</p>
          <h1 className="mt-1 mb-2 text-[clamp(38px,7vw,60px)] leading-[1.04] font-bold tracking-[-0.035em]">Load balancer</h1>
          <p className="max-w-[60ch] text-[19px] text-muted-foreground">Sits in front of a pool of servers and picks which one handles each request. The choice it makes decides your tail latency.</p>
        </header>

        {/* Mission */}
        <Card className="mt-6 border-0 bg-muted p-5 shadow-none">
          <div className="text-xs font-semibold tracking-[.08em] text-primary uppercase">{s.mission.label}</div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{s.mission.title}</h2>
          <p className="mt-1 max-w-[64ch] text-muted-foreground">{s.mission.text}</p>
          {!s.done && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[15px]">
              <span className={cn('grid size-5 place-items-center rounded-full border-2', s.goal.done ? 'border-good bg-good text-white' : 'border-border')}>{s.goal.done && <Check size={12} strokeWidth={3} />}</span>
              <span>{s.goal.text}</span>
              <Progress value={s.goal.frac * 100} className="h-1.5 max-w-44 min-w-20 flex-1" indicatorClassName="bg-good" />
            </div>
          )}
          {(s.show.algo || s.show.health || s.show.rps) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              {s.show.algo && (
                <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Algorithm
                  <ToggleGroup type="single" value={s.algo} onValueChange={v => v && s.setAlgo(v as Algo)}>
                    <ToggleGroupItem value="rr">Round robin</ToggleGroupItem>
                    <ToggleGroupItem value="lc">Least connections</ToggleGroupItem>
                  </ToggleGroup>
                </label>
              )}
              {s.show.health && (
                <label className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Health checks
                  <Switch checked={s.health} onCheckedChange={v => s.setHealth(v)} />
                </label>
              )}
              {s.show.rps && (
                <label className="flex items-center gap-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Traffic
                  <Slider min={1} max={8} step={0.5} value={[s.rps]} onValueChange={([v]) => s.setRps(v)} />
                  <span className="normal-case tracking-normal text-foreground tabular-nums">{s.rps} req/s</span>
                </label>
              )}
            </div>
          )}
        </Card>

        {/* Quiz */}
        <AnimatePresence>
          {s.quiz && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="mt-3 p-5">
                <h3 className="mb-3 text-lg font-semibold">{s.quiz.q}</h3>
                <div className="grid gap-2">
                  {s.quiz.opts.map(o => {
                    const right = s.quiz!.solved && o === s.quiz!.right, wrong = s.quiz!.wrong.includes(o)
                    return (
                      <motion.button key={o} onClick={() => s.answer(o)} animate={wrong ? { x: [0, -6, 6, 0] } : {}}
                        className={cn('cursor-pointer rounded-xl border-2 bg-card px-4 py-3 text-left text-[15px] font-medium transition-colors hover:border-primary',
                          right && 'border-good bg-good-soft', wrong && 'border-bad')}>
                        {o}
                      </motion.button>
                    )
                  })}
                </div>
                {s.quiz.solved && <p className="mt-3 text-muted-foreground">{s.quiz.why}</p>}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3"><Diagram sim={s} version={version} /></div>

        {/* Readout */}
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border bg-border gap-px sm:grid-cols-4">
          {[
            ['p95 latency', p == null ? '–' : fmt(p), false],
            ['Served', String(s.served), false],
            ['Errors (5xx)', String(s.errors), s.errors > 0],
            ['Requests / s', s.rpsNow.toFixed(1), false],
          ].map(([label, value, hot]) => (
            <div key={label as string} className="bg-background px-4 py-2.5 text-xs text-muted-foreground">
              <b className={cn('block text-[22px] font-semibold tracking-tight text-foreground tabular-nums', hot && 'text-bad')}>{value}</b>{label}
            </div>
          ))}
        </div>

        {s.done && (
          <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-3xl bg-gradient-to-br from-primary-soft to-violet/15 p-8 text-center">
            <b className="block text-4xl font-bold tracking-tight">Concept cleared</b>
            <span className="text-muted-foreground">{s.xp} XP · {s.words.size} of {WORDS.length} words · {s.served} requests served</span>
            <div className="mt-4"><Button onClick={() => s.reset()}>Play again</Button></div>
          </motion.div>
        )}

        <section className="mt-8">
          <h3 className="mb-2 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">Words you unlock</h3>
          <div className="flex flex-wrap gap-2">
            {WORDS.map(w => (
              <span key={w} className={cn('rounded-full px-3 py-1.5 text-sm transition-all duration-500', s.words.has(w) ? 'bg-primary-soft font-semibold text-primary' : 'bg-muted text-muted-foreground')}>{w}</span>
            ))}
          </div>
        </section>

        <Card className="mt-8 bg-gradient-to-br from-primary-soft to-transparent p-6 shadow-none">
          <h3 className="mb-1 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">In a design review</h3>
          <p className="max-w-[64ch] text-[17px]">“App servers are stateless behind an L7 load balancer. It routes by least connections, so one slow node can't build a queue, and active health checks pull a dead node out of rotation within a couple of seconds.”</p>
        </Card>
      </div>

      {/* Paused overlay */}
      <AnimatePresence>
        {s.paused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 grid place-items-center bg-background/60 backdrop-blur-sm">
            <Button onClick={() => s.resume()}><Play size={14} />Resume</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.key} initial={{ y: 80, x: '-50%' }} animate={{ y: 0, x: '-50%' }} exit={{ y: 80, x: '-50%', opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100%-32px)] rounded-2xl bg-foreground px-5 py-3 text-[15px] font-semibold text-background shadow-xl" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            {toast.text}{toast.xp ? <span className="ml-2 text-violet">+{toast.xp} XP</span> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </SimContext.Provider>
  )
}
