const Logs = require('../models/one_token_uniswap_logs');
const mongoose = require('mongoose');
const config = require('../config');

const connect = (url) => {
  return mongoose.connect(url, config.db.options);
};
connect(config.db.prod);
(async ()=>{
  try{
    const logs = await Logs.deleteMany();
    console.log("Clear all logs");
  }catch(err){
    console.log(err);
  }
})();
