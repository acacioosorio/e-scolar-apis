// Academic Year Model
// ./api/academic-years/academicYear.model.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * YearLevel Schema
 * Represents a specific grade or year level (e.g., 1º Ano, 2ª Série).
 */
const AcademicYearSchema = new Schema(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: "School",
            required: [true, "School is required"],
        },
		// Ex: "2023-2024", "2024", required
		year: {
			type: String,
			required: [true, "Year is required"],
		},
		title: {
			type: String,
			required: [true, "Title is required"],
		},
		startDate: {
			type: Date,
			required: [true, "Start date is required"],
		},
		endDate: {
			type: Date,
			required: [true, "End date is required"],
		},
		status: {
			type: Boolean,
			default: true,
		},
		// If the academic year is the current one - Only one can be true
		isCurrent: {
			type: Boolean,
			default: false,
		},
		description: {
			type: String,
		},
    },
    { timestamps: true }
);

// Ensure unique combination of school and year
AcademicYearSchema.index({ school: 1, year: 1, startDate: 1, endDate: 1, title: 1 }, { unique: true });

module.exports = mongoose.models.AcademicYear || mongoose.model("AcademicYear", AcademicYearSchema);