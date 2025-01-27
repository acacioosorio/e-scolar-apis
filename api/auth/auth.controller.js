const slugify = require('slugify');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const Users = require('../users/users.model'); // Adjust path as needed
const { logger, saveFileToS3, deleteFileFromS3 } = require('../../helpers');

exports.signup = async (req, res) => {
	try {
		const user = new User(req.body);
		const savedUser = await user.save();
		res.status(201).send({ message: 'User created', user: savedUser });
	} catch (error) {
		logger.error(error)
		res.status(500).send({ error: error });
	}
};

exports.signin = async (req, res) => {

	const cpf = req.body.cpf;
	const password = req.body.password;

	try {

		const user = await User.findOne({ 'documents.cpf': cpf });

		if (!user) return res.status(404).json({ message: 'User not found' });

		bcrypt.compare(password, user.password).then(isMatch => {
			if (isMatch) {

				const payload = { id: user.id, name: user.firstName, roles: user.roles };

				jwt.sign(payload, process.env.SESSION_SECRET, { expiresIn: 31556926 }, (err, token) => {

					const simplifiedUser = {
						firstName: user.firstName,
						lastName: user.lastName,
						email: user.email,
						photo: user.photo
					};

					res.status(200).send({ message: 'Logged in successfully', user: simplifiedUser, token: 'Bearer ' + token });

				});
			} else {
				return res.status(400).json({ message: 'Password incorrect' });
			}
		});

	} catch (error) {
		logger.error(error)
		res.status(500).send(error);
	}
};

exports.backofficeSignin = async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;

	try {
		const user = await Users.findOne({ 'email': email });
		if (!user) return res.status(404).json({ message: 'User not found' });

		bcrypt.compare(password, user.password).then(isMatch => {
			if (isMatch) {

				const payload = { id: user.id, name: user.firstName, roles: user.roles };

				jwt.sign(payload, process.env.SESSION_SECRET, { expiresIn: 31556926 }, (err, token) => {

					return res.json({
						message: 'Login BackOffice bem-sucedido.',
						token,
						user: {
							id: user._id,
							firstName: user.firstName,
							lastName: user.lastName,
							email: user.email,
							role: user.role,
							photo: user.photo
						},
					});

				});
			} else {
				return res.status(400).json({ message: 'Password incorrect' });
			}
		});

	} catch {
		logger.error(error)
		res.status(500).send(error);
	}
}

exports.schoolSignin = async (req, res) => {
	const { email, password } = req.body;

	try {
		const user = await Users.findOne({ 'email': email }).populate('school');

		if (!user) return res.status(404).json({ message: 'User not found' });
		
		if (user.role !== 'school')
			return res.status(403).json({ message: 'Unauthorized access. This endpoint is for school users only.' });

		if (!user.active)
			return res.status(403).json({ message: 'Your account is inactive. Please contact your administrator.' });

		const isMatch = await bcrypt.compare(password, user.password);
		
		if (!isMatch)
			return res.status(400).json({ message: 'Password incorrect' });

		const payload = { 
			id: user.id, 
			name: user.firstName,
			photo: user.photo,
			role: user.role, 
			subRole: user.subRole,
			school: user.school._id
		};

		console.warn(user.school.CNPJ);

		// Keep only essential school data
		const schoolData = {
			name: user.school.name,
			CNPJ: user.school.CNPJ,
			slug: user.school.slug,
			email: user.school.email,
			logo: user.school.logo,
			facade: user.school.facade,
			location: user.school.location,
			telephone: user.school.telephone
		};

		jwt.sign(payload, process.env.SESSION_SECRET, { expiresIn: 31556926 }, (err, token) => {
			if (err) {
				logger.error('JWT Sign Error:', err);
				return res.status(500).json({ message: 'Error generating token' });
			}

			return res.json({
				message: 'Login School bem-sucedido.',
				token,
				school: schoolData,
				user: {
					photo: user.photo,
					firstName: user.firstName,
					lastName: user.lastName,
					email: user.email,
					role: user.role,
				},
			});
		});

	} catch (error) {
		logger.error('School signin error:', error);
		res.status(500).json({ message: 'Internal server error during login' });
	}
}

exports.checkValidation = async (req, res) => {
	try {
		const { hash } = req.params;

		if (!hash) {
			return res.status(400).json({
				valid: false,
				error: 'Hash de validação é obrigatório.'
			});
		}

		const user = await Users.findOne({ 'validateHash.hash': hash });

		if (!user) {
			return res.status(400).json({
				valid: false,
				error: 'Hash de validação inválido ou já utilizado.'
			});
		}

		// Check if validation hash is expired
		if (new Date() > user.validateHash.hashExpiration) {
			return res.status(400).json({
				valid: false,
				error: 'Link de validação expirado.'
			});
		}

		return res.status(200).json({
			valid: true,
			email: user.email,
			role: user.role
		});

	} catch (error) {
		console.error('Check validation error:', error);
		return res.status(500).json({
			valid: false,
			error: 'Erro interno ao verificar hash de validação.'
		});
	}
}

exports.validation = async (req, res) => {

	let s3TempKey = null;
	const { validationHash, password } = req.body;

	if (!validationHash) {
		return res.status(400).json({ error: 'Hash de validação é obrigatório.' });
	}

	try {
		// Find user by validation hash
		const user = await Users.findOne({ 'validateHash.hash': validationHash }).populate('school');

		if (!user) return res.status(404).json({ error: 'Hash de validação inválido.' });

		if (user.role !== 'school') return res.status(403).json({ error: 'Esta rota é apenas para validação de escolas.' });

		// Check if validation hash is expired
		if (new Date() > user.validateHash.hashExpiration) return res.status(400).json({ error: 'Link de validação expirado.' });

		// Handle photo upload if provided
		if (req.file) {
			const slug = await slugify(`${user.firstName} ${user.lastName}`);
			try {
				const savedFile = await saveFileToS3(
					req.file.buffer,
					req.file.mimetype,
					`schools/${user.school.slug}/staff/${slug}`
				);
				s3TempKey = savedFile.Key;
				user.photo = savedFile.Location;
			} catch (uploadError) {
				console.error('Error uploading photo:', uploadError);
				return res.status(500).json({ error: 'Erro ao fazer upload da foto.' });
			}
		}

		// Update user in database
		const updatedUser = await Users.findOneAndUpdate(
			{ _id: user._id },
			{
				$set: {
					password: password,
					photo: user.photo,
					active: true,
					validateHash: {
						hash: null,
						hashExpiration: null
					}
				}
			},
			{ new: true }
		).populate('school');

		if (!updatedUser) {
			if (s3TempKey) await deleteFileFromS3(s3TempKey);
			return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
		}

		return res.status(200).json({
			message: 'Conta validada e senha definida com sucesso.',
			email: updatedUser.email
		});

	} catch (error) {
		console.error('Validation error:', error);
		// Clean up S3 if photo was uploaded
		if (s3TempKey) {
			try {
				await deleteFileFromS3(s3TempKey);
			} catch (deleteError) {
				console.error('Error cleaning up S3:', deleteError);
			}
		}
		return res.status(500).json({ error: 'Erro interno ao validar conta.' });
	}

}