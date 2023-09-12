const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejs_mate = require('ejs-mate');
const catchAsync = require('./utils/catchAsync');
const ExpressError = require('./utils/ExpressError');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoDBStore = require('connect-mongo');

const User = require('./models/user');
const Unit = require('./models/unit');
const Module = require('./models/module');

const app = express();

// CONFIG:
const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/stash-db"

//Connecting to database:
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "conection error:"));
db.once("open", () => {
    console.log("Database connected");
});

//Setting app engine to ejs mate:
app.engine('ejs', ejs_mate);

//Setting app to reference view folder:
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Ask express to help decode our req bodies:
app.use(express.urlencoded({ extended: true }));
//Allow us to override method types (can use PUT etc.):
app.use(methodOverride('_method'));
//Public folder:
app.use(express.static(__dirname + "/public/"));

//Configuring Session:
const secret = process.env.SECRET || 'thisshouldbeabettersecret!'
const store = MongoDBStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret: secret
    }
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e);
})

const sessionConfig = {
    store: store,
    secret: secret,
    resave: false,
    saveUninitialized: true
}
app.use(session(sessionConfig));

//Passport:
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//Locals:
app.use(async (req, res, next) => {
    // Allows all templates access to user:
    res.locals.user = req.user;
    next();
})

//Middleware for checking login:
const validateIsLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    next();
}


//LANDING PAGE:
app.get('/', (req, res) => {
    res.render('home');
})


//TIMETABLE:
function sortUnitsByTimings(objects) {
    return objects.sort((a, b) => {
        const timingA = a.timings.timingStart;
        const timingB = b.timings.timingStart;
        
        // Compare the timing start values
        if (timingA < timingB) {
            return -1;
        } else if (timingA > timingB) {
            return 1;
        } else {
            return 0;
        }
    });
}
//GET Index page with parameters
app.get('/timetable/:weekOrMonth/:period', validateIsLoggedIn, catchAsync(async (req, res) => {
    const weekOrMonth = req.params.weekOrMonth;
    const period = req.params.period;
    let formattedPeriod = period;

    if (weekOrMonth == "week" && period == "today") {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const options = { month: 'long', day: 'numeric', year: 'numeric' };
        const formattedMonday = monday.toLocaleDateString('en', options).replace(/\//g, '.');
        const formattedSunday = sunday.toLocaleDateString('en', options).replace(/\//g, '.');
        
        formattedPeriod = formattedMonday + " - " + formattedSunday;
    } else if (weekOrMonth == "month" && period == "today") {
        const today = new Date();
        const month = today.toLocaleString('default', { month: 'long' });
        const monthString = month.charAt(0).toUpperCase() + month.slice(1);
        const currentYear = new Date().getFullYear();
        formattedPeriod = monthString + " " + currentYear;
    }

    var modules = await Module.find({userId: req.user.id});
    var units = [];
    for (let module of modules) {
        var moduleUnits = await Unit.find({moduleId: module._id.toString()});
        for (let moduleUnit of moduleUnits) {
            units.push(moduleUnit);
        }
    }

    units = sortUnitsByTimings(units);
    res.render('timetable/index', { units, unitsString: JSON.stringify(units), weekOrMonth, formattedPeriod });
}))

//DELETE lesson
app.delete('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    await Unit.findByIdAndDelete(id);
    res.redirect('/timetable/week/today');
}))


//WEEKLY TASK:
const hillclimb = require('./hillclimbing.js').hillclimb;

//POST make new weekly task
app.post('/weekly-tasks', validateIsLoggedIn, catchAsync(async (req, res) => {
    // Create new weekly task unit:
    var newWeeklyTaskBody = req.body;
    newWeeklyTaskBody.userId = req.user.id;
    newWeeklyTaskBody.type = "WeeklyTask";
    newWeeklyTaskBody.colour = "#696969";
    newWeeklyTaskBody.isAssigned = false;
    const newWeeklyTask = new Unit(newWeeklyTaskBody);
    await newWeeklyTask.save();

    // Assign task:
    const assignedUnits = await Unit.find({userId: req.user.id, isAssigned: true});
    
    const optimalSchedule = hillclimb(assignedUnits, newWeeklyTask.toObject());
    // Not enough timeslots to finish before deadline
    if (optimalSchedule <= 0) {
        res.sendStatus(401);
        return;
    }

    for (let unit of optimalSchedule) {
        if (!unit.isAssigned) {
            unit.isAssigned = true;
            await Unit.findByIdAndUpdate(unit._id, unit);
        }
    }
    res.sendStatus(200);
}))

