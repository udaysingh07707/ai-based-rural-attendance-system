#!/usr/bin/env node

// Local-only calibration for licensed/consented adult test images. The script
// reads image bytes into memory, calls the configured private inference service,
// and never writes images or embeddings. It does not access PostgreSQL.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { inferFaces } from "../lib/face-inference.js";
import { cosineSimilarity } from "../lib/face-templates.js";

nextEnv.loadEnvConfig(process.cwd());

const [, , manifestArg, applyArg] = process.argv;
if (!manifestArg || manifestArg === "--help") {
  console.log("Usage: node scripts/calibrate-face-threshold.mjs <manifest.json> [--apply-local]");
  console.log("Manifest: { enrollment: [{label,path}], validation: [{label,path}] }; use label \"unknown\" for un-enrolled identities.");
  console.log("Use at least three separate enrollment images per identity, two held-out images per known identity, and two unknown images.");
  console.log("--apply-local writes the selected values to .env.local only after zero false accepts on held-out validation data.");
  process.exit(manifestArg === "--help" ? 0 : 2);
}

const manifestPath = path.resolve(manifestArg);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.enrollment) || !Array.isArray(manifest.validation)
  || manifest.enrollment.length < 2 || manifest.validation.length < 2) {
  throw new Error("Manifest needs at least two enrollment and two separate validation images.");
}

const identities = new Map();
for (const sample of manifest.enrollment) {
  if (!sample || typeof sample.label !== "string" || !sample.label.trim() || sample.label === "unknown"
    || typeof sample.path !== "string") throw new Error("Each enrollment sample needs a person label and image path.");
  if (!identities.has(sample.label)) identities.set(sample.label, []);
  identities.get(sample.label).push(await getEmbedding(sample.path));
}
if (identities.size < 2 || [...identities.values()].some((samples) => samples.length < 3)) {
  throw new Error("Use at least two enrolled identities, with three or more separate enrollment images per identity.");
}

const templates = new Map();
for (const [label, vectors] of identities) {
  const centroid = vectors[0].map((_, i) => vectors.reduce((sum, vector) => sum + vector[i], 0) / vectors.length);
  templates.set(label, centroid);
  vectors.forEach((vector) => vector.fill(0));
}

const probes = [];
for (const sample of manifest.validation) {
  if (!sample || typeof sample.label !== "string" || typeof sample.path !== "string") {
    throw new Error("Each validation sample needs a label (or \"unknown\") and image path.");
  }
  if (sample.label !== "unknown" && !templates.has(sample.label)) {
    throw new Error("A validation label is not present in the enrollment set.");
  }
  const vector = await getEmbedding(sample.path);
  const ranked = [...templates].map(([label, template]) => ({ label, score: cosineSimilarity(vector, template) }))
    .sort((a, b) => b.score - a.score);
  vector.fill(0);
  probes.push({ expected: sample.label === "unknown" ? null : sample.label, ranked });
}
if (!probes.some((probe) => probe.expected !== null) || !probes.some((probe) => probe.expected === null)) {
  throw new Error("Held-out validation must include both known identities and identities absent from enrollment (label them unknown).");
}
const knownProbeCounts = new Map();
for (const probe of probes) {
  if (probe.expected !== null) knownProbeCounts.set(probe.expected, (knownProbeCounts.get(probe.expected) || 0) + 1);
}
if ([...templates.keys()].some((label) => (knownProbeCounts.get(label) || 0) < 2)
  || probes.filter((probe) => probe.expected === null).length < 2) {
  throw new Error("Use at least two separate held-out images for every enrolled identity and two unknown-identity images.");
}

