require('dotenv').config();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const fetch = require('node-fetch');

// MongoDB connection
const MONGODB_URI = process.env.OPENPRS_MONGODB_URI;
const DBNAME = process.env.OPENPRS_DATABASE;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Enhanced Contributor schema with comprehensive data
const contributorSchema = new mongoose.Schema({
  // Basic GitHub info
  login: String,                    // GitHub username
  id: Number,                       // GitHub user ID
  avatar_url: String,               // Profile picture URL
  html_url: String,                 // GitHub profile URL
  name: String,                     // Full display name
  company: String,                  // Company/organization
  blog: String,                     // Personal website
  location: String,                 // Location
  bio: String,                      // Bio description
  public_repos: Number,             // Number of public repos
  followers: Number,                // GitHub followers count
  following: Number,                // GitHub following count
  
  // Repository-specific contribution stats
  total_commits: Number,            // Total commits in this repo
  total_additions: Number,          // Total lines added in this repo
  total_deletions: Number,          // Total lines deleted in this repo
  first_commit_date: Date,          // Date of first contribution
  last_commit_date: Date,           // Date of most recent contribution
  
  // Activity patterns and insights
  weeks: [{                         // Weekly activity data
    week: Date,                     // Week start date
    additions: Number,              // Lines added that week
    deletions: Number,              // Lines deleted that week
    commits: Number                 // Commits made that week
  }],
  avg_commits_per_week: Number,     // Average commits per active week
  max_commits_in_week: Number,      // Peak weekly commit count
  active_weeks_count: Number,       // Number of weeks with commits
  contribution_streak: Number,      // Longest consecutive week streak
  days_since_last_commit: Number,   // Days since most recent commit
  
  // Detailed commit analysis
  recent_commits: [{                // Last 10 commits details
    sha: String,
    message: String,
    date: Date,
    additions: Number,
    deletions: Number,
    files_changed: Number
  }],
  
  // Programming activity
  languages_used: [{               // Programming languages in commits
    language: String,
    lines_count: Number,
    files_count: Number,
    percentage: Number
  }],
  
  // Collaboration metrics
  co_authors: [String],            // Other contributors they've worked with
  review_participation: {          // PR review activity
    reviews_given: Number,
    reviews_received: Number,
    avg_review_time: Number        // Average time to review (hours)
  },
  
  // Impact metrics
  repository: String,               // Repository name (EIPs, ERCs, RIPs)
  rank: Number,                     // Rank by total commits (1 = highest)
  contribution_percentage: Number,  // Percentage of total repo commits
  impact_score: Number,            // Weighted contribution score
  contributor_type: String,        // 'core', 'regular', 'occasional', 'one-time'
  
  // Metadata
  last_updated: Date,
  data_completeness: Number        // Percentage of fields populated (0-100)
}, { 
  strict: false,
  timestamps: true
});

// Enhanced Repository stats schema
const repoStatsSchema = new mongoose.Schema({
  repository: String,
  
  // Basic stats
  total_contributors: Number,
  total_commits: Number,
  total_additions: Number,
  total_deletions: Number,
  
  // Time-based insights
  repository_age_days: Number,
  avg_commits_per_day: Number,
  peak_activity_period: String,    // "2023-Q3", "2024-01", etc.
  
  // Contributor analysis
  top_contributors: [{
    login: String,
    commits: Number,
    additions: Number,
    deletions: Number,
    rank: Number,
    contribution_percentage: Number,
    first_commit: Date,
    last_commit: Date
  }],
  
  contributor_distribution: {      // Contribution distribution insights
    core_contributors: Number,      // Contributors with >10% of commits
    regular_contributors: Number,   // Contributors with 1-10% of commits
    occasional_contributors: Number,// Contributors with <1% of commits
    one_time_contributors: Number,  // Contributors with exactly 1 commit
    bus_factor: Number             // How many contributors make up 50% of commits
  },
  
  // Activity patterns
  weekly_activity: [{
    week: Date,
    total_commits: Number,
    total_additions: Number,
    total_deletions: Number,
    active_contributors: Number,
    new_contributors: Number,      // First-time contributors this week
    avg_commit_size: Number        // Average lines per commit
  }],
  
  monthly_trends: [{               // Monthly aggregation
    month: String,                 // "2024-10"
    commits: Number,
    contributors: Number,
    new_contributors: Number,
    additions: Number,
    deletions: Number,
    net_change: Number             // additions - deletions
  }],
  
  // Language and file insights
  language_breakdown: [{
    language: String,
    commits: Number,
    contributors: Number,
    lines_of_code: Number,
    percentage: Number
  }],
  
  // Collaboration metrics
  collaboration_score: Number,     // How much contributors work together
  average_review_time: Number,     // Average PR review time
  contributor_retention: Number,   // % of contributors active in last 6 months
  
  // Summary insights
  summary_text: String,
  growth_trend: String,           // "growing", "stable", "declining"
  health_score: Number,           // Overall repository health (0-100)
  
  last_updated: Date
}, { 
  strict: false,
  timestamps: true
});