//Helper function to calculate time between:
function calculateTimeDifference(timingStart, timingEnd) {
    const startTime = parseInt(timingStart);
    const endTime = parseInt(timingEnd);
    
    const diffHours = Math.abs(endTime - startTime) / 100;
    
    return diffHours;
}

//PUT edit weekly task
app.put('/weekly-tasks/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    const edittedBody = req.body;
    edittedBody.timings = JSON.parse(edittedBody.timings);

    let totalTime = 0;
    for (let timing of edittedBody.timings) {
        const timeDiff = calculateTimeDifference(timing.timingStart, timing.timingEnd);
        totalTime += timeDiff;
    }
    edittedBody.duration = totalTime;
    await Unit.findByIdAndUpdate(id, { $set: edittedBody });
    res.redirect('/timetable/week/today');
}))


// ASSIGNMENT
//Hillclimbing function for Assignment
const hillclimbAssignment = require('./hillclimbing.js').hillclimbAssignment;

// POST make new assignment:
app.post('/assignments', validateIsLoggedIn, (async (req, res) => {
    // Create new assignment unit:
    var newAssignmentBody = req.body;
    newAssignmentBody.userId = req.user.id;
    newAssignmentBody.type = "Assignment";
    newAssignmentBody.colour = "#696969";
    newAssignmentBody.isAssigned = false;
    const newAssignment = new Unit(newAssignmentBody);
    await newAssignment.save();

    // Assign task:
    const assignedUnits = await Unit.find({userId: req.user.id, isAssigned: true});
    newAssignmentBody._id = newAssignment.toObject()._id;
    const optimalSchedule = hillclimbAssignment(assignedUnits, newAssignmentBody);

    // Not enough timeslots to finish before deadline
    if (optimalSchedule <= 0) {
        res.sendStatus(401);
        return;
    }

    for (let unit of optimalSchedule) {
        if (!unit.isAssigned) {
            unit.isAssigned = true;
            await Unit.findByIdAndUpdate(unit._id.toString(), unit);
        }
    }
    res.sendStatus(200);
}))

//PUT edit assignment
app.put('/assignments/:id', validateIsLoggedIn, (async (req, res) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const { id } = req.params;
    const edittedBody = req.body;
    edittedBody.timings = JSON.parse(edittedBody.timings);
    for (let timing of edittedBody.timings) {
        timing.day = days[new Date(timing.date).getDay()];
    }
    await Unit.findByIdAndUpdate(id, { $set: edittedBody });
    res.redirect('/timetable/week/today');
}))

