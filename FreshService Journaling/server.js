import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint for Anthropic API
app.post('/api/analyze', async (req, res) => {
  console.log('Received analyze request');
  console.log('Request body keys:', Object.keys(req.body || {}));
  try {
    const { apiKey, prompt } = req.body;

    if (!apiKey) {
      console.error('Missing API key');
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!prompt) {
      console.error('Missing prompt');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Making request to Anthropic API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      
      const errorMessage = errorData.error?.message || errorData.error?.type || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Anthropic API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        modelUsed: 'claude-haiku-4-5'
      });
      
      // If model not found, suggest alternatives
      if (response.status === 404 && errorMessage.includes('model')) {
        console.error('Model not found. Try one of these:');
        console.error('  - claude-haiku-4-5 (current - latest)');
        console.error('  - claude-3-5-haiku-20241022');
        console.error('  - claude-3-haiku-20240307');
      }
      
      return res.status(response.status).json({
        error: errorMessage,
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Catch-all for undefined routes
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Route not found', 
    method: req.method, 
    path: req.path,
    availableRoutes: ['GET /health', 'POST /api/analyze']
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /health - Health check`);
  console.log(`  POST /api/analyze - Analyze ticket notes`);
  console.log(`Make sure to run this alongside your Vite dev server`);
});

