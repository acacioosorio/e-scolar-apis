'use strict';

const express = require('express');
const controller = require('./subjects.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

// Subject management routes
router.get('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff', 'teacher'), 
    controller.listSubjects
);

router.post('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    controller.addSubject
);

router.put('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    controller.updateSubject
);

router.delete('/:id', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.deleteSubject
);

module.exports = router;
