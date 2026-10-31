import type Lenis from 'lenis';

/** El Lenis de la página, para que el cargador pueda frenar el scroll mientras tanto. */
export const scroll: { lenis: Lenis | null } = { lenis: null };
