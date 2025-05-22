// Notification Routes
// /api/notifications/index.js

'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./notification.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Notification = require('./notification.model');

// Obter notificações do usuário atual
router.get('/my', 
    passport.authenticate('jwt-user', { session: false }), 
    controller.getMyNotifications
);

// Obter contagem de notificações não lidas
router.get('/unread-count', 
    passport.authenticate('jwt-user', { session: false }), 
    controller.getUnreadCount
);

// Marcar todas as notificações como lidas
router.put('/mark-all-read', 
    passport.authenticate('jwt-user', { session: false }), 
    controller.markAllAsRead
);

// Marcar uma notificação específica como lida
router.put('/:id/read', 
    passport.authenticate('jwt-user', { session: false }), 
    controller.markAsRead
);

// Arquivar uma notificação
router.put('/:id/archive', 
    passport.authenticate('jwt-user', { session: false }), 
    controller.archiveNotification
);

// Criar uma nova notificação (apenas admin e sistema)
router.post('/', 
    passport.authenticate('jwt-user', { session: false }),
    auditCreate('Notification', Notification),
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin'), 
    controller.createNotification
);

// Gerar notificações para alunos em risco (apenas admin)
router.post('/generate-risk/:academicYearId', 
    passport.authenticate('jwt-user', { session: false }),
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin'), 
    controller.generateRiskNotifications
);

module.exports = router;