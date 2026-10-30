/**
 * Seat map: one square per seat. Filled = taken, outlined = free, accent = the seat held for you.
 * Seats are not individually assigned in the registrar's model, so "yours" is drawn as the last taken seat.
 */
export default function SeatMap({ total, available, mine = null }) {
  const taken = total - available;
  const columns = total <= 12 ? total : total <= 40 ? 10 : 12;

  return (
    <figure>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1.25rem))` }}
        role="img" aria-label={`${taken} of ${total} seats taken${mine ? `, one ${mine === 'CONFIRMED' ? 'confirmed' : 'held'} for you` : ''}`}>
        {Array.from({ length: total }).map((_, i) => {
          const isMine = mine && i === taken - 1;
          const isTaken = i < taken;
          return (
            <span key={i}
              className={`aspect-square rounded-[2px] border transition-colors duration-200 ${
                isMine ? 'border-accent bg-accent ring-2 ring-accent/30 ring-offset-1 ring-offset-surface'
                  : isTaken ? 'border-ink/70 bg-ink/70' : 'border-ink/30 bg-transparent'}`} />
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] bg-ink/70" />Taken ({taken})</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] border border-ink/30" />Open ({available})</span>
        {mine && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] bg-accent" />Yours</span>}
      </figcaption>
    </figure>
  );
}
