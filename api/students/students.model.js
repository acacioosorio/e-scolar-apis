// Students Model
// ./api/students/students.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const StudentSchema = new Schema({
	name: String,
	admissionNumber: String,
	registration: String,
	admissionDate: {
		type: Date,
		required: [true, "Admission date is required"],
	},
	status: {
		type: String,
		enum: ['active', 'inactive', 'archived'],
		default: 'active'
	},
	rollNumber: String,
	photo: String,
	dateOfBirth: Date,
	gender: {
		type: String,
		enum: ['male', 'female', 'other'],
		default: 'other'
	},
	placeOfBirth: {
		country: String,
		city: String,
		state: String,
	},
	identityDocument: { 
		type: {
			type: String,
			enum: ['cpf', 'rg', 'passport', 'cnh', 'other'],
			default: 'other'
		},
		number: String,
		issuer: String,
		issueDate: Date
	},
	location: {
		address: String,
		number: String,
		complement: String,
		cep: String,
		neighborhood: String,
		city: String,
		state: String,
		latLng: String,
	},
	contact: {
		phone: String,
		cellPhone: String,
		otherPhone: String,
		email: String,
	},
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
			other: Boolean,
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
		bloodType: String,
		allergiesDetails: String, // In case allergies: Boolean === true
		chronicDiseasesDetails: String, // In case chronicDiseases: Boolean === true
		emergencyContact: {
			name: String,
			phone: String,
			relationship: String
		},
		pendingDocuments: {
			birthCertificate: Boolean,
			idPhoto: Boolean,
			proofOfAddress: Boolean,
			transferStatement: Boolean,
			medicalCertificate: Boolean,
			other: String
		}
	},
	statusReason: String,
	inQueue: { type: Boolean, default: false },
	responsibles: [{ type: Schema.Types.ObjectId, ref: "Users" }],
	school: { type: Schema.Types.ObjectId, ref: "School" },
	enrollmentDate: Date,
	enrollmentStatus: {
		type: String,
		enum: ['active', 'inactive', 'transferred', 'completed', 'locked', 'cancelled'],
		default: 'active'
	},
	academicYear: Number,
	currentGrade: String,
	currentShift: String,
	schoolOfOrigin: String,
	classes: [
		{
			type: Schema.Types.ObjectId,
			ref: "Classes",
			required: true,
		},
	],
	history: [
		{
			responsible: { type: Schema.Types.ObjectId, ref: "Users" },
			date: { type: Date, default: Date.now },
		},
	],
	generalObservations: String,
}, { timestamps: true })

StudentSchema.index({ school: 1, admissionNumber: 1 }, { unique: true });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);