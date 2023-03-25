const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Lesson = require('./models/lesson');
const methodOverride = require('method-override');
const ejs_mate = require('ejs-mate');
const catchAsync = require('./utils/catchAsync');

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

app.get('/', (req, res) => {
    res.render('home');
})

//GET Index page
app.get('/timetable', catchAsync(async (req, res) => {
    const lessons = await Lesson.find({});
    res.render('timetable/index', { lessons });
}))

//GET make new lesson page
app.get('/timetable/new', (req, res) => {
    res.render('timetable/new');
})

//POST make new lesson
app.post('/timetable', catchAsync(async (req, res) => {
    const lesson = new Lesson(req.body.lesson);
    await lesson.save();
    res.redirect(`/timetable/${lesson._id}`);
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
app.put('/timetable/:id', catchAsync(async (req, res) => {
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

//Error handler:
app.use((err, req, res, next) => {
    res.send("Error found!");
})


app.listen(3000, () => {
    console.log("LISTENING ON PORT 3000!");
})