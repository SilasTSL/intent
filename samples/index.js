const mongoose = require('mongoose');
const Transaction = require('../models/transaction');
const amounts = require('./sample-amounts');
const dates = require('./sample-dates');
const descriptions = require('./sample-descriptions');
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
    await Transaction.deleteMany({});
    for (let i = 0; i < 20; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const date = dates[Math.floor(Math.random() * dates.length)];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        const transaction = new Transaction({
            title: title,
            description: description,
            date: date,
            amount: amount
        });
        await transaction.save();
    }
}

seedDB();