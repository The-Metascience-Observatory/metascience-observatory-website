"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AuditTrial, MapCluster, MapDomain, SeverityLevel } from "./types";
import { RESULT_COLOURS, type ColourMode } from "./TreatmentMap";

/** The treatment map as a 3D point cloud on black.
 *
 *  The floor plan is the same as the flat map (one disc per treatment, grouped by
 *  kind of treatment). Height is publication year, so each treatment becomes a
 *  column that grows upward as the year slider advances. Drag to rotate, scroll
 *  to zoom, right-drag to pan, click a point for its trial card. */

// Brighter than the flat map's palette: these sit on black with additive glow.
const DOMAIN_GLOW = ["#4aa8ff", "#ffb627", "#2fe0a8", "#ff8ad1", "#7fd4ff", "#ff7a3d",
  "#b993ff", "#d9b56a", "#35d0c0", "#ff6fae", "#aab6c8", "#e6e04a"];
const RESULT_GLOW: Record<string, string> = {
  favors_treatment: "#35e06f", mixed: "#ffc247", no_difference: "#9aa9bd",
  favors_control: "#ff5757", inconclusive: "#5d6b80", unknown: "#454f60",
};
const RIGOR_GLOW = ["#3b2a6b", "#4b4fb0", "#3b86d6", "#2fc3c9", "#7fe38a", "#f6f46a"];
const NOT_AUDITED = "#3a4250";
const YEAR_STEP = 95;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function label(text: string, colour: string, px: number): THREE.Sprite {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
  const font = `600 ${px}px system-ui, sans-serif`;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 16;
  canvas.height = px + 14;
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(canvas.width * 0.62, canvas.height * 0.62, 1);
  return sprite;
}

