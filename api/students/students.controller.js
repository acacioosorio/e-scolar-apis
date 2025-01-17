const AWS = require('aws-sdk');
const Jimp = require("jimp");
const multer = require('multer');
const { randomUUID } = require('crypto');
const upload = multer({ storage: multer.memoryStorage() });
const { clearString, str2slug, logger } = require('../../helpers/index')
const School = require('../schools/school.model')
const Student = require('./students.model')

/**
 * Configure Nodemailer
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
	host: "smtp.kinghost.net",
	port: 465,
	secure: true,
	auth: {
		user: "admin@escolar.site",
		pass: "Ac410s0#789852",
	},
	// auth: {
	// 	user: "noreply@escolar.site",
	// 	pass: "eSc789@4A58B4#123!4s",
	// },
});

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION
});

/**
 * HELPERS FUNCTIONS
 */
async function saveFile(fileBuffer, mimeType, folder) {
	const fileName = `${randomUUID()}.jpeg`;
	const key = `${folder}/${fileName}`;

	const params = {
		Bucket: 'e-scolar',
		Key: key,
		Body: fileBuffer,
		ContentType: mimeType,
		ACL: 'public-read',
	};

	try {
		const uploadResult = await s3.upload(params).promise();
		return uploadResult;
	} catch (error) {
		console.error("saveFile error =>", error);
		throw error;
	}
}

function deleteFileFromS3(key) {
	const params = {
		Bucket: 'e-scolar',
		Key: key,
	};

	return s3.deleteObject(params).promise();
}

/**
 * Creates a new student in the database based on the request body.
 *
 * @param {Object} req - The request object containing the student data.
 * @param {Object} res - The response object used to send the created student or error.
 * @return {Promise<void>} - A promise that resolves when the student is successfully created or rejects with an error.
 */
exports.createStudent = async (req, res) => {

    logger.error("createStudent process");

    let s3TempKeys = [];

    try {
        const { files, user } = req;
        const school = await School.findById(user.school);
        const student = new Student(req.body);
        const folder = str2slug(school.name);

        logger.info(`Student: ${student}`);

        for (const file of files) {
			const savedFile = await saveFile(file.buffer, file.mimetype, `${folder}/students`);
			s3TempKeys.push(savedFile.Key); // Store keys for potential cleanup
			student.photo = savedFile.Location;
		}

        delete req.body.files;

        const studentSaved = await student.save();

        const pushStudent = await School.findOneAndUpdate(
			{ _id: req.user.school },
			{ $push: { students: studentSaved._id } },
			{ new: true }
		);

        res.status(201).send({student});
    } catch (error) {
        logger.error(error)
        
        const cleanupPromises = s3TempKeys.map(key => deleteFileFromS3(key));
+		await Promise.all(cleanupPromises);

        res.status(500).send({ error: error });
    }
};

/**
 * Retrieves all students and sends them as a response.
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @return {Promise} The list of students
 */
exports.getStudents = async (req, res) => {
    const { user } = req;
    try {
        const school = await School.findById(user.school).populate('students').select('');
        res.status(200).send(school.students);
    } catch (error) {
        logger.error(error)
        res.status(500).send(error);
    }
};

/**
 * Retrieves a student by their ID and sends it in the response.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @return {Promise<void>} sends the student in the response or an error status
 */
exports.getStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).send();
        }
        res.status(200).send(student);
    } catch (error) {
        res.status(500).send(error);
    }
};

/**
 * Asynchronously updates a student with the provided ID using the data in the request body.
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @return {Promise} A promise that resolves to the updated student object or rejects with an error
 */
exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!student) {
            return res.status(404).send();
        }
        res.status(200).send(student);
    } catch (error) {
        res.status(400).send(error);
    }
};

/**
 * Deletes a student from the database.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The parameters object.
 * @param {string} req.params.id - The ID of the student to be deleted.
 * @param {Object} res - The response object.
 * @return {Promise<void>} - A promise that resolves when the student is successfully deleted or rejects with an error.
 */
exports.deleteStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) {
            return res.status(404).send();
        }
        res.status(200).send(student);
    } catch (error) {
        res.status(500).send(error);
    }
};