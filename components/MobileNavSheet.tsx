"use client";

interface MobileNavSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Mobile-only stand-in for the desktop sidebar (SectionNav + ProgressTracker),
 * which is hidden below `lg` — without this, section switching and the
 * per-question jump grid would be entirely unreachable on phones/tablets.
 */
export default function MobileNavSheet({ open, onClose, children }: MobileNavSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-line bg-background p-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Section &amp; progress</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm text-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
