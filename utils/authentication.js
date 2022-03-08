const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const axios = require('axios');

const createToken = (user) => {
  // Sign the JWT

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: config.jwt.expiry }
  );
};

const hashPassword = (password) => {
  var length = password.length;
  return new Promise((resolve, reject) => {
    // Generate a salt at level 12 strength
    bcrypt.genSalt(length, (err, salt) => {
      if (err) {
        reject(err);
      }
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) {
          reject(err);
        }
        resolve(hash);
      });
    });
  });
};

const verifyPassword = (passwordAttempt, hashedPassword) => {
  return bcrypt.compare(passwordAttempt, hashedPassword);
};


module.exports = {
  createToken,
  hashPassword,
  verifyPassword
};
