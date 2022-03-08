const jwt = require('jsonwebtoken');
const multer = require('multer');

const User = require('./models/user');
const config = require('./config');
const requireAuth = require('./middlewares/requireAuth');
const {
  authenticate,
  validateUser,
  changePassword,
  addWallet,
  getWallet,
  removeWallet
} = require('./controllers/restController');
const oneUniSwapV2 = require('./controllers/oneUniSwap_v2');
const upload = multer();
const router = require('express').Router();
const path = require('path');


router.post('/authenticate', validateUser, authenticate);
router.post('/change-password', requireAuth, changePassword);
router.post('/add-wallet', requireAuth, addWallet);
router.post('/remove-wallet', requireAuth, removeWallet);

router.get('/get-wallet', requireAuth, getWallet);

module.exports = (app, io) => {
  app.use('/api', router);
  app.get('*', function (req, res) {
    // console.log(req);
    res.sendFile(path.resolve(__dirname, 'build', 'index.html'));
  });
  app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
  });

  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      message: error.message
    });
  });

  const onConnection = (socket) => {
    oneUniSwapV2(io, socket);
  };

  //socket middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    try {
      if (!socket.user) {
        const decodedToken = jwt.verify(token, config.jwt.secret, {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiry
        });
        const user = await User.findById(decodedToken.id);

        socket.user = user.toJSON();
       
      }
    } catch (error) {
      socket.emit('error');
    }
    next();
  });
  io.on('connection', onConnection);
};
