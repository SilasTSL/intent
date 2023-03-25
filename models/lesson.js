const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LessonSchema = new Schema({
    title: String,
    day: String,
    timing: String,
    colour: String
});

module.exports = mongoose.model('Lessons', LessonSchema);