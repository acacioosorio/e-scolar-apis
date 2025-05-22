// Enrollment Model
// ./api/enrollment/enrollment.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

const EnrollmentSchema = new Schema({
	school: {
		type: Schema.Types.ObjectId,
		ref: "School",
		required: true,
	},
	student: {
		type: Schema.Types.ObjectId,
		ref: "Student",
		required: [true, "Please add a student"],
	},
	class: {
		type: Schema.Types.ObjectId,
		ref: "Classes",
		required: [true, "Please add a class"],
	},
	academicYear: {
		type: Schema.Types.ObjectId,
		ref: "AcademicYear",
		required: [true, "Please add a academic year"],
	},
	enrollmentDate: { type: Date, required: true },
	rollNumber: { type: String },
	status: {
		type: String,
		enum: ['studying', 'approved', 'failed', 'transferred', 'withdrawn'],
		default: 'studying',
	},
	finalGrade: { type: Number },
	documents: [
		{
			name: String,
			url: String,
		}
	],
	generalObservations: String,
}, { timestamps: true })

// Mantendo o índice que impede duplicação na mesma turma
EnrollmentSchema.index({ student: 1, class: 1 }, { unique: true });

// Adicionando índices para performance
EnrollmentSchema.index({ class: 1 });
EnrollmentSchema.index({ student: 1 });
EnrollmentSchema.index({ academicYear: 1 });
EnrollmentSchema.index({ school: 1 });

module.exports = mongoose.model("Enrollment", EnrollmentSchema);