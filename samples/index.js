const mongoose = require('mongoose');
const Lesson = require('../models/lesson');
const timings = require('./sample-timings');
const days = require('./sample-days');
const colours = require('./sample-colours');
const titles = require('./sample-titles');

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
    for (let i = 0; i < 20; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)];
        const colour = colours[Math.floor(Math.random() * colours.length)];
        const day = days[Math.floor(Math.random() * days.length)];
        const timing = timings[Math.floor(Math.random() * timings.length)];
        const lesson = new Lesson({
            title: title,
            colour: colour,
            day: day,
            timing: timing
        });
        await lesson.save();
    }
}

seedDB();