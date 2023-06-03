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
const User = require('./models/user');
const Unit = require('./models/unit');

const app = express();

//Connecting to database:
mongoose.connect('mongodb://localhost:27017/stash-db', {
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
app.use(express.urlencoded({extended: true}));
//Allow us to override method types (can use PUT etc.):
app.use(methodOverride('_method'));
//Public folder:
app.use(express.static('public'));

//Configuring Session:
const sessionConfig = {
    secret: "thisshouldbeabettersecret!",
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

//TIMETABLE PAGES:
//GET Index page
app.get('/timetable', validateIsLoggedIn, catchAsync(async (req, res) => {
    const units = await Unit.find({userId: req.user.id, isAssigned: true});
    res.render('timetable/index', { units });
}))

//GET make new lesson page
app.get('/timetable/new', validateIsLoggedIn, async (req, res) => {
    const units = await Unit.find({userId: req.user.id});
    const existingTimings = units.map(unit => unit.timings);
    const existingTimingsList = [].concat(...existingTimings);
    res.render('timetable/new', { existingTimingsList });
})

//POST make new lessons
app.post('/timetable', validateIsLoggedIn, catchAsync(async (req, res) => {
    console.log("Adding new lesson(s)!");
    const newLessonBody = req.body.lesson;

    newLessonBody.userId = req.user.id;
    newLessonBody.type = "Lesson";
    newLessonBody.isAssigned = true;

    const newLesson = new Unit(newLessonBody);
    await newLesson.save();
    res.redirect(`/timetable`);
}))

//GET edit lesson page
app.get('/timetable/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lesson = await Unit.findById(req.params.id);
    const units = await Unit.find({userId: req.user.id});
    const existingTimings = units.filter(unit => unit._id != req.params.id).map(unit => unit.timings);
    const existingTimingsList = [].concat(...existingTimings);
    res.render('timetable/edit', { lesson, existingTimingsList });
}))

//PUT edit lesson
app.put('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    const edittedBody = { ...req.body.lesson };
    const lesson = await Unit.findByIdAndUpdate(id, edittedBody);
    res.redirect(`/timetable`);
}))

//DELETE lesson
app.delete('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    await Unit.findByIdAndDelete(id);
    res.redirect('/timetable');
}))


//WEEKLY TASK PAGES:
//GET weekly task page:
app.get('/weekly-tasks', catchAsync(async (req, res) => {
    const weeklyTasks = await Unit.find({userId: req.user.id, type: "WeeklyTask"});
    res.render('weekly-tasks', { weeklyTasks });
}))

//GET make new weekly task page
app.get('/weekly-tasks/new', validateIsLoggedIn, (req, res) => {
    res.render('weekly-tasks/new');
})

//POST make new weekly task
app.post('/weekly-tasks', validateIsLoggedIn, catchAsync(async (req, res) => {
    var newWeeklyTaskBody = req.body.weeklyTask;
    newWeeklyTaskBody.userId = req.user.id;
    newWeeklyTaskBody.type = "WeeklyTask";
    newWeeklyTaskBody.colour = "#696969";
    newWeeklyTaskBody.isAssigned = false;
    const newWeeklyTask = new Unit(newWeeklyTaskBody);
    await newWeeklyTask.save();
    res.redirect('/weekly-tasks');
}))

//GET edit weekly task page
app.get('/weekly-tasks/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const task = await Unit.findById(req.params.id);
    const units = await Unit.find({userId: req.user.id});
    const existingTimings = units.filter(unit => unit._id != req.params.id).map(unit => unit.timings);
    const existingTimingsList = [].concat(...existingTimings);
    res.render('weekly-tasks/edit', { task, existingTimingsList });
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
    const edittedBody = { ...req.body.task };
    edittedBody.isAssigned = req.body.task.isAssigned === 'true';
    if (!edittedBody.isAssigned) {
        edittedBody.timings = [];
    } else {
        let totalTime = 0;
        for (let timing of edittedBody.timings) {
            const timeDiff = calculateTimeDifference(timing.timingStart, timing.timingEnd);
            totalTime += timeDiff;
        }
        edittedBody.duration = totalTime;
    }
    const weeklyTask = await Unit.findByIdAndUpdate(id, edittedBody);
    res.redirect(`/timetable`);
}))


