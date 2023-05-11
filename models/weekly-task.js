const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WeeklyTaskSchema = new Schema({
    userId: String,
    title: String,
    releasedOn: String,
    deadline: String,
    duration: Number
});

module.exports = mongoose.model('WeeklyTask', WeeklyTaskSchema);