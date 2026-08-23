import { create } from 'zustand';

export type GraphLayoutMode = 'sphere' | 'helix' | 'force' | 'category' | 'tag';
export const cameraDistanceRange = { min: 6, max: 30 };

type GraphStore = {
  selectedNoteId: string | null;
  hoveredNoteId: string | null;
  selectedCategoryIds: string[];
  selectedTagIds: string[];
  showEdges: boolean;
  collapsedNoteIds: string[];
  layoutMode: GraphLayoutMode;
  searchQuery: string;
  resetVersion: number;
  cameraDistance: number;
  requestedCameraDistance: number;
  cameraZoomRequestVersion: number;
  selectNote: (id: string | null) => void;
  hoverNote: (id: string | null) => void;
  setSelectedCategories: (ids: string[]) => void;
  setSelectedTags: (ids: string[]) => void;
  toggleCategory: (id: string) => void;
  toggleTag: (id: string) => void;
  setShowEdges: (value: boolean) => void;
  toggleNoteCollapsed: (id: string) => void;
  setLayoutMode: (mode: GraphLayoutMode) => void;
  setSearchQuery: (query: string) => void;
  resetCamera: () => void;
  resetGraphView: () => void;
  requestCameraZoom: (distance: number) => void;
  syncCameraDistance: (distance: number) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  selectedNoteId: null,
  hoveredNoteId: null,
  selectedCategoryIds: [],
  selectedTagIds: [],
  showEdges: true,
  collapsedNoteIds: [],
  layoutMode: 'force',
  searchQuery: '',
  resetVersion: 0,
  cameraDistance: 19,
  requestedCameraDistance: 19,
  cameraZoomRequestVersion: 0,
  selectNote: (selectedNoteId) => set({ selectedNoteId }),
  hoverNote: (hoveredNoteId) => set({ hoveredNoteId }),
  setSelectedCategories: (selectedCategoryIds) =>
    set({ selectedCategoryIds, selectedNoteId: null }),
  setSelectedTags: (selectedTagIds) =>
    set({ selectedTagIds, selectedNoteId: null }),
  toggleCategory: (id) =>
    set((state) => ({
      selectedCategoryIds: state.selectedCategoryIds.includes(id)
        ? state.selectedCategoryIds.filter((categoryId) => categoryId !== id)
        : [...state.selectedCategoryIds, id],
      selectedNoteId: null,
    })),
  toggleTag: (id) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(id)
        ? state.selectedTagIds.filter((tagId) => tagId !== id)
        : [...state.selectedTagIds, id],
      selectedNoteId: null,
    })),
  setShowEdges: (showEdges) => set({ showEdges }),
  toggleNoteCollapsed: (id) =>
    set((state) => ({
      collapsedNoteIds: state.collapsedNoteIds.includes(id)
        ? state.collapsedNoteIds.filter((noteId) => noteId !== id)
        : [...state.collapsedNoteIds, id],
    })),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetCamera: () => set((state) => ({ resetVersion: state.resetVersion + 1 })),
  resetGraphView: () =>
    set((state) => ({
      selectedNoteId: null,
      hoveredNoteId: null,
      searchQuery: '',
      selectedCategoryIds: [],
      selectedTagIds: [],
      showEdges: true,
      resetVersion: state.resetVersion + 1,
    })),
  requestCameraZoom: (distance) =>
    set((state) => ({
      requestedCameraDistance: Math.min(
        cameraDistanceRange.max,
        Math.max(cameraDistanceRange.min, distance),
      ),
      cameraDistance: Math.min(
        cameraDistanceRange.max,
        Math.max(cameraDistanceRange.min, distance),
      ),
      cameraZoomRequestVersion: state.cameraZoomRequestVersion + 1,
    })),
  syncCameraDistance: (cameraDistance) => set({ cameraDistance }),
}));
