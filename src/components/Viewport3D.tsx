import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { BuildResult, DesignShape } from "../types";

type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
import {
  surfaceOption,
  type PrintFinish,
  type PrintMaterialStyle,
  type SurfaceStyle,
} from "../lib/preview";

export interface Viewport3DHandle {
  fit: () => void;
  fitModel: () => void;
  view: (kind: "iso" | "top" | "front" | "side" | "bottom") => void;
  screenshot: () => string | null;
}

interface Props {
  build: BuildResult | null;
  showEdges: boolean;
  wireframe: boolean;
  isolate: "all" | "cutter" | "stamp" | "imprint";
  fitKey: string;
  selectedIds?: string[];
  onSelectAsset?: (id: string, additive: boolean) => void;
  bedWidth?: number;
  bedDepth?: number;
  technical?: boolean;
  projection?: "perspective" | "orthographic";
  autoRotate?: boolean;
  showBed?: boolean;
  showGrid?: boolean;
  shadows?: boolean;
  xray?: boolean;
  explode?: number;
  bedStyle?: SurfaceStyle;
  customSurface?: string;
  finish?: PrintFinish;
  materialStyle?: PrintMaterialStyle;
  secondaryColor?: string;
  primaryShape?: DesignShape | null;
  showDough?: boolean;
  doughColor?: string;
  cookieColor?: string;
  showCookie?: boolean;
  showScale?: boolean;
  measurements?: boolean;
  centerPick?: boolean;
  onCenterPicked?: () => void;
}

const COLORS: Record<string, number> = {
  Cortador: 0xf39ab1,
  Sello: 0xb7a4e8,
  Impronta: 0xf39ab1,
};

