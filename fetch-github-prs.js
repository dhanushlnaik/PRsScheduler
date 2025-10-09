require('dotenv').config();
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const { EIP_RAW_LABELS, ERC_RAW_LABELS, RIP_RAW_LABELS } = require('./models/RawLabelsPr');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MONGODB_URI = process.env.OPENPRS_MONGODB_URI;
const DBNAME = process.env.OPENPRS_DATABASE;

if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN in .env file.");
if (!MONGODB_URI) throw new Error("Missing OPENPRS_MONGODB_URI in .env file.");
if (!DBNAME) throw new Error("Missing OPENPRS_DATABASE in .env file.");

const prSchema = new mongoose.Schema({
  prId: Number,
  number: Number,
  title: String,
  author: String,
  prUrl: String,
  githubLabels: [String],
  state: String,
  mergeable_state: String,
  createdAt: Date,
  updatedAt: Date,
  closedAt: Date,
  mergedAt: Date,
  specType: String,
  customLabels: [String],
}, { strict: false });

const EIP_PR = mongoose.models.EIP_PR || mongoose.model("EIP_PR", prSchema, "eipprs");
const ERC_PR = mongoose.models.ERC_PR || mongoose.model("ERC_PR", prSchema, "ercprs");
const RIP_PR = mongoose.models.RIP_PR || mongoose.model("RIP_PR", prSchema, "ripprs"); // NEW

