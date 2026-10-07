import "server-only";
import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs");

function readDoc(name: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, name), "utf-8");
}

// Read once per server process — these files don't change at runtime.
let cached: string | null = null;

export function buildKnowledgeBase(): string {
  if (cached) return cached;

  const pricing = readDoc("pricing.md");
  const services = readDoc("services.md");
  const qualified = readDoc("qualified.md");

  cached = [
    "## Pricing policy (binding — see hard rule below)",
    pricing,
    "## Service scope",
    services,
    "## Qualification rubric",
    qualified,
  ].join("\n\n");

  return cached;
}
