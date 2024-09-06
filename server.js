const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Read the configuration file
let config;
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  console.log('Loaded configuration:', config);
} catch (error) {
  console.error('Error loading configuration:', error);
  process.exit(1);
}

// Route to display the current configuration (for development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json(config);
  });
}

// Create a proxy for each target in the configuration
config.targets.forEach(target => {
  console.log(`Setting up proxy for ${target.path} to ${target.url}`);
  app.use(`/${target.path}`, createProxyMiddleware({
    target: target.url,
    changeOrigin: true,
    headers: target.headers || {}, // Check if headers exist
    pathRewrite: (path, req) => {
      const newPath = path.replace(new RegExp(`^${target.path}`), '/');
      console.log(`Rewriting path: ${path} -> ${newPath}`);
      return newPath;
    },
    onProxyReq: (proxyReq, req, res) => {
      // Remove the x-forwarded-for header to prevent passing the original client IP
      proxyReq.removeHeader('x-forwarded-for');
      
      // Remove other headers that might reveal the original IP
      proxyReq.removeHeader('x-real-ip');
      proxyReq.removeHeader('forwarded');
      req.removeHeader('x-forwarded-for');
      req.removeHeader('x-real-ip');
      req.removeHeader('forwarded');
      
      console.log(`Proxying request to: ${target.url}${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${req.url}:`, err);
      res.status(500).json({ error: 'Proxy error', message: err.message });
    }
  }));
});

// Catch-all route for unhandled requests
app.use((req, res) => {
  console.log(`Unhandled request: ${req.method} ${req.url}`);
  res.status(404).json({ message: `The path ${req.url} is not proxied or handled.` });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Reverse proxy server running on port ${PORT}`);
});