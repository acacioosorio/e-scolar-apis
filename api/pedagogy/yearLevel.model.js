// Year Level Model
// ./api/pedagogy/yearLevel.model.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * YearLevel Schema
 * Represents a specific grade or year level (e.g., 1º Ano, 2ª Série).
 */
const YearLevelSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
			index: true,
		},
		// Ex: "Maternal II", "1º Ano", "9º Ano", "3ª Série EM"
		name: {
			type: String,
			required: [true, "Year level name is required"],
			trim: true,
		},
		// Short code or abbreviation (e.g., 1A, 2S, 9F)
		acronym: {
			type: String,
			required: [true, "Acronym is required"],
			trim: true,
			uppercase: true,
			maxLength: 5,
		},
		// General order for display purposes
		order: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ['active', 'disabled', 'archived'],
			default: 'active',
			required: true
		},
		subjects: [
			{
				type: Schema.Types.ObjectId,
				ref: "Subjects",
			},
		],
		educationalSegment: {
			type: Schema.Types.ObjectId,
			ref: "EducationalSegment",
			required: [true, "Educational segment is required"],
		},
		// Pré-requisito específico (se houver)
		prerequisiteYearLevel: {
			type: Schema.Types.ObjectId,
			ref: "YearLevel",
			default: null
		}
	},
	{ timestamps: true }
);

// Ensure unique combination of school and name
YearLevelSchema.index({ school: 1, name: 1, educationalSegment: 1, acronym: 1 }, { unique: true });
// Ensure unique combination of school and acronym
YearLevelSchema.index({ school: 1, name: 1, acronym: 1 }, { unique: true });

module.exports = mongoose.models.YearLevel || mongoose.model("YearLevel", YearLevelSchema);