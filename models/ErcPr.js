const mongoose = require('mongoose');
const ErcPrSchema = new mongoose.Schema({
  prId: Number,
  number: Number,
  title: String,
  createdAt: String,
  author: String,
  prUrl: String,
  customLabels: [String],
  githubLabels: [String],
  state: String,
  mergeable_state: String,
  specType: String
});
module.exports = mongoose.model('ErcPr', ErcPrSchema, 'erc_prs');
