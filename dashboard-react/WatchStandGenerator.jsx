/*
 * WatchStandGenerator – paraméteres, moduláris óratartó a Levente 3D pulthoz.
 *
 * Felépítés: az óraoszlopok 3-as szegmensekre bontott talpon állnak, a szegmensek fecskefarkas
 * illesztéssel kapcsolódnak, így minden alkatrész elfér a 180 × 180 mm-es tálcán (Bambu A1 mini).
 * Kiegészítők: kulcs-/gyűrűtálca (bal végre), szemüvegtartó szárny (jobb végre), hátlap felirattal
 * (a talp hátsó sínjébe csúszik). A talp elején kiemelt felirat. Minden rész támasz nélkül nyomtatható.
 *
 * Számítás: térfogat és felület a modellből; nyomtatott anyag = héj (0,9 mm) + 15% kitöltés.
 * Ár: ugyanaz a képlet, mint a pult Árkalkulátorában (anyag + selejt, gépidő, utómunka, haszon, minimum).
 * Az anyagárak (Ft/kg) feltételezések: a `rates` és `materials` propokkal a saját áraidra állíthatók.
 *
 * Függőségek: react, three (≥ 0.150). Betű: ./fonts/Inter-Bold.ttf (SIL OFL), a `fontUrl` proppal cserélhető.
 * Letöltés: alapból böngészős letöltés; artifactban vagy egyéb környezetben add meg az `onDownload` propot.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import helvetiker from "three/examples/fonts/helvetiker_bold.typeface.json";

const DEFAULT_FONT_URL = (() => { try { return new URL("./fonts/Inter-Bold.ttf", import.meta.url).href; } catch (e) { return "fonts/Inter-Bold.ttf"; } })();
const MARKETPLACE_URL = "https://www.facebook.com/marketplace/create/item";

export const DEFAULT_RATES = { mach: 250, work: 3000, margin: 60, waste: 10, min: 3000 };
export const DEFAULT_MATERIALS = [
  { id: "black", name: "Matt Black PLA", swatch: "#1d1d20", color: 0x1d1d20, metal: 0, rough: 0.92, density: 1.24, priceKg: 7000, gph: 22, settings: "PLA · 220 °C / tálca 65 °C · 0,4 mm fúvóka" },
  { id: "gold", name: "Silk Gold PLA", swatch: "linear-gradient(135deg,#7d5f24,#ecd07c 45%,#a8843a)", color: 0xc9a24b, metal: 0.55, rough: 0.32, density: 1.24, priceKg: 9000, gph: 16, settings: "Silk PLA · 215 °C / tálca 60 °C · lassabb külső fal a fényért" },
  { id: "marble", name: "Marble PETG", swatch: "linear-gradient(135deg,#efede8,#c9c6bf 40%,#f4f2ee 60%,#b7b3ab)", color: 0xffffff, metal: 0, rough: 0.55, density: 1.27, priceKg: 9500, gph: 16, marble: true, settings: "PETG · 245 °C / tálca 75 °C · ventilátor 40%" },
  { id: "wood", name: "Wood PLA", swatch: "linear-gradient(135deg,#7a5332,#a77b51 50%,#8a6240)", color: 0x9c7048, metal: 0, rough: 0.85, density: 1.15, priceKg: 11000, gph: 14, settings: "Wood PLA · 210 °C / tálca 60 °C · 0,6 mm fúvóka ajánlott" },
];
const SIZES = { S: 150, M: 165, L: 180 };

/* ---------- méretek (mm) ---------- */
const G = { T: 10, a: 32, gap: 12, M: 10, H: 68, front: 20, perSeg: 3, tab: { n: 6, w: 9, L: 8, c: 0.2 }, rail: { y: 4, w: 2.5, slot: 4.4, h: 8 }, plate: { h: 90, t: 4 }, bed: 180 };
const PITCH = G.a + G.gap;

