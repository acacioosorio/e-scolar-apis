// Students Controller
// ./api/students/students.controller.js

const { randomUUID } = require("crypto");
const Student = require("./students.model");
const School = require("../schools/school.model");
const {
	logger,
	saveFileToS3,
	deleteFileFromS3,
	createErrorResponse,
} = require("../../helpers");
const slugify = require("slugify");
const Jimp = require("jimp");
const Classes = require("../classes/classes.model");
const Users = require("../users/users.model");
const mongoose = require("mongoose");

/**
 * List students with filtering, searching and pagination
 */
exports.listStudents = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user?.school;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const order = req.query.order === "desc" ? -1 : 1;
		const searchQuery = req.query.search || "";
		const searchFields = req.query.searchFields
			? req.query.searchFields.split(",")
			: ["name"];
		const classId = req.query.classId;
		const status = req.query.status; // Add status filter

		if (!schoolId)
			return res.status(400).json(createErrorResponse("School ID is required"));

		// Check if user has permission to view students
		if (
			req.user &&
			req.user.school.toString() !== schoolId.toString() &&
			req.user.role !== "master"
		)
			return res
				.status(403)
				.json(
					createErrorResponse(
						"Not authorized to view students from this school"
					)
				);

		const school = await School.findById(schoolId);
		if (!school)
			return res.status(404).json(createErrorResponse("School not found"));

		// Build filter object
		const filter = { school: schoolId };

		// Add class filter if provided
		if (classId) {
			filter.classes = classId;
		}

		// Add status filter if provided
		if (status) {
			filter.status = status;
		}

		// Add search conditions if search query exists
		if (searchQuery) {
			const searchConditions = [];
			const hasClassSearch = searchFields.includes("classes");

			// Handle non-class field searches
			searchFields.forEach((field) => {
				if (field !== "classes") {
					searchConditions.push({ [field]: new RegExp(searchQuery, "i") });
				}
			});

			if (searchConditions.length > 0) {
				filter.$or = searchConditions;
			}
		}

		// Get total count for pagination
		const totalCount = await Student.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		// Build the query
		let query = Student.find(filter)
			.select("-password -validateHash")
			.sort({ name: order })
			.skip(skip)
			.limit(limit)
			.populate("classes", "name");

		// Execute query
		let students = await query;

		// Filter students by class name if class search is active
		if (searchFields.includes("classes") && searchQuery) {
			const classRegex = new RegExp(searchQuery, "i");
			students = students.filter((student) =>
				student.classes.some((cls) => classRegex.test(cls.name))
			);
		}

		res.status(200).send({
			success: true,
			data: {
				students,
				pagination: {
					currentPage: page,
					totalPages,
					totalItems: totalCount,
					itemsPerPage: limit,
					hasNextPage: page < totalPages,
					hasPreviousPage: page > 1,
				},
			},
		});
	} catch (error) {
		logger.error("Error in listStudents:", error);
		if (error.name === "CastError") {
			return res.status(400).json(createErrorResponse("Invalid ID format"));
		}
		res
			.status(500)
			.json(
				createErrorResponse("Internal server error while fetching students")
			);
	}
};

/**
 * Add a new student
 */
