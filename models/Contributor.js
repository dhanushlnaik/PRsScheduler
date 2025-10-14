const mongoose = require('mongoose');

// Contributor schema - Individual contributor statistics
const contributorSchema = new mongoose.Schema({
  login: String,                    // GitHub username
  id: Number,                       // GitHub user ID
  avatar_url: String,               // Profile picture URL
  html_url: String,                 // GitHub profile URL
  total_commits: Number,            // Total commits across all time
  total_additions: Number,          // Total lines added
  total_deletions: Number,          // Total lines deleted  
  weeks: [{                         // Weekly activity data
    week: Date,                     // Week start date
    additions: Number,              // Lines added that week
    deletions: Number,              // Lines deleted that week
    commits: Number                 // Commits made that week
  }],
  repository: String,               // Repository name (EIPs, ERCs, RIPs)
  last_updated: Date,               // When this record was last updated
  rank: Number                      // Rank by total commits (1 = highest)
}, { 
  strict: false,
  timestamps: true
});

// Create indexes for better query performance
contributorSchema.index({ repository: 1, rank: 1 });
contributorSchema.index({ login: 1, repository: 1 });
contributorSchema.index({ total_commits: -1 });

module.exports = mongoose.model('Contributor', contributorSchema, 'contributors');