// Enrollment Router
// ./api/enrollment/index.js

'use strict';

const express = require('express');
const controller = require('./enrollment.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Enrollment = require('./enrollment.model');

// Enrollment management routes
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listEnrollments
);

router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEnrollment
);

router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditCreate('Enrollment', Enrollment),
	controller.createEnrollment
);

router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.updateEnrollment
);

router.patch('/:id/status',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.updateEnrollmentStatus
);

router.delete('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	auditDelete('Enrollment', Enrollment),
	controller.deleteEnrollment
);

// Additional enrollment routes
router.get('/student/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getStudentEnrollments
);

router.get('/class/:classId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getClassEnrollments
);

router.get('/:id/subjects',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEnrollmentSubjects
);

router.post('/bulk-status-update',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.bulkUpdateStatus
);

module.exports = router;