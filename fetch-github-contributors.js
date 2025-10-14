require('dotenv').config();
const mongoose = require('mongoose');
const dayjs = require('dayjs');

// MongoDB connection
const MONGODB_URI = process.env.OPENPRS_MONGODB_URI;
const DBNAME = process.env.OPENPRS_DATABASE;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Contributor schema
const contributorSchema = new mongoose.Schema({
  login: String,
  id: Number,
  avatar_url: String,
  html_url: String,
  total_commits: Number,
  total_additions: Number,
  total_deletions: Number,
  weeks: [{
    week: Date,
    additions: Number,
    deletions: Number,
    commits: Number
  }],
  repository: String,
  last_updated: Date,
  rank: Number
}, { strict: false });

// Repository stats schema
const repoStatsSchema = new mongoose.Schema({
  repository: String,
  total_contributors: Number,
  total_commits: Number,
  total_additions: Number,
  total_deletions: Number,
  top_contributors: [{
    login: String,
    commits: Number,
    additions: Number,
    deletions: Number,
    rank: Number
  }],
  weekly_activity: [{
    week: Date,
    total_commits: Number,
    total_additions: Number,
    total_deletions: Number,
    active_contributors: Number
  }],
  summary_text: String,
  last_updated: Date
}, { strict: false });

// Models
const CONTRIBUTOR = mongoose.models.CONTRIBUTOR || mongoose.model("CONTRIBUTOR", contributorSchema, "contributors");
const REPO_STATS = mongoose.models.REPO_STATS || mongoose.model("REPO_STATS", repoStatsSchema, "repository_stats");