/* ---------- geometria ---------- */
function rrect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  const s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function plateOutline(len, D, notchLeft, tabRight) {
  const { n, w, L, c } = G.tab, cy = D / 2, s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(len, 0);
  if (tabRight) { s.lineTo(len, cy - n); s.lineTo(len + L, cy - w); s.lineTo(len + L, cy + w); s.lineTo(len, cy + n); }
  s.lineTo(len, D); s.lineTo(0, D);
  if (notchLeft) { s.lineTo(0, cy + n + c); s.lineTo(L + c, cy + w + c); s.lineTo(L + c, cy - w - c); s.lineTo(0, cy - n - c); }
  s.lineTo(0, 0);
  return s;
}
const extrude = (shape, depth, z = 0, opts = {}) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16, ...opts }); g.translate(0, 0, z); return g; };
// 2D profil (u = mélység, v = magasság) kihúzása az X tengely mentén
const sideExtrude = (shape, width, x0) => { const g = extrude(shape, width); g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)); return g; };

function textGeom(font, str, maxW, cap, cx, cy, z) {
  if (!font || !str.trim()) return null;
  let size = cap, g;
  for (let i = 0; i < 3; i++) {
    g = new TextGeometry(str, { font, size, depth: 1, height: 1, curveSegments: 6 });
    g.computeBoundingBox();
    const w = g.boundingBox.max.x - g.boundingBox.min.x;
    if (w <= maxW || i === 2) break;
    size *= maxW / w; g.dispose();
  }
  const b = g.boundingBox;
  g.translate(cx - (b.min.x + b.max.x) / 2, cy - (b.min.y + b.max.y) / 2, z - 0.2);
  return g;
}

