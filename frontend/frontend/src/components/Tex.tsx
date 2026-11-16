import katex from "katex";

/** Typeset one formula at build time. No script runs in the browser; a typo fails the build, not the page. */
export default function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const html = katex.renderToString(children, { displayMode: block, throwOnError: true, output: "htmlAndMathml", strict: "error" });
  return block
    ? <div className="eq scroll-x" dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}