const VERTEX = `
  attribute float aSize; attribute float aShow; attribute vec3 aColor;
  varying vec3 vColor; varying float vShow;
  void main() {
    vColor = aColor; vShow = aShow;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * aShow * (900.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAGMENT = `
  varying vec3 vColor; varying float vShow;
  void main() {
    if (vShow < 0.01) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.22, 0.05, d);
    gl_FragColor = vec4(vColor * (0.45 * halo + 0.9 * core), halo);
  }`;

interface Props {
  trials: AuditTrial[];
  domains: MapDomain[];
  clusters: MapCluster[];
  width: number;
  height: number;
  ladder: SeverityLevel[];
  hasAudit: boolean;
  selectedTrial: string | null;
  onSelectTrial: (id: string | null) => void;
}

export function TreatmentCloud(props: Props) {
  const { trials, domains, clusters, width, height, ladder, hasAudit } = props;
  const placed = useMemo(() => trials.filter((t) => t.x != null && t.y != null), [trials]);
  const years = useMemo(() => {
    const ys = placed.map((t) => t.year).filter((y): y is number => y != null);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 2020, max: 2026 };
  }, [placed]);
  const [mode, setMode] = useState<ColourMode>("domain");
  const [year, setYear] = useState(years.max);
  const [playing, setPlaying] = useState(false);
  const [spin, setSpin] = useState(true);
  const [hover, setHover] = useState<{ trial: AuditTrial; x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const three = useRef<{ geometry: THREE.BufferGeometry; controls: OrbitControls; reset: () => void } | null>(null);
  const select = useRef(props.onSelectTrial);
  select.current = props.onSelectTrial;

  const domainColour = useMemo(() => new Map(domains.map((d, i) => [d.id, DOMAIN_GLOW[i % DOMAIN_GLOW.length]])), [domains]);
  const severityColour = useMemo(() => new Map(ladder.map((l) => [l.n, l.color])), [ladder]);
  const colourOf = useMemo(() => (t: AuditTrial): string => {
    if (mode === "domain") return domainColour.get(t.domain ?? "") ?? "#8893a5";
    if (mode === "result") return RESULT_GLOW[t.verdict] ?? RESULT_GLOW.unknown;
    if (!t.stage) return NOT_AUDITED;
    if (mode === "rigor") return RIGOR_GLOW[Math.min(RIGOR_GLOW.length - 1, Math.floor((t.rigor ?? 0) / (100 / RIGOR_GLOW.length)))];
    return t.maxSeverity >= 2 ? severityColour.get(t.maxSeverity) ?? "#ff7a3d" : "#5f6f86";
  }, [mode, domainColour, severityColour]);

  // Build the scene once per dataset.
  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    node.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00022);
    const top = (years.max - years.min + 1) * YEAR_STEP;
    const camera = new THREE.PerspectiveCamera(42, 1, 10, 12000);
    // Start in front of the floor, a little to one side and above, far enough back that
    // the whole layout fits the canvas; recomputed when the canvas changes shape.
    const target = new THREE.Vector3(0, top * 0.25, 0);
    const home = new THREE.Vector3();
    let untouched = true;
    const frameHome = (aspect: number) => {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(21));
      const fitWidth = (width * 0.56) / (tanHalf * aspect) + height * 0.5;
      const fitHeight = (top * 0.9 + height * 0.6) / (2 * tanHalf) * 1.15;
      const distance = Math.max(fitWidth, fitHeight);
      const yaw = 0.32, elevation = 0.6;
      home.set(target.x + distance * Math.sin(yaw) * Math.cos(elevation), target.y + distance * Math.sin(elevation),
        target.z + distance * Math.cos(yaw) * Math.cos(elevation));
      controls.maxDistance = Math.max(5200, distance * 1.6);
    };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 150;
    controls.maxPolarAngle = Math.PI * 0.495;

    // Points: floor position from the flat map, height from the year.
    const count = placed.length;
    const position = new Float32Array(count * 3), size = new Float32Array(count);
    placed.forEach((t, i) => {
      const y = ((t.year ?? years.min) - years.min + 0.15 + 0.7 * hash(t.id)) * YEAR_STEP;
      position.set([t.x! - width / 2, y, t.y! - height / 2], i * 3);
      size[i] = Math.max(10, Math.min(26, 8 + Math.sqrt(t.n ?? 30) / 1.3));
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aShow", new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(count * 3).fill(0.6), 3));
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(points);

    // Floor: a ring per treatment and per kind of treatment, and a faint column per treatment.
    const ring = (x: number, z: number, r: number, colour: string, opacity: number) => {
      const curve = new THREE.EllipseCurve(0, 0, r, r).getPoints(72).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve),
        new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity }));
      line.position.set(x - width / 2, 0, z - height / 2);
      scene.add(line);
    };
    const colourByDomain = new Map(domains.map((d, i) => [d.id, DOMAIN_GLOW[i % DOMAIN_GLOW.length]]));
    for (const d of domains) {
      const colour = colourByDomain.get(d.id)!;
      ring(d.x, d.y, d.r + 10, colour, 0.5);
      const text = label(d.label, colour, 30);
      text.position.set(d.x - width / 2, -34, d.y - height / 2 + d.r + 26);
      scene.add(text);
    }
    const stems: THREE.Vector3[] = [];
    for (const c of clusters) {
      const colour = colourByDomain.get(c.domain) ?? "#8893a5";
      ring(c.x, c.y, c.r, colour, 0.22);
      stems.push(new THREE.Vector3(c.x - width / 2, 0, c.y - height / 2), new THREE.Vector3(c.x - width / 2, top, c.y - height / 2));
      if (c.n >= 15) {
        const text = label(`${c.label} (${c.n})`, "#8d9bb3", 18);
        text.position.set(c.x - width / 2, top + 26, c.y - height / 2);
        scene.add(text);
      }
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stems),
      new THREE.LineBasicMaterial({ color: 0x8fa3c0, transparent: true, opacity: 0.1 })));
    // Year scale at one corner.
    for (let y = years.min; y <= years.max; y++) {
      const text = label(String(y), "#7f8da3", 22);
      text.position.set(-width / 2 - 70, (y - years.min + 0.5) * YEAR_STEP, -height / 2 - 20);
      scene.add(text);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 9 };
    const pointer = new THREE.Vector2();
    const pick = (event: PointerEvent | MouseEvent): number | null => {
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const show = geometry.getAttribute("aShow") as THREE.BufferAttribute;
      let best: number | null = null, bestDistance = Infinity;
      for (const hit of raycaster.intersectObject(points)) {
        if (hit.index == null || show.getX(hit.index) < 0.5) continue;
        if ((hit.distanceToRay ?? 0) < bestDistance) { bestDistance = hit.distanceToRay ?? 0; best = hit.index; }
      }
      return best;
    };
    let downAt = { x: 0, y: 0 };
    const onMove = (event: PointerEvent) => {
      const index = pick(event), box = renderer.domElement.getBoundingClientRect();
      renderer.domElement.style.cursor = index == null ? "grab" : "pointer";
      setHover(index == null ? null : { trial: placed[index], x: event.clientX - box.left, y: event.clientY - box.top });
    };
    const onDown = (event: PointerEvent) => { untouched = false; downAt = { x: event.clientX, y: event.clientY }; controls.autoRotate = false; setSpin(false); };
    const onClick = (event: MouseEvent) => {
      if (Math.abs(event.clientX - downAt.x) + Math.abs(event.clientY - downAt.y) > 5) return; // a drag, not a click
      const index = pick(event);
      select.current(index == null ? null : placed[index].id);
    };
    const onLeave = () => setHover(null);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const resize = () => {
      const w = node.clientWidth, h = node.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      frameHome(camera.aspect);
      if (untouched) camera.position.copy(home);
    };
    renderer.domElement.addEventListener("wheel", () => { untouched = false; }, { passive: true });
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();

    let frame = 0;
    const tick = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
    tick();
    three.current = { geometry, controls, reset: () => { camera.position.copy(home); controls.target.copy(target); } };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material & { map?: THREE.Texture } | undefined;
        material?.map?.dispose?.();
        material?.dispose?.();
      });
      renderer.dispose();
      node.removeChild(renderer.domElement);
      three.current = null;
    };
  }, [placed, domains, clusters, width, height, years.min, years.max]);

  // Colour, year and selection are attribute updates, not scene rebuilds.
  useEffect(() => {
    const geometry = three.current?.geometry;
    if (!geometry) return;
    const colour = geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const show = geometry.getAttribute("aShow") as THREE.BufferAttribute;
    const c = new THREE.Color();
    placed.forEach((t, i) => {
      c.set(colourOf(t));
      colour.setXYZ(i, c.r, c.g, c.b);
      const visible = t.year == null || t.year <= year;
      show.setX(i, visible ? (props.selectedTrial === t.id ? 2.2 : 1) : 0);
    });
    colour.needsUpdate = true;
    show.needsUpdate = true;
  }, [placed, colourOf, year, props.selectedTrial]);

  useEffect(() => { if (three.current) three.current.controls.autoRotate = spin; }, [spin]);
  useEffect(() => { setYear(years.max); }, [years.max]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setYear((y) => { if (y >= years.max) { setPlaying(false); return y; } return y + 1; }), 1100);
    return () => clearInterval(timer);
  }, [playing, years.max]);

  const modes: [ColourMode, string][] = [["domain", "Kind of treatment"], ["result", "Result"],
    ...(hasAudit ? [["rigor", "Rigor score"], ["issues", "Most serious issue"]] as [ColourMode, string][] : [])];
  const legend = mode === "domain" ? domains.map((d) => ({ label: d.label, color: domainColour.get(d.id)! }))
    : mode === "result" ? Object.keys(RESULT_COLOURS).map((k) => ({ label: RESULT_COLOURS[k].label, color: RESULT_GLOW[k] }))
      : mode === "rigor" ? [...RIGOR_GLOW.map((color, i) => ({ label: i === 0 ? "Rigor 0" : i === RIGOR_GLOW.length - 1 ? "100" : "", color })), { label: "Not yet audited", color: NOT_AUDITED }]
        : [{ label: "No confirmed issue", color: "#5f6f86" }, ...ladder.filter((l) => l.n >= 2).map((l) => ({ label: `${l.n} ${l.label}`, color: l.color })), { label: "Not yet audited", color: NOT_AUDITED }];
  const shown = placed.filter((t) => t.year == null || t.year <= year).length;
  const pill = (active: boolean) => `rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-sky-400 bg-sky-500 text-black" : "border-slate-600 bg-black text-slate-200 hover:bg-slate-800"}`;

  if (failed) return <p className="rounded-lg border border-border bg-white p-4 text-sm text-foreground/70">This browser could not start the 3D view. The flat map shows the same studies.</p>;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-black text-slate-200">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Colour the points by">
          <span className="mr-1 text-slate-400">Colour by</span>
          {modes.map(([key, text]) => <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={pill(mode === key)}>{text}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { if (year >= years.max) setYear(years.min); setPlaying((p) => !p); }} className={pill(false)}>{playing ? "Pause" : "Play the years"}</button>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="sr-only">Show studies published up to</span>
            <input type="range" min={years.min} max={years.max} step={1} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} className="w-28 sm:w-40" />
            <span className="tabular-nums font-medium text-slate-100">to {year}</span><span className="tabular-nums">({shown} studies)</span>
          </label>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setSpin((s) => !s)} aria-pressed={spin} className={pill(spin)}>Slow rotation</button>
          <button type="button" onClick={() => three.current?.reset()} className={pill(false)}>Reset view</button>
        </div>
      </div>
      <div className="relative">
        <div ref={mount} className="h-[78vh] min-h-[420px] w-full touch-none" role="img"
          aria-label="Three-dimensional point cloud of studies: position on the floor is the treatment tested, height is publication year. The flat map and the treatments table show the same information." />
        {hover && (
          <div className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-slate-600 bg-slate-900/95 p-2 text-xs text-slate-100 shadow-lg"
            style={{ left: Math.min(hover.x + 14, (mount.current?.clientWidth ?? 600) - 270), top: hover.y + 14 }}>
            <p className="font-semibold leading-snug">{hover.trial.title}</p>
            <p className="mt-1 text-slate-400">{[hover.trial.authors, hover.trial.year].filter(Boolean).join(", ")}</p>
            <p className="mt-1">{hover.trial.design}{hover.trial.n ? ` · N ${hover.trial.n}` : ""} · {(RESULT_COLOURS[hover.trial.verdict] ?? RESULT_COLOURS.unknown).label}</p>
            {hover.trial.treatments.length > 0 && <p className="mt-1 text-slate-400">{hover.trial.treatments.join("; ")}</p>}
            {hover.trial.stage && <p className="mt-1">Rigor {hover.trial.rigor ?? "n/a"} · {hover.trial.issues.filter((i) => i.status === "confirmed").length} confirmed issue(s)</p>}
            <p className="mt-1 text-slate-500">Click for details</p>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-slate-500">Drag to rotate · scroll to zoom · right-drag to pan · height is publication year · larger points have more participants</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 px-3 py-2 text-xs text-slate-300">
        {legend.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />{item.label}</span>
        ))}
      </div>
    </div>
  );
}
