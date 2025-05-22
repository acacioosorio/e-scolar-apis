// Subjects Router
// ./api/subjects/index.js

'use strict';

const express = require('express');
const controller = require('./subjects.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Subjects = require('./subjects.model');

// Subjects management routes
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listSubjects
);

router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getSubject
);

router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditCreate('Subjects', Subjects),
	controller.createSubject
);

router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Subjects', Subjects),
	controller.updateSubject
);

router.delete('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	auditDelete('Subjects', Subjects),
	controller.deleteSubject
);

// Rotas para funcionalidades específicas
router.get('/:subjectId/prerequisites/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.checkPrerequisites
);

router.get('/:subjectId/approval/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.checkApproval
);

router.get('/type/:type/year-level/:yearLevelId/academic-year/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.findByTypeAndLevel
);

router.get('/:subjectId/approval-stats',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getApprovalStats
);

module.exports = router;