const scoreValues = probes.flatMap(({ ranked }) => ranked.map(({ score }) => score));
const gapValues = probes.map(({ ranked }) => ranked[0].score - (ranked[1]?.score ?? -1));
const thresholds = candidates(scoreValues, -1, 1);
const margins = candidates(gapValues, 0, 1);
const pairs = probes.flatMap((probe) => probe.ranked.map(({ label, score }) => ({
  genuine: probe.expected !== null && label === probe.expected,
  score,
})));
const thresholdSweep = thresholds.map((threshold) => ({
  threshold,
  falseAccepts: pairs.filter((pair) => !pair.genuine && pair.score >= threshold).length,
  falseRejects: pairs.filter((pair) => pair.genuine && pair.score < threshold).length,
  differentPairs: pairs.filter((pair) => !pair.genuine).length,
  samePairs: pairs.filter((pair) => pair.genuine).length,
}));
const results = [];
for (const threshold of thresholds) {
  for (const margin of margins) {
    let falseAccepts = 0;
    let falseRejects = 0;
    let ambiguous = 0;
    for (const probe of probes) {
      const [best, second] = probe.ranked;
      const isAmbiguous = best.score >= threshold && second && best.score - second.score < margin;
      const predicted = best.score < threshold || isAmbiguous ? null : best.label;
      if (isAmbiguous) ambiguous += 1;
      if (predicted !== null && predicted !== probe.expected) falseAccepts += 1;
      if (probe.expected !== null && predicted !== probe.expected) falseRejects += 1;
    }
    results.push({ threshold, margin, falseAccepts, falseRejects, ambiguous });
  }
}

const safe = results.filter((result) => result.falseAccepts === 0)
  .sort((a, b) => a.falseRejects - b.falseRejects || b.threshold - a.threshold || b.margin - a.margin);
const recommendation = safe[0] || null;
console.log(JSON.stringify({
  metric: "cosine similarity; larger is closer (not a probability)",
  enrollmentIdentityCount: templates.size,
  heldOutKnownCount: probes.filter((probe) => probe.expected !== null).length,
  heldOutUnknownCount: probes.filter((probe) => probe.expected === null).length,
  pairCounts: {
    sameIdentity: pairs.filter((pair) => pair.genuine).length,
    differentIdentity: pairs.filter((pair) => !pair.genuine).length,
  },
  thresholdSweep,
  recommendation,
  note: "Zero false accepts on this finite held-out set is not a production accuracy guarantee. Review licensing/consent and validate across additional independent images before any real-student use.",
}, null, 2));

if (applyArg === "--apply-local") {
  if (!recommendation) throw new Error("No candidate achieved zero false accepts on the held-out set; local recognition was not enabled.");
  const configPath = path.resolve(".env.local");
  let current = "";
  try { current = await readFile(configPath, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const next = setEnv(current, "FACE_MATCH_THRESHOLD", recommendation.threshold)
    .replace(/\n?$/, "\n");
  const withMargin = setEnv(next, "FACE_MATCH_MARGIN", recommendation.margin);
  const enabled = setEnv(withMargin, "FACE_RECOGNITION_ENABLED", "true");
  await writeFile(configPath, enabled, { encoding: "utf8", mode: 0o600 });
  console.log("Applied recommendation to .env.local only. Restart Next.js to load it; production configuration was not touched.");
}

async function getEmbedding(filePath) {
  const resolved = path.resolve(path.dirname(manifestPath), filePath);
  const extension = path.extname(resolved).toLowerCase();
  const mime = ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" })[extension];
  if (!mime) throw new Error(`Unsupported image extension for ${filePath}`);
  const bytes = await readFile(resolved);
  try {
    const result = await inferFaces(bytes, mime);
    if (result.faces.length !== 1) throw new Error(`${filePath}: expected one face, detected ${result.faces.length}. Use annotated single-face crops for threshold calibration.`);
    return result.faces[0].embedding;
  } finally { bytes.fill(0); }
}

function candidates(values, min, max) {
  const sorted = [...new Set([min, max, ...values.filter((value) => value >= min && value <= max)])].sort((a, b) => a - b);
  return [...new Set([...sorted, ...sorted.slice(1).map((value, index) => (value + sorted[index]) / 2)])];
}

function setEnv(source, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(source) ? source.replace(pattern, line) : `${source}${source && !source.endsWith("\n") ? "\n" : ""}${line}\n`;
}
