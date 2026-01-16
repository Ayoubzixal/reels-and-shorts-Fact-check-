const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const videoRoutes = require('./dist/routes/video').default;

// Routes
app.use('/api/video', videoRoutes);

// Languages endpoint
app.get('/api/languages', (req, res) => {
    const languages = [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'it', name: 'Italian', nativeName: 'Italiano' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский' },
        { code: 'zh', name: 'Chinese', nativeName: '中文' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    ];
    res.json(languages);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
