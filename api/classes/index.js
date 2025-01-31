'use strict';

const express = require('express');
const controller = require('./classes.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

// Class management routes
router.get('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff', 'teacher'), 
    controller.listClasses
);

router.post('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    controller.addClass
);

router.put('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    controller.updateClass
);

router.delete('/:id', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.deleteClass
);

module.exports = router;
