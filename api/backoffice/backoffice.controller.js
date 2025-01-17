const slugify = require('slugify');
const { randomUUID } = require('crypto');

const { logger, saveFileToS3, deleteFileFromS3 } = require('../../helpers');

const School = require('../schools/school.model');
const Users = require('../users/users.model');
const { sendValidateEmail } = require('../../helpers/emails');

exports.index = async (req, res, next) => {
	res.json({ message: 'Bem-vindo ao painel do BackOffice!' });
};

exports.subRole = async (req, res, next) => {
	res.json({ message: 'Bem-vindo ao painel do BackOffice com subRole!' });
};

exports.schoolsList = async (req, res, next) => {

	try {
		const {
			page = 1,
			limit = 10,
			sort = 'name',
			order = 'asc',
			search,
			active,
			city,
			state
		} = req.query;

		// Build query
		const query = {};

		// Search by name
		if (search) {
			query.name = { $regex: search, $options: 'i' };
		}

		// Filter by active status
		if (active !== undefined) {
			query.active = active === 'true';
		}

		// Filter by city
		if (city) {
			query['address.city'] = { $regex: city, $options: 'i' };
		}

		// Filter by state
		if (state) {
			query['address.state'] = { $regex: state, $options: 'i' };
		}

		// Calculate skip for pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build sort object
		const sortObj = {};
		sortObj[sort] = order === 'desc' ? -1 : 1;

		// Get total count for pagination
		const total = await School.countDocuments(query);

		// Get schools with pagination and sorting
		const schools = await School.find(query)
			.sort(sortObj)
			.skip(skip)
			.limit(parseInt(limit))
			.populate({
				path: 'employees',
				select: 'firstName lastName email role subRole active'
			});

		// Calculate pagination info
		const totalPages = Math.ceil(total / parseInt(limit));
		const hasNextPage = page < totalPages;
		const hasPrevPage = page > 1;

		res.json({
			schools,
			pagination: {
				total,
				page: parseInt(page),
				totalPages,
				hasNextPage,
				hasPrevPage,
				limit: parseInt(limit)
			}
		});
	} catch (error) {
		console.error('Error fetching schools:', error);
		res.status(500).json({
			success: false,
			error: 'Erro ao buscar escolas'
		});
	}

}

exports.schoolByID = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Find school and populate employees with all relevant fields
		const school = await School.findById(id)
			.populate({
				path: 'employees',
				select: 'firstName lastName email role subRole active photo documents location contact createdAt updatedAt',
				options: { sort: { 'role': 1, 'firstName': 1 } }
			})

		if (!school) {
			return res.status(404).json({
				success: false,
				error: 'Escola não encontrada'
			});
		}

		// Group employees by role and subRole
		const employeesByRole = {
			admin: school.employees.filter(emp => emp.role === 'school' && emp.subRole === 'admin').map(emp => {
				const employee = emp.toObject();
				delete employee.validateHash;
				return employee;
			}),
			staff: school.employees.filter(emp => emp.role === 'school' && emp.subRole === 'staff').map(emp => {
				const employee = emp.toObject();
				delete employee.validateHash;
				return employee;
			}),
			concierge: school.employees.filter(emp => emp.role === 'school' && emp.subRole === 'concierge').map(emp => {
				const employee = emp.toObject();
				delete employee.validateHash;
				return employee;
			})
		};

		// Calculate statistics
		const statistics = {
			totalEmployees: school.employees.length,
			activeEmployees: school.employees.filter(emp => emp.active).length,
			pendingValidation: school.employees.filter(emp =>
				!emp.active &&
				emp.validateHash?.hashExpiration &&
				new Date(emp.validateHash.hashExpiration) > new Date()
			).length,
			byRole: {
				admin: employeesByRole.admin.length,
				staff: employeesByRole.staff.length,
				concierge: employeesByRole.concierge.length
			}
		};

		res.json({
			school: {
				_id: school._id,
				name: school.name,
				slug: school.slug,
				CNPJ: school.CNPJ,
				email: school.email,
				telephone: school.telephone,
				location: school.location,
				active: school.active,
				logo: school.logo,
				facade: school.facade,
				segments: school.segments,
				courses: school.courses,
				createdAt: school.createdAt,
				updatedAt: school.updatedAt
			},
			employees: employeesByRole,
			statistics
		});

	} catch (error) {
		console.error('Error fetching school details:', error);
		res.status(500).json({
			success: false,
			error: 'Erro ao buscar detalhes da escola'
		});
	}
}

