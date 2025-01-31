module.exports = function (app) {
	app.use('/api/users', require('./api/users'));
	app.use('/api/backoffice', require('./api/backoffice'));

	app.use('/api/schools', require('./api/schools'));
	app.use('/api/students', require('./api/students'));
	app.use('/api/auth', require('./api/auth'));

	app.use('/api/classes', require('./api/classes'));
	app.use('/api/subjects', require('./api/subjects'));
};

// Create an API and Store following FLUX Architecture pattern to make a GET request to "/api/schools/stats" 