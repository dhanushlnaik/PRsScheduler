require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import models
const Contributor = require('./models/Contributor');
const RepositoryStats = require('./models/RepositoryStats');

// MongoDB connection
const MONGODB_URI = process.env.OPENPRS_MONGODB_URI;
const DBNAME = process.env.OPENPRS_DATABASE;

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { dbName: DBNAME })
  .then(() => console.log(`[API] Connected to MongoDB: ${DBNAME}`))
  .catch(err => console.error('[API] MongoDB connection error:', err));

// Helper function to get repository filter
function getRepositoryFilter(repo) {
  if (!repo || repo === 'all') return {};
  return { repository: repo.toUpperCase() };
}

// --- Repository Statistics Endpoints ---

// GET /api/contributors/stats - Overall repository statistics
app.get('/api/contributors/stats', async (req, res) => {
  try {
    const { repository } = req.query;
    const filter = getRepositoryFilter(repository);
    
    const stats = await RepositoryStats.find(filter)
      .sort({ last_updated: -1 })
      .lean();
    
    res.json({
      success: true,
      data: stats,
      count: stats.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/contributors/stats/:repo - Statistics for specific repository
app.get('/api/contributors/stats/:repo', async (req, res) => {
  try {
    const { repo } = req.params;
    
    const stats = await RepositoryStats.findOne({ 
      repository: repo.toUpperCase() 
    }).lean();
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: `Repository statistics not found for ${repo}`
      });
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Contributors Endpoints ---

// GET /api/contributors - List all contributors
app.get('/api/contributors', async (req, res) => {
  try {
    const { 
      repository, 
      limit = 50, 
      page = 1, 
      sortBy = 'total_commits', 
      order = 'desc' 
    } = req.query;
    
    const filter = getRepositoryFilter(repository);
    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;
    
    const contributors = await Contributor.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();
    
    const total = await Contributor.countDocuments(filter);
    
    res.json({
      success: true,
      data: contributors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/contributors/top - Top contributors across repositories
app.get('/api/contributors/top', async (req, res) => {
  try {
    const { 
      repository, 
      limit = 10, 
      metric = 'total_commits' 
    } = req.query;
    
    const filter = getRepositoryFilter(repository);
    
    const topContributors = await Contributor.find(filter)
      .sort({ [metric]: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      data: topContributors,
      metric,
      count: topContributors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/contributors/:username - Get specific contributor
app.get('/api/contributors/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { repository } = req.query;
    
    const filter = { login: username };
    if (repository && repository !== 'all') {
      filter.repository = repository.toUpperCase();
    }
    
    const contributor = await Contributor.findOne(filter).lean();
    
    if (!contributor) {
      return res.status(404).json({
        success: false,
        error: `Contributor ${username} not found`
      });
    }
    
    res.json({
      success: true,
      data: contributor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/contributors/:username/timeline - Get contributor's activity timeline
app.get('/api/contributors/:username/timeline', async (req, res) => {
  try {
    const { username } = req.params;
    const { repository } = req.query;
    
    const filter = { login: username };
    if (repository && repository !== 'all') {
      filter.repository = repository.toUpperCase();
    }
    
    const contributor = await Contributor.findOne(filter, 'weeks repository login').lean();
    
    if (!contributor) {
      return res.status(404).json({
        success: false,
        error: `Contributor ${username} not found`
      });
    }
    
    // Sort weeks chronologically
    const timeline = contributor.weeks
      .filter(week => week.commits > 0) // Only include weeks with activity
      .sort((a, b) => new Date(a.week) - new Date(b.week));
    
    res.json({
      success: true,
      data: {
        login: contributor.login,
        repository: contributor.repository,
        timeline,
        total_active_weeks: timeline.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Weekly Activity Endpoints ---

// GET /api/contributors/activity/weekly - Weekly activity aggregations
app.get('/api/contributors/activity/weekly', async (req, res) => {
  try {
    const { repository, weeks = 52 } = req.query;
    
    const filter = getRepositoryFilter(repository);
    
    const stats = await RepositoryStats.findOne(filter, 'weekly_activity repository').lean();
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Weekly activity data not found'
      });
    }
    
    // Get last N weeks
    const recentActivity = stats.weekly_activity
      .sort((a, b) => new Date(b.week) - new Date(a.week))
      .slice(0, parseInt(weeks));
    
    res.json({
      success: true,
      data: {
        repository: stats.repository,
        weeks_requested: parseInt(weeks),
        weeks_available: recentActivity.length,
        activity: recentActivity.reverse() // Return chronologically
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Summary and Rankings Endpoints ---

// GET /api/contributors/summary - Overall summary statistics
app.get('/api/contributors/summary', async (req, res) => {
  try {
    const allStats = await RepositoryStats.find({})
      .sort({ last_updated: -1 })
      .lean();
    
    const summary = {
      repositories: allStats.length,
      total_contributors: allStats.reduce((sum, repo) => sum + repo.total_contributors, 0),
      total_commits: allStats.reduce((sum, repo) => sum + repo.total_commits, 0),
      total_additions: allStats.reduce((sum, repo) => sum + repo.total_additions, 0),
      total_deletions: allStats.reduce((sum, repo) => sum + repo.total_deletions, 0),
      by_repository: allStats.map(repo => ({
        name: repo.repository,
        contributors: repo.total_contributors,
        commits: repo.total_commits,
        additions: repo.total_additions,
        deletions: repo.total_deletions,
        last_updated: repo.last_updated
      })),
      last_updated: Math.max(...allStats.map(r => new Date(r.last_updated)))
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Contributors API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api/contributors/stats',
      'GET /api/contributors/stats/:repo',
      'GET /api/contributors',
      'GET /api/contributors/top',
      'GET /api/contributors/:username',
      'GET /api/contributors/:username/timeline',
      'GET /api/contributors/activity/weekly',
      'GET /api/contributors/summary',
      'GET /api/health'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('[API ERROR]', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[API] Contributors API server running on port ${PORT}`);
  console.log(`[API] Available at: http://localhost:${PORT}`);
  console.log(`[API] Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;