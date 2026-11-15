import { marketingPages, pricingSources, type MarketingPage } from "./dataMarketingContent";
import { escapeSitemapXml as escape } from "./sitemapSnapshot";

const pagesByPath = new Map(marketingPages.map(page => [page.path, page]));
const navigation = ["/real-estate-api", "/real-estate-mcp", "/business"];

export function findDataMarketingPage(path: string) {
  return pagesByPath.get(path.toLowerCase().replace(/\/+$/, ""));
}

function link(href: string, label: string, className = "") {
  return '<a href="' + escape(href) + '"' + (className ? ' class="' + className + '"' : "") + ">" + escape(label) + "</a>";
}

function nav(page: MarketingPage) {
  const items = navigation.map(path => {
    const item = pagesByPath.get(path)!;
    const current = page.path === path ? ' aria-current="page"' : "";
    const text = path === "/real-estate-api" ? "REST API" : path === "/real-estate-mcp" ? "MCP" : item.name;
    return '<a href="' + item.path + '"' + current + ">" + text + "</a>";
  }).join("");
  return '<a class="skip" href="#main">Skip to content</a><header class="top"><div class="container top-inner">' +
    '<a class="brand" href="/"><span aria-hidden="true">RD</span>Realtors Dashboard</a>' +
    '<nav aria-label="Main navigation">' + items + link("/developers", "Docs") + '</nav>' +
    link("/login", "Log in", "log-in") + "</div></header>";
}

function breadcrumbs(page: MarketingPage) {
  return '<nav class="crumbs" aria-label="Breadcrumb"><ol><li>' + link("/", "Home") + "</li>" +
    (page.path.startsWith("/business/") ? "<li>" + link("/business", "For Business") + "</li>" : "") +
    '<li aria-current="page">' + escape(page.name) + "</li></ol></nav>";
}

function example(info: MarketingPage["example"]) {
  return '<aside class="example" aria-labelledby="example-title"><h2 id="example-title">' + escape(info.title) + "</h2>" +
    (info.code ? '<pre tabindex="0" aria-label="Example code"><code>' + escape(info.code) + "</code></pre>" : "") +
    (info.rows ? '<dl>' + info.rows.map(([label, value]) =>
      "<div><dt>" + escape(label) + "</dt><dd>" + escape(value) + "</dd></div>").join("") + "</dl>" : "") +
    (info.note ? '<p class="example-note">' + escape(info.note) + "</p>" : "") + "</aside>";
}

function section({ id, title, intro, cards, ordered }: MarketingPage["sections"][number]) {
  const list = ordered ? "ol" : "ul";
  return '<section class="section"' + (id ? ' id="' + escape(id) + '"' : "") + "><h2>" + escape(title) + "</h2>" +
    (intro ? '<p class="muted">' + escape(intro) + "</p>" : "") +
    "<" + list + ' class="card-grid' + (ordered ? " steps" : "") + '">' + cards.map(card =>
      '<li class="card"><h3>' + escape(card.title) + "</h3><p>" + escape(card.text) + "</p>" +
      (card.link ? link(card.link.href, card.link.label, "text-link") : "") + "</li>").join("") +
    "</" + list + "></section>";
}

function related(page: MarketingPage) {
  return '<section class="section related"><h2>Explore related pages</h2><ul>' + page.related.map(path => {
    const item = pagesByPath.get(path)!;
    return "<li>" + link(item.path, item.name, "text-link") + "</li>";
  }).join("") + "</ul></section>";
}

function footer() {
  return '<footer class="bottom"><div class="container"><p>Realtors Dashboard</p><nav aria-label="Footer navigation">' +
    link("/housing-markets", "U.S. housing markets") + link("/methodology/data-coverage", "Data coverage") +
    link("/developers", "Developer guide") + link("/contact", "Contact") + "</nav></div></footer>";
}

