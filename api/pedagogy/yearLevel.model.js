const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * YearLevel Schema
 * Represents a specific grade or year level (e.g., 1º Ano, 2ª Série).
 * Can be associated with multiple Educational Segments (N:N relationship).
 */
const YearLevelSchema = new Schema(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: "School",
            required: [true, "School is required"],
            index: true,
        },
        // Array of Educational Segments this year level belongs to
        educationalSegments: [
            {
                type: Schema.Types.ObjectId,
                ref: "EducationalSegment",
                index: true, // Index for faster querying by segment
            },
        ],
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
        // General order for display purposes (independent of segment)
        order: {
            type: Number,
            default: 0,
        },
        status: {
            type: Boolean,
            default: true,
        },
        // Array of Classes belonging to this year level (remains the same)
        classes: [
            {
                type: Schema.Types.ObjectId,
                ref: "Classes",
            },
        ],
    },
    { timestamps: true }
);

// Ensure unique combination of school and name/acronym
// A year level name/acronym should be unique within the school
YearLevelSchema.index({ school: 1, name: 1 }, { unique: true });
YearLevelSchema.index({ school: 1, acronym: 1 }, { unique: true });

module.exports = mongoose.models.YearLevel || mongoose.model("YearLevel", YearLevelSchema);