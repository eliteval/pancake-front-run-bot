//this is for uniswap v2
const axios = require('axios');
const scanKey = 'KQ3MEFVCCAG7RTC6JJ56ZHU6K1JTDQ41BN';
const Plan = require("../models/one_token_uniswap_plan");
const Logs = require("../models/one_token_uniswap_logs");
const Wallet = require("../models/wallet");
const core_func = require('../utils/core_func');
let socketT;
let io;
const url = {
    wss: process.env.BSC_WS, 
    http: process.env.BSC_HTTP,
}
const address = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', 
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
};
const abi = {
    factory:require('./abi/abi_uniswap_v2').factory,
    router: require('./abi/abi_uniswap_v2_router_all.json'),
    token: require('./abi/abi_token.json'),
    pair: require('./abi/token_pair.json'),
}
const ethers = require('ethers');
const { JsonRpcProvider } = require("@ethersproject/providers");
let wssprovider = new ethers.providers.WebSocketProvider(url.wss);
const httpprovider = new JsonRpcProvider(url.http);
const provider = new ethers.providers.JsonRpcProvider(url.http);
const factory = new ethers.Contract(address.factory, abi.factory, provider);
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(url.http));
const uniswapAbi = new ethers.utils.Interface(abi.router);
let plan;
let tokenPairs=[];
let signer;
let router;
let myNonce;
let walletBalance = [];
let sendGas = {
    gasPrice:84,
    gasLimit:500000
}

const swapETHForExactTokens = new RegExp("^0xfb3bdb41");
const swapExactETHForTokens = new RegExp("^0x7ff36ab5");
const swapExactETHForTokensSupportingFeeOnTransferTokens = new RegExp("^");

const swapExactTokensForTokens = new RegExp("^0x38ed1739");
const swapTokensForExactTokens = new RegExp("^0x8803dbee");
const swapExactTokensForTokensSupportingFeeOnTransferTokens = new RegExp("^0x5c11d795");

const swapExactTokensForETH = new RegExp("^0x18cbafe5");
const swapTokensForExactETH = new RegExp("^0x4a25d94a");
const swapExactTokensForETHSupportingFeeOnTransferTokens = new RegExp("^0x791ac947");

const FRONTRUNHEXCODE = [
    swapETHForExactTokens,
    swapExactETHForTokens,
    swapExactTokensForTokens,
    swapTokensForExactTokens,
    swapExactTokensForTokensSupportingFeeOnTransferTokens,
    swapExactTokensForETH,
    swapTokensForExactETH,
    swapExactTokensForETHSupportingFeeOnTransferTokens,
];

