# Daily SEO

The workflow runs on main at 7:15 a.m. America/New_York and can be run from the Actions tab. It loads the three SEO skills from a pinned revision, reads the entire production sitemap inventory, and checks the editorial routes and eight rotating unit or property URLs. Reports and the public guide keyword map are retained in Actions for 30 days.

## Repository configuration

Set these under **Settings → Secrets and variables → Actions**. The scheduled audit continues when an integration is missing.

| Name | Type | Purpose |
| --- | --- | --- |
| `SEO_GSC_SERVICE_ACCOUNT` | Secret | Google service-account JSON. Enable Search Console API in the owning project and grant the service-account email read access to the `sc-domain:realtorsdashboard.com` property. The job requests the read-only scope. |
| `SEO_SERPER_API_KEY` | Secret | Fetch US English Google top-three results and source pages for blog and comparison research. |
| `SEO_OPENAI_API_KEY` | Secret | A project API key with access to Responses and web search for editorial checks and AI answer probes. |
| `CLOUDFLARE_API_TOKEN` | Secret | An API token scoped to the production Cloudflare account with the permissions needed to deploy the existing Worker. |
| `CLOUDFLARE_ACCOUNT_ID` | Variable or secret | The account ID used by the production Worker. |

## What can publish

- Titles and H1s are updated together on published guides with at least 100 impressions and position-adjusted low CTR. After 28 finalized post-publication days, the job compares CTR to the 28 days before publishing.
- Guide refreshes require a finalized average position of 8–20, at least 20 impressions, three retrievable Google results, and supporting primary evidence. New competitor comparisons require demonstrated demand on the comparisons hub and an approved official source.
- Technical repairs can redeploy the verified build when a published guide has drifted from main. Other findings, including database-backed 503s, are logged.
- The job can publish one validated change per editorial category per run. Published pages use the shared guide routes and sitemap and are linked through the guide index and related guides.
- Publication requires the existing quality checks and a Wrangler dry run. The job pushes the validated editorial data to main, deploys the Worker, and verifies affected pages on the canonical domain. A failed run shows the step that stopped. The audit can detect a committed guide that has yet to reach production on the next run.