const styles = String.raw`
:root {
  color-scheme: light dark;
  --paper: #f8fafc; --panel: #fff; --ink: #111f35; --muted: #47566d;
  --line: #d3dee9; --blue: #1259b6; --blue-strong: #0e4591; --soft: #edf4fd;
  --navy: #132747; --navy-ink: #f0f6ff; --navy-muted: #c0d3eb; --navy-line: #3b5274;
  --sans: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0f1724; --panel: #162338; --ink: #f0f6ff; --muted: #c3cfe0;
    --line: #3e5069; --blue: #96c4ff; --blue-strong: #bdd9ff; --soft: #1b2d46;
    --navy: #101f36; --navy-line: #405777;
  }
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 1rem/1.55 var(--sans); }
a { color: var(--blue); text-underline-offset: .19em; text-decoration-thickness: 1px; }
a:hover { color: var(--blue-strong); text-decoration-thickness: 2px; }
a:focus-visible, pre:focus-visible { outline: 3px solid var(--blue); outline-offset: 4px; }
h1, h2, h3, p, dl, ol, ul { margin: 0; }
h1, h2, h3 { line-height: 1.15; }
h1 { font-size: clamp(2.35rem, 5.25vw, 4.8rem); letter-spacing: -.053em; font-weight: 750; max-width: 18ch; }
h2 { font-size: clamp(1.5rem, 2.6vw, 2.25rem); letter-spacing: -.034em; }
h3 { font-size: 1.13rem; letter-spacing: -.012em; }
.container { width: min(74rem, calc(100% - 2rem)); margin-inline: auto; }
.top, .bottom { background: var(--panel); }
.top { border-bottom: 1px solid var(--line); }
.top-inner { display: flex; min-height: 4.25rem; align-items: center; justify-content: space-between; gap: 1rem; }
.top nav, .bottom nav, .crumbs ol, .related ul, .actions { display: flex; flex-wrap: wrap; gap: .65rem 1.2rem; }
.brand { display: inline-flex; gap: .55rem; align-items: center; font-weight: 700; color: var(--ink); text-decoration: none; white-space: nowrap; }
.brand span { display: grid; place-items: center; width: 2.1rem; height: 2.1rem; color: white; border-radius: .42rem; background: #1259b6; font-size: .84rem; }
.top nav a, .log-in { color: var(--ink); font-size: .935rem; padding: .4rem 0; text-decoration: none; }
.top nav a[aria-current], .top nav a:hover, .log-in:hover { color: var(--blue); text-decoration: underline; }
.log-in { white-space: nowrap; }
.skip { position: absolute; z-index: 2; left: .5rem; top: .5rem; background: var(--panel); padding: .6rem; transform: translateY(-140%); }
.skip:focus { transform: none; }
.crumbs { margin: 1.2rem 0 0; color: var(--muted); font-size: .88rem; }
.crumbs ol, .related ul { list-style: none; padding: 0; }
.crumbs ol { gap: .45rem; }
.crumbs li + li::before { content: "/"; margin-inline-end: .45rem; color: var(--muted); }
.hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); align-items: center; gap: clamp(1.75rem, 5vw, 5rem); padding: clamp(2.25rem, 6vw, 5rem) 0; }
.intro { margin-top: 1.15rem; color: var(--muted); font-size: clamp(1rem, 1.8vw, 1.23rem); max-width: 59ch; }
.actions { margin-top: 1.5rem; gap: .65rem; }
.button { display: inline-flex; min-height: 2.85rem; align-items: center; justify-content: center; text-align: center; padding: .65rem 1rem; border-radius: .45rem; border: 1px solid var(--line); background: var(--panel); font-weight: 650; text-decoration: none; }
.button:hover { text-decoration: underline; }
.primary { background: #1259b6; border-color: #1259b6; color: #fff; }
.primary:hover { background: #0e4591; color: #fff; }
.example { background: var(--navy); color: var(--navy-ink); border: 1px solid var(--navy-line); border-radius: .85rem; min-width: 0; padding: clamp(1.15rem, 2.7vw, 2rem); }
.example h2 { font-size: clamp(1.2rem, 2vw, 1.58rem); font-weight: 680; letter-spacing: -.02em; }
.example pre { margin: 1.15rem 0 0; background: #0b1930; padding: .8rem; border: 1px solid var(--navy-line); border-radius: .4rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.example code { color: #d7e9ff; font: .84rem/1.55 var(--mono); }
.example dl { margin-top: .85rem; }
.example dl div { display: grid; grid-template-columns: minmax(6.2rem, .8fr) minmax(0, 1.6fr); gap: .85rem; border-top: 1px solid var(--navy-line); padding: .7rem 0; }
.example dl div:last-child { padding-bottom: 0; }
.example dt { font-size: .86rem; color: var(--navy-muted); font-weight: 620; }
.example dd { margin: 0; }
.example-note { color: var(--navy-muted); font-size: .9rem; margin-top: 1rem; }
.section { border-top: 1px solid var(--line); padding: clamp(1.75rem, 4.4vw, 3.2rem) 0; scroll-margin-top: 1rem; }
.muted, .card p, .bottom { color: var(--muted); }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr)); gap: .85rem; padding: 0; margin-top: 1.2rem; list-style: none; }
.card { display: flex; flex-direction: column; gap: .6rem; min-width: 0; padding: 1.2rem; background: var(--panel); border: 1px solid var(--line); border-radius: .55rem; overflow-wrap: anywhere; }
.card .text-link { margin-top: auto; align-self: start; }
.text-link { display: inline-block; padding: .25rem 0; font-weight: 620; }
.steps { counter-reset: step; }
.steps .card { counter-increment: step; }
.steps h3::before { content: counter(step) ". "; color: var(--blue); }
.related ul { margin-top: .85rem; }
.support { margin: .3rem 0 clamp(2rem, 5vw, 4rem); border: 1px solid var(--line); background: var(--soft); border-radius: .65rem; padding: clamp(1.2rem, 3vw, 2.15rem); }
.support p { margin-top: .65rem; max-width: 65ch; }
.support .button { margin-top: 1rem; }
.bottom { border-top: 1px solid var(--line); font-size: .9rem; }
.bottom .container { display: flex; justify-content: space-between; gap: .65rem 1.5rem; flex-wrap: wrap; padding-block: 1.35rem; }
.bottom p { color: var(--ink); font-weight: 640; }
@media (max-width: 720px) {
  .container { width: calc(100% - 2rem); }
  .top-inner { flex-wrap: wrap; padding-block: .65rem; gap: .15rem .75rem; }
  .top nav { order: 3; flex-basis: 100%; column-gap: 1rem; }
  .hero { grid-template-columns: minmax(0, 1fr); padding-block: 2rem; }
  .intro { margin-top: .9rem; }
}
`;

export function dataMarketingHtml(page: MarketingPage) {
  const coverage = section({ id: "coverage", title: "What data is available", cards: pricingSources });
  const support = '<section class="support"><h2>Plan an integration</h2><p>Tell us which markets, records, and workflows you need. We can help you identify the right data source and access method.</p>' +
    link("/contact", "Contact Realtors Dashboard", "button") + "</section>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Realtors Dashboard</title><link rel="icon" href="/favicon.png"><style>' + styles + "</style></head><body>" +
    nav(page) + '<main id="main" class="container">' + breadcrumbs(page) +
    '<section class="hero" aria-labelledby="page-title"><div><h1 id="page-title">' + escape(page.heading) + "</h1>" +
    '<p class="intro">' + escape(page.intro) + '</p><div class="actions">' + link(page.primary.href, page.primary.label, "button primary") +
    link(page.secondary.href, page.secondary.label, "button") + "</div></div>" + example(page.example) + "</section>" +
    page.sections.map(section).join("") + coverage + related(page) + support + "</main>" + footer() + "</body></html>";
}
