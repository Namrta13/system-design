# System Design Lab

Learn system design by running small systems in your browser. Each page covers one concept and centers on a live simulation: you push traffic, take servers down and watch latency and throughput change. Then you learn how to defend the design in a review.

## Format

One concept per page, built around the visualization and played as a game:

- A live canvas simulation of the system
- Levels with concrete goals, such as finding the breaking point or surviving a crashed node
- Hearts, an XP bar and words you unlock along the way
- An "In a design review" box with the vocabulary engineers use

`src/concepts/load-balancer/` is the reference implementation of this format.

## Status

| Module | State |
| --- | --- |
| Load balancing | Concept page (current format) |
| Life of a request | Older lesson format, to be converted |
| Caching | Older lesson format, to be converted |
| Replication & sharding, message queues, URL shortener | Planned |

## Stack

- **Vite + React + TypeScript**, built as a multi-page site so URLs stay the same on GitHub Pages
- **React Flow** (`@xyflow/react`) for the live system diagram
- **shadcn/ui-style components** (Radix + Tailwind CSS v4) in `src/components/ui`
- **Motion** for requests moving between components

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/system-design/.

`npm run build` writes the site to `dist/`. A GitHub Actions workflow (`.github/workflows/pages.yml`) builds and deploys it on every push to `main`.

## Structure

```
index.html, src/home/              Homepage and module list
concepts/load-balancer.html        Entry for the load balancer concept
src/concepts/load-balancer/        Page, diagram and node components
src/sim/load-balancer.ts           Simulation and level rules (no React)
src/components/ui/                 Shared UI components
public/lessons/, public/assets/    Older lesson format, being phased out
```