// Models
const CONTRIBUTOR = mongoose.models.CONTRIBUTOR || mongoose.model("CONTRIBUTOR", contributorSchema, "contributors");
const REPO_STATS = mongoose.models.REPO_STATS || mongoose.model("REPO_STATS", repoStatsSchema, "repository_stats");

// GitHub API helper with pagination support
async function fetchGitHubAPI(url, retries = 3) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'EIPs-PRScheduler/1.0'
  };
  
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  
  console.log(`[API] Fetching: ${url}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 202) {
        console.log(`[API] GitHub is calculating stats (202), waiting 10 seconds... (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        } else {
          throw new Error('GitHub stats not ready after retries');
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      if (attempt === retries) {
        console.error(`[API ERROR] Failed to fetch ${url} after ${retries} attempts:`, error.message);
        throw error;
      }
      console.log(`[API] Attempt ${attempt} failed, retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Fetch ALL contributors using pagination (not just top 100)
async function fetchAllContributors(owner, repo) {
  console.log(`[FETCH] Getting ALL contributors for ${owner}/${repo}...`);
  
  let allContributors = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${perPage}&page=${page}`;
      const contributors = await fetchGitHubAPI(url);
      
      if (!contributors || !Array.isArray(contributors) || contributors.length === 0) {
        break;
      }
      
      allContributors = allContributors.concat(contributors);
      console.log(`[FETCH] Page ${page}: ${contributors.length} contributors (total: ${allContributors.length})`);
      
      if (contributors.length < perPage) {
        break; // Last page
      }
      
      page++;
      
      // Rate limiting - be respectful to GitHub API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[ERROR] Failed to fetch contributors page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`[FETCH] Total contributors found: ${allContributors.length}`);
  return allContributors;
}

// Fetch detailed user information
async function fetchUserDetails(username) {
  try {
    const url = `https://api.github.com/users/${username}`;
    return await fetchGitHubAPI(url);
  } catch (error) {
    console.log(`[WARN] Could not fetch details for user ${username}: ${error.message}`);
    return {};
  }
}

// Fetch contributor stats (commit activity)
async function fetchContributorStats(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`;
  return await fetchGitHubAPI(url);
}

// Fetch recent commits for a contributor
async function fetchRecentCommits(owner, repo, author, count = 10) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${author}&per_page=${count}`;
    const commits = await fetchGitHubAPI(url);
    
    if (!Array.isArray(commits)) return [];
    
    return commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message.split('\n')[0], // First line only
      date: new Date(commit.commit.author.date),
      url: commit.html_url
    }));
  } catch (error) {
    console.log(`[WARN] Could not fetch recent commits for ${author}: ${error.message}`);
    return [];
  }
}