function segmentsFor(n) {
  const k = Math.ceil(n / G.perSeg), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

export function buildParts(cfg, font) {
  const b = (SIZES[cfg.size] - Math.PI * G.a) / 2 + G.a; // oszlop mélysége a kerületből (stadion keresztmetszet)
  const railY = G.front + b + G.rail.y;
  const D = Math.ceil((cfg.addons.backplate ? railY + 2 * G.rail.w + G.rail.slot + 3 : G.front + b + 8));
  const segs = segmentsFor(cfg.slots), parts = [];
  const Ltot = cfg.slots * PITCH + 2 * G.M;
  let x0 = 0, slot = 0;
  const textSeg = segs.indexOf(Math.max(...segs));
  segs.forEach((m, i) => {
    const first = i === 0, last = i === segs.length - 1;
    const len = m * PITCH + (first ? G.M : 0) + (last ? G.M : 0);
    const body = [extrude(plateOutline(len, D, !first || cfg.addons.tray, !last || cfg.addons.glasses), G.T)];
    for (let j = 0; j < m; j++, slot++) {
      const cx = (first ? G.M : 0) + PITCH / 2 + j * PITCH;
      const post = extrude(rrect(cx - G.a / 2, G.front, G.a, b, G.a / 2), G.H, 0, { bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2 });
      post.translate(0, 0, G.T); body.push(post);
    }
    if (cfg.addons.backplate) {
      const y1 = railY, y2 = railY + G.rail.w + G.rail.slot;
      body.push(extrude(rrect(0, y1, len, G.rail.w, 0.6), G.rail.h, G.T - 0.2), extrude(rrect(0, y2, len, G.rail.w, 0.6), G.rail.h, G.T - 0.2));
    }
    const text = i === textSeg ? textGeom(font, cfg.baseText, len - 14, 7, len / 2, G.front / 2, G.T) : null;
    parts.push({ id: `talp-${i + 1}`, name: `Talp ${i + 1}/${segs.length} (${m} óra)`, body, text, pos: [x0, 0, 0], rot: [0, 0, 0] });
    x0 += len;
  });
  if (cfg.addons.tray) {
    const len = 72, ring = rrect(3, 3, len - 6, D - 6, 8);
    ring.holes.push(rrect(5.4, 5.4, len - 10.8, D - 10.8, 6));
    parts.push({ id: "talca", name: "Kulcs- és gyűrűtálca", body: [extrude(plateOutline(len, D, false, true), G.T), extrude(ring, 14, G.T - 0.2)], text: null, pos: [-len, 0, 0], rot: [0, 0, 0] });
  }
  if (cfg.addons.glasses) {
    const len = 50, fy0 = Math.max(18, D / 2 - 30), fy1 = Math.min(D - 8, D / 2 + 30), top = 104;
    const fin = new THREE.Shape();
    fin.moveTo(fy0, G.T - 0.2); fin.lineTo(fy1, G.T - 0.2); fin.lineTo(fy1, top - 10);
    fin.quadraticCurveTo((fy0 + fy1) / 2, top + 6, fy0, top - 10); fin.lineTo(fy0, G.T - 0.2);
    parts.push({ id: "szemuveg", name: "Szemüvegtartó szárny", body: [extrude(plateOutline(len, D, true, false), G.T), sideExtrude(fin, 12, len / 2 - 6)], text: null, pos: [Ltot, 0, 0], rot: [0, 0, 0] });
  }
  if (cfg.addons.backplate) {
    const w = Math.min(Ltot - 10, G.bed - 4), t = G.plate.t;
    const text = textGeom(font, cfg.plateText, w - 16, 12, w / 2, G.plate.h - 14, t); // az óraoszlopok fölött látszik
    parts.push({ id: "hatlap", name: "Hátlap felirattal", body: [extrude(rrect(0, 0, w, G.plate.h, 6), t)], text, pos: [(Ltot - w) / 2, railY + G.rail.w + 0.2 + t, G.T], rot: [Math.PI / 2, 0, 0] });
  }
  const footprintW = Ltot + (cfg.addons.tray ? 72 : 0) + (cfg.addons.glasses ? 50 : 0);
  return { parts, dims: { L: footprintW, D, H: Math.max(G.T + G.H + 1.2, cfg.addons.glasses ? 104 : 0, cfg.addons.backplate ? G.T + G.plate.h : 0), b } };
}

/* ---------- mérés és ár ---------- */
function volumeArea(geoms) {
  let V = 0, A = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (const g of geoms) {
    const p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
      V += a.dot(ab.copy(b).cross(c)) / 6;
      A += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    }
  }
  return { V: Math.abs(V), A };
}
const r50 = (x) => Math.round(x / 50) * 50;
export function estimate(parts, mat, rates) {
  let grams = 0;
  const per = parts.map((p) => {
    const { V, A } = volumeArea([...p.body, ...(p.text ? [p.text] : [])]);
    const shell = Math.min(V, A * 0.9), printed = shell + (V - shell) * 0.15;
    const g = (printed / 1000) * mat.density;
    grams += g;
    const box = new THREE.Box3();
    [...p.body, ...(p.text ? [p.text] : [])].forEach((x) => { x.computeBoundingBox(); box.union(x.boundingBox); });
    return { id: p.id, name: p.name, g, size: box.getSize(new THREE.Vector3()) };
  });
  const hours = grams / mat.gph + parts.length * (5 / 60);
  const postMin = 10 + 5 * parts.length;
  const R = { ...DEFAULT_RATES, ...rates };
  const matCost = grams * (1 + R.waste / 100) * mat.priceKg / 1000, machCost = hours * R.mach, workCost = (postMin / 60) * R.work;
  const cost = matCost + machCost + workCost;
  const unit = Math.max(50, r50(cost * (1 + R.margin / 100)));
  return { per, grams, hours, postMin, matCost, machCost, workCost, cost, price: Math.max(R.min, unit), minApplied: unit < R.min };
}

