// Classes Router
// ./api/classes/index.js

'use strict';

const express = require('express');
const controller = require('./classes.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Classes = require('./classes.model');

// Class management routes
router.get('/', passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listClasses
);

// Added GET /:id to fetch a single Class by its ID
router.get(
	'/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getClass
);

router.post('/', passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.addClass
);

router.put('/:id', passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.updateClass
);

router.patch('/:id/status', passport.authenticate('jwt-user', { session: false }), auditUpdate('Classes', Classes), authorizeRoles('backoffice', 'school'), authorizeSubRoles('admin'), controller.updateClassStatus);

router.delete('/:id', passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.deleteClass
);

module.exports = router;
