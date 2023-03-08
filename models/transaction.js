const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionsSchema = new Schema({
    title: String,
    amount: String,
    description: String,
    date: String
});

module.exports = mongoose.model('Transactions', TransactionsSchema);