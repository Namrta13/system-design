import { ArrowRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const base = import.meta.env.BASE_URL

const MODULES = [
  { id: '01 · Foundations', title: 'Life of a request', text: 'DNS resolution, the request, server work and the response, one step at a time.', href: 'lessons/01-opening-a-website.html' },
  { id: '02 · Scaling', title: 'Load balancing', text: 'Send real requests through a load balancer, find the slow server, then survive a crash.', href: 'concepts/load-balancer.html', fresh: true },
  { id: '03 · Caching', title: 'Caching', text: 'Cache-aside reads, hit ratio, latency, and the staleness you trade for them.', href: 'lessons/03-cache.html' },
  { id: '04 · Data', title: 'Replication & sharding', text: 'Read replicas, replication lag and partitioning.' },
  { id: '05 · Async', title: 'Message queues', text: 'Absorb bursts, retry safely, stay idempotent.' },
  { id: '06 · Case study', title: 'Design a URL shortener', text: 'Everything together, end to end.' },
]

export function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-[980px] items-center justify-between px-5 text-[13px]">
          <a href={base} className="text-[15px] font-semibold">System Design Lab</a>
          <a href="#modules" className="opacity-80 hover:opacity-100">Modules</a>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-[980px] px-5 pt-24 pb-10 text-center">
          <p className="font-semibold text-primary">For engineers who build things</p>
          <h1 className="mt-2 mb-4 text-[clamp(40px,7vw,72px)] leading-[1.05] font-bold tracking-[-0.035em]">
            Architecture you can<br /><span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">see running.</span>
          </h1>
          <p className="mx-auto mb-7 max-w-[720px] text-[clamp(19px,2.4vw,24px)] leading-snug font-medium text-muted-foreground">
            Interactive models of real systems. Push traffic, take servers down, warm caches, and watch latency and throughput respond, then learn how to defend the design.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild><a href={base + 'concepts/load-balancer.html'}>Try the load balancer</a></Button>
            <Button asChild variant="accentOutline"><a href="#modules">See all modules</a></Button>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[['Live', 'Simulations, not diagrams'], ['0 setup', 'Runs in your browser'], ['Interview-ready', 'Every module ends with the vocabulary']].map(([b, t]) => (
              <div key={b}><b className="block text-[44px] tracking-[-0.03em]">{b}</b><span className="text-[15px] text-muted-foreground">{t}</span></div>
            ))}
          </div>
        </section>
        <section className="mt-16 bg-muted pt-2 pb-22">
          <div className="mx-auto max-w-[980px] px-5">
            <h2 id="modules" className="mt-18 mb-3 text-[clamp(28px,4.5vw,44px)] leading-tight font-bold tracking-[-0.03em]">
              Modules.<br /><span className="text-muted-foreground">Each one builds on the last.</span>
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map(m => {
                const inner = (
                  <Card className={cn('h-full border-0 p-7 shadow-none transition-[transform,box-shadow] duration-300', m.href ? 'hover:scale-[1.015] hover:shadow-xl' : 'opacity-55')}>
                    <span className="text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">{m.id}</span>
                    <h3 className="mt-2 mb-2 text-[26px] font-semibold tracking-tight">{m.title}</h3>
                    <p className="text-muted-foreground">{m.text}</p>
                    <span className={cn('mt-5 inline-flex items-center gap-1 text-[15px]', m.href ? 'text-primary' : 'text-muted-foreground')}>
                      {m.href ? <>{m.fresh ? 'Play the new version' : 'Open module'}<ArrowRight size={15} /></> : <><Lock size={13} />Coming soon</>}
                    </span>
                  </Card>
                )
                return m.href ? <a key={m.title} href={base + m.href}>{inner}</a> : <div key={m.title}>{inner}</div>
              })}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-muted px-5 py-6 text-xs text-muted-foreground"><div className="mx-auto max-w-[980px]">System Design Lab</div></footer>
    </>
  )
}