// GitHub API helper
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
        console.log(`[API] GitHub is calculating stats (202), waiting 5 seconds... (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        } else {
          throw new Error('GitHub stats not ready after retries');
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if data is valid
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`[API] No contributor data available for ${url.split('/').slice(-2).join('/')}`);
        return [];
      }
      
      console.log(`[API] Success: Retrieved ${data.length} contributors`);
      return data;
    } catch (error) {
      if (attempt === retries) {
        console.error(`[API ERROR] Failed to fetch ${url} after ${retries} attempts:`, error.message);
        throw error;
      }
      console.log(`[API] Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Fetch contributors for a repository
async function fetchContributors(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`;
  return await fetchGitHubAPI(url);
}

// Process contributor data
function processContributorData(contributors, repoName) {
  console.log(`[PROCESS] Processing ${contributors.length} contributors for ${repoName}...`);
  
  const processedContributors = contributors.map((contributor, index) => {
    const total_commits = contributor.total;
    const total_additions = contributor.weeks.reduce((sum, week) => sum + week.a, 0);
    const total_deletions = contributor.weeks.reduce((sum, week) => sum + week.d, 0);
    
    return {
      login: contributor.author.login,
      id: contributor.author.id,
      avatar_url: contributor.author.avatar_url,
      html_url: contributor.author.html_url,
      total_commits,
      total_additions,
      total_deletions,
      weeks: contributor.weeks.map(week => ({
        week: new Date(week.w * 1000), // Convert Unix timestamp to Date
        additions: week.a,
        deletions: week.d,
        commits: week.c
      })),
      repository: repoName,
      last_updated: new Date(),
      rank: index + 1 // Will be updated after sorting
    };
  });
  
  // Sort by total commits (descending) and update ranks
  processedContributors.sort((a, b) => b.total_commits - a.total_commits);
  processedContributors.forEach((contributor, index) => {
    contributor.rank = index + 1;
  });
  
  console.log(`[PROCESS] Top 10 contributors:`);
  processedContributors.slice(0, 10).forEach(c => {
    console.log(`  ${c.rank}. ${c.login}: ${c.total_commits} commits, +${c.total_additions}/-${c.total_deletions}`);
  });
  
  return processedContributors;
}

// Generate repository statistics
function generateRepoStats(contributors, repoName) {
  const total_contributors = contributors.length;
  const total_commits = contributors.reduce((sum, c) => sum + c.total_commits, 0);
  const total_additions = contributors.reduce((sum, c) => sum + c.total_additions, 0);
  const total_deletions = contributors.reduce((sum, c) => sum + c.total_deletions, 0);
  
  // Top 10 contributors
  const top_contributors = contributors.slice(0, 10).map(c => ({
    login: c.login,
    commits: c.total_commits,
    additions: c.total_additions,
    deletions: c.total_deletions,
    rank: c.rank
  }));
  
  // Weekly activity aggregation
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
          active_contributors: new Set()
        };
      }
      weeklyActivity[weekKey].total_commits += week.commits;
      weeklyActivity[weekKey].total_additions += week.additions;
      weeklyActivity[weekKey].total_deletions += week.deletions;
      if (week.commits > 0) {
        weeklyActivity[weekKey].active_contributors.add(contributor.login);
      }
    });
  });
  
  const weekly_activity = Object.values(weeklyActivity).map(week => ({
    week: week.week,
    total_commits: week.total_commits,
    total_additions: week.total_additions,
    total_deletions: week.total_deletions,
    active_contributors: week.active_contributors.size
  })).sort((a, b) => a.week - b.week);
  
  // Generate summary text
  const topCommitter = contributors[0];
  const summary_text = `Total: ${total_contributors} contributors have made ${total_commits} commits with ${total_additions} additions and ${total_deletions} deletions. Top contributor: ${topCommitter.login} with ${topCommitter.total_commits} commits.`;
  
  return {
    repository: repoName,
    total_contributors,
    total_commits,
    total_additions,
    total_deletions,
    top_contributors,
    weekly_activity,
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
  
  // Insert new contributors
  if (contributors.length > 0) {
    await CONTRIBUTOR.insertMany(contributors);
    console.log(`[DB] Inserted ${contributors.length} contributor records`);
  }
}

// Store repository statistics
async function storeRepoStats(repoStats) {
  console.log(`[DB] Storing repository stats for ${repoStats.repository}...`);
  
  // Upsert repository stats
  await REPO_STATS.findOneAndUpdate(
    { repository: repoStats.repository },
    repoStats,
    { upsert: true, new: true }
  );
  
  console.log(`[DB] Repository stats updated for ${repoStats.repository}`);
}

// Main function to fetch contributors for all repositories
async function fetchAllContributors() {
  console.log(`[START] Fetching contributor statistics...`);
  
  const repositories = [
    { owner: 'ethereum', name: 'EIPs' },
    { owner: 'ethereum', name: 'ERCs' },
    { owner: 'ethereum', name: 'RIPs' }
  ];
  
  for (const repo of repositories) {
    try {
      console.log(`\n=== PROCESSING ${repo.owner}/${repo.name} ===`);
      
      // Fetch contributor data from GitHub
      const contributors = await fetchContributors(repo.owner, repo.name);
      
      if (!contributors || contributors.length === 0) {
        console.log(`[SKIP] No contributors found for ${repo.name}`);
        continue;
      }
      
      // Process contributor data
      const processedContributors = processContributorData(contributors, repo.name);
      
      // Generate repository statistics
      const repoStats = generateRepoStats(processedContributors, repo.name);
      
      // Store in database
      await storeContributors(processedContributors, repo.name);
      await storeRepoStats(repoStats);
      
      console.log(`[SUCCESS] Completed ${repo.name}: ${processedContributors.length} contributors, ${repoStats.total_commits} total commits`);
      
      // Add delay between repositories to be respectful to GitHub API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`[ERROR] Failed to process ${repo.name}:`, error.message);
      continue; // Continue with next repository
    }
  }
}

// Main execution function
async function main() {
  console.log(`[START] Connecting to MongoDB (${DBNAME})...`);
  await mongoose.connect(MONGODB_URI, { dbName: DBNAME });
  
  try {
    await fetchAllContributors();
    console.log(`\n[COMPLETE] Contributor statistics collection completed successfully!`);
    
  } catch (error) {
    console.error(`[ERROR] Failed to collect contributor statistics:`, error);
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