exports.addStudent = async (req, res) => {
	try {
		let data = req.body;
		const schoolId = req.user?.school;

		// Log the raw FormData
		console.log("Raw FormData:", data);

		// Convert FormData to JSON object
		const jsonData = {};

		// Helper function to set nested object value
		const setNestedValue = (obj, path, value) => {
			const keys = path.split(".");
			let current = obj;

			for (let i = 0; i < keys.length - 1; i++) {
				if (!current[keys[i]]) {
					// If next key is a number, create an array, otherwise an object
					current[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
				}
				current = current[keys[i]];
			}

			const lastKey = keys[keys.length - 1];
			// Convert boolean strings to actual booleans
			if (value === "true" || value === "false") {
				current[lastKey] = value === "true";
			} else {
				current[lastKey] = value;
			}
		};

		// Process all form fields
		Object.keys(data).forEach((key) => {
			setNestedValue(jsonData, key, data[key]);
		});

		// Handle file separately if exists
		if (req.file) {
			jsonData.photo = {
				fieldname: req.file.fieldname,
				originalname: req.file.originalname,
				mimetype: req.file.mimetype,
				size: req.file.size,
			};
		}

		// Convert classes array from object to array if needed
		if (
			jsonData.classes &&
			typeof jsonData.classes === "object" &&
			!Array.isArray(jsonData.classes)
		) {
			jsonData.classes = Object.values(jsonData.classes);
		}

		// Log the converted JSON
		console.log("Converted to JSON:", JSON.stringify(jsonData, null, 2));

		// Update data with parsed version
		data = jsonData;

		if (
			!data.name ||
			!data.registration ||
			!data.classes ||
			!data.classes.length
		) {
			return res.status(400).json(
				createErrorResponse(
					"Validation error",
					[
						{ field: "name", message: "Name is required" },
						{ field: "registration", message: "Registration is required" },
						{ field: "classes", message: "At least one class is required" },
					].filter((field) => !data[field.field])
				)
			);
		}

		// Handle photo upload if provided
		if (req.file) {
			const school = await School.findById(schoolId);
			if (!school) {
				return res.status(404).json({ error: "School not found" });
			}

			try {
				// Process image with Jimp
				const image = await Jimp.read(req.file.buffer);

				// Resize and crop to 512x512
				image
					.cover(512, 512) // This will maintain aspect ratio and crop to fit
					.quality(90); // Set JPEG quality to 90%

				// Convert the processed image back to buffer
				const processedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

				const slug = await slugify(data.name);
				const savedFile = await saveFileToS3(
					processedImageBuffer,
					"image/jpeg", // Always save as JPEG
					`schools/${school.slug}/students/${slug}`
				);
				data.photo = savedFile.Location;
			} catch (uploadError) {
				logger.error("Error processing or uploading photo:", uploadError);
				return res
					.status(500)
					.json({ error: "Error processing or uploading photo" });
			}
		}

		// Verify all classes belong to school
		const studentClasses = await Classes.find({
			_id: { $in: data.classes },
			school: schoolId,
		});

		if (!studentClasses.length) {
			return res
				.status(404)
				.json(createErrorResponse("No valid classes found for your school"));
		}

		if (studentClasses.length !== data.classes.length) {
			return res
				.status(400)
				.json(
					createErrorResponse(
						"One or more classes do not belong to your school"
					)
				);
		}

		// Create new student object [OK]
		const newStudent = new Student({
			...data,
			school: schoolId,
			status: data.status || 'active',
		});

		// Save student [OK]
		try {
			await newStudent.save();
		} catch (saveError) {
			// Handle Mongoose validation errors
			if (saveError.name === "ValidationError") {
				return res.status(400).json(
					createErrorResponse(
						"Validation error",
						Object.values(saveError.errors).map((err) => ({
							field: err.path,
							message: err.message,
						}))
					)
				);
			}
			// Handle duplicate key errors
			if (saveError.code === 11000) {
				const field = Object.keys(saveError.keyPattern)[0];
				return res.status(400).json({
					error: "Erro de duplicidade",
					details: [
						{
							field,
							message: `Este ${field} já está em uso`,
						},
					],
				});
			}
			throw saveError;
		}

		// Update school with new student
		await School.findByIdAndUpdate(schoolId, {
			$push: { students: newStudent._id },
		});

		res.status(201).json({
			success: true,
			message: "Estudante criado com sucesso",
			data: {
				id: newStudent._id,
				firstName: newStudent.firstName,
				lastName: newStudent.lastName,
				email: newStudent.email,
				photo: newStudent.photo,
				status: newStudent.status,
				classes: studentClasses.map((c) => ({
					id: c._id,
					name: c.name,
				})),
			},
		});
	} catch (error) {
		logger.error("Error creating student:", error);
		res
			.status(500)
			.json(
				createErrorResponse(
					"Internal error while creating student",
					error.message
				)
			);
	}
};

/**
 * Update student information
 */
exports.updateStudent = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;

		// Fields that cannot be updated
		const restrictedFields = ["school"];
		restrictedFields.forEach((field) => delete updates[field]);

		// Find the student and check if they belong to the school
		const student = await Student.findOne({
			_id: updates._id,
			school: schoolId,
		});
		if (!student) {
			return res
				.status(404)
				.json(
					createErrorResponse(
						"Student not found or does not belong to your school's classes"
					)
				);
		}

		if (updates.classes && Array.isArray(updates.classes)) {
			const newClasses = await Classes.find({
				_id: { $in: updates.classes },
				school: schoolId,
			});

			if (!newClasses.length) {
				return res
					.status(400)
					.json(createErrorResponse("No valid classes found for your school"));
			}

			if (newClasses.length !== updates.classes.length) {
				return res
					.status(400)
					.json(
						createErrorResponse(
							"One or more classes do not belong to your school"
						)
					);
			}
		}

		// Handle photo upload if provided
		if (req.file) {
			const school = await School.findById(schoolId);
			try {
				// Delete old photo if exists
				if (student.photo) {
					const oldPhotoKey = student.photo.split(".com/")[1];
					await deleteFileFromS3(oldPhotoKey);
				}

				const savedFile = await saveFileToS3(
					req.file.buffer,
					req.file.mimetype,
					`schools/${school.slug}/students/${updates.firstName || student.firstName
					}-${updates.lastName || student.lastName}`
				);
				updates.photo = savedFile.Location;
			} catch (uploadError) {
				logger.error("Error handling photo:", uploadError);
				return res.status(500).json({ error: "Error handling photo upload" });
			}
		}

		// Update student information
		const updatedStudent = await Student.findByIdAndUpdate(
			updates._id,
			{ $set: updates },
			{
				new: true,
				select: "-validateHash",
			}
		).populate("classes", "name");

		res.json({
			success: true,
			message: "Student updated successfully",
			data: updatedStudent,
		});
	} catch (error) {
		logger.error("Error updating student:", error);
		res
			.status(500)
			.json(createErrorResponse("Error updating student", error.message));
	}
};

