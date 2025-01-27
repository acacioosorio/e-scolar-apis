const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const ClassSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: true,
		},
		name: {
			type: String,
			required: [true, "Please add a Class name"],
		},
		startDate: {
			type: Date,
			required: [true, "Please add a start date"],
		},
		endDate: {
			type: Date,
			required: [true, "Please add an end date"],
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.models.Classes || mongoose.model('Classes', ClassSchema);