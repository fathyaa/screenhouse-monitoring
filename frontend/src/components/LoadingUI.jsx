import { Loader2 } from "lucide-react";

export function LoadingSpinner({ size = 20, className = "" }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-bl-primary shrink-0 ${className}`}
      aria-hidden
    />
  );
}

export function LoadingCenter({ message = "Memuat...", className = "", size = 28 }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 py-12 text-gray-400 ${className}`}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size={size} />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

export function KpiGridSkeleton({ count = 4, className = "" }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BannerSkeleton({ className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 ${className}`}>
      <Skeleton className="h-5 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

export function ScreenhouseCardsSkeleton({ count = 4, className = "" }) {
  return (
    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="px-4 py-4">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartGridSkeleton({ count = 2, height = "h-72", className = "" }) {
  return (
    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-white rounded-2xl border border-gray-200 ${height} animate-pulse`} />
      ))}
    </div>
  );
}

export function ListPanelSkeleton({ count = 6, className = "" }) {
  return (
    <div className={`space-y-1 p-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
          <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-gray-100">
          <td colSpan={99} className="px-4 py-2">
            <Skeleton className="h-10 w-full rounded-lg" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function AlertListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApprovalListSkeleton({ count = 2 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-xl" />
            <Skeleton className="h-8 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScreenhouseDetailSkeleton() {
  return (
    <div className="p-5 space-y-4 text-left">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <BannerSkeleton />
      <ChartGridSkeleton />
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MapLoadingOverlay({ message = "Memuat peta..." }) {
  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
      <LoadingCenter message={message} className="py-8" size={24} />
    </div>
  );
}
