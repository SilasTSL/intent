const mongoose = require('mongoose');
const Lesson = require('../models/lesson');
const sampleLessons = require('./sample-lessons');
const WeeklyTask = require('../models/weekly-task');
const sampleWeeklyTasks = require('./sample-weekly-tasks');

mongoose.connect('mongodb://localhost:27017/stash-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "conection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const seedDB = async () => {
    await Lesson.deleteMany({});
    for (sampleLesson of sampleLessons) {
        const lesson = new Lesson(sampleLesson);
        await lesson.save();
    }

    await WeeklyTask.deleteMany({});
    for (sampleWeeklyTask of sampleWeeklyTasks) {
        const weeklyTask = new WeeklyTask(sampleWeeklyTask);
        await weeklyTask.save();
    }
}

seedDB();