/**
 * Delete a student
 * TO DO:
	REMOVE STUDENTS FROM LINKED RESPONSIBLES
*/
exports.deleteStudent = async (req, res) => {
	try {
		const { id } = req.params;
		const requestingUser = req.user;

		// Find the student to be deleted
		const studentToDelete = await Student.findById(id).populate("school");

		if (!studentToDelete)
			return res
				.status(404)
				.json(
					createErrorResponse(
						"Student not found or does not belong to your school's classes"
					)
				);

		// Check if requesting user has permission (same school or backoffice)
		if (requestingUser.role !== "backoffice") {
			// For non-backoffice users, check if schools match
			if (
				!studentToDelete.school ||
				!requestingUser.school ||
				studentToDelete.school._id.toString() !==
				requestingUser.school.toString()
			) {
				return res.status(403).json({
					error:
						"You dont have permission to delete students from other schools",
				});
			}
		}

		// Start cleanup process
		const school = await School.findById(studentToDelete.school);

		if (school) {
			// Remove student from school's students array
			await School.findByIdAndUpdate(school._id, { $pull: { students: id } });
		}

		// Delete student's photo from S3 if it exists
		if (studentToDelete.photo) {
			try {
				const photoKey = studentToDelete.photo.split(".com/")[1];
				await deleteFileFromS3(photoKey);
			} catch (error) {
				logger.error("Error deleting photo from S3:", error);
				// Continue with student deletion even if photo deletion fails
			}
		}

		// Delete the student
		await Student.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: "Estudante deletado com sucesso.",
			data: {
				id: studentToDelete._id,
				email: studentToDelete.email,
				school: school
					? {
						id: school._id,
						name: school.name,
					}
					: null,
			},
		});
	} catch (error) {
		logger.error("Delete student error:", error);
		return res
			.status(500)
			.json(createErrorResponse("Internal error while deleting student"));
	}
};

/**
 * Link one or more responsibles (Users with role 'parent') to a student
 */
