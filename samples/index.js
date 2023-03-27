const mongoose = require('mongoose');
const lesson = require('../models/lesson');
const Lesson = require('../models/lesson');
const sampleLessons = require('./sample-lessons');

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
}

seedDB();