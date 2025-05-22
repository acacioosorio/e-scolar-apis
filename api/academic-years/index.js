// Academic Years Router
// ./api/academic-years/index.js

const express = require('express');
const router = express.Router();
const passport = require('passport');
const controller = require('./academicYears.controller');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

// GET  /academic-years
router.get(
	'/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listAcademicYears
);

// GET  /academic-years/:id
router.get(
	'/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.getAcademicYear
);

// POST /academic-years
router.post(
	'/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.addAcademicYear
);

// PUT  /academic-years/:id
router.put(
	'/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.updateAcademicYear
);

// DELETE /academic-years/:id
router.delete(
	'/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.deleteAcademicYear
);

module.exports = router;