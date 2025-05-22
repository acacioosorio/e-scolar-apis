// Lesson Controller
// ./api/lessons/lesson.controller.js

const { Lesson } = require('./lesson.model');

// cria nova aula
exports.createLesson = async (req, res, next) => {
	try {
		const payload = {
			...req.body,
			createdBy: req.user.id
		};
		const lesson = await Lesson.create(payload);
		res.status(201).json({ success: true, data: lesson });
	} catch (err) {
		next(err);
	}
};

// lista aulas com filtros opcionais
exports.listLessons = async (req, res, next) => {
	try {
		const { class: classId, from, to } = req.query;
		const filter = {};
		if (classId) filter.class = classId;
		if (from || to) {
			filter.date = {};
			if (from) filter.date.$gte = new Date(from);
			if (to) filter.date.$lte = new Date(to);
		}

		const lessons = await Lesson
			.find(filter)
			.populate('class section subject teacher topics')
			.sort({ date: -1 });

		res.json({ success: true, data: lessons });
	} catch (err) {
		next(err);
	}
};

// obtém uma aula pelo id
exports.getLesson = async (req, res, next) => {
	try {
		const lesson = await Lesson
			.findById(req.params.id)
			.populate('class section subject teacher topics');
		if (!lesson) return res.status(404).json({ success: false });
		res.json({ success: true, data: lesson });
	} catch (err) {
		next(err);
	}
};

// atualiza uma aula
exports.updateLesson = async (req, res, next) => {
	try {
		const lesson = await Lesson.findByIdAndUpdate(
			req.params.id,
			req.body,
			{ new: true }
		);
		if (!lesson) return res.status(404).json({ success: false });
		res.json({ success: true, data: lesson });
	} catch (err) {
		next(err);
	}
};

// remove uma aula
exports.deleteLesson = async (req, res, next) => {
	try {
		await Lesson.findByIdAndDelete(req.params.id);
		res.status(204).end();
	} catch (err) {
		next(err);
	}
};