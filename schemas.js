const joi = require('joi');

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
module.exports.lessonSchema = joi.object({
    lesson: joi.object({
        title: joi.string().required(),
        day: joi.string().valid(...days).required(),
        timingStart: joi.string().required(),
        timingEnd: joi.string().required(),
        colour: joi.string().required()
    }).required()
})