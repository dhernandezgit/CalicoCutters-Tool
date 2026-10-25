import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { BuildResult } from "../types";

export interface Viewport3DHandle {
  fit: () => void;
  view: (kind: "iso" | "top" | "front" | "side") => void;
}

interface Props {
  build: BuildResult | null;
  showEdges: boolean;
  wireframe: boolean;
  isolate: "all" | "cutter" | "stamp" | "imprint";
  fitKey: string;
  selectedIds?: string[];
  onSelectAsset?: (id: string, additive: boolean) => void;
}

const COLORS: Record<string, number> = {
  Cortador: 0xf39ab1,
  Sello: 0xb7a4e8,
  Impronta: 0xf39ab1,
};

const Viewport3D = forwardRef<Viewport3DHandle, Props>(function Viewport3D(
  { build, showEdges, wireframe, isolate, fitKey, selectedIds = [], onSelectAsset },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    group: THREE.Group;
    ground: THREE.Mesh;
    grid: THREE.GridHelper;
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
    scene.ground.position.set(center.x, -0.02, center.z);
    scene.grid.position.set(center.x, 0, center.z);
    const gridSize = Math.max(160, Math.ceil(radius / 40) * 40 + 40);
    if (Math.abs(scene.grid.scale.x - gridSize / 200) > 0.01) {
      scene.grid.scale.setScalar(gridSize / 200);
    }
  };

  const setView = (kind: "iso" | "top" | "front" | "side") => {
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

  useImperativeHandle(ref, () => ({ fit: doFit, view: setView }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
    camera.position.set(100, 120, 170);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
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

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0xfffaf6, roughness: 0.96, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(200, 20, 0xeec6d5, 0xf4dce5);
    grid.position.y = 0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.65;
    scene.add(grid);

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

    sceneRef.current = { renderer, scene, camera, controls, group, ground, grid, fit: doFit, view: setView, resize };
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
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
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
      for (const part of build.parts) {
        try {
          const binary = atob(part.stl_b64 || "");
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          const geometry = loader.parse(bytes.buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: part.color || new THREE.Color(COLORS[part.name] ?? 0xf39ab1).getHexString(),
            roughness: 0.46,
            metalness: 0.015,
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
          group.add(mesh);
          if (showEdges) {
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry, 28),
              new THREE.LineBasicMaterial({ color: 0x7d4d63, transparent: true, opacity: 0.28 }),
            );
            edges.position.copy(mesh.position);
            edges.userData.partName = part.name;
            edges.userData.assetId = part.assetId;
            group.add(edges);
          }
        } catch (error) {
          console.error("No se pudo leer el STL de vista previa", part.name, error);
        }
      }
      const visible =
        isolate === "all"
          ? null
          : isolate === "cutter"
            ? "Cortador"
            : isolate === "stamp"
              ? "Sello"
              : "Impronta";
      group.children.forEach((obj) => {
        if (visible && obj.userData.partName) obj.visible = obj.userData.partName === visible;
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
  }, [build, showEdges, wireframe, isolate]);

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
  }, [selectedIds, build]);

  return <div className="viewport3d" ref={hostRef} />;
});

export default Viewport3D;
