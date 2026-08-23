import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { GraphNode as GraphNodeModel } from '@/entities/note';
import { getNodeGlowTexture } from '../lib/node-glow-texture';
import { useGraphStore } from '../model/graph-store';
import styles from './GraphNode.module.css';

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
  const scale = radius * (active ? 5.9 : hovered ? 5.1 : 4.5);
  return (
    <sprite scale={[scale, scale, 1]}>
      <spriteMaterial
        map={getNodeGlowTexture()}
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

export function GraphNode({
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
  node: GraphNodeModel;
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
          <div className={styles.notePopover}>
            <strong className={styles.noteTitle}>{node.title}</strong>
            <div className={styles.noteMeta}>
              <span className={styles.noteCategory}>
                <i style={{ backgroundColor: categoryColor }} />
                {categoryName}
              </span>
              {tagNames.map((tagName) => (
                <span key={tagName} className={styles.noteTag}>
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
          <span className={styles.label}>{node.title}</span>
        </Html>
      ) : null}
    </mesh>
  );
}
