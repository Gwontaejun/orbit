import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { GraphEdge } from '@/entities/note';
import { getNodeGlowTexture } from '../lib/node-glow-texture';

export function EdgeLayer({
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

export function HierarchyFlowLayer({
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
