console.error([
  "This legacy command is disabled because it generated synthetic NJ/CT properties, prices, coordinates, and sales.",
  "Use `npm run data:refresh` for a dry run against official NYC Open Data, then add `-- --apply` only after reviewing the counts.",
].join("\n"));
process.exitCode = 1;
