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

//Middleware for validating Lesson (second layer after Client side)
const validateLesson = (req, res, next) => {
    const { error } = lessonSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",")
        throw new ExpressError(msg, 400);
    } else {
        next();
    }
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

app.get('/', (req, res) => {
    res.render('home');
})

//GET Index page
app.get('/timetable', catchAsync(async (req, res) => {
    const lessons = await Lesson.find({});
    const weeklyTasks = await WeeklyTask.find({});
    res.render('timetable/index', { lessons, weeklyTasks });
}))

//GET make new lesson page
app.get('/timetable/new', (req, res) => {
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

//POST make new lesson
app.post('/timetable', validateLesson, catchAsync(async (req, res) => {
    const newLessonBody = req.body.lesson;
    const lessons = await Lesson.find({day: newLessonBody.day});
    let isValidNewLesson = true;

    for (let lesson of lessons) {
        if (doLessonsOverlap(lesson.timingStart, lesson.timingEnd, newLessonBody.timingStart, newLessonBody.timingEnd)) {
            console.log("Timing failed!");
            isValidNewLesson = false;
        }
    }

    if (isValidNewLesson) {
        const newLesson = new Lesson(newLessonBody);
        await newLesson.save();
        res.redirect(`/timetable/${newLesson._id}`);
    } else {
        throw new ExpressError("Timing is wrong!", 400);
    }

}))

//GET lesson details page
app.get('/timetable/:id', catchAsync(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    res.render('timetable/show', { lesson });
}))

//GET edit lesson page
app.get('/timetable/:id/edit', catchAsync(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    res.render('timetable/edit', { lesson });
}))

//PUT edit lesson
app.put('/timetable/:id', validateLesson, catchAsync(async (req, res) => {
    const { id } = req.params;
    const lesson = await Lesson.findByIdAndUpdate(id, { ...req.body.lesson });
    res.redirect(`/timetable/${lesson._id}`);
}))

//DELETE lesson
app.delete('/timetable/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    await Lesson.findByIdAndDelete(id);
    res.redirect('/timetable');
}))


//WEEKLY TASKS:
//GET make new weekly task page
app.get('/weekly-tasks/new', (req, res) => {
    res.render('weekly-tasks/new');
})

//POST make new weekly task
app.post('/weekly-tasks', validateWeeklyTask, catchAsync(async (req, res) => {
    const newWeeklyTask = new WeeklyTask(req.body.weeklyTask);
    await newWeeklyTask.save();
    res.redirect('/timetable');
}))

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