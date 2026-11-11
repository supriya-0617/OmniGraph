import React, { useEffect, useRef } from 'react';

/**
 * Illustrative, generative network for the landing hero (not real data).
 * A light spring simulation with one embedded "coordinated" cluster, a radar
 * sweep, cursor repulsion and hover neighbourhood highlighting.
 */

type Kind = 'user' | 'post' | 'tag' | 'ip' | 'bot';
interface Node { x: number; y: number; vx: number; vy: number; r: number; kind: Kind; cluster: boolean; phase: number }
interface Link { a: number; b: number; cluster: boolean }

// Canvas cannot read CSS variables: these mirror the entity tokens in index.css.
const COLORS: Record<Kind, string> = {
  user: '#84977B', // sage
  post: '#C5A16B', // brass
  tag: '#9B8AB4',  // lavender
  ip: '#8295A6',   // steel
  bot: '#B85C58',  // crimson (coordinated)
};
const RGB = { olive: '166, 161, 122', crimson: '184, 92, 88', muted: '166, 170, 157' } as const;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNetwork(width: number, height: number) {
  const rand = mulberry32(554);
  const nodes: Node[] = [];
  const links: Link[] = [];
  const add = (kind: Kind, x: number, y: number, cluster = false) => {
    nodes.push({ x, y, vx: 0, vy: 0, r: kind === 'ip' ? 5 : kind === 'tag' ? 4.2 : kind === 'post' ? 3.4 : 4, kind, cluster, phase: rand() * Math.PI * 2 });
    return nodes.length - 1;
  };
  // organic background
  const hubs = Array.from({ length: 7 }, () => add('tag', width * (0.12 + rand() * 0.76), height * (0.12 + rand() * 0.76)));
  for (let i = 0; i < 38; i += 1) {
    const hub = hubs[Math.floor(rand() * hubs.length)];
    const kind: Kind = rand() < 0.55 ? 'user' : 'post';
    const n = add(kind, nodes[hub].x + (rand() - 0.5) * 160, nodes[hub].y + (rand() - 0.5) * 160);
    links.push({ a: n, b: hub, cluster: false });
    if (rand() < 0.35) links.push({ a: n, b: hubs[Math.floor(rand() * hubs.length)], cluster: false });
  }
  // coordinated cluster: shared IP + origin post + bots
  const cx = width * 0.66;
  const cy = height * 0.52;
  const ip = add('ip', cx, cy, true);
  const origin = add('post', cx + 40, cy - 46, true);
  const tag = add('tag', cx - 50, cy - 30, true);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const bot = add('bot', cx + Math.cos(angle) * 70, cy + Math.sin(angle) * 70, true);
    links.push({ a: bot, b: ip, cluster: true }, { a: bot, b: origin, cluster: true });
    if (i % 2 === 0) links.push({ a: bot, b: tag, cluster: true });
  }
  links.push({ a: origin, b: tag, cluster: true });
  return { nodes, links };
}

