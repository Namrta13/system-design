# System Design Lab

Learn system design by running small systems in your browser. Each page covers one concept and centers on a live simulation: you push traffic, take servers down and watch latency and throughput change. Then you learn how to defend the design in a review.

## Format

One concept per page, built around the visualization and played as a game:

- A live canvas simulation of the system
- Levels with concrete goals, such as finding the breaking point or surviving a crashed node
- Hearts, an XP bar and words you unlock along the way
- An "In a design review" box with the vocabulary engineers use

`concepts/load-balancer.html` is the reference implementation of this format.

## Status

| Module | State |
| --- | --- |
| Load balancing | Concept page (current format) |
| Life of a request | Older lesson format, to be converted |
| Caching | Older lesson format, to be converted |
| Replication & sharding, message queues, URL shortener | Planned |

## Run locally

It's a static site with no build step and no dependencies:

```bash
python3 -m http.server 8420
```

Then open http://localhost:8420.

## Structure

```
index.html            Homepage and module list
assets/style.css      Shared styles (light and dark)
concepts/             One page per concept, the current format
lessons/, assets/play.js   Older lesson format, being phased out
```