async function getAllPRs({ owner, repo, specType }) {
  let results = [];
  let page = 1, hasNext = true;
  console.log(`[${repo}] Fetching PRs from GitHub...`);
  while (hasNext) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`;
    console.log(`[${repo}] Fetching page ${page}...`);
    const res = await fetch(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    if (!res.ok) {
      console.error(`[${repo}] GitHub API error: ${res.status} ${await res.text()}`);
      throw new Error(`GitHub API error: ${res.status}`);
    }
    const data = await res.json();
    console.log(`[${repo}] Fetched ${data.length} PRs from page ${page}`);
    results.push(...data);
    const link = res.headers.get('link');
    if (link && link.includes('rel="next"')) page++;
    else hasNext = false;
  }
  console.log(`[${repo}] Total PRs fetched: ${results.length}`);
  return results.map(pr => ({
    prId: pr.id,
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || "",
    prUrl: pr.html_url,
    githubLabels: pr.labels.map(l => l.name),
    state: pr.state,
    mergeable_state: pr.mergeable_state || null,
    createdAt: pr.created_at ? new Date(pr.created_at) : null,
    updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
    closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
    mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    specType: specType
  }));
}

// --------------- Label logic for EIPs, ERCs, RIPs ---------------

function computeRefinedLabels(rawLabels) {
  const refined = [];
  const labels = rawLabels.map(l => l.toLowerCase());
  
  // Review-related labels
  if (labels.some(l => l.includes('a-review') || l.includes('author review'))) refined.push("Author Review");
  if (labels.some(l => l.includes('e-review') || l.includes('editor review'))) refined.push("Editor Review");
  if (labels.some(l => l.includes('discuss'))) refined.push("Discuss");
  if (labels.some(l => l.includes('on-hold') || l.includes('on hold'))) refined.push("On Hold");
  if (labels.some(l => l.includes('final-call') || l.includes('final call'))) refined.push("Final Call");
  
  // Status labels
  if (labels.some(l => l.includes('draft'))) refined.push("Draft");
  if (labels.some(l => l.includes('review'))) refined.push("Review");
  if (labels.some(l => l.includes('last-call') || l.includes('last call'))) refined.push("Last Call");
  if (labels.some(l => l.includes('final'))) refined.push("Final");
  if (labels.some(l => l.includes('stagnant'))) refined.push("Stagnant");
  if (labels.some(l => l.includes('withdrawn'))) refined.push("Withdrawn");
  
  // Category labels
  if (labels.some(l => l.includes('c-new'))) refined.push("New");
  if (labels.some(l => l.includes('c-update'))) refined.push("Update");
  if (labels.some(l => l.includes('c-status'))) refined.push("Status Change");
  
  // Bot labels
  if (labels.some(l => l.includes('created-by-bot') || l.includes('bot'))) refined.push("Created By Bot");
  
  // Type labels
  if (labels.some(l => l.includes('core'))) refined.push("Core");
  if (labels.some(l => l.includes('networking'))) refined.push("Networking");
  if (labels.some(l => l.includes('interface'))) refined.push("Interface");
  if (labels.some(l => l.includes('erc'))) refined.push("ERC");
  if (labels.some(l => l.includes('meta'))) refined.push("Meta");
  if (labels.some(l => l.includes('informational'))) refined.push("Informational");
  
  return refined.length > 0 ? refined : ["Unlabeled"];
}

function computeCustomLabels(pr, kind = "EIP") {
  const out = [];
  const title = pr.title ?? '';
  const titleLC = title.toLowerCase();
  const githubLabels = pr.githubLabels || [];
  
  // First check GitHub labels for refined categorization
  const refinedFromLabels = computeRefinedLabels(githubLabels);
  if (refinedFromLabels.length > 0 && !refinedFromLabels.includes("Unlabeled")) {
    out.push(...refinedFromLabels);
  }
  
  // Then apply title-based logic
  if (kind === "EIP") {
    if (title.startsWith("Update EIP-") && /typo|spelling|grammar|punctuation/i.test(title)) out.push("Typo Fix");
    if (title.startsWith("Update EIP-") && /move to|status.*change|change.*status/i.test(titleLC)) out.push("Status Change");
    if (title.startsWith("Update EIP-") && !out.includes("Status Change") && !out.includes("Typo Fix")) out.push("EIP Update");
    if (githubLabels.includes('created-by-bot')) out.push("Created By Bot");
    if (title.startsWith("Add EIP") && githubLabels.includes('c-new')) out.push("New EIP");
  } else if (kind === "ERC") {
    if (title.startsWith("Update ERC-") && /typo|spelling|grammar|punctuation/i.test(title)) out.push("Typo Fix");
    if (title.startsWith("Update ERC-") && /move to|status.*change|change.*status/i.test(titleLC)) out.push("Status Change");
    if (title.startsWith("Update ERC-") && !out.includes("Status Change") && !out.includes("Typo Fix")) out.push("ERC Update");
    if (githubLabels.includes('created-by-bot')) out.push("Created By Bot");
    if (title.startsWith("Add ERC") && githubLabels.includes('c-new')) out.push("New ERC");
  } else if (kind === "RIP") {
    if (/fix typo|fix file name|typo|grammar|punctuation/i.test(titleLC)) out.push("Typo Fix");
    if (/update rip-|rename|review required/i.test(titleLC)) out.push("Update");
    if (/^create rip|add rip/i.test(titleLC)) out.push("New RIP");
  }
  
  // Remove duplicates and fallback to Misc if empty
  const uniqueOut = [...new Set(out)];
  if (uniqueOut.length === 0) uniqueOut.push("Misc");
  return uniqueOut;
}

function logLabelSummary(prs, kind) {
  const counts = {};
  prs.forEach(pr => {
    (pr.customLabels || []).forEach(l => {
      counts[l] = (counts[l] || 0) + 1;
    });
  });
  console.log(`[${kind}] Label assignment summary:`);
  Object.entries(counts).forEach(([lbl, cnt]) =>
    console.log(`   - ${lbl}: ${cnt}`)
  );
}

// --------------- Raw Labels Processing ---------------

async function processRawLabels(prs, RawModel, kind) {
  console.log(`[${kind}] Processing raw labels collection...`);
  
  const rawLabelsPRs = prs.map(pr => ({
    prId: pr.prId,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    prUrl: pr.prUrl,
    rawGithubLabels: pr.githubLabels,
    refinedLabels: computeRefinedLabels(pr.githubLabels),
    state: pr.state,
    mergeable_state: pr.mergeable_state,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    closedAt: pr.closedAt,
    mergedAt: pr.mergedAt,
    specType: pr.specType
  }));

  console.log(`[${kind}] Deleting old raw labels...`);
  const deleteRaw = await RawModel.deleteMany({});
  console.log(`[${kind}] Deleted raw labels: ${deleteRaw.deletedCount}`);
  
  console.log(`[${kind}] Inserting new raw labels...`);
  await RawModel.insertMany(rawLabelsPRs);
  console.log(`[${kind}] Raw labels inserted: ${rawLabelsPRs.length}`);
  
  // Log refined label summary
  const refinedCounts = {};
  rawLabelsPRs.forEach(pr => {
    (pr.refinedLabels || []).forEach(l => {
      refinedCounts[l] = (refinedCounts[l] || 0) + 1;
    });
  });
  console.log(`[${kind}] Refined labels summary:`);
  Object.entries(refinedCounts).forEach(([lbl, cnt]) =>
    console.log(`   - ${lbl}: ${cnt}`)
  );
}

// --------------- Main Runner ---------------

async function main() {
  console.log(`[START] Connecting to MongoDB (${DBNAME})...`);
  await mongoose.connect(MONGODB_URI, { dbName: DBNAME });

  // --- EIPs ---
  console.log(`[EIPs] Downloading and importing PRs...`);
  let eipPRs = await getAllPRs({ owner: "ethereum", repo: "EIPs", specType: "EIP" });
  eipPRs = eipPRs.map(pr => ({ ...pr, customLabels: computeCustomLabels(pr, "EIP") }));

  console.log(`[EIPs] Deleting old PRs...`);
  const deleteEIP = await EIP_PR.deleteMany({});
  console.log(`[EIPs] Deleted: ${deleteEIP.deletedCount}`);
  console.log(`[EIPs] Inserting new PRs...`);
  await EIP_PR.insertMany(eipPRs);
  console.log(`[EIPs] Done! Inserted ${eipPRs.length} PRs`);
  logLabelSummary(eipPRs, "EIP");
  
  // Process raw labels for EIPs
  await processRawLabels(eipPRs, EIP_RAW_LABELS, "EIP");

  // --- ERCs ---
  console.log(`[ERCs] Downloading and importing PRs...`);
  let ercPRs = await getAllPRs({ owner: "ethereum", repo: "ERCs", specType: "ERC" });
  ercPRs = ercPRs.map(pr => ({ ...pr, customLabels: computeCustomLabels(pr, "ERC") }));

  console.log(`[ERCs] Deleting old PRs...`);
  const deleteERC = await ERC_PR.deleteMany({});
  console.log(`[ERCs] Deleted: ${deleteERC.deletedCount}`);
  console.log(`[ERCs] Inserting new PRs...`);
  await ERC_PR.insertMany(ercPRs);
  console.log(`[ERCs] Done! Inserted ${ercPRs.length} PRs`);
  logLabelSummary(ercPRs, "ERC");
  
  // Process raw labels for ERCs
  await processRawLabels(ercPRs, ERC_RAW_LABELS, "ERC");

  // --- RIPs ---
  console.log(`[RIPs] Downloading and importing PRs...`);
  let ripPRs = await getAllPRs({ owner: "ethereum", repo: "RIPs", specType: "RIP" });
  ripPRs = ripPRs.map(pr => ({ ...pr, customLabels: computeCustomLabels(pr, "RIP") }));

  console.log(`[RIPs] Deleting old PRs...`);
  const deleteRIP = await RIP_PR.deleteMany({});
  console.log(`[RIPs] Deleted: ${deleteRIP.deletedCount}`);
  console.log(`[RIPs] Inserting new PRs...`);
  await RIP_PR.insertMany(ripPRs);
  console.log(`[RIPs] Done! Inserted ${ripPRs.length} PRs`);
  logLabelSummary(ripPRs, "RIP");
  
  // Process raw labels for RIPs
  await processRawLabels(ripPRs, RIP_RAW_LABELS, "RIP");

  console.log(`[END] MongoDB import job complete.`);
  mongoose.connection.close();
}

if (require.main === module) {
  main().catch(e => {
    console.error(`[ERROR]`, e);
    process.exit(1);
  });
}

module.exports = main;
