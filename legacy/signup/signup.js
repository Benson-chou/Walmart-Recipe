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

// http://localhost:3000/signup
router.get('/', function(request, response) {
	// Render login template
	response.render(path.join(__dirname + '/signup.ejs'), { message: request.flash('message')});
});


router.post('/', async (req, res) => {
    const { username, password, postalCode, allergies } = req.body;
    try {
        const connection = await pool.getConnection();
        const [results] = await connection.query('SELECT * FROM user WHERE username = ?', [username]);

        if (results.length > 0) {
            // Need to output the following message
            req.flash('message', 'This username is taken. Please insert another username')
            res.redirect('/signup')
        } else {
            // Need to strip white space, change into lower case, make sure it is a valid postal code before we save to database
            let cleanPostal = postalCode.toLowerCase().replace(/\s+/g, '');
            connection.query('INSERT IGNORE INTO `user` (`username`, `password`, `preferred_location`, `allergies`) VALUES (?, ?, ?, ?)',
            [username, password, cleanPostal, allergies]);
            req.session.username = username;
            req.session.loggedin = true;
            req.session.random = "happy happy"; //interesting, can only access username and loggedin in home.ejs? the rest comes back as not defined
            req.session.allergies = allergies;
            req.session.postal = cleanPostal;
            res.redirect('/home');
        } connection.release();
    }
    catch (error) {
        console.error('Error registering user:', error);
        req.flash('message', 'Failed to register user. Please try again.');
        res.redirect('/signup'); 
    }
} 
);

module.exports = router;