import { Html, OrbitControls, Sparkles } from '@react-three/drei';
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildGraph } from '../../../entities/note/model/build-graph';
import {
  filterNoteIds,
  hasActiveGraphFilter,
} from '../../../entities/note/model/filter-notes';
import { useWorkspaceData } from '../../../features/workspace/model/workspace-provider';
import { calculateSphereLayout } from '../../../shared/lib/graph/sphere-layout';
import { calculateHelixLayout } from '../../../shared/lib/graph/helix-layout';
import { calculateForceLayout } from '../../../shared/lib/graph/force-layout';
import { calculateCategoryLayout } from '../../../shared/lib/graph/category-layout';
import { calculateTagLayout } from '../../../shared/lib/graph/tag-layout';
import {
  cameraDistanceRange,
  useGraphStore,
  type GraphLayoutMode,
} from '../model/store';
import type {
  GraphEdge,
  GraphFilter,
  GraphModel,
  GraphNode,
  GraphPosition,
} from '../../../entities/note/model/graph-types';
import styles from './OrbitGraph.module.css';

type GraphCluster = {
  id: string;
  name: string;
  count: number;
  color: string;
  center: GraphPosition;
  radius: number;
  memberTargets: Array<{ id: string; position: GraphPosition }>;
};

const tagClusterColors = ['#7fa8ff', '#d892ff', '#66dbc3', '#ffc77a'];

function buildClusters({
  nodes,
  layoutMode,
  categoryById,
  tagById,
}: {
  nodes: GraphNode[];
  layoutMode: GraphLayoutMode;
  categoryById: Map<string, { id: string; name: string; color: string }>;
  tagById: Map<string, { id: string; name: string }>;
}): GraphCluster[] {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const groupId =
      layoutMode === 'category'
        ? node.categoryId
        : layoutMode === 'tag'
          ? node.tagIds[0]
          : undefined;
    if (!groupId) continue;
    groups.set(groupId, [...(groups.get(groupId) ?? []), node]);
  }

  return [...groups.entries()].flatMap(([id, groupNodes], index) => {
    const center = groupNodes.reduce<GraphPosition>(
      (sum, node) => ({
        x: sum.x + node.position.x / groupNodes.length,
        y: sum.y + node.position.y / groupNodes.length,
        z: sum.z + node.position.z / groupNodes.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const radius = Math.max(
      4.2,
      ...groupNodes.map(
        (node) =>
          Math.hypot(
            node.position.x - center.x,
            node.position.y - center.y,
            node.position.z - center.z,
          ) + 3.4,
      ),
    );
    const category = categoryById.get(id);
    const tag = tagById.get(id);

    return category || tag
      ? [
          {
            id,
            name: category?.name ?? `#${tag?.name ?? 'Tag'}`,
            count: groupNodes.length,
            color:
              category?.color ??
              tagClusterColors[index % tagClusterColors.length],
            center,
            radius,
            memberTargets: groupNodes.map(({ id, position }) => ({
              id,
              position,
            })),
          },
        ]
      : [];
  });
}

function EdgeLayer({
  edges,
  positionsRef,
  related,
}: {
  edges: GraphEdge[];
  positionsRef: MutableRefObject<Map<string, THREE.Vector3>>;
  related: boolean;
}) {
  const lineSegments = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3),
    );
    const material = new THREE.LineBasicMaterial({
      color: related ? '#8f7cff' : '#5d719d',
      transparent: true,
      opacity: related ? 0.42 : 0.68,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    return lines;
  }, [edges.length, related]);

  useEffect(
    () => () => {
      lineSegments.geometry.dispose();
      (lineSegments.material as THREE.Material).dispose();
    },
    [lineSegments],
  );

  useFrame(() => {
    const positions = lineSegments.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;

    edges.forEach((edge, index) => {
      const source = positionsRef.current.get(edge.sourceId);
      const target = positionsRef.current.get(edge.targetId);
      if (!source || !target) return;
      const offset = index * 2;
      positions.setXYZ(offset, source.x, source.y, source.z);
      positions.setXYZ(offset + 1, target.x, target.y, target.z);
    });
    positions.needsUpdate = true;
  });

  return <primitive object={lineSegments} />;
}

