require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const { Octokit } = require('octokit');
const YTDlpWrap = require('yt-dlp-wrap').default;
const { v4: uuidv4 } = require('uuid');
const { rateLimiters, securityHeaders, corsOptions, requestLogger, sanitizeInput, errorHandler } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize yt-dlp
let ytDlpWrap;
try {
  ytDlpWrap = new YTDlpWrap();
} catch (error) {
  console.warn('yt-dlp not found, YouTube import features will be disabled');
  console.warn('Error:', error.message);
}

// Configure middleware
app.use(securityHeaders);
app.use(corsOptions);
app.use(requestLogger);
app.use(rateLimiters.general);
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeInput);
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Octokit with GitHub token
if (!process.env.GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

if (!process.env.REPO_OWNER || !process.env.REPO_NAME) {
  console.error('REPO_OWNER and REPO_NAME environment variables are required');
  process.exit(1);
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: require('./package.json').version
  });
});

// API endpoint to fetch the JSON data
app.get('/api/data', rateLimiters.api, async (req, res) => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/fabriziosalmi/audiolibri/refs/heads/main/augmented.json');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// API endpoint to get data hash for monitoring changes
app.get('/api/data-hash', rateLimiters.api, async (req, res) => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/fabriziosalmi/audiolibri/refs/heads/main/augmented.json');
    const data = response.data;
    
    // Generate a simple hash based on content length and timestamp (safer than btoa for Unicode)
    const jsonString = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < Math.min(jsonString.length, 1000); i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const safeHash = Math.abs(hash) + '_' + jsonString.length + '_' + Date.now();
    
    res.json({ 
      hash: safeHash,
      timestamp: new Date().toISOString(),
      itemCount: Object.keys(data).length
    });
  } catch (error) {
    console.error('Error fetching data hash:', error);
    res.status(500).json({ error: 'Failed to fetch data hash' });
  }
});

// API endpoint to search for items
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const response = await axios.get('https://raw.githubusercontent.com/fabriziosalmi/audiolibri/refs/heads/main/augmented.json');
    const data = response.data;
    
    if (!query) {
      return res.json(data);
    }
    
    const searchQuery = query.toLowerCase();
    const results = {};
    
    Object.entries(data).forEach(([id, item]) => {
      // Enhanced search to include all relevant fields
      const searchableFields = [
        item.title,
        item.real_title,
        item.real_author,
        item.real_genre,
        item.real_synopsis,
        item.real_narrator,
        item.channel_name,
        item.description,
        item.summary,
        item.content_type,
        item.real_language,
        item.audio_file
      ];
      
      // Add categories to search
      if (item.categories && Array.isArray(item.categories)) {
        searchableFields.push(...item.categories);
      }
      
      // Add tags to search
      if (item.tags && Array.isArray(item.tags)) {
        searchableFields.push(...item.tags);
      }
      
      // Check if any field matches the search query
      const hasMatch = searchableFields.some(field => {
        if (!field) return false;
        return String(field).toLowerCase().includes(searchQuery);
      });
      
      if (hasMatch) {
        results[id] = item;
      }
    });
    
    res.json(results);
  } catch (error) {
    console.error('Error searching data:', error);
    res.status(500).json({ error: 'Failed to search data' });
  }
});

