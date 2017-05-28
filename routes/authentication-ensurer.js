'use strict';

//認証が必要なページの関所。認証してないならログインページにリダイレクトさせる
function ensure(req, res, next){
  //認証済みならページを表示
  if(req.isAuthenticated()){ return next(); }
  //認証してないならログインページに飛ばす。また、どのページを開こうとしてたのかをfromクエリに含める
  res.redirect('/login?from=' + req.originalUrl);
}

module.exports = ensure;