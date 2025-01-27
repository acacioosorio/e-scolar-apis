const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const ExamSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
		},
		class: {
			type: Schema.Types.ObjectId,
			ref: "Classes",
			required: true,
		},
		subject: {
			type: Schema.Types.ObjectId,
			ref: "Subjects",
			required: true,
		},
		name: {
			type: String,
			required: [true, "Please add an Exam name"],
		},
		date: {
			type: Date,
			default: Date.now,
		},
		maxGrade: {
			type: Number,
			default: 10,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.models.Exams || mongoose.model('Exams', ExamSchema);