export default function TopProgressBar({ progress, indeterminate }) {
  if (!indeterminate && (progress == null || progress <= 0 || progress >= 100)) return null
  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] overflow-hidden z-50" aria-hidden="true">
      {indeterminate ? (
        <div className="h-full w-1/3 bg-ink top-progress-indeterminate" />
      ) : (
        <div className="h-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
      )}
    </div>
  )
}