exports.createSchool = async (req, res, next) => {
	const uploadedFiles = [];

	try {
		const schoolData = req.body;
		schoolData.active = true;

		const slug = slugify(schoolData.name, { lower: true });
		schoolData.slug = slug;

		if (req.files.logo) {
			const logoFile = req.files.logo[0];
			const logoResult = await saveFileToS3(logoFile.buffer, logoFile.mimetype, `schools/${slug}`);
			schoolData.logo = logoResult.Location;
			uploadedFiles.push(logoResult.Key);
		}

		if (req.files.facade) {
			const facadeFile = req.files.facade[0];
			const facadeResult = await saveFileToS3(facadeFile.buffer, facadeFile.mimetype, `schools/${slug}`);
			schoolData.facade = facadeResult.Location;
			uploadedFiles.push(facadeResult.Key);
		}

		const school = new School(schoolData);
		await school.save();

		res.status(201).json({
			success: true,
			data: school
		});

	} catch (error) {
		logger.error(error)

		try {
			await Promise.all(uploadedFiles.map(key => deleteFileFromS3(key)));
			logger.log(`Successfully cleaned up S3 files after error`);
		} catch (cleanupError) {
			logger.error('Error cleaning up S3 files:', cleanupError);
		}

		res.status(500).json({
			success: false,
			error: error.message || 'Error creating school'
		});
	}
}

exports.changeSchoolStatus = async (req, res, next) => {
	const { id } = req.params;
	const { status } = req.body;

	// Validate input
	if (typeof status !== 'boolean') {
		return res.status(400).json({
			success: false,
			error: 'O status deve ser um booleano (true/false)'
		});
	}

	// Find and update school
	const school = await School.findById(id);

	if (!school) {
		return res.status(404).json({
			success: false,
			error: 'Escola não encontrada'
		});
	}

	// Update school status
	school.active = status;

	// If deactivating school, deactivate all employees
	// If activating school, only activate employees who have validated their accounts
	if (!status) {
		await Users.updateMany(
			{ school: id, role: 'school' },
			{ active: false }
		);
	} else {
		await Users.updateMany(
			{
				school: id,
				role: 'school',
				'validateHash.hash': null // Only activate users who have validated their accounts
			},
			{ active: true }
		);
	}

	await school.save();

	// Get updated school with employees
	const updatedSchool = await School.findById(id).populate({
		path: 'employees',
		select: 'firstName lastName email role subRole active'
	});

	res.json({
		success: true,
		data: {
			school: updatedSchool,
			message: status
				? 'School successfully activated and validated staff have been activated'
				: 'School successfully deactivated and all staff were deactivated'
		}
	});
}

