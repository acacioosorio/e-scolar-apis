// Users Controller
// ./api/users/users.controller.js

const User = require('./users.model')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
exports.index = (req, res, next) => {
	res.send("GET Response from api/users/ ")
};

exports.teste = (req, res, next) => {
	console.log(req.user);
	res.send("GET Response from api/users/teste [Security]")
};

exports.me = async (req, res) => {

	const id = req.user._id;

	try {
		const user = await User.findById(id).select('-validateHash -roles -password -messages');
		res.status(200).send({ user });
	} catch (error) {
		console.log(error)
		res.status(500).send({ error: error });
	}

};

exports.signup = async (req, res) => {
	console.log(req.body)
	try {
		req.body.roles = ["Parent"]
		const user = new User(req.body);
		const savedUser = await user.save();
		res.status(201).send({ message: 'User created', user: savedUser });
	} catch (error) {
		console.log(error)
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
		console.log(error)
		res.status(500).send({ error: error });
	}
};