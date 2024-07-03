const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.query;
    if(!username || !password){
        return res.status(400).send('Both username and password are required for registering.');
    }
    db.query('SELECT * FROM tbl_38_users WHERE username = ?', [username], async (err, results) => {
      if (err) return next(err);
      if (results.length > 0) {
        return res.status(400).send('Username already exists');
      }
      const accessCode = uuidv4();
      db.query('INSERT INTO tbl_38_users (username, password, access_code) VALUES (?, ?, ?)', [username, password, accessCode], (err, results) => {
        if (err) return next(err);
        res.status(201).send({ accessCode });
      });
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.query;
    db.query('SELECT * FROM tbl_38_users WHERE username = ?', [username], async (err, results) => {
      if (err) return next(err);
      if (results.length === 0 || !(password == results[0].password)) {
        return res.status(400).send('Invalid username or password');
      }
      res.status(200).send({ accessCode: results[0].access_code });
    });
  } catch (error) {
    next(error);
  }
};