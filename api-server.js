require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.OPENPRS_MONGODB_URI;
const DBNAME = process.env.OPENPRS_DATABASE;

// Schemas
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

const rawLabelsSchema = new mongoose.Schema({
  prId: Number,
  number: Number,
  title: String,
  author: String,
  prUrl: String,
  rawGithubLabels: [String],
  refinedLabels: [String],
  state: String,
  mergeable_state: String,
  createdAt: Date,
  updatedAt: Date,
  closedAt: Date,
  mergedAt: Date,
  specType: String,
}, { strict: false });

// Models
const EIP_PR = mongoose.models.EIP_PR || mongoose.model("EIP_PR", prSchema, "eipprs");
const ERC_PR = mongoose.models.ERC_PR || mongoose.model("ERC_PR", prSchema, "ercprs");
const RIP_PR = mongoose.models.RIP_PR || mongoose.model("RIP_PR", prSchema, "ripprs");

const EIP_RAW_LABELS = mongoose.models.EIP_RAW_LABELS || mongoose.model("EIP_RAW_LABELS", rawLabelsSchema, "eip_raw_labels");
const ERC_RAW_LABELS = mongoose.models.ERC_RAW_LABELS || mongoose.model("ERC_RAW_LABELS", rawLabelsSchema, "erc_raw_labels");
const RIP_RAW_LABELS = mongoose.models.RIP_RAW_LABELS || mongoose.model("RIP_RAW_LABELS", rawLabelsSchema, "rip_raw_labels");

// Helper function to get month-year from date
function getMonthYear(date) {
  return dayjs(date).format('YYYY-MM');
}

// Helper function to aggregate data by month-year
function aggregateByMonthYear(prs, groupByField) {
  const monthlyData = {};
  
  prs.forEach(pr => {
    const monthYear = getMonthYear(pr.createdAt);
    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = {};
    }
    
    const key = pr[groupByField] || 'Unknown';
    if (typeof key === 'object' && Array.isArray(key)) {
      // Handle array fields (like labels)
      key.forEach(item => {
        monthlyData[monthYear][item] = (monthlyData[monthYear][item] || 0) + 1;
      });
    } else {
      monthlyData[monthYear][key] = (monthlyData[monthYear][key] || 0) + 1;
    }
  });
  
  return monthlyData;
}

// Helper function to get PR state counts by month-year in the specific format
function getPRStateCountsByMonthYear(prs, specType) {
  const monthlyData = {};
  
  prs.forEach(pr => {
    const createdMonth = getMonthYear(pr.createdAt);
    const closedMonth = pr.closedAt ? getMonthYear(pr.closedAt) : null;
    const mergedMonth = pr.mergedAt ? getMonthYear(pr.mergedAt) : null;
    
    // Initialize month if not exists
    if (!monthlyData[createdMonth]) {
      monthlyData[createdMonth] = { created: 0, closed: 0, merged: 0, open: 0 };
    }
    
    // Count created PRs
    monthlyData[createdMonth].created++;
    
    // Count closed PRs (not merged)
    if (closedMonth && !pr.mergedAt) {
      if (!monthlyData[closedMonth]) {
        monthlyData[closedMonth] = { created: 0, closed: 0, merged: 0, open: 0 };
      }
      monthlyData[closedMonth].closed++;
    }
    
    // Count merged PRs
    if (mergedMonth) {
      if (!monthlyData[mergedMonth]) {
        monthlyData[mergedMonth] = { created: 0, closed: 0, merged: 0, open: 0 };
      }
      monthlyData[mergedMonth].merged++;
    }
  });
  
  // Convert to the specific format with separate documents
  const formattedData = [];
  const category = specType.toLowerCase() + 's'; // eips, ercs, rips
  
  Object.entries(monthlyData).forEach(([monthYear, counts]) => {
    // Calculate open PRs (created - merged - closed)
    const openCount = counts.created - counts.merged - counts.closed;
    
    // Add each type as a separate document
    formattedData.push(
      {
        _id: `${monthYear}-created-${Date.now()}`,
        category: category,
        monthYear: monthYear,
        type: "Created",
        count: counts.created
      },
      {
        _id: `${monthYear}-merged-${Date.now()}`,
        category: category,
        monthYear: monthYear,
        type: "Merged",
        count: -counts.merged // Negative value
      },
      {
        _id: `${monthYear}-closed-${Date.now()}`,
        category: category,
        monthYear: monthYear,
        type: "Closed",
        count: -counts.closed // Negative value
      },
      {
        _id: `${monthYear}-open-${Date.now()}`,
        category: category,
        monthYear: monthYear,
        type: "Open",
        count: Math.max(0, openCount) // Ensure non-negative
      }
    );
  });
  
  return formattedData.sort((a, b) => {
    // Sort by monthYear descending, then by type
    if (a.monthYear !== b.monthYear) {
      return b.monthYear.localeCompare(a.monthYear);
    }
    const typeOrder = ["Created", "Merged", "Closed", "Open"];
    return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
  });
}

// Helper function to get model by spec type
function getModelBySpecType(specType, isRawLabels = false) {
  const models = {
    EIP: isRawLabels ? EIP_RAW_LABELS : EIP_PR,
    ERC: isRawLabels ? ERC_RAW_LABELS : ERC_PR,
    RIP: isRawLabels ? RIP_RAW_LABELS : RIP_PR
  };
  return models[specType.toUpperCase()];
}

