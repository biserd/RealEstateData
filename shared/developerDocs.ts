import manifest from "../server.json";

export const developerDocs = {
  title: "NYC Real Estate API & MCP | Realtors Dashboard",
  heading: "NYC Real Estate API and MCP",
  description: "Use the Realtors Dashboard REST API for published real estate data, or connect an MCP client for NYC ZIP market snapshots, price per square foot, and momentum.",
  mcpHeading: "Model Context Protocol (MCP)",
  mcpEndpoint: manifest.remotes[0].url,
  mcpUsage: "Add the endpoint to your MCP client as a Streamable HTTP server. Tool discovery is public. Sign in with a Realtors Dashboard account and approve access to run a tool.",
  mcpCoverage: "Look up a published market snapshot for an exact NYC ZIP, compare a property's price per square foot with its ZIP benchmark, or list ZIPs by recorded-sale momentum. Tool calls use your account’s daily search allowance.",
};