/* ---------- export ---------- */
let CRC = null;
function crc32(u) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length, h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [10, tm, 2], [12, dt, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, nm.length, 2]].forEach(([o, v, l]) => (l === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [12, tm, 2], [14, dt, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, nm.length, 2], [42, off, 4]].forEach(([o, v, l]) => (l === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
    parts.push(new Uint8Array(h.buffer), nm, f.data); cd.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + sz;
  }
  const cdSize = cd.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], { type: "application/zip" });
}
const stl = (geoms) => { const m = new THREE.Mesh(mergeGeometries(geoms.map((g) => g.index ? g.toNonIndexed() : g), false)); const v = new STLExporter().parse(m, { binary: true }); m.geometry.dispose(); return new Uint8Array(v.buffer, v.byteOffset, v.byteLength); };
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

/* ---------- formázás ---------- */
const ft = (n) => Math.round(n).toLocaleString("hu-HU") + " Ft";
const hu1 = (n) => n.toLocaleString("hu-HU", { maximumFractionDigits: 1 });
const hm = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} ó ${m % 60} p`; };

function marbleTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d"); x.fillStyle = "#efede8"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) {
    x.beginPath(); let px = Math.random() * 256, py = 0; x.moveTo(px, py);
    while (py < 256) { py += 8; px += Math.sin(py / 23 + i) * 6 + (Math.random() - 0.5) * 7; x.lineTo(px, py); }
    x.strokeStyle = `rgba(110,104,96,${0.18 + Math.random() * 0.25})`; x.lineWidth = 0.6 + Math.random() * 1.6; x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.02, 0.02); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- 3D előnézet ---------- */
function Preview({ model, material, onSnapshot }) {
  const host = useRef(null), ctx = useRef(null);
  useEffect(() => {
    const el = host.current, renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); el.appendChild(renderer.domElement);
    renderer.domElement.className = "block h-full w-full cursor-grab"; renderer.domElement.setAttribute("aria-label", "Óratartó 3D előnézet");
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 1, 4000); camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xf4f2ea, 0x26261f, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-180, -260, 380); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc3c78f, 0.7); rim.position.set(260, 220, 160); scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05;
    const group = new THREE.Group(); scene.add(group);
    const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); ctx.current?.frame?.(); });
    ro.observe(el);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    ctx.current = { renderer, scene, camera, controls, group, marble: null, lastL: -1 };
    return () => { renderer.setAnimationLoop(null); ro.disconnect(); controls.dispose(); renderer.dispose(); ctx.current?.marble?.dispose(); el.removeChild(renderer.domElement); };
  }, []);

  useEffect(() => {
    const c = ctx.current; if (!c) return;
    c.group.children.forEach((m) => m.traverse((o) => o.material?.dispose?.()));
    c.group.clear();
    if (material.marble && !c.marble) c.marble = marbleTexture();
    const body = new THREE.MeshStandardMaterial({ color: material.color, metalness: material.metal, roughness: material.rough, map: material.marble ? c.marble : null });
    const text = new THREE.MeshStandardMaterial({ color: 0xc9ab84, metalness: 0.15, roughness: 0.5 });
    for (const p of model.parts) {
      const g = new THREE.Group();
      p.body.forEach((geo) => g.add(new THREE.Mesh(geo, body)));
      if (p.text) g.add(new THREE.Mesh(p.text, text));
      g.position.set(...p.pos); g.rotation.set(...p.rot); c.group.add(g);
    }
    const box = new THREE.Box3().setFromObject(c.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    c.controls.target.copy(center);
    c.frame = () => {
      const R = size.length() / 2, half = THREE.MathUtils.degToRad(c.camera.fov / 2), hFov = Math.atan(Math.tan(half) * Math.max(0.4, c.camera.aspect));
      const dist = (R / Math.sin(Math.min(half, hFov))) * 0.92, dir = new THREE.Vector3(-0.32, -0.82, 0.48).normalize();
      c.camera.position.copy(center).addScaledVector(dir, dist);
    };
    if (c.lastL !== Math.round(size.x / 20)) { c.frame(); c.lastL = Math.round(size.x / 20); }
    const t = setTimeout(() => {
      try {
        const src = c.renderer.domElement, out = document.createElement("canvas"); out.width = 960; out.height = 720;
        const x = out.getContext("2d"), bg = x.createRadialGradient(480, 260, 40, 480, 360, 620);
        bg.addColorStop(0, "#2a2b22"); bg.addColorStop(1, "#111113"); x.fillStyle = bg; x.fillRect(0, 0, 960, 720);
        const k = Math.min(960 / src.width, 720 / src.height); x.drawImage(src, (960 - src.width * k) / 2, (720 - src.height * k) / 2, src.width * k, src.height * k);
        onSnapshot(out.toDataURL("image/jpeg", 0.88));
      } catch (e) { onSnapshot(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [model, material, onSnapshot]);

  return <div ref={host} className="relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_35%,rgba(195,199,143,0.12),transparent_65%)]" />;
}

/* ---------- UI elemek ---------- */
const Card = ({ title, children, className = "" }) => (
  <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 ${className}`}>
    {title && <h3 className="mb-4 text-[15px] font-semibold text-zinc-100">{title}</h3>}
    {children}
  </section>
);
const Toggle = ({ id, checked, onChange, label, hint }) => (
  <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 transition hover:border-zinc-700">
    <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c3c78f]" />
    <span><span className="block text-sm font-medium text-zinc-100">{label}</span><span className="block text-xs text-zinc-500">{hint}</span></span>
  </label>
);
const Row = ({ label, value, strong }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
    <span className="text-zinc-400">{label}</span>
    <span className={`whitespace-nowrap tabular-nums ${strong ? "font-bold text-zinc-50" : "text-zinc-200"}`}>{value}</span>
  </div>
);
const Btn = ({ primary, children, ...p }) => (
  <button type="button" {...p} className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c3c78f] disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-[#c3c78f] text-zinc-950 shadow-[0_0_32px_-10px_rgba(195,199,143,0.7)] hover:brightness-110" : "border border-zinc-700 text-zinc-200 hover:border-zinc-500"}`}>{children}</button>
);

