const joi = require('joi');

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

module.exports.lessonSchema = joi.object({
    lesson: joi.object({
        title: joi.string().required(),
        day: joi.string().valid(...weekdays).required(),
        timingStart: joi.string().required(),
        timingEnd: joi.string().required(),
        colour: joi.string().required()
    }).required()
})

module.exports.weeklyTaskSchema = joi.object({
    weeklyTask: joi.object({
        title: joi.string().required(),
        releasedOn: joi.string().valid(...days).required(),
        deadline: joi.string().valid(...days).required(),
        duration: joi.number().required(),
    }).required()
})