exports.updateSchool = async (req, res, next) => {
	const uploadedFiles = [];

	try {
		const { id } = req.params;
		const {
			name,
			CNPJ,
			email,
			telephone,
			location,
			active,
		} = req.body;

		// Find the school to be updated
		const schoolToUpdate = await School.findById(id).populate('employees');

		if (!schoolToUpdate) res.status(404).json({ error: 'Escola não encontrada.' });

		// Validate CNPJ if it's being changed
		if (CNPJ && CNPJ !== schoolToUpdate.CNPJ) {
			const existingSchool = await School.findOne({ CNPJ, _id: { $ne: id } });
			if (existingSchool) return res.status(400).json({ error: 'CNPJ já está em uso por outra escola.' });
		}

		// Prepare update object with only provided fields
		const updateFields = {};
		if (CNPJ) updateFields.CNPJ = CNPJ;
		if (email) updateFields.email = email;
		if (telephone) updateFields.telephone = telephone;
		if (location) updateFields.location = { ...schoolToUpdate.location, ...location };
		if (typeof active === 'boolean') updateFields.active = active;

		// Handle school name change and S3 migrations if needed
		if (name && name !== schoolToUpdate.name) {
			const oldSlug = schoolToUpdate.slug;
			const newSlug = slugify(name, { lower: true });
			updateFields.name = name;
			updateFields.slug = newSlug;

			// Migrate existing files if they exist
			const s3Updates = [];

			// Migrate logo if exists
			if (schoolToUpdate.logo) {
				const oldLogoKey = schoolToUpdate.logo.split('.com/')[1];
				const newLogoKey = oldLogoKey.replace(`schools/${oldSlug}`, `schools/${newSlug}`);

				try {
					await s3.copyObject({
						Bucket: 'e-scolar',
						CopySource: `/e-scolar/${oldLogoKey}`,
						Key: newLogoKey,
						ACL: 'public-read'
					}).promise();

					s3Updates.push(deleteFileFromS3(oldLogoKey));
					updateFields.logo = `https://e-scolar.s3.${process.env.AWS_REGION}.amazonaws.com/${newLogoKey}`;
				} catch (error) {
					console.error('Error migrating logo:', error);
				}
			}

			// Migrate facade if exists
			if (schoolToUpdate.facade) {
				const oldFacadeKey = schoolToUpdate.facade.split('.com/')[1];
				const newFacadeKey = oldFacadeKey.replace(`schools/${oldSlug}`, `schools/${newSlug}`);

				try {
					await s3.copyObject({
						Bucket: 'e-scolar',
						CopySource: `/e-scolar/${oldFacadeKey}`,
						Key: newFacadeKey,
						ACL: 'public-read'
					}).promise();

					s3Updates.push(deleteFileFromS3(oldFacadeKey));
					updateFields.facade = `https://e-scolar.s3.${process.env.AWS_REGION}.amazonaws.com/${newFacadeKey}`;
				} catch (error) {
					console.error('Error migrating facade:', error);
				}
			}

			// Migrate employee photos
			for (const employee of schoolToUpdate.employees) {
				if (employee.photo) {
					const oldPhotoKey = employee.photo.split('.com/')[1];
					const newPhotoKey = oldPhotoKey.replace(`schools/${oldSlug}`, `schools/${newSlug}`);

					try {
						await s3.copyObject({
							Bucket: 'e-scolar',
							CopySource: `/e-scolar/${oldPhotoKey}`,
							Key: newPhotoKey,
							ACL: 'public-read'
						}).promise();

						s3Updates.push(deleteFileFromS3(oldPhotoKey));

						// Update employee photo URL
						await Users.findByIdAndUpdate(employee._id, {
							photo: `https://e-scolar.s3.${process.env.AWS_REGION}.amazonaws.com/${newPhotoKey}`
						});
					} catch (error) {
						console.error(`Error migrating photo for employee ${employee._id}:`, error);
					}
				}
			}

			// Wait for all S3 deletions to complete
			await Promise.all(s3Updates);
		}

		// Handle new file uploads
		if (req.files !== undefined) {
			const currentSlug = updateFields.slug || schoolToUpdate.slug;

			if (req.files.logo) {
				const logoFile = req.files.logo[0];

				// Delete old logo from S3 if it exists
				if (schoolToUpdate.logo) {
					const oldLogoKey = schoolToUpdate.logo.split('.com/')[1];
					try {
						await deleteFileFromS3(oldLogoKey);
					} catch (error) {
						console.error('Error deleting old logo:', error);
					}
				}

				// Upload new logo
				const logoResult = await saveFileToS3(logoFile.buffer, logoFile.mimetype, `schools/${currentSlug}`);
				updateFields.logo = logoResult.Location;
				uploadedFiles.push(logoResult.Key);
			}

			if (req.files.facade) {
				const facadeFile = req.files.facade[0];

				// Delete old facade from S3 if it exists
				if (schoolToUpdate.facade) {
					const oldFacadeKey = schoolToUpdate.facade.split('.com/')[1];
					try {
						await deleteFileFromS3(oldFacadeKey);
					} catch (error) {
						console.error('Error deleting old facade:', error);
					}
				}

				const facadeResult = await saveFileToS3(facadeFile.buffer, facadeFile.mimetype, `schools/${currentSlug}`);
				updateFields.facade = facadeResult.Location;
				uploadedFiles.push(facadeResult.Key);
			}
		}

		// Update school
		const updatedSchool = await School.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true })
			.populate({
				path: 'employees',
				select: 'firstName lastName email role subRole active photo documents location contact createdAt updatedAt',
				options: { sort: { 'role': 1, 'firstName': 1 } }
			});

		return res.status(200).json({
			message: 'Escola atualizada com sucesso.',
			school: {
				id: updatedSchool._id,
				name: updatedSchool.name,
				CNPJ: updatedSchool.CNPJ,
				email: updatedSchool.email,
				telephone: updatedSchool.telephone,
				location: updatedSchool.location,
				active: updatedSchool.active,
				logo: updatedSchool.logo,
				facade: updatedSchool.facade,
				employees: updatedSchool.employees,
				createdAt: updatedSchool.createdAt,
				updatedAt: updatedSchool.updatedAt
			}
		});

	} catch (error) {
		console.error('Update school error:', error);

		// Clean up any uploaded files if there was an error
		try {
			await Promise.all(uploadedFiles.map(key => deleteFileFromS3(key)));
			console.log('Successfully cleaned up S3 files after error');
		} catch (cleanupError) {
			console.error('Error cleaning up S3 files:', cleanupError);
		}

		return res.status(500).json({
			error: 'Erro interno ao atualizar escola.',
			details: error.message
		});
	}
}

