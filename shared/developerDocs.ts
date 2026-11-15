import manifest from "../server.json";

export const developerDocs = {
  title: "U.S. Real Estate Data API & MCP | Realtors Dashboard",
  heading: "U.S. Real Estate Data API and MCP",
  description: "Search nationwide housing markets, browse Florida recorded sales, and access NYC property, sale and comparable records with REST or an MCP client.",
  mcpHeading: "Model Context Protocol (MCP)",
  mcpEndpoint: manifest.remotes[0].url,
  mcpUsage: "Add the endpoint to your MCP client as a Streamable HTTP server. Tool discovery is public. Sign in with a Realtors Dashboard account and approve access to run a tool.",
  mcpCoverage: "Search nationwide housing markets, browse Florida recorded sales, and retrieve eligible NYC properties, condo units, comparable sales, and ZIP benchmarks. Tool calls use your account’s daily search allowance.",
};
