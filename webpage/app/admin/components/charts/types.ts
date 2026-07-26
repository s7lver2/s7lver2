export type Renderer = 'dots' | 'braille' | 'svg';

export interface ChartProps {
  /** Raw series, any length. The renderer resamples it to the column count. */
  series: number[];
  /** Vertical resolution in braille rows (each row is 4 dots tall). */
  rows?: number;
  label?: string;
}

/**
 * Fit `src` to exactly `n` values.
 *
 * Downsampling takes the MAX of each bucket, not the mean and not a slice: a
 * chart exists to show the spikes, and both of those hide them. Upsampling
 * interpolates linearly.
 */
export function resample(src: number[], n: number): number[] {
  if (n <= 0 || src.length === 0) return [];
  if (src.length === n) return [...src];

  if (src.length > n) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i * src.length) / n);
      const b = Math.max(a + 1, Math.floor(((i + 1) * src.length) / n));
      let m = -Infinity;
      for (let j = a; j < b && j < src.length; j++) m = Math.max(m, src[j]);
      out.push(m === -Infinity ? 0 : m);
    }
    return out;
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i * (src.length - 1)) / (n - 1);
    const lo = Math.floor(t), hi = Math.min(src.length - 1, lo + 1);
    out.push(src[lo] + (src[hi] - src[lo]) * (t - lo));
  }
  return out;
}
