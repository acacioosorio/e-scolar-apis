// Rooms Router
// ./api/rooms/index.js

'use strict';

const express = require('express');
const router  = express.Router();
const controller    = require('./rooms.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Rooms = require('./rooms.model');

router.get('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.listRooms
);

router.post('/', passport.authenticate('jwt-user', { session: false }),
    auditCreate('Rooms', Rooms), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.createRoom
);

router.get('/:id', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.getRoom
);

router.put('/:id', passport.authenticate('jwt-user', { session: false }), 
    auditUpdate('Rooms', Rooms),
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.updateRoom
);

router.patch('/:id/status', passport.authenticate('jwt-user', { session: false }), 
    auditUpdate('Rooms', Rooms),
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin'), 
    controller.updateRoomStatus
);

router.delete('/:id', passport.authenticate('jwt-user', { session: false }),
    auditDelete('Rooms', Rooms),
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.deleteRoom
);

module.exports = router;
