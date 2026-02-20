const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const dotenv = require('dotenv');

// Import Models
const Sos = require('./models/sos'); 
const User = require('./models/user'); 

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. Database Connection ---
const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tinkerhack';
mongoose.connect(dbURI)
    .then(() => console.log('🚀 MongoDB Connected Successfully'))
    .catch(err => console.error('❌ DB Error:', err));

// --- 2. Middleware ---
app.set('view engine', 'ejs');
app.use(express.static('public')); // Serves your CSS/JS files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Essential for receiving GPS data via JSON/Fetch

// --- 3. Session Configuration ---
app.use(session({
    secret: 'tinker_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // 1 Day
        secure: false // Set to true if using HTTPS
    } 
}));

// --- 4. Routes ---

/**
 * GATEKEEPER: Directs users based on login status
 */
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/sos');
    res.redirect('/register');
});

/**
 * REGISTRATION: Render the page you built
 */
app.get('/register', (req, res) => {
    res.render('register'); 
});

/**
 * REGISTRATION POST: Receives data from the form
 */
app.post('/register', async (req, res) => {
    try {
        // req.body contains { name, phone, address, password }
        // Ensure your User model has these exact fields
        const newUser = await User.create(req.body);
        req.session.userId = newUser._id;
        
        console.log(`✅ New User Registered: ${newUser.name}`);
        res.redirect('/sos');
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).send("Registration Error: " + err.message);
    }
});

/**
 * SOS DASHBOARD: The main interface with the Panic Button
 */
app.get('/sos', async (req, res) => {
    if (!req.session.userId) return res.redirect('/register');
    
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/logout');
        res.render('index', { user }); // Renders index.ejs
    } catch (err) {
        res.redirect('/register');
    }
});

// --- 5. SOS Logic with Timer ---
const activeTimers = {};

/**
 * TRIGGER SOS: Starts the 30-second countdown
 */
app.post('/trigger-sos', async (req, res) => {
    const { lat, lng } = req.body;
    if (!req.session.userId) return res.status(401).send("Unauthorized");

    try {
        const user = await User.findById(req.session.userId);
        
        // Create an SOS record in 'pending' status
        const newSos = await Sos.create({
            userId: user._id,
            userName: user.name,
            userPhone: user.phone,
            location: { lat, lng },
            pin: user.password, // Comparing against the stored SOS PIN
            status: 'pending'
        });

        // Start 30-second timer
        activeTimers[newSos._id] = setTimeout(async () => {
            const currentSos = await Sos.findById(newSos._id);
            if (currentSos && currentSos.status === 'pending') {
                await Sos.findByIdAndUpdate(newSos._id, { status: 'sent' });
                console.log(`🚨 ALERT ACTIVATED: Police notified for ${user.name}`);
            }
        }, 30000); 

        // Redirect to a cancellation screen where they can enter PIN
        res.render('cancel', { sosId: newSos._id, error: null });
    } catch (err) { 
        console.error(err);
        res.redirect('/sos'); 
    }
});

/**
 * VERIFY PIN: Stops the timer if PIN is correct
 */
app.post('/verify-pin', async (req, res) => {
    const { sosId, userPin } = req.body;
    
    try {
        const currentSos = await Sos.findById(sosId);
        
        if (currentSos && currentSos.pin === userPin) {
            // STOP THE TIMER
            clearTimeout(activeTimers[sosId]);
            delete activeTimers[sosId];

            await Sos.findByIdAndUpdate(sosId, { status: 'cancelled' });
            res.render('end', { message: "Alert Cancelled Successfully. You are safe." });
        } else {
            // Wrong PIN: Re-render cancel page with error
            res.render('cancel', { sosId, error: "Incorrect PIN! Try again." });
        }
    } catch (err) {
        res.redirect('/sos');
    }
});

/**
 * POLICE VIEW: Shows all 'sent' alerts
 */
app.get('/police-station', async (req, res) => {
    try {
        const alerts = await Sos.find({ status: 'sent' }).sort({ createdAt: -1 });
        res.render('police', { alerts });
    } catch (err) {
        res.status(500).send("Error fetching alerts");
    }
});

/**
 * LOGOUT
 */
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/register');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT}`);
});