const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejs_mate = require('ejs-mate');
const catchAsync = require('./utils/catchAsync');
const ExpressError = require('./utils/ExpressError');
const Lesson = require('./models/lesson');
const WeeklyTask = require('./models/weekly-task');
const { lessonSchema, weeklyTaskSchema } = require('./schemas.js');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');

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
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
})

//Middleware for validating Lesson (second layer after Client side) (NOT USED)
const validateLesson = (req, res, next) => {
    for (let lesson of req.body.lessons) {
        const { error } = lessonSchema.validate(lesson);
        if (error) {
            const msg = error.details.map(el => el.message).join(",");
            console.log("Lesson Invalidated! Lesson: " + JSON.stringify(lesson));
            throw new ExpressError(msg, 400);
        }
    }
    next();
}

//Middleware for validating weeklyTask (second layer after Client side)
const validateWeeklyTask = (req, res, next) => {
    const { error } = weeklyTaskSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",")
        throw new ExpressError(msg, 400);
    } else {
        next();
    }
}

//Middleware for checking login
const validateIsLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    next();
}



app.get('/', (req, res) => {
    res.render('home');
})


//GET Index page
app.get('/timetable', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lessons = await Lesson.find({userId: req.user.id});
    const weeklyTasks = await WeeklyTask.find({userId: req.user.id});
    var daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var today = new Date();
    var dayOfWeekString = daysOfWeek[today.getDay()];
    res.render('timetable/index', { lessons, weeklyTasks, dayOfWeekString });
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
    const newLessons = req.body.lessons;
    console.log("New Lessons: " + newLessons);
    const lessons = await Lesson.find({day: newLessons[0].day});

    for (let newLesson of newLessons) {
        for (let lesson of lessons) {
            if (doLessonsOverlap(lesson.timingStart, lesson.timingEnd, newLesson.timingStart, newLesson.timingEnd)) {
                console.log("Timings overlap!");
                throw new ExpressError("Timings overlap!", 400);
            }
        }
    }

    for (let newLessonBody of newLessons) {
        newLessonBody.userId = req.user.id;
        const newLesson = new Lesson(newLessonBody);
        await newLesson.save();
    }
    res.redirect(`/timetable`);
}))

//GET lesson show page
app.get('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    const sameLessons = await Lesson.find({title: lesson.title});
    res.render('timetable/show', { sameLessons });
}))

//GET edit lesson page
app.get('/timetable/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    res.render('timetable/edit', { lesson });
}))

//PUT edit lesson
app.put('/timetable/:id', validateIsLoggedIn, validateLesson, catchAsync(async (req, res) => {
    const { id } = req.params;
    const lesson = await Lesson.findByIdAndUpdate(id, { ...req.body.lesson });
    res.redirect(`/timetable/${lesson._id}`);
}))

//DELETE lesson
app.delete('/timetable/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    await Lesson.findByIdAndDelete(id);
    res.redirect('/timetable');
}))


//WEEKLY TASKS:
//GET make new weekly task page
app.get('/weekly-tasks/new', validateIsLoggedIn, (req, res) => {
    res.render('weekly-tasks/new');
})

//POST make new weekly task
app.post('/weekly-tasks', validateIsLoggedIn, validateWeeklyTask, catchAsync(async (req, res) => {
    const newWeeklyTaskBody = req.body.weeklyTask;
    newWeeklyTaskBody.userId = req.user.id;
    const newWeeklyTask = new WeeklyTask(newWeeklyTaskBody);
    await newWeeklyTask.save();
    res.redirect('/timetable');
}))

//GET weekly task show page
app.get('/weekly-tasks/:id', validateIsLoggedIn, catchAsync(async (req, res) => {
    const weeklyTask = await WeeklyTask.findById(req.params.id);
    res.render('weekly-tasks/show', { weeklyTask });
}))

//GET edit weekly task page
app.get('/weekly-tasks/:id/edit', validateIsLoggedIn, catchAsync(async (req, res) => {
    const weeklyTask = await WeeklyTask.findById(req.params.id);
    res.render('weekly-tasks/edit', { weeklyTask });
}))

//PUT edit weekly task
app.put('/weekly-tasks/:id', validateIsLoggedIn, validateWeeklyTask, catchAsync(async (req, res) => {
    const { id } = req.params;
    const weeklyTask = await WeeklyTask.findByIdAndUpdate(id, { ...req.body.weeklyTask });
    res.redirect(`/weekly-tasks/${weeklyTask._id}`);
}))

//DELETE weekly task
app.delete('/weekly-tasks/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    await WeeklyTask.findByIdAndDelete(id);
    res.redirect('/timetable');
}))



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
        res.redirect('register');
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