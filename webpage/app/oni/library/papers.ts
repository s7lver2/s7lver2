import { DEFAULT_PAPERS, type PaperC } from '../../lib/content-constants';

/*
 * Los papers de la biblioteca: cada uno es una hoja suelta que abre su PDF. Sin ninguno (o con la
 * API caída) sale una sola hoja de relleno, un expediente tachado que no abre nada.
 */

export interface Paper extends PaperC { placeholder?: boolean }

export const PLACEHOLDER: Paper = {
  placeholder: true,
  title: '[REDACTED]',
  authors: ['s7lver'],
  year: new Date().getFullYear(),
  abstract:
    'This document is pending declassification. Its contents describe work in progress that has not yet been reviewed, '
    + 'published or cleared for release. Any reproduction of the material below is prohibited until further notice from the author.',
  pdf: '',
};

// desarrollo: ?papers=N rellena con N copias numeradas de un paper real para probar muchas hojas
function devPapers(): Paper[] | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const n = Number(new URLSearchParams(location.search).get('papers'));
  if (!n) return null;
  return Array.from({ length: n }, (_, i) => ({
    title: `Attention Is All You Need (${i + 1})`,
    authors: ['A. Vaswani', 'N. Shazeer', 'N. Parmar', 'J. Uszkoreit'],
    year: 2017,
    venue: 'NeurIPS',
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. '
      + 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
    pdf: 'https://arxiv.org/pdf/1706.03762',
  }));
}

export async function loadPapers(): Promise<Paper[]> {
  const dev = devPapers();
  if (dev) return dev;
  try {
    const r = await fetch('/api/content/papers');
    const p = r.ok ? ((await r.json()) as PaperC[]) : null;
    if (Array.isArray(p) && p.length) return p;
  } catch {}
  return DEFAULT_PAPERS.length ? DEFAULT_PAPERS : [PLACEHOLDER];
}