function HierarchyFlowLayer({
  edges,
  positionsRef,
}: {
  edges: GraphEdge[];
  positionsRef: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const flowParticles = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(edges.length * 3), 3),
    );
    const haloMaterial = new THREE.PointsMaterial({
      color: '#86a9ff',
      map: getNodeGlowTexture(),
      size: 0.56,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.01,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const coreMaterial = new THREE.PointsMaterial({
      color: '#ffffff',
      map: getNodeGlowTexture(),
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1,
      alphaTest: 0.04,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const halo = new THREE.Points(geometry, haloMaterial);
    const core = new THREE.Points(geometry, coreMaterial);
    halo.frustumCulled = false;
    core.frustumCulled = false;
    const group = new THREE.Group();
    group.add(halo, core);
    return { geometry, group, haloMaterial, coreMaterial };
  }, [edges.length]);

  useEffect(
    () => () => {
      flowParticles.geometry.dispose();
      flowParticles.haloMaterial.dispose();
      flowParticles.coreMaterial.dispose();
    },
    [flowParticles],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const positions = flowParticles.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    edges.forEach((edge, index) => {
      const source = positionsRef.current.get(edge.sourceId);
      const target = positionsRef.current.get(edge.targetId);
      if (!source || !target) return;
      const phase = index / Math.max(edges.length, 1);
      const progress = 0.08 + ((elapsed * 0.16 + phase) % 1) * 0.84;
      positions.setXYZ(
        index,
        THREE.MathUtils.lerp(source.x, target.x, progress),
        THREE.MathUtils.lerp(source.y, target.y, progress),
        THREE.MathUtils.lerp(source.z, target.z, progress),
      );
    });
    positions.needsUpdate = true;
  });

  return <primitive object={flowParticles.group} />;
}

function getFrameDistance(
  nodes: GraphNode[],
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): number {
  if (nodes.length === 0) return 19;
  const horizontalExtent = Math.max(
    ...nodes.map((node) => Math.abs(node.position.x) + node.radius),
  );
  const verticalExtent = Math.max(
    ...nodes.map((node) => Math.abs(node.position.y) + node.radius),
  );
  const depthExtent = Math.max(
    ...nodes.map((node) => Math.abs(node.position.z) + node.radius),
  );
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * (width / height));
  const distance =
    Math.max(
      horizontalExtent / Math.tan(horizontalFov / 2),
      verticalExtent / Math.tan(verticalFov / 2),
    ) *
      1.18 +
    depthExtent;

  return Math.max(8, Math.min(distance, 24));
}

function getPreferredDpr(nodeCount: number) {
  if (typeof window === 'undefined') return 1.5;
  const isSmallScreen = window.matchMedia('(max-width: 900px)').matches;
  const hasLimitedCpu = (navigator.hardwareConcurrency ?? 4) <= 4;
  if (nodeCount > 180) return 1;
  if (nodeCount > 80 || isSmallScreen || hasLimitedCpu) return 1.15;
  return 1.5;
}

function useGraphDpr(nodeCount: number) {
  const [dpr, setDpr] = useState(() => getPreferredDpr(nodeCount));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setDpr(getPreferredDpr(nodeCount));
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [nodeCount]);

  return dpr;
}

function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return isVisible;
}

