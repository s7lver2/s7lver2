'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Elements real READMEs use that the default schema strips. SVG is here because
 * the author embeds inline SVG; `picture`/`source` because GitHub's dark-mode
 * image trick relies on them; `details`/`summary` for collapsible sections.
 */
const EXTRA_TAGS = [
  'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan', 'use',
  'clipPath', 'mask', 'title',
  'picture', 'source', 'details', 'summary',
  'kbd', 'sub', 'sup', 'ins', 'del',
];

const SVG_ATTRS = [
  'viewBox', 'xmlns', 'xmlnsXlink', 'width', 'height', 'fill', 'stroke',
  'strokeWidth', 'stroke-width', 'strokeLinecap', 'stroke-linecap',
  'strokeLinejoin', 'stroke-linejoin', 'strokeDasharray', 'stroke-dasharray',
  'fillRule', 'fill-rule', 'clipRule', 'clip-rule', 'clipPath', 'clip-path',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'offset', 'stopColor', 'stop-color',
  'stopOpacity', 'stop-opacity', 'opacity', 'gradientUnits', 'preserveAspectRatio',
];

// NOTE: `style` and `script` are deliberately absent. Never add them — this
// tree is built from remote HTML.
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...EXTRA_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'align', 'width', 'height', 'className'],
    svg: SVG_ATTRS,
    path: SVG_ATTRS,
    g: SVG_ATTRS,
    circle: SVG_ATTRS,
    rect: SVG_ATTRS,
    line: SVG_ATTRS,
    polyline: SVG_ATTRS,
    polygon: SVG_ATTRS,
    linearGradient: SVG_ATTRS,
    radialGradient: SVG_ATTRS,
    stop: SVG_ATTRS,
    text: SVG_ATTRS,
    tspan: SVG_ATTRS,
    use: [...SVG_ATTRS, 'href', 'xlinkHref'],
    img: ['src', 'alt', 'title', 'width', 'height', 'align', 'loading'],
    source: ['src', 'srcSet', 'srcset', 'media', 'type'],
    a: ['href', 'title', 'target', 'rel'],
    details: ['open'],
    td: ['colSpan', 'rowSpan', 'align'],
    th: ['colSpan', 'rowSpan', 'align'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
    href: ['http', 'https', 'mailto'],
  },
};

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function isRelative(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !ABSOLUTE.test(v) && !v.startsWith('#');
}

/**
 * Rewrite relative src/href to raw.githubusercontent so images in READMEs
 * resolve. Hand-rolled tree walk rather than pulling in unist-util-visit.
 */
function rehypeRelativeUrls(repo: string) {
  const base = `https://raw.githubusercontent.com/${repo}/HEAD/`;
  const walk = (node: any): void => {
    if (node && node.type === 'element' && node.properties) {
      for (const attr of ['src', 'href'] as const) {
        const v = node.properties[attr];
        if (isRelative(v)) {
          node.properties[attr] = base + v.replace(/^\.?\//, '');
        }
      }
      const srcSet = node.properties.srcSet ?? node.properties.srcset;
      if (isRelative(srcSet)) {
        node.properties.srcSet = base + srcSet.replace(/^\.?\//, '');
      }
    }
    if (Array.isArray(node?.children)) node.children.forEach(walk);
  };
  return () => (tree: any) => { walk(tree); };
}

export default function Readme({
  markdown, repo, accent,
}: { markdown: string; repo: string; accent: string }) {
  return (
    <div className="grdbody md" style={{ ['--ac' as string]: accent }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeRelativeUrls(repo),
          [rehypeSanitize, schema],
        ]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ node, ...props }) => <img {...props} loading="lazy" alt={props.alt ?? ''} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
