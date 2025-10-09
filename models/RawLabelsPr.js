const mongoose = require('mongoose');

const rawLabelsSchema = new mongoose.Schema({
  prId: Number,
  number: Number,
  title: String,
  author: String,
  prUrl: String,
  rawGithubLabels: [String], // Raw GitHub labels without processing
  refinedLabels: [String],   // Processed/refined labels based on specific patterns
  state: String,
  mergeable_state: String,
  createdAt: Date,
  updatedAt: Date,
  closedAt: Date,
  mergedAt: Date,
  specType: String,
}, { strict: false });

const EIP_RAW_LABELS = mongoose.models.EIP_RAW_LABELS || mongoose.model("EIP_RAW_LABELS", rawLabelsSchema, "eip_raw_labels");
const ERC_RAW_LABELS = mongoose.models.ERC_RAW_LABELS || mongoose.model("ERC_RAW_LABELS", rawLabelsSchema, "erc_raw_labels");
const RIP_RAW_LABELS = mongoose.models.RIP_RAW_LABELS || mongoose.model("RIP_RAW_LABELS", rawLabelsSchema, "rip_raw_labels");

module.exports = {
  EIP_RAW_LABELS,
  ERC_RAW_LABELS,
  RIP_RAW_LABELS
};