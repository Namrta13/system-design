import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, ViewportPortal, useReactFlow, useStore, type Edge as FlowEdge, type Node } from '@xyflow/react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { Anchor, Edge, Flight, LoadBalancerSim, Tone } from '@/sim/load-balancer'
import { nodeTypes, type NodeData } from './nodes'

// Flow-space layout. Compact is for phone widths, where the server cards get narrower.
function layout(compact: boolean): Node<NodeData>[] {
  const sw = compact ? 130 : 200, gap = compact ? 12 : 20, total = sw * 3 + gap * 2
  const storeW = compact ? 300 : 440, lbW = compact ? 320 : 400
  const data = { compact, tick: 0 }
  return [
    { id: 'store', type: 'store', position: { x: (total - storeW) / 2, y: 0 }, data },
    { id: 'lb', type: 'lb', position: { x: (total - lbW) / 2, y: compact ? 360 : 340 }, data },
    ...(['a', 'b', 'c'] as const).map((k, i) => ({ id: 'srv-' + k, type: 'server', position: { x: i * (sw + gap), y: compact ? 640 : 610 }, data })),
  ]
}

type Live = Flight & { key: number; from: [Anchor, Edge]; done: () => void }
type NoteT = { key: number; anchor: Anchor; text: string; tone: Tone }

function anchorPoint(lookup: Map<string, { internals: { positionAbsolute: { x: number; y: number } }; measured: { width?: number; height?: number } }>, [id, edge]: [Anchor, Edge]) {
  const n = lookup.get(id)
  if (!n) return { x: 0, y: 0 }
  const { x, y } = n.internals.positionAbsolute
  return { x: x + (n.measured.width ?? 0) / 2, y: edge === 'top' ? y : y + (n.measured.height ?? 0) }
}

const toneClass: Record<Tone, string> = {
  you: 'bg-primary text-primary-foreground',
  warn: 'bg-warn text-white',
  bad: 'bg-bad text-white',
  info: 'bg-foreground text-background',
}

function Overlay({ sim }: { sim: LoadBalancerSim }) {
  const lookup = useStore(s => s.nodeLookup) as never
  const [flights, setFlights] = useState<Live[]>([])
  const [notes, setNotes] = useState<NoteT[]>([])
  const key = useRef(0)

  useEffect(() => {
    sim.ui.fly = (f, done) => setFlights(list => [...list, { ...f, key: ++key.current, done }])
    sim.ui.note = (anchor, text, tone) => {
      const k = ++key.current
      setNotes(list => [...list.filter(n => n.anchor !== anchor), { key: k, anchor, text, tone }])
      setTimeout(() => setNotes(list => list.filter(n => n.key !== k)), 2800)
    }
  }, [sim])

  return (
    <ViewportPortal>
      {flights.map(f => {
        const a = anchorPoint(lookup, f.from), b = anchorPoint(lookup, f.to)
        return (
          <motion.div
            key={f.key}
            className="pointer-events-none absolute left-0 top-0 z-10"
            initial={{ x: a.x, y: a.y }}
            animate={{ x: b.x, y: b.y }}
            transition={{ duration: f.ms / 1000, ease: 'easeInOut' }}
            onAnimationComplete={() => { setFlights(list => list.filter(x => x.key !== f.key)); f.done() }}
          >
            <span className={cn('block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full font-mono font-semibold shadow-lg',
              f.mine ? 'px-3 py-1.5 text-xs ring-4' : 'px-2 py-0.5 text-[10px]',
              f.kind === 'req' ? (f.mine ? 'bg-primary text-primary-foreground ring-primary-soft' : 'bg-code text-code-foreground')
                : f.kind === 'res' ? 'bg-good text-white ring-good-soft' : 'bg-bad text-white ring-bad-soft')}>
              {f.mine && <b>you · </b>}{f.label}
            </span>
          </motion.div>
        )
      })}
      <AnimatePresence>
        {notes.map(n => {
          const p = anchorPoint(lookup, [n.anchor, 'top'])
          return (
            <motion.div key={n.key} className="pointer-events-none absolute left-0 top-0 z-20" style={{ x: p.x, y: p.y }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div initial={{ y: 6 }} animate={{ y: 0 }}
                className={cn('relative w-max max-w-[240px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl px-3 py-1.5 text-center text-xs font-semibold leading-snug shadow-lg', toneClass[n.tone])}>
                {n.text}
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </ViewportPortal>
  )
}

function Flow({ sim, version }: { sim: LoadBalancerSim; version: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const { fitView } = useReactFlow()

  useEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => { setCompact(el.clientWidth < 600); requestAnimationFrame(() => fitView({ padding: 0.06, duration: 0 })) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])
  useEffect(() => { requestAnimationFrame(() => fitView({ padding: 0.06, duration: 0 })) }, [compact, fitView, sim.show.dial, sim.show.sandbox])

  const nodes = useMemo(() => layout(compact).map(n => ({ ...n, data: { ...n.data, tick: version } })), [compact, version])
  const edges: FlowEdge[] = useMemo(() => [
    { id: 'e-store', source: 'store', target: 'lb', label: 'HTTPS', animated: true, style: { stroke: 'var(--primary)', strokeOpacity: 0.5 }, labelStyle: { fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--muted-foreground)' }, labelBgStyle: { fill: 'var(--muted)' } },
    ...sim.servers.map(s => ({
      id: 'e-' + s.k, source: 'lb', target: 'srv-' + s.k, animated: !s.down && !s.out,
      style: { stroke: s.down ? 'var(--bad)' : s.out ? 'var(--border)' : 'var(--primary)', strokeOpacity: s.out ? 1 : 0.5, strokeDasharray: s.out ? '4 4' : undefined },
    })),
  ], [sim.servers, version]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} className={cn('relative w-full overflow-hidden rounded-3xl border bg-muted', compact ? 'h-[720px]' : 'h-[740px]')}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.06 }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        zoomOnScroll={false} preventScrolling={false} panOnScroll={false} zoomOnDoubleClick={false}
        minZoom={0.3} maxZoom={1.6} proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--grid)" />
        <Overlay sim={sim} />
      </ReactFlow>
    </div>
  )
}

export function Diagram(props: { sim: LoadBalancerSim; version: number }) {
  return <ReactFlowProvider><Flow {...props} /></ReactFlowProvider>
}
