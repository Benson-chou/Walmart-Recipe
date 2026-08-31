const {Connector} = require('@google-cloud/cloud-sql-connector');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require("dotenv");
dotenv.config();

const express = require('express');
const path = require('path');
const router = express.Router();
const mysql = require('mysql2/promise');
const flash = require('connect-flash');
const { spawn } = require('child_process');
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

const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// http://localhost:3000/home
router.get('/', async (request, response) => {
    try{
        const connection = await pool.getConnection();
        const clearquery = 'TRUNCATE TABLE items'
        await connection.query(clearquery);

        let userLocation;
        if (request.session.user !== undefined) {
            userLocation = request.session.user.preferred_location || "m5b1r7";
        } else {
            userLocation = request.session.postal || "m5b1r7";
        }
        const python = spawn("/usr/bin/python3", [__dirname + '/../scrape_items.py', userLocation]);

        python.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                response.status(500).send('Internal Server Error');
                return;
            }

            const getquery = 'SELECT * FROM items'
            const [db_items] = await connection.query(getquery);
                if (db_items.length > 0){
                    request.session.items = db_items;
                }

            if (request.session.loggedin) {
                // Case 1: user got to home page from *LOGIN PAGE*: request.session.user contains all user info
                // Case 2: user got to home page from *SIGN UP PAGE*: request.session.allergies contains allergies 
                // (there is no request.session.user because this object is the result returned from a database query, which we do not have when user signs up and we write into the database only. We can create the user object but since there is only 3 things to pass to home page, I decided that saving to a var is faster.)
                let userAllergies = request.session.user !== undefined ? request.session.user.allergies : (request.session.allergies !== "" ? request.session.allergies : null);
                let userLocationPass;
                if (request.session.user !== undefined) {
                    userLocationPass = request.session.user.preferred_location || "m5b1r7 (default)";
                } else {
                    userLocationPass = request.session.postal || "m5b1r7 (default)";
                }
                response.render(path.join(__dirname + '/home.ejs'), {location: userLocationPass, items : request.session.items, 
                    allergies: userAllergies, loggedin: true, username: request.session.username, item_message : request.flash('item_message'), recipes : {}});
        
            } else {
                // Not logged in
                response.render(path.join(__dirname + '/home.ejs'), {location: "m5b1r7 (default)", items : request.session.items, 
                    allergies: "None", loggedin: false, item_message : request.flash('item_message'), recipes : {}});
            }
        });
    } 
        catch (error) {
            console.error('Error loading home page (loading items): ', error);
            // Not sure what to do here
        }
        
    })

 
// Get the location informations
// router.post('/location', (req, res) => {
//     const location = req.body;
// })

router.post('/', (req, res) => {
    if (req.body.itemCheckbox === undefined){
        req.flash('item_message', 'Please select at least one item')
        res.redirect('/home')
        // flash a message saying please pick at least one item
        return;
    }
    
    // Need to change the arguments to `${req.body.itemCheckbox}`, `${req.body.itemPrice}` (hopefully)
    const python = spawn('python3', [__dirname + '/../optimization.py', "['apple', 'banana', 'candy', 'bread']", "[3.99, 4.00, 5.99, 6.99]", req.body.budget]);
    
    // This part is being skipped somehow
    python.stdout.on('data', (data) => {
        dataToSend = data.toString();
    });
    python.on('close', (code) => {
        console.log(`child process close all stdio with code: ${code}`);
    })

    const geminiConfig = {
    temperature: req.body.creativity / 10,
    maxOutputTokens: 4096,
    };

    const geminiModel = googleAI.getGenerativeModel({
        model: "gemini-1.5-pro", 
        geminiConfig
    });

    const generate = async () => {
        try {
            // Will send the dataToSend from optimization script to send in instead of itemCheckbox
            const prompt = `Can you recommend 1-3 different recipes using\
        ${req.body.itemCheckbox} with a budget of ${req.body.budget} and \
        avoid these allergies: ${req.body.allergies}. You do not have to include every ingredient I requested in every recipe. Use the ones you find suitable.\
        Please also include other ingredients needed in the recipe. Make sure to label each step of the instructions with 1., 2., 3., etc.\ 
        Please output only the json form of Recipe_name, Ingredients, and Instructions. Ingredients and Intructions should both be one long string with each item separated by a new line character. 
        Please do not separate them with commas.
        ex: [{
        "Recipe_name": "One Pot Cheeseburger Pasta",
        "Ingredients": "1 lb ground beef
            1 lb Italian sausage (remove casing if desired)
            1 onion, chopped
            1 green bell pepper, chopped
            1 (14.5 oz) can diced tomatoes, undrained
            1 (15 oz) can kidney beans, drained & rinsed
            1/2 cup beef broth
            1 tsp dried oregano
            1/2 tsp salt
            1/4 tsp black pepper
            1 head romaine lettuce, chopped
            1/4 cup shredded cheddar cheese (optional)",
        "Instructions": "1. Brown the ground beef and sausage in a large skillet over medium heat. Drain off any excess fat.
        2. Add the onion and green pepper and cook until softened, about 5 minutes.
        3. Stir in diced tomatoes, kidney beans, beef broth, oregano, salt, and pepper. Bring to a boil, then reduce heat and simmer for 15 minutes, or until flavors meld.
        4. Serve hot over a bed of chopped romaine lettuce and top with shredded cheddar cheese (optional)."
        }]. \
        (Please use the exact header as defined, 
        do not include any other text, and don't start a new recipe if there are not enough tokens)`;
            const result = await geminiModel.generateContent(prompt);
            var responses = result.response.text();
            responses = responses.replace("```json", "");
            responses = responses.replace("```", "");
            const recipes = JSON.parse(responses);
            console.log(recipes);
            console.log(recipes.length)
            // Make sure recipes is not empty
            if (recipes.length === 0){
                req.flash('item_message', 'No recipes were generated. Please try again!')
                res.redirect('/home')
                return;
            } 
            let userAllergies = req.session.allergies ? req.session.allergies : 'None';

            // This part's location needs fix
            res.render(path.join(__dirname + '/home.ejs'), {location: '', items : req.session.items, 
                allergies: userAllergies, loggedin: req.session.loggedin, username: req.session.username, 
                item_message : req.flash('item_message'), recipes : recipes});
    
        }catch (error){
            console.log("response error", error);
        }
    }
    generate()
    return;
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