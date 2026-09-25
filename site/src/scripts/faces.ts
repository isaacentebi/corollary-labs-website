// The face on every inner page. Same instrument, a different reading:
//  essays   one lamp per essay; pointing at an essay pings its lamp
//  essay    one lamp per section; reading moves the front through the strip
//  about    the reorganised field, settling as the page arrives
//  team     four large gauges, one per person, each at its own angle
//  caps     (home, Capabilities) the same four gauges, one per capability
//  contact  one lamp; pointing at the address pings it
//  404      the field with nothing in it
import { rng, type Response } from '../lib/fieldmath';
import { Scene, COL } from './field/scene';
import { mountFace, motionOn, ease3, clamp01 } from './field/host';
import { sound } from './sound';

document.querySelectorAll<HTMLElement>('[data-face]:not([data-face="home"]):not([data-face="approach"])').forEach((el) => init(el, el.dataset.face || 'about'));

function init(el: HTMLElement, kind: string) {
  const pulses: { i: number; t: number }[] = [];
  let progress = 0;
  // essay: one lamp per section, placed where the section sits in the text
  const body0 = document.querySelector<HTMLElement>('[data-essay-body]');
  const sections: number[] = body0 ? [...body0.querySelectorAll('h2')].map((h) => clamp01((h as HTMLElement).offsetTop / Math.max(1, body0.scrollHeight))) : [];
  const R = rng(kind.length * 31 + 7);
  const resp = (): Response => ({ hand: R() < 0.5 ? -1 : 1, spiral: 0.2 + R() * 0.6, gain: 2 + R() * 0.8, core: 0.12 + R() * 0.05 });

  const face = mountFace(el, (face) => ({
    build(W, H, small) {
      const sc = new Scene();
      if (kind === 'team' || kind === 'caps') {
        const n = 4, s = Math.min(W / n, H * 0.92);
        const i = sc.addPanel(0, 0, W, H, s, 3);
        const p = sc.panels[i]; p.cols = n; p.rows = 1; p.s = Math.min(W / n, H);
        sc.build(H);
        const ang = (kind === 'caps' ? [-40, -8, 22, 52] : [-58, -27, 4, 35]).map((a) => ((a - 90) * Math.PI) / 180);
        ang.forEach((a, k) => { sc.bx[k] = Math.cos(a); sc.by[k] = Math.sin(a); });
        sc.lum.fill(1);
        return sc;
      }
      const s = kind === 'essay' ? (small ? 19 : 22) : small ? 30 : 38;
      sc.addPanel(0, 0, W, H, s, kind.length + 4, -0.05);
      const L = kind === 'essay' ? (small ? 150 : 200) : Math.min(W, H) * 1.05;
      sc.build(L);
      if (kind === 'essays') {
        const n = Number(el.dataset.count || 3);
        for (let k = 0; k < n; k++) sc.addAgent(0, (k + 0.5) / n, 0.36 + R() * 0.3, { T: 0.08 + k * 0.14, c: 2.4, w: 30, z: 0.32, ring: true, reach: 0.9, resp: resp() });
      } else if (kind === 'essay') {
        const pts = [0, ...sections].map((x) => 0.05 + x * 0.9);
        pts.forEach((u, k) => sc.addAgent(0, u, 0.5, { T: k === 0 ? -1 : (u - 0.05) / 0.9 - 0.02, c: 2.6, w: 70, z: 0.34, ring: true, reach: 0.75, resp: resp() }));
      } else if (kind === 'about') {
        sc.addAgent(0, small ? 0.5 : 0.64, 0.48, { T: 0.06, c: 1.6, w: 20, z: 0.3, ring: true, reach: 1.3, resp: { hand: 1, spiral: 0.42, gain: 2.3, core: 0.14 } });
      } else if (kind === 'contact') {
        sc.addAgent(0, small ? 0.5 : 0.3, 0.52, { T: 0.06, c: 1.8, w: 22, z: 0.3, ring: true, reach: 1.2, resp: { hand: -1, spiral: 0.6, gain: 2.1, core: 0.13 } });
      }
      return sc;
    },
    frame(now) {
      let q: number, busy = false;
      // each page's face arrives already in its own settled state; only pointing at things moves it
      if (kind === 'essay') q = progress;
      else q = 1.2;
      for (let k = pulses.length - 1; k >= 0; k--) if (now - pulses[k].t > 900) pulses.splice(k, 1);
      if (pulses.length) busy = true;
      return { q, cam: { z: 1, ox: 0, oy: 0 }, busy, now } as never;
    },
    extras(b, f) {
      const now = (f as unknown as { now: number }).now;
      const sc = face.scene;
      for (const p of pulses) {
        const a = sc.agents[p.i]; if (!a) continue;
        const t = clamp01((now - p.t) / 900), s = sc.panels[0].s;
        b.push(2, a.x, a.y, s * 0.4 + s * 3 * ease3(t), 1.6, 0, COL.signal, 0.85 * (1 - t));
      }
    },
  }));

  const ping = (i: number) => {
    const a = face.scene.agents[i];
    if (kind === 'team' || kind === 'caps') {
      face.scene.distV[i] += 16 * (R() < 0.5 ? -1 : 1); face.kickSim(); sound.tick(); return;
    }
    if (!a || !motionOn()) return;
    pulses.push({ i, t: performance.now() });
    face.scene.kick(a.x, a.y, 4, face.scene.panels[0].s * 1.3);
    face.kickSim(); sound.tick();
  };
  // the things that ping this face: inside its scope, or anywhere on a page with one face
  const scope: ParentNode = el.closest('[data-face-scope]') ?? document;
  scope.querySelectorAll<HTMLElement>('[data-ping]').forEach((t) => {
    const i = Number(t.dataset.ping);
    t.addEventListener('pointerenter', () => ping(i));
    t.addEventListener('focus', () => ping(i));
  });

  if (kind === 'essay') {
    const body = document.querySelector<HTMLElement>('[data-essay-body]');
    const gauges = [...document.querySelectorAll<HTMLElement>('[data-read-gauge]')];
    let done = false;
    const onScroll = () => {
      if (!body) return;
      const r = body.getBoundingClientRect();
      progress = clamp01((window.innerHeight * 0.6 - r.top) / r.height);
      gauges.forEach((g) => {
        g.style.setProperty('--r', progress.toFixed(4));
        g.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
        g.classList.toggle('is-done', progress > 0.985);
      });
      if (progress > 0.985 && !done) { done = true; sound.ping(); } else if (progress < 0.95) done = false;
      face.request();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }
  face.request();
}
