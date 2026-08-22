import { useWorkspaceData } from '../../../features/workspace/model/workspace-provider';
import { useGraphStore } from '../model/store';
import styles from './GraphFilters.module.css';

export function GraphFilters() {
  const { categories, tags } = useWorkspaceData();
  const selectedCategoryIds = useGraphStore(
    (state) => state.selectedCategoryIds,
  );
  const selectedTagIds = useGraphStore((state) => state.selectedTagIds);
  const showEdges = useGraphStore((state) => state.showEdges);
  const toggleCategory = useGraphStore((state) => state.toggleCategory);
  const toggleTag = useGraphStore((state) => state.toggleTag);
  const setShowEdges = useGraphStore((state) => state.setShowEdges);

  return (
    <div className={styles.graphFilters}>
      <p className={styles.eyebrow}>Filters</p>
      <div className={styles.filterGroup}>
        <span className={styles.filterTitle}>Categories</span>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={
              selectedCategoryIds.includes(category.id) ? styles.active : ''
            }
            onClick={() => toggleCategory(category.id)}
          >
            <i style={{ backgroundColor: category.color }} />
            {category.name}
          </button>
        ))}
      </div>
      <div className={styles.filterGroup}>
        <span className={styles.filterTitle}>Tags</span>
        <div className={styles.tagFilterList}>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={selectedTagIds.includes(tag.id) ? styles.active : ''}
              onClick={() => toggleTag(tag.id)}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      </div>
      <div className={`${styles.filterGroup} ${styles.filterToggles}`}>
        <label className={styles.connectionSwitch}>
          <span>Show connections</span>
          <input
            type="checkbox"
            checked={showEdges}
            onChange={(event) => setShowEdges(event.target.checked)}
          />
          <span className={styles.connectionSwitchTrack} aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}
