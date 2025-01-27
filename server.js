require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = express()
const server = createServer(app)

const io = new Server(server, {
	serveClient: true,  // Enable serving the client file
	cors: {
		origin: '*'
	}
})

const { logger } = require('./helpers/index');
const { colorConsole } = require('tracer');

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
// Socket.IO authentication middleware
io.use((socket, next) => {
	const token = socket.handshake.auth.token.replace("Bearer ", "");
	if (!token) return next(new Error('Token não fornecido!'));

	jwt.verify(token, process.env.JWT_SECRET || 'minha_chave_secreta', (err, decoded) => {
		if (err) {
			console.log(err);
			next(new Error('Token inválido!'));
		}
		socket.user = decoded;
		next();
	});
});

const activeConnections = new Map();

io.on('connection', (socket) => {
	const userId = socket.user.id;
	const schoolId = socket.user.school;

	if (schoolId) {
		socket.join(`school:${schoolId}`);

		console.log(`socket.join('school:${schoolId}');`)
		console.log("====================================================")
		// Store connection info
		if (!activeConnections.has(schoolId)) {
			activeConnections.set(schoolId, new Set());
		}
		activeConnections.get(schoolId).add(userId);

		// Notify school room about new connection
		io.to(`school:${schoolId}`).emit('user:connected', {
			userId,
			activeUsers: Array.from(activeConnections.get(schoolId))
		});
	}

	socket.on('disconnect', () => {
		if (schoolId) {
			const schoolConnections = activeConnections.get(schoolId);
			if (schoolConnections) {
				schoolConnections.delete(userId);
				if (schoolConnections.size === 0) {
					activeConnections.delete(schoolId);
				}
			}

			// Notify school room about disconnection
			io.to(`school:${schoolId}`).emit('user:disconnected', {
				userId,
				activeUsers: Array.from(activeConnections.get(schoolId) || [])
			});
		}
	});
});

// Run application
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