// ============================================================================
// GRAPH 1 API: Continuous data of open, closed, merged, created PRs by month-year
// ============================================================================

app.get('/api/graph1/:specType', async (req, res) => {
  try {
    const { specType } = req.params;
    const { startDate, endDate } = req.query;
    
    const PR = getModelBySpecType(specType);
    if (!PR) {
      return res.status(400).json({ error: 'Invalid spec type. Use EIP, ERC, or RIP' });
    }
    
    // Build query
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const prs = await PR.find(query).lean();
    const formattedData = getPRStateCountsByMonthYear(prs, specType);
    
    res.json({
      specType: specType.toUpperCase(),
      data: formattedData,
      totalPRs: prs.length,
      dateRange: {
        start: startDate || 'earliest',
        end: endDate || 'latest'
      }
    });
    
  } catch (error) {
    console.error('Graph 1 API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================================================
// GRAPH 2 API: Custom labels by month-year (EIP Update, New EIP, Status Change, Misc, etc.)
// ============================================================================

app.get('/api/graph2/:specType', async (req, res) => {
  try {
    const { specType } = req.params;
    const { startDate, endDate } = req.query;
    
    const PR = getModelBySpecType(specType);
    if (!PR) {
      return res.status(400).json({ error: 'Invalid spec type. Use EIP, ERC, or RIP' });
    }
    
    // Build query
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const prs = await PR.find(query).lean();
    const monthlyData = aggregateByMonthYear(prs, 'customLabels');
    
    // Format response
    const formattedData = Object.entries(monthlyData).map(([monthYear, labelCounts]) => ({
      monthYear,
      labels: labelCounts
    })).sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    
    res.json({
      specType: specType.toUpperCase(),
      data: formattedData,
      totalPRs: prs.length,
      dateRange: {
        start: startDate || 'earliest',
        end: endDate || 'latest'
      }
    });
    
  } catch (error) {
    console.error('Graph 2 API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================================================
// GRAPH 3 API: Raw GitHub labels by month-year
// ============================================================================

app.get('/api/graph3/:specType', async (req, res) => {
  try {
    const { specType } = req.params;
    const { startDate, endDate } = req.query;
    
    const RAW_MODEL = getModelBySpecType(specType, true);
    if (!RAW_MODEL) {
      return res.status(400).json({ error: 'Invalid spec type. Use EIP, ERC, or RIP' });
    }
    
    // Build query
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const prs = await RAW_MODEL.find(query).lean();
    const monthlyData = aggregateByMonthYear(prs, 'rawGithubLabels');
    
    // Format response
    const formattedData = Object.entries(monthlyData).map(([monthYear, labelCounts]) => ({
      monthYear,
      labels: labelCounts
    })).sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    
    res.json({
      specType: specType.toUpperCase(),
      data: formattedData,
      totalPRs: prs.length,
      dateRange: {
        start: startDate || 'earliest',
        end: endDate || 'latest'
      }
    });
    
  } catch (error) {
    console.error('Graph 3 API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================================================
// ADDITIONAL UTILITY ENDPOINTS
// ============================================================================

// Get all available spec types
app.get('/api/spec-types', (req, res) => {
  res.json({
    specTypes: ['EIP', 'ERC', 'RIP'],
    description: 'Available specification types for all endpoints'
  });
});

// Get data summary for all spec types
app.get('/api/summary', async (req, res) => {
  try {
    const summary = {};
    
    for (const specType of ['EIP', 'ERC', 'RIP']) {
      const PR = getModelBySpecType(specType);
      const RAW_MODEL = getModelBySpecType(specType, true);
      
      const totalPRs = await PR.countDocuments();
      const totalRawLabels = await RAW_MODEL.countDocuments();
      
      // Get date range
      const firstPR = await PR.findOne().sort({ createdAt: 1 }).lean();
      const lastPR = await PR.findOne().sort({ createdAt: -1 }).lean();
      
      summary[specType] = {
        totalPRs,
        totalRawLabels,
        dateRange: {
          earliest: firstPR?.createdAt || null,
          latest: lastPR?.createdAt || null
        }
      };
    }
    
    res.json(summary);
    
  } catch (error) {
    console.error('Summary API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      mongodb: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      mongodb: 'disconnected',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/graph1/:specType - PR state counts by month-year',
      'GET /api/graph2/:specType - Custom labels by month-year', 
      'GET /api/graph3/:specType - Raw GitHub labels by month-year',
      'GET /api/spec-types - Available spec types',
      'GET /api/summary - Data summary for all spec types',
      'GET /api/health - Health check'
    ]
  });
});

// Start server
async function startServer() {
  try {
    console.log(`[API] Connecting to MongoDB (${DBNAME})...`);
    await mongoose.connect(MONGODB_URI, { dbName: DBNAME });
    console.log(`[API] MongoDB connected successfully`);
    
    app.listen(PORT, () => {
      console.log(`[API] Server running on port ${PORT}`);
      console.log(`[API] Available endpoints:`);
      console.log(`  - Graph 1: http://localhost:${PORT}/api/graph1/{EIP|ERC|RIP}`);
      console.log(`  - Graph 2: http://localhost:${PORT}/api/graph2/{EIP|ERC|RIP}`);
      console.log(`  - Graph 3: http://localhost:${PORT}/api/graph3/{EIP|ERC|RIP}`);
      console.log(`  - Summary: http://localhost:${PORT}/api/summary`);
      console.log(`  - Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[API] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[API] Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
