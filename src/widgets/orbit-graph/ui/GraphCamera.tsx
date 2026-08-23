import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { GraphNode } from '@/entities/note';
import { useGraphStore } from '../model/graph-store';

function getFrameDistance(
  nodes: GraphNode[],
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
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

export function CanvasViewportSync() {
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

export function CameraDirector({
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
