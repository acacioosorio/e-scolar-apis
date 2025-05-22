// Lessons Router
// ./api/lessons/index.js

const express = require('express');
const router  = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const lessonCtrl = require('./lesson.controller');
const topicCtrl  = require('./topic.controller');

// proteger todas as rotas de aulas
router.use(
  passport.authenticate('jwt-user', { session: false }),
  authorizeRoles('backoffice','school'),
  authorizeSubRoles('admin','staff')
);

// rotas de Lesson
router
  .route('/')
  .get(lessonCtrl.listLessons)
  .post(lessonCtrl.createLesson);

router
  .route('/:id')
  .get(lessonCtrl.getLesson)
  .put(lessonCtrl.updateLesson)
  .delete(lessonCtrl.deleteLesson);

// rotas de LessonTopic (sub-recurso)
router
  .route('/:lessonId/topics')
  .get(topicCtrl.listTopics)
  .post(topicCtrl.addTopic);

router
  .route('/:lessonId/topics/:topicId')
  .put(topicCtrl.updateTopic)
  .delete(topicCtrl.deleteTopic);

module.exports = router;