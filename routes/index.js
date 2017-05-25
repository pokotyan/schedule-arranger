var express = require('express');
var router = express.Router();
const Schedule = require('../models/schedule');

/* GET home page. */
router.get('/', function(req, res, next) {
  const title = "予定調整くん";
  if(req.user){                               //githubログインずみなら。github認証成功時はreq.userが存在する。githubのアカウントの情報が入ってる
    Schedule.findAll({                          //findAllは条件にあったデータモデルに対応するレコードを全て取得する関数
      where:{
        createdBy: req.user.id                    //自分が作成した予定で絞り込み
      },
      order: '"updatedAt" DESC'                   //作成日順で並べ替え
    }).then((schedules)=>{                      //予定データの取得ができたら
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
