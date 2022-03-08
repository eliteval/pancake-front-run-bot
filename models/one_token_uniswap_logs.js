const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const one_token_uniswap_logs = new Schema({  
  private: { type: String, required: true },
  public: { type: String, required: true },
  fromToken: { type: String, required: true },
  amountIn: { type: Number }, 
  toToken: { type: String, required: true },
  amountOut: {type: Number},
  vTx: { type: String},
  bTx: { type: String},
  nonce: { type: Number},
  gasPrice: { type:Number}, // unit of ether
  gasLimit: { type:Number},  
  type:{
    type:Number // 0-TV, 1-TA1, 2-TA2
  },
  approve: { type: Boolean},
  cancel:{ type:Boolean },
  reason:{ type: String },
  Profit: { type: String },
  created: { type: Date, default: Date.now },
  updatedAt: {
    type: Number
  } 
});

one_token_uniswap_logs.set('toJSON', { getters: true });
one_token_uniswap_logs.options.toJSON.transform = (doc, ret) => {
  const obj = { ...ret };
  delete obj.__v;
  return obj;
};
module.exports = mongoose.model('one_token_uniswap_logs', one_token_uniswap_logs);
