// Classes Model
// ./api/classes/classes.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

// Class = turma real, ex: "Class A – 1st Year HS 2025"
const ClassSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
		},
		educationalSegment: {
			type: Schema.Types.ObjectId,
			ref: "EducationalSegment",
			required: true,
		},
		yearLevel: {
			type: Schema.Types.ObjectId,
			ref: "YearLevel",
			required: true,
		},
		academicYear: {
			type: Schema.Types.ObjectId,
			ref: "AcademicYear",
			required: true,
		},
		// Ex: "A", "B", "Manhã", "Integral 1"
		name: {
			type: String,
			required: [true, "Please add a Class name"],
		},
		// If name wasnt enough, Ex: "morning", "afternoon"
		shift: {
			type: String,
			enum: ['morning', 'afternoon', 'evening', 'full_day'],
			required: true
		},
		room: {
			type: Schema.Types.ObjectId,
			ref: "Room",
		},
		// Principal teacher responsible for the class
		teacherResponsible: {
			type: Schema.Types.ObjectId,
			ref: "Users",
		},
		startDate: {
			type: Date,
			required: [true, "Please add a start date"],
		},
		endDate: {
			type: Date,
			required: [true, "Please add an end date"],
		},
		capacity: {
			type: Number,
			required: [true, "Please add a max capacity"],
		},
		// Not required, override for Year Level Grade
		subjects: [{
			type: Schema.Types.ObjectId,
			ref: 'Subject'
		}],
		status: {
			type: String,
			enum: ['active', 'disabled', 'archived'],
			default: 'active',
			required: true
		},
		description: {
			type: String,
		},
	},
	{ timestamps: true }
);

ClassSchema.index({ school: 1, educationalSegment: 1, yearLevel: 1, academicYear: 1, name: 1, shift: 1 }, { unique: true });

module.exports = mongoose.models.Classes || mongoose.model('Classes', ClassSchema);