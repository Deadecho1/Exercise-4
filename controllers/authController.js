const { v4: uuidv4 } = require('uuid');
const pool = require('../models/db');

exports.register = async (req, res, next) => {
    try{
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send('Both username and password are required for registering.');
        }

        const connection = await pool.getConnection();
        try{
            const [userResults] = await connection.query('SELECT * FROM tbl_38_users WHERE username = ?', [username]);
            if (userResults.length > 0) {
              return res.status(400).send('Username already exists');
            }

            const accessCode = uuidv4();
            await connection.query('INSERT INTO tbl_38_users (username, password, access_code) VALUES (?, ?, ?)', [username, password, accessCode]);
            res.status(201).send({ accessCode });
        }
        finally{
            connection.release();
        }
      } 
    catch (error){
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        const connection = await pool.getConnection();
        try {
          const [userResults] = await connection.query('SELECT * FROM tbl_38_users WHERE username = ?', [username]);
          console.log(username);
          if (userResults.length === 0){
              return res.status(400).send('Invalid username');
          }
          else if (!(password == userResults[0].password)) {
              return res.status(400).send('Invalid password');
          }
          res.status(200).send({ accessCode: userResults[0].access_code });
        }
        finally{
            connection.release();
        }
    } 
    catch (error){
        next(error);
    }
};