// API endpoint to submit changes and create a pull request
app.post('/api/submit', rateLimiters.github, async (req, res) => {
  try {
    const { changes, branchName, commitMessage, prTitle, prDescription } = req.body;
    
    console.log('Received save request:', {
      changesCount: changes ? Object.keys(changes).length : 0,
      branchName,
      commitMessage,
      prTitle
    });
    
    // Validation
    if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
      console.log('No changes provided in request');
      return res.status(400).json({ 
        success: false, 
        error: 'No changes provided' 
      });
    }
    
    if (!branchName || typeof branchName !== 'string' || !branchName.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Branch name is required' 
      });
    }
    
    if (!commitMessage || typeof commitMessage !== 'string' || !commitMessage.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Commit message is required' 
      });
    }
    
    if (!prTitle || typeof prTitle !== 'string' || !prTitle.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'PR title is required' 
      });
    }
    
    // Validate GitHub credentials
    if (!process.env.GITHUB_TOKEN || !process.env.REPO_OWNER || !process.env.REPO_NAME) {
      console.error('Missing GitHub configuration');
      return res.status(500).json({ 
        success: false, 
        error: 'GitHub configuration missing' 
      });
    }
    
    console.log('Fetching current data from GitHub...');
    
    // Fetch the current data
    const response = await axios.get('https://raw.githubusercontent.com/fabriziosalmi/audiolibri/refs/heads/main/augmented.json');
    const currentData = response.data;
    
    if (!currentData || typeof currentData !== 'object') {
      throw new Error('Invalid data format received from repository');
    }
    
    console.log('Current data loaded, applying changes...');
    
    // Apply the changes
    const updatedData = { ...currentData };
    let actualChangesCount = 0;
    
    Object.entries(changes).forEach(([id, item]) => {
      if (currentData[id]) {
        const originalItem = currentData[id];
        let hasActualChanges = false;
        
        // Only apply changes that are actually different
        Object.entries(item).forEach(([field, value]) => {
          if (originalItem[field] !== value) {
            updatedData[id] = { ...updatedData[id], [field]: value };
            hasActualChanges = true;
          }
        });
        
        if (hasActualChanges) {
          actualChangesCount++;
        }
      } else {
        console.warn(`Item with ID ${id} not found in current data`);
      }
    });
    
    if (actualChangesCount === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No actual changes detected' 
      });
    }
    
    console.log(`Applying ${actualChangesCount} actual changes...`);
    
    // Get the main branch reference
    const { data: refData } = await octokit.rest.git.getRef({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      ref: 'heads/main',
    });
    
    const mainSha = refData.object.sha;
    
    // Create a new branch
    const newBranchName = branchName.trim();
    console.log(`Creating branch: ${newBranchName}`);
    
    await octokit.rest.git.createRef({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      ref: 'refs/heads/' + newBranchName,
      sha: mainSha,
    });
    
    // Get the current file
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      path: 'augmented.json',
      ref: `heads/main`,
    });
    
    // Generate a list of modified items for the PR description
    let modifiedItemsList = '### Modified Items:\n\n';
    Object.entries(changes).forEach(([id, item]) => {
      const currentItem = currentData[id] || {};
      const title = item.real_title || currentItem.real_title || currentItem.title || 'No Title';
      
      // Determine which fields were modified
      const modifiedFields = [];
      if (item.real_title && item.real_title !== currentItem.real_title) modifiedFields.push('Title');
      if (item.real_author && item.real_author !== currentItem.real_author) modifiedFields.push('Author');
      if (item.real_genre && item.real_genre !== currentItem.real_genre) modifiedFields.push('Genre');
      if (item.real_synopsis && item.real_synopsis !== currentItem.real_synopsis) modifiedFields.push('Synopsis');
      if (item.summary && item.summary !== currentItem.summary) modifiedFields.push('Summary');
      if (item.processed !== undefined && item.processed !== currentItem.processed) modifiedFields.push('Processed status');
      if (item.content_type && item.content_type !== currentItem.content_type) modifiedFields.push('Content type');
      if (item.real_language && item.real_language !== currentItem.real_language) modifiedFields.push('Language');
      if (item.real_published_year && item.real_published_year !== currentItem.real_published_year) modifiedFields.push('Published year');
      if (item.real_narrator && item.real_narrator !== currentItem.real_narrator) modifiedFields.push('Narrator');
      if (item.audio_file && item.audio_file !== currentItem.audio_file) modifiedFields.push('Audio file');
      
      const fieldsText = modifiedFields.length > 0 
        ? `- ${modifiedFields.join(', ')} updated` 
        : '- Modified';
        
      modifiedItemsList += `- **${title}** ${fieldsText}\n`;
    });
    
    // Combine the user's description with the list of modified items
    const fullDescription = prDescription && prDescription.trim()
      ? prDescription.trim() + '\n\n' + modifiedItemsList
      : 'This PR updates the audiolibri data with new changes.\n\n' + modifiedItemsList;
    
    console.log('Updating file in new branch...');
    
    // Update the file in the new branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      path: 'augmented.json',
      message: commitMessage.trim(),
      content: Buffer.from(JSON.stringify(updatedData, null, 2)).toString('base64'),
      branch: newBranchName,
      sha: fileData.sha,
    });
    
    console.log('Creating pull request...');
    
    // Create a pull request
    const { data: prData } = await octokit.rest.pulls.create({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      title: prTitle.trim(),
      body: fullDescription,
      head: newBranchName,
      base: 'main',
    });
    
    console.log(`Pull request created successfully: ${prData.html_url}`);
    
    res.json({
      success: true,
      message: 'Pull request created successfully',
      prUrl: prData.html_url,
      prNumber: prData.number,
      changesCount: actualChangesCount
    });
    
  } catch (error) {
    console.error('Error submitting changes:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit changes';
    if (error.message.includes('404')) {
      errorMessage = 'Repository not found or access denied';
    } else if (error.message.includes('401')) {
      errorMessage = 'GitHub authentication failed';
    } else if (error.message.includes('422')) {
      errorMessage = 'Branch already exists or validation error';
    } else if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// YouTube import endpoints
app.post('/api/import/video', rateLimiters.import, async (req, res) => {
  try {
    const { url, contentType, language, genre, processed } = req.body;
    
    if (!ytDlpWrap) {
      return res.status(500).json({ 
        success: false, 
        error: 'yt-dlp not available. Please install yt-dlp to use import features.' 
      });
    }
    
    if (!url || !contentType || !language) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL, content type, and language are required' 
      });
    }
    
    // Extract video metadata using yt-dlp
    const videoInfo = await ytDlpWrap.execPromise([
      url,
      '--dump-json',
      '--no-download',
      '--no-warnings',
      '--ignore-errors'
    ]).then(stdout => {
      try {
        return JSON.parse(stdout);
      } catch (error) {
        throw new Error('Failed to parse video information');
      }
    });
    
    if (!videoInfo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not extract video information' 
      });
    }
    
    // Generate unique ID
    const newId = uuidv4();
    
    // Create new item structure
    const newItem = {
      title: videoInfo.title || 'Unknown Title',
      real_title: videoInfo.title || 'Unknown Title',
      real_author: videoInfo.uploader || videoInfo.channel || 'Unknown Author',
      real_genre: genre || (contentType === 'podcast' ? 'Podcast' : 'Audiolibro'),
      content_type: contentType,
      real_language: language,
      real_synopsis: videoInfo.description ? 
        videoInfo.description.substring(0, 500) : 
        'Importato da YouTube',
      real_duration: videoInfo.duration ? Math.round(videoInfo.duration / 60) : null,
      real_published_year: videoInfo.upload_date ? 
        new Date(videoInfo.upload_date).getFullYear() : 
        new Date().getFullYear(),
      youtube_url: url,
      youtube_id: videoInfo.id,
      thumbnail: videoInfo.thumbnail,
      processed: processed || false,
      imported_at: new Date().toISOString(),
      view_count: videoInfo.view_count,
      like_count: videoInfo.like_count
    };
    
    res.json({
      success: true,
      item: newItem,
      id: newId,
      message: 'Video imported successfully'
    });
    
  } catch (error) {
    console.error('Error importing video:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to import video' 
    });
  }
});

