const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const MarksSchema = new Schema({
	student: {
		type: Schema.Types.ObjectId,
		ref: 'Student',
		required: true
	},
	school: {
		type: Schema.Types.ObjectId,
		ref: 'School',
		required: true
	},
	class: {
		type: Schema.Types.ObjectId,
		ref: 'Classes',
		required: true
	},
	subject: {
		type: Schema.Types.ObjectId,
		ref: 'Subject',
		required: true
	},
	// Se a nota for proveniente de um exame específico
	exam: {
		type: Schema.Types.ObjectId,
		ref: 'Exams',
		default: null // Deixe null se for uma "nota geral" e não de um exame
	},
	grade: {
		type: Number,
		required: true
	},
	date: {
		type: Date,
		default: Date.now
	}
}, { timestamps: true });

module.exports = mongoose.models.Marks || mongoose.model('Marks', MarkSchema);