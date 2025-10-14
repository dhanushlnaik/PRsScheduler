// index.js - Main Scheduler with Comprehensive Logging

require('dotenv').config();
const cron = require('node-cron');

// Use child_process to call the other JS files as scripts
const { exec } = require('child_process');

// Check for test mode
const isTestMode = process.argv.includes('--test') || process.argv.includes('-t');

// --- Enhanced Logging Functions ---

function logWithTimestamp(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${type}]`;
  console.log(`${logPrefix} ${message}`);
}

function logJobStart(jobName, nextRun) {
  logWithTimestamp(`🔄 ${jobName} - STARTING`, 'JOB');
  logWithTimestamp(`Next scheduled run: ${nextRun}`, 'SCHEDULE');
}

function logJobEnd(jobName, success = true) {
  const status = success ? '✅ COMPLETED' : '❌ FAILED';
  logWithTimestamp(`${status} - ${jobName}`, 'JOB');
}

function logError(jobName, error) {
  logWithTimestamp(`ERROR in ${jobName}: ${error.message}`, 'ERROR');
  if (error.stack) {
    console.error(error.stack);
  }
}

// --- Status and Heartbeat Logging ---

function getNextJobTimes() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  
  // Calculate next job times
  let nextFetch, nextSnapshot, nextCharts;
  
  if (currentMinute < 30) {
    // Next jobs are today
    nextFetch = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, 30);
    nextSnapshot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, 45);
    nextCharts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
  } else if (currentMinute < 45) {
    // Next fetch is today, others are next cycle
    nextFetch = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
    nextSnapshot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, 45);
    nextCharts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
  } else {
    // Next fetch is next cycle
    nextFetch = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
    nextSnapshot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 30);
    nextCharts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 45);
  }
  
  return {
    fetch: nextFetch,
    snapshot: nextSnapshot,
    charts: nextCharts
  };
}

function logStatusUpdate() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  
  // Calculate next pipeline run (every 2 hours at :00)
  let nextPipelineRun;
  if (currentMinute === 0) {
    // If we're exactly at :00, next run is in 2 hours
    nextPipelineRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
  } else {
    // Next run is at the next :00 (either this hour or next)
    if (currentMinute < 60) {
      nextPipelineRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 2, 0);
    } else {
      nextPipelineRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour + 1, 0);
    }
  }
  
  logWithTimestamp('📊 SCHEDULER STATUS UPDATE', 'STATUS');
  logWithTimestamp(`Current time: ${now.toLocaleString()}`, 'STATUS');
  logWithTimestamp('', 'STATUS');
  logWithTimestamp('⏰ Next scheduled pipeline run:', 'STATUS');
  logWithTimestamp(`  🚀 Complete Pipeline: ${nextPipelineRun.toLocaleString()}`, 'STATUS');
  logWithTimestamp('', 'STATUS');
  logWithTimestamp('📋 Pipeline steps (run sequentially):', 'STATUS');
  logWithTimestamp('  1️⃣ Fetch PRs from GitHub API', 'STATUS');
  logWithTimestamp('  2️⃣ Generate historical snapshots', 'STATUS');
  logWithTimestamp('  3️⃣ Populate chart collections', 'STATUS');
  logWithTimestamp('', 'STATUS');
  logWithTimestamp('💡 Scheduler is running and monitoring...', 'STATUS');
}

// Status update every 30 minutes
setInterval(logStatusUpdate, 30 * 60 * 1000); // 30 minutes

// Heartbeat every 5 minutes
setInterval(() => {
  logWithTimestamp('💓 Scheduler heartbeat - System is running', 'HEARTBEAT');
}, 5 * 60 * 1000); // 5 minutes

// --- Sequential Job Pipeline Functions ---

function runJob(scriptPath, jobName, logPrefix) {
  return new Promise((resolve, reject) => {
    logWithTimestamp(`🔄 Starting ${jobName}...`, logPrefix);
    logWithTimestamp(`📄 Running: node ${scriptPath}`, logPrefix);
    
    const child = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        logError(jobName, error);
        reject(error);
        return;
      }
      
      // Log ALL stdout from the script
      if (stdout) {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            // Prefix each line with the job name for clarity
            logWithTimestamp(`${line.trim()}`, logPrefix);
          }
        });
      }
      
      // Log ALL stderr from the script
      if (stderr) {
        const lines = stderr.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            logWithTimestamp(`STDERR: ${line.trim()}`, 'WARN');
          }
        });
      }
      
      logWithTimestamp(`✅ ${jobName} completed successfully`, logPrefix);
      resolve();
    });

    // Real-time output logging - show ALL output as it comes
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logWithTimestamp(`${line.trim()}`, logPrefix);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logWithTimestamp(`STDERR: ${line.trim()}`, 'WARN');
        }
      });
    });
  });
}

async function runJobPipeline() {
  const pipelineName = 'PR & Contributor Processing Pipeline';
  const nextRun = new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString(); // 2 hours from now
  
  logWithTimestamp(`🚀 ${pipelineName} - STARTING`, 'PIPELINE');
  logWithTimestamp(`Next scheduled run: ${nextRun}`, 'PIPELINE');
  logWithTimestamp('', 'PIPELINE');
  logWithTimestamp('═══════════════════════════════════════════════════════════', 'PIPELINE');
  
  try {
    // Step 1: Fetch PRs from GitHub
    logWithTimestamp('📋 STEP 1/4: GitHub PR Import', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    await runJob('fetch-github-prs.js', 'GitHub PR Import', 'FETCH');
    
    logWithTimestamp('', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    
    // Step 2: Fetch Contributors from GitHub
    logWithTimestamp('📋 STEP 2/4: GitHub Contributors Import', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    await runJob('fetch-github-contributors.js', 'GitHub Contributors Import', 'CONTRIBUTORS');
    
    logWithTimestamp('', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    
    // Step 3: Generate Snapshots
    logWithTimestamp('📋 STEP 3/4: PR Snapshots Generation', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    await runJob('snapshot-open-prs.js', 'PR Snapshots Generation', 'SNAPSHOT');
    
    logWithTimestamp('', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    
    // Step 4: Populate Chart Collections
    logWithTimestamp('📋 STEP 4/4: Chart Collections Population', 'PIPELINE');
    logWithTimestamp('─────────────────────────────────────────────────────────', 'PIPELINE');
    await runJob('populate-chart-collections.js', 'Chart Collections Population', 'CHARTS');
    
    logWithTimestamp('', 'PIPELINE');
    logWithTimestamp('═══════════════════════════════════════════════════════════', 'PIPELINE');
    logWithTimestamp(`✅ ${pipelineName} - COMPLETED`, 'PIPELINE');
    logWithTimestamp('', 'PIPELINE');
    
  } catch (error) {
    logWithTimestamp('', 'PIPELINE');
    logWithTimestamp('═══════════════════════════════════════════════════════════', 'PIPELINE');
    logError(pipelineName, error);
    logWithTimestamp(`❌ ${pipelineName} - FAILED`, 'PIPELINE');
    logWithTimestamp('', 'PIPELINE');
  }
}

// --- Test Mode Job Execution ---
if (isTestMode) {
  logWithTimestamp('🧪 TEST MODE ENABLED - Pipeline will run immediately', 'TEST');
  
  // Run pipeline immediately in test mode
  setTimeout(async () => {
    logWithTimestamp('🧪 Running pipeline in test mode...', 'TEST');
    await runJobPipeline();
  }, 3000);
}

// --- Single Pipeline Scheduler ---

// Every 2 hours: run the complete pipeline
cron.schedule('0 */2 * * *', async () => {
  await runJobPipeline();
});


// --- Startup Information ---

function logStartupInfo() {
  logWithTimestamp('🚀 PR & Contributor Analytics Scheduler Starting...', 'STARTUP');
  logWithTimestamp('📊 Monitoring: EIPs, ERCs, RIPs repositories', 'STARTUP');
  logWithTimestamp('⏰ Schedule: Every 2 hours', 'STARTUP');
  logWithTimestamp('', 'STARTUP');
  logWithTimestamp('📅 Pipeline Execution Order:', 'STARTUP');
  logWithTimestamp('  :00 - 🔄 Step 1: Fetch PRs from GitHub API', 'STARTUP');
  logWithTimestamp('         ⏳ Step 2: Fetch Contributors from GitHub API', 'STARTUP');
  logWithTimestamp('         ⏳ Step 3: Generate historical snapshots', 'STARTUP');
  logWithTimestamp('         ⏳ Step 4: Populate chart collections', 'STARTUP');
  logWithTimestamp('', 'STARTUP');
  logWithTimestamp('📈 Data Collection:', 'STARTUP');
  logWithTimestamp('  • Pull Requests (status, labels, timelines)', 'STARTUP');
  logWithTimestamp('  • Contributors (commits, additions, deletions)', 'STARTUP');
  logWithTimestamp('  • Repository statistics & rankings', 'STARTUP');
  logWithTimestamp('', 'STARTUP');
  logWithTimestamp('🔄 Jobs run sequentially (one after another)', 'STARTUP');
  logWithTimestamp('✅ Pipeline scheduler is active and running', 'STARTUP');
  logWithTimestamp('💡 Use Ctrl+C to stop the scheduler', 'STARTUP');
  logWithTimestamp('📝 Check logs for pipeline execution details', 'STARTUP');
  logWithTimestamp('', 'STARTUP');
  logWithTimestamp('🔄 Scheduler is now running...', 'STARTUP');
}

// Display startup information
logStartupInfo();

// Show initial status after 2 seconds
setTimeout(() => {
  logStatusUpdate();
}, 2000);

// Graceful shutdown handling
process.on('SIGINT', () => {
  logWithTimestamp('🛑 Received SIGINT signal', 'SHUTDOWN');
  logWithTimestamp('⏹️ Stopping PR Scheduler...', 'SHUTDOWN');
  logWithTimestamp('✅ Shutdown complete', 'SHUTDOWN');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logWithTimestamp('🛑 Received SIGTERM signal', 'SHUTDOWN');
  logWithTimestamp('⏹️ Stopping PR Scheduler...', 'SHUTDOWN');
  logWithTimestamp('✅ Shutdown complete', 'SHUTDOWN');
  process.exit(0);
});

// Keep the process running
setInterval(() => {}, 1 << 30);

