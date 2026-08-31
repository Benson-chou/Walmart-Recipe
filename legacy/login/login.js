const express = require('express');
const path = require('path');
const router = express.Router();
const mysql = require('mysql2/promise');
const flash = require('connect-flash')
const {Connector} = require('@google-cloud/cloud-sql-connector');
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const credentials64 = process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log(credentials64);
if (credentials64) {
    const path = '/tmp/credentials.json'
    const credentials = JSON.parse(
        Buffer.from(credentials64, 'base64').toString('utf8')
    );
    fs.writeFileSync(path, JSON.stringify(credentials), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
    const auth = new GoogleAuth({
        keyFile: path,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  } else {
    console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  }

const connector = new Connector();
const clientOpts = connector.getOptions({
    instanceConnectionName: process.env.CLOUD_CONNECTION_NAME,
    ipType: 'PUBLIC',
  });

  const pool = mysql.createPool({
    ...clientOpts,
    host: process.env.CLOUD_HOST,
    user: process.env.CLOUD_USER,
    password: process.env.CLOUD_PASSWORD,
    database: process.env.CLOUD_DB_NAME,
});

router.use(flash())

// http://localhost:3000/login
router.get('/', function(request, response){
    // Render login template
    response.render(path.join(__dirname + '/login.ejs'), { message : request.flash('message')});
});

// Get the loginForm informations
router.post('/', async (req, res) => {
    const { username, password } = req.body;

    try {
        const connection = await pool.getConnection();
        const [results] = await connection.query('SELECT * FROM user WHERE username = ? AND password = ?', [username, password]);
        if (results.length > 0) {
            req.session.user = results[0];
            req.session.username = username;
            // Needs to be set before redirect to save session info
            req.session.loggedin = true;
            res.redirect('/home');
        } else {
            req.flash('message', 'Incorrect Username and/or Password')
            res.redirect('/login');
        } connection.release();
        }
    catch (error) {
        console.error('Error logging in:', error);
        req.flash('message', 'Failed to login user. Please try again.');
        res.redirect('/login');
    }
});


module.exports = router;