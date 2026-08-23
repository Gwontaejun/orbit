import { useFrame } from '@react-three/fiber';
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MutableRefObject,
} from 'react';
import * as THREE from 'three';
import type { GraphLayoutMode } from '../model/graph-store';
import type { GraphCluster } from '../model/build-clusters';
import styles from './ClusterOverlay.module.css';

let sharedClusterAuraTexture: THREE.CanvasTexture | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sharedClusterAuraTexture?.dispose();
    sharedClusterAuraTexture = null;
  });
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

export function ClusterLegend({
  clusters,
  layoutMode,
}: {
  clusters: GraphCluster[];
  layoutMode: GraphLayoutMode;
}) {
  if (clusters.length === 0) return null;

  return (
    <aside className={styles.legend} aria-label="Cluster guide">
      <div className={styles.heading}>
        <span className={styles.title}>Cluster areas</span>
        <small>{layoutMode === 'category' ? 'By category' : 'By tag'}</small>
      </div>
      <div className={styles.items}>
        {clusters.map((cluster) => (
          <div key={cluster.id} className={styles.item}>
            <i
              className={styles.auraMarker}
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

export function ClusterAuras({
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
