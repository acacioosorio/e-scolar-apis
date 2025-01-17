'use strict';

const express = require('express');
const controller = require('./backoffice.controller');
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

router.get('/', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.index);
router.get('/school', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.schoolsList);
router.get('/school/:id', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.schoolByID);
router.post('/school', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'facade', maxCount: 1 }]), controller.createSchool);
router.patch('/school/:id/status', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.changeSchoolStatus);
router.put('/school/:id', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'facade', maxCount: 1 }]), controller.updateSchool);
router.post('/school/:id/users', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.addUserToSchool);
router.put('/school/:id/users', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.updateUser);
router.delete('/school/:id/users', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.deleteUserFromSchool);
router.post('/school/:id/users/resend-activation', passport.authenticate('jwt-user', { session: false }), authorizeRoles('backoffice'), controller.resendUserActivation);

// Authentication example using passport-jwt and sub roles middlewares
// router.get('/sub', passport.authenticate('jwt-user', { session: false }), authorizeRoles('school'), authorizeSubRoles('staff'), controller.subRole);

module.exports = router;