exports.linkResponsibles = async (req, res) => {
	try {
		const { studentId } = req.params;
		const { responsiblesIds } = req.body;
		const schoolId = req.user?.school;

		if (
			!responsiblesIds ||
			!Array.isArray(responsiblesIds) ||
			responsiblesIds.length === 0
		)
			return res
				.status(400)
				.json(createErrorResponse("Guardian IDs array is required"));

		const student = await Student.findOne({ _id: studentId, school: schoolId });
		if (!student)
			return res
				.status(404)
				.json(
					createErrorResponse(
						"Student not found or does not belong to your school"
					)
				);

		// Validate guardian IDs
		const validResponsibles = await Users.find({
			_id: { $in: responsiblesIds },
			role: "parent", // Ensure they are parents
			// Optionally, check if guardian is approved or linked to the same school if needed
			// school: schoolId // This might be too restrictive depending on your logic
		}).select("_id");

		const validGuardianIds = validResponsibles.map((r) => r._id);

		if (validGuardianIds.length !== responsiblesIds.length) {
			const invalidIds = responsiblesIds.filter(
				(id) => !validGuardianIds.some((vgId) => vgId.toString() === id)
			);
			logger.warn("Invalid or non-parent guardian IDs provided:", invalidIds);
			// Decide if to proceed with valid ones or return error
			return res
				.status(400)
				.json(
					createErrorResponse(
						`Invalid or non-parent guardian IDs provided: ${invalidIds.join(
							", "
						)}`
					)
				);
		}

		if (validGuardianIds.length === 0)
			return res
				.status(400)
				.json(
					createErrorResponse("No valid guardians found with the provided IDs")
				);

		// Add valid guardians to the student's responsibles array using $addToSet to avoid duplicates
		const updatedStudent = await Student.findByIdAndUpdate(
			studentId,
			{ $addToSet: { responsibles: { $each: validGuardianIds } } },
			{ new: true }
		).populate("responsibles", "firstName lastName email"); // Populate added guardians info

		res.status(200).json({
			success: true,
			message: "Guardians linked successfully",
			data: updatedStudent,
		});
	} catch (error) {
		logger.error("Error linking guardians:", error);
		if (error.name === "CastError") {
			return res
				.status(400)
				.json(createErrorResponse("Invalid ID format for student or guardian"));
		}
		res
			.status(500)
			.json(
				createErrorResponse("Internal server error while linking guardians")
			);
	}
};

/**
 * Unlink a responsible from a student
 */
exports.unlinkResponsibles = async (req, res) => {
	try {
		const { studentId, responsibleId } = req.params;
		const schoolId = req.user?.school;

		// Find the student and check if they belong to the school
		const student = await Student.findOne({ _id: studentId, school: schoolId });
		if (!student) return res.status(404).json(createErrorResponse('Student not found or does not belong to your school'));

		// Remove the guardian ID from the student's responsibles array
		const updatedStudent = await Student.findByIdAndUpdate(
			studentId,
			{ $pull: { responsibles: responsibleId } },
			{ new: true }
		);

		if (!updatedStudent) return res.status(404).json(createErrorResponse('Student not found after update attempt'));

		// Check if the guardian was actually removed (optional)
		const wasRemoved = !student.responsibles.includes(responsibleId);

		res.status(200).json({
			success: true,
			message: wasRemoved ? 'Guardian unlinked successfully' : 'Guardian was not linked to this student',
			data: updatedStudent
		});

	} catch (error) {
		logger.error('Error unlinking guardian:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid ID format for student or guardian'));
		}
		res.status(500).json(createErrorResponse('Internal server error while unlinking guardian'));
	}
};

/**
 * Update student status
 */
exports.updateStudentStatus = async (req, res) => {
	try {
		const { studentId } = req.params;
		const { status } = req.body;
		const schoolId = req.user?.school;

		console.log(studentId);
		console.log(req.body);

		// Validate status
		if (!['active', 'inactive', 'archived'].includes(status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, inactive, archived'));
		}

		const updatedStudent = await Student.findOneAndUpdate(
			{ _id: studentId, school: schoolId },
			{ $set: { status } },
			{ new: true, select: '_id name status' }
		);

		if (!updatedStudent) {
			return res.status(404).json(createErrorResponse('Student not found or does not belong to your school'));
		}

		res.status(200).send({
			success: true,
			data: updatedStudent
		});

	} catch (error) {
		logger.error('Error updating student status:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid student ID format'));
		}
		res.status(500).json(createErrorResponse('Internal server error while updating student status', error));
	}
};