// Educational Segment Model
// ./api/pedagogy/educationalSegment.model.js

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
		// Ex: "Educação Infantil", "Ensino Fundamental Anos Iniciais", "Ensino Médio"
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
		// General order for display purposes (independent of segment)
        order: {
            type: Number,
            default: 0,
        },
		// Optional description or comments
		description: {
			type: String,
			trim: true,
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'archived'],
			default: 'active',
			required: true
		},
	},
	{ timestamps: true }
);

// Ensure unique combination of school and name/acronym
EducationalSegmentSchema.index( { school: 1, name: 1, acronym: 1 }, { unique: true });

module.exports = mongoose.models.EducationalSegment || mongoose.model("EducationalSegment", EducationalSegmentSchema);