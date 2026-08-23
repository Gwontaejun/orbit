import { OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  buildGraph,
  filterNoteIds,
  hasActiveGraphFilter,
  type GraphFilter,
  type GraphModel,
} from '@/entities/note';
import { useWorkspaceData } from '@/entities/workspace';
import {
  cameraDistanceRange,
  useGraphStore,
  type GraphLayoutMode,
} from '../model/graph-store';
import { buildClusters, type GraphCluster } from '../model/build-clusters';
import { calculateLayout } from '../model/calculate-layout';
import { ClusterAuras, ClusterLegend } from './ClusterOverlay';
import { EdgeLayer, HierarchyFlowLayer } from './GraphEdges';
import { CameraDirector, CanvasViewportSync } from './GraphCamera';
import { GraphNode } from './GraphNode';
import styles from './OrbitGraph.module.css';

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
        <GraphNode
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
