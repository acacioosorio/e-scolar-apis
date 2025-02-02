const tracer = require('tracer');
const AWS = require('aws-sdk');
const { randomUUID } = require('crypto');

function clearString(str) {
	var rep = ' ';

	str = str.toLowerCase().replace(/\s+/g, rep)
	var from = "àáäâèéëêìíïîòóöôùúüûñç";
	var to = "aaaaeeeeiiiioooouuuunc";
	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(
			new RegExp(from.charAt(i), 'g'),
			to.charAt(i)
		);
	}
	// remove invalid chars
	str = str.replace(new RegExp('[^a-z0-9' + rep + ']', "g"), '')
		.replace(/-+/g, rep); // collapse dashes;

	return str;
}

function str2slug(str) {
	var rep = '-';

	str = str.toLowerCase().replace(/\s+/g, rep)
	var from = "àáäâèéëêìíïîòóöôùúüûñç";
	var to = "aaaaeeeeiiiioooouuuunc";
	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(
			new RegExp(from.charAt(i), 'g'),
			to.charAt(i)
		);
	}
	// remove invalid chars
	str = str.replace(new RegExp('[^a-z0-9' + rep + ']', "g"), '').replace(/-+/g, rep); // collapse dashes;

	return str;
}

const logger = tracer.colorConsole({
	level: 'log',
	format: "{{timestamp}} - {{file}}:{{line}} {{message}}",
	dateformat: "HH:MM:ss.L",
});

/**
 * AWS S3 CONFIG
 */
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION
});

/**
 * Uploads a file to S3
 * @param {Buffer} fileBuffer Buffer representation of the file to upload
 * @param {string} mimeType MIME type of the file
 * @param {string} folder Folder to upload the file to
 * @returns {Promise<AWS.S3.ManagedUpload.SendData>} Result of the S3 upload operation
 * @throws {Error} If the upload operation fails
 */
async function saveFileToS3(fileBuffer, mimeType, folder) {
	const fileName = `${randomUUID()}.jpeg`;
	const key = `${folder}/${fileName}`;

	try {
		const params = {
			Bucket: 'e-scolar',
			Key: key,
			Body: fileBuffer,
			ContentType: mimeType,
			ACL: 'public-read',
		};

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

function createErrorResponse(message, details = null) {
	return {
		success: false,
		error: {
			message,
			details: details || undefined
		}
	};
}

module.exports = {
	clearString,
	str2slug,
	logger,
	saveFileToS3,
	deleteFileFromS3,
	createErrorResponse
};