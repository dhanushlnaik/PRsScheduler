const mongoose = require('mongoose');

// Repository statistics schema - Overall repository insights
const repoStatsSchema = new mongoose.Schema({
  repository: String,               // Repository name (EIPs, ERCs, RIPs)
  total_contributors: Number,       // Total number of contributors
  total_commits: Number,            // Total commits across all time
  total_additions: Number,          // Total lines added
  total_deletions: Number,          // Total lines deleted
  top_contributors: [{              // Top 10 contributors
    login: String,                  // GitHub username
    commits: Number,                // Their total commits
    additions: Number,              // Their total additions
    deletions: Number,              // Their total deletions
    rank: Number                    // Their rank (1-10)
  }],
  weekly_activity: [{               // Weekly aggregated activity
    week: Date,                     // Week start date
    total_commits: Number,          // Total commits that week
    total_additions: Number,        // Total additions that week
    total_deletions: Number,        // Total deletions that week
    active_contributors: Number     // Number of contributors active that week
  }],
  summary_text: String,             // Human-readable summary
  last_updated: Date                // When this record was last updated
}, { 
  strict: false,
  timestamps: true
});

// Create indexes for better query performance
repoStatsSchema.index({ repository: 1 });
repoStatsSchema.index({ last_updated: -1 });

module.exports = mongoose.model('RepositoryStats', repoStatsSchema, 'repository_stats');