/*
 * El indicador del tiempo parado: el mismo carril de la cuenta roja que en el inicio y en la sala,
 * pero aquí no cae, se llena desde abajo con el scroll (y baja si paras).
 */
export default function ScrollMeter({ value }: { value: number }) {
  return (
    <div className="library-meter" aria-hidden="true">
      <i>
        <b style={{ height: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </i>
      <span>scroll</span>
    </div>
  );
}
