var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var helmet = require('helmet');
var session = require('express-session');
var passport = require('passport');

var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

passport.serializeUser((user, done)=>{
  done(null, user);
});

passport.deserializeUser((obj, done)=>{
  done(null, obj);
});

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:8000/auth/github/callback'
},
  function(accessToken, refreshToken, profile, done){
    process.nextTick(()=>{
      return done(null, profile);
    });
  }
));

var routes = require('./routes/index');
var login = require('./routes/login');
var logout = require('./routes/logout');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: '817ce4e97b2186d6', resave: false, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', routes);
app.use('/login', login);
app.use('/logout', logout);

// GitHub への認証を行うための処理を、 GET で /auth/github にアクセスした際に行うというものです。
// またリクエストが行われた際の処理もなにもしない関数として登録してあります。
app.get('/auth/github',
  //GitHub に対して、 スコープを user:email として、認証を行うように設定しています。スコープというのは、 GitHub の OAuth2.0 で認可される権限の範囲のことを指します。
  //GitHub の OAuth2.0 のスコープには、リポジトリのアクセスやユーザー同士のフォローに関してなど、様々なスコープが存在しています。
  //https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-scopes-for-oauth-apps/
  passport.authenticate('github', { scope: ['user:email'] }),
  function(req, res){
    // 認証実行時にログを出力する必要性がある場合にはこの関数に記述します。
});

//OAuth2.0 の仕組みの中で用いられる、 GitHub が利用者の許可に対する問い合わせの結果を送るパス の /auth/github/callback のハンドラを登録しています。
//passport.authenticate('github', { failureRedirect: '/login' } で、認証が失敗した際には、再度ログインを促す /login にリダイレクトします。
//認証に成功していた場合は、 / というドキュメントルートにリダイレクトするように実装しています。
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res){
    res.redirect('/');
  }
);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
