// Security middleware for the server
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
    res.status(429).json({ error: message });
  }
});

// Different rate limits for different endpoints
const rateLimiters = {
  general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests, please try again later'),
  api: createRateLimiter(15 * 60 * 1000, 50, 'Too many API requests, please try again later'),
  github: createRateLimiter(60 * 60 * 1000, 10, 'Too many GitHub operations, please try again later'),
  import: createRateLimiter(60 * 60 * 1000, 5, 'Too many import requests, please try again later')
};

// Security headers configuration
const isDevelopment = process.env.NODE_ENV === 'development';

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for dynamic UI elements
      "style-src-attr": ["'unsafe-inline'"], // Allow inline style attributes
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Allow inline scripts for editing functionality
        "https://static.cloudflareinsights.com", // Allow Cloudflare analytics
        "https://www.googletagmanager.com" // Common analytics
      ],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'", 
        "https://api.github.com", 
        "https://raw.githubusercontent.com",
        "https://cloudflareinsights.com", // Allow Cloudflare analytics connections
        "https://www.google-analytics.com" // Common analytics
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding of external resources
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In production, restrict to specific domains
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://edit.audiolibri.org'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Create CORS middleware
const corsMiddleware = cors(corsOptions);

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`${new Date().toISOString()} - ${ip} - ${method} ${url} - ${statusCode} - ${duration}ms`);
    
    // Log errors separately
    if (statusCode >= 400) {
      console.warn(`Error response: ${method} ${url} - ${statusCode}`);
    }
  });
  
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Basic XSS prevention
          sanitized[key] = obj[key]
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .trim();
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    
    return sanitized;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: isDevelopment ? err.message : 'Invalid input data'
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      details: 'The uploaded file exceeds the maximum size limit'
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    details: isDevelopment ? err.message : 'Something went wrong'
  });
};

module.exports = {
  rateLimiters,
  securityHeaders,
  corsOptions: corsMiddleware,
  requestLogger,
  sanitizeInput,
  errorHandler
};
