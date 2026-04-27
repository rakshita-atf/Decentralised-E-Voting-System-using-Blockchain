const next = require('next');
const express = require('express');
const voter = require('./routes/voter');
const company = require('./routes/company');
const candidate = require('./routes/candidate');
const bodyParser = require('body-parser');
const mongoose = require('./config/database');
const exp = express();
const path = require('path');

require('dotenv').config({ path: __dirname + '/.env' });

mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));
mongoose.connection.on('connected', function () {
	console.log('MongoDB connected successfully');
});

exp.use(
	bodyParser.urlencoded({
		extended: true,
	})
);
exp.use(bodyParser.json());

// Health check endpoint
exp.get('/health', function (req, res) {
	res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// API routes - must come BEFORE Next.js handler
exp.use('/company', company);
exp.use('/voter', voter);
exp.use('/candidate', candidate);

// Error handling middleware for API
exp.use((err, req, res, next) => {
	console.error('Express error:', err);
	res.status(500).json({ error: err.message });
});

// Initialize Next.js for frontend
console.log('[' + new Date().toISOString() + '] Initializing Next.js frontend...');
const app = next({
	dev: process.env.NODE_ENV !== 'production',
});

const routes = require('./routes');
const handler = routes.getRequestHandler(app);

// Prepare Next.js app with timeout
const nextPrepareTimeout = setTimeout(() => {
	console.log('[' + new Date().toISOString() + '] Next.js preparation timeout, starting server without frontend...');
	startServer();
}, 15000);

app.prepare()
	.then(() => {
		clearTimeout(nextPrepareTimeout);
		console.log('[' + new Date().toISOString() + '] Next.js frontend prepared successfully');
		
		// Add redirect from root to homepage
		exp.get('/', (req, res) => res.redirect('/homepage'));
		
		// Add Next.js handler after API routes
		exp.use(handler);
		startServer();
	})
	.catch((err) => {
		clearTimeout(nextPrepareTimeout);
		console.error('[' + new Date().toISOString() + '] Error preparing Next.js:', err.message);
		startServer();
	});

function startServer() {
	// Start server
	const server = exp.listen(3000, '127.0.0.1', function () {
		console.log('[' + new Date().toISOString() + '] Node server listening on port 3000');
		console.log('[' + new Date().toISOString() + '] Access the app at http://localhost:3000');
	});

	server.on('error', (err) => {
		console.error('Server error:', err);
		process.exit(1);
	});
}

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
	console.error('Uncaught Exception:', err);
});