// Calculate contribution insights
function calculateContributionInsights(weeks) {
  if (!weeks || weeks.length === 0) {
    return {
      avg_commits_per_week: 0,
      max_commits_in_week: 0,
      active_weeks_count: 0,
      contribution_streak: 0
    };
  }
  
  const activeWeeks = weeks.filter(w => w.commits > 0);
  const commitCounts = weeks.map(w => w.commits || 0);
  const maxCommits = commitCounts.length > 0 ? Math.max(...commitCounts) : 0;
  const avgCommits = activeWeeks.length > 0 ? activeWeeks.reduce((sum, w) => sum + w.commits, 0) / activeWeeks.length : 0;
  
  // Calculate longest streak of consecutive active weeks
  let maxStreak = 0;
  let currentStreak = 0;
  
  weeks.forEach(week => {
    if ((week.commits || 0) > 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  return {
    avg_commits_per_week: isNaN(avgCommits) ? 0 : Math.round(avgCommits * 100) / 100,
    max_commits_in_week: isNaN(maxCommits) ? 0 : maxCommits,
    active_weeks_count: activeWeeks.length,
    contribution_streak: isNaN(maxStreak) ? 0 : maxStreak
  };
}

// Determine contributor type based on activity
function determineContributorType(totalCommits, contributionPercentage, activeWeeks) {
  if (contributionPercentage > 10) return 'core';
  if (contributionPercentage > 1 && activeWeeks > 4) return 'regular';
  if (totalCommits > 1) return 'occasional';
  return 'one-time';
}

// Process comprehensive contributor data
async function processComprehensiveContributorData(contributors, statsData, repoName, owner, repo) {
  console.log(`[PROCESS] Processing ${contributors.length} contributors with comprehensive data...`);
  
  const totalRepoCommits = statsData.reduce((sum, contributor) => sum + contributor.total, 0);
  const processedContributors = [];
  
  // Process each contributor with enhanced data
  for (let i = 0; i < Math.min(contributors.length, 500); i++) { // Limit to prevent API exhaustion
    const contributor = contributors[i];
    const stats = statsData.find(s => s.author.login === contributor.login);
    
    if (!stats) {
      console.log(`[SKIP] No stats data found for ${contributor.login}`);
      continue;
    }
    
    // Get detailed user information
    const userDetails = await fetchUserDetails(contributor.login);
    
    // Get recent commits
    const recentCommits = await fetchRecentCommits(owner, repo, contributor.login, 5);
    
    // Calculate insights
    const insights = calculateContributionInsights(stats.weeks);
    const contributionPercentage = (stats.total / totalRepoCommits) * 100;
    const contributorType = determineContributorType(stats.total, contributionPercentage, insights.active_weeks_count);
    
    // Calculate days since last commit
    const lastCommitDate = stats.weeks.reduce((latest, week) => {
      return week.commits > 0 && new Date(week.w * 1000) > latest ? new Date(week.w * 1000) : latest;
    }, new Date(0));
    const daysSinceLastCommit = Math.floor((new Date() - lastCommitDate) / (1000 * 60 * 60 * 24));
    
    // Sanitize numeric values to prevent NaN
    const sanitizeNumber = (value, defaultValue = 0) => {
      return isNaN(value) || !isFinite(value) ? defaultValue : value;
    };

    const processedContributor = {
      // Basic GitHub info
      login: contributor.login,
      id: contributor.id,
      avatar_url: contributor.avatar_url,
      html_url: contributor.html_url,
      name: userDetails.name || null,
      company: userDetails.company || null,
      blog: userDetails.blog || null,
      location: userDetails.location || null,
      bio: userDetails.bio || null,
      public_repos: sanitizeNumber(userDetails.public_repos),
      followers: sanitizeNumber(userDetails.followers),
      following: sanitizeNumber(userDetails.following),
      
      // Repository-specific stats
      total_commits: sanitizeNumber(stats.total),
      total_additions: sanitizeNumber(stats.weeks.reduce((sum, week) => sum + (week.a || 0), 0)),
      total_deletions: sanitizeNumber(stats.weeks.reduce((sum, week) => sum + (week.d || 0), 0)),
      first_commit_date: stats.weeks.find(w => w.c > 0) ? new Date(stats.weeks.find(w => w.c > 0).w * 1000) : null,
      last_commit_date: lastCommitDate > new Date(0) ? lastCommitDate : null,
      
      // Activity insights
      weeks: stats.weeks.map(week => ({
        week: new Date(week.w * 1000),
        additions: sanitizeNumber(week.a),
        deletions: sanitizeNumber(week.d),
        commits: sanitizeNumber(week.c)
      })),
      avg_commits_per_week: sanitizeNumber(insights.avg_commits_per_week),
      max_commits_in_week: sanitizeNumber(insights.max_commits_in_week),
      active_weeks_count: sanitizeNumber(insights.active_weeks_count),
      contribution_streak: sanitizeNumber(insights.contribution_streak),
      days_since_last_commit: sanitizeNumber(daysSinceLastCommit),
      
      // Recent activity
      recent_commits: recentCommits,
      
      // Metadata
      repository: repoName,
      rank: i + 1,
      contribution_percentage: sanitizeNumber(Math.round(contributionPercentage * 100) / 100),
      impact_score: sanitizeNumber(Math.round((stats.total * 0.6 + insights.active_weeks_count * 0.4) * 100) / 100),
      contributor_type: contributorType,
      last_updated: new Date(),
      data_completeness: sanitizeNumber(calculateDataCompleteness(userDetails, recentCommits))
    };
    
    processedContributors.push(processedContributor);
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`[PROCESS] Processed ${i + 1}/${Math.min(contributors.length, 500)} contributors`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Sort by total commits and update ranks
  processedContributors.sort((a, b) => b.total_commits - a.total_commits);
  processedContributors.forEach((contributor, index) => {
    contributor.rank = index + 1;
  });
  
  console.log(`[PROCESS] Completed processing ${processedContributors.length} contributors`);
  console.log(`[PROCESS] Top 5 contributors:`);
  processedContributors.slice(0, 5).forEach(c => {
    console.log(`  ${c.rank}. ${c.login}: ${c.total_commits} commits, +${c.total_additions}/-${c.total_deletions}, ${c.contributor_type}`);
  });
  
  return processedContributors;
}

// Calculate data completeness percentage
function calculateDataCompleteness(userDetails, recentCommits) {
  const fields = ['name', 'company', 'blog', 'location', 'bio'];
  const populatedFields = fields.filter(field => userDetails[field] && userDetails[field].trim() !== '');
  const profileCompleteness = (populatedFields.length / fields.length) * 60; // 60% weight for profile
  const activityCompleteness = recentCommits.length > 0 ? 40 : 0; // 40% weight for recent activity
  return Math.round(profileCompleteness + activityCompleteness);
}

// Generate enhanced repository statistics
function generateEnhancedRepoStats(contributors, repoName) {
  console.log(`[STATS] Generating enhanced repository statistics for ${repoName}...`);
  
  const total_contributors = contributors.length;
  const total_commits = contributors.reduce((sum, c) => sum + c.total_commits, 0);
  const total_additions = contributors.reduce((sum, c) => sum + c.total_additions, 0);
  const total_deletions = contributors.reduce((sum, c) => sum + c.total_deletions, 0);
  
  // Contributor distribution analysis
  const coreContributors = contributors.filter(c => c.contribution_percentage > 10).length;
  const regularContributors = contributors.filter(c => c.contribution_percentage > 1 && c.contribution_percentage <= 10).length;
  const occasionalContributors = contributors.filter(c => c.total_commits > 1 && c.contribution_percentage <= 1).length;
  const oneTimeContributors = contributors.filter(c => c.total_commits === 1).length;
  
  // Calculate bus factor (contributors that make up 50% of commits)
  let cumulativeCommits = 0;
  let busFactor = 0;
  const halfCommits = total_commits / 2;
  for (const contributor of contributors) {
    cumulativeCommits += contributor.total_commits;
    busFactor++;
    if (cumulativeCommits >= halfCommits) break;
  }
  
  // Top contributors with enhanced data
  const top_contributors = contributors.slice(0, 20).map(c => ({
    login: c.login,
    commits: c.total_commits,
    additions: c.total_additions,
    deletions: c.total_deletions,
    rank: c.rank,
    contribution_percentage: c.contribution_percentage,
    first_commit: c.first_commit_date,
    last_commit: c.last_commit_date
  }));
  
  // Weekly activity aggregation (enhanced)
  const weeklyActivity = {};
  contributors.forEach(contributor => {
    contributor.weeks.forEach(week => {
      const weekKey = week.week.toISOString();
      if (!weeklyActivity[weekKey]) {
        weeklyActivity[weekKey] = {
          week: week.week,
          total_commits: 0,
          total_additions: 0,
          total_deletions: 0,
          active_contributors: new Set(),
          commit_sizes: []
        };
      }
      weeklyActivity[weekKey].total_commits += week.commits;
      weeklyActivity[weekKey].total_additions += week.additions;
      weeklyActivity[weekKey].total_deletions += week.deletions;
      if (week.commits > 0) {
        weeklyActivity[weekKey].active_contributors.add(contributor.login);
        weeklyActivity[weekKey].commit_sizes.push(week.additions + week.deletions);
      }
    });
  });
  
  const weekly_activity = Object.values(weeklyActivity).map(week => ({
    week: week.week,
    total_commits: week.total_commits,
    total_additions: week.total_additions,
    total_deletions: week.total_deletions,
    active_contributors: week.active_contributors.size,
    avg_commit_size: week.commit_sizes.length > 0 ? 
      Math.round(week.commit_sizes.reduce((a, b) => a + b, 0) / week.commit_sizes.length) : 0
  })).sort((a, b) => a.week - b.week);
  
  // Monthly trends
  const monthlyTrends = {};
  weekly_activity.forEach(week => {
    const monthKey = dayjs(week.week).format('YYYY-MM');
    if (!monthlyTrends[monthKey]) {
      monthlyTrends[monthKey] = {
        month: monthKey,
        commits: 0,
        contributors: new Set(),
        additions: 0,
        deletions: 0
      };
    }
    monthlyTrends[monthKey].commits += week.total_commits;
    monthlyTrends[monthKey].additions += week.total_additions;
    monthlyTrends[monthKey].deletions += week.total_deletions;
  });
  
  const monthly_trends = Object.values(monthlyTrends).map(month => ({
    ...month,
    contributors: month.contributors.size,
    net_change: month.additions - month.deletions
  })).sort((a, b) => a.month.localeCompare(b.month));
  
  // Health and growth analysis
  const recentMonths = monthly_trends.slice(-6); // Last 6 months
  const avgRecentCommits = recentMonths.reduce((sum, m) => sum + m.commits, 0) / recentMonths.length;
  const growthTrend = recentMonths.length > 3 && recentMonths.slice(-3).reduce((sum, m) => sum + m.commits, 0) > 
                     recentMonths.slice(0, 3).reduce((sum, m) => sum + m.commits, 0) ? 'growing' : 'stable';
  
  const healthScore = Math.min(100, Math.round(
    (coreContributors * 20) + 
    (regularContributors * 10) + 
    (avgRecentCommits * 2) + 
    (busFactor > 5 ? 20 : busFactor * 4)
  ));
  
  // Enhanced summary
  const activeContributors = contributors.filter(c => c.days_since_last_commit < 90).length;
  const summary_text = `${repoName}: ${total_contributors} total contributors (${activeContributors} active in last 90 days), ${total_commits} commits, ${coreContributors} core contributors. Bus factor: ${busFactor}. Health score: ${healthScore}/100.`;
  
  return {
    repository: repoName,
    total_contributors,
    total_commits,
    total_additions,
    total_deletions,
    
    // Enhanced insights
    repository_age_days: weekly_activity.length * 7, // Approximate
    avg_commits_per_day: Math.round((total_commits / (weekly_activity.length * 7)) * 100) / 100,
    
    contributor_distribution: {
      core_contributors: coreContributors,
      regular_contributors: regularContributors,
      occasional_contributors: occasionalContributors,
      one_time_contributors: oneTimeContributors,
      bus_factor: busFactor
    },
    
    top_contributors,
    weekly_activity,
    monthly_trends,
    
    // Health metrics
    collaboration_score: Math.round((regularContributors + coreContributors) / total_contributors * 100),
    contributor_retention: Math.round(activeContributors / total_contributors * 100),
    growth_trend: growthTrend,
    health_score: healthScore,
    
    summary_text,
    last_updated: new Date()
  };
}

// Store contributors in database
async function storeContributors(contributors, repoName) {
  console.log(`[DB] Storing ${contributors.length} contributors for ${repoName}...`);
  
  // Clear existing contributors for this repository
  const deleted = await CONTRIBUTOR.deleteMany({ repository: repoName });
  console.log(`[DB] Deleted ${deleted.deletedCount} existing contributor records`);
  
  // Insert new contributors in batches
  if (contributors.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < contributors.length; i += batchSize) {
      const batch = contributors.slice(i, i + batchSize);
      await CONTRIBUTOR.insertMany(batch);
      console.log(`[DB] Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
    }
    console.log(`[DB] Total inserted: ${contributors.length} contributor records`);
  }
}

// Store repository statistics
async function storeRepoStats(repoStats) {
  console.log(`[DB] Storing enhanced repository stats for ${repoStats.repository}...`);
  
  await REPO_STATS.findOneAndUpdate(
    { repository: repoStats.repository },
    repoStats,
    { upsert: true, new: true }
  );
  
  console.log(`[DB] Enhanced repository stats updated for ${repoStats.repository}`);
}

// Main function to fetch comprehensive contributor data
async function fetchAllContributorData() {
  console.log(`[START] Fetching comprehensive contributor statistics...`);
  
  const repositories = [
    { owner: 'ethereum', name: 'EIPs' },
    { owner: 'ethereum', name: 'ERCs' },
    { owner: 'ethereum', name: 'RIPs' }
  ];
  
  for (const repo of repositories) {
    try {
      console.log(`\n=== PROCESSING ${repo.owner}/${repo.name} ===`);
      
      // Step 1: Get ALL contributors (not just top 100)
      const allContributors = await fetchAllContributors(repo.owner, repo.name);
      
      if (allContributors.length === 0) {
        console.log(`[SKIP] No contributors found for ${repo.name}`);
        continue;
      }
      
      // Step 2: Get contributor statistics (commit activity data)
      console.log(`[FETCH] Getting contributor statistics...`);
      const contributorStats = await fetchContributorStats(repo.owner, repo.name);
      
      if (!contributorStats || contributorStats.length === 0) {
        console.log(`[SKIP] No contributor stats available for ${repo.name}`);
        continue;
      }
      
      // Step 3: Process comprehensive contributor data
      const processedContributors = await processComprehensiveContributorData(
        allContributors, 
        contributorStats, 
        repo.name, 
        repo.owner, 
        repo.name
      );
      
      // Step 4: Generate enhanced repository statistics
      const repoStats = generateEnhancedRepoStats(processedContributors, repo.name);
      
      // Step 5: Store in database
      await storeContributors(processedContributors, repo.name);
      await storeRepoStats(repoStats);
      
      console.log(`[SUCCESS] ${repo.name}: ${processedContributors.length} contributors processed`);
      console.log(`[SUMMARY] Total commits: ${repoStats.total_commits}, Health score: ${repoStats.health_score}/100`);
      
      // Add delay between repositories
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`[ERROR] Failed to process ${repo.name}:`, error.message);
      continue;
    }
  }
}

// Main execution function
async function main() {
  console.log(`[START] Connecting to MongoDB (${DBNAME})...`);
  await mongoose.connect(MONGODB_URI, { dbName: DBNAME });
  
  try {
    await fetchAllContributorData();
    console.log(`\n[COMPLETE] Comprehensive contributor statistics collection completed!`);
    console.log(`\n📊 Enhanced data includes:`);
    console.log(`   • ALL contributors (not just top 100)`);
    console.log(`   • Full GitHub profiles (name, company, bio, etc.)`);
    console.log(`   • Detailed contribution patterns & streaks`);
    console.log(`   • Recent commit history`);
    console.log(`   • Contributor categorization (core/regular/occasional/one-time)`);
    console.log(`   • Repository health metrics & trends`);
    console.log(`   • Monthly/weekly activity analysis`);
    console.log(`   • Collaboration & retention insights`);
    
  } catch (error) {
    console.error(`[ERROR] Failed to collect comprehensive contributor statistics:`, error);
  } finally {
    await mongoose.connection.close();
  }
}

// Export for use in scheduler
module.exports = main;

// Run directly if this file is executed
if (require.main === module) {
  main().catch(e => {
    console.error(`[FATAL ERROR]`, e);
    process.exit(1);
  });
}