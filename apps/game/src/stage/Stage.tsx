import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { STAGE, type Rect } from '@melina/shared';

/** Positions an element in stage points. */
export const at = (r: Rect, extra?: CSSProperties): CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, ...extra });

/**
 * Fixed 1920×1080 stage. Everything inside uses design units;
 * the only thing that changes with the window is the scale factor applied to the whole stage.
 */
export function Stage({ background, className = '', children, ...rest }: { background: string; className?: string; children: ReactNode } & Record<`data-${string}`, string | number | undefined>) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setK(Math.min(el.clientWidth / STAGE.width, el.clientHeight / STAGE.height));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="stage-viewport" ref={ref}>
      <img className="stage-backdrop" src={background} alt="" />
      <div className={`stage ${className}`} style={{ transform: `translate(-50%, -50%) scale(${k})`, visibility: k ? 'visible' : 'hidden' }} data-stage-scale={k.toFixed(4)} {...rest}>
        <img className="stage-bg" src={background} alt="" draggable={false} />
        {children}
      </div>
    </div>
  );
}