function CanvasViewportSync() {
  const { gl, setSize } = useThree();

  useLayoutEffect(() => {
    const container = gl.domElement.closest('.graph-canvas');
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize(width, height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [gl, setSize]);

  return null;
}

function calculateLayout(
  graph: GraphModel,
  layoutMode: GraphLayoutMode,
): Map<string, THREE.Vector3 | { x: number; y: number; z: number }> {
  switch (layoutMode) {
    case 'force':
      return calculateForceLayout(graph);
    case 'category':
      return calculateCategoryLayout(graph);
    case 'tag':
      return calculateTagLayout(graph);
    case 'sphere':
      return calculateSphereLayout(graph);
    case 'helix':
      return calculateHelixLayout(graph);
    default:
      return calculateForceLayout(graph);
  }
}

function CameraDirector({
  nodes,
  selectedNode,
  resetVersion,
  controlsRef,
}: {
  nodes: GraphNode[];
  selectedNode: GraphNode | undefined;
  resetVersion: number;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size } = useThree();
  const canvasWidth = size.width;
  const canvasHeight = size.height;
  const sizeRef = useRef({ width: canvasWidth, height: canvasHeight });
  const previousCanvasSizeRef = useRef({
    width: canvasWidth,
    height: canvasHeight,
  });
  const desiredPosition = useRef(new THREE.Vector3(0, 0, 19));
  const desiredTarget = useRef(new THREE.Vector3());
  const isTransitioning = useRef(true);
  const requestedCameraDistance = useGraphStore(
    (state) => state.requestedCameraDistance,
  );
  const cameraZoomRequestVersion = useGraphStore(
    (state) => state.cameraZoomRequestVersion,
  );
  const syncCameraDistance = useGraphStore((state) => state.syncCameraDistance);

  useEffect(() => {
    sizeRef.current = { width: canvasWidth, height: canvasHeight };
  }, [canvasHeight, canvasWidth]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const cancelTransition = () => {
      isTransitioning.current = false;
    };
    const syncZoomControl = () => {
      syncCameraDistance(camera.position.distanceTo(controls.target));
    };
    controls.addEventListener('start', cancelTransition);
    controls.addEventListener('change', syncZoomControl);
    syncZoomControl();
    return () => {
      controls.removeEventListener('start', cancelTransition);
      controls.removeEventListener('change', syncZoomControl);
    };
  }, [camera, controlsRef, syncCameraDistance]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const canvasSize = sizeRef.current;
    desiredPosition.current.set(
      0,
      0,
      getFrameDistance(nodes, camera, canvasSize.width, canvasSize.height),
    );
    desiredTarget.current.set(0, 0, 0);
    isTransitioning.current = true;
  }, [camera, nodes, resetVersion]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const previousSize = previousCanvasSizeRef.current;
    previousCanvasSizeRef.current = {
      width: canvasWidth,
      height: canvasHeight,
    };
    if (
      previousSize.width === canvasWidth &&
      previousSize.height === canvasHeight
    ) {
      return;
    }

    const controls = controlsRef.current;
    const target = controls?.target ?? desiredTarget.current;
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() === 0) direction.set(0, 0, 1);

    desiredTarget.current.copy(target);
    desiredPosition.current
      .copy(target)
      .add(
        direction
          .normalize()
          .multiplyScalar(
            getFrameDistance(nodes, camera, canvasWidth, canvasHeight),
          ),
      );
    isTransitioning.current = true;
  }, [camera, canvasHeight, canvasWidth, controlsRef, nodes]);

  useEffect(() => {
    if (!selectedNode) return;

    const currentTarget = controlsRef.current?.target ?? new THREE.Vector3();
    const direction = camera.position.clone().sub(currentTarget).normalize();
    desiredPosition.current
      .copy(direction.multiplyScalar(8.5))
      .add(
        new THREE.Vector3(
          selectedNode.position.x,
          selectedNode.position.y,
          selectedNode.position.z,
        ),
      );
    desiredTarget.current.set(
      selectedNode.position.x,
      selectedNode.position.y,
      selectedNode.position.z,
    );
    isTransitioning.current = true;
  }, [camera.position, controlsRef, selectedNode]);

  useEffect(() => {
    if (cameraZoomRequestVersion === 0) return;

    const currentTarget = controlsRef.current?.target ?? new THREE.Vector3();
    const direction = camera.position.clone().sub(currentTarget).normalize();
    desiredPosition.current
      .copy(direction.multiplyScalar(requestedCameraDistance))
      .add(currentTarget);
    desiredTarget.current.copy(currentTarget);
    isTransitioning.current = true;
  }, [camera, cameraZoomRequestVersion, controlsRef, requestedCameraDistance]);

  useFrame((_, delta) => {
    if (!isTransitioning.current) return;

    const blend = 1 - Math.exp(-4.5 * delta);
    camera.position.lerp(desiredPosition.current, blend);
    controlsRef.current?.target.lerp(desiredTarget.current, blend);
    controlsRef.current?.update();

    const targetDistance =
      controlsRef.current?.target.distanceTo(desiredTarget.current) ?? 0;
    if (
      camera.position.distanceTo(desiredPosition.current) < 0.01 &&
      targetDistance < 0.01
    ) {
      camera.position.copy(desiredPosition.current);
      controlsRef.current?.target.copy(desiredTarget.current);
      controlsRef.current?.update();
      isTransitioning.current = false;
    }
  });

  return null;
}

