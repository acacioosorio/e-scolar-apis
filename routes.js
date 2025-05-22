module.exports = function (app) {
	app.use('/api/users', require('./api/users'));
	app.use('/api/backoffice', require('./api/backoffice'));

	app.use('/api/schools', require('./api/schools'));
	app.use('/api/students', require('./api/students'));
	app.use('/api/auth', require('./api/auth'));

	app.use('/api/classes', require('./api/classes'));
	app.use('/api/subjects', require('./api/subjects'));

	// Register the new pedagogy routes
    app.use("/api/pedagogy", require("./api/pedagogy"));

	app.use('/api/segments',       require('./api/pedagogy'));  // lista segments, add segment
	app.use('/api/academic-years', require('./api/pedagogy'));  // lista/year-crud
	app.use('/api/year-levels',    require('./api/pedagogy'));

	app.use("/api/rooms", require("./api/rooms"));
	app.use("/api/academic-years", require("./api/academic-years"));

	app.use('/api/lessons', require('./api/lessons'));

	app.use('/api/marks', require('./api/marks'));

	app.use('/api/enrollment', require('./api/enrollment'));

};

// Create an API and Store following FLUX Architecture pattern to make a GET request to "/api/schools/stats" 