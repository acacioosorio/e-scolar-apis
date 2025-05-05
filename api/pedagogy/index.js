'use strict';

const express = require('express');
const controller = require('./pedagogy.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

// --- Educational Segment Routes ---

// List all segments for the school
router.get('/segments',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Adjust roles as needed
	controller.listSegments
);

// Add a new segment
router.post('/segments',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can create segments
	controller.addSegment
);

// Update a segment
router.put('/segments',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can update segments
	controller.updateSegment
);

// Delete a segment
router.delete('/segments/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can delete segments
	controller.deleteSegment
);

// --- Year Level Routes ---

// List all year levels (optionally filtered by segment)
router.get('/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Adjust roles as needed
	controller.listYearLevels
);

// Add a new year level
router.post('/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can create year levels
	controller.addYearLevel
);

// Update a year level
router.put('/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can update year levels
	controller.updateYearLevel
);

// Delete a year level
router.delete('/year-levels/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can delete year levels
	controller.deleteYearLevel
);

module.exports = router;