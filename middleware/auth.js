const jwt = require('jsonwebtoken');
const Users = require('../api/users/users.model');
const { logger } = require('../helpers/index');

// Middleware to verify token
exports.verifyToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	if (!authHeader) return res.status(403).send({ message: 'No token provided.' });
	
	const token = authHeader.split(' ')[1];

	if (!token) return res.status(401).json({ error: 'Token inválido' });

	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		if (err) return res.status(500).send({ message: 'Failed to authenticate token.' });
		req.user = decoded;
		next();
	});
};

// Middleware to check for roles
exports.authorizeRoles = (...allowedRoles) => {
	return async (req, res, next) => {
		try {
			logger.log(req.user);
			logger.log(allowedRoles);
			const userRole = req.user.role;
			const hasPermission = allowedRoles.includes(userRole);

			if (!hasPermission) return res.status(403).send({ message: 'Role not authorized.' });

			return next();

		} catch (error) {
			logger.error(error);
			return res.status(500).send({ error: error.message });
		}
	};
};

exports.authorizeSubRoles = (...allowedRoles) => {
	return async (req, res, next) => {
		try {
			const userRole = req.user.subRole;
			const hasPermission = allowedRoles.includes(userRole);

			if (!hasPermission) return res.status(403).send({ message: 'Sub Role not authorized.' });

			return next();

		} catch (error) {
			logger.error(error);
			return res.status(500).send({ error: error.message });
		}
	};
};
