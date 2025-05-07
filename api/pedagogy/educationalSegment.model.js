const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * EducationalSegment Schema
 * Represents a broad educational stage within a school (e.g., Educação Infantil, Ensino Fundamental I).
 */
const EducationalSegmentSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
			index: true,
		},
		name: {
			type: String,
			required: [true, "Segment name is required"],
			trim: true,
		},
		// Short code or abbreviation (e.g., EI, EFI, EFII, EM)
		acronym: {
			type: String,
			required: [true, "Acronym is required"],
			trim: true,
			uppercase: true,
			maxLength: 5,
		},
		// Type of segment (e.g., normal, grouping, elective) - Matches frontend
		type: {
			type: String,
			required: [true, "Segment type is required"],
			enum: ["normal", "grouping", "elective"],
			default: "normal",
		},
		// Optional description or comments
		comments: {
			type: String,
			trim: true,
		},
		// Order for display purposes
		order: {
			type: Number,
			default: 0,
		},
		active: {
			type: Boolean,
			default: true,
		},
		// Array of Year Levels belonging to this segment
		yearLevels: [
			{
				type: Schema.Types.ObjectId,
				ref: "YearLevel",
			},
		],
		// Array of Subjects belonging to this segment
		subjects: [
			{
				type: Schema.Types.ObjectId,
				ref: "Subjects",
			},
		],
	},
	{ timestamps: true }
);

// Ensure unique combination of school and name/acronym
EducationalSegmentSchema.index({ school: 1, name: 1 }, { unique: true });
EducationalSegmentSchema.index({ school: 1, acronym: 1 }, { unique: true });

module.exports = mongoose.models.EducationalSegment || mongoose.model("EducationalSegment", EducationalSegmentSchema);