//HILL CLIMBING:
//Hill climbing function:
/*
async function hillclimb(assignedUnits, unassignedUnits) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    //GREEDY:
    let unassignedUnitsIndex = 0;

    let current_timings = [];
    for (let c = 0; c < 5; c++) {
        for (let r = 8; r < 18; r++) {
            if (unassignedUnitsIndex >= unassignedUnits.length) {
                break;
            }

            // Remove top task if finished:
            if (unassignedUnits[unassignedUnitsIndex].hasOwnProperty("timeLeft") && unassignedUnits[unassignedUnitsIndex].timeLeft == 0) {
                // Combine timings:
                const mergedTimings = [];
                let currentTiming = current_timings[0];
                for (let i = 1; i < current_timings.length; i++) {
                    const nextTiming = current_timings[i];
                    if (currentTiming.day == nextTiming.day && currentTiming.timingEnd == nextTiming.timingStart) {
                        currentTiming.timingEnd = nextTiming.timingEnd;
                    } else {
                        mergedTimings.push(currentTiming);
                        currentTiming = nextTiming;
                    }
                }
                mergedTimings.push(currentTiming)
                await Unit.findByIdAndUpdate(unassignedUnits[unassignedUnitsIndex]._id, { timings: mergedTimings, isAssigned: true });
                current_timings = [];
                unassignedUnitsIndex++;
            }

            // Finished assigning all unassigned units:
            if (unassignedUnitsIndex >= unassignedUnits.length) {
                break;
            }

            //Allocate tasks:
            var currentTask = unassignedUnits[unassignedUnitsIndex];
            if (assignedUnits.some(assignedUnit => assignedUnit.timings.some( timing => timing.day == days[c] && parseInt(timing.timingStart.substring(0, 2)) <= r && parseInt(timing.timingEnd.substring(0, 2)) > r))) {
                continue;
            } else {
                if (!currentTask.hasOwnProperty("timeLeft")) {
                    currentTask.timeLeft = currentTask.duration - 1;
                } else {
                    currentTask.timeLeft -= 1
                }
                current_timings.push({
                    day: days[c],
                    timingStart: (r.toString() + "00").padStart(4, "0"),
                    timingEnd: ((r + 1).toString() + "00").padStart(4, "0")
                })        
            }
        }
    }
}
*/

const hillclimb = require('./hillclimbing.js');
  

//GET calculate timetable:
app.get('/calculate', async (req, res) => {
    const assignedUnits = await Unit.find({userId: req.user.id, isAssigned: true});
    const unassignedUnits = await Unit.find({userId: req.user.id, isAssigned: false});
    if (unassignedUnits.length > 0) {
        const optimalSchedule = hillclimb(assignedUnits, unassignedUnits);
        if (optimalSchedule <= 0) {
            res.send(`
                <script>
                    alert('No way to assign tasks within deadlines!');
                    window.location.href = '/weekly-tasks';
                </script>
            `);
            return;
        }
        for (let unit of optimalSchedule) {
            if (!unit.isAssigned) {
                unit.isAssigned = true;
                await Unit.findByIdAndUpdate(unit._id, unit);
            }
        }
    } else {
        res.send(`
            <script>
                alert('You have no unassigned tasks!');
                window.location.href = '/weekly-tasks';
            </script>
        `);    
        return;
    }
})

//ACCOUNT PAGES:
//GET register page
app.get('/register', (req, res) => {
    res.render('authentication/register');
})

//POST register
app.post('/register', catchAsync(async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const newUser = new User({email, username});
        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, e => {
            if (e) return next(e);
            res.redirect('/timetable');
        })
    } catch(e) {
        console.log(e);
        res.redirect('/register');
    }
}))

//GET login page
app.get('/login', (req, res) => {
    const loginFailure = req.query.failure;
    res.render('authentication/login', { loginFailure });
})

//POST login
app.post('/login', passport.authenticate('local', { failureRedirect: '/login?failure=true' }), (req, res) => {
    res.redirect('/timetable');
})

//GET logout
app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/login');
    });
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


app.listen(3000, () => {
    console.log("LISTENING ON PORT 3000!");
})