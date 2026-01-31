interface AuthorWorksSkeletonProps {
  count?: number;
  className?: string;
}

export function AuthorWorksSkeleton({ count = 5, className }: AuthorWorksSkeletonProps) {
  return (
    <div className={`overflow-x-auto ${className || ""}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="w-12 p-4">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </th>
            <th className="w-24 p-4 text-left">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </th>
            <th className="p-4 text-left">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </th>
            <th className="w-24 p-4 text-left">
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            </th>
            <th className="w-32 p-4 text-left">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </th>
            <th className="w-24 p-4 text-left">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </th>
            <th className="w-32 p-4 text-left">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <tr key={i} className="border-b">
              <td className="p-4">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-16 w-12 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
              <td className="p-4">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
