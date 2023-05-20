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


//Home Index page:
app.get('/', (req, res) => {
    res.render('home');
})


//GET Index page
app.get('/timetable', validateIsLoggedIn, catchAsync(async (req, res) => {
    const units = await Unit.find({userId: req.user.id, isAssigned: true});
    res.render('timetable/index', { units });
}))

//GET make new lesson page
app.get('/timetable/new', validateIsLoggedIn, (req, res) => {
    res.render('timetable/new');
})

function doLessonsOverlap(lesson1StartString, lesson1EndString, lesson2StartString, lesson2EndString) {
    const lesson1Start = parseInt(lesson1StartString);
    const lesson1End = parseInt(lesson1EndString);
    const lesson2Start = parseInt(lesson2StartString);
    const lesson2End = parseInt(lesson2EndString);

    // Check if the start time of lesson1 falls within the duration of lesson2
    if (lesson1Start >= lesson2Start && lesson1Start < lesson2End) {
      return true;
    }
  
    // Check if the end time of lesson1 falls within the duration of lesson2
    if (lesson1End > lesson2Start && lesson1End <= lesson2End) {
      return true;
    }
  
    // Check if the duration of lesson1 completely overlaps with the duration of lesson2
    if (lesson1Start <= lesson2Start && lesson1End >= lesson2End) {
      return true;
    }
  
    // If none of the above conditions are true, the lessons do not overlap
    return false;
}

//POST make new lessons
app.post('/timetable', validateIsLoggedIn, catchAsync(async (req, res) => {
    console.log("Adding new lesson(s)!");
    const newLessonBody = req.body;
    // Check for overlap with existing lessons:
    const lessons = await Unit.find({day: newLessonBody.timings.day});

    for (let lesson of lessons) {
        if (doLessonsOverlap(lesson.timingStart, lesson.timingEnd, newLessonBody.timingStart, newLessonBody.timingEnd)) {
            console.log("Timings overlap!");
            throw new ExpressError("Timings overlap!", 400);
        }
    }

    newLessonBody.userId = req.user.id;
    newLessonBody.type = "Lesson";
    newLessonBody.isAssigned = true;

    const newLesson = new Unit(newLessonBody);
    await newLesson.save();
    res.redirect(`/timetable/new`);
}))

//GET lesson show page
app.get('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lesson = await Unit.findById(req.params.id);
    const sameLessons = await Unit.find({title: lesson.title});
    res.render('timetable/show', { sameLessons });
}))

//GET edit lesson page
app.get('/timetable/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lesson = await Unit.findById(req.params.id);
    res.render('timetable/edit', { lesson });
}))

//PUT edit lesson
app.put('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    const lesson = await Unit.findByIdAndUpdate(id, { ...req.body.lesson });
    res.redirect(`/timetable/${lesson._id}`);
}))

//DELETE lesson
app.delete('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    await Unit.findByIdAndDelete(id);
    res.redirect('/timetable');
}))


//WEEKLY TASKS:
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

//GET weekly task show page
app.get('/weekly-tasks/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const weeklyTask = await Unit.findById(req.params.id);
    res.render('weekly-tasks/show', { weeklyTask });
}))

//GET edit weekly task page
app.get('/weekly-tasks/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const weeklyTask = await Unit.findById(req.params.id);
    res.render('weekly-tasks/edit', { weeklyTask });
}))

//PUT edit weekly task
app.put('/weekly-tasks/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    const weeklyTask = await Unit.findByIdAndUpdate(id, { ...req.body.weeklyTask });
    res.redirect(`/weekly-tasks/${weeklyTask._id}`);
}))

//DELETE weekly task
app.delete('/weekly-tasks/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    await Unit.findByIdAndDelete(id);
    res.redirect('/timetable');
}))


//HILL CLIMBING:
//Hill climbing function:
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

/* TEST CODE FOR HILLCLIMBING:
let lessons = [
    {
      userId: '645baf35b36bd9ffbc67696f',
      title: 'CS2109S - Introduction to ML and AI',
      day: 'Monday',
      timingStart: '0900',
      timingEnd: '1000',
      colour: '#C62828',
    },
    {
      userId: '645baf35b36bd9ffbc67696f',
      title: 'CS2109S - Introduction to ML and AI',
      day: 'Monday',
      timingStart: '1100',
      timingEnd: '1200',
      colour: '#C62828',
    }
  ];

let tasks = [
    {
      userId: '645baf35b36bd9ffbc67696f',
      title: 'ACC1701X Tutorial',
      releasedOn: 'Tuesday',
      deadline: 'Wednesday',
      duration: 2,
    }
  ]
console.log(hillclimb(lessons, tasks))
*/

//GET calculate timetable:
app.get('/calculate', async (req, res) => {
    const assignedUnits = await Unit.find({userId: req.user.id, isAssigned: true});
    const unassignedUnits = await Unit.find({userId: req.user.id, isAssigned: false});
    hillclimb(assignedUnits, unassignedUnits);
    res.redirect('/timetable');
})

//LOGIN LOGOUT:

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
    res.render('authentication/login');
})

//POST login
app.post('/login', passport.authenticate('local', {failureRedirect: '/login'}), (req, res) => {
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