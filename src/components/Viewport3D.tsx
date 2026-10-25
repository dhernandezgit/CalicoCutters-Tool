import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { BuildResult } from "../types";

export interface Viewport3DHandle {
  fit: () => void;
  fitModel: () => void;
  view: (kind: "iso" | "top" | "front" | "side") => void;
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
  autoRotate?: boolean;
  showBed?: boolean;
  showGrid?: boolean;
  shadows?: boolean;
  xray?: boolean;
  explode?: number;
  bedStyle?: "mauve" | "midnight" | "cream" | "rose";
  finish?: "matte" | "satin" | "gloss";
}

const COLORS: Record<string, number> = {
  Cortador: 0xf39ab1,
  Sello: 0xb7a4e8,
  Impronta: 0xf39ab1,
};

function createBed(width: number, depth: number, style: "mauve" | "midnight" | "cream" | "rose" = "mauve"): THREE.Group {
  const bed = new THREE.Group();
  const w = Math.max(20, width);
  const d = Math.max(20, depth);
  const palette = {
    mauve: { body: 0x3f303f, top: 0x594356, minor: 0xf7dfe8, major: 0xfff0f6, border: 0xf3c9d7 },
    midnight: { body: 0x252a35, top: 0x343b4b, minor: 0xdbe7f7, major: 0xf4f8ff, border: 0xaebdd8 },
    cream: { body: 0xcab5a4, top: 0xeadbc9, minor: 0x9b7c68, major: 0xfffaf3, border: 0xa88773 },
    rose: { body: 0x684252, top: 0x87596b, minor: 0xffe9f0, major: 0xfff7fa, border: 0xffc9dc },
  }[style];
  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.92, metalness: 0.02 });
  const topMat = new THREE.MeshStandardMaterial({ color: palette.top, roughness: 0.88, metalness: 0.01 });
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
  const makeGrid = (values: number[], color: number, opacity: number) => {
    if (!values.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
  };
  const grids = new THREE.Group();
  const minorGrid = makeGrid(minor, palette.minor, 0.3);
  const majorGrid = makeGrid(major, palette.major, 0.55);
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
    new THREE.LineBasicMaterial({ color: palette.border, transparent: true, opacity: 0.45 }),
  );
  bed.add(border);
  return bed;
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
    autoRotate = false,
    showBed = true,
    showGrid = true,
    shadows = true,
    xray = false,
    explode = 0,
    bedStyle = "mauve",
    finish = "satin",
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    group: THREE.Group;
    bed: THREE.Group;
    fit: () => void;
    view: (kind: "iso" | "top" | "front" | "side") => void;
    resize: () => void;
  } | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const fitKeyRef = useRef("");
  const selectRef = useRef<Props["onSelectAsset"]>(onSelectAsset);
  selectRef.current = onSelectAsset;

  const doFit = () => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    if (scene.bed.visible) {
      const bedBox = new THREE.Box3().setFromObject(scene.bed);
      if (!bedBox.isEmpty()) box.union(bedBox);
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    const fov = (scene.camera.fov * Math.PI) / 180;
    const fitHeight = radius / (2 * Math.tan(fov / 2));
    const fitWidth = fitHeight / Math.max(1, scene.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * 1.05 + radius * 0.08;
    const dir = new THREE.Vector3(0.72, 0.95, 1.25).normalize();
    scene.camera.position.copy(center).addScaledVector(dir, distance);
    scene.camera.near = Math.max(0.1, distance / 100);
    scene.camera.far = distance * 30;
    scene.camera.updateProjectionMatrix();
    scene.controls.target.copy(center);
    scene.controls.update();
    scene.controls.minDistance = Math.max(18, radius * 0.08);
    scene.controls.maxDistance = Math.max(1200, radius * 8);
  };

  const setView = (kind: "iso" | "top" | "front" | "side") => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    if (!scene || !model) return;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    if (scene.bed.visible) {
      const bedBox = new THREE.Box3().setFromObject(scene.bed);
      if (!bedBox.isEmpty()) box.union(bedBox);
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    const fov = (scene.camera.fov * Math.PI) / 180;
    const fitHeight = radius / (2 * Math.tan(fov / 2));
    const fitWidth = fitHeight / Math.max(1, scene.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * 1.05 + radius * 0.08;
    if (kind === "top") scene.camera.position.set(center.x, center.y + distance, center.z + 0.01);
    else if (kind === "front") scene.camera.position.set(center.x, center.y + radius * 0.25, center.z + distance);
    else if (kind === "side") scene.camera.position.set(center.x + distance, center.y + radius * 0.25, center.z + 0.01);
    else {
      const dir = new THREE.Vector3(0.72, 0.95, 1.25).normalize();
      scene.camera.position.copy(center).addScaledVector(dir, distance);
    }
    scene.camera.lookAt(center);
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
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 10);
    const fov = (scene.camera.fov * Math.PI) / 180;
    const fitHeight = radius / (2 * Math.tan(fov / 2));
    const fitWidth = fitHeight / Math.max(1, scene.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * 1.15 + radius * 0.08;
    const dir = new THREE.Vector3(0.72, 0.95, 1.25).normalize();
    scene.camera.position.copy(center).addScaledVector(dir, distance);
    scene.camera.near = Math.max(0.1, distance / 100);
    scene.camera.far = distance * 30;
    scene.camera.updateProjectionMatrix();
    scene.controls.target.copy(center);
    scene.controls.update();
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
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
    camera.position.set(100, 120, 170);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 600, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
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
      raycaster.setFromCamera(pointer, camera);
      const root = modelRef.current;
      if (!root) return;
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

    const bed = createBed(bedWidth, bedDepth, bedStyle);
    scene.add(bed);

    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;
    scene.add(group);

    let raf = 0;
    const resize = () => {
      const w = host.clientWidth || 800;
      const h = host.clientHeight || 600;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    window.addEventListener("resize", resize);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    sceneRef.current = { renderer, scene, camera, controls, group, bed, fit: doFit, view: setView, resize };
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
    scene.scene.remove(scene.bed);
    scene.bed.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.LineLoop) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      }
    });
    const bed = createBed(bedWidth, bedDepth, bedStyle);
    scene.scene.add(bed);
    scene.bed = bed;
    requestAnimationFrame(doFit);
  }, [bedWidth, bedDepth, bedStyle]);

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
          const material = new THREE.MeshStandardMaterial({
            color: part.color || new THREE.Color(COLORS[part.name] ?? 0xf39ab1).getHexString(),
            roughness: finish === "matte" ? 0.68 : finish === "gloss" ? 0.22 : 0.46,
            metalness: finish === "gloss" ? 0.08 : 0.015,
            wireframe,
            envMapIntensity: 0.5,
          });
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
      const cutterNames = new Set(["Cortador", "Cortador espejo", "Impronta", "Puzzle", "Cortador sándwich", "Set de cortadores"]);
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
  }, [build, showEdges, wireframe, isolate, finish]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
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
  }, [xray, build, wireframe, showEdges, finish]);

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
  }, [selectedIds, build, wireframe, showEdges, finish]);

  return <div className="viewport3d" ref={hostRef} />;
});

export default Viewport3D;
