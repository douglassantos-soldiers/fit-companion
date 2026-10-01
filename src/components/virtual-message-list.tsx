import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

/** Virtualized message list for coach chat (and similar threads). */
export function VirtualMessageList<T extends { id: string }>({
  items,
  estimateSize = 72,
  className,
  renderItem,
}: {
  items: T[];
  estimateSize?: number;
  className?: string;
  renderItem: (item: T) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualize = items.length >= 24;
  const virtualizer = useVirtualizer({
    count: virtualize ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
  });

  if (!virtualize) {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((item) => (
          <div key={item.id}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={cn("max-h-[55vh] overflow-y-auto", className)}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]!;
          return (
            <div
              key={item.id}
              className="absolute left-0 top-0 w-full pb-3"
              style={{
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
