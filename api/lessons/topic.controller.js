// Topic Controller
// ./api/lessons/topic.controller.js

const { Lesson } = require('./lesson.model');
// const Topic = require('./topic.model');

// adiciona um tópico à aula
exports.addTopic = async (req, res, next) => {
	try {
		const lesson = await Lesson.findById(req.params.lessonId);
		if (!lesson) return res.status(404).json({ success: false });

		lesson.topics.push(req.body);
		await lesson.save();

		res.status(201).json({ success: true, data: lesson.topics });
	} catch (err) {
		next(err);
	}
};

// lista tópicos de uma aula
exports.listTopics = async (req, res, next) => {
	try {
		const lesson = await Lesson.findById(req.params.lessonId, 'topics');
		if (!lesson) return res.status(404).json({ success: false });
		res.json({ success: true, data: lesson.topics });
	} catch (err) {
		next(err);
	}
};

// atualiza tópico específico
exports.updateTopic = async (req, res, next) => {
	try {
		const { lessonId, topicId } = req.params;
		const lesson = await Lesson.findById(lessonId);
		if (!lesson) return res.status(404).json({ success: false });

		const topic = lesson.topics.id(topicId);
		if (!topic) return res.status(404).json({ success: false });

		Object.assign(topic, req.body);
		await lesson.save();

		res.json({ success: true, data: topic });
	} catch (err) {
		next(err);
	}
};

// remove um tópico
exports.deleteTopic = async (req, res, next) => {
	try {
		const { lessonId, topicId } = req.params;
		const lesson = await Lesson.findById(lessonId);
		if (!lesson) return res.status(404).json({ success: false });

		lesson.topics.id(topicId).remove();
		await lesson.save();

		res.status(204).end();
	} catch (err) {
		next(err);
	}
};