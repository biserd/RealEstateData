import { readFile, writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { homepageMarketCopy } from "../shared/homepageMarketCopy";

const projectRoot = process.cwd();
const templatePath = join(projectRoot, "dist", "public", "index.html");
const ssrEntry = join(projectRoot, "dist", "ssr-home", "App.js");

// Wouter reads `location` while rendering. No browser globals or network
// requests are needed: this is the anonymous, data-pending homepage shell.
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: new URL("https://realtorsdashboard.com/"),
});

const { default: App } = await import(pathToFileURL(ssrEntry).href);

const markup = await new Promise<string>((resolve, reject) => {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  let renderError: Error | undefined;
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  output.on("error", reject);
  output.on("end", () => {
    if (renderError) reject(renderError);
    else resolve(Buffer.concat(chunks).toString("utf8"));
  });

  const stream = renderToPipeableStream(React.createElement(App), {
    onAllReady() {
      if (renderError) {
        reject(renderError);
        stream.abort();
      } else {
        stream.pipe(output);
      }
    },
    onError(error) {
      renderError = error instanceof Error ? error : new Error(String(error));
    },
  });
});

if (!markup.includes('data-testid="text-hero-headline"') || !homepageMarketCopy.headline.every(part => markup.includes(part))) {
  throw new Error("Homepage SSR did not include the expected LCP headline");
}

for (const { href } of [...homepageMarketCopy.markets, ...homepageMarketCopy.access]) {
  if (!markup.includes('href="' + href + '"')) {
    throw new Error("Homepage SSR is missing the published data link " + href);
  }
}

const template = await readFile(templatePath, "utf8");
const emptyRoot = '<div id="root"></div>';
if (!template.includes(emptyRoot)) throw new Error("Vite homepage root marker is missing");
const prerendered = template.replace(
  emptyRoot,
  `<!--ssr-home-start--><div id="root" data-ssr-home="true">${markup}</div><!--ssr-home-end-->`,
);
await writeFile(templatePath, prerendered);
console.log(`Prerendered homepage shell (${Buffer.byteLength(markup)} bytes before compression)`);
