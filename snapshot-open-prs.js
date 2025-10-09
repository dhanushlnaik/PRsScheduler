require('dotenv').config();
const mongoose = require('mongoose');

// --- Mongo Schemas ---
const prSchema = new mongoose.Schema({
  prId: Number,
  number: Number,
  title: String,
  githubLabels: [String],
  state: String,
  createdAt: Date,
  closedAt: Date,
  customLabels: [String],
}, { strict: false });

const snapshotSchema = new mongoose.Schema({
  snapshotDate: String, // "YYYY-MM-DD"
  month: String,        // "YYYY-MM"
  prs: [mongoose.Schema.Types.Mixed]
}, { strict: false });

const EIP_PR   = mongoose.models.EIP_PR   || mongoose.model("EIP_PR",   prSchema,      "eipprs");
const ERC_PR   = mongoose.models.ERC_PR   || mongoose.model("ERC_PR",   prSchema,      "ercprs");
const RIP_PR   = mongoose.models.RIP_PR   || mongoose.model("RIP_PR",   prSchema,      "ripprs");

const EIP_SNAP = mongoose.models.EIP_SNAP || mongoose.model("EIP_SNAP", snapshotSchema,"open_pr_snapshots");
const ERC_SNAP = mongoose.models.ERC_SNAP || mongoose.model("ERC_SNAP", snapshotSchema,"open_erc_pr_snapshots");
const RIP_SNAP = mongoose.models.RIP_SNAP || mongoose.model("RIP_SNAP", snapshotSchema,"open_rip_pr_snapshots");

// --- Label logic for EIPs, ERCs, RIPs
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
    if (/update rip-|rename|review required|remove deprecated/i.test(titleLC)) out.push("Update");
    if (/^create rip|add rip/i.test(titleLC)) out.push("New RIP");
  }
  
  // Remove duplicates and fallback to Misc if empty
  const uniqueOut = [...new Set(out)];
  if (uniqueOut.length === 0) uniqueOut.push("Misc");
  return uniqueOut;
}

function logLabelCounts(prs, monthKey, kind, snapshotDateStr) {
  const labelCounts = {};
  prs.forEach(pr => {
    pr.customLabels.forEach(lbl => {
      labelCounts[lbl] = (labelCounts[lbl] || 0) + 1;
    });
  });
  console.log(`  [${kind}] Label breakdown ${monthKey} (${snapshotDateStr}):`);
  Object.entries(labelCounts).forEach(([lbl, cnt]) =>
    console.log(`    - ${lbl}: ${cnt}`)
  );
}

// --- Snapshot Runner for any type
async function runSnapshots(kind) {
  let PR, SNAP;
  if (kind === "EIP") {
    PR = EIP_PR;
    SNAP = EIP_SNAP;
  } else if (kind === "ERC") {
    PR = ERC_PR;
    SNAP = ERC_SNAP;
  } else if (kind === "RIP") {
    PR = RIP_PR;
    SNAP = RIP_SNAP;
  } else {
    throw new Error(`Unknown kind: ${kind}`);
  }

  console.log(`[START] Snapshots for ${kind}...`);

  // Delete all old monthly snapshots before inserting new
  const deleted = await SNAP.deleteMany({});
  console.log(`[${kind}] Deleted ${deleted.deletedCount} prior monthly snapshot records.`);

  const firstPR = await PR.findOne().sort({ createdAt: 1 }).lean();
  if (!firstPR) {
    console.error(`[FATAL][${kind}] No PRs in DB!`);
    return;
  }
  const startYear  = firstPR.createdAt.getFullYear();
  const startMonth = firstPR.createdAt.getMonth();
  const now        = new Date();
  const currYear   = now.getFullYear();
  const currMonth  = now.getMonth();

  let monthCount = 0;
  for (let y = startYear; y <= currYear; y++) {
    for (
      let m = (y === startYear ? startMonth : 0);
      m <= (y === currYear ? currMonth : 11);
      m++
    ) {
      const isCurrent       = (y === currYear && m === currMonth);
      const snapshotDate    = isCurrent ? now : new Date(y, m + 1, 0);
      const snapshotDateStr = snapshotDate.toISOString().slice(0, 10);
      const monthKey        = `${y}-${String(m + 1).padStart(2, "0")}`;
      console.log(`[${kind}] Processing ${monthKey} (${snapshotDateStr}) ...`);

      // Find PRs open as of snapshotDate
      const prs = await PR.find({
        createdAt: { $lte: snapshotDate },
        $or: [
          { closedAt: { $exists: false } },
          { closedAt: null },
          { closedAt: { $gt: snapshotDate } }
        ]
      }).lean();

      if (prs.length === 0) {
        console.log(`[${kind}]  ${monthKey}: No open PRs found`);
      } else {
        const enrichedPRs = prs.map(pr => ({
          ...pr,
          customLabels: computeCustomLabels(pr, kind)
        }));

        await SNAP.insertOne({
          month: monthKey,
          snapshotDate: snapshotDateStr,
          prs: enrichedPRs,
        });

        console.log(`[${kind}]  ${monthKey}: Saved ${enrichedPRs.length} open PRs (${snapshotDateStr})`);
        logLabelCounts(enrichedPRs, monthKey, kind, snapshotDateStr);
      }
      monthCount++;
    }
  }
  console.log(`[DONE][${kind}] Snapshotted ${monthCount} months`);
}

// --- Main routine
async function main() {
  console.log(`[MAIN] Connecting to MongoDB...`);
  await mongoose.connect(process.env.OPENPRS_MONGODB_URI, { dbName: process.env.OPENPRS_DATABASE });
  const t0 = Date.now();
  await runSnapshots("EIP");
  await runSnapshots("ERC");
  await runSnapshots("RIP");
  mongoose.connection.close();
  const t1 = Date.now();
  console.log(`[COMPLETE] All snapshots done in ${(t1-t0)/1000}s`);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