let sharedNodeGlowTexture: THREE.CanvasTexture | null = null;
let sharedClusterAuraTexture: THREE.CanvasTexture | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sharedNodeGlowTexture?.dispose();
    sharedClusterAuraTexture?.dispose();
    sharedNodeGlowTexture = null;
    sharedClusterAuraTexture = null;
  });
}

function getNodeGlowTexture() {
  if (sharedNodeGlowTexture) return sharedNodeGlowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
  gradient.addColorStop(0.22, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(0.58, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  sharedNodeGlowTexture = new THREE.CanvasTexture(canvas);
  return sharedNodeGlowTexture;
}

function getClusterAuraTexture() {
  if (sharedClusterAuraTexture) return sharedClusterAuraTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
  gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.16)');
  gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.045)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  sharedClusterAuraTexture = new THREE.CanvasTexture(canvas);
  return sharedClusterAuraTexture;
}

function NodeGlow({
  color,
  radius,
  active,
  hovered,
  dimmed,
}: {
  color: string;
  radius: number;
  active: boolean;
  hovered: boolean;
  dimmed: boolean;
}) {
  const texture = getNodeGlowTexture();

  const scale = radius * (active ? 5.9 : hovered ? 5.1 : 4.5);
  return (
    <sprite scale={[scale, scale, 1]}>
      <spriteMaterial
        map={texture}
        color={color}
        transparent
        opacity={dimmed ? 0.02 : active ? 0.56 : hovered ? 0.42 : 0.25}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  );
}

function Node({
  node,
  connected,
  searchMatch,
  dimmed,
  detail,
  positionsRef,
  onOpenNote,
  categoryName,
  categoryColor,
  tagNames,
}: {
  node: GraphNode;
  connected: boolean;
  searchMatch: boolean;
  dimmed: boolean;
  detail: number;
  positionsRef: MutableRefObject<Map<string, THREE.Vector3>>;
  onOpenNote: (noteId: string) => void;
  categoryName: string;
  categoryColor: string;
  tagNames: string[];
}) {
  const { selectedNoteId, hoveredNoteId, selectNote, hoverNote } =
    useGraphStore();
  const active = selectedNoteId === node.id;
  const hovered = hoveredNoteId === node.id;
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPosition = useMemo(
    () => new THREE.Vector3(node.position.x, node.position.y, node.position.z),
    [node.position.x, node.position.y, node.position.z],
  );
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || positionsRef.current.has(node.id)) return;

    mesh.position.copy(targetPosition);
    positionsRef.current.set(node.id, mesh.position.clone());
  }, [node.id, positionsRef, targetPosition]);
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const blend = 1 - Math.exp(-4.2 * delta);
    mesh.position.lerp(targetPosition, blend);
    const trackedPosition = positionsRef.current.get(node.id);
    if (trackedPosition) {
      trackedPosition.copy(mesh.position);
    } else {
      positionsRef.current.set(node.id, mesh.position.clone());
    }
  });
  const coreColor = useMemo(
    () =>
      new THREE.Color(node.color).lerp(
        new THREE.Color('#ffffff'),
        active ? 0.42 : 0.2,
      ),
    [active, node.color],
  );
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectNote(node.id);
  };
  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        hoverNote(node.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        hoverNote(null);
        document.body.style.cursor = 'default';
      }}
    >
      <sphereGeometry
        args={[
          node.radius *
            (active
              ? 1.32
              : hovered || connected || searchMatch
                ? 1.15
                : dimmed
                  ? 0.72
                  : 1),
          detail,
          detail,
        ]}
      />
      <meshPhysicalMaterial
        color={node.color}
        emissive={node.color}
        emissiveIntensity={
          active
            ? 1.25
            : searchMatch
              ? 0.95
              : hovered || connected
                ? 0.75
                : dimmed
                  ? 0.04
                  : 0.5
        }
        roughness={0.16}
        metalness={0.28}
        clearcoat={0.8}
        clearcoatRoughness={0.22}
        transparent
        opacity={dimmed ? 0.16 : 1}
        toneMapped={false}
      />
      <mesh scale={0.38}>
        <sphereGeometry
          args={[
            node.radius,
            Math.max(10, detail - 6),
            Math.max(10, detail - 6),
          ]}
        />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={active ? 0.95 : 0.72}
          toneMapped={false}
        />
      </mesh>
      <NodeGlow
        color={node.color}
        radius={node.radius}
        active={active || searchMatch}
        hovered={hovered || connected}
        dimmed={dimmed}
      />
      {active ? (
        <Html center distanceFactor={28}>
          <div className={styles.nodeNotePopover}>
            <strong className={styles.nodeNoteTitle}>{node.title}</strong>
            <div className={styles.nodeNoteMeta}>
              <span className={styles.nodeNoteCategory}>
                <i style={{ backgroundColor: categoryColor }} />
                {categoryName}
              </span>
              {tagNames.map((tagName) => (
                <span key={tagName} className={styles.nodeNoteTag}>
                  #{tagName}
                </span>
              ))}
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenNote(node.id);
              }}
            >
              View
            </button>
          </div>
        </Html>
      ) : hovered || searchMatch ? (
        <Html center distanceFactor={28} style={{ pointerEvents: 'none' }}>
          <span className={styles.nodeLabel}>{node.title}</span>
        </Html>
      ) : null}
    </mesh>
  );
}

