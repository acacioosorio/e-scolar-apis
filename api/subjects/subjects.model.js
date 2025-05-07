const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const SubjectSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
		},
		educationalSegment: {
			type: Schema.Types.ObjectId,
			ref: "EducationalSegment",
		},
		classes: [
			{
				type: Schema.Types.ObjectId,
				ref: "Classes",
				required: true,
			},
		],
		employees: [
			{
				type: Schema.Types.ObjectId,
				ref: "Users",
				required: true,
			},
		],
		name: {
			type: String,
			required: [true, "Please add a Subject name"],
		},
		description: String,
	},
	{ timestamps: true }
);

module.exports = mongoose.models.Subjects || mongoose.model('Subjects', SubjectSchema);