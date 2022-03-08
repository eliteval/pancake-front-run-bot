const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_plan = new Schema({
  private: { type: String, required: true }, //
  public: { type: String, required: true }, //
  gasPricePlus: {type:Number, required: true}, // gwei
  gasPriceMinus: {type:Number, required: true}, // gwei
  tokenPairs: {type: String,default:''}, //
  status: {type:Number, required: true},
  minLimit: {type:mongoose.Schema.Types, required: true},
  enableFixAmount: {type:Boolean,default:false},
  fixedAmount: {type:Number,default:0}, 
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  },
});

one_token_uniswap_plan.set('toJSON', { getters: true });
one_token_uniswap_plan.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_plan', one_token_uniswap_plan);
