const express = require('express');
const session = require('express-session');
const path = require('path');
const store = new session.MemoryStore();

const app = express();
const port = process.env.PORT;

const loginRoute = require('./login/login');
const signupRoute = require('./signup/signup');
const homeRoute = require('./home/home');
const userRoute = require('./user/user');

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(express.static(path.join(__dirname, 'static')));

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: "secret",
    store: store
}));

app.use("/login", loginRoute);
app.use("/signup", signupRoute);
app.use("/home", homeRoute);
app.use("/user", userRoute);

app.get('/',function (req, res) {
    res.redirect('/home');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
})