function ClusterLegend({
  clusters,
  layoutMode,
}: {
  clusters: GraphCluster[];
  layoutMode: GraphLayoutMode;
}) {
  if (clusters.length === 0) return null;

  return (
    <aside className={styles.clusterLegend} aria-label="Cluster guide">
      <div className={styles.clusterLegendHeading}>
        <span className={styles.clusterLegendTitle}>Cluster areas</span>
        <small>{layoutMode === 'category' ? 'By category' : 'By tag'}</small>
      </div>
      <div className={styles.clusterLegendItems}>
        {clusters.map((cluster) => (
          <div key={cluster.id} className={styles.clusterLegendItem}>
            <i
              className={styles.clusterLegendAura}
              style={{ '--cluster-color': cluster.color } as CSSProperties}
            />
            <span>{cluster.name}</span>
            <small>({cluster.count})</small>
          </div>
        ))}
      </div>
    </aside>
  );
}

function ClusterAura({
  cluster,
  positionsRef,
}: {
  cluster: GraphCluster;
  positionsRef: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const opacityRef = useRef(0);

  useLayoutEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const positions = cluster.memberTargets.flatMap(({ id }) => {
      const position = positionsRef.current.get(id);
      return position ? [position] : [];
    });
    if (positions.length === 0) return;

    const center = positions.reduce(
      (sum, position) => sum.add(position),
      new THREE.Vector3(),
    );
    center.divideScalar(positions.length);
    const radius = Math.max(
      4.2,
      ...positions.map((position) => position.distanceTo(center) + 3.4),
    );
    sprite.position.copy(center);
    sprite.scale.set(radius * 2, radius * 2, 1);
    (sprite.material as THREE.SpriteMaterial).opacity = 0;
  }, [cluster.memberTargets, positionsRef]);

  useFrame((_, delta) => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const positions = cluster.memberTargets.flatMap(({ id, position }) => {
      const current = positionsRef.current.get(id);
      return current ? [{ current, target: position }] : [];
    });
    if (positions.length === 0) return;

    const center = positions.reduce(
      (sum, { current }) => sum.add(current),
      new THREE.Vector3(),
    );
    center.divideScalar(positions.length);
    const radius = Math.max(
      4.2,
      ...positions.map(({ current }) => current.distanceTo(center) + 3.4),
    );
    const averageDistanceToTarget =
      positions.reduce(
        (sum, { current, target }) => sum + current.distanceTo(target),
        0,
      ) / positions.length;
    const settled =
      1 - THREE.MathUtils.clamp(averageDistanceToTarget / 6, 0, 1);
    const targetOpacity =
      0.34 * THREE.MathUtils.smoothstep(settled, 0.42, 0.96);

    sprite.position.copy(center);
    sprite.scale.set(radius * 2, radius * 2, 1);
    opacityRef.current = THREE.MathUtils.damp(
      opacityRef.current,
      targetOpacity,
      5,
      delta,
    );
    (sprite.material as THREE.SpriteMaterial).opacity = opacityRef.current;
  });

  return (
    <sprite
      ref={spriteRef}
      position={[cluster.center.x, cluster.center.y, cluster.center.z]}
      scale={[cluster.radius * 2, cluster.radius * 2, 1]}
      renderOrder={-3}
    >
      <spriteMaterial
        map={getClusterAuraTexture()}
        color={cluster.color}
        transparent
        opacity={0.34}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  );
}

