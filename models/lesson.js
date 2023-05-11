const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LessonSchema = new Schema({
    userId: String,
    title: String,
    day: String,
    timingStart: String,
    timingEnd: String,
    colour: String
});

module.exports = mongoose.model('Lessons', LessonSchema);