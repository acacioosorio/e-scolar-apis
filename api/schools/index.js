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
// router.get('/employees', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.listEmployees);

/**
 * Segments, Year Levels and stuff
 */
// router.get('/educational-segment', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.listSegments);
// router.post('/educational-segment', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.createSegment);
// router.put('/educational-segment', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.updateSegment);
// router.delete('/educational-segment', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('backoffice', 'school'), authorizeSubRoles('staff'), controller.listEmployees);

// router.get('/employees-test', controller.listEmployees);

module.exports = router;