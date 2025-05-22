// Lesson Model
// ./api/lessons/lesson.model.js

const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// Sub-schema para tópicos de aula
const LessonTopicSchema = new Schema({
	name: { type: String, required: true },
	objective: { type: String },
	description: { type: String }
}, { timestamps: true });

// Schema principal de Aula
const LessonSchema = new Schema({
	date: { type: Date, required: true },
	class: { type: Schema.Types.ObjectId, ref: 'Classes', required: true },
	section: { type: Schema.Types.ObjectId, ref: 'Sections' },
	subject: { type: Schema.Types.ObjectId, ref: 'Subjects', required: true },
	teacher: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
	topic: { type: String, required: true },
	content: { type: String },
	resources: [String],
	topics: [LessonTopicSchema],
	createdBy: { type: Schema.Types.ObjectId, ref: 'Users' }
}, { timestamps: true });

module.exports = {
	Lesson: model('Lesson', LessonSchema),
	LessonTopic: model('LessonTopic', LessonTopicSchema)
};