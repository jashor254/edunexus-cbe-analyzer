/** Sprint PE-4 (School Discovery Engine v1) — one config per county, so expanding to a new county is "add a file," never "edit discover-schools.ts." */
export type CountyConfig = {
  /** Display name, e.g. "Kirinyaga" */
  county: string
  /** Lowercase, no-space key used on the CLI: --county=kirinyaga */
  slug: string
  /** Towns to search within the county */
  towns: string[]
  /** Search phrases combined with each town, e.g. "secondary school in Kerugoya Kirinyaga County Kenya" */
  searchTerms: string[]
  /** Optional: Google Place IDs or exact/substring name matches to skip (known false positives, e.g. a primary school Places miscategorizes) */
  exclusions?: string[]
}