function ClusterAuras({
  clusters,
  positionsRef,
}: {
  clusters: GraphCluster[];
  positionsRef: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  return clusters.map((cluster) => (
    <ClusterAura
      key={cluster.id}
      cluster={cluster}
      positionsRef={positionsRef}
    />
  ));
}

function GraphScene({
  onOpenNote,
  onClustersChange,
}: {
  onOpenNote: (noteId: string) => void;
  onClustersChange: (clusters: GraphCluster[]) => void;
}) {
  const { categories, notes, relations, tags } = useWorkspaceData();
  const layoutMode = useGraphStore((state) => state.layoutMode);
  const selectedCategoryIds = useGraphStore(
    (state) => state.selectedCategoryIds,
  );
  const selectedTagIds = useGraphStore((state) => state.selectedTagIds);
  const showEdges = useGraphStore((state) => state.showEdges);
  const filter = useMemo<GraphFilter>(
    () => ({
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
    }),
    [selectedCategoryIds, selectedTagIds],
  );
  const activeFilter = hasActiveGraphFilter(filter);
  const matchingNoteIds = useMemo(
    () => filterNoteIds(notes, filter),
    [filter, notes],
  );
  const graph = useMemo(() => {
    const model = buildGraph(notes, relations, categories);
    const basePositions = calculateLayout(model, layoutMode);
    if (!activeFilter) {
      return {
        ...model,
        nodes: model.nodes.map((node) => ({
          ...node,
          position: basePositions.get(node.id) ?? node.position,
        })),
      };
    }

    const filteredModel: GraphModel = {
      nodes: model.nodes.filter((node) => matchingNoteIds.has(node.id)),
      edges: model.edges.filter(
        (edge) =>
          matchingNoteIds.has(edge.sourceId) &&
          matchingNoteIds.has(edge.targetId),
      ),
    };
    const filteredPositions = filteredModel.nodes.length
      ? calculateLayout(filteredModel, layoutMode)
      : new Map();

    return {
      ...model,
      nodes: model.nodes.map((node) => {
        const position = basePositions.get(node.id) ?? node.position;
        if (matchingNoteIds.has(node.id)) {
          return {
            ...node,
            position: filteredPositions.get(node.id) ?? position,
          };
        }
        return {
          ...node,
          position: {
            x: position.x * 1.5,
            y: position.y * 1.5,
            z: position.z * 1.5,
          },
        };
      }),
    };
  }, [activeFilter, categories, layoutMode, matchingNoteIds, notes, relations]);
  const byId = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const clusterNodes = useMemo(
    () =>
      activeFilter
        ? graph.nodes.filter((node) => matchingNoteIds.has(node.id))
        : graph.nodes,
    [activeFilter, graph.nodes, matchingNoteIds],
  );
  const clusters = useMemo(
    () =>
      layoutMode === 'category' || layoutMode === 'tag'
        ? buildClusters({
            nodes: clusterNodes,
            layoutMode,
            categoryById,
            tagById,
          })
        : [],
    [categoryById, clusterNodes, layoutMode, tagById],
  );

  useEffect(() => {
    onClustersChange(clusters);
  }, [clusters, onClustersChange]);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const positionsRef = useRef(new Map<string, THREE.Vector3>());
  const isDocumentVisible = useDocumentVisibility();
  const selectNote = useGraphStore((state) => state.selectNote);
  const selectedNoteId = useGraphStore((state) => state.selectedNoteId);
  const searchQuery = useGraphStore((state) => state.searchQuery);
  const resetVersion = useGraphStore((state) => state.resetVersion);

  useEffect(() => {
    const activeNodeIds = new Set(graph.nodes.map((node) => node.id));

    for (const noteId of positionsRef.current.keys()) {
      if (!activeNodeIds.has(noteId)) positionsRef.current.delete(noteId);
    }
  }, [graph.nodes]);

  const searchMatchIds = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return new Set(
      query
        ? graph.nodes
            .filter((node) => node.title.toLocaleLowerCase().includes(query))
            .map((node) => node.id)
        : [],
    );
  }, [graph.nodes, searchQuery]);
  const connectedNodeIds = useMemo(() => {
    if (!selectedNoteId) return new Set<string>();
    return new Set(
      graph.edges.flatMap((edge) => {
        if (edge.sourceId === selectedNoteId) return [edge.targetId];
        if (edge.targetId === selectedNoteId) return [edge.sourceId];
        return [];
      }),
    );
  }, [graph.edges, selectedNoteId]);
  const displayedEdges = useMemo(() => {
    if (!showEdges) return [];
    if (selectedNoteId) {
      return graph.edges.filter(
        (edge) =>
          edge.sourceId === selectedNoteId || edge.targetId === selectedNoteId,
      );
    }
    return activeFilter
      ? graph.edges.filter(
          (edge) =>
            matchingNoteIds.has(edge.sourceId) &&
            matchingNoteIds.has(edge.targetId),
        )
      : graph.edges;
  }, [activeFilter, graph.edges, matchingNoteIds, selectedNoteId, showEdges]);
  const hierarchyEdges = useMemo(
    () => displayedEdges.filter((edge) => edge.type === 'hierarchy'),
    [displayedEdges],
  );
  const relatedEdges = useMemo(
    () => displayedEdges.filter((edge) => edge.type === 'related'),
    [displayedEdges],
  );
  const selectedNode = selectedNoteId ? byId.get(selectedNoteId) : undefined;
  const dpr = useGraphDpr(graph.nodes.length);
  const nodeDetail =
    graph.nodes.length > 220 ? 10 : graph.nodes.length > 80 ? 14 : 22;
  const sparkleCount =
    graph.nodes.length === 0
      ? 72
      : Math.max(36, Math.min(96, 120 - graph.nodes.length * 0.35));
  const enableBloom = dpr > 1 && graph.nodes.length <= 180;

  return (
    <Canvas
      camera={{ position: [0, 1, 19], fov: 100 }}
      dpr={[1, dpr]}
      frameloop={isDocumentVisible ? 'always' : 'never'}
      resize={{ scroll: true, debounce: { resize: 0, scroll: 50 } }}
      style={{ width: '100%', height: '100%' }}
      gl={{
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      onPointerMissed={() => selectNote(null)}
    >
      <CanvasViewportSync />
      <color attach="background" args={['#080b14']} />
      <fog attach="fog" args={['#080b14', 20, 50]} />
      <ambientLight intensity={0.18} />
      <hemisphereLight args={['#c2d4ff', '#11172c', 1.15]} />
      <pointLight position={[6, 8, 10]} intensity={48} color="#8eb5ff" />
      <pointLight position={[-8, -5, 4]} intensity={30} color="#cb91ff" />
      <Sparkles
        count={sparkleCount}
        scale={[28, 22, 20]}
        size={0.85}
        speed={0.018}
        opacity={0.18}
        color="#92a9de"
        noise={0.16}
      />
      <CameraDirector
        nodes={graph.nodes}
        selectedNode={selectedNode}
        resetVersion={resetVersion}
        controlsRef={controlsRef}
      />
      <ClusterAuras clusters={clusters} positionsRef={positionsRef} />
      {hierarchyEdges.length > 0 && (
        <>
          <EdgeLayer
            edges={hierarchyEdges}
            positionsRef={positionsRef}
            related={false}
          />
          <HierarchyFlowLayer
            edges={hierarchyEdges}
            positionsRef={positionsRef}
          />
        </>
      )}
      {relatedEdges.length > 0 && (
        <EdgeLayer edges={relatedEdges} positionsRef={positionsRef} related />
      )}
      {graph.nodes.map((node) => (
        <Node
          key={node.id}
          node={node}
          connected={connectedNodeIds.has(node.id)}
          searchMatch={searchMatchIds.has(node.id)}
          detail={nodeDetail}
          dimmed={activeFilter && !matchingNoteIds.has(node.id)}
          positionsRef={positionsRef}
          onOpenNote={onOpenNote}
          categoryName={
            categoryById.get(node.categoryId)?.name ?? 'Uncategorized'
          }
          categoryColor={categoryById.get(node.categoryId)?.color ?? node.color}
          tagNames={node.tagIds.flatMap((tagId) => {
            const tag = tagById.get(tagId);
            return tag ? [tag.name] : [];
          })}
        />
      ))}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        minDistance={6}
        maxDistance={30}
      />
      {enableBloom && (
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={0.98}
            luminanceThreshold={0.14}
            luminanceSmoothing={0.7}
            radius={0.6}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}

const layoutOptions: Array<{ mode: GraphLayoutMode; label: string }> = [
  { mode: 'force', label: 'Default' },
  { mode: 'sphere', label: 'Sphere' },
  { mode: 'helix', label: 'Helix' },
  { mode: 'category', label: 'Category' },
  { mode: 'tag', label: 'Tag' },
];

export function OrbitGraph({
  onCreateNote,
  onOpenNote,
}: {
  onCreateNote: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const { error, isLoading, notes, reload } = useWorkspaceData();
  const [clusters, setClusters] = useState<GraphCluster[]>([]);
  const layoutMode = useGraphStore((state) => state.layoutMode);
  const setLayoutMode = useGraphStore((state) => state.setLayoutMode);
  const cameraDistance = useGraphStore((state) => state.cameraDistance);
  const requestCameraZoom = useGraphStore((state) => state.requestCameraZoom);
  const resetCamera = useGraphStore((state) => state.resetCamera);
  const zoomProgress =
    ((cameraDistanceRange.max - cameraDistance) /
      (cameraDistanceRange.max - cameraDistanceRange.min)) *
    100;
  const zoomPercentage = Math.round(100 + zoomProgress);
  const updateZoomFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(0, (event.clientY - bounds.top) / bounds.height),
    );
    requestCameraZoom(
      cameraDistanceRange.min +
        progress * (cameraDistanceRange.max - cameraDistanceRange.min),
    );
  };
  const handleZoomKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 2 : 0.5;
    const zoomBy = (amount: number) => {
      event.preventDefault();
      requestCameraZoom(cameraDistance + amount);
    };

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') zoomBy(-step);
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') zoomBy(step);
    if (event.key === 'Home') {
      event.preventDefault();
      requestCameraZoom(cameraDistanceRange.min);
    }
    if (event.key === 'End') {
      event.preventDefault();
      requestCameraZoom(cameraDistanceRange.max);
    }
  };

  return (
    <div className={styles.graphCanvas}>
      <GraphScene onOpenNote={onOpenNote} onClustersChange={setClusters} />
      <ClusterLegend clusters={clusters} layoutMode={layoutMode} />
      {isLoading && (
        <div className={styles.graphLoadingOverlay} aria-live="polite">
          <div>Loading your Orbit...</div>
        </div>
      )}
      {error && !isLoading && (
        <div
          className={`${styles.emptyOrbitOverlay} ${styles.graphErrorOverlay}`}
          role="alert"
        >
          <div className={styles.emptyOrbit}>
            <strong>Unable to load your Orbit.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 && !isLoading && !error && (
        <div className={styles.emptyOrbitOverlay} aria-live="polite">
          <div className={styles.emptyOrbit}>
            <strong>Your Orbit is empty.</strong>
            <span>Create your first note to start mapping connections.</span>
            <button type="button" onClick={onCreateNote}>
              Create note
            </button>
          </div>
        </div>
      )}
      <div className={styles.graphLayoutControls} aria-label="Graph layout">
        {layoutOptions.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={layoutMode === mode ? styles.active : ''}
            onClick={() => setLayoutMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.graphZoomControls} aria-label="Camera zoom">
        <div className={styles.zoomControlHeader}>
          <span>ZOOM</span>
          <output>{zoomPercentage}%</output>
          <button
            className={styles.zoomResetButton}
            type="button"
            aria-label="Reset camera"
            title="Reset camera"
            onClick={resetCamera}
          >
            ↺
          </button>
        </div>
        <div className={styles.zoomControlSlider}>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => requestCameraZoom(cameraDistance - 2)}
          >
            +
          </button>
          <div
            className={styles.zoomRange}
            style={{ '--zoom-progress': `${zoomProgress}%` } as CSSProperties}
            role="slider"
            tabIndex={0}
            aria-label="Camera zoom level"
            aria-valuemin={100}
            aria-valuemax={200}
            aria-valuenow={zoomPercentage}
            onKeyDown={handleZoomKeyDown}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateZoomFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                updateZoomFromPointer(event);
              }
            }}
          >
            <span className={styles.zoomRangeTrack} aria-hidden="true">
              <span className={styles.zoomRangeFill} />
            </span>
            <span className={styles.zoomRangeThumb} aria-hidden="true" />
          </div>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => requestCameraZoom(cameraDistance + 2)}
          >
            &minus;
          </button>
        </div>
      </div>
    </div>
  );
}
