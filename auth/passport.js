const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const mongoose = require('mongoose');
const Users = require('../api/users/users.model');

const options = {};
options.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
options.secretOrKey = process.env.SESSION_SECRET;

module.exports = (passport) => {

	passport.use('jwt-user', new JwtStrategy(options, (jwt_payload, done) => {
		Users.findById(jwt_payload.id)
			.then(user => {
				if (user) return done(null, user);
				return done(null, false);
			})
			.catch(err => console.error(err));
	}));

};
