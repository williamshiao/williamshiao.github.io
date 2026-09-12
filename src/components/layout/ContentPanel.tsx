import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

interface ContentPanelProps {
  kicker: string;
  title: string;
  onClose: () => void;
}

/**
 * Floating card that surfaces a tab's content over the terrarium, plus a
 * light backdrop that closes it on click. Ditto's habitat stays visible
 * (and still roamable) behind the dim — this is a drawer, not a takeover.
 */
export function ContentPanel({ kicker, title, onClose, children }: PropsWithChildren<ContentPanelProps>) {
  return (
    <>
      <motion.div
        className="absolute inset-0 z-30 bg-ink/10 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-label={title}
        className="absolute left-1/2 top-24 z-40 max-h-[min(70vh,640px)] w-[min(640px,calc(100vw-2.5rem))]
                   -translate-x-1/2 overflow-y-auto rounded-3xl border border-line bg-surface p-8
                   shadow-xl sm:top-28"
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-blob-target
          className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full text-lg
                     leading-none text-ink-soft transition-colors hover:bg-pastel-lilac hover:text-ink"
        >
          ×
        </button>
        <p className="font-pixel text-[10px] uppercase tracking-widest text-ditto">{kicker}</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </motion.div>
    </>
  );
}