app.post('/api/import/playlist', rateLimiters.import, async (req, res) => {
  try {
    const { url, contentType, language, genre, processed, createSeries } = req.body;
    
    if (!ytDlpWrap) {
      return res.status(500).json({ 
        success: false, 
        error: 'yt-dlp not available. Please install yt-dlp to use import features.' 
      });
    }
    
    if (!url || !contentType || !language) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL, content type, and language are required' 
      });
    }
    
    // Extract playlist metadata using yt-dlp
    const playlistInfo = await ytDlpWrap.execPromise([
      url,
      '--dump-json',
      '--no-download',
      '--no-warnings',
      '--ignore-errors',
      '--flat-playlist'
    ]).then(stdout => {
      try {
        // Parse multiple JSON objects (one per line for playlist)
        const lines = stdout.trim().split('\n');
        if (lines.length === 1) {
          // Single video or playlist metadata
          const data = JSON.parse(lines[0]);
          return data;
        } else {
          // Multiple videos - create a playlist structure
          const entries = lines.map(line => JSON.parse(line));
          return {
            title: `Playlist - ${entries.length} videos`,
            entries: entries
          };
        }
      } catch (error) {
        throw new Error('Failed to parse playlist information');
      }
    });
    
    if (!playlistInfo || !playlistInfo.entries) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not extract playlist information or playlist is empty' 
      });
    }
    
    const items = [];
    const ids = [];
    const seriesId = createSeries ? uuidv4() : null;
    const playlistTitle = playlistInfo.title || 'Unknown Playlist';
    
    // Process each video in the playlist
    for (let i = 0; i < playlistInfo.entries.length; i++) {
      const video = playlistInfo.entries[i];
      const newId = uuidv4();
      
      // Determine title based on series creation preference
      let title = video.title || `${playlistTitle} - Part ${i + 1}`;
      let author = video.uploader || video.channel || playlistInfo.uploader || 'Unknown Author';
      
      // If creating a series, add part number and series reference
      if (createSeries && contentType === 'series') {
        title = `${playlistTitle} - Parte ${i + 1}`;
        if (video.title) {
          title += `: ${video.title}`;
        }
      }
      
      const newItem = {
        title: title,
        real_title: title,
        real_author: author,
        real_genre: genre || (contentType === 'podcast' ? 'Podcast' : 'Audiolibro'),
        content_type: contentType,
        real_language: language,
        real_synopsis: video.description ? 
          video.description.substring(0, 500) : 
          `Parte ${i + 1} di ${playlistTitle}`,
        real_duration: video.duration ? Math.round(video.duration / 60) : null,
        real_published_year: video.upload_date ? 
          new Date(video.upload_date).getFullYear() : 
          new Date().getFullYear(),
        youtube_url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`,
        youtube_id: video.id,
        thumbnail: video.thumbnail,
        processed: processed || false,
        imported_at: new Date().toISOString(),
        view_count: video.view_count,
        like_count: video.like_count,
        playlist_id: playlistInfo.id,
        playlist_title: playlistTitle,
        part_number: i + 1,
        total_parts: playlistInfo.entries.length
      };
      
      // Add series information if creating a series
      if (createSeries && seriesId) {
        newItem.series_id = seriesId;
        newItem.series_title = playlistTitle;
      }
      
      items.push(newItem);
      ids.push(newId);
    }
    
    res.json({
      success: true,
      items: items,
      ids: ids,
      message: `Imported ${items.length} videos from playlist`,
      playlist_title: playlistTitle,
      series_id: seriesId
    });
    
  } catch (error) {
    console.error('Error importing playlist:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to import playlist' 
    });
  }
});

// JSON Editor API endpoints

// Auto-save endpoint for JSON editor
app.post('/api/data/auto-save', async (req, res) => {
  try {
    // For auto-save, we just acknowledge the request
    // The actual saving will happen when the user explicitly saves
    res.json({ success: true, message: 'Auto-save acknowledged' });
  } catch (error) {
    console.error('Auto-save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save changes from JSON editor
app.post('/api/data/save', async (req, res) => {
  try {
    const changes = req.body;
    
    if (!changes || Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, error: 'No changes provided' });
    }

    // Fetch current data
    const response = await axios.get('https://raw.githubusercontent.com/fabriziosalmi/audiolibri/refs/heads/main/augmented.json');
    const currentData = response.data;

    // Apply changes
    Object.entries(changes).forEach(([itemId, fieldChanges]) => {
      if (currentData[itemId]) {
        Object.entries(fieldChanges).forEach(([field, newValue]) => {
          currentData[itemId][field] = newValue;
        });
      }
    });

    // Create branch name
    const branchName = `json-editor-update-${Date.now()}`;
    
    // Get the main branch
    const { data: mainBranch } = await octokit.rest.repos.getBranch({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      branch: 'main'
    });

    // Create new branch
    await octokit.rest.git.createRef({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha
    });

    // Update file content
    const updatedContent = JSON.stringify(currentData, null, 2);
    const encodedContent = Buffer.from(updatedContent).toString('base64');

    // Get current file to get its SHA
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      path: 'augmented.json',
      ref: branchName
    });

    // Update the file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      path: 'augmented.json',
      message: `Update audiolibri data via JSON Editor (${Object.keys(changes).length} items modified)`,
      content: encodedContent,
      sha: currentFile.sha,
      branch: branchName
    });

    // Create pull request
    const changesList = Object.entries(changes).map(([itemId, fieldChanges]) => {
      const item = currentData[itemId];
      const title = item?.real_title || item?.title || `Item ${itemId}`;
      const fields = Object.keys(fieldChanges).join(', ');
      return `- **${title}** (${fields})`;
    }).join('\n');

    const prDescription = `Questa PR aggiorna i dati degli audiolibri tramite l'Editor JSON completo.

**Modifiche effettuate:**
${changesList}

**Statistiche:**
- ${Object.keys(changes).length} elementi modificati
- ${Object.values(changes).reduce((total, fieldChanges) => total + Object.keys(fieldChanges).length, 0)} campi totali modificati
- Modifiche effettuate tramite Editor JSON Completo

Revisiona attentamente le modifiche prima del merge.`;

    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: process.env.REPO_OWNER,
      repo: process.env.REPO_NAME,
      title: `Aggiorna dati audiolibri via Editor JSON (${Object.keys(changes).length} elementi)`,
      head: branchName,
      base: 'main',
      body: prDescription
    });

    // Generate data hash for client monitoring
    const jsonString = JSON.stringify(currentData);
    let hash = 0;
    for (let i = 0; i < Math.min(jsonString.length, 1000); i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const dataHash = Math.abs(hash) + '_' + jsonString.length + '_' + Date.now();

    res.json({
      success: true,
      message: 'Changes saved and PR created successfully',
      prUrl: pullRequest.html_url,
      prNumber: pullRequest.number,
      changesCount: Object.keys(changes).length,
      dataHash: dataHash
    });

  } catch (error) {
    console.error('Error saving JSON editor changes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to save changes'
    });
  }
});

// Add error handling middleware at the end
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
});