exports.addUserToSchool = async (req, res) => {
	try {
		console.time('user-creation');
		const data = req.body;

		// Generate validation hash
		const validationHash = randomUUID();
		const expirationDate = new Date();
		expirationDate.setHours(expirationDate.getHours() + 24);

		// Create new user object
		const newUser = new Users({
			...data,
			password: randomUUID(), // temporary password
			validateHash: {
				hash: validationHash,
				hashExpiration: expirationDate
			},
			active: false,
			school: req.user.role === 'school' ? req.user.school : data.school
		});

		// Find school
		const school = await School.findById(newUser.school);
		if (!school) {
			return res.status(404).json({
				error: 'Escola não encontrada'
			});
		}

		// Save user
		await newUser.save();
		console.timeLog('user-creation', 'User saved');

		// Update school with new user
		await School.findByIdAndUpdate(
			school._id,
			{ $push: { employees: newUser._id } }
		);
		console.timeLog('user-creation', 'School updated');

		// Send response immediately
		res.status(201).json({
			message: 'Usuário criado com sucesso',
			user: {
				id: newUser._id,
				firstName: newUser.firstName,
				lastName: newUser.lastName,
				email: newUser.email,
				role: newUser.role,
				subRole: newUser.subRole
			}
		});

		// Send email asynchronously after response
		try {
			await sendValidateEmail(newUser, school, validationHash);
			console.timeLog('user-creation', 'Email sent');
		} catch (emailError) {
			console.error('Error sending welcome email:', emailError);
			// Email error doesn't affect user creation, just log it
		}

		console.timeEnd('user-creation');
		process.stdout.write(`\x1B[33m \n Created User: ${newUser.email} \x1B[89m \n\n`);

	} catch (error) {
		logger.error('Error creating user:', error);
		res.status(500).json({
			error,
			message: 'Erro interno ao criar usuário'
		});
	}
}

exports.deleteUserFromSchool = async (req, res) => {
	try {
		const { id } = req.params;
		const requestingUser = req.user;

		// Find the user to be deleted
		const userToDelete = await Users.findById(id).populate('school');

		if (!userToDelete)
			return res.status(404).json({ error: 'Usuário não encontrado.' });

		// Ensure the user being deleted belongs to the same school as the admin (unless backoffice)
		if (userToDelete.school?.toString() !== requestingUser.school?.toString() && requestingUser.role !== 'backoffice')
			return res.status(403).json({ error: 'Sem permissão para deletar usuários de outras escolas.' });

		// Cannot delete yourself
		if (id === requestingUser._id.toString()) return res.status(400).json({ error: 'Não é possível deletar sua própria conta.' });

		// Start cleanup process
		const school = await School.findById(userToDelete.school);

		if (school)
			// Remove user from school's employees array
			await School.findByIdAndUpdate(school._id, { $pull: { employees: id } });

		// Delete user's photo from S3 if it exists
		if (userToDelete.photo) {
			try {
				const photoKey = userToDelete.photo.split('.com/')[1];
				let data = await deleteFileFromS3(photoKey);
				console.log(data);
			} catch (error) {
				logger.error('Error deleting photo from S3:', error);
				console.log(error);
				// Continue with user deletion even if photo deletion fails
			}
		}

		// Delete the user
		await Users.findByIdAndDelete(id);

		return res.status(200).json({
			message: 'Usuário deletado com sucesso.',
			deletedUser: {
				id: userToDelete._id,
				email: userToDelete.email,
				role: userToDelete.role,
				school: school ? {
					id: school._id,
					name: school.name
				} : null
			}
		});

	} catch (error) {
		logger.error('Delete user error:', error);
		return res.status(500).json({ error: 'Erro interno ao deletar usuário.' });
	}
}