let initMempool = async () => {
    console.log('~~~~~~Pancakeswap mempool(v.2.1)~~~~~~~');
    await prepareBot(true);
    wssprovider.on("pending", async (tx) => 
    {
        if(true){
            const startTime = Date.now();
            wssprovider.getTransaction(tx).then(
                async function (transaction)
                {
                    try{
                        //check in spooky router
                        if(transaction && transaction.to && transaction.to.toLowerCase() == address.router.toLowerCase()){
                            if(plan && transaction.from.toLowerCase() != plan.public.toLowerCase() && transaction.from != "0x0000000000000000000000000000000000000000"){
                                if (checkRegEx(FRONTRUNHEXCODE,transaction.data))
                                {// listen buy event
                                    try{
                                        const hash = transaction.hash;
                                        const transactionData = transaction.data;
                                        const gasFeeOrigin = ethers.utils.formatEther(transaction.gasPrice)*1000000000;
                                        const gasLimit = transaction.gasLimit > 210000 ? transaction.gasLimit : 210000;
                                        const nonce = transaction.nonce;
                                        const from = transaction.from;
                                        const whales = Logs.find({type: 0});
                                        for(let i=0; i<whales.length; i++){
                                            if(from.toLowerCase() == whales[i].from.toLowerCase() && nonce == whales[i].nonce){
                                                await cancelTransaction(whales[i].vTx);
                                            }
                                        }
                                        let fromToken;
                                        let amountIn;
                                        let amountOut;
                                        if(checkRegEx([swapExactETHForTokens, swapETHForExactTokens], transactionData)){
                                            fromToken = transactionData.substr((64*5+10), 64);
                                            amountIn = transaction.value;
                                            amountOut = "0x"+transactionData.substr(10, 64);
                                        }else{
                                            fromToken = transactionData.substr((64*6+10), 64);
                                            if(checkRegEx([swapExactTokensForTokens,swapExactTokensForTokensSupportingFeeOnTransferTokens,swapExactTokensForETH,swapExactTokensForETHSupportingFeeOnTransferTokens], transactionData)){
                                                amountIn = "0x"+ transactionData.substr(10, 64);
                                                amountOut = "0x"+transactionData.substr(74, 64);
                                            }else{
                                                amountIn = "0x"+transactionData.substr(74, 64);
                                                amountOut = "0x"+ transactionData.substr(10, 64);
                                            }
                                        }
                                        let toToken = transactionData.substr(-64);
                                        if(plan && plan.status == 1 && tokenPairs.length > 0){
                                            for(let i = 0; i < tokenPairs.length ; i++){
                                                let firstToken = String(tokenPairs[i][0]).substring(2).toLowerCase();
                                                let secondToken = String(tokenPairs[i][1]).substring(2).toLowerCase();
                                                if(fromToken.indexOf(firstToken) != -1 && toToken.indexOf(secondToken) != -1) {// check if token pair is
                                                    const fToken = tokenPairs[i][0];
                                                    const tToken = tokenPairs[i][1];
                                                    const reserves = tokenPairs[i][2];
                                                    const token0 = tokenPairs[i][3];
                                                    const token1 = tokenPairs[i][4];
                                                    const fromDecimals = tokenPairs[i][5];
                                                    const toDecimals = tokenPairs[i][6];
                                                    const data = await getImpact(fToken, tToken, amountIn, amountOut, reserves, token0, token1, fromDecimals, toDecimals, transactionData);
                                                    const impact = data["impact"];
                                                    const slippage = data["slippage"];
                                                    const fromAmount = data["fromAmount"];
                                                    const toAmount = data["toAmount"];
                                                    const swapFrom = data["swapFrom"];
                                                    const swapTo = data["swapTo"];
                                                    console.log("----- Transaction: ", hash, " ", "Impact: ", impact, "------");
                                                    if(impact >= plan.minLimit){
                                                        const gasFeePlus = ethers.utils.parseUnits(String((Number(gasFeeOrigin)+Number(plan.gasPricePlus)).toFixed(9)), "gwei");
                                                        let gasFeeMinus;
                                                        if((Number(gasFeeOrigin)-Number(plan.gasPriceMinus)) < 5){
                                                            gasFeeMinus = ethers.utils.parseUnits(String((5).toFixed(9)), "gwei");
                                                        }else{
                                                            gasFeeMinus = ethers.utils.parseUnits(String((Number(gasFeeOrigin)-Number(plan.gasPriceMinus)).toFixed(9)), "gwei");
                                                        }
                                                        const newslippage = impact*(1+Number(slippage));
                                                        await buyTokens(tToken,fToken,fromDecimals,toDecimals,plan.public,plan.private,swapTo,swapFrom,gasFeePlus,gasLimit,hash,startTime,newslippage);
                                                        await sellTokens(tToken,fToken,fromDecimals,toDecimals,plan.public,plan.private,swapTo,swapFrom,gasFeeMinus,gasLimit,hash,startTime,newslippage);
                                                        await Logs.create({
                                                            private: plan.private,
                                                            public: plan.public,
                                                            fromToken: fToken,
                                                            amountIn: fromAmount,
                                                            toToken: tToken,
                                                            amountOut: toAmount,
                                                            bTx: "",
                                                            vTx: hash,
                                                            gasPrice: gasFeeOrigin,
                                                            gasLimit: gasLimit,
                                                            nonce: nonce,
                                                            created: core_func.strftime(Date.now()),
                                                            type: 0,
                                                            profit: impact,
                                                            approve: false,
                                                            cancel:false,
                                                            reason: "",
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }catch(error){
                                        console.log('[ERROR->getTransaction->if]',error)
                                    }
                                }
                            }
                        }
                    }catch(e){
                        console.log('[ERROR]->wssProvidergetTransaction function');
                    }
                }
            ).catch(error=>{
                console.log('[ERROR in wssprovider]');
            })
        }

    });
    wssprovider._websocket.on("error", async () => {
        console.log(`Unable to connect to ${ep.subdomain} retrying in 3s...`);
        wssprovider = new ethers.providers.WebSocketProvider(url.wss);
        setTimeout(initMempool, 3000);
      });
    wssprovider._websocket.on("close", async (code) => {
        console.log(
            `Connection lost with code ${code}! Attempting reconnect in 3s...`
        );
        wssprovider._websocket.terminate();
        wssprovider = new ethers.providers.WebSocketProvider(url.wss);
        setTimeout(initMempool, 3000);
    });
}
let buyTokens = async (toToken,fromToken,fromDecimals,toDecimals,public,private,amountOut,amountIn,gasPricePlus,gasLimit,tTx,startTime,slippage)=>{
    let txHash;
    try{
        myNonce++;
        const buyNonce = myNonce;
        let toAmount = amountOut/(10**toDecimals);
        toAmount = ethers.utils.parseUnits(String(toAmount), toDecimals);
        let amountInMax = Number(amountIn) + Math.floor(amountIn*10/100);
        amountInMax = amountInMax/(10**fromDecimals);
        amountInMax = ethers.utils.parseUnits(String(amountInMax), fromDecimals);
        amountIn = amountIn/(10**fromDecimals);
        amountIn = ethers.utils.parseUnits(String(amountIn), fromDecimals);
        let gasTx;
        let tx;
        try{
            if(fromToken.toLowerCase() == address.WBNB.toLowerCase()){
                gasTx={ 
                    gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                    gasPrice: ethers.utils.hexlify(Number(gasPricePlus)),
                    nonce: buyNonce,
                    value: amountInMax
                }
                tx = await router.swapETHForExactTokens(
                    toAmount,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes
                    gasTx
                );
            }else if(toToken.toLowerCase() == address.WBNB.toLowerCase()){
                gasTx={ 
                    gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                    gasPrice: ethers.utils.hexlify(Number(gasPricePlus)),
                    nonce: buyNonce,
                }
                tx = await router.swapTokensForExactETH(
                    toAmount,
                    amountInMax,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes
                    gasTx
                );
            }else{
                gasTx={ 
                    gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                    gasPrice: ethers.utils.hexlify(Number(gasPricePlus)),
                    nonce: buyNonce,
                }
                tx = await router.swapTokensForExactTokens(
                    toAmount,
                    amountInMax,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes
                    gasTx
                );
            }
            console.log("Elapsed Time(buy): ", Date.now() - startTime);
            txHash = tx.hash;
            console.log(`|***********Buy Tx-hash: ${txHash}`);
        }catch(error){
            console.log(`[BUY ERROR->${error.reason}]`);
            myNonce--;
            if(txHash) await Logs.findOneAndUpdate({bTx:txHash, type:1},{"$set":{cancel:true, reason: error.code}});
            return false;
        }
        const receipt = await tx.wait();
        console.log(`|***********Buy Tx was mined in block: ${receipt.blockNumber}`);
        await Logs.create({
            private: private,
            public: public,
            fromToken: fromToken,
            amountIn: amountIn,
            toToken: toToken,
            amountOut: toAmount,
            vTx: tTx,
            bTx: txHash,
            gasPrice: gasPricePlus/1000000000,
            gasLimit: gasLimit,
            nonce: buyNonce,
            created: core_func.strftime(Date.now()),
            type: 1,
            approve: false,
            cancel: false,
        });
        const logItem = await getLogs();
        if(socketT) io.sockets.emit("uniswap:one:logStatus",logItem);
    }catch(error){
        console.log(`[BUY ERROR->${error.reason}]`);
        if(txHash) await Logs.findOneAndUpdate({bTx:txHash, type:1},{"$set":{cancel:true, reason: error.code}});
        return false;
    }
}
let approveTokens = async (token)=>{
    try{
        if(!plan){
            console.log('Plan not exist');
            return false;
        }
        myNonce++;
        const numberOfDecimals = await getDecimal(token);
        let contract = new ethers.Contract(token, abi.token, signer);
        let allowance = await contract.allowance(plan.public, address.router);
        allowance = allowance/10**numberOfDecimals;
        if(allowance <= 100){
            console.log('~~~~~~~~~~~~~~~~~[Approve]~~~~~~~~~~~~~~~~~');
            const numberOfTokens = ethers.utils.parseUnits(String(1000000), numberOfDecimals);
            const gas = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(10), "gwei")));
            const limit = ethers.utils.hexlify(Number(200000));
            let aproveResponse = await contract.approve(address.router, numberOfTokens, {gasLimit: limit, gasPrice: gas, nonce: myNonce});
            console.log(`<<<<<------- Approved ${token} on Pancakeswap -------->>>>>`);
        }else{
            myNonce--;
        }
        return true;
    }catch(error){
        console.log(`[APPROVE ERROR->${error.reason}]`);
        myNonce--;
        return false;
    }
}
let sellTokens = async (fromToken,toToken,toDecimals,fromDecimals,public,private,amountIn,amountOut,gas,limit,tTx,startTime,slippage)=>{
    try{
        myNonce++;
        let numberOfTokens = amountIn/(10**fromDecimals);
        numberOfTokens = ethers.utils.parseUnits(String(numberOfTokens), fromDecimals);
        const gasPrice = ethers.utils.hexlify(Number(gas));
        const gasLimit = ethers.utils.hexlify(Number(limit));
        const sellNonce = myNonce;
        //--swap token
        const tokenAmountTosell = numberOfTokens;
        let amountOutMin = amountOut - Math.floor(amountOut*10/100);
        amountOutMin = amountOutMin/(10**toDecimals);
        amountOutMin = ethers.utils.parseUnits(String(amountOutMin), toDecimals);
        let tx;
        try{
            if(fromToken.toLowerCase() == address.WBNB.toLowerCase()){
                tx = await router.swapExactETHForTokens(
                    0,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                    { gasLimit: gasLimit, gasPrice: gasPrice, nonce:sellNonce, value: tokenAmountTosell}
                );
            }else if(toToken.toLowerCase() == address.WBNB.toLowerCase()){
                tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                    tokenAmountTosell,
                    0,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                    { gasLimit: gasLimit, gasPrice: gasPrice, nonce:sellNonce}
                );
            }else{
                tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    tokenAmountTosell,
                    0,
                    [fromToken, toToken],
                    public,
                    Date.now() + 1000 * 60 * 10, //10 minutes(deadline as)
                    { gasLimit: gasLimit, gasPrice: gasPrice, nonce:sellNonce}
                );
            }
            console.log("Elapsed Time(sell): ", Date.now() - startTime);
            const txHash = tx.hash;
            console.log(`|***********Sell Tx-hash: ${tx.hash}`);
        }catch(error){
            console.log(`[SELL ERROR->${error.reason}]`);
            myNonce--;
            await  Logs.findOneAndUpdate( // change log as sell failed
                {vTx:tTx, type:2},
                {"$set":{cancel:true,reason:error.code,created: core_func.strftime(Date.now())}});
            return false;
            }
        amountOut = await router.getAmountsOut(tokenAmountTosell, [fromToken, toToken]);
        amountOut = amountOut[1]/(10**toDecimals)*1.01;
        amountOut = ethers.utils.parseUnits(String(amountOut.toFixed(9)), toDecimals);
        const receipt = await tx.wait();
        console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
        await Logs.create({
            private: private,
            public: public,
            fromToken: fromToken,
            amountIn: amountIn,
            toToken: toToken,
            amountOut: amountOut,
            vTx: tTx,
            bTx: txHash,
            gasPrice: gasPrice/1000000000,
            gasLimit: gasLimit,
            nonce: sellNonce,
            created: core_func.strftime(Date.now()),
            type: 2,
            cancel: false,
        });
        const logItem = await getLogs();
        if(socketT) io.sockets.emit("uniswap:one:logStatus",logItem);
    }catch(error){
        console.log(`[SELL ERROR->${error.reason}]`);
        await  Logs.findOneAndUpdate( // change log as sell failed
            {vTx:tTx, type:2},
            {"$set":{cancel:true,reason:error.code,created: core_func.strftime(Date.now())}});
        return false;
    }
}
let cancelTransaction = async (hash)=>{
    try{
        console.log('~~~~~~~~~~~~~~~~~[selling]~~~~~~~~~~~~~~~~~');
        const data = await Logs.findOne({vTx:hash, type:{ $ne: 0 }});
        if(!plan||!data){
            console.log('Plan or Hash data not exist');
            return false;
        }
        for(let i=0; i<data.length;i++){
            const gasPrice = ethers.utils.hexlify(Number(ethers.utils.parseUnits(String(data[i].gasPrice), "gwei")));
            const gasLimit = ethers.utils.hexlify(Number(data[i].gasLimit));
            //--swap token
            try{
                console.log('-------SellAmount----');
                console.log('amounts',amounts);
                console.log('amountOutMin',amountOutMin);
                console.log('numberOfTokens',numberOfTokens);
                console.log('tokenAmountTosell',tokenAmountTosell);
                gasTx={ 
                    gasLimit: ethers.utils.hexlify(Number(gasLimit)),
                    gasPrice: ethers.utils.hexlify(Number(gasPrice)),
                    value: 0,
                    nonce:data[i].nonce,
                }
                const tx = await router.swapExactETHForTokens(
                    '0',
                    [data[i].fromToken, data[i].toToken],
                    data[i].public,
                    Date.now() + 10000 * 60 * 10, //100 minutes
                    gasTx
                );
                const txHash = tx.hash;
                console.log(`Cancel Tx-hash: ${txHash}`);
                const receipt = await tx.wait();
                console.log(`Sell Tx was mined in block: ${receipt.blockNumber}`);
                await  Logs.findOneAndUpdate( // change log as sell failed
                    {bTx:data[i].btx},
                    {"$set":{cancel:true,reason:"Whale transaction cancelled.",created: core_func.strftime(Date.now())}});
                return true;    
            }catch(error){
                console.log('[selling token failed]');
                return false;
            }
        }        
    }catch(error){
        console.log(`[ERROR->${error.reason}]`);
        return false;
    }
}
let prepareBot = async (approved)=>{//ok!
    plan = await getPlan();
    if(plan && plan.status == 1){
        let pairData = plan.tokenPairs?String(plan.tokenPairs).trim().split(','):[];
        signer = new ethers.Wallet(plan.private, wssprovider);
        router = new ethers.Contract(address.router,abi.router,signer);
        myNonce = await web3.eth.getTransactionCount(plan.public);
        myNonce--;
        for(let i = 0 ; i < pairData.length; i++){
            pairData[i]=String(pairData[i]).trim().split(':');
            await approveTokens(pairData[i][0]);
            await approveTokens(pairData[i][1]);
            const pairAddress = await factory.getPair(pairData[i][1], pairData[i][0]);
            const pairContract = new ethers.Contract(pairAddress, abi.pair, provider);
            const reserves = await pairContract.getReserves();
            pairData[i][2] = reserves;
            const token0 = await pairContract.token0();
            pairData[i][3] = token0;
            const token1 = await pairContract.token1();
            pairData[i][4] = token1;
            const fromDecimals = await getDecimal(pairData[i][0]);
            pairData[i][5] = fromDecimals;
            const toDecimals = await getDecimal(pairData[i][1]);
            pairData[i][6] = toDecimals;
            const balance = await getBalance(pairData[i][0], plan.public);
            const walletToken = pairData[i][0].toLowerCase();
            if(walletBalance[walletToken] != "undefined"){
                walletBalance[walletToken] = balance;
            }
        }
        tokenPairs = pairData;
        const structDatas = [];
        for(let i = 0; i < tokenPairs.length;i++){
            structDatas.push(
                { 
                    FrontRunPlan: tokenPairs[i][0]+"<->"+tokenPairs[i][1], 
                }
            );
        }
        console.table(structDatas);
    }
    if(io) io.sockets.emit("uniswap:one:newPlan",plan);
}

//____________functions___________________
let getImpact = async(fromToken, toToken, ftAmount, ttAmount, reserves, token0, token1, fromDecimals, toDecimals, inputData, gasPrice, gasLimit) => {
    let liquidity0;
    let liquidity1;
    if(fromToken.toLowerCase() == token1.toLowerCase()){
        liquidity0 = reserves["_reserve1"];
        liquidity1 = reserves["_reserve0"];
    }else if(fromToken.toLowerCase() == token0.toLowerCase()){
        liquidity0 = reserves["_reserve0"];
        liquidity1 = reserves["_reserve1"];
    }
    const product = liquidity0 * liquidity1;
    let impact;
    let fromAmount;
    let toAmount;
    let slippage;
    if(checkRegEx([swapExactETHForTokens,swapExactTokensForTokens,swapExactTokensForTokensSupportingFeeOnTransferTokens,swapExactTokensForETH,swapExactTokensForETHSupportingFeeOnTransferTokens], inputData)){
        let amountInExact = ftAmount;
        let amountOutMin = ttAmount;
        let _liquidity0 = liquidity0 - amountInExact;
        let _liquidity1 = product / _liquidity0;
        let amountOut = _liquidity1 - liquidity1;
        if(amountOut < amountOutMin){
            impact = 0;
        }else{
            let bPrice = _liquidity0/_liquidity1;
            let price = amountInExact/amountOut;
            impact = (price-bPrice)/bPrice*100;
        }
        slippage = (amountOut-amountOutMin)/amountOut*100;
        fromAmount = amountInExact;
        toAmount = amountOut;
    }else if(checkRegEx([swapETHForExactTokens,swapTokensForExactTokens,swapTokensForExactETH], inputData)){
        let amountInMax = ftAmount;
        let amountOutExact = ttAmount;
        let _liquidity1 = Number(liquidity1) + Number(amountOutExact);
        let _liquidity0 = product / _liquidity1;
        let amountIn = liquidity0 - _liquidity0;
        if(amountIn > amountInMax){
            impact = 0;
        }else{
            let bPrice = _liquidity0/_liquidity1;
            let price = amountIn/amountOutExact;
            impact = (price-bPrice)/bPrice*100;
        }
        slippage = (amountInMax-amountIn)/amountIn*100;
        fromAmount = amountIn;
        toAmount = amountOutExact;
    }
    let swapFrom;
    if(plan.enableFixAmount == "enable"){
        swapFrom = plan.fixedAmount;
        swapFrom = ethers.utils.parseUnits(String(swapFrom), fromDecimals);
    }else{
        swapFrom = fromAmount*(slippage-0.01)/impact;
        fromToken = fromToken.toLowerCase();
        const balance = walletBalance[fromToken]*(10**fromDecimals);
        if(swapFrom > balance){
            swapFrom = balance;
        }
    }
    swapFrom = Math.floor(swapFrom);
    let _liquidity0 = liquidity0 - swapFrom;
    let _liquidity1 = product / _liquidity0;
    let swapTo = _liquidity1 - liquidity1;
    swapTo = Math.floor(swapTo);
    return {"impact": impact, "slippage": slippage, "fromAmount":fromAmount, "toAmount": toAmount, "swapFrom": swapFrom, "swapTo": swapTo};
}
let getBalance = async (addr, publicKey) => {
    let balance = 0;
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    if(addr.toLowerCase() == address.WBNB.toLowerCase()){
        balance = await web3.eth.getBalance(publicKey);
        balance = balance*0.8;
    }else{
        try{
            balance = await contractInstance.methods.balanceOf(publicKey).call();
        }catch(error){
            console.log(error);
            return 0;
        }
    }
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
        return 0;
    }
    const val = balance / Math.pow(10, decimal);
    return val;
}
let getDecimal = async (addr) => {
    let decimal = 0;
    let contractInstance = new web3.eth.Contract(abi.token, addr);
    try{
        decimal = await contractInstance.methods.decimals().call();
    }catch(error){
        console.log(error);
    }
    return decimal;
}
let checkRegEx = (regArr,data)=>{
    try{
        for(let i = 0; i < regArr.length; i++){
            if(regArr[i]=='addLiquidity') return false;
            else if(regArr[i].test(data)) return true;
        }
        return false;
    }catch(err){
        console.log('[ERROR->checkRegEx]',err)
        return false;
    }
}
let getPlan = async () => {
    let plan;
    try {
        plan = await Plan.findOne({});
    } catch (err) {
        console.log(err);
        plan = false;
    }
    const data = JSON.parse(JSON.stringify(plan));
    if(data){
        data.enableFixAmount = data.enableFixAmount === true?'enable':'disable';
    }
    return JSON.parse(JSON.stringify(data));
}
let getLogs = async () => {
    try {
        let data = await Logs.find({}).sort({created:'desc'});
        let item = JSON.parse(JSON.stringify(data));
        for(let i = 0 ; i < item.length; i++){
            if(item[i].type == 0) item[i].typeName = 'Whale transaction';
            if(item[i].type == 1) item[i].typeName = 'Buy transaction';
            if(item[i].type == 2) item[i].typeName = 'Sell transaction';
            if(item[i].status==0) item[i].txStatus = 'Buying';// 0-buying,1-bought,2-buy failed,4-moving,5-moved,6-move failed,7-selling,8-sold,9-sell failed
            if(item[i].status==1) item[i].txStatus = 'Bought';
            if(item[i].status==2) item[i].txStatus = 'BuyFailed';
            if(item[i].status==7) item[i].txStatus = 'Selling';
            if(item[i].status==8) item[i].txStatus = 'Sold';
            if(item[i].status==9) item[i].txStatus = 'SellFailed';
            item[i].created = core_func.strftime(item[i].created);
            item[i].curRate = item[i].boughtPrice==0?0:Number(item[i].currentPrice/item[i].baseTokenAmount).toExponential(2);
            if(item[i].approve !=true) item[i].approveStatus = 'not yet';
            else item[i].approveStatus = 'approved';
            item[i].amountIn = item[i].amountIn/1000000000000000000;
            if(item[i].amountIn < 0.00001) {
                item[i].amountIn = item[i].amountIn*1000000000000;
            }
            item[i].amountOut = item[i].amountOut/1000000000000000000;
            if(item[i].amountOut < 0.00001) {
                item[i].amountOut = item[i].amountOut*1000000000000;
            }
            item[i].tx = item[i].bTx?item[i].bTx:item[i].vTx;
        }
        return item;
    } catch (err) {
        console.log(err);
        return [];
    }
}
let getPlanForSocket = async (callback) => {
    const item = await getPlan();
    const wallets = await Wallet.find({});
    callback({plan:item,wallet:wallets});
};
let getLogsForSocket = async (callback) => {
    const item = await getLogs();
    callback(item);
};
let setBot = async (data, callback) => {
    try {
        const newPlan = await Plan.findOne({});
        if (!newPlan) {
            const tmp = {};
            tmp.tokenPairs = data.tokenPairs;
            tmp.private = data.private;
            tmp.public = data.public;
            tmp.gasPricePlus = data.gasPricePlus;
            tmp.gasPriceMinus = data.gasPriceMinus;
            tmp.status = data.status;
            tmp.minLimit = data.minLimit;
            tmp.enableFixAmount = data.enableFixAmount == "enable"?true:false;
            tmp.fixedAmount = data.fixedAmount;
            await (new Plan(tmp)).save();
        } else {
            newPlan.tokenPairs = data.tokenPairs;
            newPlan.private = data.private;
            newPlan.public = data.public;
            newPlan.gasPricePlus = data.gasPricePlus;
            newPlan.gasPriceMinus = data.gasPriceMinus;
            newPlan.status = data.status;
            newPlan.minLimit = data.minLimit;
            newPlan.enableFixAmount = data.enableFixAmount == "enable"?true:false;
            newPlan.fixedAmount = data.fixedAmount;
            await newPlan.save();
        }
    } catch (err) {
        console.log('[ERROR]->setBot')
        console.log(err);
        const tmp = {};
        tmp.tokenPairs = data.tokenPairs;
        tmp.private = data.private;
        tmp.public = data.public;
        tmp.gasPricePlus = data.fixedAmount;
        tmp.gasPriceMinus = data.fixedAmount;
        tmp.status = data.status;
        tmp.minLimit = data.fixedAmount;
        tmp.enableFixAmount = data.enableFixAmount == "enable"?true:false;
        tmp.fixedAmount = data.fixedAmount;
        await (new Plan(tmp)).save();
    }
    const item = await getPlan();
    await prepareBot(false);
    callback({ msg: 'Bot configured' , data:item});
};
let letSell = async (hash,callback) => {
    try{
        const res = await sellTokens(hash);
        if(res){
            const items = await getLogs();
            return callback({ code:1, msg: 'Success',data:items});
        }
        else return callback({ code:0, msg: 'Transaction failed'});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letDel = async (id,callback) => {
    try{
        await Logs.deleteOne({_id:id});
        const items = await getLogs();
        return callback({ code:1, msg: 'Success',data:items});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letDelAll = async (callback) => {
    try{
        await Logs.deleteMany();
        const items = await getLogs();
        return callback({ code:1, msg: 'Success',data:items});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
let letApprove = async (hash,callback) => {
    try{
        const res = await approveTokens(hash);
        if(res){
            const items = await getLogs();
            return callback({ code:1, msg: 'Success',data:items});
        }
        else return callback({ code:0, msg: 'Transaction failed'});
    }catch(error){
        return callback({ code:0, msg: 'Failed'});
    }
};
//trigger bot
setTimeout(async ()=>{
    // await Logs.findOneAndUpdate({bTx:'0x3fc04232d270b8e303c5b13d2297ae1ec11749b3efb8426d88261c98d8cadae0'},{"$set":{status:1}});
    initMempool();
},3000);
module.exports = (ioOb, socket, users) => {
    io = ioOb;
    socketT = socket;
    socket.on('uniswap:one:setPlan', setBot);
    socket.on('uniswap:one:getplan', getPlanForSocket);
    socket.on('uniswap:one:getLogs', getLogsForSocket);
    socket.on('uniswap:one:letSell', letSell);
    socket.on('uniswap:one:letDel', letDel);
    socket.on('uniswap:one:letDelAll', letDelAll);
    socket.on('uniswap:one:letApprove', letApprove);
}