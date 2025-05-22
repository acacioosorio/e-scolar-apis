// School Router
// ./api/schools/index.js

'use strict';

const express = require('express');
const controller = require('./school.controller');
const router = express.Router();
const passport = require('passport')
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth')
const multer = require('multer');

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith('image/')) {
			cb(null, true);
		} else {
			cb(new Error('Not an image! Please upload only images.'), false);
		}
	}
});

// Statistics routes
router.get('/stats/global', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.getGlobalSchoolStats);
router.get('/stats', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin', 'staff', 'concierge'), controller.getSchoolStats);

// router.get('/', controller.index);
// router.post('/create', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), authorizeSubRoles('staff'), upload.array('files'), controller.create);
// router.post('/add-user', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice'), authorizeSubRoles('staff'), upload.array('files'), controller.addUser);
// router.post('/add-user-dev', upload.array('files'), controller.addUser);

// router.get('/list', passport.authenticate(['jwt-user', 'jwt-employee'], { session: false }), authorizeRoles('backoffice'), authorizeSubRoles('staff'), controller.listSchools);
router.get('/employees', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin', 'staff'), controller.listEmployees);
router.post('/employees', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin'), controller.addEmployee);
router.patch('/employees/:id/status', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin'), controller.updateEmployeeStatus);
router.put('/employees/:id', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin'), controller.updateEmployee);
// /api/schools/employees/68226c0b273f93294abfa02f
router.post('/employees/:id/resend-activation', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin', 'staff'), controller.resendUserActivation);
router.delete('/employees/:id', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin'), controller.deleteEmployee);

// router.get('/employees-test', controller.listEmployees);

module.exports = router;