//POST nusmods import
app.post('/nus-mods', validateIsLoggedIn, catchAsync(async (req, res) => {
    // Delete all existing modules first:
    await Module.deleteMany({userId: {$regex: req.user.id}});
    await Unit.deleteMany({userId: {$regex: req.user.id}});
    const colourMapping = [
        {'LEC': '#F1767A', 'REC': '#DE6569', 'LAB': '#DE6569', 'TUT': '#DE6569', 'SEC': '#DE6569'}, // Red
        {'LEC': '#F99256', 'REC': '#E9874E', 'LAB': '#E9874E', 'TUT': '#E9874E', 'SEC': '#E9874E'}, // Orange
        {'LEC': '#FECC67', 'REC': '#F6C665', 'LAB': '#F6C665', 'TUT': '#F6C665', 'SEC': '#F6C665'}, // Yellow
        {'LEC': '#99CC98', 'REC': '#85B984', 'LAB': '#85B984', 'TUT': '#85B984', 'SEC': '#85B984'}, // Green
        {'LEC': '#65CDCC', 'REC': '#5EC0BF', 'LAB': '#5EC0BF', 'TUT': '#5EC0BF', 'SEC': '#5EC0BF'}, // Turqoise
        {'LEC': '#6499CC', 'REC': '#5B8DBD', 'LAB': '#5B8DBD', 'TUT': '#5B8DBD', 'SEC': '#5B8DBD'}, // Blue
        {'LEC': '#CC99CD', 'REC': '#B887B9', 'LAB': '#B887B9', 'TUT': '#B887B9', 'SEC': '#B887B9'}, // Purple
        {'LEC': '#D27B53', 'REC': '#C2724D', 'LAB': '#C2724D', 'TUT': '#C2724D', 'SEC': '#C2724D'} // Brown

    ];
    let counter = 0;
    // Add new modules:
    const body = JSON.parse(req.body.newModules);
    for (let newModuleBody of body) {
       const moduleCode = newModuleBody.code;

       const newModule = new Module({
           userId: req.user.id,
           code: moduleCode
       });
       await newModule.save();
       const moduleId = newModule._id;

       const moduleUnits = newModuleBody.units;
       for (let moduleUnitBody of moduleUnits) {
            const newUnit = new Unit({
                userId: req.user.id,
                moduleCode: moduleCode,
                moduleId: moduleId,
                class: moduleUnitBody.class,
                type: moduleUnitBody.type,
                timings: moduleUnitBody.timings,
                colour: colourMapping[counter][moduleUnitBody.type]
            })
            newUnit.save();
       }

       counter++;
       if (counter >= colourMapping.length) {
           counter = 0;
       }
   }
    
    res.sendStatus(200);
}))

const optimise = require('./hillclimbing.js').optimise;

//Hillclimbing POST request:
app.post('/optimise', (req, res) => {
    const { units, hours } = req.body;
    console.log('UNITS: ');
    console.log(JSON.parse(units));
    console.log('HOURS: ');
    console.log(JSON.parse(hours));

    optimise(units, hours);

    res.redirect('/timetable/week/today');
})

//ACCOUNT PAGES:
//GET register page
app.get('/register', (req, res) => {
    if (req.user) {
      res.redirect('/timetable/week/today');
    } else {
      res.render('authentication/register', { registrationFailure: false });
    }
});

// POST register
app.post('/register', async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const time = new Date();
      const user = new User({ email, time, username });
      await User.register(user, password);
  
      // Automatically authenticate the user after successful registration
      passport.authenticate('local')(req, res, () => {
        res.redirect('/timetable/week/today');
      });
    } catch (err) {
      console.log(err);
      res.render('authentication/register', { registrationFailure: true });
    }
});

//GET login page
app.get('/login', (req, res) => {
    if (req.user) {
        res.redirect('/timetable/week/today');
    } else {
        const loginFailure = req.query.failure;
        res.render('authentication/login', { loginFailure });
    }

})

//POST login
app.post('/login', passport.authenticate('local', { failureRedirect: '/login?failure=true' }), (req, res) => {
    res.redirect('/timetable/week/today');
})

//GET logout
app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/login');
    });
}); 

//GET profile page
app.get('/profile', (req, res) => {
    res.render('timetable/profile');
})

//POST change password
app.post('/change-password', (req, res) => {
    // Ensure the user is authenticated
    if (!req.isAuthenticated()) {
      res.status(401).send('Unauthorized');
      return;
    }
  
    try {
      // Get the current user
      const user = req.user;
  
      // Get the new password from the request body
      const newPassword = req.body.newPassword;
  
      // Change the password using the Passport `setPassword` method
      user.setPassword(newPassword, async () => {
        // Save the updated user with the new password
        await user.save();
  
        res.send('Password changed successfully');
      });
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal Server Error');
    }
});


//No matching path
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404));
})

//Error handler
app.use((err, req, res, next) => {
    const { statusCode = 500} = err;
    if (!err.message) err.message = "Oh no! Something went wrong!";
    res.status(statusCode).render('errors/error', { err});
})

const PORT = process.env.PORT | 8080
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

module.exports = app;