export const HeroNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const ctx: CanvasRenderingContext2D = context;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let network = buildNetwork(1, 1);
    let frame = 0;
    let hovered = -1;
    const pointer = { x: -9999, y: -9999 };
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      network = buildNetwork(width, height);
      for (let i = 0; i < 120; i += 1) step(1);
    };

    const step = (strength: number) => {
      const { nodes, links } = network;
      for (const link of links) {
        const a = nodes[link.a];
        const b = nodes[link.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const target = link.cluster ? 62 : 92;
        const force = ((dist - target) / dist) * 0.012 * strength;
        a.vx += dx * force; a.vy += dy * force;
        b.vx -= dx * force; b.vy -= dy * force;
      }
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy || 1;
          if (d2 > 6400) continue;
          const force = (34 / d2) * strength;
          a.vx -= dx * force; a.vy -= dy * force;
          b.vx += dx * force; b.vy += dy * force;
        }
      }
      for (const node of nodes) {
        const dx = node.x - pointer.x;
        const dy = node.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          node.vx += (dx / Math.sqrt(d2 || 1)) * 0.35;
          node.vy += (dy / Math.sqrt(d2 || 1)) * 0.35;
        }
        node.vx += (width / 2 - node.x) * 0.0022;
        node.vy += (height / 2 - node.y) * 0.0028;
        node.vx *= 0.86;
        node.vy *= 0.86;
        node.x = Math.max(28, Math.min(width - 28, node.x + node.vx));
        node.y = Math.max(28, Math.min(height - 28, node.y + node.vy));
      }
    };

    const draw = (time: number) => {
      const t = (time - start) / 1000;
      const { nodes, links } = network;
      ctx.clearRect(0, 0, width, height);

      const neighbors = new Set<number>();
      if (hovered >= 0) {
        neighbors.add(hovered);
        for (const link of links) {
          if (link.a === hovered) neighbors.add(link.b);
          if (link.b === hovered) neighbors.add(link.a);
        }
      }

      // radar sweep
      const sweepX = ((t * 0.11) % 1.3) * width - width * 0.15;
      const gradient = ctx.createLinearGradient(sweepX - 120, 0, sweepX, 0);
      gradient.addColorStop(0, `rgba(${RGB.olive}, 0)`);
      gradient.addColorStop(1, `rgba(${RGB.olive}, 0.07)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(sweepX - 120, 0, 120, height);
      ctx.fillStyle = `rgba(${RGB.olive}, 0.35)`;
      ctx.fillRect(sweepX, 0, 1, height);

      for (const link of links) {
        const a = nodes[link.a];
        const b = nodes[link.b];
        const lit = hovered >= 0 && neighbors.has(link.a) && neighbors.has(link.b);
        const dim = hovered >= 0 && !lit;
        ctx.strokeStyle = link.cluster
          ? `rgba(${RGB.crimson}, ${dim ? 0.08 : 0.32 + Math.sin(t * 2.2) * 0.12})`
          : lit ? `rgba(${RGB.olive}, 0.7)` : `rgba(${RGB.muted}, ${dim ? 0.04 : 0.14})`;
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      nodes.forEach((node, index) => {
        const dim = hovered >= 0 && !neighbors.has(index);
        const scanned = Math.abs(node.x - sweepX) < 30;
        const pulse = node.cluster ? 1 + Math.sin(t * 2.2 + node.phase) * 0.18 : 1;
        const radius = node.r * pulse * (index === hovered ? 1.6 : 1);
        ctx.globalAlpha = dim ? 0.18 : 1;
        if (node.cluster || scanned || index === hovered) {
          ctx.beginPath();
          ctx.fillStyle = node.cluster ? `rgba(${RGB.crimson}, 0.14)` : `rgba(${RGB.olive}, 0.16)`;
          ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = COLORS[node.kind];
        if (node.kind === 'post') {
          ctx.rect(node.x - radius, node.y - radius, radius * 2, radius * 2);
        } else if (node.kind === 'tag') {
          ctx.moveTo(node.x, node.y - radius * 1.3);
          ctx.lineTo(node.x + radius * 1.3, node.y);
          ctx.lineTo(node.x, node.y + radius * 1.3);
          ctx.lineTo(node.x - radius * 1.3, node.y);
          ctx.closePath();
        } else {
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // cluster callout
      const ip = nodes.find((node) => node.kind === 'ip' && node.cluster);
      if (ip && hovered < 0) {
        ctx.strokeStyle = `rgba(${RGB.crimson}, 0.55)`;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(ip.x, ip.y, 98 + Math.sin(t * 1.4) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = COLORS.bot;
        ctx.fillText('SHARED IP · 8 ACCOUNTS · 31 MIN', Math.min(ip.x + 70, width - 230), Math.max(ip.y - 100, 18));
      }
    };

    const loop = (time: number) => {
      step(0.6);
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      hovered = network.nodes.findIndex((node) => Math.hypot(node.x - pointer.x, node.y - pointer.y) < 12);
      if (reduced) draw(performance.now());
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
      hovered = -1;
      if (reduced) draw(performance.now());
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    observer.observe(canvas);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    if (reduced) draw(start);
    else frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />;
};
