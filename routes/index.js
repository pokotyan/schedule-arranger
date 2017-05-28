var express = require('express');
var router = express.Router();
const Schedule = require('../models/schedule');
const moment = require('moment-timezone');
const parseReqFacebook = require('./parse-req-facebook');

/* GET home page. */
router.get('/', parseReqFacebook, function(req, res, next) {
  const title = "予定調整くん";
  if(req.user){                               //ログインずみなら。認証成功時はreq.userが存在する。アカウントの情報が入ってる
    Schedule.findAll({                          //findAllは条件にあったデータモデルに対応するレコードを全て取得する関数
      where:{
        createdBy: req.user.id                    //自分が作成した予定で絞り込み
      },
      order: '"updatedAt" DESC'                   //作成日順で並べ替え
    }).then((schedules)=>{                      //予定データの取得ができたら
      //updatedAt（更新日時）をビューで用いるが、そのままだとutc表示のため見にくい。なので見やすい時刻にしたものを新たに「formattedUpdatedAt」というプロパティに格納する
      schedules.forEach((schedule)=>{
        schedule.formattedUpdatedAt = moment(schedule.updatedAt).tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm');
      });
      //indexビューの表示
      res.render('index',{
        title: title,
        user: req.user,
        schedules: schedules                      //取得した予定データをindex.jadeに渡す
      });
    });
  } else {                                    //github未ログインなら。
    res.render('index', { title: title });      //index.jadeにreq.userは渡さない(そもそもないし)。index.jadeの方では変数「user」の有無でビューの表示を切り替えている。
  }
});

module.exports = router;
