import { useEffect, useRef, useState } from 'react';

const HOLD_SECONDS = 10 * 60;

/** Slim progress bar + mono timer: "09:41 to complete payment". Counts down from the server's holdExpiresAt. */
export default function HoldCountdown({ expiresAt, onExpire, compact = false }) {
  const remaining = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    setSeconds(remaining());
    const timer = setInterval(() => {
      const left = remaining();
      setSeconds(left);
      if (left === 0 && !fired.current) { fired.current = true; onExpire?.(); }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const urgent = seconds < 120;

  return (
    <div className={compact ? '' : 'space-y-2'} role="timer" aria-live="off" aria-label={`${mm} minutes ${ss} seconds left to pay`}>
      <div className="h-[3px] w-full overflow-hidden bg-rule">
        <div className={`h-full transition-[width] duration-1000 ease-linear ${urgent ? 'bg-bad' : 'bg-accent'}`}
          style={{ width: `${(seconds / HOLD_SECONDS) * 100}%` }} />
      </div>
      <p className={`font-mono text-sm ${urgent ? 'text-bad' : 'text-ink'} ${compact ? 'mt-1.5 text-xs' : ''}`}>
        {seconds > 0 ? <><span className="tabular-nums">{mm}:{ss}</span> to complete payment</> : 'Hold expired: the seat has been released'}
      </p>
    </div>
  );
}
