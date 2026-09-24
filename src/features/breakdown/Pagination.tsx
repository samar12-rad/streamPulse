import { ChevronLeftIcon, ChevronRightIcon } from "../../shared/ui/icons";
import styles from "./breakdown.module.css";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

/** Page numbers to render: all of them when few, otherwise a window around the current page. */
export function visiblePages(page: number, pageCount: number, windowSize = 5): number[] {
  const size = Math.min(windowSize, pageCount);
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), pageCount - size + 1);
  return Array.from({ length: size }, (_, i) => start + i);
}

export function Pagination({ page, pageSize, totalRows, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const first = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalRows);

  return (
    <nav className={styles.pagination} aria-label="Breakdown pages">
      <span className={styles.pageSummary} aria-live="polite">
        {first}–{last} of {totalRows} {totalRows === 1 ? "row" : "rows"}
      </span>
      <div className={styles.pageButtons}>
        <button type="button" className={styles.pageButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeftIcon width={14} height={14} />
        </button>
        {visiblePages(page, pageCount).map((p) => (
          <button
            key={p}
            type="button"
            className={styles.pageButton}
            data-current={p === page || undefined}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button type="button" className={styles.pageButton} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRightIcon width={14} height={14} />
        </button>
      </div>
    </nav>
  );
}
