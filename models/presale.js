const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Presale = new Schema({
  address: { type: String, required: true },
  name: { type: String, required: true, unique: true },
  time:{type:Date},
  max:{type:Number},
  min:{type:Number},
  amount:{type:Number},
  wallet:[{type:String}],
  network: { type: String, required: true },
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
  status:{
    type:Number,
    default:0
  }
});

Presale.set('toJSON', { getters: true });
Presale.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('presale', Presale);
