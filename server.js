require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');
const session = require('express-session');

const http = require('http');
const socketio = require('socket.io');
const app = express();

const server = http.createServer(app);
const io = socketio(server);
const { logger } = require('./helpers/index');

// MongoDB Connection
require('./config/mongoose')(mongoose);

// Express body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure CORS (Can conflict with NGINX proxy)
app.use(cors());

// Middleware
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.use(passport.initialize());

// Passport Config
require('./auth/passport')(passport);

// Routes
require('./routes')(app);

// Socket.IO
io.on('connection', (socket) => {
	console.log('An user connected');

	socket.on('disconnect', () => {
		console.log('User disconnected');
	});
});

// Run application
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