exports.updateUser = async (req, res) => {

	try {
		const { id } = req.params;
		const requestingUser = req.user;
		const {
			firstName,
			lastName,
			email,
			documents,
			location,
			contact,
			subRole
		} = req.body;

		// Find the user to be updated
		const userToUpdate = await Users.findById(id).populate('school');

		if (!userToUpdate)
			return res.status(404).json({ error: 'Usuário não encontrado.' });

		// Ensure the user being updated belongs to the same school as the admin
		if (userToUpdate.school?.toString() !== requestingUser.school?.toString() && req.user.role != 'backoffice' )
			return res.status(403).json({ error: 'Sem permissão para atualizar usuários de outras escolas.' });

		// Validate email if it's being changed
		if (email && email !== userToUpdate.email) {
			const existingUser = await Users.findOne({ email, _id: { $ne: id } });
			if (existingUser)
				return res.status(400).json({ error: 'Email já está em uso.' });
		}

		// Validate documents if they're being changed
		if (documents) {
			if (documents.rg && documents.rg !== userToUpdate.documents?.rg) {
				const existingRG = await User.findOne({ 
					'documents.rg': documents.rg,
					_id: { $ne: id }
				});
				if (existingRG) return res.status(400).json({ error: 'RG já está cadastrado.' });
			}
			if (documents.cpf && documents.cpf !== userToUpdate.documents?.cpf) {
				const existingCPF = await User.findOne({ 
					'documents.cpf': documents.cpf,
					_id: { $ne: id }
				});
				if (existingCPF)
					return res.status(400).json({ error: 'CPF já está cadastrado.' });
			}
		}

		// Validate subRole if it's being changed
		if (subRole) {
			const validSubRoles = ['admin', 'staff', 'concierge'];
			if (!validSubRoles.includes(subRole))
				return res.status(400).json({ error: 'SubRole inválido.' });
		}

		// Prepare update object with only provided fields
		const updateFields = {};
		if (firstName) updateFields.firstName = firstName;
		if (lastName) updateFields.lastName = lastName;
		if (email) updateFields.email = email;
		if (documents) updateFields.documents = { ...userToUpdate.documents, ...documents };
		if (location) updateFields.location = { ...userToUpdate.location, ...location };
		if (contact) updateFields.contact = { ...userToUpdate.contact, ...contact };
		if (subRole) updateFields.subRole = subRole;

		// Update user
		const updatedUser = await Users.findByIdAndUpdate(
			id,
			{ $set: updateFields },
			{ new: true, runValidators: true }
		).populate('school');

		return res.status(200).json({
			message: 'Usuário atualizado com sucesso.',
			user: {
				id: updatedUser._id,
				firstName: updatedUser.firstName,
				lastName: updatedUser.lastName,
				email: updatedUser.email,
				role: updatedUser.role,
				subRole: updatedUser.subRole,
				documents: updatedUser.documents,
				location: updatedUser.location,
				contact: updatedUser.contact
			}
		});

	} catch (error) {
		console.error('Update user error:', error);
		return res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
	}

}

exports.resendUserActivation = async (req, res) => {
	try {
		logger.log(req.params);
		const { id } = req.params;
		const requestingUser = req.user;

		// Find the user
		const user = await Users.findById(id).populate('school');

		if (!user)
			return res.status(404).json({ error: 'Usuário nao encontrado.' });

		if (user.school?.toString() !== requestingUser.school?.toString() && requestingUser.role !== 'backoffice')
			return res.status(403).json({ error: 'Sem permissão para reenviar ativação para usuários de outras escolas.' });

		// Check if user is already active
		if (user.active && !user.validateHash.hash)
			return res.status(400).json({ error: 'Usuário já está ativo.' });

		// Generate new validation hash
		const validationHash = randomUUID();
		const expirationDate = new Date();
		expirationDate.setHours(expirationDate.getHours() + 24);

		// Update user with new validation hash
		user.validateHash = {
			hash: validationHash,
			hashExpiration: expirationDate
		};
		await user.save();

		// Send response immediately
		res.status(200).json({
			message: 'Email de ativação reenviado com sucesso',
			user: {
				id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email
			}
		});

		try {
			await sendValidateEmail(user, user.school, validationHash);
		} catch (error) {
			// Email error doesn't affect the response since we already sent success
			logger.error('Error sending activation email:', emailError);
		}

	} catch (error) {
		logger.error('Error resending activation:', error);
		res.status(500).json({
			error: 'Erro interno ao reenviar email de ativação'
		});
	}
}