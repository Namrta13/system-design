import { createContext, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { ShoppingBag, Server as ServerIcon, Split } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { ADD_TO_CART, CHECKOUT, fmt, p95, type LoadBalancerSim, type Server } from '@/sim/load-balancer'

export const SimContext = createContext<LoadBalancerSim>(null!)
const useSim = () => useContext(SimContext)

export type NodeData = { compact: boolean; tick: number }

function NodeHeader({ icon, title, sub, badge }: { icon: React.ReactNode; title: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <CardHeader>
      <div className="flex min-w-0 items-start gap-2">
        {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <CardTitle className="whitespace-nowrap">{title}</CardTitle>
          {sub && <CardDescription>{sub}</CardDescription>}
        </div>
      </div>
      {badge}
    </CardHeader>
  )
}

export function StorefrontNode({ data }: NodeProps & { data: NodeData }) {
  const sim = useSim()
  return (
    <Card className={cn(data.compact ? 'w-[300px]' : 'w-[440px]')}>
      <NodeHeader icon={<ShoppingBag size={14} />} title="Storefront" sub="what the shopper sees" badge={<Badge variant="primary">live</Badge>} />
      <CardContent className={cn('grid gap-3', data.compact ? 'grid-cols-1' : 'grid-cols-[176px_minmax(0,1fr)]')}>
        <div className="grid gap-2 rounded-[18px] border bg-background p-2.5 nodrag" aria-label="Storefront on a shopper's phone">
          <div className="flex justify-between font-mono text-[10px] font-semibold text-muted-foreground">
            <span>shop.example</span><span className="text-primary">Cart · {sim.cart}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div aria-hidden className="size-10 shrink-0 rounded-[10px] bg-muted bg-[radial-gradient(circle_at_50%_38%,#ffcf70_0_20%,transparent_22%)]" />
            <div><b>Aurora Desk Lamp</b><span className="block text-muted-foreground">$129.00</span></div>
          </div>
          <div className={cn('grid gap-2', data.compact && 'grid-cols-2')}>
            <Button size="block" onClick={() => sim.tap(ADD_TO_CART)}>Add to cart</Button>
            <Button size="block" variant="accentOutline" onClick={() => sim.tap(CHECKOUT)}>Checkout</Button>
          </div>
          <div className={cn('min-h-[2.6em] text-[11px]', sim.phone.tone === 'ok' ? 'font-semibold text-good' : sim.phone.tone === 'bad' ? 'font-semibold text-bad' : 'text-muted-foreground')}>{sim.phone.text}</div>
        </div>
        {!data.compact && (
          <div className="grid min-w-0 content-start gap-2">
            {sim.show.dial && (
              <div className="grid gap-1 nodrag">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shoppers</span>
                <ToggleGroup type="single" value={String(sim.shoppers)} onValueChange={v => v && sim.setShoppers(+v)}>
                  <ToggleGroupItem value="0">Just you</ToggleGroupItem>
                  <ToggleGroupItem value="10">10</ToggleGroupItem>
                  <ToggleGroupItem value="100">100</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            <div className="grid gap-1 font-mono text-[11px]">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responses</span>
              {sim.log.length === 0 && <span className="text-muted-foreground">None yet</span>}
              {sim.log.map(l => (
                <motion.div key={l.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded-md px-1', l.mine && 'bg-primary-soft text-primary')}>
                  <span className="truncate">{l.mine ? 'you · ' : ''}{l.path}</span>
                  <b className={l.status === 200 ? 'text-good' : 'text-bad'}>{l.status}</b>
                  <span className="min-w-12 text-right text-muted-foreground tabular-nums">{l.status === 200 ? fmt(l.lat) : 'failed'}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

export function LoadBalancerNode({ data }: NodeProps & { data: NodeData }) {
  const sim = useSim()
  const next = sim.peekNext()
  const algoName = sim.algo === 'manual' ? 'you route' : sim.algo === 'rr' ? 'round robin' : 'least conn.'
  return (
    <Card className={cn(data.compact ? 'w-[320px]' : 'w-[400px]')}>
      <Handle type="target" position={Position.Top} />
      <NodeHeader icon={<Split size={14} />} title="Load balancer" sub="L7 · routing table" badge={<Badge variant={sim.algo === 'manual' ? 'muted' : 'primary'}>{algoName}</Badge>} />
      <CardContent className="grid gap-2">
        {sim.algo === 'manual' && (
          <div className="flex min-h-7 flex-wrap items-center gap-1.5">
            {sim.waiting.length === 0 ? <span className="text-[11px] text-muted-foreground">Requests wait here for you to pick a server</span> : sim.waiting.map(r => (
              <span key={r.id} className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold', r.mine ? 'bg-primary text-primary-foreground' : 'bg-code text-code-foreground')}>
                {r.mine ? 'you · ' : ''}{r.path}
                <span className="h-[3px] w-6 overflow-hidden rounded bg-white/25"><span className="block h-full bg-warn" style={{ width: `${Math.min(100, ((sim.clock - (r.tLb ?? sim.clock)) / 4200) * 100)}%` }} /></span>
              </span>
            ))}
            {sim.waiting.length > 0 && <span className="text-[11px] font-semibold text-primary">tap a server ↓</span>}
          </div>
        )}
        <table className="w-full border-collapse font-mono text-[11px] tabular-nums">
          <thead>
            <tr className="text-left font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-1 py-1 font-semibold">Server</th><th className="px-1 font-semibold">In flight</th><th className="px-1 font-semibold">p95</th><th className="px-1 font-semibold">Health</th>
            </tr>
          </thead>
          <tbody>
            {sim.servers.map(s => {
              const lp = p95(s.lat)
              const h = s.down ? (s.out ? 'removed' : sim.health ? 'failing…' : 'unknown') : s.slow ? 'slow' : 'ok'
              return (
                <tr key={s.k} className={cn('border-t transition-colors', s === next && 'bg-primary-soft', s.out && 'text-muted-foreground line-through')}>
                  <td className="px-1 py-1">{s.name}</td><td className="px-1">{sim.load(s)}</td><td className="px-1">{lp == null ? '–' : fmt(lp)}</td>
                  <td className={cn('px-1', h === 'slow' && 'text-warn', (h === 'removed' || h === 'failing…') && 'text-bad')}>{h}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

function Slot({ path, right, mine, queued, progress }: { path: string; right: string; mine: boolean; queued?: boolean; progress?: number }) {
  return (
    <div className={cn('relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 overflow-hidden rounded-md px-1.5 py-1 font-mono text-[10px]',
      queued ? 'border border-dashed text-muted-foreground' : 'bg-muted', mine && 'border-0 bg-primary-soft font-bold text-primary ring-1 ring-primary')}>
      <span className="truncate">{path}</span><span>{right}</span>
      {progress != null && <span className="absolute bottom-0 left-0 h-0.5 bg-primary" style={{ width: `${progress * 100}%` }} />}
    </div>
  )
}

export function ServerNode({ id, data }: NodeProps & { data: NodeData }) {
  const sim = useSim()
  const s = sim.servers.find(x => 'srv-' + x.k === id) as Server
  const pickable = sim.algo === 'manual' && sim.level === 0 && !s.down
  const mineIdx = s.queue.findIndex(r => r.mine)
  const status = s.down ? { t: 'down', v: 'bad' as const } : s.slow ? { t: 'slow disk', v: 'warn' as const } : s.busy ? { t: 'busy', v: 'good' as const } : { t: 'idle', v: 'muted' as const }
  return (
    <Card
      onClick={() => pickable && sim.routeTo(s.k)}
      className={cn(data.compact ? 'w-[130px]' : 'w-[200px]', 'transition-[transform,box-shadow,border-color]',
        pickable && 'cursor-pointer border-primary hover:-translate-y-0.5 active:scale-[.97]', s.slow && !s.down && 'border-warn', s.down && 'border-bad opacity-80')}
    >
      <Handle type="target" position={Position.Top} />
      <NodeHeader icon={data.compact ? null : <ServerIcon size={14} />} title={s.name} sub={data.compact ? undefined : 'app server'} badge={<Badge variant={status.v}>{status.t}</Badge>} />
      <CardContent className="grid gap-1">
        <div className="grid min-h-[68px] content-start gap-1">
          {s.busy && <Slot path={s.busy.req.path} right={s.busy.req.mine ? 'you' : '#' + s.busy.req.id} mine={s.busy.req.mine} progress={1 - s.busy.left / s.busy.total} />}
          {s.queue.slice(0, 2).map(r => <Slot key={r.id} path={r.path} right={r.mine ? 'you' : 'queued'} mine={r.mine} queued />)}
          {mineIdx >= 2 && <Slot path={s.queue[mineIdx].path} right={`you · #${mineIdx + 1}`} mine queued />}
          {s.queue.length > 2 && <span className="font-mono text-[10px] text-warn">+{s.queue.length - 2} more queued</span>}
          {!s.busy && !s.queue.length && <Slot path={s.down ? 'not responding' : 'waiting for work'} right="" mine={false} queued />}
        </div>
        {sim.show.killC && s.k === 'c' && !s.down && <Button size="xs" variant="destructive" className="nodrag mt-1 w-full" onClick={e => { e.stopPropagation(); sim.kill('c') }}>Kill app-c</Button>}
        {sim.show.sandbox && (
          <div className="nodrag mt-1 grid grid-cols-2 gap-1">
            <Button size="xs" variant="outline" onClick={() => sim.toggleSlow(s.k)}>{s.slow ? 'Fix disk' : 'Slow disk'}</Button>
            <Button size="xs" variant={s.down ? 'outline' : 'destructive'} onClick={() => (s.down ? sim.restart(s.k) : sim.kill(s.k))}>{s.down ? 'Restart' : 'Kill'}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const nodeTypes = { store: StorefrontNode, lb: LoadBalancerNode, server: ServerNode }
