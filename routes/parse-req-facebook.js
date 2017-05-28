'use strict';

function parse(req, res, next){
  if(req.user){  //ログアウト時に / へリダイレクトした際、req.userは存在しないので、まず存在確認が必要
    //facebookの長いidを短くする。しないとポスグレのクエリがエラーになる
    req.user.id = String(req.user.id).length > 9 ? parseInt(String(req.user.id).slice(0, 9)) : parseInt(req.user.id)
    //githubとfacebookで名前が格納されてるプロパティが違うのでusernameに統一する
    if(req.user.displayName){
      req.user.username = req.user.displayName;
    }
  }
  return next();
}

module.exports = parse;