export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="data-list" aria-label="Loading">
      <div className="skeleton large" />
      {Array.from({ length: rows }).map((_, index) => (
        <div className={index % 2 === 0 ? "skeleton medium" : "skeleton"} key={index} />
      ))}
    </div>
  );
}