function makeSurfaceTexture(kind: "marble" | "dark-marble" | "wood"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  if (kind === "wood") {
    const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
    gradient.addColorStop(0, "#b98256");
    gradient.addColorStop(0.18, "#a56e45");
    gradient.addColorStop(0.36, "#c89362");
    gradient.addColorStop(0.56, "#9e673f");
    gradient.addColorStop(0.78, "#b98256");
    gradient.addColorStop(1, "#c28b5b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    let seed = 1703;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 46; i += 1) {
      const y = rand() * 1024;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(85,45,23,${0.07 + rand() * 0.16})`;
      ctx.lineWidth = 1 + rand() * 5;
      for (let x = -20; x <= 1044; x += 24) {
        const wave = Math.sin(x * 0.022 + i) * (7 + rand() * 10);
        if (x === -20) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 8; i += 1) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(247,224,193,0.13)";
      ctx.lineWidth = 1;
      ctx.ellipse(x, y, 18 + rand() * 32, 4 + rand() * 8, rand() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const dark = kind === "dark-marble";
    ctx.fillStyle = dark ? "#343238" : "#f5f0e9";
    ctx.fillRect(0, 0, 1024, 1024);
    let seed = dark ? 811 : 391;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 26; i += 1) {
      ctx.beginPath();
      ctx.strokeStyle = dark ? `rgba(238,232,246,${0.06 + rand() * 0.2})` : `rgba(105,92,83,${0.07 + rand() * 0.2})`;
      ctx.lineWidth = 0.8 + rand() * 3.8;
      let x = -80;
      let y = rand() * 1100;
      ctx.moveTo(x, y);
      while (x < 1100) {
        x += 20 + rand() * 48;
        y += (rand() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 34; i += 1) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      ctx.beginPath();
      ctx.fillStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.28)";
      ctx.arc(x, y, 2 + rand() * 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.25, 1.25);
  texture.anisotropy = 4;
  return texture;
}

function createBed(width: number, depth: number, style: SurfaceStyle = "mauve", customColor = "#e9d7c8"): THREE.Group {
  const bed = new THREE.Group();
  const w = Math.max(20, width);
  const d = Math.max(20, depth);
  const option = surfaceOption(style, customColor);
  let topColor = new THREE.Color(option.top);
  let bodyColor = new THREE.Color(option.body);
  if (style === "custom") {
    topColor = new THREE.Color(customColor);
    bodyColor = topColor.clone().multiplyScalar(0.72);
  }
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.92, metalness: 0.02 });
  const topMat = new THREE.MeshStandardMaterial({
    color: option.texture ? 0xffffff : topColor,
    roughness: option.texture ? 0.72 : 0.88,
    metalness: 0.012,
  });
  if (option.texture) topMat.map = makeSurfaceTexture(option.texture);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), bodyMat);
  body.position.y = -1.55;
  body.receiveShadow = true;
  body.castShadow = true;
  bed.add(body);

  const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, d - 2), topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = -0.02;
  top.receiveShadow = true;
  bed.add(top);

  const minor: number[] = [];
  const major: number[] = [];
  const startX = -Math.floor((w / 2 - 1) / 10) * 10;
  const startZ = -Math.floor((d / 2 - 1) / 10) * 10;
  for (let x = startX; x <= w / 2 - 1; x += 10) {
    const target = Math.abs((Math.abs(x) % 50)) < 0.01 ? major : minor;
    target.push(x, 0.002, -d / 2 + 1, x, 0.002, d / 2 - 1);
  }
  for (let z = startZ; z <= d / 2 - 1; z += 10) {
    const target = Math.abs((Math.abs(z) % 50)) < 0.01 ? major : minor;
    target.push(-w / 2 + 1, 0.002, z, w / 2 - 1, 0.002, z);
  }
  const makeGrid = (values: number[], color: string, opacity: number) => {
    if (!values.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
  };
  const grids = new THREE.Group();
  const minorGrid = makeGrid(minor, option.grid, 0.3);
  const majorGrid = makeGrid(major, option.gridStrong, 0.55);
  if (minorGrid) grids.add(minorGrid);
  if (majorGrid) grids.add(majorGrid);
  bed.add(grids);
  bed.userData.grid = grids;

  const borderPoints = [
    new THREE.Vector3(-w / 2 + 0.8, 0.004, -d / 2 + 0.8),
    new THREE.Vector3(w / 2 - 0.8, 0.004, -d / 2 + 0.8),
    new THREE.Vector3(w / 2 - 0.8, 0.004, d / 2 - 0.8),
    new THREE.Vector3(-w / 2 + 0.8, 0.004, d / 2 - 0.8),
  ];
  const border = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(borderPoints),
    new THREE.LineBasicMaterial({ color: option.border, transparent: true, opacity: 0.45 }),
  );
  bed.add(border);
  return bed;
}


function disposeObject(object: THREE.Object3D | null | undefined) {
  object?.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop || obj instanceof THREE.Sprite) {
      obj.geometry?.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        const map = (material as THREE.MeshStandardMaterial).map;
        map?.dispose();
        material.dispose();
      }
    }
  });
}

function roundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const w = Math.max(1, width);
  const d = Math.max(1, depth);
  const r = Math.max(0, Math.min(radius, Math.min(w, d) / 2 - 0.01));
  const x = -w / 2;
  const y = -d / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function mapDesignRing(ring: [number, number][], shape: DesignShape, width: number, height: number): THREE.Vector2[] {
  const b = shape.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const sx = width / Math.max(1e-6, b.width);
  const sy = height / Math.max(1e-6, b.height);
  return ring
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => new THREE.Vector2((p[0] - cx) * sx, -(p[1] - cy) * sy));
}

function designPoints(shape: DesignShape, width: number, height: number): { outer: THREE.Vector2[]; holes: THREE.Vector2[][] } {
  return {
    outer: mapDesignRing(shape.outer, shape, width, height),
    holes: shape.holes.map((ring) => mapDesignRing(ring, shape, width, height)).filter((ring) => ring.length >= 3),
  };
}

function cookieShape(shape: DesignShape, width: number, height: number): THREE.Shape | null {
  const points = designPoints(shape, width, height);
  if (points.outer.length < 3) return null;
  const result = new THREE.Shape(points.outer);
  for (const hole of points.holes) result.holes.push(new THREE.Path(hole));
  return result;
}

function cookiePath(shape: DesignShape, width: number, height: number): THREE.Path | null {
  const points = designPoints(shape, width, height);
  if (points.outer.length < 3) return null;
  return new THREE.Path(points.outer);
}

function organicSheetShape(width: number, depth: number): THREE.Shape {
  const points: THREE.Vector2[] = [];
  const n = 96;
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const r = 1 + 0.028 * Math.sin(3 * t + 0.4) + 0.016 * Math.cos(5 * t) + 0.009 * Math.sin(7 * t + 1.2);
    points.push(new THREE.Vector2(Math.cos(t) * width * 0.5 * r, Math.sin(t) * depth * 0.5 * r));
  }
  return new THREE.Shape(points);
}

function makeCookieTexture(base = "#d9a35d"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    let seed = 71;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 520; i += 1) {
      const x = rand() * 256;
      const y = rand() * 256;
      const radius = rand() * 1.8 + 0.3;
      ctx.beginPath();
      ctx.fillStyle = rand() > 0.5 ? "rgba(125,74,30,0.085)" : "rgba(255,245,220,0.13)";
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function createDoughStage(shape: DesignShape | null | undefined, modelBox: THREE.Box3, showCookie: boolean, showScale: boolean, doughColor: string, cookieColor: string, bedWidth: number, bedDepth: number): THREE.Group {
  const stage = new THREE.Group();
  const size = modelBox.getSize(new THREE.Vector3());
  const center = modelBox.getCenter(new THREE.Vector3());
  const footprint = Math.max(20, Math.min(size.x, size.z) * 0.84);
  const aspect = shape ? Math.max(0.2, shape.bounds.width / Math.max(1, shape.bounds.height)) : 1;
  const cookieW = aspect >= 1 ? footprint : footprint * aspect;
  const cookieH = aspect >= 1 ? footprint / aspect : footprint;
  const sheetW = Math.max(80, Math.min(Math.max(80, bedWidth - 12), size.x + 70));
  const sheetD = Math.max(70, Math.min(Math.max(70, bedDepth - 12), size.z + 70));
  const thickness = 4;
  const cookie = shape ? cookieShape(shape, cookieW, cookieH) : null;
  const sheet = organicSheetShape(sheetW, sheetD);
  const hole = shape && showCookie ? cookiePath(shape, cookieW, cookieH) : null;
  if (hole) sheet.holes.push(hole);
  const sheetGeometry = new THREE.ExtrudeGeometry(sheet, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 1.6,
    bevelThickness: 1.2,
    bevelSegments: 3,
    curveSegments: 18,
  });
  sheetGeometry.rotateX(-Math.PI / 2);
  const doughMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    map: makeCookieTexture(doughColor),
  });
  const dough = new THREE.Mesh(sheetGeometry, doughMaterial);
  dough.position.set(center.x, 0, center.z);
  dough.receiveShadow = true;
  dough.castShadow = true;
  stage.add(dough);

  if (shape && cookie && showCookie) {
    const cookieGeometry = new THREE.ExtrudeGeometry(cookie, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 1.2,
      bevelThickness: 1.0,
      bevelSegments: 3,
      curveSegments: 18,
    });
    cookieGeometry.rotateX(-Math.PI / 2);
    const cookieMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      map: makeCookieTexture(cookieColor),
    });
    const looseGroup = new THREE.Group();
    const preferredX = center.x + sheetW / 2 + cookieW / 2 + 16;
    const maxX = center.x + bedWidth / 2 - cookieW / 2 - 8;
    const looseX = Math.min(preferredX, maxX);
    const overlapsDough = looseX < center.x + sheetW / 2 + cookieW / 2;
    looseGroup.position.set(
      looseX,
      overlapsDough ? thickness + 1.4 : 0,
      center.z + Math.min(20, sheetD * 0.1),
    );
    looseGroup.rotation.y = -0.16;
    const loose = new THREE.Mesh(cookieGeometry, cookieMaterial);
    loose.castShadow = true;
    loose.receiveShadow = true;
    looseGroup.add(loose);
    const detailMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cookieColor).multiplyScalar(0.78),
      roughness: 0.84,
      metalness: 0.0,
    });
    for (const detail of shape.details.slice(0, 120)) {
      const points = mapDesignRing(detail, shape, cookieW, cookieH);
      if (points.length < 3) continue;
      const detailGeometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
        depth: 0.35,
        bevelEnabled: false,
        curveSegments: 6,
      });
      detailGeometry.rotateX(-Math.PI / 2);
      const detailMesh = new THREE.Mesh(detailGeometry, detailMaterial);
      detailMesh.position.y = thickness + 0.02;
      looseGroup.add(detailMesh);
    }
    stage.add(looseGroup);
  }

  if (showScale) {
    const rulerCanvas = document.createElement("canvas");
    rulerCanvas.width = 1024;
    rulerCanvas.height = 128;
    const ctx = rulerCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f7eddf";
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = "#7b5b46";
      ctx.font = "700 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i <= 100; i += 5) {
        const x = 10 + (i / 100) * 1004;
        const tall = i % 10 === 0;
        ctx.fillRect(x, 0, tall ? 3 : 1.5, tall ? 32 : 22);
        if (i % 10 === 0) ctx.fillText(String(i / 10), x, 66);
      }
      ctx.fillStyle = "#96745d";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText("cm", 985, 106);
    }
    const rulerTexture = new THREE.CanvasTexture(rulerCanvas);
    rulerTexture.colorSpace = THREE.SRGBColorSpace;
    const ruler = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 12.5),
      new THREE.MeshBasicMaterial({ map: rulerTexture, transparent: true }),
    );
    ruler.rotation.x = -Math.PI / 2;
    ruler.position.set(center.x, 0.16, center.z + sheetD / 2 + 18);
    stage.add(ruler);

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 12, 2.2, 48),
      new THREE.MeshStandardMaterial({ color: 0xd7b45f, roughness: 0.3, metalness: 0.72 }),
    );
    coin.position.set(center.x - sheetW / 2 - 18, 1.1, center.z + sheetD / 2 - 4);
    coin.castShadow = true;
    coin.receiveShadow = true;
    stage.add(coin);
  }
  return stage;
}

function labelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,251,252,0.96)";
    ctx.strokeStyle = "rgba(190,112,139,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(3, 3, 314, 74, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7e5064";
    ctx.font = "700 38px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 160, 42);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(31, 7.75, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createMeasurements(box: THREE.Box3): THREE.Group {
  const group = new THREE.Group();
  const min = box.min;
  const max = box.max;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const floor = Math.max(0.1, min.y + 0.15);
  const front = max.z + 13;
  const side = max.x + 13;
  const left = min.x - 13;
  const points: number[] = [
    min.x, floor, front, max.x, floor, front,
    min.x, floor, front - 4, min.x, floor, front + 4,
    max.x, floor, front - 4, max.x, floor, front + 4,
    side, floor, min.z, side, floor, max.z,
    side - 4, floor, min.z, side + 4, floor, min.z,
    side - 4, floor, max.z, side + 4, floor, max.z,
    left, min.y, center.z, left, max.y, center.z,
    left - 3, min.y, center.z - 3, left + 3, min.y, center.z + 3,
    left - 3, max.y, center.z - 3, left + 3, max.y, center.z + 3,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x9e647b, transparent: true, opacity: 0.75, depthTest: false }),
  ));
  const widthLabel = labelSprite(`${size.x.toFixed(1)} mm`);
  widthLabel.position.set(center.x, floor + 7, front);
  group.add(widthLabel);
  const depthLabel = labelSprite(`${size.z.toFixed(1)} mm`);
  depthLabel.position.set(side + 1, floor + 7, center.z);
  group.add(depthLabel);
  const heightLabel = labelSprite(`${size.y.toFixed(1)} mm`);
  heightLabel.position.set(left - 1, center.y, center.z);
  group.add(heightLabel);
  return group;
}

function createCenterMarker(): THREE.Group {
  const group = new THREE.Group();
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7396, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.5, 40),
    new THREE.MeshBasicMaterial({
      color: 0xff8cab,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  const cross = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-7, 0, 0), new THREE.Vector3(7, 0, 0),
      new THREE.Vector3(0, 0, -7), new THREE.Vector3(0, 0, 7),
    ]),
    new THREE.LineBasicMaterial({ color: 0xff7396, transparent: true, opacity: 0.75, depthTest: false }),
  );
  group.add(dot, ring, cross);
  group.visible = false;
  group.renderOrder = 30;
  return group;
}

function createPartMaterial(
  part: BuildResult["parts"][number],
  index: number,
  style: PrintMaterialStyle,
  finish: PrintFinish,
  secondary: string,
  wireframe: boolean,
): { material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial; base: THREE.Color; second: THREE.Color; gradient: boolean } {
  const base = new THREE.Color(part.color || "#f39ab1");
  const second = new THREE.Color(secondary || "#b7a4e8");
  const color = style === "two-tone" && index % 2 === 1 ? second : base;
  const roughness = finish === "matte" ? 0.74 : finish === "gloss" ? 0.22 : 0.42;
  if (style === "silk") {
    return {
      material: new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.28,
        metalness: 0.3,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        sheen: 0.35,
        sheenColor: second,
        envMapIntensity: 0.75,
        wireframe,
      }),
      base,
      second,
      gradient: false,
    };
  }
  if (style === "glitter") {
    return {
      material: new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.35,
        metalness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.32,
        iridescenceThicknessRange: [120, 420],
        clearcoat: 0.4,
        clearcoatRoughness: 0.28,
        sheen: 0.5,
        sheenColor: second,
        sheenRoughness: 0.35,
        envMapIntensity: 0.8,
        wireframe,
      }),
      base,
      second,
      gradient: false,
    };
  }
  return {
    material: new THREE.MeshStandardMaterial({
      color: style === "gradient" ? 0xffffff : color,
      roughness,
      metalness: finish === "gloss" ? 0.08 : 0.015,
      vertexColors: style === "gradient",
      envMapIntensity: 0.55,
      wireframe,
    }),
    base,
    second,
    gradient: style === "gradient",
  };
}

const Viewport3D = forwardRef<Viewport3DHandle, Props>(function Viewport3D(
  {
    build,
    showEdges,
    wireframe,
    isolate,
    fitKey,
    selectedIds = [],
    onSelectAsset,
    bedWidth = 256,
    bedDepth = 256,
    technical = false,
    projection = "perspective",
    autoRotate = false,
    showBed = true,
    showGrid = true,
    shadows = true,
    xray = false,
    explode = 0,
    bedStyle = "mauve",
    customSurface = "#e9d7c8",
    finish = "satin",
    materialStyle = "solid",
    secondaryColor = "#b7a4e8",
    primaryShape = null,
    showDough = false,
    doughColor = "#e3c08a",
    cookieColor = "#d39a5e",
    showCookie = true,
    showScale = false,
    measurements = false,
    centerPick = false,
    onCenterPicked,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: ViewCamera;
    perspective: THREE.PerspectiveCamera;
    orthographic: THREE.OrthographicCamera;
    controls: OrbitControls;
    group: THREE.Group;
    bed: THREE.Group;
    fit: () => void;
    view: (kind: "iso" | "top" | "front" | "side" | "bottom") => void;
    resize: () => void;
  } | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const stageRef = useRef<THREE.Group | null>(null);
  const measurementsRef = useRef<THREE.Group | null>(null);
  const centerMarkerRef = useRef<THREE.Group | null>(null);
  const fitKeyRef = useRef("");
  const selectRef = useRef<Props["onSelectAsset"]>(onSelectAsset);
  selectRef.current = onSelectAsset;
  const centerPickRef = useRef(centerPick);
  centerPickRef.current = centerPick;
  const centerPickedRef = useRef(onCenterPicked);
  centerPickedRef.current = onCenterPicked;
  const projectionRef = useRef<"perspective" | "orthographic">(projection);
  projectionRef.current = projection;
  const technicalRef = useRef(technical);
  technicalRef.current = technical;

  const viewportAspect = (renderer: THREE.WebGLRenderer) => {
    const w = renderer.domElement.clientWidth || 800;
    const h = renderer.domElement.clientHeight || 600;
    return w / Math.max(1, h);
  };

  const fitOrtho = (
    camera: THREE.OrthographicCamera,
    aspect: number,
    radius: number,
    wide = false,
  ) => {
    const height = Math.max(10, radius * (wide ? 1.7 : 1.45));
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.left = -(height * aspect) / 2;
    camera.right = (height * aspect) / 2;
    camera.near = 0.1;
    camera.far = Math.max(6000, radius * 40 + 1000);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
  };

  const frameBox = (box: THREE.Box3, wide = false) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    const aspect = viewportAspect(scene.renderer);
    const camera = scene.camera;
    const dir = new THREE.Vector3(0.72, 0.95, 1.25).normalize();
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = (camera.fov * Math.PI) / 180;
      const fitHeight = radius / (2 * Math.tan(fov / 2));
      const fitWidth = fitHeight / Math.max(1, aspect);
      const distance = Math.max(fitHeight, fitWidth) * (wide ? 1.42 : 1.2) + radius * 0.08;
      camera.position.copy(center).addScaledVector(dir, distance);
      camera.near = Math.max(0.1, distance / 100);
      camera.far = distance * 30;
      camera.updateProjectionMatrix();
    } else {
      fitOrtho(camera, aspect, radius, wide);
      const distance = radius * 4;
      camera.position.copy(center).addScaledVector(dir, distance);
      camera.near = 0.1;
      camera.far = distance + radius * 8 + 1000;
      camera.updateProjectionMatrix();
    }
    scene.controls.target.copy(center);
    scene.controls.update();
    scene.controls.minDistance = Math.max(18, radius * 0.08);
    scene.controls.maxDistance = Math.max(1200, radius * 8);
    if (centerMarkerRef.current) centerMarkerRef.current.visible = false;
  };

  const doFit = () => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    if (stageRef.current?.visible) {
      const stageBox = new THREE.Box3().setFromObject(stageRef.current);
      if (!stageBox.isEmpty()) box.union(stageBox);
    }
    const size = box.getSize(new THREE.Vector3());
    frameBox(box, Math.max(size.x, size.y, size.z) > 120);
  };

  const setView = (kind: "iso" | "top" | "front" | "side" | "bottom") => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    if (stageRef.current?.visible) {
      const stageBox = new THREE.Box3().setFromObject(stageRef.current);
      if (!stageBox.isEmpty()) box.union(stageBox);
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    const wide = Math.max(size.x, size.y, size.z) > 120;
    const aspect = viewportAspect(scene.renderer);
    const camera = scene.camera;
    let distance: number;
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = (camera.fov * Math.PI) / 180;
      const fitHeight = radius / (2 * Math.tan(fov / 2));
      const fitWidth = fitHeight / Math.max(1, aspect);
      distance = Math.max(fitHeight, fitWidth) * (wide ? 1.42 : 1.18) + radius * 0.08;
    } else {
      fitOrtho(camera, aspect, radius, wide);
      distance = radius * 4;
      camera.near = 0.1;
      camera.far = distance + radius * 8 + 1000;
    }
    if (kind === "top") camera.position.set(center.x, center.y + distance, center.z + 0.01);
    else if (kind === "bottom") camera.position.set(center.x, center.y - distance, center.z + 0.01);
    else if (kind === "front") camera.position.set(center.x, center.y + radius * 0.25, center.z + distance);
    else if (kind === "side") camera.position.set(center.x + distance, center.y + radius * 0.25, center.z + 0.01);
    else {
      const dir = new THREE.Vector3(0.72, 0.95, 1.25).normalize();
      camera.position.copy(center).addScaledVector(dir, distance);
    }
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    scene.controls.target.copy(center);
    scene.controls.update();
  };

  const fitModel = () => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    frameBox(box, Math.max(size.x, size.y, size.z) > 120);
  };

  const screenshot = () => {
    const scene = sceneRef.current;
    if (!scene) return null;
    scene.renderer.render(scene.scene, scene.camera);
    return scene.renderer.domElement.toDataURL("image/png");
  };

  useImperativeHandle(ref, () => ({ fit: doFit, fitModel, view: setView, screenshot }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const perspective = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
    perspective.position.set(100, 120, 170);
    const orthographic = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 6000);
    orthographic.position.copy(perspective.position);
    const initialCamera: ViewCamera = projectionRef.current === "orthographic" ? orthographic : perspective;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 600, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(initialCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;
    controls.minDistance = 20;
    controls.maxDistance = 1800;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const activeCamera = sceneRef.current?.camera ?? initialCamera;
      raycaster.setFromCamera(pointer, activeCamera);
      const root = modelRef.current;
      if (!root) return;
      if (centerPickRef.current) {
        const pickRoots: THREE.Object3D[] = [root];
        if (stageRef.current?.visible) pickRoots.push(stageRef.current);
        const hits = raycaster.intersectObjects(pickRoots, true);
        const point = hits.find((hit) => hit.object.visible)?.point;
        if (point) {
          const delta = point.clone().sub(controls.target);
          controls.target.copy(point);
          activeCamera.position.add(delta);
          controls.update();
          const marker = centerMarkerRef.current;
          if (marker) {
            marker.position.copy(point);
            marker.visible = true;
          }
          centerPickedRef.current?.();
        }
        return;
      }
      const hits = raycaster.intersectObjects(
        root.children.filter((o) => o.visible && o.userData.assetId),
        true,
      );
      const target = hits.find((h) => h.object.userData.assetId)?.object;
      if (target && selectRef.current) {
        selectRef.current(String(target.userData.assetId), event.ctrlKey || event.metaKey || event.shiftKey);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const hemi = new THREE.HemisphereLight(0xfff9f5, 0xd9c2d2, 1.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff5f2, 2.25);
    key.position.set(90, 160, 90);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -170;
    key.shadow.camera.right = 170;
    key.shadow.camera.top = 170;
    key.shadow.camera.bottom = -170;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 500;
    key.shadow.bias = -0.0008;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe7d7ff, 1.1);
    fill.position.set(-100, 80, -60);
    scene.add(fill);

    const bed = createBed(bedWidth, bedDepth, bedStyle, customSurface);
    scene.add(bed);

    const stage = new THREE.Group();
    scene.add(stage);
    stageRef.current = stage;

    const marker = createCenterMarker();
    scene.add(marker);
    centerMarkerRef.current = marker;

    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;
    scene.add(group);

    let raf = 0;
    const resize = () => {
      const w = host.clientWidth || 800;
      const h = host.clientHeight || 600;
      renderer.setSize(w, h, false);
      const aspect = w / Math.max(1, h);
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      const orthoHeight = orthographic.top - orthographic.bottom;
      if (Number.isFinite(orthoHeight) && orthoHeight > 0) {
        orthographic.left = -(orthoHeight * aspect) / 2;
        orthographic.right = (orthoHeight * aspect) / 2;
      }
      orthographic.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    window.addEventListener("resize", resize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      const activeCamera = sceneRef.current?.camera ?? initialCamera;
      renderer.render(scene, activeCamera);
    };
    tick();

    sceneRef.current = { renderer, scene, camera: initialCamera, perspective, orthographic, controls, group, bed, fit: doFit, view: setView, resize };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const next = projection === "orthographic" ? scene.orthographic : scene.perspective;
    const prev = scene.camera;
    if (prev === next) return;
    const aspect = viewportAspect(scene.renderer);
    next.position.copy(prev.position);
    next.quaternion.copy(prev.quaternion);
    next.up.copy(prev.up);
    next.near = 0.1;
    next.far = Math.max(6000, prev.far || 6000);
    if (next instanceof THREE.OrthographicCamera && prev instanceof THREE.PerspectiveCamera) {
      const distance = Math.max(1, prev.position.distanceTo(scene.controls.target));
      const height = Math.max(10, 2 * distance * Math.tan((prev.fov * Math.PI) / 180 / 2));
      next.top = height / 2;
      next.bottom = -height / 2;
      next.left = -(height * aspect) / 2;
      next.right = (height * aspect) / 2;
      next.zoom = 1;
    } else if (next instanceof THREE.PerspectiveCamera && prev instanceof THREE.OrthographicCamera) {
      const height = Math.max(10, (prev.top - prev.bottom) / Math.max(0.01, prev.zoom));
      const fov = technicalRef.current ? 14 : 34;
      next.fov = fov;
      next.aspect = aspect;
      const distance = (height / 2) / Math.tan((fov * Math.PI) / 180 / 2);
      const dir = prev.position.clone().sub(scene.controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      next.position.copy(scene.controls.target).addScaledVector(dir, distance);
      next.near = Math.max(0.1, distance / 100);
      next.far = distance * 30;
    } else if (next instanceof THREE.PerspectiveCamera) {
      next.aspect = aspect;
    } else {
      const height = next.top - next.bottom;
      next.left = -(height * aspect) / 2;
      next.right = (height * aspect) / 2;
    }
    next.updateProjectionMatrix();
    scene.camera = next;
    scene.controls.object = next;
    scene.controls.update();
  }, [projection]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.scene.remove(scene.bed);
    scene.bed.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      }
    });
    const bed = createBed(bedWidth, bedDepth, bedStyle, customSurface);
    scene.scene.add(bed);
    scene.bed = bed;
    requestAnimationFrame(doFit);
  }, [bedWidth, bedDepth, bedStyle, customSurface]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    const old = modelRef.current;
    if (old) {
      scene.group.remove(old);
      old.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
    }
    const group = new THREE.Group();
    modelRef.current = group;
    scene.group.add(group);

    if (build) {
      const loader = new STLLoader();
      for (const [partIndex, part] of build.parts.entries()) {
        try {
          const binary = atob(part.stl_b64 || "");
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          const geometry = loader.parse(bytes.buffer);
          geometry.computeVertexNormals();
          const spec = createPartMaterial(part, partIndex, materialStyle, finish, secondaryColor, wireframe);
          if (spec.gradient) {
            geometry.computeBoundingBox();
            const bb = geometry.boundingBox;
            const minZ = bb?.min.z ?? 0;
            const maxZ = bb?.max.z ?? 1;
            const span = Math.max(0.001, maxZ - minZ);
            const position = geometry.getAttribute("position");
            const colors: number[] = [];
            const color = new THREE.Color();
            for (let vertex = 0; vertex < position.count; vertex += 1) {
              const t = Math.max(0, Math.min(1, (position.getZ(vertex) - minZ) / span));
              color.copy(spec.base).lerp(spec.second, t);
              colors.push(color.r, color.g, color.b);
            }
            geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
          }
          const material = spec.material;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(...(part.preview_offset || [0, 0, 0]));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.partName = part.name;
          mesh.userData.assetId = part.assetId;
          mesh.userData.assetName = part.assetName;
          mesh.userData.partIndex = partIndex;
          mesh.userData.basePosition = mesh.position.clone();
          group.add(mesh);
          if (showEdges) {
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry, 28),
              new THREE.LineBasicMaterial({ color: 0x7d4d63, transparent: true, opacity: 0.28 }),
            );
            edges.position.copy(mesh.position);
            edges.userData.partName = part.name;
            edges.userData.assetId = part.assetId;
            edges.userData.partIndex = partIndex;
            edges.userData.basePosition = edges.position.clone();
            group.add(edges);
          }
        } catch (error) {
          console.error("No se pudo leer el STL de vista previa", part.name, error);
        }
      }
      const cutterNames = new Set(["Cortador", "Cortador espejo", "Impronta", "Multicortador", "Puzzle", "Cortador sándwich", "Set de cortadores"]);
      const visible =
        isolate === "all"
          ? null
          : isolate === "cutter"
            ? "cutter"
            : isolate === "stamp"
              ? "Sello"
              : "Impronta";
      group.children.forEach((obj) => {
        if (!visible || !obj.userData.partName) return;
        obj.visible = visible === "cutter"
          ? cutterNames.has(String(obj.userData.partName))
          : visible === "Sello"
            ? String(obj.userData.partName).startsWith("Sello")
            : obj.userData.partName === visible;
      });
    }
    if (cancelled) return;
    if (fitKey !== fitKeyRef.current) {
      fitKeyRef.current = fitKey;
      requestAnimationFrame(doFit);
    } else if (build) {
      requestAnimationFrame(() => {
        const box = new THREE.Box3().setFromObject(group);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          if (size.length() > 0) doFit();
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [build, showEdges, wireframe, isolate, finish, materialStyle, secondaryColor]);

  useEffect(() => {
    const group = modelRef.current;
    if (!group) return;
    group.position.y = showDough ? 4 : 0;
    requestAnimationFrame(doFit);
  }, [showDough, build]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const old = stageRef.current;
    if (old) {
      scene.scene.remove(old);
      disposeObject(old);
    }
    const stage = new THREE.Group();
    stageRef.current = stage;
    scene.scene.add(stage);
    const model = modelRef.current;
    if (!build || !model || !showDough) {
      requestAnimationFrame(doFit);
      return;
    }
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    stage.add(createDoughStage(primaryShape, box, showCookie, showScale, doughColor, cookieColor, bedWidth, bedDepth));
    requestAnimationFrame(doFit);
  }, [build, primaryShape, showDough, showCookie, showScale, doughColor, cookieColor, bedWidth, bedDepth]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const old = measurementsRef.current;
    if (old) {
      scene.scene.remove(old);
      disposeObject(old);
      measurementsRef.current = null;
    }
    const model = modelRef.current;
    if (!measurements || !build || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const group = createMeasurements(box);
    measurementsRef.current = group;
    scene.scene.add(group);
  }, [build, measurements, showDough, finish, materialStyle]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.renderer.domElement.style.cursor = centerPick ? "crosshair" : "";
  }, [centerPick]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!(scene.camera instanceof THREE.PerspectiveCamera)) return;
    const fov = technical ? 14 : 34;
    if (Math.abs(scene.camera.fov - fov) > 0.01) {
      scene.camera.fov = fov;
      scene.camera.updateProjectionMatrix();
      requestAnimationFrame(doFit);
    }
  }, [technical]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.controls.autoRotate = !!autoRotate;
    scene.controls.autoRotateSpeed = 1.1;
  }, [autoRotate]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.bed.visible = showBed !== false;
    requestAnimationFrame(doFit);
  }, [showBed, bedStyle, bedWidth, bedDepth]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const grid = scene.bed.userData.grid as THREE.Group | undefined;
    if (grid) grid.visible = showGrid !== false;
  }, [showGrid, bedWidth, bedDepth, bedStyle]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.renderer.shadowMap.enabled = shadows !== false;
    scene.renderer.shadowMap.needsUpdate = true;
  }, [shadows]);

  useEffect(() => {
    const group = modelRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.assetId) {
        const material = obj.material as THREE.MeshStandardMaterial;
        material.transparent = !!xray;
        material.opacity = xray ? 0.42 : 1;
        material.depthWrite = !xray;
        material.needsUpdate = true;
      }
    });
  }, [xray, build, wireframe, showEdges, finish, materialStyle, secondaryColor]);

  useEffect(() => {
    const group = modelRef.current;
    if (!group) return;
    const lift = Number.isFinite(explode) ? Math.max(0, explode) : 0;
    group.children.forEach((obj) => {
      const base = obj.userData.basePosition as THREE.Vector3 | undefined;
      const index = Number(obj.userData.partIndex ?? 0);
      if (!base) return;
      obj.position.set(base.x, base.y, base.z + lift * (index + 1));
    });
  }, [explode, build]);

  useEffect(() => {
    const group = modelRef.current;
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.assetId) {
        const selected = selectedIds.includes(String(obj.userData.assetId));
        const material = obj.material as THREE.MeshStandardMaterial;
        material.emissive.set(selected ? 0xffb3c4 : 0x000000);
        material.emissiveIntensity = selected ? 0.28 : 0;
        material.needsUpdate = true;
      }
    });
  }, [selectedIds, build, wireframe, showEdges, finish, materialStyle, secondaryColor]);

  return <div className="viewport3d" ref={hostRef} />;
});

export default Viewport3D;
