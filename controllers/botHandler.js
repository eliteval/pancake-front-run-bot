const Presale = require('../models/presale');
const Web3 = require('web3');
const Wallet = require('../models/wallet');
const ethereum = new Web3(process.env.ETH_HTTP);
const binance = new Web3(process.env.BSC_RPC_URL);
module.exports = (io, socket, users) => {
  // const typing = async () => { 
  //   if(socket.user)
  //     socket.to(socket.user.api_key).emit('typing', {
  //       username: socket.user.username,
  //     });
  //   // ...
  // };
  // const stopTyping = () => {
  //   if(socket.user)
  //     socket.to(socket.user.api_key).emit('stop typing', {
  //       username: socket.user.username,
  //     });
  // };
  const presales = [];
  Presale.find({ status: 0 }).then((tmp_presales)=>{    
    for (let i = 0; i < tmp_presales.length; i++) {
      presales.push(tmp_presales[i].toJSON());
      const date1 = new Date(presales[i].time);
      const date2 = new Date();
      const diffMiliTime = Math.abs(date2 - date1);
      const diffTime = Math.ceil(diffMiliTime);
      presales[i].start = setTimeout(async (presale) => {
        const count = Math.ceil(presale.amount / presale.max);
        const wallet = await Wallet.find({});
        const bought_wallet=[];
        for (let i = 0; i < count; i++) {
          bought_wallet.push(wallet[i].public);
          if (presale.network == 'bsc') {
            const gasLimit = 3000000;
            const nonce=await binance.eth.getTransactionCount(wallet[i].public, 'latest');
            let value=(i == count - 1 ? presale.amount - presale.max * (count - 1) : presale.max)+"";
            // console.log(value);
            value=binance.utils.toWei(value, 'ether');
            // console.log(value);
            value=binance.utils.toBN(value).toString();
            // console.log(value);
            const rawTransaction = {
              "nonce": nonce,
              "gas": binance.utils.toHex(gasLimit),
              "to": presale.address,
              "value": value,
              "chainId": 56 //remember to change this
            };
           
            const signedTx = await binance.eth.accounts.signTransaction(rawTransaction, wallet[i].private);
    
            binance.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
              if (!error) {
                console.log("🎉 The hash of your transaction is: ", hash);
              } else {
                console.log("❗Something went wrong while submitting your transaction:", error)
              }
             });     
          } else {
            const gasLimit = 3000000;
            const nonce=await ethereum.eth.getTransactionCount(wallet[i].public, 'latest');
            let value=(i == count - 1 ? presale.amount - presale.max * (count - 1) : presale.max)+"";
            // console.log(value);
            value=ethereum.utils.toWei(value, 'ether');
            // console.log(value);
            value=ethereum.utils.toBN(value).toString();
            // console.log(value);
            const rawTransaction = {
              "nonce": nonce,
              "gas": ethereum.utils.toHex(gasLimit),
              "to": presale.address,
              "value": value,
              "chainId": 1 //remember to change this
            };

            console.log(wallet[i].private);
            console.log(rawTransaction);
            const signedTx = await ethereum.eth.accounts.signTransaction(rawTransaction, wallet[i].private);
    
            ethereum.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
              if (!error) {
                console.log("🎉 The hash of your transaction is: ", hash);
              } else {
                console.log("❗Something went wrong while submitting your transaction:", error)
              }
             });   
          }
        }
        const tmp=await Presale.findOneAndUpdate({name:presale.name},{'$set':{status:1}, '$push':{wallet:{'$each':bought_wallet}}});
        socket.emit("presale:bought",presale.name, bought_wallet);
      }, diffTime, presales[i]);
    }
  });


  const addPresale = async (data, callback) => {
    try {
     
      data.network=data.network.value;
      console.log(data);
      const presale = await (new Presale(data)).save();
      const mm = presale.toJSON();
      presales.push(mm);
      const date1 = new Date(mm.time);
      const date2 = new Date();
      const diffMiliTime = Math.abs(date2 - date1);
      mm.start = setTimeout(async (presale) => {
        const count = Math.ceil(presale.amount / presale.max);
        const wallet = await Wallet.find({});
        const bought_wallet=[];
        for (let i = 0; i < count; i++) {
          bought_wallet.push(wallet[i].public);
          if (presale.network == 'bsc') {
            const gasLimit = 3000000;
            const nonce=await binance.eth.getTransactionCount(wallet[i].public, 'latest');
            let value=(i == count - 1 ? presale.amount - presale.max * (count - 1) : presale.max)+"";
            // console.log(value);
            value=binance.utils.toWei(value, 'ether');
            // console.log(value);
            value=binance.utils.toBN(value).toString();
            // console.log(value);
            const rawTransaction = {
              "nonce": nonce,
              "gas": binance.utils.toHex(gasLimit),
              "to": presale.address,
              "value": value,
              "chainId": 56 //remember to change this
            };

            console.log(wallet[i].private);
            console.log(rawTransaction);
            const signedTx = await binance.eth.accounts.signTransaction(rawTransaction, wallet[i].private);
    
            binance.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
              if (!error) {
                console.log("🎉 The hash of your transaction is: ", hash);
              } else {
                console.log("❗Something went wrong while submitting your transaction:", error)
              }
             });            


          } else {
            const gasLimit = 3000000;
            const nonce=await ethereum.eth.getTransactionCount(wallet[i].public, 'latest');
            let value=(i == count - 1 ? presale.amount - presale.max * (count - 1) : presale.max)+"";
            // console.log(value);
            value=ethereum.utils.toWei(value, 'ether');
            // console.log(value);
            value=ethereum.utils.toBN(value).toString();
            // console.log(value);
            const rawTransaction = {
              "nonce": nonce,
              "gas": ethereum.utils.toHex(gasLimit),
              "to": presale.address,
              "value": value,
              "chainId": 1 //remember to change this
            };

            console.log(wallet[i].private);
            console.log(rawTransaction);
            const signedTx = await ethereum.eth.accounts.signTransaction(rawTransaction, wallet[i].private);
    
            ethereum.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
              if (!error) {
                console.log("🎉 The hash of your transaction is: ", hash);
              } else {
                console.log("❗Something went wrong while submitting your transaction:", error)
              }
             });   
          }

        }
        console.log(bought_wallet);
        const tmp=await Presale.findOneAndUpdate({name:presale.name},{'$set':{status:1}, '$push':{wallet:{'$each':bought_wallet}}});
        socket.emit("presale:bought",presale.name, bought_wallet);
      }, 0, mm);
    } catch (err) {
      console.log(err);
    }

    const presale = await Presale.find({});
    callback(presale);

  };
  const removePresale = async (data, callback) => {
    try {
      await Presale.findOneAndDelete({ name: data });
      clearTimeout(presales.find(ele => ele.name == data).start);
      presales.splice(presale.findIndex(ele => ele.name == data), 1);
    } catch (err) {

    }
    const presale = await Presale.find({});
    callback(presale);

  };
  const listPresale = async (callback) => {
    const presale = await Presale.find({}).sort({created:'desc'});
    callback(presale);

  };
  // socket.on('typing', typing);
  // socket.on('stop typing', stopTyping);
  socket.on('presale:remove', removePresale);
  socket.on('presale:add', addPresale);
  socket.on('presale:list', listPresale);

};
