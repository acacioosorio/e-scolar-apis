const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const StudentSchema = new Schema({
	name: String,
	registration: String,
	photo: String,
	medicalRecord: {
		healthInsurance: { does: Boolean, name: String },
		chronicDiseases: {
			allergies: Boolean,
			anemia: Boolean,
			bronchitis: Boolean,
			asthma: Boolean,
			pneumonia: Boolean,
			tonsillitis: Boolean,
			headache: Boolean,
			diabetes: Boolean,
			heartDisease: Boolean,
			epilepsy: Boolean,
			otitis: Boolean,
			mentalproblems: Boolean,
		},
		commonChildhoodDiseases: {
			measles: Boolean,
			chickenpox: Boolean,
			mumps: Boolean,
			whoopingCough: Boolean,
			meningitis: Boolean,
			polio: Boolean,
			scarletFever: Boolean,
			rubella: Boolean,
		},
	},
	inQueue: { type: Boolean, default: false },
	responsibles: [{ type: Schema.Types.ObjectId, ref: "Users" }],
	school: { type: Schema.Types.ObjectId, ref: "School" },
	class: { type: Schema.Types.ObjectId, ref: 'Classes' },
	history: [
		{
			responsible: { type: Schema.Types.ObjectId, ref: "Users" },
			date: { type: Date, default: Date.now },
		},
	],
	notes: String,
}, { timestamps: true })

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);