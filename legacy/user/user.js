const express = require('express');
const path = require('path');
const router = express.Router();
const mysql = require('mysql2/promise');
const flash = require('connect-flash')
const {Connector} = require('@google-cloud/cloud-sql-connector');
const dotenv = require('dotenv');
const { connect } = require('http2');
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

// http://localhost:3000/user
router.get('/', async(request, response) => {
	// Render login template
    // Need loggedin, location, allergies, recipes, 
    // updateFail, updateSuccess
    if (request.session.loggedin) {
        // pull the user saved recipes from database
        try{
            const connection = await pool.getConnection();
            const savedRecipeQuery = "SELECT r.recipe_name AS Recipe_name, r.ingredients AS Ingredients, r.description AS Instructions\
                                    FROM recipes AS r INNER JOIN saved AS s\
                                    ON r.recipe_id = s.recipe_id\
                                    INNER JOIN user AS u\
                                    ON s.username = u.username\
                                    WHERE u.username = ?"
            var [savedRecipesResults] = await connection.query(savedRecipeQuery, [request.session.username])
            if (savedRecipesResults.length === 0) {
                savedRecipesResults = null
            }
        } catch (error){
            console.error('Error querying saved recipes: ', error);
            request.flash('updateFail', 'Failed to query saved recipes. Please try again.');
            response.redirect('/user');
        }

        let userLocation, userAllergies;
        if (request.session.user !== undefined) {
            userLocation = request.session.user.preferred_location;
            userAllergies = request.session.user.allergies;
        } else {
            userLocation = request.session.postal;
            userAllergies = request.session.allergies;
        }

        response.render(path.join(__dirname + '/user.ejs'), {username: request.session.username, loggedin: request.session.loggedin, location: userLocation, 
            allergies: userAllergies, recipes: savedRecipesResults, updateFail : request.flash('updateFail'), 
            updateSuccess : request.flash('updateSuccess')
        })
    } else {
        response.render(path.join(__dirname + '/user.ejs'), {username: "Guest", loggedin: request.session.loggedin, location: "m5b1r7", 
            allergies: "None", recipes: null, updateFail : request.flash('updateFail'), 
            updateSuccess : request.flash('updateSuccess')
        })
    }
});

router.post('/location', async(req, res) => {
    try{
        const { location } = req.body;
        let cleanPostal = location.toLowerCase().replace(/\s+/g, '');
        if (req.session.loggedin) {
            req.session.postal = cleanPostal
            // Update the user data in database
            const connection = await pool.getConnection();
            const [results] = await connection.query('UPDATE user SET preferred_location = ? WHERE username = ?', [cleanPostal, req.session.username]);
            console.log('Finished updating location: ', results);
            connection.release()
        } else {
            req.session.postal = cleanPostal
        }
        req.flash('updateSuccess', 'Successfully updated location!');
        res.redirect('/user');
    }
    catch (error) {
        console.error('Error updating location: ', error);
        req.flash('updateFail', 'Failed to update location. Please try again.');
        res.redirect('/user');
    }
})

router.post('/allergies', async(req, res) => {
    try{
        const {allergies} = req.body;
        if (req.session.loggedin) {
            req.session.allergies = allergies
            // Update the user data in database
            const connection = await pool.getConnection();
            const [results] = await connection.query('UPDATE user SET allergies = ? WHERE username = ?', [allergies, req.session.username]);
            console.log('Finished updating allergies: ', results);
            connection.release();
        } else {
            req.session.allergies = allergies
        }
        req.flash('updateSuccess', 'Successfully updated allergies!');
        res.redirect('/user');
    }
    catch (error) {
        console.error('Error updating allergies: ', error);
        req.flash('updateFail', 'Failed to update allergies. Please try again.');
        res.redirect('/user');
    }
})
// TO-DO: This part haven't worked on yet
router.post('/changePassword', async(req, res) => {
    try{
        const {oldPassword, newPassword, twonewPassword} = req.body;
        const checkOldQuery = "SELECT * FROM user WHERE username = ? AND password = ?"
        const updatePassQuery = "UPDATE user SET password = ? WHERE username = ?"
        // Check if the oldPassword matches. If it doesn't, then return immediately and alert message
        const connection = await pool.getConnection();
        const [checkOldResults] = await connection.query(checkOldQuery, [req.session.username, oldPassword])
        if (checkOldResults.length === 0) {
            req.flash('updateFail', 'Old Password Incorrect! Please retry');
            res.redirect('/user');
            return;
        }
        // Then can prob just run the query to update the table value
        await connection.query(updatePassQuery, [newPassword, req.session.username])
        console.log("Successfully updated password")
        req.flash('updateSuccess', 'Successfully updated password!');
        res.redirect('/user');
    }
    catch (error) {
        console.error('Error updating password: ', error);
        req.flash('updateFail', 'Failed to update password. Please try again.');
        res.redirect('/user');
    }
})

router.post('/save', async (req, res) => {
    const { recipe_name, recipe_ingredients, recipe_description, username } = req.body;
    const savequery = "INSERT IGNORE INTO `recipes` (`recipe_name`, `ingredients`, `description`) VALUES (?, ?, ?)"
    
    try {
        const connection = await pool.getConnection();
        const [results] = await connection.query(savequery, [recipe_name, recipe_ingredients, recipe_description])

        console.log(`Successfully saved recipe: ${recipe_name}`)
        const retrieverecipequery = "SELECT recipe_id FROM recipes WHERE recipe_name = ?"
        const storequery = "INSERT IGNORE INTO `saved` (`recipe_id`, `username`) VALUES (?, ?)"

        const [recipe_result] = await connection.query(retrieverecipequery, recipe_name)
        await connection.query(storequery, [recipe_result[0]['recipe_id'], username])
        return res.status(200).json({ message: 'Recipe saved successfully' });
    }
    catch (error) {
        console.log(error)
        console.log('Failed to save recipe')
        return res.status(500).json({message: 'Server Error'});
    }
});

router.post('/delete', async (req, res) => {
    const { recipe_name, username } = req.body;
    const get_id_query = "SELECT recipe_id FROM recipes WHERE recipe_name = ?"
    const delete_saved_query = "DELETE FROM `saved` WHERE recipe_id = ? AND username = ?"
    const checksaved_query = "SELECT * FROM `saved` WHERE recipe_id = ?"
    const deletequery = "DELETE FROM `recipes` WHERE recipe_id = ?"
    try {
        const connection = await pool.getConnection();

        // Get the recipe_id and delete from 'saved' table
        const [get_id_results] = await connection.query(get_id_query, [recipe_name])
        var recipe_id = get_id_results[0]['recipe_id']
        await connection.query(delete_saved_query, [recipe_id, username])
        // Run a query checking if recipe_id is still in 'saved'
        const [checkresults] = await connection.query(checksaved_query, [recipe_id])
        if (checkresults.length === 0) {
            // If result is empty, then we run delete_query 
            await connection.query(deletequery, [recipe_id])
        }
        console.log(`Successfully unsaved recipe: ${recipe_name}`)
        res.status(200).json({ message: 'Recipe deleted successfully'});
    }
    catch (error) {
        console.log(error)
        console.log('Failed to unsave recipe')
        return res.status(500).json({ message: 'Server Error'});
    }
})


module.exports = router;