/* ---------- fő komponens ---------- */
export default function WatchStandGenerator({ rates, materials = DEFAULT_MATERIALS, fontUrl = DEFAULT_FONT_URL, onDownload, contact = "Levente 3D · Szeged · levente3d.szeged@gmail.com", className = "" }) {
  const [slots, setSlots] = useState(3);
  const [size, setSize] = useState("M");
  const [addons, setAddons] = useState({ tray: true, glasses: false, backplate: true });
  const [baseText, setBaseText] = useState("Kovács Gábor");
  const [plateText, setPlateText] = useState("LEVENTE·3D");
  const [matId, setMatId] = useState(materials[0].id);
  const [font, setFont] = useState(null);
  const [fontNote, setFontNote] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [msg, setMsg] = useState("");
  const [copyFallback, setCopyFallback] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(fontUrl).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((buf) => { if (alive) { setFont(new FontLoader().parse(new TTFLoader().parse(buf))); setFontNote(""); } })
      .catch(() => { if (alive) { setFont(new FontLoader().parse(helvetiker)); setFontNote("A betűtípus nem töltődött be, a felirat ékezetek nélkül készül."); } });
    return () => { alive = false; };
  }, [fontUrl]);

  const material = materials.find((m) => m.id === matId) || materials[0];
  const asciiOnly = !!fontNote;
  const clean = (s) => (asciiOnly ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s);
  const model = useMemo(() => buildParts({ slots, size, addons, baseText: clean(baseText), plateText: clean(plateText) }, font), [slots, size, addons, baseText, plateText, font, asciiOnly]);
  useEffect(() => () => model.parts.forEach((p) => [...p.body, p.text].forEach((g) => g?.dispose())), [model]);
  const est = useMemo(() => estimate(model.parts, material, rates), [model, material, rates]);
  const tooBig = est.per.filter((p) => p.size.x > G.bed || p.size.y > G.bed || p.size.z > G.bed);
  const msgTimer = useRef(0);
  const say = (t) => { setMsg(t); window.clearTimeout(msgTimer.current); msgTimer.current = window.setTimeout(() => setMsg(""), 4000); };
  useEffect(() => () => window.clearTimeout(msgTimer.current), []);

  const title = `Egyedi óratartó ${slots} órához – ${material.name}`;
  const extras = [addons.tray && "kulcs- és gyűrűtálcával", addons.glasses && "szemüvegtartóval", addons.backplate && "feliratos hátlappal"].filter(Boolean);
  const listing = [
    title, `Ár: ${ft(est.price)}`, "",
    `3D nyomtatott, moduláris óratartó ${slots} órához${extras.length ? ", " + extras.join(", ") : ""}.`,
    baseText.trim() ? `Egyedi felirat a talpon: „${baseText.trim()}”.` : "",
    `Méret: kb. ${Math.round(model.dims.L)} × ${Math.round(model.dims.D)} mm, magasság ${Math.round(model.dims.H)} mm. Óraszíj kerülete: ${SIZES[size]} mm-ig.`,
    `Anyag: ${material.name}. Elkészítés 2–3 munkanap.`, "", "Szegeden személyes átvétel, máshová csomagautomatával.", contact,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  async function exportZip() {
    const base = `oratarto-${slots}-${slug(material.name)}`, files = [];
    for (const p of model.parts) {
      files.push({ name: `${base}_${p.id}.stl`, data: stl(p.body) });
      if (p.text) files.push({ name: `${base}_${p.id}_felirat.stl`, data: stl([p.text]) });
    }
    const info = [
      title, "", `Anyag: ${material.name}`, `Beállítás: ${material.settings}`, "Rétegvastagság 0,2 mm · 3 fal · 15% gyroid kitöltés · támasz nélkül", "",
      "Alkatrészek, nyomtatási helyzetben (a talpelemek és a modulok állva, a hátlap fekve, felirattal felfelé):",
      ...est.per.map((p) => `- ${p.name}: ${hu1(p.size.x)} × ${hu1(p.size.y)} × ${hu1(p.size.z)} mm, kb. ${Math.round(p.g)} g`),
      "", `Becsült anyag: ${Math.round(est.grams)} g · nyomtatási idő: ${hm(est.hours)} · ár: ${ft(est.price)}`,
      "Két színhez húzd be egyszerre az alkatrészt és a hozzá tartozó *_felirat.stl fájlt a Bambu Studióba. Amikor rákérdez, hogy egy több részből álló objektumként töltse-e be, válaszd az Igent: így a felirat a helyén marad, és külön filamentet kaphat. AMS nélkül cserélj szálat a felirat első rétegénél.",
      "A G-kódot a szeletelő készíti: a becslés tájékoztató, a pontos időt és súlyt a Bambu Studio adja meg.",
    ].join("\n");
    files.push({ name: `${base}_nyomtatasi_adatok.txt`, data: new TextEncoder().encode(info) });
    const blob = zip(files), filename = `${base}.zip`;
    try {
      if (onDownload) await onDownload({ filename, blob });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
      say(`Letöltve: ${filename} (${files.length} fájl)`);
    } catch (e) { say("A letöltés nem sikerült. Próbáld újra."); }
  }
  async function copyListing() {
    try { await navigator.clipboard.writeText(`${listing}\n\nHirdetés feladása: ${MARKETPLACE_URL}`); setCopyFallback(""); say("Hirdetésszöveg kimásolva. A Marketplace-en illeszd be, és töltsd fel mellé a képet."); }
    catch (e) { setCopyFallback(listing); say("A másolás itt nem engedélyezett, jelöld ki a szöveget lent."); }
  }
  function saveSnapshot() {
    if (!snapshot) return;
    fetch(snapshot).then((r) => r.blob()).then((blob) => {
      const filename = `oratarto-${slots}-${slug(material.name)}.jpg`;
      if (onDownload) return onDownload({ filename, blob });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    }).catch(() => say("A kép mentése nem sikerült."));
  }

  return (
    <div className={`grid gap-4 bg-zinc-950 font-['Inter',system-ui,sans-serif] text-zinc-100 xl:grid-cols-[340px_minmax(0,1fr)_320px] ${className}`}>
      {/* konfiguráció */}
      <div className="grid content-start gap-4">
        <Card title="Óraférőhely">
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Órák száma">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={slots === n} onClick={() => setSlots(n)}
                className={`rounded-lg py-2 text-sm font-bold tabular-nums transition ${slots === n ? "bg-[#c3c78f] text-zinc-950 shadow-[0_0_24px_-8px_rgba(195,199,143,0.8)]" : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-100"}`}>{n}</button>
            ))}
          </div>
          <input id="ws-slots" type="range" min="1" max="6" value={slots} onChange={(e) => setSlots(+e.target.value)} aria-label="Órák száma" className="mt-3 w-full accent-[#c3c78f]" />
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span>Óraszíj kerülete (mm)</span>
            <div className="flex gap-1">
              {Object.entries(SIZES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setSize(k)} aria-pressed={size === k} className={`rounded-md px-2 py-1 font-semibold ${size === k ? "bg-zinc-800 text-[#c3c78f]" : "text-zinc-500 hover:text-zinc-200"}`}>{k} {v}</button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">{model.parts.filter((p) => p.id.startsWith("talp")).length} talpelemből áll, fecskefarkas illesztéssel.</p>
        </Card>

        <Card title="Kiegészítő modulok">
          <div className="grid gap-2">
            <Toggle id="ws-tray" checked={addons.tray} onChange={(v) => setAddons({ ...addons, tray: v })} label="Kulcs- és gyűrűtálca" hint="A bal végére illeszkedik, 72 mm széles." />
            <Toggle id="ws-glasses" checked={addons.glasses} onChange={(v) => setAddons({ ...addons, glasses: v })} label="Szemüvegtartó szárny" hint="A jobb végére illeszkedik, 104 mm magas." />
            <Toggle id="ws-plate" checked={addons.backplate} onChange={(v) => setAddons({ ...addons, backplate: v })} label="Hátlap logóval vagy felirattal" hint="Fekve nyomtatva, a talp hátsó sínjébe csúszik." />
          </div>
        </Card>

        <Card title="Felirat">
          <label htmlFor="ws-text" className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">A talp elején</label>
          <input id="ws-text" value={baseText} maxLength={32} onChange={(e) => setBaseText(e.target.value)} placeholder="pl. név vagy márka" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm outline-none focus:border-[#c3c78f]" />
          {addons.backplate && (<>
            <label htmlFor="ws-plate-text" className="mb-1 mt-3 block text-xs font-medium uppercase tracking-wider text-zinc-500">A hátlapon</label>
            <input id="ws-plate-text" value={plateText} maxLength={24} onChange={(e) => setPlateText(e.target.value)} placeholder="pl. logó szövege" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm outline-none focus:border-[#c3c78f]" />
          </>)}
          <p className="mt-2 text-xs text-zinc-500">{!font ? "Betűtípus betöltése…" : fontNote || "1 mm-rel kiemelkedő betűk; két színhez a ZIP-ben külön fájlban vannak."}</p>
        </Card>

        <Card title="Anyag">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Anyag">
            {materials.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={matId === m.id} onClick={() => setMatId(m.id)}
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${matId === m.id ? "border-[#c3c78f] bg-[#c3c78f]/10" : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700"}`}>
                <span className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/10" style={{ background: m.swatch }} />
                <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{m.name}</span><span className="block text-[11px] text-zinc-500">{(m.priceKg / 1000).toLocaleString("hu-HU")} e Ft/kg</span></span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{material.settings}</p>
        </Card>
      </div>

      {/* előnézet */}
      <Card className="flex min-h-[460px] flex-col p-3 shadow-[0_0_60px_-24px_rgba(195,199,143,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
          <h3 className="text-[15px] font-semibold">Előnézet</h3>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs tabular-nums text-zinc-300">{Math.round(model.dims.L)} × {Math.round(model.dims.D)} × {Math.round(model.dims.H)} mm</span>
        </div>
        <div className="relative flex-1"><Preview model={model} material={material} onSnapshot={setSnapshot} /></div>
        <p className="px-2 pt-2 text-xs text-zinc-500">Húzással forgatod, görgővel nagyítod. Összeszerelt állapot; az STL-ekben az alkatrészek nyomtatási helyzetben vannak.</p>
      </Card>

      {/* számítás és műveletek */}
      <div className="grid content-start gap-4">
        <Card title="Becslés">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-zinc-950/60 p-3"><div className="text-xs text-zinc-500">Nyomtatási idő</div><div className="text-2xl font-extrabold tabular-nums">{hu1(est.hours)} óra</div><div className="text-[11px] text-zinc-500">{hm(est.hours)}</div></div>
            <div className="rounded-xl bg-zinc-950/60 p-3"><div className="text-xs text-zinc-500">Filament</div><div className="text-2xl font-extrabold tabular-nums">{Math.round(est.grams)} g</div><div className="text-[11px] text-zinc-500">{model.parts.length} alkatrész</div></div>
          </div>
          <div className="mt-3 rounded-xl border border-[#c3c78f]/30 bg-[#c3c78f]/10 p-3">
            <div className="text-xs text-[#d9dcae]">Eladási ár</div>
            <div className="text-3xl font-extrabold tabular-nums text-white">{ft(est.price)}</div>
            {est.minApplied && <div className="text-[11px] text-[#d9dcae]">Minimum rendelési érték alkalmazva</div>}
          </div>
          <div className="mt-3 divide-y divide-zinc-800">
            <Row label="Anyag (+ selejt)" value={ft(est.matCost)} />
            <Row label="Gépidő" value={ft(est.machCost)} />
            <Row label={`Utómunka, összeszerelés (${est.postMin} perc)`} value={ft(est.workCost)} />
            <Row label="Önköltség" value={ft(est.cost)} strong />
            <Row label="Haszon" value={ft(est.price - est.cost)} />
          </div>
          <details className="mt-2 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none text-zinc-400">Alkatrészenként</summary>
            <ul className="mt-2 grid gap-1">{est.per.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="tabular-nums">{Math.round(p.g)} g · {Math.round(p.size.x)}×{Math.round(p.size.y)} mm</span></li>)}</ul>
          </details>
          {tooBig.length > 0 && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">Nem fér a tálcára: {tooBig.map((p) => p.name).join(", ")}.</p>}
        </Card>

        <Card title="Műveletek">
          <div className="grid gap-2">
            <Btn primary onClick={exportZip} disabled={!font}>STL és nyomtatási adatok (ZIP)</Btn>
            <Btn onClick={copyListing}>Marketplace-hirdetés másolása</Btn>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
            {snapshot ? <img src={snapshot} alt="Az óratartó előnézeti képe" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center text-xs text-zinc-500">Kép készítése…</div>}
            <div className="p-3">
              <div className="text-lg font-extrabold tabular-nums">{ft(est.price)}</div>
              <div className="text-sm font-medium text-zinc-200">{title}</div>
              <div className="text-xs text-zinc-500">Szeged · Marketplace</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <button type="button" onClick={saveSnapshot} disabled={!snapshot} className="font-semibold text-[#c3c78f] hover:underline disabled:opacity-50">Kép mentése</button>
            <a href={MARKETPLACE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c9ab84] hover:underline">Hirdetés feladása a Marketplace-en</a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">A Facebook nem fogad előre kitöltött hirdetéslinket, ezért a szöveget és a képet adod meg a feladásnál.</p>
          {copyFallback && <textarea readOnly value={copyFallback} onFocus={(e) => e.target.select()} rows={8} aria-label="Hirdetés szövege" className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300" />}
          <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-[#d9dcae]">{msg}</p>
        </Card>
      </div>
    </div>
  );
}
